// youtube.js - YouTube Subtitle Integration
(() => {
    console.log("LinguaLearn: YouTube module loaded");

    let observer = null;
    let overlay = null;
    let isEnabled = true;
    let currentTranslationAbort = null;
    let translationRequestId = 0;

    // Initialize
    (async function init() {
        const stored = await chrome.storage.local.get('settings');
        isEnabled = stored.settings?.youtubeSubtitlesEnabled !== false; // Default true

        if (isEnabled) {
            startSubtitleObserver();
        }

        // Listen for toggle messages
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "toggleYoutubeSubtitles") {
                isEnabled = request.enabled;
                if (isEnabled) {
                    startSubtitleObserver();
                } else {
                    stopSubtitleObserver();
                }
            }
        });

        // Listen for route changes (SPA navigation)
        // YouTube uses history API, so we might need to re-attach if player is destroyed
        // But usually the player persists. We'll monitor just in case.
    })();

    async function startSubtitleObserver() {
        if (observer) return;

        const captionContainer = await waitForElement('.ytp-caption-window-container');
        const player = await waitForElement('.html5-video-player');

        if (!captionContainer || !player) {
            console.warn("LinguaLearn: Could not find player or caption container");
            return;
        }

        createOverlay(player);

        console.log("LinguaLearn: Starting subtitle observer");

        // Hide native captions to avoid duplicate English subtitles
        captionContainer.classList.add('lingua-hidden-native');

        // Debounce the update to wait for YouTube to finish building the complete subtitle
        const debouncedUpdateOverlay = debounce(updateOverlay, 500);

        observer = new MutationObserver((mutations) => {
            debouncedUpdateOverlay(captionContainer);
        });

        observer.observe(captionContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Initial update
        debouncedUpdateOverlay(captionContainer);
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function stopSubtitleObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (overlay) {
            overlay.remove();
            overlay = null;
        }

        // Restore native captions (if we ever hid them)
        const captionContainer = document.querySelector('.ytp-caption-window-container');
        if (captionContainer) {
            captionContainer.classList.remove('lingua-hidden-native');
        }
    }

    function createOverlay(player) {
        if (document.getElementById('lingua-yt-captions')) return;

        overlay = document.createElement('div');
        overlay.id = 'lingua-yt-captions';

        // Insert into the player so it updates with fullscreen, etc.
        player.appendChild(overlay);
    }

    let clearTimer = null;

    function updateOverlay(sourceContainer) {
        if (!overlay) return;

        // Extract text from the YouTube caption segments
        // YouTube usually has spans with classes like .ytp-caption-segment
        const segments = sourceContainer.querySelectorAll('.ytp-caption-segment');

        if (segments.length === 0) {
            // Don't clear immediately — YouTube may be transitioning between subtitles
            if (!clearTimer) {
                clearTimer = setTimeout(() => {
                    renderOverlay('', '');
                    lastOriginalText = "";
                    lastTranslatedText = "";
                }, 300);
            }
            return;
        }

        // Cancel pending clear if new content arrived
        if (clearTimer) {
            clearTimeout(clearTimer);
            clearTimer = null;
        }

        // Collect all text
        let fullText = "";
        segments.forEach(seg => fullText += seg.textContent + " ");
        fullText = fullText.trim();

        // Clean up newlines or extra spaces
        fullText = fullText.replace(/\s+/g, ' ');

        if (!fullText) {
            return;
        }

        // Avoid re-rendering if text hasn't changed (Critical for performance/flicker)
        if (fullText === lastOriginalText) {
            return;
        }

        // Trigger full sentence translation

        translateSubtitle(fullText);
    }

    // Store last translated text to avoid flickering/re-translating identical segments
    let lastOriginalText = "";
    let lastTranslatedText = "";

    // Direct Google Translate function for YouTube (faster, no backend dependency)
    async function translateTextGoogle(text, targetLang) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data && data[0]) {
                    const translation = data[0]
                        .filter(item => item && item[0])
                        .map(item => item[0])
                        .join('');
                    return translation || text;
                }
            }
        } catch (e) {
            console.warn("Google Translate error:", e);
        }
        return text; // Fallback to original if translation fails
    }

    async function translateSubtitle(text) {
        if (text === lastOriginalText && lastTranslatedText) {
            // Just re-render if we have it (in case DOM was cleared)
            renderOverlay(lastOriginalText, lastTranslatedText);
            return;
        }

        // Cancel any in-flight translation to prevent race conditions
        if (currentTranslationAbort) {
            currentTranslationAbort.abort();
        }

        lastOriginalText = text;

        // Generate unique request ID for this translation
        const requestId = ++translationRequestId;

        // Show original text immediately with previous translation (no "..." flicker)
        // This keeps the old translation visible until the new one arrives
        renderOverlay(text, lastTranslatedText || '翻译中...');

        // Get Target Lang
        let targetLang = 'zh';
        try {
            const stored = await chrome.storage.local.get('settings');
            targetLang = stored.settings?.targetLanguage || 'zh';
        } catch (e) {
            console.warn("Failed to get settings, using default language 'zh':", e);
        }

        // Use Google Translate directly for YouTube subtitles (faster)
        const translation = await translateTextGoogle(text, targetLang);

        // Only apply this translation if it's still the latest request
        // (prevents old translations from overwriting newer ones)
        if (requestId === translationRequestId) {
            lastTranslatedText = translation;
            // Update UI with bilingual subtitles
            renderOverlay(text, translation);
        }
    }

    // Helper function to render overlay with incremental DOM updates (no innerHTML)
    function renderOverlay(originalText, translationText) {
        if (!overlay) return;

        let origDiv = overlay.querySelector('.lingua-yt-original');
        let transDiv = overlay.querySelector('.lingua-yt-translation');

        // Create elements if they don't exist
        if (!origDiv) {
            origDiv = document.createElement('div');
            origDiv.className = 'lingua-yt-original';
            overlay.appendChild(origDiv);
        }
        if (!transDiv) {
            transDiv = document.createElement('div');
            transDiv.className = 'lingua-yt-translation';
            overlay.appendChild(transDiv);
        }

        // Only update textContent if it actually changed (prevents unnecessary reflows)
        if (origDiv.textContent !== originalText) {
            origDiv.textContent = originalText;
        }
        if (transDiv.textContent !== translationText) {
            transDiv.textContent = translationText;
        }

        // If both are empty, remove the elements
        if (!originalText && !translationText) {
            origDiv.remove();
            transDiv.remove();
        }
    }

    function renderInteractiveText(text) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'lingua-yt-line';

        const words = text.split(/\s+/);

        words.forEach(word => {
            const span = document.createElement('span');
            span.className = 'lingua-word';
            span.textContent = word + " "; // Add space back
            span.onclick = (e) => handleWordClick(e, word);
            lineDiv.appendChild(span);
        });

        overlay.innerHTML = '';
        overlay.appendChild(lineDiv);

        // Append Translation Container
        const transDiv = document.createElement('div');
        transDiv.id = 'lingua-yt-translation';
        transDiv.className = 'lingua-yt-translation';
        transDiv.innerText = lastTranslatedText || ""; // restore if exists
        overlay.appendChild(transDiv);
    }

    function handleWordClick(e, word) {
        e.stopPropagation(); // Prevent pausing the player if clicking the overlay triggers it? 
        // Actually YouTube player usually creates click-to-pause on the big wrapper. 
        // We want to stop that propagation so *only* our logic runs, 
        // BUT we also explicitly want to pause.

        const video = document.querySelector('video');
        if (video) video.pause();

        // Clean word
        const cleanedWord = word.replace(/[.,!?;:()"]/g, "").trim();

        // Dispatch event for content.js to pick up
        // We pass the coordinates so we can show the bubble right there
        const event = new CustomEvent('lingua-word-click', {
            detail: {
                word: cleanedWord,
                x: e.clientX,
                y: e.clientY
            }
        });
        document.dispatchEvent(event);
    }

    // Helper to wait for elements
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

})();
