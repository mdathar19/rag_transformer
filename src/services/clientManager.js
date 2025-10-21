const database = require('../config/database');
const crypto = require('crypto');

class ClientManager {
    constructor() {
        this.collection = null;
    }

    async initialize() {
        const db = database.getDb();
        this.collection = db.collection('clients');
        console.log('[ClientManager] Initialized');
    }

    async createClient(clientData) {
        const {
            name,
            domain,
            domains, // New: support for multiple domains
            crawlSettings = {},
            metadata = {},
            owner, // User's brokerId who created this website
            ownerEmail // User's email who created this website
        } = clientData;

        // Generate unique broker ID if not provided
        const brokerId = clientData.brokerId || this.generateBrokerId(name);

        // Handle both single domain (legacy) and multiple domains
        let domainsList = domains || [];

        // Filter out empty domains
        domainsList = domainsList.filter(d => d.url && d.url.trim() !== '');

        // If no valid domains in array but we have baseUrl or domain, use that
        if (domainsList.length === 0 && (clientData.baseUrl || domain)) {
            const urlToUse = clientData.baseUrl || domain;
            domainsList = [{
                url: urlToUse.startsWith('http') ? urlToUse : `https://${urlToUse}`,
                type: 'main',
                specificPages: clientData.specificPages || [],
                crawlSettings: {}
            }];
        }

        // Prepare base URL and primary domain
        // IMPORTANT: Use explicitly provided baseUrl and domain first, don't override with domains array
        const baseUrl = clientData.baseUrl
            ? (clientData.baseUrl.startsWith('http') ? clientData.baseUrl : `https://${clientData.baseUrl}`)
            : (domain
                ? (domain.startsWith('http') ? domain : `https://${domain}`)
                : (domainsList[0]?.url || ''));

        const primaryDomain = domain || clientData.baseUrl || domainsList[0]?.url || '';

        const client = {
            brokerId,
            name,
            domain: primaryDomain, // Keep for backward compatibility
            domains: domainsList,
            baseUrl,
            owner: owner || null, // User's brokerId who owns this website
            ownerEmail: ownerEmail || null, // User's email who owns this website
            crawlSettings: {
                maxPages: crawlSettings.maxPages || 100,
                crawlDelay: crawlSettings.crawlDelay || 1000,
                respectRobots: crawlSettings.respectRobots !== false,
                allowedPaths: crawlSettings.allowedPaths || [],
                excludedPaths: crawlSettings.excludedPaths || ['/admin', '/api', '/private'],
                userAgent: crawlSettings.userAgent || 'RAG-Bot/1.0'
            },
            metadata: {
                industry: metadata.industry || '',
                description: metadata.description || '',
                tags: metadata.tags || []
            },
            status: 'active',
            lastCrawl: null,
            nextScheduledCrawl: null,
            contentCount: 0,
            usage: {
                apiCalls: 0,
                embeddingsGenerated: 0,
                questionsAnswered: 0
            },
            noDataResponse: metadata.noDataResponse || null, // Custom response when no data found
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            await this.collection.insertOne(client);
            console.log(`[ClientManager] Created client: ${name} (${brokerId})`);
            return client;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error(`Client with broker ID ${brokerId} already exists`);
            }
            throw error;
        }
    }

    async getClient(brokerId) {
        const client = await this.collection.findOne({ brokerId });
        if (!client) {
            throw new Error(`Client with broker ID ${brokerId} not found`);
        }
        return client;
    }

    async updateClient(brokerId, updates) {
        const allowedUpdates = [
            'name', 'domain', 'domains', 'baseUrl', 'crawlSettings',
            'metadata', 'status', 'nextScheduledCrawl', 'noDataResponse'
        ];

        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }

        updateData.updatedAt = new Date();

        const result = await this.collection.updateOne(
            { brokerId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            throw new Error(`Client with broker ID ${brokerId} not found`);
        }

        return this.getClient(brokerId);
    }

    async deleteClient(brokerId) {
        // Delete all related data
        const db = database.getDb();

        // Start a transaction
        const session = database.client.startSession();

        try {
            await session.withTransaction(async () => {
                // Delete client
                await this.collection.deleteOne({ brokerId }, { session });

                // Delete content
                await db.collection('content').deleteMany({ brokerId }, { session });

                // Delete query logs
                await db.collection('query_logs').deleteMany({ brokerId }, { session });

                // Delete crawl jobs
                await db.collection('crawl_jobs').deleteMany({ brokerId }, { session });
            });

            console.log(`[ClientManager] Deleted client and all related data: ${brokerId}`);
            return true;
        } finally {
            await session.endSession();
        }
    }

    async listClients(filters = {}, options = {}) {
        const {
            status,
            industry,
            search,
            owner // Filter by owner (user's brokerId)
        } = filters;

        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = -1
        } = options;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (industry) {
            query['metadata.industry'] = industry;
        }

        if (owner) {
            // Filter by owner - only show websites belonging to this user
            query.owner = owner;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } },
                { brokerId: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [clients, total] = await Promise.all([
            this.collection
                .find(query)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.collection.countDocuments(query)
        ]);

        // Enrich clients with real-time content count from database
        const db = database.getDb();
        const enrichedClients = await Promise.all(clients.map(async (client) => {
            const contentCount = await db.collection('content').countDocuments({ brokerId: client.brokerId });
            return {
                ...client,
                contentCount: contentCount
            };
        }));

        return {
            clients: enrichedClients,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getClientStats(brokerId) {
        const db = database.getDb();

        const [client, contentCount, queryCount, lastQueries] = await Promise.all([
            this.getClient(brokerId),
            db.collection('content').countDocuments({ brokerId }),
            db.collection('query_logs').countDocuments({ brokerId }),
            db.collection('query_logs')
                .find({ brokerId })
                .sort({ timestamp: -1 })
                .limit(10)
                .toArray()
        ]);

        // Calculate storage size (approximate)
        const contentStats = await db.collection('content').aggregate([
            { $match: { brokerId } },
            {
                $group: {
                    _id: null,
                    totalChunks: { $sum: { $size: '$chunks' } },
                    avgChunksPerPage: { $avg: { $size: '$chunks' } }
                }
            }
        ]).toArray();

        return {
            client,
            stats: {
                contentPages: contentCount,
                totalChunks: contentStats[0]?.totalChunks || 0,
                avgChunksPerPage: Math.round(contentStats[0]?.avgChunksPerPage || 0),
                totalQueries: queryCount,
                apiCallsToday: await this.getApiCallsToday(brokerId),
                lastCrawl: client.lastCrawl,
                status: client.status
            },
            recentQueries: lastQueries.map(q => ({
                query: q.query,
                timestamp: q.timestamp,
                responseTime: q.responseTime,
                cached: q.cached
            }))
        };
    }

    async updateUsage(brokerId, usageType, increment = 1) {
        const updateField = `usage.${usageType}`;

        await this.collection.updateOne(
            { brokerId },
            {
                $inc: { [updateField]: increment },
                $set: { updatedAt: new Date() }
            }
        );
    }

    async updateCrawlStatus(brokerId, status, stats = null) {
        const updates = {
            lastCrawl: new Date(),
            updatedAt: new Date()
        };

        if (stats) {
            updates.contentCount = stats.totalPages || 0;
        }

        if (status === 'completed') {
            // Schedule next crawl (e.g., in 7 days)
            const nextCrawl = new Date();
            nextCrawl.setDate(nextCrawl.getDate() + 7);
            updates.nextScheduledCrawl = nextCrawl;
        }

        await this.collection.updateOne(
            { brokerId },
            { $set: updates }
        );
    }

    async getApiCallsToday(brokerId) {
        const db = database.getDb();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await db.collection('query_logs').countDocuments({
            brokerId,
            timestamp: { $gte: today }
        });

        return count;
    }

    generateBrokerId(name) {
        const prefix = name.substring(0, 4).toUpperCase();
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(2).toString('hex').toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    async validateApiKey(apiKey) {
        // In a production system, you'd have a separate API keys collection
        // For now, we'll use the brokerId as the API key
        const client = await this.collection.findOne({ brokerId: apiKey });
        return client && client.status === 'active';
    }

    async getClientByDomain(domain) {
        const client = await this.collection.findOne({ domain });
        return client;
    }

    async getClientsForCrawl() {
        const now = new Date();

        const clients = await this.collection.find({
            status: 'active',
            $or: [
                { lastCrawl: null },
                { nextScheduledCrawl: { $lte: now } }
            ]
        }).toArray();

        return clients;
    }
}

// Singleton instance
const clientManager = new ClientManager();

module.exports = clientManager;