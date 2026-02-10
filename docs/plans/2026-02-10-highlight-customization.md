# Highlighter Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to customize the highlight style (Underline, Background, Bold) and color (Preset Palette + Custom Picker) through a dedicated "Settings View" in the Side Panel, keeping the main dashboard clean.

**Architecture:**
1.  **UI (Side Panel):** Convert `sidepanel.html` to support simple navigation (Main View <-> Settings View) by toggling visibility of containers.
2.  **Settings View:** A full-height view containing customization options for Highlight, Immersion, etc.
3.  **Navigation:**
    - Click "Gear" icon or "Highlight" card -> Switch to Settings View.
    - Click "Back" -> Switch to Main View.
4.  **State Management:** Save `highlightStyle` and `highlightColor` to `chrome.storage.local`.
5.  **content.js:** Updates highlights in real-time when settings change.

**Tech Stack:** HTML, CSS, JavaScript (Vanilla).

---

## Task Structure

### Task 1: Create Settings View Structure

**Files:**
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.html`
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.css`

**Step 1: Add View Containers**
Wrap the current content in a `#main-view` div. creating a new `#settings-view` div (hidden by default).

**HTML Structure:**
```html
<div id="main-view">
    <!-- Existing Content -->
</div>

<div id="settings-view" class="view-hidden">
    <!-- Header with Back Button -->
    <header class="sp-header">
        <button class="icon-btn" id="back-btn">
            <svg>...</svg> Back
        </button>
        <span class="view-title">Settings</span>
    </header>
    
    <div class="sp-content">
        <!-- Highlight Settings Section -->
        <section class="sp-section">
            <h3 class="section-title">Highlight Style</h3>
            <div class="setting-card-full">
                <!-- Style Toggles -->
                <div class="style-row">
                    <button data-style="underline" ...><u>Underline</u></button>
                    <button data-style="background" ...>Background</button>
                    <button data-style="bold" ...><b>Bold</b></button>
                </div>
                <!-- Color Palette -->
                <div class="color-row">
                    <!-- Dots + Picker -->
                </div>
            </div>
        </section>
        
        <!-- Other settings options can go here -->
    </div>
</div>
```

**Step 2: CSS for Views**
- `.view-hidden` { display: none; }
- Animation for sliding between views (optional but nice).
- Style the enhanced settings cards.

### Task 2: Implement Navigation & Logic

**Files:**
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.js`

**Step 1: View Switching Logic**
- `showView('main')` / `showView('settings')`.
- Bind "Gear" icon to open settings.
- Bind "Back" button to open main.
- Bind "Highlight" card click (if desired) to open settings directly to that section.

**Step 2: Settings Logic**
- Existing logic for toggles remains.
- Add logic for Style/Color selection in the new view (same as previous plan, just different DOM elements).

### Task 3: Verification

**Verification:**
1. Open Side Panel.
2. Click Gear Icon -> View slides to Settings.
3. Select "Bold" Style -> Verify on web page.
4. Select Custom Color -> Verify on web page.
5. Click Back -> Return to Dashboard.
6. Settings persist after closing/reopening.

---

## Execution Handoff

**Plan complete.** User review required.
