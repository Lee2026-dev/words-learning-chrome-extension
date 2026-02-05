// content.js - Primary Content Script

let highlightEnabled = true;
let immersionEnabled = false;
let savedWords = [];
let bubbleElement = null;

// Initialize
(async function init() {
    await loadSettings();
    if (highlightEnabled) loadWordsAndHighlight();
    if (immersionEnabled) ImmersionTranslator.start();

    // Double click listener
    document.addEventListener('dblclick', (e) => {
        // Only translate if not clicking inside an existing bubble or interactive element
        if (e.target.closest('.lingua-btn') || e.target.closest('#lingua-bubble-host')) return;

        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text && text.length > 0) {
            handleTranslateSelection(text);
        }
    });
})();

// Listen for messages from Popup or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateSelection") {
        handleTranslateSelection(request.text);
    } else if (request.action === "toggleHighlight") {
        highlightEnabled = request.enabled;
        if (highlightEnabled) {
            loadWordsAndHighlight();
        } else {
            removeHighlights();
        }
    } else if (request.action === "toggleImmersion") {
        immersionEnabled = request.enabled;
        if (immersionEnabled) {
            ImmersionTranslator.start();
        } else {
            ImmersionTranslator.stop();
        }
    }
});

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
    // 1. Fast load from local storage
    chrome.storage.local.get(['vocabulary'], (result) => {
        savedWords = result.vocabulary || [];
        if (savedWords.length > 0) {
            applyHighlights(document.body);
        }
    });

    // 2. Sync with backend to get latest words
    if (typeof syncVocabulary === 'function') {
        const freshWords = await syncVocabulary();
        if (freshWords && freshWords.length > 0) {
            savedWords = freshWords;
            // Re-apply highlights with fresh data
            applyHighlights(document.body);
        }
    }
}

