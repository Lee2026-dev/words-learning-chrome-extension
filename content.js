// content.js - Primary Content Script

let highlightEnabled = true;
let immersionEnabled = false;
let savedWords = [];
let bubbleElement = null;

// Initialize
(async function init() {
    await loadSettings();
    if (highlightEnabled) {
        await loadWordsAndHighlight(); // Ensure words are loaded before starting
        startObserver();
    }
    if (immersionEnabled) ImmersionTranslator.start();

    // Text Selection Listener (MouseUp)
    document.addEventListener('mouseup', (e) => {
        // Delay slightly to ensure selection is final
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();

            // If clicking inside the bubble or trigger, do nothing
            if (e.target.closest('#lingua-bubble-host') || e.target.closest('.lingua-trigger-icon')) return;

            if (text && text.length > 0 && text.length < 100) { // Limit length to avoid accidental paragraph selects
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Position at the center of the selection (Viewport coordinates for position:fixed)
                const x = rect.left + (rect.width / 2);
                const y = rect.bottom + 5;

                showTriggerIcon(x, y, text);
            } else {
                hideTriggerIcon();
            }
        }, 10);
    });

    // Hide trigger on mousedown (if not clicking the trigger itself)
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.lingua-trigger-icon')) {
            hideTriggerIcon();
        }
    });

    // Listen for custom word clicks (e.g. from YouTube overlay)
    document.addEventListener('lingua-word-click', (e) => {
        const { word, x, y } = e.detail;
        handleExternalWordClick(word, x, y);
    });
})();

// --- Mutation Observer for Dynamic Content ---
let observer = null;
let highlightDebounceTimer = null;

function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
        let shouldHighlight = false;
        for (const mutation of mutations) {
            // Skip mutations from our own UI elements (popups, overlays)
            if (mutation.target.closest && (mutation.target.closest('#lingua-yt-captions') || mutation.target.closest('#lingua-bubble-host'))) {
                continue;
            }

            if (mutation.addedNodes.length > 0) {
                // Check if any added node is a relevant element or text node
                for (let node of mutation.addedNodes) {
                    // Skip if node is inside YouTube overlay or is our Bubble
                    if (node.nodeType === 1 && node.closest && (node.closest('#lingua-yt-captions') || node.closest('#lingua-bubble-host'))) {
                        continue;
                    }

                    if (node.nodeType === 1 || node.nodeType === 3) {
                        shouldHighlight = true;
                        break;
                    }
                }
            }
            if (shouldHighlight) break;
        }

        if (shouldHighlight) {
            clearTimeout(highlightDebounceTimer);
            highlightDebounceTimer = setTimeout(() => {
                if (savedWords.length > 0 && highlightEnabled) {
                    applyHighlights(document.body);
                }
            }, 800);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Listen for messages from Popup or Background
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "translateSelection") {
        handleTranslateSelection(request.text);
    } else if (request.action === "toggleHighlight") {
        highlightEnabled = request.enabled;
        if (highlightEnabled) {
            await loadWordsAndHighlight();
            startObserver();
        } else {
            removeHighlights();
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }
    } else if (request.action === "toggleImmersion") {
        immersionEnabled = request.enabled;
        if (immersionEnabled) {
            ImmersionTranslator.start();
        } else {
            ImmersionTranslator.stop();
        }
    } else if (request.action === "updateHighlightStyle") {
        // Update all existing highlights with new style
        const highlights = document.querySelectorAll('.lingua-highlight');
        highlights.forEach(span => {
            applyHighlightStyle(span, request.style, request.color);
        });
    }
});

// Listen for messages from Dashboard (in-page postMessage)
window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'LINGUA_UPDATE') {
        const { action, enabled, style, color } = event.data;

        if (action === "toggleHighlight") {
            highlightEnabled = enabled;
            if (highlightEnabled) {
                await loadWordsAndHighlight();
                startObserver();
            } else {
                removeHighlights();
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            }
        } else if (action === "toggleImmersion") {
            immersionEnabled = enabled;
            if (immersionEnabled) {
                ImmersionTranslator.start();
            } else {
                ImmersionTranslator.stop();
            }
        } else if (action === "updateHighlightStyle") {
            const highlights = document.querySelectorAll('.lingua-highlight');
            highlights.forEach(span => {
                applyHighlightStyle(span, style, color);
            });
        }
    }
});

