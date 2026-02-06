// utils.js - Bridge to API (Hybrid Strategy)

/**
 * Translate text using Google API first, fallback to Backend if fails.
 */
async function translateText(text, targetLang) {
    if (!text || !text.trim()) return { translation: "" };

    // 1. Try Google Translate Client-Side (Free, Fast)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();

            let translation = "";
            let phonetic = "";

            if (data && data[0]) {
                translation = data[0].map(item => item[0]).join('');
                const lastItem = data[0][data[0].length - 1];
                const secondLast = data[0][data[0].length - 2];
                if (typeof lastItem === 'string' && lastItem !== translation) {
                    phonetic = lastItem;
                } else if (Array.isArray(lastItem) && typeof secondLast === 'string') {
                    phonetic = secondLast;
                }
            }
            return { translation, phonetic };
        } else {
            // 429 Too Many Requests or other error
            console.warn("Direct Google Translate failed, trying backend fallback...");
        }
    } catch (e) {
        console.warn("Direct Google Translate error:", e);
    }

    // 2. Fallback to Backend API (Hosted / Proxy)
    try {
        if (typeof api !== 'undefined') {
            return await api.translate(text, targetLang);
        }
    } catch (error) {
        console.error("Backend Translate Error:", error);
    }

    return { translation: "Translation Failed", phonetic: "" };
}

/**
 * Save a word to the backend.
 */
/**
 * Sync vocabulary from backend to local storage (Incremental).
 */
async function syncVocabulary() {
    try {
        if (typeof api !== 'undefined') {
            const data = await chrome.storage.local.get(['vocabulary', 'lastSyncTimestamp']);
            let localWords = data.vocabulary || [];
            const lastSync = data.lastSyncTimestamp || 0;

            console.log(`Syncing vocabulary since: ${lastSync}`);

            // Fetch only new/changed words from backend
            const newWords = await api.getWords(lastSync);

            if (newWords && newWords.length > 0) {
                // Merge strategy: Create Map from localWords for easy lookup/update
                const wordMap = new Map();

                localWords.forEach(w => {
                    if (w && (w.id || w.original)) wordMap.set(w.id || w.original, w);
                });

                // Add/Update with new words
                newWords.forEach(w => {
                    if (w && (w.id || w.original)) wordMap.set(w.id || w.original, w);
                });

                // Convert back to array
                localWords = Array.from(wordMap.values());

                // Sort by newest first
                localWords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                // Update storage
                await chrome.storage.local.set({
                    vocabulary: localWords,
                    lastSyncTimestamp: Date.now() / 1000
                });

                console.log(`Synced ${newWords.length} new words.`);
                return localWords;
            } else {
                // No new words found
                // Update timestamp to confirm we synced successfully up to this point
                await chrome.storage.local.set({ lastSyncTimestamp: Date.now() / 1000 });
                return localWords; // Return current local words
            }
        }
        // Fallback: If api is undefined, just return local words
        const data = await chrome.storage.local.get(['vocabulary']);
        return data.vocabulary || [];
    } catch (error) {
        console.error("Utils SyncVocabulary Error:", error);
        // Last resort fallback
        const data = await chrome.storage.local.get(['vocabulary']);
        return data.vocabulary || [];
    }
}

/**
 * Save a word to the backend.
 */
async function saveWord(original, translation, context, url, phonetic) {
    try {
        if (typeof api !== 'undefined') {
            // Optimistic update: Return true immediately to unblock UI
            // Perform actual save and sync in background
            api.saveWord(original, translation, context, url, phonetic).then(success => {
                if (success) {
                    syncVocabulary();
                }
            }).catch(err => console.error("Background Save Error:", err));

            return true;
        }
        return false;
    } catch (error) {
        console.error("Utils SaveWord Error:", error);
        return false;
    }
}

/**
 * Get all saved words from backend.
 */
async function getPendingWords() {
    try {
        if (typeof api !== 'undefined') {
            return await api.getWords();
        }
        return [];
    } catch (error) {
        console.error("Utils GetPendingWords Error:", error);
        return [];
    }
}
