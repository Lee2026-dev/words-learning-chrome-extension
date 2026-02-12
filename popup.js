
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Update Word Counts (Optimistic)
    chrome.storage.local.get(['vocabulary'], (result) => {
        const localWords = result.vocabulary || [];
        updateStatsUI(localWords);

        // Background sync
        if (typeof api !== 'undefined') {
            api.getWords().then(words => {
                if (words) {
                    updateStatsUI(words);
                }
            }).catch(e => console.error("Background word count fetch failed:", e));
        }
    });

    function updateStatsUI(words) {
        const total = words.length;
        const mastered = words.filter(w => w.learned).length;
        const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

        document.getElementById('word-count').textContent = total;
        document.getElementById('mastered-count').textContent = mastered;

        const progressBar = document.getElementById('mastery-progress');
        const progressInfo = document.getElementById('mastery-info');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressInfo) progressInfo.textContent = `${percentage}% 掌握度`;
    }

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

        // Highlighter Customization Panel
        const styleOptions = document.querySelectorAll('.style-option[data-style]');
        const customColorPicker = document.getElementById('custom-color-picker');
        const colorPreview = document.getElementById('color-preview');

        // Initialize highlighter settings
        const highlightStyle = settings.highlightStyle || 'underline';
        const highlightColor = settings.highlightColor || '#FCD34D';

        // View Navigation
        const mainView = document.getElementById('main-view');
        const highlightView = document.getElementById('highlight-settings-view');
        const openHighlightBtn = document.getElementById('open-highlight-settings');
        const backBtn = document.getElementById('back-to-main');

        if (openHighlightBtn) {
            openHighlightBtn.addEventListener('click', () => {
                if (mainView && highlightView) {
                    mainView.classList.remove('active');
                    highlightView.classList.add('active');
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (mainView && highlightView) {
                    highlightView.classList.remove('active');
                    mainView.classList.add('active');
                }
            });
        }

        // Set initial active style option
        styleOptions.forEach(opt => {
            if (opt.dataset.style === highlightStyle) {
                opt.classList.add('active');
            }
        });

        // Set custom color picker value and preview
        if (customColorPicker) {
            customColorPicker.value = highlightColor;
            if (colorPreview) colorPreview.style.backgroundColor = highlightColor;
        }

        // Init Preview
        updatePreviewText(highlightStyle, highlightColor);

        // Helper: Update Preview Text
        function updatePreviewText(style, color) {
            const previewText = document.getElementById('highlight-preview-text');
            if (!previewText) return;

            // Reset basic styles
            previewText.className = 'preview-highlight';
            previewText.style = ''; // Clear inline

            if (style === 'background') {
                previewText.style.backgroundColor = 'transparent';
                previewText.style.color = color;
                previewText.style.textDecoration = 'none';
            } else if (style === 'mask') {
                previewText.style.backgroundColor = '#e2e8f0'; // Standard mask grey
                previewText.style.color = 'transparent';
                previewText.style.padding = '2px 4px';
                previewText.style.borderRadius = '4px';
                previewText.style.textDecoration = 'none';
            } else if (style === 'underline') {
                previewText.style.textDecoration = 'underline';
                previewText.style.textDecorationColor = color;
                previewText.style.textDecorationThickness = '2px';
                previewText.style.textUnderlineOffset = '2px';
            } else if (style === 'bold') {
                previewText.style.fontWeight = 'bold';
                previewText.style.color = color;
                previewText.style.textDecoration = 'none';
            }
        }

        // Style option click handlers
        styleOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                styleOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                const newStyle = opt.dataset.style;
                updateSetting('highlightStyle', newStyle);

                // Use current literal color
                const currentColor = customColorPicker ? customColorPicker.value : highlightColor;

                updatePreviewText(newStyle, currentColor);
                notifyTab('updateHighlightStyle', { style: newStyle, color: currentColor });
            });
        });

        // Custom color picker handler (Single row)
        if (customColorPicker) {
            customColorPicker.addEventListener('input', (e) => {
                const newColor = e.target.value;
                if (colorPreview) colorPreview.style.backgroundColor = newColor;

                const currentStyle = document.querySelector('.style-option[data-style].active')?.dataset.style || 'underline';

                updateSetting('highlightColor', newColor);
                updatePreviewText(currentStyle, newColor);
                notifyTab('updateHighlightStyle', { style: currentStyle, color: newColor });
            });
        }
    });

    // 4. Open Word Book
    document.getElementById('open-wordbook').addEventListener('click', () => {
        chrome.tabs.create({ url: 'wordbook.html' });
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
                immersion_mode: newSettings.immersionMode,
                youtube_subtitles_enabled: newSettings.youtubeSubtitlesEnabled
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