// Apply highlight style based on settings
function applyHighlightStyle(element, style, color) {
    // Get settings from storage if not provided
    if (!style || !color) {
        chrome.storage.local.get(['settings'], (data) => {
            const settings = data.settings || {};
            const highlightStyle = settings.highlightStyle || 'underline';
            const highlightColor = settings.highlightColor || '#FCD34D';
            applyStyle(element, highlightStyle, highlightColor);
        });
    } else {
        applyStyle(element, style, color);
    }

    function applyStyle(el, s, c) {
        // Reset styles
        el.style.textDecoration = '';
        el.style.textDecorationColor = '';
        el.style.textDecorationThickness = '';
        el.style.textUnderlineOffset = '';
        el.style.backgroundColor = '';
        el.style.fontWeight = '';
        el.style.color = '';
        el.style.padding = '';
        el.style.borderRadius = '';

        // Apply style
        if (s === 'underline') {
            el.style.textDecoration = 'underline';
            el.style.textDecorationColor = c;
            el.style.textDecorationThickness = '2px';
            el.style.textUnderlineOffset = '2px';
        } else if (s === 'background') {
            el.style.backgroundColor = c;
            el.style.padding = '2px 4px';
            el.style.borderRadius = '3px';
        } else if (s === 'bold') {
            el.style.fontWeight = '700';
            el.style.color = c;
        }
    }
}

// --- Highlighting Logic ---

async function loadSettings() {
    return new Promise(resolve => {
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                highlightEnabled = result.settings.highlightEnabled !== false; // Default true
                immersionEnabled = result.settings.immersionMode === true;     // Default false
            }
            resolve();
        });
    });
}

async function loadWordsAndHighlight() {
    try {
        // 1. Fast load from local storage
        const result = await chrome.storage.local.get(['vocabulary']);
        savedWords = result.vocabulary || [];

        if (savedWords.length > 0) {
            applyHighlights(document.body);
        }

        // 2. Sync with backend to get latest words
        if (typeof syncVocabulary === 'function') {
            const freshWords = await syncVocabulary();
            if (freshWords && freshWords.length > 0) {
                savedWords = freshWords;
                applyHighlights(document.body);
            }
        }
    } catch (e) {
        console.error("LinguaLearn: Error loading words:", e);
    }
}

