
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
        if (progressInfo) progressInfo.textContent = `${percentage}% Proficiency`;
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
        const highlightPanel = document.getElementById('highlight-settings-panel');
        const styleBtns = document.querySelectorAll('.style-btn');
        const colorSwatches = document.querySelectorAll('.color-swatch');
        const customColorPicker = document.getElementById('custom-color-picker');
        const previewText = document.getElementById('preview-text');

        // Initialize highlighter settings
        const highlightStyle = settings.highlightStyle || 'underline';
        const highlightColor = settings.highlightColor || '#FCD34D';

        // Set initial panel visibility
        if (highlightToggle && highlightToggle.checked) {
            highlightPanel.classList.add('visible');
        }

        // Toggle panel visibility when highlight toggle changes
        if (highlightToggle) {
            highlightToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    highlightPanel.classList.add('visible');
                } else {
                    highlightPanel.classList.remove('visible');
                }
            });
        }

        // Set initial active style button
        styleBtns.forEach(btn => {
            if (btn.dataset.style === highlightStyle) {
                btn.classList.add('active');
            }
        });

        // Set initial active color swatch
        colorSwatches.forEach(swatch => {
            if (swatch.dataset.color === highlightColor) {
                swatch.classList.add('active');
            }
        });

        // Set custom color picker value
        if (customColorPicker) {
            customColorPicker.value = highlightColor;
        }

        // Update preview
        updatePreview(highlightStyle, highlightColor);

        // Style button click handlers
        styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                styleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const newStyle = btn.dataset.style;
                updateSetting('highlightStyle', newStyle);
                updatePreview(newStyle, highlightColor);
                notifyTab('updateHighlightStyle', { style: newStyle, color: highlightColor });
            });
        });

        // Color swatch click handlers
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                colorSwatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');

                const newColor = swatch.dataset.color;
                updateSetting('highlightColor', newColor);
                if (customColorPicker) customColorPicker.value = newColor;
                updatePreview(highlightStyle, newColor);
                notifyTab('updateHighlightStyle', { style: highlightStyle, color: newColor });
            });
        });

        // Custom color picker handler
        if (customColorPicker) {
            customColorPicker.addEventListener('input', (e) => {
                const newColor = e.target.value;
                colorSwatches.forEach(s => s.classList.remove('active'));
                updateSetting('highlightColor', newColor);
                updatePreview(highlightStyle, newColor);
                notifyTab('updateHighlightStyle', { style: highlightStyle, color: newColor });
            });
        }

        // Preview update function
        function updatePreview(style, color) {
            if (!previewText) return;

            // Remove all style classes
            previewText.className = 'preview-highlight';

            // Add current style class
            previewText.classList.add(`style-${style}`);

            // Apply color
            if (style === 'underline') {
                previewText.style.textDecorationColor = color;
                previewText.style.backgroundColor = '';
                previewText.style.color = '';
            } else if (style === 'background') {
                previewText.style.backgroundColor = color;
                previewText.style.textDecorationColor = '';
                previewText.style.color = '';
            } else if (style === 'bold') {
                previewText.style.color = color;
                previewText.style.backgroundColor = '';
                previewText.style.textDecorationColor = '';
            }
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
