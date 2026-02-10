// sidepanel.js - Logic for the Side Panel UI

document.addEventListener('DOMContentLoaded', async () => {
    console.log("LinguaLearn SidePanel Loaded");

    // Load Settings
    await loadSettings();
    await loadStats();

    // Event Listeners for Toggles
    setupToggle('immersion-toggle', 'immersionMode');
    setupToggle('youtube-toggle', 'youtubeSubs');
    setupToggle('highlight-toggle', 'highlightEnabled');

    // View Navigation
    document.getElementById('settings-btn')?.addEventListener('click', () => switchView('settings'));
    document.getElementById('back-btn')?.addEventListener('click', () => switchView('main'));

    // Word List Navigation
    document.getElementById('stat-saved-btn')?.addEventListener('click', () => {
        switchView('word-list');
        renderWordList();
    });
    document.getElementById('word-list-back-btn')?.addEventListener('click', () => switchView('main'));

    // Search
    document.getElementById('word-search')?.addEventListener('input', (e) => {
        renderWordList(e.target.value);
    });

    // Highlight Customization
    setupHighlightControls();
});

function switchView(viewName) {
    const views = {
        'main': document.getElementById('main-view'),
        'settings': document.getElementById('settings-view'),
        'word-list': document.getElementById('word-list-view')
    };

    // Hide all
    Object.values(views).forEach(el => {
        if (el) el.classList.add('view-hidden');
    });

    // Show target
    const target = views[viewName];
    if (target) target.classList.remove('view-hidden');
}

async function loadSettings() {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};

    // Set Toggle States
    setToggleState('immersion-toggle', settings.immersionMode);
    setToggleState('youtube-toggle', settings.youtubeSubs !== false); // Default true
    setToggleState('highlight-toggle', settings.highlightEnabled !== false); // Default true

    // Set Highlight Settings
    updateHighlightUI(settings.highlightStyle || 'underline', settings.highlightColor || '#FCD34D');
}

function setToggleState(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
}

function setupToggle(id, settingKey) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', async (e) => {
        const newValue = e.target.checked;
        const data = await chrome.storage.local.get(['settings']);
        const settings = data.settings || {};

        settings[settingKey] = newValue;

        await chrome.storage.local.set({ settings });

        // Notify Tabs
        notifyTabsOfChange(settingKey, newValue);
    });
}

function setupHighlightControls() {
    // Style Buttons
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const style = btn.dataset.style;
            await updateHighlightSetting('highlightStyle', style);
        });
    });

    // Color Dots
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', async () => {
            const color = dot.dataset.color;
            await updateHighlightSetting('highlightColor', color);
            // Update picker value to match
            document.getElementById('custom-color-picker').value = color;
        });
    });

    // Color Picker
    const picker = document.getElementById('custom-color-picker');
    if (picker) {
        picker.addEventListener('input', async (e) => {
            const color = e.target.value;
            await updateHighlightSetting('highlightColor', color);
        });
    }
}

async function updateHighlightSetting(key, value) {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};
    settings[key] = value;
    await chrome.storage.local.set({ settings });

    // Update UI immediately
    updateHighlightUI(settings.highlightStyle || 'underline', settings.highlightColor || '#FCD34D');

    // Notify Tabs
    notifyTabsOfHighlightChange(settings.highlightStyle, settings.highlightColor);
}

function updateHighlightUI(style, color) {
    // Update Style Buttons
    document.querySelectorAll('.style-btn').forEach(btn => {
        if (btn.dataset.style === style) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Color Dots
    let matched = false;
    document.querySelectorAll('.color-dot').forEach(dot => {
        if (dot.dataset.color.toLowerCase() === color.toLowerCase()) {
            dot.classList.add('active');
            matched = true;
        } else {
            dot.classList.remove('active');
        }
    });

    // Update Picker if not matched (custom color)
    const picker = document.getElementById('custom-color-picker');
    if (picker) {
        picker.value = color;
    }

    // Update Preview
    const preview = document.getElementById('preview-highlight');
    if (preview) {
        // Reset
        preview.style.textDecoration = '';
        preview.style.backgroundColor = '';
        preview.style.fontWeight = '';
        preview.style.color = '';
        preview.style.padding = '';
        preview.style.borderRadius = '';

        if (style === 'underline') {
            preview.style.textDecoration = 'underline';
            preview.style.textDecorationColor = color;
            preview.style.textDecorationThickness = '2px';
            preview.style.textUnderlineOffset = '2px';
        } else if (style === 'background') {
            preview.style.backgroundColor = color;
            preview.style.padding = '2px 4px';
            preview.style.borderRadius = '3px';
        } else if (style === 'bold') {
            preview.style.fontWeight = '700';
            preview.style.color = color;
        }
    }
}

function notifyTabsOfChange(key, value) {
    const actionMap = {
        'highlightEnabled': 'toggleHighlight',
        'immersionMode': 'toggleImmersion',
    };

    const action = actionMap[key];
    if (action) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action,
                    enabled: value
                }).catch(() => { });
            }
        });
    }
}

