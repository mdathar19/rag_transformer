require('dotenv').config();
const database = require('./src/config/database');
const EmbeddingService = require('./src/services/embeddingService');
const VectorSearchService = require('./src/services/vectorSearch');

async function testSearch() {
    try {
        console.log('Connecting to database...');
        await database.connect();

        const embeddingService = new EmbeddingService();
        const vectorSearchService = new VectorSearchService(embeddingService, null);

        // Get broker ID from database
        const db = database.getDb();
        const clientsCollection = db.collection('clients');
        const client = await clientsCollection.findOne({});

        if (!client) {
            console.error('No client found in database');
            process.exit(1);
        }

        console.log(`Testing with brokerId: ${client.brokerId}`);

        // Check content_chunks collection
        const chunksCollection = db.collection('content_chunks');
        const totalChunks = await chunksCollection.countDocuments({ brokerId: client.brokerId });
        console.log(`Total chunks for broker: ${totalChunks}`);

        // Sample a chunk
        const sampleChunk = await chunksCollection.findOne({ brokerId: client.brokerId });
        if (sampleChunk) {
            console.log('\nSample chunk:');
            console.log('- URL:', sampleChunk.url);
            console.log('- Title:', sampleChunk.title);
            console.log('- Text preview:', sampleChunk.chunkText?.substring(0, 100) + '...');
            console.log('- Has embedding:', !!sampleChunk.embedding);
            console.log('- Embedding length:', sampleChunk.embedding?.length);
        }

        // Test keyword search for "privacy"
        console.log('\n=== Testing keyword search for "privacy" ===');
        const keywordResults = await chunksCollection.find({
            brokerId: client.brokerId,
            chunkText: { $regex: /privacy/i }
        }).limit(5).toArray();

        console.log(`Found ${keywordResults.length} chunks with "privacy"`);
        if (keywordResults.length > 0) {
            console.log('\nFirst result:');
            console.log('- URL:', keywordResults[0].url);
            console.log('- Title:', keywordResults[0].title);
            console.log('- Text preview:', keywordResults[0].chunkText?.substring(0, 200) + '...');
        }

        // Test vector search
        console.log('\n=== Testing vector search ===');
        const query = 'tell me about privacy policy';
        console.log(`Query: "${query}"`);

        const searchResults = await vectorSearchService.search(query, client.brokerId, {
            limit: 5,
            minScore: 0.3
        });

        console.log(`\nVector search returned ${searchResults.length} results`);
        if (searchResults.length > 0) {
            console.log('\nTop result:');
            console.log('- URL:', searchResults[0].url);
            console.log('- Title:', searchResults[0].title);
            console.log('- Score:', searchResults[0].score);
            console.log('- Text preview:', searchResults[0].chunk?.substring(0, 200) + '...');
        }

        await database.disconnect();
        console.log('\nTest completed!');
        process.exit(0);

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testSearch();
