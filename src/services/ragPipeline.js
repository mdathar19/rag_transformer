const { OpenAI } = require('openai');
const VectorSearchService = require('./vectorSearch');

class RAGPipeline {
    constructor(vectorSearchService, cacheService = null) {
        this.vectorSearch = vectorSearchService;
        this.cache = cacheService;
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Configuration
        this.config = {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            maxTokens: 1000,
            maxContextLength: 3000,
            // Default system prompt - will be customized per client
            defaultSystemPrompt: `You are an expert customer support assistant.
                          Answer questions directly and naturally as if you're having a conversation.
                          Use the information from the context to provide accurate, helpful answers.
                          Do NOT mention "the context" or "according to the context" in your responses.
                          Do NOT say things like "the provided context includes" or "based on the context".
                          Simply answer the question directly using the information available.
                          If you cannot answer based on the available information, politely say you don't have that specific information.
                          Be professional, friendly, and conversational in tone.`
        };
    }

    async generateAnswer(query, brokerId, options = {}) {
        const startTime = Date.now();

        try {
            // Check cache first
            if (options.useCache !== false && this.cache) {
                const cacheKey = this.getCacheKey(query, brokerId);
                const cached = await this.cache.get(`answer:${cacheKey}`);
                if (cached) {
                    console.log('[RAG] Cache hit for answer');
                    return JSON.parse(cached);
                }
            }

            // Get client info for custom no-data response
            const clientManager = require('./clientManager');
            let clientInfo = null;
            try {
                clientInfo = await clientManager.getClient(brokerId);
            } catch (error) {
                console.warn('[RAG] Could not retrieve client info:', error.message);
            }

            // Retrieve relevant documents
            console.log(`[RAG] Processing query for broker ${brokerId}: "${query}"`);
            const searchResults = await this.vectorSearch.search(
                query,
                brokerId,
                {
                    limit: options.topK || 5,
                    minScore: options.minScore || 0.3
                }
            );

            if (!searchResults || searchResults.length === 0) {
                // Use client's custom no-data response if available
                const noDataResponse = clientInfo?.noDataResponse ||
                    "I couldn't find relevant information to answer your question. Please try rephrasing or ask about something else.";

                return {
                    answer: noDataResponse,
                    sources: [],
                    confidence: 'low',
                    responseTime: Date.now() - startTime
                };
            }

            // Build context from search results
            const context = this.buildContext(searchResults, this.config.maxContextLength);

            // Create dynamic system prompt with client info
            const clientName = clientInfo?.name || 'our company';
            const dynamicSystemPrompt = `You are an expert customer support assistant for ${clientName} and its services.
                          Answer questions directly and naturally as if you're having a conversation.
                          Use the information from the context to provide accurate, helpful answers.
                          Do NOT mention "the context" or "according to the context" in your responses.
                          Do NOT say things like "the provided context includes" or "based on the context".
                          Simply answer the question directly using the information available.
                          If you cannot answer based on the available information, politely say you don't have that specific information.
                          Be professional, friendly, and conversational in tone.`;

            // Generate answer using OpenAI
            let answer = await this.generateAnswerWithContext(
                query,
                context,
                options.instructions || dynamicSystemPrompt
            );

            // Check if AI says it cannot answer (various phrasings)
            const cannotAnswerPhrases = [
                'does not contain any information',
                'cannot provide an answer',
                'cannot answer',
                "don't have information",
                'no information',
                'not found in the context',
                'context does not contain',
                'provided context does not'
            ];

            const isNoAnswerResponse = cannotAnswerPhrases.some(phrase =>
                answer.toLowerCase().includes(phrase.toLowerCase())
            );

            // Use custom response if AI cannot answer
            if (isNoAnswerResponse && clientInfo?.noDataResponse) {
                answer = clientInfo.noDataResponse;
            }

            // Calculate confidence
            const confidence = this.calculateConfidence(searchResults);

            // Format sources
            const sources = searchResults.slice(0, 3).map(result => ({
                url: result.url,
                title: result.title,
                score: result.score,
                snippet: this.extractSnippet(result.chunk || result.content, query)
            }));

            const response = {
                answer,
                sources,
                confidence,
                responseTime: Date.now() - startTime,
                tokensUsed: this.estimateTokens(context + answer)
            };

            // Cache the response
            if (options.useCache !== false && this.cache) {
                const cacheKey = this.getCacheKey(query, brokerId);
                await this.cache.set(
                    `answer:${cacheKey}`,
                    JSON.stringify(response),
                    3600 // 1 hour TTL
                );
            }

            // Log query for analytics
            await this.logQuery({
                brokerId,
                query,
                results: searchResults,
                answer,
                responseTime: response.responseTime,
                cached: false
            });

            return response;

        } catch (error) {
            console.error('[RAG] Error generating answer:', error);
            return {
                answer: "I encountered an error while processing your question. Please try again.",
                error: error.message,
                sources: [],
                confidence: 'error',
                responseTime: Date.now() - startTime
            };
        }
    }