function applyHighlights(rootElement) {
    if (!rootElement || !savedWords || savedWords.length === 0) return;

    // Pre-compile word map and regex for performance
    const wordMap = new Map();
    const escapedTerms = [];

    savedWords.forEach(w => {
        if (w && w.original) {
            const term = w.original.toLowerCase();
            if (!wordMap.has(term)) {
                wordMap.set(term, w);
                escapedTerms.push(escapeRegExp(w.original));
            }
        }
    });

    if (escapedTerms.length === 0) return;

    // Create a single regex for all words
    // \b is great for English but might fail for CJK.
    // For now we stick with \b but we could make it configurable.
    const combinedRegex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName;
                if (tagName.match(/SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|NOSCRIPT|CANVAS|SVG/)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.classList.contains('lingua-highlight') || parent.closest('.lingua-highlight')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.closest('#lingua-bubble-host')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.nodeValue.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodesToReplace = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (combinedRegex.test(node.nodeValue)) {
            nodesToReplace.push(node);
        }
        combinedRegex.lastIndex = 0; // Reset after test
    }

    nodesToReplace.forEach(node => {
        const textContent = node.nodeValue;
        const parent = node.parentNode;
        if (!parent) return;

        // Split by the combined regex, keeping the matches
        const parts = textContent.split(combinedRegex);

        if (parts.length > 1) {
            const fragment = document.createDocumentFragment();

            parts.forEach(part => {
                const lowerPart = part.toLowerCase();
                const wordObj = wordMap.get(lowerPart);

                if (wordObj) {
                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = 'lingua-highlight';
                    highlightSpan.textContent = part;
                    highlightSpan.title = `${wordObj.translation}`;

                    // Apply dynamic highlight style
                    applyHighlightStyle(highlightSpan);

                    highlightSpan.onclick = (e) => {
                        e.stopPropagation();
                        showSavedWordBubble(e, wordObj);
                    };
                    fragment.appendChild(highlightSpan);
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });

            try {
                parent.replaceChild(fragment, node);
            } catch (e) {
                // Node might have been removed under us (MutationObserver race)
            }
        }
    });
}

function removeHighlights() {
    const highlights = document.querySelectorAll('.lingua-highlight');
    highlights.forEach(span => {
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
    });
    document.body.normalize();
}

// --- Translation Bubble UI ---

async function handleTranslateSelection(selectionText) {
    if (!selectionText) return;

    // Check if extension context is still valid
    if (!chrome.runtime?.id) return;

    let targetLang = 'en';
    try {
        const stored = await chrome.storage.local.get('settings');
        targetLang = stored.settings?.targetLanguage || 'en';
    } catch (e) {
        console.warn("Context invalidated, using default lang");
    }

    // Capture Context (Sentence)
    const selection = window.getSelection();
    let context = "";
    if (selection.rangeCount > 0) {
        const node = selection.anchorNode;
        context = node.parentElement ? node.parentElement.innerText.trim() : node.textContent.trim();
        // Simple truncation
        if (context.length > 200) context = context.substring(0, 200) + "...";
    }

    showBubble(selectionText, "正在翻译...", true, context);

    // Translate only the selected word (not the context)
    // translateText returns full object { translation, phonetic, meanings, audio_url, ... }
    const wordResult = await translateText(selectionText, targetLang);

    // Pass the full wordResult object to support rich display
    // Context is shown but not translated (empty string for contextTranslation)
    updateBubbleContent(selectionText, wordResult, context, "", wordResult.phonetic);
}

async function handleExternalWordClick(word, x, y) {
    if (!word) return;

    // Show loading bubble at specific coordinates
    showBubbleAt(x, y, word, "正在翻译...", true);

    if (!chrome.runtime?.id) return;

    let targetLang = 'en';
    try {
        const stored = await chrome.storage.local.get('settings');
        targetLang = stored.settings?.targetLanguage || 'en';
    } catch { return; }

    // Translate
    const result = await translateText(word, targetLang);

    // Update bubble with full result object
    updateBubbleContent(word, result, "", "", result.phonetic);
}

function createBubbleElement() {
    if (document.getElementById('lingua-bubble-host')) {
        return document.getElementById('lingua-bubble-host');
    }

    const host = document.createElement('div');
    host.id = 'lingua-bubble-host';
    document.body.appendChild(host);
    return host;
}

function showBubble(original, translation, isLoading = false, context = "", contextTranslation = "", phonetic = "") {
    const host = createBubbleElement();

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Center horizontally relative to selection using viewport coordinates (fixed)
    let left = rect.left + (rect.width / 2);
    const top = rect.bottom + 10;

    host.style.position = 'fixed';
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;
    host.style.transform = "translateX(-50%)"; // Center alignment

    renderBubbleSetup(host, original, translation, isLoading, context, contextTranslation, phonetic);
}

function showBubbleAt(x, y, original, translation, isLoading = false, context = "", contextTranslation = "", phonetic = "") {
    const host = createBubbleElement();

    // Coordinates are viewport-based (clientX/Y)
    const top = y + 20;
    const left = x;

    host.style.position = 'fixed';
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;

    renderBubbleSetup(host, original, translation, isLoading, context, contextTranslation, phonetic);
}

async function showSavedWordBubble(e, wordObj) {
    const host = createBubbleElement();
    const top = e.clientY + 10; // Viewport coordinate
    const left = e.clientX;

    host.style.position = 'fixed';
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;
    host.style.transform = "none"; // Reset any previous transform if reused

    // 1. Show dynamic loading state using existing renderer
    renderBubbleSetup(host, wordObj.original, "更新中...", true, wordObj.context, "", wordObj.phonetic);

    // 2. Fetch fresh rich data from backend (ECDICT)
    const stored = await chrome.storage.local.get('settings');
    const targetLang = stored.settings?.targetLanguage || 'en';
    const richData = await translateText(wordObj.original, targetLang);

    // 3. Render final bubble with rich data
    renderSavedBubbleRich(host, wordObj, richData);
}

function renderSavedBubbleRich(host, wordObj, richData) {
    const original = wordObj.original;
    const isRichData = typeof richData === 'object' && richData !== null;
    const meanings = (isRichData && richData.meanings && richData.meanings.length > 0) ? richData.meanings : (wordObj.meanings || []);
    const phoneticText = isRichData ? (richData.phonetic || wordObj.phonetic) : wordObj.phonetic;
    const audioUrl = isRichData ? richData.audio_url : null;

    // Icons
    const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const volumeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    const heartFilled = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    // Checkbox Icons
    const squareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    const checkSquareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;

    const isMastered = wordObj.learned === true;
    const masterColor = isMastered ? "var(--success-color)" : "#94a3b8";
    const statusIcon = isMastered ? checkSquareIcon : squareIcon;

    // ... (rest of the renderSavedBubbleRich content)


    // Phonetic HTML
    let phoneticHtml = "";
    if (phoneticText) {
        const audioBtn = audioUrl ?
            `<button class="lingua-btn-audio" style="background:none; border:none; cursor:pointer; padding:4px; margin-left:8px; color:var(--primary-color); display:inline-flex; align-items:center; border-radius:50%;" id="lingua-audio-btn">${volumeIcon}</button>` :
            `<button class="lingua-btn-tts" style="background:none; border:none; cursor:pointer; padding:4px; margin-left:8px; color:#94a3b8; display:inline-flex; align-items:center; border-radius:50%;" id="lingua-speak-btn">${volumeIcon}</button>`;

        phoneticHtml = `<div style="display:flex; align-items:center; margin-top:4px;"><span style="font-size:14px; color:#64748b; font-family:monospace;">${phoneticText}</span>${audioBtn}</div>`;
    }

    // Meanings HTML
    let meaningsHtml = "";
    if (meanings && meanings.length > 0) {
        const posColors = { 'n.': '#8B5CF6', 'v.': '#3B82F6', 'adj.': '#10B981', 'adv.': '#F59E0B', 'conj.': '#EF4444', 'web.': '#6366F1', 'general': '#64748B' };
        meaningsHtml = meanings.map(meaning => {
            const pos = meaning.partOfSpeech || 'general';
            const color = posColors[pos] || posColors['general'];
            const defs = meaning.definitions || [];
            console.log('defs: ', defs)
            const defsHtml = defs.join(',');
            return `<div style="margin-bottom:8px; display:flex; align-items:flex-start; gap:10px;"><span style="display:inline-block; background:${color}15; color:${color}; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; flex-shrink:0; margin-top:2px;">${pos}</span><div style="font-size:15px; color:#1e293b; font-weight:500; line-height:1.5;">${defsHtml}</div></div>`;
        }).join('');
    } else {
        meaningsHtml = `<div class="bubble-translation" style="color:var(--primary-color); font-size:18px; font-weight:500;">${wordObj.translation}</div>`;
    }

    host.innerHTML = `
        <div class="bubble-content">
            <div class="bubble-header" style="border-bottom:none; margin-bottom:0;">
                <div style="flex-grow:1;">
                     <span class="bubble-word" style="font-size:20px; font-weight:700;">${original}</span>
                     ${phoneticHtml}
                </div>
                <div style="display:flex; gap:4px; align-items:flex-start;">
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:${masterColor}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" id="lingua-master-btn" title="标记为已掌握">
                        ${statusIcon}
                     </button>
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center;" id="lingua-unsave-btn" title="已收藏">
                        ${heartFilled}
                     </button>
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:#94a3b8; cursor:pointer; display:flex; align-items:center; justify-content:center;" id="lingua-close-btn" title="关闭">
                        ${closeIcon}
                     </button>
                </div>
            </div>
            <div style="margin-top:16px; padding-top:16px; border-top:1px solid #f1f5f9;">
                ${meaningsHtml}
            </div>
        </div>
    `;

    // Prevent button clicks from closing the bubble via closeBubbleOutside
    host.querySelectorAll('.lingua-btn-icon, .lingua-btn-audio, .lingua-btn-tts').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    // Events
    const audioBtn = host.querySelector('#lingua-audio-btn');
    if (audioBtn) audioBtn.onclick = () => { new Audio(audioUrl).play(); };

    const ttsBtn = host.querySelector('#lingua-speak-btn');
    if (ttsBtn) ttsBtn.onclick = () => { speechSynthesis.speak(new SpeechSynthesisUtterance(original)); };

    const heartOutline = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    const unsaveBtn = host.querySelector('#lingua-unsave-btn');
    let isSavedState = true; // Start as saved (this is the "saved word" bubble)

    function toggleSaveState() {
        // Animation
        unsaveBtn.style.transform = "scale(1.2)";
        setTimeout(() => unsaveBtn.style.transform = "scale(1)", 200);

        if (isSavedState) {
            // UNSAVE: remove the word
            deleteWordLocal(wordObj.id);
            removeHighlights();
            applyHighlights(document.body);

            // Update UI to "unsaved"
            unsaveBtn.innerHTML = heartOutline;
            unsaveBtn.style.color = "#94a3b8";
            unsaveBtn.title = "保存到生词本";

            // Reset master button
            const masterBtn = host.querySelector('#lingua-master-btn');
            if (masterBtn) {
                masterBtn.innerHTML = squareIcon;
                masterBtn.style.color = "#94a3b8";
                wordObj.learned = false;
            }
        } else {
            // RE-SAVE: save the word again
            const finalContext = wordObj.context || window.location.href;
            const meaningsToSave = (typeof richData !== 'undefined' && richData.meanings) ? richData.meanings : (wordObj.meanings || []);
            const newWord = saveWord(wordObj.original, wordObj.translation, finalContext, wordObj.url || window.location.href, wordObj.phonetic, meaningsToSave);
            savedWords.push(newWord);
            // Update wordObj.id to the new ID so future operations work
            wordObj.id = newWord.id;
            applyHighlights(document.body);

            // Update UI to "saved"
            unsaveBtn.innerHTML = heartFilled;
            unsaveBtn.style.color = "#ef4444";
            unsaveBtn.title = "已收藏";
        }

        isSavedState = !isSavedState;
    }

    unsaveBtn.onclick = toggleSaveState;

    host.querySelector('#lingua-master-btn').onclick = (e) => {
        const newLearned = !wordObj.learned;
        const btn = e.currentTarget;
        btn.innerHTML = newLearned ? checkSquareIcon : squareIcon;
        btn.style.color = newLearned ? "#10B981" : "#94a3b8";
        btn.style.transform = "scale(1.2)";
        setTimeout(() => btn.style.transform = "scale(1)", 200);

        // Local-first: update locally, sync to backend async
        wordObj.learned = newLearned;
        updateWordLocal(wordObj.id, { learned: newLearned });
    };

    host.querySelector('#lingua-close-btn').onclick = closeBubble;

    // Enable dragging
    makeBubbleDraggable(host);
}

function renderBubbleSetup(host, original, translationData, isLoading, context, contextTranslation, phonetic) {
    // translationData can be either a string (old format) or an object (new format with meanings)
    const isRichData = typeof translationData === 'object' && translationData !== null;
    const simpleTranslation = isRichData ? (translationData.translation || original) : translationData;
    const meanings = isRichData ? (translationData.meanings || []) : [];
    const audioUrl = isRichData ? translationData.audio_url : null;
    const phoneticText = isRichData ? (translationData.phonetic || phonetic) : phonetic;

    // Check if word is already saved — use a function so we always get fresh state
    const checkIsSaved = () => savedWords.some(w => w.original && w.original.toLowerCase() === original.toLowerCase());
    const isSaved = checkIsSaved();

    const btnDisabled = isLoading ? "disabled" : "";

    // SVG Icons
    const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const volumeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

    // Heart Icons
    const heartOutline = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    const heartFilled = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

    const saveIcon = isSaved ? heartFilled : heartOutline;
    const saveColor = isSaved ? "#ef4444" : "#94a3b8";

    // Checkbox Icons
    const squareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    const checkSquareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;

    // Find saved word object if exists
    const findSavedWordObj = () => savedWords.find(w => w.original && w.original.toLowerCase() === original.toLowerCase());
    const savedWordObj = findSavedWordObj();
    const isMastered = savedWordObj && savedWordObj.learned === true;
    const masterIcon = isMastered ? checkSquareIcon : squareIcon;
    const masterColor = isMastered ? "#10B981" : "#94a3b8";

    // Context HTML - Removed as per request
    let contextHtml = "";

    // Phonetic HTML
    let phoneticHtml = "";
    if (phoneticText) {
        const audioBtn = audioUrl ?
            `<button class="lingua-btn-audio" style="background:none; border:none; cursor:pointer; padding:4px; margin-left:8px; color:var(--primary-color); display:inline-flex; align-items:center; border-radius:50%; transition:background 0.2s;" id="lingua-audio-btn" title="Play pronunciation">${volumeIcon}</button>` :
            `<button class="lingua-btn-tts" style="background:none; border:none; cursor:pointer; padding:4px; margin-left:8px; color:#94a3b8; display:inline-flex; align-items:center; border-radius:50%; transition:background 0.2s;" id="lingua-speak-btn" title="Text-to-speech">${volumeIcon}</button>`;

        phoneticHtml = `
            <div style="display:flex; align-items:center; margin-top:4px;">
                <span style="font-size:14px; color:#64748b; font-family:monospace;">${phoneticText}</span>
                ${audioBtn}
            </div>
        `;
    }

    // Meanings HTML
    let meaningsHtml = "";
    if (meanings && meanings.length > 0) {
        const posColors = {
            'n.': '#8B5CF6', 'v.': '#3B82F6', 'adj.': '#10B981', 'adv.': '#F59E0B', 'conj.': '#EF4444', 'web.': '#6366F1', 'general': '#64748B'
        };

        meaningsHtml = meanings.map(meaning => {
            const pos = meaning.partOfSpeech || 'general';
            const color = posColors[pos] || posColors['general'];
            const definitions = meaning.definitions || [];
            console.log('definitions: ', definitions)
            const defsHtml = definitions.join(',');

            return `
                <div style="margin-bottom:8px; display:flex; align-items:flex-start; gap:10px;">
                    <span style="display:inline-block; background:${color}15; color:${color}; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; flex-shrink:0; margin-top:2px;">${pos}</span>
                    <div style="font-size:15px; color:#1e293b; font-weight:500; line-height:1.5;">
                        ${defsHtml}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        meaningsHtml = `<div class="bubble-translation" style="color:var(--primary-color); font-size:18px; font-weight:500; line-height:1.4;">${simpleTranslation}</div>`;
    }

    host.innerHTML = `
        <div class="bubble-content">
            <div class="bubble-header" style="border-bottom:none; margin-bottom:0;">
                <div style="flex-grow:1;">
                     <span class="bubble-word" style="font-size:20px; font-weight:700;">${original}</span>
                     ${phoneticHtml}
                </div>
                <div style="display:flex; gap:8px; align-items:flex-start;">
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:${masterColor}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" id="lingua-master-btn" title="Mark as Mastered" ${btnDisabled}>
                        ${isLoading ? '' : masterIcon}
                     </button>
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:${saveColor}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" id="lingua-save-icon-btn" title="Save to Wordbook" ${btnDisabled}>
                        ${isLoading ? '<span style="font-size:12px">...</span>' : saveIcon}
                     </button>
                     <button class="lingua-btn-icon" style="padding:6px; border-radius:50%; width:32px; height:32px; border:none; background:transparent; color:#94a3b8; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" id="lingua-close-btn" title="Close">
                        ${closeIcon}
                     </button>
                </div>
            </div>
            <div style="margin-top:16px; padding-top:16px; border-top:1px solid #f1f5f9;">
                ${meaningsHtml}
            </div>
        </div>
    `;

    // Prevent button clicks from closing the bubble via closeBubbleOutside
    host.querySelectorAll('.lingua-btn-icon, .lingua-btn-audio, .lingua-btn-tts').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    // Bind events
    if (!isLoading) {
        const audioBtn = host.querySelector('#lingua-audio-btn');
        if (audioBtn && audioUrl) {
            audioBtn.onclick = () => {
                const audio = new Audio(audioUrl);
                audio.play().catch(err => console.error('Audio playback failed:', err));
            };
        }
        const ttsBtn = host.querySelector('#lingua-speak-btn');
        if (ttsBtn) {
            ttsBtn.onclick = () => {
                const utterance = new SpeechSynthesisUtterance(original);
                speechSynthesis.speak(utterance);
            };
        }

        const saveBtn = host.querySelector('#lingua-save-icon-btn');
        const masterBtn = host.querySelector('#lingua-master-btn');

        // Helper to update button visual state
        const updateMasterBtn = (isLearned) => {
            if (masterBtn) {
                masterBtn.innerHTML = isLearned ? checkSquareIcon : squareIcon;
                masterBtn.style.color = isLearned ? "#10B981" : "#94a3b8";
            }
        };

        if (saveBtn) {
            saveBtn.onclick = () => {
                saveBtn.style.transform = "scale(1.2)";
                setTimeout(() => saveBtn.style.transform = "scale(1)", 200);

                if (checkIsSaved()) {
                    // UNSAVE: word is already saved, remove it
                    const existingWord = findSavedWordObj();
                    if (existingWord) {
                        deleteWordLocal(existingWord.id);
                        removeHighlights();
                        applyHighlights(document.body);
                    }
                    saveBtn.innerHTML = heartOutline;
                    saveBtn.style.color = "#94a3b8";
                    // Also reset master button
                    updateMasterBtn(false);
                } else {
                    // SAVE: word is not saved yet
                    saveBtn.innerHTML = heartFilled;
                    saveBtn.style.color = "#ef4444";

                    const finalContext = context || window.location.href;
                    const savedWord = saveWord(original, simpleTranslation, finalContext, window.location.href, phoneticText, meanings);
                    savedWords.push(savedWord);
                    applyHighlights(document.body);
                }
            };
        }

        if (masterBtn) {
            masterBtn.onclick = () => {
                // If not saved, save first — use fresh lookup
                let currentWord = findSavedWordObj();

                if (!currentWord) {
                    // Local-first save
                    const finalContext = context || window.location.href;
                    currentWord = saveWord(original, simpleTranslation, finalContext, window.location.href, phoneticText, meanings);
                    savedWords.push(currentWord);
                    applyHighlights(document.body);
                    // Update save icon too
                    if (saveBtn) {
                        saveBtn.innerHTML = heartFilled;
                        saveBtn.style.color = "#ef4444";
                    }
                }

                // Toggle learned status
                const newLearned = !currentWord.learned;
                currentWord.learned = newLearned;
                updateMasterBtn(newLearned);

                // Animation
                masterBtn.style.transform = "scale(1.2)";
                setTimeout(() => masterBtn.style.transform = "scale(1)", 200);

                // Local-first: update locally, sync to backend async
                updateWordLocal(currentWord.id, { learned: newLearned });
            };
        }
    }

    const closeBtn = host.querySelector('#lingua-close-btn');
    if (closeBtn) closeBtn.onclick = closeBubble;

    // Enable dragging
    makeBubbleDraggable(host);

    // Remove any existing listener before adding to prevent duplicates
    document.removeEventListener('mousedown', closeBubbleOutside);
    document.addEventListener('mousedown', closeBubbleOutside);
}

function updateBubbleContent(original, translation, context, contextTranslation, phonetic) {
    const host = document.getElementById('lingua-bubble-host');
    if (host) {
        renderBubbleSetup(host, original, translation, false, context, contextTranslation, phonetic);
    }
}

function closeBubble() {
    const host = document.getElementById('lingua-bubble-host');
    if (host) {
        host.remove();
        document.removeEventListener('mousedown', closeBubbleOutside);
    }
}

function closeBubbleOutside(e) {
    const host = document.getElementById('lingua-bubble-host');
    if (host && !host.contains(e.target)) {
        closeBubble();
    }
}


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Immersion Translation Logic ---
const ImmersionTranslator = {
    observer: null,
    errorCount: 0,
    MAX_ERRORS: 3,

    start: function () {
        if (this.observer) return; // Already running
        this.errorCount = 0;

        // 1. Setup Intersection Observer
        this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
            root: null,
            rootMargin: '200px', // Preload
            threshold: 0.1
        });

        // 2. Select Candidate Elements
        // Focus on content blocks
        const candidates = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');

        candidates.forEach(el => {
            // Filter: Must have text, not too short, not already translated
            if (this.isValidCandidate(el)) {
                this.observer.observe(el);
            }
        });

        console.log("Immersion Mode Started");
    },

    stop: function () {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Remove all injected blocks
        const blocks = document.querySelectorAll('.lingua-immersion-block');
        blocks.forEach(el => el.remove());

        // Reset flags on original elements
        const translated = document.querySelectorAll('[data-lingua-translated]');
        translated.forEach(el => {
            el.removeAttribute('data-lingua-translated');
            el.removeAttribute('data-lingua-translating');
        });

        console.log("Immersion Mode Stopped");
    },

    isValidCandidate: function (el) {
        if (el.hasAttribute('data-lingua-translated') || el.hasAttribute('data-lingua-translating')) return false;

        // Ignore scripts, styles, hidden
        if (el.offsetParent === null) return false;

        const text = el.innerText.trim();
        // Min length 20 chars to avoid menus/buttons/dates
        if (text.length < 20) return false;

        // Ignore if parent is already being processed (simplistic check to avoid nested duplication)
        // Ideally we check if a heavy ancestor is being translated
        if (el.closest('[data-lingua-translating]')) return false;

        return true;
    },

    handleIntersect: function (entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                this.translateBlock(el);
                observer.unobserve(el); // Only translate once
            }
        });
    },

    translateBlock: async function (el) {
        if (this.errorCount >= this.MAX_ERRORS) return;

        el.setAttribute('data-lingua-translating', 'true');
        const text = el.innerText.trim();

        try {
            const stored = await chrome.storage.local.get('settings');
            const targetLang = stored.settings?.targetLanguage || 'en';

            // Artificial delay to prevent burst limits if scrolling fast
            // await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

            const result = await translateText(text, targetLang);
            if (!result || !result.translation || result.translation.startsWith('[Error]')) {
                throw new Error(result.translation || "Unknown error");
            }

            this.injectTranslation(el, result.translation);
            el.setAttribute('data-lingua-translated', 'true');

        } catch (error) {
            console.error("Immersion Error:", error);
            this.errorCount++;
            if (this.errorCount >= this.MAX_ERRORS) {
                // Show toast?
                console.warn("Immersion Translation paused due to errors (Rate Limit?)");
                this.stop();
            }
        } finally {
            el.removeAttribute('data-lingua-translating');
        }
    },

    injectTranslation: function (targetEl, translationText) {
        const block = document.createElement('div');
        block.className = 'lingua-immersion-block';
        block.textContent = translationText;

        // Insert after
        if (targetEl.nextSibling) {
            targetEl.parentNode.insertBefore(block, targetEl.nextSibling);
        } else {
            targetEl.parentNode.appendChild(block);
        }
    }
};

// --- Selection Trigger Logic ---
let triggerIcon = null;

function showTriggerIcon(x, y, text) {
    if (!triggerIcon) {
        triggerIcon = document.createElement('div');
        triggerIcon.className = 'lingua-trigger-icon';
        // Icon: A stylized 'A' or Translate symbol
        triggerIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`;
        document.body.appendChild(triggerIcon);

        // Prevent hiding when clicking on the icon itself
        triggerIcon.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
    }

    triggerIcon.style.position = 'fixed';
    triggerIcon.style.left = `${x}px`;
    triggerIcon.style.top = `${y}px`;
    triggerIcon.style.display = 'flex';

    // Set up the click handler for the current selection
    triggerIcon.onclick = (e) => {
        e.stopPropagation();
        hideTriggerIcon();
        handleTranslateSelection(text);
    };
}

function hideTriggerIcon() {
    if (triggerIcon) {
        triggerIcon.style.display = 'none';
    }
}

// --- Bubble Drag Functionality ---
function makeBubbleDraggable(host) {
    const header = host.querySelector('.bubble-header');
    if (!header) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('mousedown', (e) => {
        // Don't start drag if clicking on buttons
        if (e.target.closest('button')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get current position
        const rect = host.getBoundingClientRect();
        initialLeft = rect.left + window.scrollX;
        initialTop = rect.top + window.scrollY;

        // Visual feedback
        host.classList.add('bubble-dragging');

        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Boundary checks
        const bubbleRect = host.getBoundingClientRect();
        const maxLeft = window.innerWidth - bubbleRect.width - 10;
        const maxTop = window.innerHeight + window.scrollY - bubbleRect.height - 10;

        if (newLeft < 10) newLeft = 10;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop < window.scrollY + 10) newTop = window.scrollY + 10;
        if (newTop > maxTop) newTop = maxTop;

        host.style.left = `${newLeft}px`;
        host.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            host.classList.remove('bubble-dragging');
        }
    });
}