function notifyTabsOfHighlightChange(style, color) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateHighlightStyle',
                style: style || 'underline',
                color: color || '#FCD34D'
            }).catch(() => { });
        }
    });
}

function loadStats() {
    chrome.storage.local.get(['vocabulary'], (data) => {
        const words = data.vocabulary || [];
        const total = words.length;
        const mastered = words.filter(w => w.learned).length;

        document.querySelectorAll('.stat-num').forEach((el, index) => {
            if (index === 0) el.textContent = total;
            if (index === 1) el.textContent = mastered;
        });

        const percentage = total === 0 ? 0 : Math.round((mastered / total) * 100);
        const bar = document.querySelector('.mastery-bar');
        if (bar) bar.style.width = `${percentage}%`;
    });
}

// --- Word List Logic ---

async function renderWordList(filterText = '') {
    const container = document.getElementById('word-list-container');
    if (!container) return;

    container.innerHTML = '<div class="words-loading" style="text-align:center;padding:20px;color:var(--sp-text-muted);">Loading...</div>';

    const data = await chrome.storage.local.get(['vocabulary']);
    let words = data.vocabulary || [];

    // Filter
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        words = words.filter(w =>
            (w.original && w.original.toLowerCase().includes(lowerFilter)) ||
            (w.translation && w.translation.toLowerCase().includes(lowerFilter))
        );
    }

    // Sort by date (newest first)
    words.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    container.innerHTML = '';

    if (words.length === 0) {
        container.innerHTML = `
            <div class="words-empty-state">
                <div class="empty-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div class="empty-text">${filterText ? 'No matching words' : 'No words saved yet'}</div>
                <div class="empty-sub">${filterText ? 'Try a different search term' : 'Start reading to save new words'}</div>
            </div>
        `;
        return;
    }

    words.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';

        // Format date
        const date = word.timestamp ? new Date(word.timestamp * 1000).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
        }) : '';

        // Phonetic display
        const phoneticHtml = word.phonetic ? `<span class="wc-phonetic">/${escapeHtml(word.phonetic)}/</span>` : '';

        // Learned badge
        const learnedBadge = word.learned ? '<span class="wc-badge wc-badge-learned">✓ 已掌握</span>' : '';

        card.innerHTML = `
            <div class="wc-content">
                <div class="wc-header">
                    <div class="wc-title-row">
                        <span class="wc-original">${escapeHtml(word.original || word.text || '')}</span>
                        ${learnedBadge}
                    </div>
                    ${phoneticHtml}
                </div>
                <div class="wc-translation">${escapeHtml(word.translation || 'No translation')}</div>
                ${word.context ? `<div class="wc-context">"${escapeHtml(word.context)}"</div>` : ''}
                ${date ? `<div class="wc-date">${date}</div>` : ''}
            </div>
            <div class="wc-actions">
                <button class="wc-action-btn delete" title="删除" data-text="${escapeHtml(word.original || word.text)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        // Add delete handler
        const deleteBtn = card.querySelector('.delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteWord(word.original || word.text);
        });

        container.appendChild(card);
    });
}

async function deleteWord(text) {
    if (!confirm(`确定删除 "${text}"?`)) return;

    const data = await chrome.storage.local.get(['vocabulary']);
    let words = data.vocabulary || [];

    const initialLength = words.length;
    // Support both 'original' and 'text' fields for compatibility
    words = words.filter(w => (w.original || w.text) !== text);

    if (words.length < initialLength) {
        await chrome.storage.local.set({ vocabulary: words });
        renderWordList(document.getElementById('word-search').value);
        loadStats();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
