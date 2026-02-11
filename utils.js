// utils.js - Bridge to API (Hybrid Strategy)

/**
 * Translate text — LOCAL FIRST, then Backend, then Google fallback.
 */
async function translateText(text, targetLang) {
    if (!text || !text.trim()) return { translation: "" };

    // 0. Check local savedWords first (instant, no network)
    if (typeof savedWords !== 'undefined') {
        const local = savedWords.find(w => w.original && w.original.toLowerCase() === text.trim().toLowerCase());
        if (local && local.translation) {
            console.log(`Translation found locally for "${text}"`);
            return {
                translation: local.translation,
                phonetic: local.phonetic || '',
                meanings: local.meanings || [],
                // Local cache won't have rich meanings, so backend will be fetched
                // by showSavedWordBubble for highlighted words.
                // For new selections, return what we have.
            };
        }
    }

    // 1. Try Backend API (Rich Dictionary Data)
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
        if (chrome.runtime?.id) {
            try {
                const data = await chrome.storage.local.get(['vocabulary']);
                return data.vocabulary || [];
            } catch { return []; }
        }
        return [];
    }
}

/**
 * Save a word — LOCAL FIRST, then sync to backend async.
 * Returns the word object immediately (with a temporary local ID).
 */
function saveWord(original, translation, context, url, phonetic, meanings = []) {
    // 1. Create word object with temporary local ID
    const tempId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const wordObj = {
        id: tempId,
        original,
        translation,
        phonetic: phonetic || '',
        context: context || '',
        url: url || '',
        timestamp: Date.now() / 1000,
        meanings: meanings || [],
        learned: false,
        _pendingSync: true // Flag: not yet confirmed by backend
    };

    // 2. Save to local storage immediately
    try {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(['vocabulary'], (data) => {
                if (chrome.runtime.lastError) return; // Prevent error logging if context dies mid-call
                const vocab = data.vocabulary || [];
                // Avoid duplicates
                if (!vocab.some(w => w.original && w.original.toLowerCase() === original.toLowerCase())) {
                    vocab.push(wordObj);
                    chrome.storage.local.set({ vocabulary: vocab });
                }
            });
        }
    } catch (e) {
        console.warn("Extension context invalidated, save failed:", e);
    }

    // 3. Fire backend API async (don't await)
    if (typeof api !== 'undefined') {
        api.saveWord(original, translation, context, url, phonetic, meanings).then(backendWord => {
            if (backendWord && backendWord.id) {
                // Replace temp entry with real backend entry in local storage
                try {
                    if (chrome.runtime?.id) {
                        chrome.storage.local.get(['vocabulary'], (data) => {
                            if (chrome.runtime.lastError) return;
                            const vocab = data.vocabulary || [];
                            const idx = vocab.findIndex(w => w.id === tempId);
                            if (idx !== -1) {
                                vocab[idx] = { ...backendWord, _pendingSync: false };
                            }
                            chrome.storage.local.set({ vocabulary: vocab });
                        });
                    }
                } catch (e) {
                    console.warn("Context invalidated during backend sync save:", e);
                }
                // Also update in-memory savedWords if it exists in content.js scope
                if (typeof savedWords !== 'undefined') {
                    const memIdx = savedWords.findIndex(w => w.id === tempId);
                    if (memIdx !== -1) {
                        savedWords[memIdx] = { ...backendWord, _pendingSync: false };
                    }
                }
                console.log(`Word "${original}" synced to backend (id: ${backendWord.id})`);
            }
        }).catch(err => {
            console.error(`Background save failed for "${original}":`, err);
        });
    }

    // 4. Return immediately with local object
    return wordObj;
}

/**
 * Update a word locally first, then sync to backend async.
 * @param {string} wordId - The word's ID (can be temp or real)
 * @param {Object} updates - Fields to update, e.g. { learned: true }
 * @returns {boolean} true (always succeeds locally)
 */
function updateWordLocal(wordId, updates) {
    // 1. Update local storage immediately
    try {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(['vocabulary'], (data) => {
                if (chrome.runtime.lastError) return;
                const vocab = data.vocabulary || [];
                const idx = vocab.findIndex(v => v.id === wordId);
                if (idx !== -1) {
                    Object.assign(vocab[idx], updates);
                    chrome.storage.local.set({ vocabulary: vocab });
                }
            });
        }
    } catch (e) {
        console.warn("Context invalidated during update:", e);
    }

    // 2. Update in-memory savedWords if available
    if (typeof savedWords !== 'undefined') {
        const memWord = savedWords.find(w => w.id === wordId);
        if (memWord) {
            Object.assign(memWord, updates);
        }
    }

    // 3. Fire backend async (skip for temp IDs that haven't synced yet)
    if (typeof api !== 'undefined' && wordId && !wordId.startsWith('local_')) {
        api.updateWord(wordId, updates).then(success => {
            if (!success) {
                console.warn(`Backend update failed for word ${wordId}, local state may be ahead.`);
            }
        }).catch(err => {
            console.error(`Background update failed for word ${wordId}:`, err);
        });
    }

    return true;
}

/**
 * Delete a word locally first, then sync to backend async.
 * @param {string} wordId - The word's ID
 * @returns {boolean} true (always succeeds locally)
 */
function deleteWordLocal(wordId) {
    // 1. Remove from local storage immediately
    try {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(['vocabulary'], (data) => {
                if (chrome.runtime.lastError) return;
                const vocab = data.vocabulary || [];
                const filtered = vocab.filter(w => w.id !== wordId);
                chrome.storage.local.set({ vocabulary: filtered });
            });
        }
    } catch (e) {
        console.warn("Context invalidated during delete:", e);
    }

    // 2. Remove from in-memory savedWords if available
    if (typeof savedWords !== 'undefined') {
        const idx = savedWords.findIndex(w => w.id === wordId);
        if (idx !== -1) {
            savedWords.splice(idx, 1);
        }
    }
    // 3. Fire backend async
    if (typeof api !== 'undefined' && wordId && !wordId.startsWith('local_')) {
        api.deleteWord(wordId).catch(err => {
            console.error(`Background delete failed for word ${wordId}:`, err);
        });
    }

    return true;
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
