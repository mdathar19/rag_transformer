const database = require('../config/database');
const EmbeddingService = require('./embeddingService');

class VectorSearchService {
    constructor(embeddingService, cacheService = null) {
        this.embeddingService = embeddingService;
        this.cache = cacheService;
        this.searchLimit = 10;
        this.minScore = 0.3; // Lowered threshold for better recall
    }

    async search(query, brokerId, options = {}) {
        const {
            limit = this.searchLimit,
            minScore = this.minScore,
            useCache = true,
            filters = {}
        } = options;

        // Check cache first
        if (useCache && this.cache) {
            const cacheKey = this.getCacheKey(query, brokerId, filters);
            const cached = await this.cache.get(`search:${cacheKey}`);
            if (cached) {
                console.log('[VectorSearch] Cache hit for query');
                return JSON.parse(cached);
            }
        }

        try {
            // Generate embedding for the query
            console.log(`[VectorSearch] Processing query: "${query}" for broker: ${brokerId}`);
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);

            // Perform vector search using MongoDB Atlas Search on chunks collection
            const db = database.getDb();
            const collection = db.collection('content_chunks');

            // Build the Atlas Search pipeline for the new structure
            const pipeline = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: limit * 10,
                        limit: limit * 3,
                        filter: {
                            brokerId: brokerId
                        }
                    }
                },
                // Add search score - for $vectorSearch use vectorSearchScore
                {
                    $addFields: {
                        searchScore: { $meta: "vectorSearchScore" }
                    }
                },
                // Filter by minimum score if needed
                {
                    $match: {
                        searchScore: { $gte: minScore }
                    }
                },
                // Sort by score
                {
                    $sort: {
                        searchScore: -1
                    }
                },
                // Limit results
                {
                    $limit: limit * 2 // Get more for diversity
                },
                // Format the output
                {
                    $project: {
                        _id: 1,
                        url: 1,
                        title: 1,
                        description: 1,
                        contentType: 1,
                        chunk: '$chunkText',
                        chunkPosition: '$position',
                        score: '$searchScore',
                        pageRank: 1,
                        metadata: 1
                    }
                }
            ];

            const results = await collection.aggregate(pipeline).toArray();

            console.log(`[VectorSearch] Vector search returned ${results.length} raw results`);
            if (results.length > 0) {
                console.log(`[VectorSearch] Top result score: ${results[0].searchScore}`);
            }

            // If vector search returns 0 results, try keyword fallback
            if (results.length === 0) {
                console.log('[VectorSearch] Vector search returned 0 results, trying keyword fallback');
                return this.fallbackKeywordSearch(query, brokerId, limit);
            }

            // Post-process results
            const processedResults = this.postProcessResults(results, limit);
            console.log(`[VectorSearch] After post-processing: ${processedResults.length} results`);

            // Cache the results
            if (useCache && this.cache) {
                const cacheKey = this.getCacheKey(query, brokerId, filters);
                await this.cache.set(
                    `search:${cacheKey}`,
                    JSON.stringify(processedResults),
                    3600 // 1 hour TTL
                );
            }

            return processedResults;

        } catch (error) {
            console.error('[VectorSearch] Vector search error:', error.message);

            // Fallback to simple keyword search if vector search fails
            return this.fallbackKeywordSearch(query, brokerId, limit);
        }
    }

    async hybridSearch(query, brokerId, options = {}) {
        const { limit = this.searchLimit, weights = { vector: 0.7, text: 0.3 } } = options;

        // Perform both searches in parallel
        const [vectorResults, textResults] = await Promise.all([
            this.search(query, brokerId, { ...options, useCache: false }),
            this.textSearch(query, brokerId, { ...options, useCache: false })
        ]);

        // Combine and rerank results
        const combinedResults = this.combineResults(
            vectorResults,
            textResults,
            weights
        );

        return combinedResults.slice(0, limit);
    }

    async textSearch(query, brokerId, options = {}) {
        const { limit = this.searchLimit } = options;

        try {
            const db = database.getDb();
            const collection = db.collection('content_chunks');

            const results = await collection.aggregate([
                {
                    $match: {
                        brokerId: brokerId,
                        $text: { $search: query }
                    }
                },
                {
                    $addFields: {
                        textScore: { $meta: 'textScore' }
                    }
                },
                {
                    $sort: {
                        textScore: -1,
                        pageRank: -1
                    }
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        _id: 1,
                        url: 1,
                        title: 1,
                        description: 1,
                        content: { $substr: ['$chunkText', 0, 500] },
                        chunk: '$chunkText',
                        contentType: 1,
                        score: '$textScore',
                        pageRank: 1,
                        metadata: 1
                    }
                }
            ]).toArray();

            return results;
        } catch (error) {
            console.error('[VectorSearch] Text search error:', error);
            return [];
        }
    }

    async fallbackKeywordSearch(query, brokerId, limit) {
        console.log('[VectorSearch] Falling back to simple keyword search');

        try {
            const db = database.getDb();
            const collection = db.collection('content_chunks');

            // Extract meaningful keywords (filter out common words)
            const stopWords = ['the', 'about', 'tell', 'what', 'how', 'does', 'can', 'you', 'your', 'this', 'that', 'with', 'from', 'have', 'for', 'and', 'are'];
            const keywords = query.toLowerCase()
                .split(' ')
                .filter(w => w.length > 2 && !stopWords.includes(w));

            console.log(`[VectorSearch] Searching for keywords: ${keywords.join(', ')}`);

            // Create regex patterns for each keyword
            const regexPatterns = keywords.map(kw => ({
                chunkText: { $regex: new RegExp(kw, 'i') }
            }));

            // Find documents matching ANY keyword
            const results = await collection.find({
                brokerId: brokerId,
                $or: regexPatterns.length > 0 ? regexPatterns : [{ chunkText: { $regex: /./ } }]
            })
            .limit(limit * 3)
            .toArray();

            // Score results based on keyword matches
            const scoredResults = results.map(doc => {
                const text = doc.chunkText?.toLowerCase() || '';
                const url = doc.url?.toLowerCase() || '';
                const title = doc.title?.toLowerCase() || '';
                let matchCount = 0;
                let exactMatchBonus = 0;
                let urlBonus = 0;

                keywords.forEach(kw => {
                    const kwLower = kw.toLowerCase();
                    if (text.includes(kwLower)) {
                        matchCount++;
                        // Bonus for exact phrase match
                        if (query.toLowerCase().includes(kw + ' ') || query.toLowerCase().includes(' ' + kw)) {
                            exactMatchBonus += 0.1;
                        }
                    }
                    // Huge bonus if keyword is in URL (e.g., /privacy-policy for "privacy")
                    if (url.includes(kwLower)) {
                        urlBonus += 0.3;
                    }
                    // Bonus if keyword is in title
                    if (title.includes(kwLower)) {
                        exactMatchBonus += 0.05;
                    }
                });

                const score = Math.min(1.0, (matchCount / keywords.length) * 0.5 + exactMatchBonus + urlBonus);

                return {
                    _id: doc._id,
                    url: doc.url,
                    title: doc.title,
                    description: doc.description,
                    contentType: doc.contentType,
                    chunk: doc.chunkText,
                    chunkPosition: doc.position,
                    score: score,
                    pageRank: doc.pageRank || 1,
                    matchCount: matchCount
                };
            });

            // Sort by score and match count
            scoredResults.sort((a, b) => {
                if (Math.abs(a.score - b.score) > 0.1) {
                    return b.score - a.score;
                }
                return b.matchCount - a.matchCount;
            });

            const topResults = scoredResults.slice(0, limit);
            console.log(`[VectorSearch] Keyword search found ${results.length} results, returning top ${topResults.length}`);
            if (topResults.length > 0) {
                console.log(`[VectorSearch] Top result: ${topResults[0].title} (score: ${topResults[0].score.toFixed(2)}, matches: ${topResults[0].matchCount})`);
            }

            // Add rank
            return topResults.map((result, index) => ({
                ...result,
                rank: index + 1
            }));

        } catch (error) {
            console.error('[VectorSearch] Fallback search error:', error);
            return [];
        }
    }

    async fallbackTextSearch(query, brokerId, limit) {
        // This is kept for compatibility but redirects to keyword search
        return this.fallbackKeywordSearch(query, brokerId, limit);
    }

    postProcessResults(results, limit) {
        // Group by URL and keep best chunk per page
        const groupedByUrl = {};

        results.forEach(result => {
            if (!groupedByUrl[result.url] || groupedByUrl[result.url].score < result.score) {
                groupedByUrl[result.url] = result;
            }
        });

        // Convert back to array and sort
        const uniqueResults = Object.values(groupedByUrl)
            .sort((a, b) => {
                // Sort by score, then by pageRank
                const scoreDiff = b.score - a.score;
                if (Math.abs(scoreDiff) > 0.01) {
                    return scoreDiff;
                }
                return (b.pageRank || 0) - (a.pageRank || 0);
            })
            .slice(0, limit);

        // Add ranking position
        return uniqueResults.map((result, index) => ({
            ...result,
            rank: index + 1
        }));
    }

    combineResults(vectorResults, textResults, weights) {
        const combined = new Map();

        // Add vector results
        vectorResults.forEach(result => {
            const key = result.url || result._id.toString();
            combined.set(key, {
                ...result,
                combinedScore: result.score * weights.vector,
                sources: ['vector']
            });
        });

        // Add or update with text results
        textResults.forEach(result => {
            const key = result.url || result._id.toString();
            if (combined.has(key)) {
                const existing = combined.get(key);
                existing.combinedScore += result.score * weights.text;
                existing.sources.push('text');
            } else {
                combined.set(key, {
                    ...result,
                    combinedScore: result.score * weights.text,
                    sources: ['text']
                });
            }
        });

        // Sort by combined score
        return Array.from(combined.values())
            .sort((a, b) => b.combinedScore - a.combinedScore);
    }

    async semanticSearch(query, brokerId, options = {}) {
        // Advanced semantic search with query expansion
        const { expandQuery = true, contextWindow = 2 } = options;

        let searchQuery = query;

        if (expandQuery) {
            // Expand query with synonyms or related terms
            searchQuery = await this.expandQuery(query);
        }

        const results = await this.search(searchQuery, brokerId, options);

        // Add context from surrounding chunks
        if (contextWindow > 0) {
            return this.addContext(results, contextWindow);
        }

        return results;
    }

    async expandQuery(query) {
        // Simple query expansion (can be enhanced with synonyms API)
        const expansions = {
            'password reset': 'password reset recover forgot change',
            'pricing': 'pricing cost price fee payment subscription',
            'features': 'features capabilities functionality benefits',
            'support': 'support help assistance contact customer service',
            'documentation': 'documentation docs guide manual tutorial'
        };

        const lowerQuery = query.toLowerCase();
        for (const [key, value] of Object.entries(expansions)) {
            if (lowerQuery.includes(key)) {
                return `${query} ${value}`;
            }
        }

        return query;
    }

    async addContext(results, contextWindow) {
        // Add surrounding chunks as context
        const db = database.getDb();
        const collection = db.collection('content');

        const enhancedResults = [];

        for (const result of results) {
            const contextChunks = await collection.findOne(
                { _id: result._id },
                {
                    projection: {
                        chunks: {
                            $slice: [
                                Math.max(0, result.chunkPosition - contextWindow),
                                contextWindow * 2 + 1
                            ]
                        }
                    }
                }
            );

            enhancedResults.push({
                ...result,
                context: contextChunks?.chunks.map(c => c.text).join(' ') || result.chunk
            });
        }

        return enhancedResults;
    }

    getCacheKey(query, brokerId, filters = {}) {
        const crypto = require('crypto');
        const key = `${brokerId}:${query}:${JSON.stringify(filters)}`;
        return crypto.createHash('md5').update(key).digest('hex');
    }
}

module.exports = VectorSearchService;