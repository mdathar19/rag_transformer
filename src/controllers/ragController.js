const VectorSearchService = require('../services/vectorSearch');
const RAGPipeline = require('../services/ragPipeline');
const EmbeddingService = require('../services/embeddingService');
const cacheService = require('../services/cacheService');
const clientManager = require('../services/clientManager');
const database = require('../config/database');

class RAGController {
    constructor() {
        this.embeddingService = new EmbeddingService(cacheService);
        this.vectorSearch = new VectorSearchService(this.embeddingService, cacheService);
        this.ragPipeline = new RAGPipeline(this.vectorSearch, cacheService);
    }

    async processQuery(brokerId, query, options = {}) {
        // Validate client
        const client = await clientManager.getClient(brokerId);
        if (!client || client.status !== 'active') {
            throw new Error('Invalid or inactive client');
        }

        // Update usage stats
        await clientManager.updateUsage(brokerId, 'apiCalls', 1);

        // Generate answer
        const result = await this.ragPipeline.generateAnswer(query, brokerId, options);

        // Update usage stats
        await clientManager.updateUsage(brokerId, 'questionsAnswered', 1);

        return result;
    }

    async streamQuery(brokerId, query, options, res) {
        // Validate client
        const client = await clientManager.getClient(brokerId);
        if (!client || client.status !== 'active') {
            throw new Error('Invalid or inactive client');
        }

        // Update usage stats
        await clientManager.updateUsage(brokerId, 'apiCalls', 1);

        // Get streaming response
        const { stream, sources } = await this.ragPipeline.streamAnswer(query, brokerId, options);

        // Send sources first
        res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

        // Stream the answer
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
            }
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

        // Update usage stats
        await clientManager.updateUsage(brokerId, 'questionsAnswered', 1);
    }

    async search(brokerId, query, options = {}) {
        // Validate client
        const client = await clientManager.getClient(brokerId);
        if (!client || client.status !== 'active') {
            throw new Error('Invalid or inactive client');
        }

        // Perform search without AI generation
        const results = await this.vectorSearch.hybridSearch(query, brokerId, options);

        return {
            query,
            results: results.map(r => ({
                url: r.url,
                title: r.title,
                description: r.description,
                snippet: r.chunk || r.content,
                score: r.score,
                contentType: r.contentType
            })),
            totalResults: results.length,
            timestamp: new Date()
        };
    }

    async submitFeedback({ brokerId, queryId, helpful, rating, comment }) {
        const db = database.getDb();

        // Update query log with feedback
        await db.collection('query_logs').updateOne(
            { _id: queryId, brokerId },
            {
                $set: {
                    feedback: {
                        helpful,
                        rating,
                        comment,
                        submittedAt: new Date()
                    }
                }
            }
        );

        // If negative feedback, log for improvement
        if (!helpful || rating < 3) {
            await db.collection('feedback_issues').insertOne({
                brokerId,
                queryId,
                helpful,
                rating,
                comment,
                createdAt: new Date(),
                status: 'pending'
            });
        }
    }

    async getContent(brokerId, options = {}) {
        const { page = 1, limit = 10, search } = options;
        const db = database.getDb();

        const query = { brokerId };
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { url: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [content, total] = await Promise.all([
            db.collection('content')
                .find(query)
                .project({
                    url: 1,
                    title: 1,
                    description: 1,
                    contentType: 1,
                    totalChunks: 1,
                    lastUpdated: 1
                })
                .sort({ lastUpdated: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('content').countDocuments(query)
        ]);

        return {
            content,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async deleteContent(brokerId, contentId) {
        const db = database.getDb();

        const result = await db.collection('content').deleteOne({
            _id: contentId,
            brokerId
        });

        if (result.deletedCount === 0) {
            throw new Error('Content not found or unauthorized');
        }

        // Invalidate cache
        await cacheService.invalidateBroker(brokerId);
    }

    async clearCache(brokerId) {
        if (brokerId) {
            await cacheService.invalidateBroker(brokerId);
        } else {
            await cacheService.flush();
        }
    }

    async getCacheStats() {
        return cacheService.getStats();
    }

    async getAnalytics(brokerId, options = {}) {
        const db = database.getDb();
        const { startDate, endDate } = options;

        const query = { brokerId };
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Get query analytics
        const queryStats = await db.collection('query_logs').aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalQueries: { $sum: 1 },
                    avgResponseTime: { $avg: '$responseTime' },
                    cachedQueries: {
                        $sum: { $cond: ['$cached', 1, 0] }
                    }
                }
            }
        ]).toArray();

        // Get popular queries
        const popularQueries = await db.collection('query_logs').aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$query',
                    count: { $sum: 1 },
                    avgResponseTime: { $avg: '$responseTime' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Get feedback stats
        const feedbackStats = await db.collection('query_logs').aggregate([
            { $match: { ...query, feedback: { $exists: true } } },
            {
                $group: {
                    _id: null,
                    totalFeedback: { $sum: 1 },
                    helpful: {
                        $sum: { $cond: ['$feedback.helpful', 1, 0] }
                    },
                    avgRating: { $avg: '$feedback.rating' }
                }
            }
        ]).toArray();

        // Get daily usage
        const dailyUsage = await db.collection('query_logs').aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    queries: { $sum: 1 },
                    avgResponseTime: { $avg: '$responseTime' }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 30 }
        ]).toArray();

        return {
            overview: queryStats[0] || {
                totalQueries: 0,
                avgResponseTime: 0,
                cachedQueries: 0
            },
            popularQueries: popularQueries.map(q => ({
                query: q._id,
                count: q.count,
                avgResponseTime: Math.round(q.avgResponseTime)
            })),
            feedback: feedbackStats[0] || {
                totalFeedback: 0,
                helpful: 0,
                avgRating: 0
            },
            dailyUsage: dailyUsage.map(d => ({
                date: d._id,
                queries: d.queries,
                avgResponseTime: Math.round(d.avgResponseTime)
            })),
            cacheHitRate: cacheService.getStats().hitRate
        };
    }
}

module.exports = new RAGController();