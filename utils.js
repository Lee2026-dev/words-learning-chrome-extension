// utils.js - Bridge to API (Hybrid Strategy)

/**
 * Translate text using Google API first, fallback to Backend if fails.
 */
async function translateText(text, targetLang) {
    if (!text || !text.trim()) return { translation: "" };

    // 1. Try Backend API First (Rich Dictionary Data)
    try {
        if (typeof api !== 'undefined') {
            const result = await api.translate(text, targetLang);
            // Check if we got a valid translation
            if (result && result.translation && result.translation !== "[Offline/Error]") {
                return result;
            }
        }
    } catch (error) {
        console.warn("Backend Translate failed, falling back to Google...", error);
    }

    // 2. Fallback to Google Translate Client-Side (Free, Fast, but simple)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();

            if (data && data[0]) {
                const translation = data[0]
                    .filter(item => item && item[0] && item[1] !== null)
                    .map(item => item[0])
                    .join('');

                const romanizationArray = data[0].find(item =>
                    Array.isArray(item) && item.length >= 3 && item[0] === null && item[1] === null
                );

                let phonetic = "";
                if (romanizationArray) {
                    phonetic = romanizationArray[3] || romanizationArray[2] || "";
                }

                return { translation, phonetic };
            }
        }
    } catch (e) {
        console.warn("Direct Google Translate error:", e);
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
            const savedWord = await api.saveWord(original, translation, context, url, phonetic);
            if (savedWord) {
                // Background sync to ensure local storage is up to date
                syncVocabulary();
                return savedWord;
            }
        }
        return null;
    } catch (error) {
        console.error("Utils SaveWord Error:", error);
        return null;
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
