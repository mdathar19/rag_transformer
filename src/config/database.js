const { MongoClient } = require('mongodb');
require('dotenv').config();

class Database {
    constructor() {
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            if (this.client && this.client.topology && this.client.topology.isConnected()) {
                return this.db;
            }

            this.client = new MongoClient(process.env.MONGODB_URI, {
                maxPoolSize: 50,
                minPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
            });

            await this.client.connect();
            this.db = this.client.db('brain_platform');

            console.log('[Database] Connected to MongoDB Atlas successfully');

            // Create indexes
            await this.createIndexes();

            return this.db;
        } catch (error) {
            console.error('[Database] Connection error:', error.message);
            throw error;
        }
    }

    async createIndexes() {
        try {
            // Clients collection indexes
            const clientsCollection = this.db.collection('clients');
            await clientsCollection.createIndex({ brokerId: 1 }, { unique: true });
            await clientsCollection.createIndex({ domain: 1 });
            await clientsCollection.createIndex({ createdAt: -1 });

            // Content collection indexes
            const contentCollection = this.db.collection('content');
            await contentCollection.createIndex({ brokerId: 1, url: 1 }, { unique: true });
            await contentCollection.createIndex({ brokerId: 1, lastUpdated: -1 });
            await contentCollection.createIndex({
                title: 'text',
                content: 'text',
                description: 'text'
            });

            // Content chunks collection indexes
            const contentChunksCollection = this.db.collection('content_chunks');
            await contentChunksCollection.createIndex({ brokerId: 1 });
            await contentChunksCollection.createIndex({ contentId: 1 });
            await contentChunksCollection.createIndex({ brokerId: 1, url: 1 });
            await contentChunksCollection.createIndex({
                chunkText: 'text',
                title: 'text'
            });

            // Query logs collection indexes
            const queryLogsCollection = this.db.collection('query_logs');
            await queryLogsCollection.createIndex({ brokerId: 1, timestamp: -1 });
            await queryLogsCollection.createIndex({ timestamp: -1 });

            // Crawl jobs collection indexes
            const crawlJobsCollection = this.db.collection('crawl_jobs');
            await crawlJobsCollection.createIndex({ brokerId: 1, status: 1 });
            await crawlJobsCollection.createIndex({ scheduledAt: 1 });

            console.log('[Database] Indexes created successfully');
        } catch (error) {
            console.error('[Database] Error creating indexes:', error.message);
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('[Database] Disconnected from MongoDB');
        }
    }

    getDb() {
        if (!this.db) {
            throw new Error('Database not initialized. Call connect() first.');
        }
        return this.db;
    }

    getCollection(name) {
        return this.getDb().collection(name);
    }
}

// Singleton instance
const database = new Database();

module.exports = database;