// background.js

// Initialize default settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      targetLanguage: 'zh', // Default to Chinese
      highlightEnabled: true
    },
    // Initialize empty vocabulary list if not present
    vocabulary: []
  });

  // Create Context Menu item
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate & Save: '%s'",
    contexts: ["selection"]
  });
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
