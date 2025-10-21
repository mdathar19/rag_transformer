const WebScraperSimple = require('../services/webScraperSimple');
const ContentProcessor = require('../services/contentProcessor');
const EmbeddingService = require('../services/embeddingService');
const database = require('../config/database');
const clientManager = require('../services/clientManager');
const cacheService = require('../services/cacheService');
const logStreamService = require('../services/logStreamService');

class CrawlerController {
    constructor() {
        this.scraper = new WebScraperSimple();
        this.processor = new ContentProcessor();
        this.embeddingService = new EmbeddingService(cacheService);
        this.activeJobs = new Map();
    }

    async startCrawl(brokerId, options = {}) {
        // Get client configuration
        const client = await clientManager.getClient(brokerId);

        if (!client) {
            throw new Error(`Client ${brokerId} not found`);
        }

        // Create crawl job
        const jobId = this.generateJobId();
        const job = {
            _id: jobId,
            brokerId,
            domain: client.domain,
            status: 'running',
            type: options.type || 'full',
            urls: options.urls || [],
            progress: {
                totalPages: 0,
                crawledPages: 0,
                failedPages: 0,
                newPages: 0,
                updatedPages: 0
            },
            errors: [],
            startedAt: new Date(),
            completedAt: null,
            duration: null,
            stats: {
                bytesDownloaded: 0,
                embeddingsCreated: 0,
                averagePageTime: 0
            }
        };

        // Store job in database
        const db = database.getDb();
        await db.collection('crawl_jobs').insertOne(job);

        // Start crawling in background
        this.executeCrawl(jobId, client, options).catch(error => {
            console.error(`[Crawler] Job ${jobId} failed:`, error);
            this.updateJobStatus(jobId, 'failed', { error: error.message });
        });

        return jobId;
    }

    log(jobId, message, level = 'info') {
        console.log(message);
        logStreamService.addLog(jobId, message, level);
    }

    async executeCrawl(jobId, client, options) {
        const startTime = Date.now();

        try {
            this.log(jobId, `[Crawler] Starting crawl job ${jobId} for ${client.name}`);

            const allPages = [];
            const allErrors = [];

            // Check if client has multiple domains
            const domainsToCrawl = client.domains && client.domains.length > 0 ? client.domains : [{
                url: client.domain || client.baseUrl,
                type: 'main',
                specificPages: options.urls || [],
                crawlSettings: {}
            }];

            // Crawl each domain
            for (const domainConfig of domainsToCrawl) {
                this.log(jobId, `[Crawler] Crawling domain: ${domainConfig.url}`);

                // Merge crawl settings
                const domainCrawlSettings = {
                    ...client.crawlSettings,
                    ...domainConfig.crawlSettings,
                    ...options
                };

                // If specific pages are provided, crawl only those
                if (domainConfig.specificPages && domainConfig.specificPages.length > 0) {
                    for (const pageUrl of domainConfig.specificPages) {
                        try {
                            const pageData = await this.scraper.scrapePage(
                                pageUrl,
                                domainConfig.url,
                                client.brokerId
                            );
                            if (pageData) {
                                allPages.push(pageData);
                            }
                        } catch (error) {
                            this.log(jobId, `[Crawler] Error crawling specific page ${pageUrl}: ${error.message}`, 'error');
                            allErrors.push({ url: pageUrl, error: error.message });
                        }
                    }
                } else {
                    // Crawl entire domain
                    this.log(jobId, `[Crawler] Starting full website crawl with maxPages=${domainCrawlSettings.maxPages || 100}`);
                    const crawlResult = await this.scraper.crawlWebsite(
                        domainConfig.url,
                        client.brokerId,
                        domainCrawlSettings,
                        jobId  // Pass jobId for logging
                    );
                    allPages.push(...crawlResult.pages);
                    allErrors.push(...crawlResult.errors);
                    this.log(jobId, `[Crawler] Domain crawl completed: ${crawlResult.pages.length} pages found`);
                }
            }

            // Process and store content
            this.log(jobId, `[Crawler] Processing ${allPages.length} pages...`);
            const processedPages = await this.processAndStoreContent(
                allPages,
                client.brokerId,
                jobId
            );
            this.log(jobId, `[Crawler] Successfully processed ${processedPages.length} pages`);

            // Update client status
            await clientManager.updateCrawlStatus(
                client.brokerId,
                'completed',
                { totalPages: processedPages.length }
            );

            // Invalidate cache for this broker
            await cacheService.invalidateBroker(client.brokerId);

            // Update job status
            const duration = Math.round((Date.now() - startTime) / 1000);
            await this.updateJobStatus(jobId, 'completed', {
                progress: {
                    totalPages: allPages.length,
                    crawledPages: processedPages.length,
                    failedPages: allErrors.length,
                    newPages: processedPages.filter(p => p.isNew).length,
                    updatedPages: processedPages.filter(p => !p.isNew).length
                },
                completedAt: new Date(),
                duration,
                stats: {
                    bytesDownloaded: this.calculateBytes(allPages),
                    embeddingsCreated: processedPages.reduce((sum, p) => sum + (p.chunks?.length || 0), 0),
                    averagePageTime: duration / processedPages.length
                }
            });

            this.log(jobId, `[Crawler] ✓ Completed job ${jobId}. Processed ${processedPages.length} pages in ${duration}s`, 'success');

            // Close log stream after completion
            setTimeout(() => logStreamService.closeAllClients(jobId), 2000);

        } catch (error) {
            this.log(jobId, `[Crawler] ✗ Error in job ${jobId}: ${error.message}`, 'error');
            await this.updateJobStatus(jobId, 'failed', {
                error: error.message,
                completedAt: new Date(),
                duration: Math.round((Date.now() - startTime) / 1000)
            });
            throw error;
        } finally {
            await this.scraper.close();
        }
    }

