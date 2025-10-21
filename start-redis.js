const redis = require('redis');

async function testRedis() {
    const client = redis.createClient({
        host: 'localhost',
        port: 6379
    });

    client.on('error', (err) => console.log('Redis Client Error', err));

    await client.connect();
    
    const pong = await client.ping();
    console.log('Redis is running! Response:', pong);
    
    await client.disconnect();
}

testRedis();