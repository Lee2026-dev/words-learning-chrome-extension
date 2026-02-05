// utils.js

/**
 * Mock Translation Service (since we don't have a paid API key yet).
 * In a real app, fetch from Google Translate / DeepL API.
 * This mock simulates a delay and returns a dummy translation.
 */
async function translateText(text, targetLang) {
    if (!text || !text.trim()) return { translation: "" };

    try {
        // Add dt=rm (romanization/phonetic)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Parse Translation
        let translation = "";
        let phonetic = "";

        if (data && data[0]) {
            // translation is join of 0th index
            translation = data[0].map(item => item[0]).join('');

            // Phonetic extraction attempt
            // Usually the last element in data[0] is the source phonetic
            const lastItem = data[0][data[0].length - 1];
            const secondLast = data[0][data[0].length - 2];

            if (typeof lastItem === 'string' && lastItem !== translation) {
                phonetic = lastItem;
            } else if (Array.isArray(lastItem) && typeof secondLast === 'string') {
                phonetic = secondLast;
            }
        }

        return { translation, phonetic };

    } catch (error) {
        console.error("Translation Error:", error);
        return { translation: `[Error] ${error.message}` };
    }
}

/**
 * Save a word to the vocabulary list.
 */
async function saveWord(original, translation, context, url) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocab = result.vocabulary || [];

            // Avoid duplicates based on original text
            const exists = vocab.some(item => item.original.toLowerCase() === original.toLowerCase());

            if (!exists) {
                const newWord = {
                    id: Date.now().toString(),
                    original,
                    translation,
                    context,
                    url,
                    timestamp: Date.now(),
                    learned: false
                };

                const updatedVocab = [newWord, ...vocab];
                chrome.storage.local.set({ vocabulary: updatedVocab }, () => {
                    resolve(true); // Saved successfully
                });
            } else {
                resolve(false); // Already exists
            }
        });
    });
}

/**
 * Get all saved words.
 */
async function getPendingWords() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['vocabulary'], (result) => {
            const vocab = result.vocabulary || [];
            // Return words that are not marked as learned (or all for now)
            resolve(vocab);
        });
    });
}
