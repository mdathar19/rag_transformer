// Client Schema
const clientSchema = {
    brokerId: String, // Unique identifier (e.g., PAYB18022021121103)
    name: String,
    domain: String, // Primary domain (legacy support)
    domains: [{ // Multiple domains support
        url: String, // e.g., https://www.paybito.com
        type: String, // main, subdomain, marketing, documentation
        specificPages: [String], // Optional: specific pages to crawl
        crawlSettings: { // Domain-specific settings (optional)
            maxPages: Number,
            allowedPaths: [String],
            excludedPaths: [String]
        }
    }],
    baseUrl: String, // Primary URL (legacy support)
    crawlSettings: {
        maxPages: Number,
        crawlDelay: Number, // ms between requests
        respectRobots: Boolean,
        allowedPaths: [String],
        excludedPaths: [String],
        userAgent: String
    },
    metadata: {
        industry: String,
        description: String,
        tags: [String]
    },
    status: String, // active, suspended, pending
    lastCrawl: Date,
    nextScheduledCrawl: Date,
    contentCount: Number,
    usage: {
        apiCalls: Number,
        embeddingsGenerated: Number,
        questionsAnswered: Number
    },
    createdAt: Date,
    updatedAt: Date
};

// Content Schema
const contentSchema = {
    brokerId: String,
    url: String,
    domain: String,
    path: String,
    title: String,
    description: String,
    content: String, // Clean text content
    contentType: String, // page, article, product, etc.
    chunks: [
        {
            text: String,
            embedding: [Number], // 1536 dimensions for OpenAI
            tokens: Number,
            position: Number
        }
    ],
    metadata: {
        author: String,
        publishDate: Date,
        lastModified: Date,
        language: String,
        keywords: [String],
        headings: [String],
        images: [String],
        links: {
            internal: Number,
            external: Number
        }
    },
    pageRank: Number, // Importance score
    crawledAt: Date,
    lastUpdated: Date,
    hash: String // Content hash to detect changes
};

// Query Log Schema
const queryLogSchema = {
    brokerId: String,
    query: String,
    queryEmbedding: [Number],
    results: [
        {
            contentId: String,
            url: String,
            title: String,
            score: Number,
            chunk: String
        }
    ],
    answer: String,
    responseTime: Number, // ms
    tokensUsed: {
        prompt: Number,
        completion: Number,
        embedding: Number
    },
    feedback: {
        helpful: Boolean,
        rating: Number,
        comment: String
    },
    metadata: {
        ip: String,
        userAgent: String,
        sessionId: String
    },
    cached: Boolean,
    timestamp: Date
};

// Crawl Job Schema
const crawlJobSchema = {
    brokerId: String,
    domain: String,
    status: String, // pending, running, completed, failed
    type: String, // full, incremental, specific
    urls: [String], // Specific URLs if type is 'specific'
    progress: {
        totalPages: Number,
        crawledPages: Number,
        failedPages: Number,
        newPages: Number,
        updatedPages: Number
    },
    errors: [
        {
            url: String,
            error: String,
            timestamp: Date
        }
    ],
    startedAt: Date,
    completedAt: Date,
    scheduledAt: Date,
    duration: Number, // seconds
    stats: {
        bytesDownloaded: Number,
        embeddingsCreated: Number,
        averagePageTime: Number
    }
};

// User Schema (Multi-tenant company layer)
const userSchema = {
    email: String, // Unique email for login
    password: String, // Hashed password
    companyName: String, // Company name
    brokerId: String, // Unique broker ID for this company/user
    userType: String, // 'ADMIN' or 'USER'
    status: String, // 'active', 'suspended', 'pending'
    profile: {
        firstName: String,
        lastName: String,
        phone: String,
        address: String
    },
    subscription: {
        plan: String, // 'free', 'basic', 'premium', 'enterprise'
        startDate: Date,
        endDate: Date,
        maxClients: Number, // Max number of clients this user can create
        maxApiCalls: Number // Monthly API call limit
    },
    clients: [String], // Array of client broker IDs owned by this user
    apiKeys: [{
        key: String,
        name: String,
        createdAt: Date,
        lastUsed: Date,
        expiresAt: Date
    }],
    lastLogin: Date,
    createdAt: Date,
    updatedAt: Date
};

// Cache Schema (for Redis structure reference)
const cacheSchema = {
    queries: {
        key: 'query:{brokerId}:{queryHash}',
        value: {
            answer: String,
            sources: Array,
            timestamp: Date
        },
        ttl: 3600 // 1 hour
    },
    embeddings: {
        key: 'embedding:{textHash}',
        value: Array,
        ttl: 86400 // 24 hours
    },
    content: {
        key: 'content:{brokerId}:{urlHash}',
        value: Object,
        ttl: 1800 // 30 minutes
    }
};

module.exports = {
    clientSchema,
    contentSchema,
    queryLogSchema,
    crawlJobSchema,
    userSchema,
    cacheSchema
};