const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkEmbeddings() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        console.log('🔍 Checking embeddings in database...\n');

        await client.connect();
        const db = client.db();

        // Check content_chunks collection
        const chunksCollection = db.collection('content_chunks');

        // Get total count
        const totalChunks = await chunksCollection.countDocuments();
        console.log(`📊 Total chunks in database: ${totalChunks}`);

        // Check chunks with embeddings
        const chunksWithEmbeddings = await chunksCollection.countDocuments({
            embedding: { $exists: true, $ne: null }
        });
        console.log(`✅ Chunks with embeddings: ${chunksWithEmbeddings}`);
        console.log(`❌ Chunks without embeddings: ${totalChunks - chunksWithEmbeddings}\n`);

        // Get a sample chunk to inspect
        const sampleChunk = await chunksCollection.findOne({
            embedding: { $exists: true, $ne: null }
        });

        if (sampleChunk) {
            console.log('📄 Sample chunk with embedding:');
            console.log(`   Title: ${sampleChunk.title}`);
            console.log(`   URL: ${sampleChunk.url}`);
            console.log(`   Broker ID: ${sampleChunk.brokerId}`);
            console.log(`   Chunk text length: ${sampleChunk.chunkText?.length || 0}`);
            console.log(`   Embedding exists: ${!!sampleChunk.embedding}`);
            console.log(`   Embedding type: ${Array.isArray(sampleChunk.embedding) ? 'array' : typeof sampleChunk.embedding}`);
            console.log(`   Embedding length: ${Array.isArray(sampleChunk.embedding) ? sampleChunk.embedding.length : 'N/A'}`);

            if (Array.isArray(sampleChunk.embedding)) {
                console.log(`   Embedding sample (first 5): [${sampleChunk.embedding.slice(0, 5).join(', ')}...]`);
            }
        } else {
            console.log('⚠️  No chunks found with embeddings!');

            // Check a chunk without embedding
            const chunkWithoutEmbedding = await chunksCollection.findOne();
            if (chunkWithoutEmbedding) {
                console.log('\n📄 Sample chunk WITHOUT embedding:');
                console.log(`   Title: ${chunkWithoutEmbedding.title}`);
                console.log(`   URL: ${chunkWithoutEmbedding.url}`);
                console.log(`   Broker ID: ${chunkWithoutEmbedding.brokerId}`);
                console.log(`   Fields: ${Object.keys(chunkWithoutEmbedding).join(', ')}`);
            }
        }

        // Check indexes
        console.log('\n🔍 Checking indexes on content_chunks collection:');
        const indexes = await chunksCollection.indexes();
        indexes.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Check for vector search index specifically
        const hasVectorIndex = indexes.some(idx =>
            idx.name === 'vector_index' ||
            idx.type === 'vectorSearch' ||
            JSON.stringify(idx).includes('vectorSearch')
        );

        if (hasVectorIndex) {
            console.log('\n✅ Vector search index found!');
        } else {
            console.log('\n⚠️  Vector search index NOT found!');
            console.log('\n📝 You need to create a vector search index in MongoDB Atlas:');
            console.log('   1. Go to MongoDB Atlas Dashboard');
            console.log('   2. Navigate to your cluster > Search > Create Search Index');
            console.log('   3. Choose "JSON Editor" and use this configuration:');
            console.log('\n' + JSON.stringify({
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": 1536,
                        "similarity": "cosine"
                    },
                    {
                        "type": "filter",
                        "path": "brokerId"
                    }
                ]
            }, null, 2));
            console.log('\n   4. Name the index: vector_index');
            console.log('   5. Select database and collection: content_chunks\n');
        }

        // Group by broker
        console.log('\n📊 Chunks by broker:');
        const brokerStats = await chunksCollection.aggregate([
            {
                $group: {
                    _id: '$brokerId',
                    total: { $sum: 1 },
                    withEmbedding: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$embedding', null] }, { $ne: ['$embedding', undefined] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]).toArray();

        brokerStats.forEach(stat => {
            const percentage = stat.total > 0 ? ((stat.withEmbedding / stat.total) * 100).toFixed(1) : 0;
            console.log(`   ${stat._id}: ${stat.withEmbedding}/${stat.total} chunks with embeddings (${percentage}%)`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

checkEmbeddings()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
