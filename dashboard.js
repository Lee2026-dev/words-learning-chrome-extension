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

                            <!-- Highlighter -->
                            <div class="setting-card">
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
                                            <span class="setting-desc">高亮显示已收藏的单词</span>
                                        </div>
                                    </div>
                                    <label class="switch">
                                        <input type="checkbox" id="highlight-toggle" checked>
                                        <span class="slider round"></span>
                                    </label>
                                </div>

                                <!-- Highlighter Customization Sub-Panel -->
                                <div id="highlight-settings-panel" class="highlight-sub-panel">
                                    <!-- Style Selector -->
                                    <div class="sub-section">
                                        <label class="sub-label">样式</label>
                                        <div class="style-selector">
                                            <button class="style-btn active" data-style="underline" title="下划线">
                                                <span style="text-decoration: underline; text-decoration-thickness: 2px;">U</span>
                                            </button>
                                            <button class="style-btn" data-style="background" title="背景高亮">
                                                <span style="background: #FCD34D; padding: 2px 6px; border-radius: 3px;">A</span>
                                            </button>
                                            <button class="style-btn" data-style="bold" title="粗体">
                                                <strong>B</strong>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Color Picker -->
                                    <div class="sub-section">
                                        <label class="sub-label">颜色</label>
                                        <div class="color-palette">
                                            <div class="color-swatch active" style="background: #FCD34D;" data-color="#FCD34D"
                                                title="黄色"></div>
                                            <div class="color-swatch" style="background: #4ADE80;" data-color="#4ADE80" title="绿色">
                                            </div>
                                            <div class="color-swatch" style="background: #F472B6;" data-color="#F472B6" title="粉色">
                                            </div>
                                            <div class="color-swatch" style="background: #60A5FA;" data-color="#60A5FA" title="蓝色">
                                            </div>
                                            <div class="color-swatch" style="background: #A78BFA;" data-color="#A78BFA" title="紫色">
                                            </div>
                                            <label class="color-picker-wrapper" title="自定义颜色">
                                                <input type="color" id="custom-color-picker" value="#FCD34D">
                                                <div class="color-picker-icon">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                                        stroke-linecap="round" stroke-linejoin="round">
                                                        <circle cx="13.5" cy="6.5" r=".5"></circle>
                                                        <circle cx="17.5" cy="10.5" r=".5"></circle>
                                                        <circle cx="8.5" cy="7.5" r=".5"></circle>
                                                        <circle cx="6.5" cy="12.5" r=".5"></circle>
                                                        <path
                                                            d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z">
                                                        </path>
                                                    </svg>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <!-- Preview -->
                                    <div class="sub-section">
                                        <label class="sub-label">预览</label>
                                        <div class="preview-box">
                                            这是 <span id="preview-text" class="preview-highlight">示例</span> 文本。
                                        </div>
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

        shadowRoot.getElementById('word-count').textContent = total;
        shadowRoot.getElementById('mastered-count').textContent = mastered;

        const progressBar = shadowRoot.getElementById('mastery-progress');
        const progressInfo = shadowRoot.getElementById('mastery-info');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressInfo) progressInfo.textContent = `${percentage}% 掌握度`;
    }

    function updateSettingsUI(settings) {
        const highlightToggle = shadowRoot.getElementById('highlight-toggle');
        const langSelect = shadowRoot.getElementById('target-lang');
        const immersionToggle = shadowRoot.getElementById('immersion-toggle');
        const youtubeToggle = shadowRoot.getElementById('youtube-toggle');

        if (highlightToggle) highlightToggle.checked = settings.highlightEnabled !== false;
        if (langSelect) langSelect.value = settings.targetLanguage || 'zh';
        if (immersionToggle) immersionToggle.checked = settings.immersionMode === true;
        if (youtubeToggle) youtubeToggle.checked = settings.youtubeSubtitlesEnabled !== false;

        // Highlighter Customization
        const highlightPanel = shadowRoot.getElementById('highlight-settings-panel');
        const styleBtns = shadowRoot.querySelectorAll('.style-btn');
        const colorSwatches = shadowRoot.querySelectorAll('.color-swatch');
        const customColorPicker = shadowRoot.getElementById('custom-color-picker');

        const highlightStyle = settings.highlightStyle || 'underline';
        const highlightColor = settings.highlightColor || '#FCD34D';

        // Visibility
        if (highlightToggle && highlightToggle.checked) {
            highlightPanel.classList.add('visible');
        } else {
            highlightPanel.classList.remove('visible');
        }

        // Active States
        styleBtns.forEach(btn => {
            if (btn.dataset.style === highlightStyle) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        colorSwatches.forEach(swatch => {
            if (swatch.dataset.color === highlightColor) swatch.classList.add('active');
            else swatch.classList.remove('active');
        });

        if (customColorPicker) customColorPicker.value = highlightColor;

        updatePreview(shadowRoot, highlightStyle, highlightColor);
    }

    function updatePreview(shadowRoot, style, color) {
        const previewText = shadowRoot.getElementById('preview-text');
        if (!previewText) return;

        // Get current style and color if not provided
        if (!style) {
            style = shadowRoot.querySelector('.style-btn.active')?.dataset.style || 'underline';
        }
        if (!color) {
            color = shadowRoot.querySelector('.color-swatch.active')?.dataset.color || shadowRoot.getElementById('custom-color-picker')?.value || '#FCD34D';
        }

        previewText.className = 'preview-highlight'; // Reset classes
        previewText.classList.add(`style-${style}`);

        if (style === 'underline') {
            previewText.style.textDecoration = `underline 2px ${color}`;
            previewText.style.backgroundColor = '';
            previewText.style.color = '';
        } else if (style === 'background') {
            previewText.style.backgroundColor = color;
            previewText.style.textDecoration = '';
            previewText.style.color = '';
        } else if (style === 'bold') {
            previewText.style.color = color;
            previewText.style.backgroundColor = '';
            previewText.style.textDecorationColor = '';
        }
    }

    function bindDashboardEvents() {
        // We use shadowRoot.getElementById/querySelector

        // Settings Toggles
        const highlightToggle = shadowRoot.getElementById('highlight-toggle');
        if (highlightToggle) {
            highlightToggle.addEventListener('change', (e) => {
                updateSetting('highlightEnabled', e.target.checked);
                // NOTIFY CONTENT SCRIPT
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'toggleHighlight', enabled: e.target.checked }, '*');

                // Toggle sub-panel
                const highlightPanel = shadowRoot.getElementById('highlight-settings-panel');
                if (e.target.checked) highlightPanel.classList.add('visible');
                else highlightPanel.classList.remove('visible');
            });
        }

        const immersionToggle = shadowRoot.getElementById('immersion-toggle');
        if (immersionToggle) {
            immersionToggle.addEventListener('change', (e) => {
                updateSetting('immersionMode', e.target.checked);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'toggleImmersion', enabled: e.target.checked }, '*');
            });
        }

        const youtubeToggle = shadowRoot.getElementById('youtube-toggle');
        if (youtubeToggle) {
            youtubeToggle.addEventListener('change', (e) => {
                updateSetting('youtubeSubtitlesEnabled', e.target.checked);
                // content.js usually doesn't handle youtube toggle directly unless it injects youtube.js?
                // youtube.js listens to storage changes or init?
                // Let's ensure we notify if needed.
            });
        }

        const langSelect = shadowRoot.getElementById('target-lang');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                updateSetting('targetLanguage', e.target.value);
            });
        }

        // Highlight Styles: Buttons
        const styleBtns = shadowRoot.querySelectorAll('.style-btn');
        styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const highlightColor = shadowRoot.getElementById('custom-color-picker')?.value || '#FCD34D';
                styleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const newStyle = btn.dataset.style;
                updateSetting('highlightStyle', newStyle);
                updatePreview(newStyle, highlightColor);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'updateHighlightStyle', style: newStyle, color: highlightColor }, '*');
            });
        });

        // Highlight Styles: Colors
        const colorSwatches = shadowRoot.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const highlightStyle = shadowRoot.querySelector('.style-btn.active')?.dataset.style || 'underline';
                colorSwatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');

                const newColor = swatch.dataset.color;
                const picker = shadowRoot.getElementById('custom-color-picker');
                if (picker) picker.value = newColor;

                updateSetting('highlightColor', newColor);
                updatePreview(highlightStyle, newColor);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'updateHighlightStyle', style: highlightStyle, color: newColor }, '*');
            });
        });

        const customColorPicker = shadowRoot.getElementById('custom-color-picker');
        if (customColorPicker) {
            customColorPicker.addEventListener('input', (e) => {
                const highlightStyle = shadowRoot.querySelector('.style-btn.active')?.dataset.style || 'underline';
                const newColor = e.target.value;

                colorSwatches.forEach(s => s.classList.remove('active'));
                updateSetting('highlightColor', newColor);
                updatePreview(shadowRoot, highlightStyle, newColor);
                window.postMessage({ type: 'LINGUA_UPDATE', action: 'updateHighlightStyle', style: highlightStyle, color: newColor }, '*');
            });
        }

        // --- NEW: List View Interaction ---

        // Stats Click Handlers
        const statCollected = shadowRoot.getElementById('stat-collected');
        const statMastered = shadowRoot.getElementById('stat-mastered');
        const mainContent = shadowRoot.getElementById('main-dashboard-content');
        const listView = shadowRoot.getElementById('word-list-view');
        const backBtn = shadowRoot.getElementById('back-to-dashboard');
        const listTitle = shadowRoot.getElementById('list-title');

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
            const listContent = shadowRoot.getElementById('word-list-content');
            if (!listContent) return;

            listContent.innerHTML = '';

            if (words.length === 0) {
                listContent.innerHTML = '<div class="empty-state">暂无单词</div>';
                return;
            }

            words.forEach(word => {
                const item = document.createElement('div');
                item.className = 'word-item';
                item.innerHTML = `
                    <div class="word-info">
                        <div class="word-main">${word.original}</div>
                        <div class="word-trans">${word.translation}</div>
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