function applyHighlights(rootElement) {
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                if (node.parentElement.tagName.match(/SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|NOSCRIPT/)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.parentElement.classList.contains('lingua-highlight')) {
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
        const text = node.nodeValue;

        let hasMatch = false;

        for (const wordObj of savedWords) {
            const word = wordObj.original;
            const regex = new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'gi');

            if (regex.test(text)) {
                nodesToReplace.push({ node, wordObj });
                hasMatch = true;
                break;
            }
        }
    }

    nodesToReplace.forEach(({ node, wordObj }) => {
        const span = document.createElement('span');
        span.className = 'lingua-highlight';
        span.textContent = node.nodeValue;

        const parent = node.parentNode;
        const textContent = node.nodeValue;
        const word = wordObj.original;
        const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');

        const parts = textContent.split(regex);

        if (parts.length > 1) {
            const fragment = document.createDocumentFragment();
            parts.forEach(part => {
                if (part.toLowerCase() === word.toLowerCase()) {
                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = 'lingua-highlight';
                    highlightSpan.textContent = part;
                    highlightSpan.title = `${wordObj.translation}`;
                    highlightSpan.onclick = (e) => showSavedWordBubble(e, wordObj);
                    fragment.appendChild(highlightSpan);
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            parent.replaceChild(fragment, node);
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

    const stored = await chrome.storage.local.get('settings');
    const targetLang = stored.settings?.targetLanguage || 'en';

    // Capture Context (Sentence)
    const selection = window.getSelection();
    let context = "";
    if (selection.rangeCount > 0) {
        const node = selection.anchorNode;
        context = node.parentElement ? node.parentElement.innerText.trim() : node.textContent.trim();
        // Simple truncation
        if (context.length > 200) context = context.substring(0, 200) + "...";
    }

    showBubble(selectionText, "Translating...", true, context);

    // Parallel translation of Word and Context
    // translateText now returns object { translation, phonetic }
    const [wordResult, contextResult] = await Promise.all([
        translateText(selectionText, targetLang),
        context ? translateText(context, targetLang) : Promise.resolve({ translation: "" })
    ]);

    updateBubbleContent(selectionText, wordResult.translation, context, contextResult.translation, wordResult.phonetic);
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

    const top = rect.bottom + window.scrollY + 10;
    const left = rect.left + window.scrollX;

    host.style.top = `${top}px`;
    host.style.left = `${left}px`;

    renderBubbleSetup(host, original, translation, isLoading, context, contextTranslation, phonetic);

    document.addEventListener('mousedown', closeBubbleOutside);
}

function showSavedWordBubble(e, wordObj) {
    const host = createBubbleElement();

    const top = e.pageY + 10;
    const left = e.pageX;

    host.style.top = `${top}px`;
    host.style.left = `${left}px`;

    // SVG Icons
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--success-color)"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    host.innerHTML = `
        <div class="bubble-content">
            <div class="bubble-header">
                <span class="bubble-word">${wordObj.original}</span>
                <button class="lingua-btn lingua-btn-secondary" style="padding: 4px; border-radius: 50%; width: 24px; height: 24px; min-width: unset; box-shadow: none; border: none; background: transparent; color: #94a3b8;" id="lingua-close-btn">${closeIcon}</button>
            </div>
            <div class="bubble-translation">${wordObj.translation}</div>
            <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
                ${checkIcon} Saved
            </div>
        </div>
    `;

    host.querySelector('#lingua-close-btn').onclick = closeBubble;
    document.addEventListener('mousedown', closeBubbleOutside);
}

function renderBubbleSetup(host, original, translation, isLoading, context, contextTranslation, phonetic) {
    const btnText = isLoading ? "..." : "Save";
    const btnDisabled = isLoading ? "disabled" : "";

    // SVG Icons
    const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const saveIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const volumeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

    // Context HTML
    let contextHtml = "";
    if (context && !isLoading) {
        // Show Translated Context
        // And original context in smaller/muted text
        const regex = new RegExp(`(${escapeRegExp(original)})`, 'gi');
        const highlightedOrig = context.replace(regex, '<span style="color:var(--primary-color); font-weight:700;">$1</span>');

        const translatedBlock = contextTranslation ? `<div style="margin-top:8px; color:#334155; font-weight:500;">${contextTranslation}</div>` : "";

        contextHtml = `
            <div class="bubble-context" style="margin-top:12px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:13px; line-height:1.5;">
                <div style="color:#94a3b8; font-style:italic; margin-bottom:4px;">${highlightedOrig}</div>
                ${translatedBlock}
            </div>
         `;
    }

    // Phonetic HTML
    let phoneticHtml = "";
    if (phonetic) {
        phoneticHtml = `<span style="font-size:13px; color:#64748b; margin-left:8px; font-family:monospace;">[${phonetic}]</span>`;
    }

    host.innerHTML = `
        <div class="bubble-content">
            <div class="bubble-header">
                <div>
                     <span class="bubble-word">${original}</span>
                     ${phoneticHtml}
                </div>
                <div style="display:flex; gap:4px;">
                     <button class="lingua-btn lingua-btn-secondary" style="padding: 4px; border-radius: 50%; width: 24px; height: 24px; min-width: unset; box-shadow: none; border: none; background: transparent; color: var(--primary-color);" id="lingua-speak-btn">${volumeIcon}</button>
                     <button class="lingua-btn lingua-btn-secondary" style="padding: 4px; border-radius: 50%; width: 24px; height: 24px; min-width: unset; box-shadow: none; border: none; background: transparent; color: #94a3b8;" id="lingua-close-btn">${closeIcon}</button>
                </div>
            </div>
            <div class="bubble-translation">${translation}</div>
            ${contextHtml}
            <div class="bubble-actions" style="margin-top:12px;">
                <button id="lingua-save-btn" class="lingua-btn" ${btnDisabled}>
                   ${isLoading ? '' : saveIcon} <span>${btnText}</span>
                </button>
            </div>
        </div>
    `;

    // Bind events
    if (!isLoading) {
        // Speak Button
        host.querySelector('#lingua-speak-btn').onclick = () => {
            const utterance = new SpeechSynthesisUtterance(original);
            speechSynthesis.speak(utterance);
        };

        const saveBtn = host.querySelector('#lingua-save-btn');
        saveBtn.onclick = async () => {
            saveBtn.innerHTML = `<span>Saving...</span>`;

            const finalContext = context || window.location.href;

            const success = await saveWord(original, translation, finalContext, window.location.href);
            if (success) {
                saveBtn.innerHTML = `${checkIcon} <span>Saved</span>`;
                saveBtn.style.backgroundColor = "var(--success-color)";

                // Refresh highlights
                savedWords.push({ original, translation, context: finalContext });
                applyHighlights(document.body);
            } else {
                saveBtn.innerHTML = `<span>Saved</span>`;
                saveBtn.style.backgroundColor = "var(--text-muted)";
            }
        };
    }

    host.querySelector('#lingua-close-btn').onclick = closeBubble;
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
