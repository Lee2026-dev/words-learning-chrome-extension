document.addEventListener('DOMContentLoaded', () => {
    // 1. Update Word Count
    chrome.storage.local.get(['vocabulary', 'settings'], (data) => {
        const vocab = data.vocabulary || [];
        document.getElementById('word-count').textContent = vocab.length;

        // 2. Set Highlight Toggle State & Target Language
        const settings = data.settings || { highlightEnabled: true, targetLanguage: 'zh' };
        document.getElementById('highlight-toggle').checked = settings.highlightEnabled;

        const langSelect = document.getElementById('target-lang');
        if (langSelect) {
            langSelect.value = settings.targetLanguage || 'zh';

            // Listen for language changes
            langSelect.addEventListener('change', (e) => {
                const newLang = e.target.value;
                chrome.storage.local.get(['settings'], (currentData) => {
                    const currentSettings = currentData.settings || {};
                    const newSettings = { ...currentSettings, targetLanguage: newLang };
                    chrome.storage.local.set({ settings: newSettings });
                });
            });
        }
    });

    // 3. Handle Highlight Toggle Change
    document.getElementById('highlight-toggle').addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.get(['settings'], (data) => {
            const currentSettings = data.settings || {};
            const newSettings = { ...currentSettings, highlightEnabled: isEnabled };

            chrome.storage.local.set({ settings: newSettings }, () => {
                // Optional: Notify active tab to toggle highlighting immediately
                // For simplicity, it might just take effect on reload, but let's try to be fancy
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "toggleHighlight",
                            enabled: isEnabled
                        });
                    }
                });
            });
        });
    });

    // 4. Open Word Book
    document.getElementById('open-wordbook').addEventListener('click', () => {
        chrome.tabs.create({ url: 'wordbook.html' });
    });

    // 5. Translate Full Page (Google Translate Redirection)
    document.getElementById('translate-page').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url) {
                const targetLang = 'zh'; // Ideally get from settings
                chrome.storage.local.get(['settings'], (data) => {
                    const lang = data.settings?.targetLanguage || 'zh';
                    const translateUrl = `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(currentTab.url)}`;
                    chrome.tabs.create({ url: translateUrl });
                });
            }
        });
    });
});
