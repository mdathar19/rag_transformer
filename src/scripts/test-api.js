require('dotenv').config();

const API_URL = 'http://localhost:3000/api/v1';
const API_KEY = 'PAYB18022021121103'; // Default Paybito broker ID

// Test queries
const testQueries = [
    "What is Paybito?",
    "How do I reset my password?",
    "What are the trading fees?",
    "How to deposit cryptocurrency?",
    "What security features does the platform offer?"
];

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        console.error('API call failed:', error.message);
        return { status: 500, data: { error: error.message } };
    }
}

// Test functions
async function testHealth() {
    console.log('\n=== Testing Health Check ===');
    const result = await apiCall('/health');
    console.log('Status:', result.status);
    console.log('Response:', result.data);
}

async function testClientInfo() {
    console.log('\n=== Testing Client Info ===');
    const result = await apiCall(`/clients/${API_KEY}`);
    console.log('Status:', result.status);
    console.log('Client:', result.data.data?.name);
    console.log('Domain:', result.data.data?.domain);
    console.log('Status:', result.data.data?.status);
}

async function testCrawl() {
    console.log('\n=== Starting Crawl Job ===');
    const result = await apiCall('/crawl', 'POST', {
        brokerId: API_KEY,
        options: {
            maxPages: 10,
            type: 'full'
        }
    });
    console.log('Status:', result.status);
    console.log('Job ID:', result.data.data?.jobId);
    return result.data.data?.jobId;
}

async function testQuery(query) {
    console.log(`\n=== Testing Query: "${query}" ===`);
    const startTime = Date.now();

    const result = await apiCall('/query', 'POST', {
        brokerId: API_KEY,
        query: query,
        options: {
            topK: 3,
            minScore: 0.7
        }
    });

    const responseTime = Date.now() - startTime;

    console.log('Status:', result.status);

    if (result.status === 200) {
        console.log('Answer:', result.data.data?.answer?.substring(0, 200) + '...');
        console.log('Sources:', result.data.data?.sources?.length || 0);
        console.log('Confidence:', result.data.data?.confidence);
        console.log('Response Time:', responseTime + 'ms');
    } else {
        console.log('Error:', result.data.error);
    }
}

async function testSearch(query) {
    console.log(`\n=== Testing Search: "${query}" ===`);

    const result = await apiCall('/search', 'POST', {
        brokerId: API_KEY,
        query: query,
        options: {
            limit: 5
        }
    });

    console.log('Status:', result.status);

    if (result.status === 200) {
        console.log('Results found:', result.data.data?.totalResults || 0);
        if (result.data.data?.results) {
            result.data.data.results.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.title} (Score: ${r.score?.toFixed(2)})`);
            });
        }
    } else {
        console.log('Error:', result.data.error);
    }
}

async function testAnalytics() {
    console.log('\n=== Testing Analytics ===');
    const result = await apiCall(`/analytics/${API_KEY}`);
    console.log('Status:', result.status);

    if (result.status === 200) {
        const analytics = result.data.data;
        console.log('Total Queries:', analytics?.overview?.totalQueries || 0);
        console.log('Avg Response Time:', analytics?.overview?.avgResponseTime || 0);
        console.log('Cache Hit Rate:', analytics?.cacheHitRate || '0%');
    }
}

// Main test runner
async function runTests() {
    console.log('========================================');
    console.log('   AI RAG Transformer API Test Suite');
    console.log('========================================');
    console.log(`API URL: ${API_URL}`);
    console.log(`API Key: ${API_KEY}`);

    try {
        // Test health
        await testHealth();

        // Test client info
        await testClientInfo();

        // Test search (without content)
        console.log('\n--- Testing without crawled content ---');
        await testSearch('cryptocurrency trading');

        // Ask to crawl
        console.log('\n========================================');
        console.log('   IMPORTANT: Content needs to be crawled first!');
        console.log('========================================');
        console.log('To crawl the website, run:');
        console.log('  node src/scripts/crawl.js');
        console.log('\nOr use the API to start a crawl job:');

        const response = await promptUser('\nDo you want to start a crawl job now? (y/n): ');

        if (response.toLowerCase() === 'y') {
            const jobId = await testCrawl();
            console.log(`\nCrawl job started with ID: ${jobId}`);
            console.log('Monitor the job status or wait for completion...');
            console.log('This might take several minutes depending on the website size.');

            await promptUser('\nPress Enter to continue with tests after crawling is done...');
        }

        // Test queries
        console.log('\n--- Testing RAG Queries ---');
        for (const query of testQueries.slice(0, 3)) {
            await testQuery(query);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }

        // Test search with content
        console.log('\n--- Testing Search with Content ---');
        await testSearch('trading fees');
        await testSearch('security features');

        // Test analytics
        await testAnalytics();

        console.log('\n========================================');
        console.log('   Test Suite Completed');
        console.log('========================================');

    } catch (error) {
        console.error('\nTest suite failed:', error.message);
        process.exit(1);
    }
}

// Helper to get user input
function promptUser(question) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        readline.question(question, answer => {
            readline.close();
            resolve(answer);
        });
    });
}

// Run tests
runTests();