const cacheService = require('./cacheService');

class SessionManager {
    constructor() {
        this.SESSION_PREFIX = 'chat_session:';
        this.SESSION_TTL = 86400; // 1 day in seconds
    }

    /**
     * Get or create a session with full conversation history
     */
    async getSession(sessionId) {
        try {
            const key = `${this.SESSION_PREFIX}${sessionId}`;

            // Try to get from Redis
            const cached = await cacheService.get(key);
            if (cached) {
                return JSON.parse(cached);
            }

            // Create new session if not exists
            const newSession = {
                id: sessionId,
                conversationHistory: [],
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };

            await this.saveSession(sessionId, newSession);
            return newSession;
        } catch (error) {
            console.error('[SessionManager] Error getting session:', error);
            // Return in-memory session if Redis fails
            return {
                id: sessionId,
                conversationHistory: [],
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };
        }
    }

    /**
     * Save session to Redis with TTL
     */
    async saveSession(sessionId, sessionData) {
        try {
            const key = `${this.SESSION_PREFIX}${sessionId}`;
            sessionData.lastActivity = new Date().toISOString();

            await cacheService.set(
                key,
                JSON.stringify(sessionData),
                this.SESSION_TTL
            );

            return true;
        } catch (error) {
            console.error('[SessionManager] Error saving session:', error);
            return false;
        }
    }

    /**
     * Add message to session history
     */
    async addToHistory(sessionId, role, content) {
        try {
            const session = await this.getSession(sessionId);

            // Add message to history
            session.conversationHistory.push({
                role: role,
                content: content,
                timestamp: new Date().toISOString()
            });

            // Save updated session
            await this.saveSession(sessionId, session);

            return session;
        } catch (error) {
            console.error('[SessionManager] Error adding to history:', error);
            throw error;
        }
    }

    /**
     * Get full conversation history for a session
     */
    async getConversationHistory(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            return session.conversationHistory || [];
        } catch (error) {
            console.error('[SessionManager] Error getting history:', error);
            return [];
        }
    }

    /**
     * Clear a session from cache
     */
    async clearSession(sessionId) {
        try {
            const key = `${this.SESSION_PREFIX}${sessionId}`;
            await cacheService.delete(key);
            console.log(`[SessionManager] Cleared session: ${sessionId}`);
            return true;
        } catch (error) {
            console.error('[SessionManager] Error clearing session:', error);
            return false;
        }
    }

    /**
     * Create new session and clear old one
     */
    async createNewSession(newSessionId, oldSessionId = null) {
        try {
            // Clear old session if provided
            if (oldSessionId) {
                await this.clearSession(oldSessionId);
            }

            // Create new session
            const newSession = {
                id: newSessionId,
                conversationHistory: [],
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };

            await this.saveSession(newSessionId, newSession);
            return newSession;
        } catch (error) {
            console.error('[SessionManager] Error creating new session:', error);
            throw error;
        }
    }

    /**
     * Build full conversation context for AI
     */
    buildFullContext(conversationHistory) {
        if (!conversationHistory || conversationHistory.length === 0) {
            return '';
        }

        let context = 'Previous conversation in this session:\n';
        context += '=' .repeat(50) + '\n';

        conversationHistory.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            context += `\n${role}: ${msg.content}\n`;
            if (index < conversationHistory.length - 1) {
                context += '-'.repeat(30) + '\n';
            }
        });

        context += '=' .repeat(50) + '\n\n';
        return context;
    }

    /**
     * Check if query relates to session history
     */
    async checkContextRelevance(query, conversationHistory) {
        if (!conversationHistory || conversationHistory.length === 0) {
            return { isRelated: false, context: '' };
        }

        const queryLower = query.toLowerCase();

        // Keywords that indicate reference to previous context
        const contextKeywords = [
            'it', 'this', 'that', 'these', 'those',
            'above', 'previous', 'earlier', 'before',
            'mentioned', 'said', 'told', 'explained',
            'more', 'details', 'elaborate', 'clarify',
            'short', 'inshort', 'summary', 'summarize',
            'again', 'repeat', 'also', 'furthermore'
        ];

        // Check if query contains context references
        const hasContextReference = contextKeywords.some(keyword =>
            queryLower.includes(keyword)
        );

        if (hasContextReference) {
            const fullContext = this.buildFullContext(conversationHistory);
            return {
                isRelated: true,
                context: fullContext,
                requiresContext: true
            };
        }

        // Even for new questions, provide recent context for continuity
        const recentContext = conversationHistory.slice(-4); // Last 2 exchanges
        return {
            isRelated: false,
            context: this.buildFullContext(recentContext),
            requiresContext: false
        };
    }
}

// Singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;