
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Update Word Count (Optimistic)
    chrome.storage.local.get(['vocabulary'], (result) => {
        const localWords = result.vocabulary || [];
        document.getElementById('word-count').textContent = localWords.length;

        // Background sync
        if (typeof api !== 'undefined') {
            api.getWords().then(words => {
                if (words && words.length !== localWords.length) {
                    document.getElementById('word-count').textContent = words.length;
                    // Optional: update local storage if needed, but utils.syncVocabulary does that better.
                }
            }).catch(e => console.error("Background word count fetch failed:", e));
        }
    });

    // 2. Settings Management (Optimistic)
    chrome.storage.local.get(['settings'], (data) => {
        let settings = data.settings || { highlightEnabled: true, targetLanguage: 'zh', immersionMode: false, youtubeSubtitlesEnabled: true };

        // Init UI immediately
        const highlightToggle = document.getElementById('highlight-toggle');
        const langSelect = document.getElementById('target-lang');
        const immersionToggle = document.getElementById('immersion-toggle');
        const youtubeToggle = document.getElementById('youtube-toggle');

        if (highlightToggle) highlightToggle.checked = settings.highlightEnabled !== false;
        if (langSelect) langSelect.value = settings.targetLanguage || 'zh';
        if (immersionToggle) immersionToggle.checked = settings.immersionMode === true;
        if (youtubeToggle) youtubeToggle.checked = settings.youtubeSubtitlesEnabled !== false;

        // Background sync settings
        if (typeof api !== 'undefined') {
            api.getSettings().then(remoteSettings => {
                if (remoteSettings) {
                    // Check if settings changed
                    const newSettings = { ...settings, ...remoteSettings };
                    if (JSON.stringify(newSettings) !== JSON.stringify(settings)) {
                        chrome.storage.local.set({ settings: newSettings });
                        // Update UI if changed
                        if (highlightToggle) highlightToggle.checked = newSettings.highlightEnabled !== false;
                        if (langSelect) langSelect.value = newSettings.targetLanguage || 'zh';
                        if (immersionToggle) immersionToggle.checked = newSettings.immersionMode === true;
                        if (youtubeToggle) youtubeToggle.checked = newSettings.youtubeSubtitlesEnabled !== false;
                    }
                }
            }).catch(e => console.error("Background settings sync failed:", e));
        }

        // Listeners
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                updateSetting('targetLanguage', e.target.value);
            });
        }

        if (highlightToggle) {
            highlightToggle.addEventListener('change', (e) => {
                updateSetting('highlightEnabled', e.target.checked);
                notifyTab('toggleHighlight', e.target.checked);
            });
        }

        if (immersionToggle) {
            immersionToggle.addEventListener('change', (e) => {
                updateSetting('immersionMode', e.target.checked);
                notifyTab('toggleImmersion', e.target.checked);
            });
        }

        if (youtubeToggle) {
            youtubeToggle.addEventListener('change', (e) => {
                updateSetting('youtubeSubtitlesEnabled', e.target.checked);
                notifyTab('toggleYoutubeSubtitles', e.target.checked);
            });
        }
    });

    // 4. Open Word Book
    document.getElementById('open-wordbook').addEventListener('click', () => {
        chrome.tabs.create({ url: 'wordbook.html' });
    });

    // 5. Translate Page
    document.getElementById('translate-page').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url) {
                chrome.storage.local.get(['settings'], (d) => {
                    const lang = d.settings?.targetLanguage || 'zh';
                    const url = `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(tabs[0].url)}`;
                    chrome.tabs.create({ url });
                });
            }
        });
    });
});

function updateSetting(key, value) {
    chrome.storage.local.get(['settings'], (data) => {
        const current = data.settings || {};
        const newSettings = { ...current, [key]: value };

        // Save Local
        chrome.storage.local.set({ settings: newSettings });

        // Save Remote
        if (typeof api !== 'undefined') {
            // Map camelCase to snake_case if backend expects it?
            // Backend prompt said: target_language, highlight_enabled
            // But api.js can handle it or we map here.
            // Let's assume api.js/backend is flexible or we map it.
            // Actually my api.js just passes the object.
            // The backend prompt specifically asked for snake_case keys.
            // I should probably ensure the backend handles camelCase or map it.
            // For now, I'll send as is, assuming we might fix it in backend or api.js can sanitize.
            // Actually, let's map it here to be safe.
            const payload = {
                target_language: newSettings.targetLanguage,
                highlight_enabled: newSettings.highlightEnabled,
                immersion_mode: newSettings.immersionMode
            };
            api.updateSettings(payload);
        }
    });
}

function notifyTab(action, enabled) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action, enabled });
        }
    });
}
