// youtube.js - YouTube Subtitle Integration
console.log("LinguaLearn: YouTube module loaded");

let observer = null;
let overlay = null;
let isEnabled = true;

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

    // We no longer hide native captions
    // captionContainer.classList.add('lingua-hidden-native');

    // Debounce the update to prevent rapid flickering as YouTube builds the sentence part-by-part
    const debouncedUpdateOverlay = debounce(updateOverlay, 100);

    observer = new MutationObserver((mutations) => {
        debouncedUpdateOverlay(captionContainer);
    });

    observer.observe(captionContainer, {
        childList: true,
        subtree: true,
        attributes: true,
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

function updateOverlay(sourceContainer) {
    if (!overlay) return;

    // Extract text from the YouTube caption segments
    // YouTube usually has spans with classes like .ytp-caption-segment
    const segments = sourceContainer.querySelectorAll('.ytp-caption-segment');

    if (segments.length === 0) {
        // Do not clear immediately if empty, might be momentary flicker?
        // But if genuinely empty, we should clear.
        // Let's rely on standard current logic but maybe check if change is significant.
        overlay.innerHTML = '';
        return;
    }

    // Collect all text
    let fullText = "";
    segments.forEach(seg => fullText += seg.textContent + " ");
    fullText = fullText.trim();

    // Clean up newlines or extra spaces
    fullText = fullText.replace(/\s+/g, ' ');

    if (!fullText) {
        overlay.innerHTML = '';
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

async function translateSubtitle(text) {
    if (text === lastOriginalText && lastTranslatedText) {
        // Just re-render if we have it (in case DOM was cleared)
        if (document.getElementById('lingua-yt-translation')) {
            document.getElementById('lingua-yt-translation').innerText = lastTranslatedText;
        }
        return;
    }

    lastOriginalText = text;

    // Show placeholder or keep old? Best to show generic loading or nothing
    let transDiv = document.getElementById('lingua-yt-translation');
    if (transDiv) transDiv.innerText = "...";

    // Get Target Lang
    const stored = await chrome.storage.local.get('settings');
    const targetLang = stored.settings?.targetLanguage || 'en';

    // Call Utils
    const result = await translateText(text, targetLang);
    lastTranslatedText = result.translation;

    // Update UI directly in overlay
    if (overlay) {
        overlay.innerHTML = `<div class="lingua-yt-translation">${result.translation}</div>`;
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
