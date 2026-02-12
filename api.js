// api.js - Backend API Client

// const API_BASE = "http://localhost:8081/api";
const API_BASE = "https://words-learning-service.vercel.app/api";

const api = {
    /**
     * Translate text using the backend.
     * @param {string} text 
     * @param {string} targetLang 
     * @returns {Promise<{translation: string, phonetic: string, detected_source_lang: string}>}
     */
    async translate(text, targetLang) {
        try {
            const response = await fetch(`${API_BASE}/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, target_lang: targetLang })
            });

            if (!response.ok) throw new Error('Translation failed');
            return await response.json();
        } catch (error) {
            console.error('API Translate Error:', error);
            // Fallback object to prevent UI crash
            return { translation: "[Offline/Error]", phonetic: "" };
        }
    },

    /**
     * Get vocabulary words, optionally filtering by timestamp range.
     * @param {number} [startTime=0] - Filter words updated since this timestamp (seconds).
     * @returns {Promise<Array>}
     */
    async getWords(startTime = 0) {
        try {
            let url = `${API_BASE}/words`;
            if (startTime > 0) {
                // Backend expects 'start_time' query parameter
                url += `?start_time=${startTime}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch words');
            return await response.json();
        } catch (error) {
            console.error('API GetWords Error:', error);
            return [];
        }
    },

    /**
     * Save a new word.
     * @returns {Promise<Object|null>} saved word object
     */
    async saveWord(original, translation, context, url, phonetic, meanings = []) {
        try {
            const payload = {
                original,
                translation,
                phonetic,
                context,
                url,
                timestamp: Date.now() / 1000,
                learned: false,
                meanings // Include meanings in payload
            };

            const response = await fetch(`${API_BASE}/words`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) return await response.json();
            return null;
        } catch (error) {
            console.error('API SaveWord Error:', error);
            return null;
        }
    },

    /**
     * Update a word by ID.
     */
    async updateWord(wordId, data) {
        try {
            const response = await fetch(`${API_BASE}/words/${wordId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('API UpdateWord Error:', error);
            return false;
        }
    },

    /**
     * Delete a word by ID.
     * @param {string} wordId 
     */
    async deleteWord(wordId) {
        try {
            await fetch(`${API_BASE}/words/${wordId}`, { method: 'DELETE' });
            return true;
        } catch (error) {
            console.error('API DeleteWord Error:', error);
            return false;
        }
    },

    /**
     * Get user settings.
     */
    async getSettings() {
        try {
            const response = await fetch(`${API_BASE}/settings`);
            if (response.ok) return await response.json();
        } catch (error) {
            console.error('API GetSettings Error:', error);
        }
        return null; // Let caller handle null (fallback to local)
    },

    /**
     * Update user settings.
     * @param {Object} settings 
     */
    async updateSettings(settings) {
        try {
            await fetch(`${API_BASE}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('API UpdateSettings Error:', error);
        }
    }
};
