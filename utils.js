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
async function saveWord(original, translation, context, url) {
    try {
        if (typeof api !== 'undefined') {
            return await api.saveWord(original, translation, context, url);
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
