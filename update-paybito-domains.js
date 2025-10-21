const axios = require('axios');

async function updatePaybitoDomains() {
    const API_URL = 'http://localhost:3000/api/v1';
    const API_KEY = 'PAYB18022021121103';

    const updateData = {
        domains: [
            {
                url: "https://www.paybito.com",
                type: "main",
                crawlSettings: {
                    maxPages: 50,
                    excludedPaths: ["/blog", "/wp-admin", "/admin", "/private"]
                }
            },
            {
                url: "https://launch-platform.paybito.com",
                type: "marketing",
                specificPages: [
                    "https://launch-platform.paybito.com",
                    "https://launch-platform.paybito.com/build-your-exchange.html",
                    "https://launch-platform.paybito.com/my-settlement.html",
                    "https://launch-platform.paybito.com/features.html",
                    "https://launch-platform.paybito.com/pricing.html"
                ]
            }
        ],
        crawlSettings: {
            maxPages: 100,
            crawlDelay: 1500,
            respectRobots: true,
            userAgent: "PaybitoBot/1.0 (RAG Content Indexer)"
        },
        metadata: {
            industry: "Cryptocurrency Exchange",
            description: "Full-service cryptocurrency exchange and white-label platform provider",
            tags: ["crypto", "exchange", "trading", "bitcoin", "white-label", "algorithmic-trading", "DeFi", "blockchain"]
        }
    };

    try {
        console.log('Updating Paybito client with multiple domains...');

        const response = await axios.put(
            `${API_URL}/clients/${API_KEY}`,
            updateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                }
            }
        );

        console.log('✅ Client updated successfully!');
        console.log('Client details:', JSON.stringify(response.data.data, null, 2));

        // Now start a crawl
        console.log('\n📋 Starting crawl for all domains...');

        const crawlResponse = await axios.post(
            `${API_URL}/crawl`,
            {
                brokerId: API_KEY,
                options: {
                    type: 'full',
                    maxPages: 100
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                }
            }
        );

        console.log('✅ Crawl job started!');
        console.log('Job ID:', crawlResponse.data.data.jobId);
        console.log('\nMonitor progress at: http://localhost:3000/api/v1/crawl/' + crawlResponse.data.data.jobId + '/status');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

updatePaybitoDomains();