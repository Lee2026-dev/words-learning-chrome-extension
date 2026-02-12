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

  // Handle Action Click (Open Dashboard)
  chrome.action.onClicked.addListener((tab) => {
    // Check if the tab is a valid page
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
      // Cannot run on system pages
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "toggleDashboard" })
      .catch((err) => {
        // If content script is not ready (e.g. strict page or not reloaded), ignore or warn
        console.warn("LinguaLearn: Could not toggle dashboard. Page might need refresh.", err);
      });
  });
});

// Handle Messages from Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openWordbook") {
    chrome.tabs.create({ url: 'wordbook.html' });
  }
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
