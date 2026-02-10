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

    // Links
    document.getElementById('open-wordbook')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'wordbook.html' });
    });
});

async function loadSettings() {
    const data = await chrome.storage.local.get(['settings']);
    const settings = data.settings || {};

    // Set Toggle States
    setToggleState('immersion-toggle', settings.immersionMode);
    setToggleState('youtube-toggle', settings.youtubeSubs !== false); // Default true
    setToggleState('highlight-toggle', settings.highlightEnabled !== false); // Default true
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

function notifyTabsOfChange(key, value) {
    const actionMap = {
        'highlightEnabled': 'toggleHighlight',
        'immersionMode': 'toggleImmersion',
        // YouTube handled via storage listener usually, or we can send message
    };

    const action = actionMap[key];
    if (action) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action,
                    enabled: value
                }).catch(() => { }); // Ignore error if content script not ready
            }
        });
    }
}

async function loadStats() {
    // Mock or Real Stats (Read from storage)
    const data = await chrome.storage.local.get(['vocabulary']);
    const words = data.vocabulary || [];

    const total = words.length;
    const mastered = words.filter(w => w.learned).length;

    // Update UI numbers if elements exist (using classes from HTML)
    document.querySelectorAll('.stat-num').forEach((el, index) => {
        // Simple heuristic: 0 is Saved, 1 is Mastered
        if (index === 0) el.textContent = total;
        if (index === 1) el.textContent = mastered;
    });

    const percentage = total === 0 ? 0 : Math.round((mastered / total) * 100);
    const bar = document.querySelector('.mastery-bar');
    if (bar) bar.style.width = `${percentage}%`;
}