    buildContext(searchResults, maxLength) {
        let context = '';
        const addedUrls = new Set();

        for (const result of searchResults) {
            // Avoid duplicate content from same URL
            if (addedUrls.has(result.url)) continue;

            const chunk = result.context || result.chunk || result.content || '';
            const metadata = `Source: ${result.title || 'Untitled'} (${result.url})\n`;
            const content = `${metadata}${chunk}\n\n`;

            if ((context + content).length > maxLength) {
                break;
            }

            context += content;
            addedUrls.add(result.url);
        }

        return context.trim();
    }

    async generateAnswerWithContext(query, context, instructions) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: instructions
                },
                {
                    role: 'user',
                    content: `Here's some information that might help:\n\n${context}\n\nUser Question: ${query}`
                }
            ];

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.3
            });

            return response.choices[0].message.content;

        } catch (error) {
            console.error('[RAG] OpenAI API error:', error);
            throw error;
        }
    }

    calculateConfidence(searchResults) {
        if (!searchResults || searchResults.length === 0) {
            return 'low';
        }

        const topScore = searchResults[0].score || 0;
        const avgScore = searchResults.reduce((sum, r) => sum + (r.score || 0), 0) / searchResults.length;

        if (topScore > 0.85 && avgScore > 0.75) {
            return 'high';
        } else if (topScore > 0.75 && avgScore > 0.65) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    extractSnippet(text, query, maxLength = 200) {
        if (!text) return '';

        // Try to find query terms in text
        const queryWords = query.toLowerCase().split(/\s+/);
        const textLower = text.toLowerCase();

        let bestStart = 0;
        let bestScore = 0;

        // Find best position with most query words
        for (let i = 0; i < text.length - maxLength; i++) {
            const snippet = textLower.substring(i, i + maxLength);
            const score = queryWords.filter(word => snippet.includes(word)).length;

            if (score > bestScore) {
                bestScore = score;
                bestStart = i;
            }
        }

        // Extract and clean snippet
        let snippet = text.substring(bestStart, bestStart + maxLength);

        // Try to start at sentence beginning
        const sentenceStart = snippet.indexOf('. ');
        if (sentenceStart > 0 && sentenceStart < 50) {
            snippet = snippet.substring(sentenceStart + 2);
        }

        // Add ellipsis if needed
        if (bestStart > 0) snippet = '...' + snippet;
        if (bestStart + maxLength < text.length) snippet += '...';

        return snippet.trim();
    }

    async streamAnswer(query, brokerId, options = {}) {
        // Get client info for custom no-data response
        const clientManager = require('./clientManager');
        let clientInfo = null;
        try {
            clientInfo = await clientManager.getClient(brokerId);
        } catch (error) {
            console.warn('[RAG] Could not retrieve client info:', error.message);
        }

        // Stream the answer for better UX - use regular search instead of hybrid
        const searchResults = await this.vectorSearch.search(
            query,
            brokerId,
            {
                limit: options.topK || 5,
                minScore: options.minScore || 0.3
            }
        );

        if (!searchResults || searchResults.length === 0) {
            const noDataResponse = clientInfo?.noDataResponse ||
                "I couldn't find relevant information to answer your question.";

            // Return a generator that yields a single chunk with the no-data message
            async function* noDataStream() {
                yield {
                    choices: [{
                        delta: {
                            content: noDataResponse
                        }
                    }]
                };
            }

            return {
                stream: noDataStream(),
                sources: []
            };
        }

        const context = this.buildContext(searchResults, this.config.maxContextLength);

        // Create dynamic system prompt with client info
        const clientName = clientInfo?.name || 'our company';
        const dynamicSystemPrompt = `You are an expert customer support assistant for ${clientName} and its services.
                      Answer questions directly and naturally as if you're having a conversation.
                      Use the information from the context to provide accurate, helpful answers.
                      Do NOT mention "the context" or "according to the context" in your responses.
                      Do NOT say things like "the provided context includes" or "based on the context".
                      Simply answer the question directly using the information available.
                      If you cannot answer based on the available information, politely say you don't have that specific information.
                      Be professional, friendly, and conversational in tone.`;

        const stream = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: 'system',
                    content: dynamicSystemPrompt
                },
                {
                    role: 'user',
                    content: `Here's some information that might help:\n\n${context}\n\nUser Question: ${query}`
                }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            stream: true
        });

        return {
            stream,
            sources: searchResults.slice(0, 3).map(r => ({
                url: r.url,
                title: r.title,
                score: r.score
            }))
        };
    }

    async answerWithCitation(query, brokerId, options = {}) {
        // Get client info for custom no-data response
        const clientManager = require('./clientManager');
        let clientInfo = null;
        try {
            clientInfo = await clientManager.getClient(brokerId);
        } catch (error) {
            console.warn('[RAG] Could not retrieve client info:', error.message);
        }

        // Generate answer with inline citations
        const searchResults = await this.vectorSearch.search(
            query,
            brokerId,
            {
                limit: options.topK || 5,
                minScore: options.minScore || 0.3
            }
        );

        if (!searchResults || searchResults.length === 0) {
            const noDataResponse = clientInfo?.noDataResponse ||
                "No relevant information found.";

            return {
                answer: noDataResponse,
                citations: []
            };
        }

        // Build context with numbered sources
        let context = '';
        const citations = [];

        searchResults.forEach((result, index) => {
            const num = index + 1;
            context += `[${num}] ${result.title}\n${result.chunk || result.content}\n\n`;
            citations.push({
                number: num,
                url: result.url,
                title: result.title
            });
        });

        // Create dynamic system prompt with client info
        const clientName = clientInfo?.name || 'our company';
        const instructions = `You are an expert customer support assistant for ${clientName} and its services.
                            Answer questions directly and naturally as if you're having a conversation.
                            Use the information from the context to provide accurate, helpful answers.
                            Do NOT mention "the context" or "according to the context" in your responses.
                            Do NOT say things like "the provided context includes" or "based on the context".
                            Simply answer the question directly using the information available.
                            When answering, cite sources using [1], [2], etc. format.
                            Always cite the source when using information from it.
                            If you cannot answer based on the available information, politely say you don't have that specific information.
                            Be professional, friendly, and conversational in tone.`;

        const answer = await this.generateAnswerWithContext(query, context, instructions);

        return {
            answer,
            citations
        };
    }

    async logQuery(queryData) {
        try {
            const database = require('../config/database');
            const db = database.getDb();
            const collection = db.collection('query_logs');

            await collection.insertOne({
                ...queryData,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('[RAG] Error logging query:', error);
        }
    }

    getCacheKey(query, brokerId) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(`${brokerId}:${query}`).digest('hex');
    }

    estimateTokens(text) {
        // Rough estimation
        return Math.ceil(text.length / 4);
    }
}

module.exports = RAGPipeline;