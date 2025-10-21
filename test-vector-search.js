const { MongoClient } = require('mongodb');
const { OpenAI } = require('openai');
require('dotenv').config();

async function testVectorSearch() {
    const client = new MongoClient(process.env.MONGODB_URI);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        console.log('🧪 Testing Vector Search...\n');

        await client.connect();
        const db = client.db('brain_platform');
        const collection = db.collection('content_chunks');

        // Get a sample chunk to check structure
        const sampleChunk = await collection.findOne({});
        console.log('📄 Sample chunk structure:');
        console.log(`   BrokerId: ${sampleChunk.brokerId}`);
        console.log(`   URL: ${sampleChunk.url}`);
        console.log(`   Title: ${sampleChunk.title}`);
        console.log(`   Has embedding: ${!!sampleChunk.embedding}`);
        console.log(`   Embedding type: ${Array.isArray(sampleChunk.embedding) ? 'array' : typeof sampleChunk.embedding}`);
        console.log(`   Embedding length: ${Array.isArray(sampleChunk.embedding) ? sampleChunk.embedding.length : 'N/A'}\n`);

        // Test query
        const testQuery = "tell me about this app";
        const brokerId = "PAYB176097497426030C4";

        console.log(`🔍 Test Query: "${testQuery}"`);
        console.log(`🔑 Broker ID: ${brokerId}\n`);

        // Generate embedding for query
        console.log('⚙️  Generating query embedding...');
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: testQuery,
            encoding_format: 'float'
        });
        const queryEmbedding = response.data[0].embedding;
        console.log(`✅ Query embedding generated (length: ${queryEmbedding.length})\n`);

        // Test 1: Vector search WITHOUT filter
        console.log('═══════════════════════════════════════════════════════');
        console.log('TEST 1: Vector Search WITHOUT brokerId filter');
        console.log('═══════════════════════════════════════════════════════');

        try {
            const pipeline1 = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: 100,
                        limit: 10
                    }
                },
                {
                    $addFields: {
                        searchScore: { $meta: "vectorSearchScore" }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        brokerId: 1,
                        url: 1,
                        title: 1,
                        chunkText: 1,
                        searchScore: 1
                    }
                }
            ];

            const results1 = await collection.aggregate(pipeline1).toArray();
            console.log(`✅ Results: ${results1.length}\n`);

            if (results1.length > 0) {
                console.log('Top 3 results:');
                results1.slice(0, 3).forEach((r, i) => {
                    console.log(`\n${i + 1}.`);
                    console.log(`   All fields:`, Object.keys(r));
                    console.log(`   Score: ${r.searchScore || r.score || 'undefined'}`);
                    console.log(`   BrokerId: ${r.brokerId}`);
                    console.log(`   Title: ${r.title}`);
                    console.log(`   URL: ${r.url}`);
                    console.log(`   Text: ${r.chunkText?.substring(0, 100)}...`);
                });
            } else {
                console.log('⚠️  No results found!');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            console.error('Full error:', error);
        }

        // Test 2: Vector search WITH filter (as in production)
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('TEST 2: Vector Search WITH brokerId filter');
        console.log('═══════════════════════════════════════════════════════');

        try {
            const pipeline2 = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: 100,
                        limit: 10,
                        filter: {
                            brokerId: brokerId
                        }
                    }
                },
                {
                    $addFields: {
                        searchScore: { $meta: "vectorSearchScore" }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        brokerId: 1,
                        url: 1,
                        title: 1,
                        chunkText: 1,
                        searchScore: 1
                    }
                }
            ];

            const results2 = await collection.aggregate(pipeline2).toArray();
            console.log(`✅ Results: ${results2.length}\n`);

            if (results2.length > 0) {
                console.log('Top 3 results:');
                results2.slice(0, 3).forEach((r, i) => {
                    console.log(`\n${i + 1}.`);
                    console.log(`   All fields:`, Object.keys(r));
                    console.log(`   Score: ${r.searchScore || r.score || 'undefined'}`);
                    console.log(`   BrokerId: ${r.brokerId}`);
                    console.log(`   Title: ${r.title}`);
                    console.log(`   URL: ${r.url}`);
                    console.log(`   Text: ${r.chunkText?.substring(0, 100)}...`);
                });
            } else {
                console.log('⚠️  No results found!');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            console.error('Full error:', error);
        }

        // Test 3: Check how many documents match the brokerId
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('TEST 3: Check documents for this brokerId');
        console.log('═══════════════════════════════════════════════════════');

        const brokerDocs = await collection.countDocuments({ brokerId: brokerId });
        console.log(`Documents with brokerId "${brokerId}": ${brokerDocs}`);

        if (brokerDocs === 0) {
            console.log('\n⚠️  ISSUE FOUND: No documents found for this brokerId!');
            console.log('\nLet\'s check what brokerIds exist:');
            const brokerIds = await collection.distinct('brokerId');
            console.log(`Available brokerIds: ${brokerIds.join(', ')}`);
        }

        // Test 4: List all Atlas Search indexes
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('TEST 4: Check Atlas Search Indexes');
        console.log('═══════════════════════════════════════════════════════');

        const indexes = await collection.indexes();
        console.log('Standard indexes:');
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}`);
        });

        console.log('\nNote: Atlas Search indexes are not visible via db.collection.indexes()');
        console.log('You need to check them in the Atlas UI under the Search tab.');

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await client.close();
    }
}

testVectorSearch()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
