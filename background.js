// background.js

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'vocabulary'], (result) => {
    const updates = {};
    if (!result.settings) {
      updates.settings = {
        targetLanguage: 'zh', // Default to Chinese
        highlightEnabled: true
      };
    }
    // Initialize empty vocabulary list if not present
    if (!result.vocabulary) {
      updates.vocabulary = [];
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });

  // Create Context Menu item
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate & Save: '%s'",
    contexts: ["selection"]
  });

  // Configure Side Panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Side Panel Error:', error));
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-selection" && info.selectionText) {
    // Send message to content script to handle translation UI
    chrome.tabs.sendMessage(tab.id, {
      action: "translateSelection",
      text: info.selectionText
    });
  }
});
