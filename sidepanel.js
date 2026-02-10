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

    // Highlight Customization
    setupHighlightControls();

    // Links
    document.getElementById('open-wordbook')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'wordbook.html' });
    });
});

function switchView(viewName) {
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');

    if (viewName === 'settings') {
        mainView.classList.add('view-hidden');
        settingsView.classList.remove('view-hidden');
    } else {
        settingsView.classList.add('view-hidden');
        mainView.classList.remove('view-hidden');
    }
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
        picker.value = color; // Always update picker visual
        if (!matched) {
            // Visualize custom selection on the picker icon?
            // The icon itself is hard to style dynamically without inline SVG manipulation,
            // but the input value change is enough.
        }
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
