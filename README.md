# LinguaLearn Chrome Extension

A language learning assistant that helps you translate texts, save vocabulary, and review them later.

## Features
- **Translate Selection**: Select text on any page -> Right-click "Translate" OR use the popup bubble.
- **Save Words**: Save translated words to your personal Word Book.
- **Highlighting**: Automatically highlights saved words when you encounter them again on the web.
- **Word Book**: A dedicated dashboard to review and manage your vocabulary.
- **Full Page Translation**: Quickly open the current page in Google Translate.

## How to Install (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select this directory:
   `c:\Users\liwen\Desktop\workspace\language-learning\chrome-extension`
5. The extension should now be active!

## Usage
- **Popup**: Click the extension icon to see stats, toggle highlighting, or open the Word Book.
- **Context Menu**: Right-click selected text to translate.
- **Bubble**: Select text to see a translation tooltip (if enabled).

## Tech Stack
- Manifest V3
- Vanilla JS / HTML / CSS
- Chrome Storage API
