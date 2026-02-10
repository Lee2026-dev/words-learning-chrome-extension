# Side Panel Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the Main Dashboard UI from the ephemeral popup to a persistent Chrome Side Panel, adopting a "Trancy-like" professional aesthetic (right-side sidebar).

**Architecture:** Use the Chrome `sidePanel` API (Manifest V3) to host the dashboard. This allows the UI to remain open while the user browses, facilitating "Immersion Mode" and real-time interaction without closing the menu.

**Tech Stack:** HTML, CSS (Vanilla), JavaScript (Vanilla), Chrome Extension API (Manifest V3).

---

## Task Structure

### Task 1: Manifest & Background Configuration

**Files:**
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/manifest.json`
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/background.js`

**Step 1: Update Manifest for Side Panel**
Add `sidePanel` permission and define the side panel configuration.

```json
// In manifest.json
"permissions": [
    "sidePanel", // Add this
    // ... existing permissions
],
"side_panel": {
    "default_path": "sidepanel.html"
}
```

**Step 2: Configure Background Behavior**
Set the side panel to open when the extension icon is clicked.

```javascript
// In background.js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
```
*Note: This replaces the default popup behavior.*

**Verification:**
- Load extension.
- Click the extension icon.
- Verify a side panel opens (even if empty or 404 for now).

### Task 2: Create Side Panel Foundation

**Files:**
- Create: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.html`
- Create: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.css`
- Create: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.js`

**Step 1: Create `sidepanel.html`**
Clone `popup.html` structure but optimize for a full-height sidebar.

- **Header:** Sticky top, includes Logo and "Close" (optional, as browser handles close) or "Settings" icon.
- **Content:** Scrollable container.
- **Footer:** Fixed bottom (optional) or just flow content.

**Step 2: Create `sidepanel.css`**
Interact with the design system variables from `styles.css`.
- Use `100vh` layout.
- Adopt "Trancy" aesthetic: Clean whitespace, card-based sections, subtle shadows.
- Ensure responsive width (side panels can be resized by user).

**Step 3: Create `sidepanel.js`**
Port logic from `popup.js`.
- Initialize settings toggles (Target Lang, Highlight, Immersion, YouTube).
- Initialize Stats (Word count, Mastery).
- Handle "Open Wordbook" navigation.

**Verification:**
- Open Side Panel.
- Verify all settings toggles work and persist.
- Verify stats display correctly.
- Verify UI looks professional and fits the sidebar format.

### Task 3: Refine UX/UI (Trancy Style)

**Files:**
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.css`
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/sidepanel.html`

**Step 1: Enhanced Visuals**
- **Stats Card:** Make it look like a premium dashboard widget (gradient background or clean border).
- **Toggle Switches:** Ensure they are aligned professionally (Label on left, Toggle on right).
- **Wordbook Link:** Make it a prominent card or button.

**Step 2: "Current Page" Context (Bonus/Future)**
- (Optional) Placeholder for showing words collected on the *current* tab.

**Verification:**
- Visual inspection against "Trancy" minimalist aesthetic.
- Check dark mode compatibility (if implemented).

### Task 4: Clean Up & Integration

**Files:**
- Modify: `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/manifest.json` (Remove `action.default_popup`)

**Step 1: Remove Old Popup**
Remove `"default_popup": "popup.html"` from `manifest.json` `action` key to ensure the icon click triggers the side panel (via background behavior) and doesn't conflict.

**Verification:**
- Final walkthrough of the flow:
    1. User installs extension.
    2. Click icon -> Side Panel opens.
    3. Toggle "Immersion" -> Content script updates.
    4. Close Side Panel -> State persists.

---

## Execution Handoff

**Plan complete and saved to `c:/Users/liwen/Desktop/workspace/language-learning/chrome-extension/docs/plans/2026-02-10-side-panel-migration.md`.**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints.

**Which approach?**
