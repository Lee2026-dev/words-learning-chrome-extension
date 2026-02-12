// dashboard.js - Floating Dashboard Logic

(function () {
    let dashboardHost = null;
    let shadowRoot = null;
    let isOpen = false;
    let allWords = [];

    // Listen for toggle message from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleDashboard") {
            toggleDashboard();
        }
    });

    function toggleDashboard() {
        if (!dashboardHost) {
            initDashboard();
        }

        isOpen = !isOpen;
        if (dashboardHost) {
            dashboardHost.style.display = isOpen ? 'block' : 'none';
        }

        if (isOpen) {
            // Refresh stats/settings when opening
            refreshDashboardData();
        }
    }

    function initDashboard() {
        // Create Host
        dashboardHost = document.createElement('div');
        dashboardHost.id = 'lingua-dashboard-host';
        dashboardHost.style.position = 'fixed';
        dashboardHost.style.top = '0';
        dashboardHost.style.left = '0';
        dashboardHost.style.zIndex = '2147483647'; // Max Z-Index
        dashboardHost.style.display = 'none'; // Hidden by default

        // Create Shadow DOM
        shadowRoot = dashboardHost.attachShadow({ mode: 'open' });

        // Inject Styles
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('dashboard.css');
        shadowRoot.appendChild(styleLink);

        // Also inject global styles if needed (for fonts/vars)
        // Actually dashboard.css should perform best if it imports vars or defines them.
        // dashboard.css defines :root vars, but :root in shadow DOM matches the shadow host? 
        // :host matches the host. :root matches the document root?
        // In Shadow DOM, :host is better. But let's see. 
        // dashboard.css content uses :root. I should probably change :root to :host in dashboard.css?
        // Let's assume dashboard.css works for now, or I might need to tweak it to :host.
        // But let's inject styles.css too just in case.
        // const globalLink = document.createElement('link');
        // globalLink.rel = 'stylesheet';
        // globalLink.href = chrome.runtime.getURL('styles.css');
        // shadowRoot.appendChild(globalLink);

        // Inject HTML
        const container = document.createElement('div');
        container.className = 'dashboard-wrapper'; // Wrapper to hold content
        container.innerHTML = getDashboardHTML();
        shadowRoot.appendChild(container);

        document.body.appendChild(dashboardHost);

        // Bind Events
        bindDashboardEvents();

        // Listen for storage changes to auto-update stats
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.vocabulary) {
                refreshDashboardData();
            }
        });
    }

    function getDashboardHTML() {
        return `
        <div class="popup-container">
            <nav class="navbar">
                <div class="logo">
                    <span class="logo-icon">📘</span>
                    <span class="logo-text">LinguaLearn</span>
                </div>
            </nav>

            <div class="content-wrapper">
                <!-- Main Dashboard Content (Stats + Settings) -->
                <div id="main-dashboard-content">
                    <div class="stats-card">
                        <div class="stats-grid">
                            <div class="stat-item" id="stat-collected" data-type="all">
                                <span class="stat-icon">📘</span>
                                <div class="stat-text">
                                    <span class="stat-label">已收藏</span>
                                    <span class="stat-value" id="word-count">0</span>
                                </div>
                            </div>
                            <div class="stat-item" id="stat-mastered" data-type="mastered">
                                <span class="stat-icon">✅</span>
                                <div class="stat-text">
                                    <span class="stat-label">已掌握</span>
                                    <span class="stat-value" id="mastered-count">0</span>
                                </div>
                            </div>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" id="mastery-progress"></div>
                        </div>
                        <div class="progress-info" id="mastery-info">0% 掌握度</div>
                    </div>

                    <!-- Main Settings (Visible by default) -->
                    <div id="main-settings-view">
                        <div class="settings-group">
                            <!-- Target Language -->
                            <div class="setting-card">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <div class="setting-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                stroke-linejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                                <path
                                                    d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z">
                                                </path>
                                            </svg>
                                        </div>
                                        <div class="setting-text">
                                            <span class="setting-label">目标语言</span>
                                            <span class="setting-desc">翻译的目标语言</span>
                                        </div>
                                    </div>
                                    <select id="target-lang" class="lingua-select">
                                        <option value="zh">中文</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Highlighter (Nav Item) -->
                            <div class="setting-card clickable" id="open-highlight-settings">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <div class="setting-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                stroke-linejoin="round">
                                                <path d="M12 20h9"></path>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                            </svg>
                                        </div>
                                        <div class="setting-text">
                                            <span class="setting-label">高亮单词</span>
                                            <span class="setting-desc">样式、颜色、开关</span>
                                        </div>
                                    </div>
                                    <div class="setting-action">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                            stroke-linejoin="round">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <!-- Immersion Mode -->
                            <div class="setting-card">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <div class="setting-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                stroke-linejoin="round">
                                                <path
                                                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z">
                                                </path>
                                            </svg>
                                        </div>
                                        <div class="setting-text">
                                            <span class="setting-label">沉浸式阅读</span>
                                            <span class="setting-desc">自动翻译页面内容</span>
                                        </div>
                                    </div>
                                    <label class="switch">
                                        <input type="checkbox" id="immersion-toggle">
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                            </div>

                            <!-- YouTube Subtitles -->
                            <div class="setting-card">
                                <div class="setting-row">
                                    <div class="setting-info">
                                        <div class="setting-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                stroke-linejoin="round">
                                                <path
                                                    d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z">
                                                </path>
                                                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                                            </svg>
                                        </div>
                                        <div class="setting-text">
                                            <span class="setting-label">YouTube 字幕</span>
                                            <span class="setting-desc">显示双语字幕</span>
                                        </div>
                                    </div>
                                    <label class="switch">
                                        <input type="checkbox" id="youtube-toggle" checked>
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Highlight Settings View (Hidden by default) -->
                <div id="highlight-settings-view" class="list-view-container" style="display: none;">
                    <div class="list-header">
                        <button id="back-to-dashboard-from-highlight" class="back-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                        </button>
                        <span class="list-title">高亮设置</span>
                    </div>
                    
                    <div class="list-content">
                        <!-- Master Toggle -->

                        <!-- Highlight Config (Always Visible here) -->
                        <div class="setting-card">
                            <div id="highlight-settings-panel" class="highlight-sub-panel visible" style="max-height: none; opacity: 1; margin: 0; padding: 0; border: none;">
                                
                                <!-- Preview Box -->
                                <div class="preview-box" style="margin-bottom: 20px;">
                                    This is a <span id="highlight-preview-text" class="preview-highlight">highlighted</span> word in context.
                                </div>
                                
                                <!-- Style List -->
                                <div class="style-list">
                                    <!-- Highlight (Background) -->
                                    <div class="style-option" data-style="background">
                                        <div class="style-info">
                                            <span class="style-name">高亮</span>
                                            <span class="style-desc">生词以颜色高亮的形式突出显示</span>
                                        </div>
                                        <div class="radio-circle"></div>
                                    </div>

                                    <!-- Transparency (Mask) -->
                                    <div class="style-option" data-style="mask">
                                        <div class="style-info">
                                            <span class="style-name">透明度</span>
                                            <span class="style-desc">生词以透明度的形式显示，不干扰阅读</span>
                                        </div>
                                        <div class="radio-circle"></div>
                                    </div>

                                    <!-- Underline -->
                                    <div class="style-option" data-style="underline">
                                        <div class="style-info">
                                            <span class="style-name">下划线</span>
                                            <span class="style-desc">生词以带有颜色的下划线的形式显示</span>
                                        </div>
                                        <div class="radio-circle"></div>
                                    </div>

                                    <!-- Bold -->
                                    <div class="style-option" data-style="bold">
                                        <div class="style-info">
                                            <span class="style-name">粗体</span>
                                            <span class="style-desc">生词以粗体的形式显示</span>
                                        </div>
                                        <div class="radio-circle"></div>
                                    </div>
                                </div>

                                <!-- Color Config Row -->
                                <div class="style-list" id="color-config-list" style="margin-bottom: 0;">
                                    <div class="style-option color-config-option">
                                        <div class="style-info">
                                            <span class="style-name">
                                                <span class="style-icon-small">🎨</span>
                                                高亮颜色
                                            </span>
                                            <span class="style-desc">点击色块选择自定义颜色</span>
                                        </div>
                                        <label class="color-swatch-wrapper">
                                            <input type="color" id="custom-color-picker" value="#FCD34D">
                                            <div id="color-preview"></div>
                                        </label>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                <!-- Word List View (Hidden by default) -->
                <div id="word-list-view" class="list-view-container" style="display: none;">
                    <div class="list-header">
                        <button id="back-to-dashboard" class="back-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                            返回
                        </button>
                        <span id="list-title" class="list-title">单词列表</span>
                    </div>
                    <div id="word-list-content" class="list-content">
                        <!-- Words will be injected here -->
                    </div>
                </div>

            </div>
        </div>
        `;
    }

    function refreshDashboardData() {
        if (!shadowRoot) return;

        // 1. Stats
        chrome.storage.local.get(['vocabulary'], (result) => {
            const localWords = result.vocabulary || [];
            allWords = localWords; // Store for list view
            updateStatsUI(localWords);

            // Fetch from API in background if possible (api object shared context? yes!)
            if (typeof api !== 'undefined' && api.getWords) {
                api.getWords().then(words => {
                    if (words) updateStatsUI(words);
                }).catch(e => console.error(e));
            }
        });

        // 2. Settings
        chrome.storage.local.get(['settings'], (data) => {
            let settings = data.settings || { highlightEnabled: true, targetLanguage: 'zh', immersionMode: false, youtubeSubtitlesEnabled: true };
            updateSettingsUI(settings);

            // Fetch remote settings
            if (typeof api !== 'undefined' && api.getSettings) {
                api.getSettings().then(remoteSettings => {
                    if (remoteSettings) {
                        const newSettings = { ...settings, ...remoteSettings };
                        if (JSON.stringify(newSettings) !== JSON.stringify(settings)) {
                            chrome.storage.local.set({ settings: newSettings });
                            updateSettingsUI(newSettings);
                        }
                    }
                }).catch(console.error);
            }
        });
    }

    function updateStatsUI(words) {
        const total = words.length;
        const mastered = words.filter(w => w.learned).length;
        const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

        shadowRoot.querySelector('#word-count').textContent = total;
        shadowRoot.querySelector('#mastered-count').textContent = mastered;

        const progressBar = shadowRoot.querySelector('#mastery-progress');
        const progressInfo = shadowRoot.querySelector('#mastery-info');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressInfo) progressInfo.textContent = `${percentage}% 掌握度`;
    }

    function updateSettingsUI(settings) {
        // const highlightToggle = shadowRoot.querySelector('#highlight-toggle'); // Removed
        const langSelect = shadowRoot.querySelector('#target-lang');
        const immersionToggle = shadowRoot.querySelector('#immersion-toggle');
        const youtubeToggle = shadowRoot.querySelector('#youtube-toggle');

        // if (highlightToggle) highlightToggle.checked = settings.highlightEnabled !== false; // Logic handled internally mostly
        if (langSelect) langSelect.value = settings.targetLanguage || 'zh';
        if (immersionToggle) immersionToggle.checked = settings.immersionMode === true;
        if (youtubeToggle) youtubeToggle.checked = settings.youtubeSubtitlesEnabled !== false;

        // Highlighter Customization
        const styleOptions = shadowRoot.querySelectorAll('.style-option[data-style]');
        const customColorPicker = shadowRoot.querySelector('#custom-color-picker');
        const colorPreview = shadowRoot.querySelector('#color-preview');

        const highlightStyle = settings.highlightStyle || 'underline';
        const highlightColor = settings.highlightColor || '#FCD34D';

        // Active States
        styleOptions.forEach(opt => {
            if (opt.dataset.style === highlightStyle) opt.classList.add('active');
            else opt.classList.remove('active');
        });

        if (customColorPicker) {
            customColorPicker.value = highlightColor;
            if (colorPreview) colorPreview.style.backgroundColor = highlightColor;
        }

        // Update Preview Text
        updatePreviewText(highlightStyle, highlightColor);
    }

    function updatePreviewText(style, color) {
        if (!shadowRoot) return;
        const previewText = shadowRoot.querySelector('#highlight-preview-text');
        if (!previewText) return;

        // Reset basic styles
        previewText.className = 'preview-highlight'; // Ensure base class
        previewText.style = ''; // Clear inline styles

        if (style === 'background') {
            previewText.style.backgroundColor = 'transparent';
            previewText.style.color = color;
            previewText.style.textDecoration = 'none';
        } else if (style === 'mask') {
            previewText.style.backgroundColor = '#e2e8f0'; // Use standard grey for mask
            previewText.style.color = 'transparent';
            previewText.style.padding = '2px 4px';
            previewText.style.borderRadius = '4px';
        } else if (style === 'underline') {
            previewText.style.textDecoration = 'underline';
            previewText.style.textDecorationColor = color;
            previewText.style.textDecorationThickness = '2px';
            previewText.style.textUnderlineOffset = '2px';
        } else if (style === 'bold') {
            previewText.style.fontWeight = 'bold';
            previewText.style.color = color;
        }
    }

    function bindDashboardEvents() {
        // We use shadowRoot.getElementById/querySelector

        // Settings Toggles
        // const highlightToggle = shadowRoot.querySelector('#highlight-toggle'); // Removed

        const immersionToggle = shadowRoot.querySelector('#immersion-toggle');
        if (immersionToggle) {
            immersionToggle.addEventListener('change', (e) => {
                updateSetting('immersionMode', e.target.checked);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'toggleImmersion', enabled: e.target.checked }, '*');
            });
        }

        const youtubeToggle = shadowRoot.querySelector('#youtube-toggle');
        if (youtubeToggle) {
            youtubeToggle.addEventListener('change', (e) => {
                updateSetting('youtubeSubtitlesEnabled', e.target.checked);
            });
        }

        const langSelect = shadowRoot.querySelector('#target-lang');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                updateSetting('targetLanguage', e.target.value);
            });
        }

        // Highlight Styles: Options
        const styleOptions = shadowRoot.querySelectorAll('.style-option[data-style]');
        styleOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const customColorPicker = shadowRoot.querySelector('#custom-color-picker');
                const highlightColor = customColorPicker ? customColorPicker.value : '#FCD34D';
                styleOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                const newStyle = opt.dataset.style;
                updateSetting('highlightStyle', newStyle);
                updatePreviewText(newStyle, highlightColor);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'updateHighlightStyle', style: newStyle, color: highlightColor }, '*');
            });
        });

        const customColorPicker = shadowRoot.querySelector('#custom-color-picker');
        const colorPreview = shadowRoot.querySelector('#color-preview');
        if (customColorPicker) {
            customColorPicker.addEventListener('input', (e) => {
                const highlightStyle = shadowRoot.querySelector('.style-option[data-style].active')?.dataset.style || 'underline';
                const newColor = e.target.value;
                if (colorPreview) colorPreview.style.backgroundColor = newColor;

                updateSetting('highlightColor', newColor);
                updatePreviewText(highlightStyle, newColor);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'updateHighlightStyle', style: highlightStyle, color: newColor }, '*');
            });
        }

        // --- NEW: List View Interaction ---

        // Stats Click Handlers
        const statCollected = shadowRoot.querySelector('#stat-collected');
        const statMastered = shadowRoot.querySelector('#stat-mastered');
        const mainContent = shadowRoot.querySelector('#main-dashboard-content');
        const listView = shadowRoot.querySelector('#word-list-view');
        const backBtn = shadowRoot.querySelector('#back-to-dashboard');
        const listTitle = shadowRoot.querySelector('#list-title');

        // --- NEW: Highlight Settings View Interaction ---
        const openHighlightBtn = shadowRoot.querySelector('#open-highlight-settings');
        const backHighlightBtn = shadowRoot.querySelector('#back-to-dashboard-from-highlight');
        const highlightView = shadowRoot.querySelector('#highlight-settings-view');

        if (openHighlightBtn) {
            openHighlightBtn.addEventListener('click', () => {
                if (mainContent && highlightView) {
                    mainContent.style.display = 'none';
                    highlightView.style.display = 'flex';
                }
            });
        }

        if (backHighlightBtn) {
            backHighlightBtn.addEventListener('click', () => {
                if (mainContent && highlightView) {
                    highlightView.style.display = 'none';
                    mainContent.style.display = 'flex'; // Restore main dashboard
                }
            });
        }

        if (statCollected) {
            statCollected.addEventListener('click', () => {
                showListView('all');
            });
        }

        if (statMastered) {
            statMastered.addEventListener('click', () => {
                showListView('mastered');
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                listView.style.display = 'none';
                mainContent.style.display = 'block';
            });
        }

        function showListView(type) {
            if (!listView || !mainContent) return;

            // Update Title
            listTitle.textContent = type === 'all' ? '已收藏单词' : '已掌握单词';

            // Filter Words
            const filteredWords = type === 'all'
                ? allWords
                : allWords.filter(w => w.learned);

            // Render List
            renderWordList(filteredWords);

            // Toggle Views
            mainContent.style.display = 'none';
            listView.style.display = 'flex'; // Changed to flex to support column layout
        }

        function renderWordList(words) {
            const listContent = shadowRoot.querySelector('#word-list-content');
            if (!listContent) return;

            listContent.innerHTML = '';

            if (words.length === 0) {
                listContent.innerHTML = '<div class="empty-state">暂无单词</div>';
                return;
            }

            words.forEach(word => {
                // Enrich translation from meanings array
                let fullMeanings = "";
                if (word.meanings && Array.isArray(word.meanings) && word.meanings.length > 0) {
                    fullMeanings = word.meanings.map(m => {
                        const pos = m.partOfSpeech ? `<span class="word-pos">${m.partOfSpeech}</span> ` : "";
                        const defs = Array.isArray(m.definitions) ? m.definitions.join(', ') : "";
                        return `${pos}${defs}`;
                    }).join('; ');
                } else {
                    fullMeanings = word.translation || "";
                }

                const phonetic = word.phonetic ? `<span class="word-phonetic">[${word.phonetic}]</span>` : "";

                const item = document.createElement('div');
                item.className = 'word-item';
                item.innerHTML = `
                    <div class="word-info">
                        <div class="word-line">
                            <span class="word-main">${word.original}</span>
                            ${phonetic}
                            <span class="word-meanings">${fullMeanings}</span>
                        </div>
                    </div>
                    <div class="word-actions">
                        <button class="icon-btn play-audio" data-word="${word.original}">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        </button>
                    </div>
                `;

                // Audio Handler
                const playBtn = item.querySelector('.play-audio');
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const utterance = new SpeechSynthesisUtterance(word.original);
                    window.speechSynthesis.speak(utterance);
                });

                listContent.appendChild(item);
            });
        }
    }

    function updateSetting(key, value) {
        chrome.storage.local.get(['settings'], (data) => {
            const current = data.settings || {};
            const newSettings = { ...current, [key]: value };
            chrome.storage.local.set({ settings: newSettings });

            // Sync with backend
            if (typeof api !== 'undefined' && api.updateSettings) {
                const payload = {
                    target_language: newSettings.targetLanguage,
                    highlight_enabled: newSettings.highlightEnabled,
                    immersion_mode: newSettings.immersionMode,
                    youtube_subtitles_enabled: newSettings.youtubeSubtitlesEnabled
                };
                api.updateSettings(payload).catch(console.error);
            }
        });
    }

})();
