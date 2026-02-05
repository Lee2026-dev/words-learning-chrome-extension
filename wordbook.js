// wordbook.js

document.addEventListener('DOMContentLoaded', () => {
    loadWords();
    setupTabs();
});

// SVG Icons
const icons = {
    volume: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    empty: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
};

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const lists = document.querySelectorAll('.list-view');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            tabs.forEach(t => t.classList.remove('active'));
            lists.forEach(l => l.classList.remove('active'));

            // Activate current
            tab.classList.add('active');
            const targetId = tab.dataset.tab === 'words' ? 'word-list' : 'sentence-list';
            document.getElementById(targetId).classList.add('active');
        });
    });
}

async function loadWords() {
    if (typeof api !== 'undefined') {
        const vocab = await api.getWords();
        // Sort by newest first (API might already sort, but safe to do client side too)
        // Backend returns 'timestamp' as float seconds or string?
        // Usually JSON returns number/string.
        vocab.sort((a, b) => b.timestamp - a.timestamp);

        renderWords(vocab);
        renderSentences(vocab);
    } else {
        // Fallback or Error
        console.error("API not loaded");
    }
}

function renderWords(vocab) {
    const container = document.getElementById('word-list');
    const stats = document.getElementById('stats-summary');

    container.innerHTML = '';
    stats.textContent = `${vocab.length} Words & Sentences`;

    if (vocab.length === 0) {
        renderEmpty(container);
        return;
    }

    vocab.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';

        // Handle timestamp conversion (seconds vs ms)
        const ts = word.timestamp > 10000000000 ? word.timestamp : word.timestamp * 1000;

        card.innerHTML = `
            <div class="word-header">
                <div class="word-original">${word.original}</div>
                <div style="font-size: 12px; color: #94A3B8;">${new Date(ts).toLocaleDateString()}</div>
            </div>
            <div class="word-translation">${word.translation}</div>
            
            <div class="word-meta">
                <button class="icon-btn" title="Speak" onclick="speakText('${escapeQuotes(word.original)}')">${icons.volume}</button>
                <button class="icon-btn" title="Copy" onclick="copyText('${escapeQuotes(word.original)}')">${icons.copy}</button>
                <button class="icon-btn delete" title="Delete" onclick="deleteWord('${word.id}')">${icons.trash}</button>
            </div>
        `;

        const speakBtn = card.querySelector('button[title="Speak"]');
        const copyBtn = card.querySelector('button[title="Copy"]');
        const deleteBtn = card.querySelector('button[title="Delete"]');

        speakBtn.onclick = () => speakText(word.original);
        copyBtn.onclick = () => copyText(word.original);
        deleteBtn.onclick = () => deleteWord(word.id);

        container.appendChild(card);
    });
}

function renderSentences(vocab) {
    const container = document.getElementById('sentence-list');
    container.innerHTML = '';

    if (vocab.length === 0) {
        renderEmpty(container);
        return;
    }

    // Filter out items without context or where context is just URL
    const validSentences = vocab.filter(w => w.context && w.context.length > 5 && !w.context.startsWith('http'));

    if (validSentences.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icons.empty}</div>
                <h2>No sentences yet</h2>
                <p>Save words from articles to see them here.</p>
            </div>
        `;
        return;
    }

    validSentences.forEach(word => {
        const card = document.createElement('div');
        card.className = 'sentence-card';

        const highlightedContext = highlightWordInContext(word.context, word.original);

        card.innerHTML = `
             <div class="sentence-ctx">${highlightedContext}</div>
             <div class="sentence-source">
                <span>Ref: <strong>${word.original}</strong> (${word.translation})</span>
                <span title="${word.url}">${word.url ? new URL(word.url).hostname : 'unknown'}</span>
             </div>
        `;
        container.appendChild(card);
    });
}

function renderEmpty(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icons.empty}</div>
            <h2>No items yet</h2>
            <p>Go to any website, select a word, and save it!</p>
        </div>
    `;
}

function highlightWordInContext(context, word) {
    if (!context || !word) return context;
    // Highlight all occurrences case-insensitive
    const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
    return context.replace(regex, '<span class="sentence-highlight">$1</span>');
}

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showFlash("Copied to clipboard!");
    });
}

async function deleteWord(id) {
    if (confirm('Delete this word (and sentence)?')) {
        if (typeof api !== 'undefined') {
            const success = await api.deleteWord(id);
            if (success) {
                loadWords(); // Re-fetch list
            } else {
                alert("Failed to delete word");
            }
        }
    }
}

function showFlash(message) {
    const toast = document.getElementById('flash-toast');
    toast.textContent = message;
    toast.classList.add('flash-visible');
    setTimeout(() => {
        toast.classList.remove('flash-visible');
    }, 2000);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}
