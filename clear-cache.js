const redis = require('redis');

async function clearCache() {
    const client = redis.createClient({
        url: 'redis://localhost:6379'
    });

    try {
        await client.connect();
        console.log('Connected to Redis');

        // Clear all cache entries
        await client.flushAll();
        console.log('✅ Cache cleared successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.quit();
    }
}

clearCache();