    async processAndStoreContent(pages, brokerId, jobId) {
        const db = database.getDb();
        const contentCollection = db.collection('content');
        const contentChunksCollection = db.collection('content_chunks');
        const processedPages = [];

        console.log(`[Crawler] Processing ${pages.length} pages for broker ${brokerId}`);

        for (const pageData of pages) {
            try {
                // Process content (clean, chunk, etc.)
                const processedContent = this.processor.processContent(pageData);

                // Generate embeddings for chunks
                const contentWithEmbeddings = await this.embeddingService.processContentForEmbeddings(
                    processedContent,
                    brokerId
                );

                // Check if content exists
                const existingContent = await contentCollection.findOne({
                    brokerId,
                    url: pageData.url
                });

                let isNew = !existingContent;
                let contentId;

                if (existingContent) {
                    // Update if content has changed
                    if (existingContent.hash !== pageData.hash) {
                        // Delete old chunks from content_chunks collection
                        await contentChunksCollection.deleteMany({
                            contentId: existingContent._id
                        });

                        await contentCollection.replaceOne(
                            { brokerId, url: pageData.url },
                            {
                                ...contentWithEmbeddings,
                                brokerId,
                                lastUpdated: new Date()
                            }
                        );
                        contentId = existingContent._id;
                        console.log(`[Crawler] Updated content: ${pageData.url}`);
                    } else {
                        console.log(`[Crawler] Skipped unchanged: ${pageData.url}`);
                        continue;
                    }
                } else {
                    // Insert new content
                    const insertResult = await contentCollection.insertOne({
                        ...contentWithEmbeddings,
                        brokerId,
                        createdAt: new Date(),
                        lastUpdated: new Date()
                    });
                    contentId = insertResult.insertedId;
                    console.log(`[Crawler] Added new content: ${pageData.url}`);
                }

                // Now save chunks to content_chunks collection
                if (contentWithEmbeddings.chunks && contentWithEmbeddings.chunks.length > 0) {
                    const chunkDocuments = contentWithEmbeddings.chunks.map((chunk, index) => ({
                        // Reference to parent document
                        contentId: contentId,
                        brokerId: brokerId,
                        url: pageData.url,
                        title: contentWithEmbeddings.title,
                        description: contentWithEmbeddings.description,
                        contentType: contentWithEmbeddings.contentType,
                        status: contentWithEmbeddings.status || 'active',
                        pageRank: contentWithEmbeddings.pageRank || 1,

                        // Chunk specific data
                        chunkIndex: index,
                        chunkText: chunk.text,
                        embedding: chunk.embedding,
                        position: chunk.position,

                        // Metadata
                        crawledAt: contentWithEmbeddings.crawledAt || new Date(),
                        createdAt: new Date()
                    }));

                    // Insert chunks in batch
                    await contentChunksCollection.insertMany(chunkDocuments);
                    console.log(`[Crawler] Saved ${chunkDocuments.length} chunks for ${pageData.url}`);
                }

                processedPages.push({ ...contentWithEmbeddings, isNew });

            } catch (error) {
                console.error(`[Crawler] Error processing ${pageData.url}:`, error.message);
                await this.logJobError(jobId, pageData.url, error.message);
            }
        }

        // Update usage stats
        const totalEmbeddings = processedPages.reduce((sum, p) => sum + (p.chunks?.length || 0), 0);
        await clientManager.updateUsage(brokerId, 'embeddingsGenerated', totalEmbeddings);

        return processedPages;
    }

    async getCrawlStatus(jobId) {
        const db = database.getDb();
        const job = await db.collection('crawl_jobs').findOne({ _id: jobId });

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        return job;
    }

    async batchCrawl(brokerIds) {
        const jobs = [];

        for (const brokerId of brokerIds) {
            try {
                const jobId = await this.startCrawl(brokerId);
                jobs.push({ brokerId, jobId, status: 'started' });
            } catch (error) {
                jobs.push({ brokerId, status: 'failed', error: error.message });
            }
        }

        return jobs;
    }

    async updateJobStatus(jobId, status, updates = {}) {
        const db = database.getDb();
        await db.collection('crawl_jobs').updateOne(
            { _id: jobId },
            {
                $set: {
                    status,
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );
    }

    async logJobError(jobId, url, error) {
        const db = database.getDb();
        await db.collection('crawl_jobs').updateOne(
            { _id: jobId },
            {
                $push: {
                    errors: {
                        url,
                        error,
                        timestamp: new Date()
                    }
                }
            }
        );
    }

    calculateBytes(pages) {
        return pages.reduce((sum, page) => {
            const content = page.content || '';
            const chunks = page.chunks || [];
            const totalText = content + chunks.map(c => c.text).join('');
            return sum + Buffer.byteLength(totalText, 'utf8');
        }, 0);
    }

    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    async getActiveJobs() {
        const db = database.getDb();
        return db.collection('crawl_jobs').find({
            status: 'running'
        }).toArray();
    }

    async getJobHistory(brokerId, limit = 10) {
        const db = database.getDb();
        return db.collection('crawl_jobs')
            .find({ brokerId })
            .sort({ startedAt: -1 })
            .limit(limit)
            .toArray();
    }
}

module.exports = new CrawlerController();