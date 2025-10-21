const RAGPipeline = require('../services/ragPipeline');
const VectorSearchService = require('../services/vectorSearch');
const cacheService = require('../services/cacheService');
const EmbeddingService = require('../services/embeddingService');
const sessionManager = require('../services/sessionManager');

class ChatController {
    constructor() {
        // No longer need in-memory sessions
    }

    async initialize() {
        // Initialize all required services
        const database = require('../config/database');
        const db = database.getDb();

        // Create embedding service
        const embeddingService = new EmbeddingService();

        // Create vector search service with embedding service
        const vectorSearchService = new VectorSearchService(embeddingService, cacheService);
        vectorSearchService.collection = db.collection('content');

        // Create RAG pipeline with properly initialized services
        this.ragPipeline = new RAGPipeline(vectorSearchService, cacheService);
    }

    async handleChatMessage(req, res) {
        try {
            const {
                brokerId = req.brokerId,
                sessionId = req.sessionId || req.body.sessionId,
                oldSessionId = req.body.oldSessionId, // For clearing old session
                query,
                options = {}
            } = req.body;

            if (!brokerId || !query || !sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Broker ID, session ID, and query are required'
                });
            }

            // If oldSessionId provided, clear it (new session started)
            if (oldSessionId && oldSessionId !== sessionId) {
                await sessionManager.clearSession(oldSessionId);
            }

            // Get full conversation history from Redis
            const conversationHistory = await sessionManager.getConversationHistory(sessionId);

            // Check if query relates to session context
            const contextCheck = await sessionManager.checkContextRelevance(query, conversationHistory);

            // Build the full query with all context
            let enhancedQuery = query;
            if (contextCheck.isRelated && contextCheck.context) {
                enhancedQuery = contextCheck.context + `Current question: "${query}"`;

                // If it's asking for summary/short version, make it explicit
                if (query.toLowerCase().includes('short') || query.toLowerCase().includes('brief')) {
                    enhancedQuery += '\n\nThe user is asking for a SHORT/BRIEF summary of the previous topic discussed.';
                }
            }

            // Add user message to session history BEFORE processing
            await sessionManager.addToHistory(sessionId, 'user', query);

            // Set headers for Server-Sent Events (SSE)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

            let fullAnswer = '';
            let sources = [];
            let confidence = 'medium';

            try {
                // If query strongly relates to context, answer directly from context without DB search
                if (contextCheck.requiresContext && conversationHistory.length > 0) {
                    // Get the last assistant response for summary
                    const lastAssistantResponse = conversationHistory
                        .filter(msg => msg.role === 'assistant')
                        .pop();

                    if (lastAssistantResponse && (query.toLowerCase().includes('short') ||
                        query.toLowerCase().includes('brief') ||
                        query.toLowerCase().includes('summary'))) {

                        // Create a short summary of the last response
                        const summary = this.createShortSummary(lastAssistantResponse.content);

                        // Stream the summary word by word for better UX
                        const words = summary.split(' ');
                        for (let i = 0; i < words.length; i++) {
                            const word = words[i] + (i < words.length - 1 ? ' ' : '');
                            fullAnswer += word;
                            res.write(`data: ${JSON.stringify({ type: 'token', content: word })}\n\n`);
                            await new Promise(resolve => setTimeout(resolve, 30)); // Small delay for streaming effect
                        }

                        sources = [];
                        confidence = 'high';
                    } else {
                        // Use RAG pipeline but don't include full conversation history in query
                        // Just use the current query since it's not a summary request
                        const streamResult = await this.ragPipeline.streamAnswer(
                            query,
                            brokerId,
                            {
                                ...options,
                                useCache: false
                            }
                        );

                        sources = streamResult.sources || [];

                        // Stream the response
                        for await (const chunk of streamResult.stream) {
                            const content = chunk.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullAnswer += content;
                                res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
                            }
                        }
                    }
                } else {
                    // Regular RAG pipeline streaming query
                    const streamResult = await this.ragPipeline.streamAnswer(
                        enhancedQuery,
                        brokerId,
                        {
                            ...options,
                            useCache: false
                        }
                    );

                    sources = streamResult.sources || [];

                    // Stream the response
                    for await (const chunk of streamResult.stream) {
                        const content = chunk.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullAnswer += content;
                            res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
                        }
                    }
                }

                // Add assistant response to session history
                await sessionManager.addToHistory(sessionId, 'assistant', fullAnswer);

                // Send completion event with metadata
                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    sessionId: sessionId,
                    contextUsed: contextCheck.isRelated,
                    sources: sources,
                    confidence: confidence
                })}\n\n`);

            } catch (streamError) {
                console.error('[Chat] Streaming error:', streamError);
                res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message })}\n\n`);
            }

            res.end();

        } catch (error) {
            console.error('[Chat] Error:', error);

            // If headers not sent yet, send JSON error
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            } else {
                // If streaming already started, send error event
                res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
                res.end();
            }
        }
    }

    async getSessionHistory(req, res) {
        const { sessionId } = req.params;

        try {
            const history = await sessionManager.getConversationHistory(sessionId);

            res.json({
                success: true,
                data: {
                    sessionId: sessionId,
                    history: history
                }
            });
        } catch (error) {
            console.error('[Chat] Error getting history:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async clearSession(req, res) {
        const { sessionId } = req.params;

        try {
            await sessionManager.clearSession(sessionId);

            res.json({
                success: true,
                message: 'Session cleared successfully'
            });
        } catch (error) {
            console.error('[Chat] Error clearing session:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async createNewSession(req, res) {
        const { newSessionId, oldSessionId } = req.body;

        if (!newSessionId) {
            return res.status(400).json({
                success: false,
                error: 'New session ID is required'
            });
        }

        try {
            const session = await sessionManager.createNewSession(newSessionId, oldSessionId);

            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            console.error('[Chat] Error creating session:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    createShortSummary(fullText) {
        // Extract key points from the full response
        if (fullText.toLowerCase().includes('p2p')) {
            return "P2P (peer-to-peer) trading on PayBito allows direct cryptocurrency trading between users with: " +
                   "• Zero trading fees " +
                   "• Multiple payment methods " +
                   "• 100+ fiat currencies " +
                   "• Secure escrow system - crypto held by PayBito until payment confirmed " +
                   "• Simple process: Place order → Pay/Receive payment → Get/Release crypto";
        }

        // For other topics, create a generic summary
        const sentences = fullText.split('. ').filter(s => s.length > 20);
        if (sentences.length > 0) {
            // Take first 2-3 key sentences
            const summary = sentences.slice(0, 3).join('. ');
            return summary.length > 300 ? summary.substring(0, 300) + '...' : summary;
        }

        return "Here's a brief summary: " + fullText.substring(0, 200) + "...";
    }
}

// Singleton instance
const chatController = new ChatController();

module.exports = chatController;