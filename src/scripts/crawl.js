require('dotenv').config();
const database = require('../config/database');
const clientManager = require('../services/clientManager');
const crawlerController = require('../controllers/crawlerController');

async function crawlWebsite(brokerId) {
    try {
        console.log(`Starting crawl for broker: ${brokerId}`);

        // Initialize services
        await database.connect();
        await clientManager.initialize();

        // Start crawl
        const jobId = await crawlerController.startCrawl(brokerId, {
            type: 'full',
            maxPages: 50  // Start with limited pages for testing
        });

        console.log(`Crawl job started: ${jobId}`);

        // Monitor job status
        const checkStatus = async () => {
            const status = await crawlerController.getCrawlStatus(jobId);
            console.log(`Job ${jobId} status: ${status.status}`);

            if (status.progress) {
                console.log(`Progress: ${status.progress.crawledPages}/${status.progress.totalPages} pages`);
            }

            if (status.status === 'completed') {
                console.log('Crawl completed successfully!');
                console.log(`Total pages: ${status.progress.totalPages}`);
                console.log(`Embeddings created: ${status.stats.embeddingsCreated}`);
                console.log(`Duration: ${status.duration} seconds`);
                process.exit(0);
            } else if (status.status === 'failed') {
                console.error('Crawl failed:', status.error);
                process.exit(1);
            } else {
                // Check again in 5 seconds
                setTimeout(checkStatus, 5000);
            }
        };

        // Start monitoring
        setTimeout(checkStatus, 5000);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Get brokerId from command line or use default
const brokerId = process.argv[2] || 'PAYB18022021121103';

crawlWebsite(brokerId);