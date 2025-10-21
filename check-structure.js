require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkStructure() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db('brain_platform');

        // Get a sample document
        const sample = await db.collection('content').findOne({});

        if (sample && sample.chunks) {
            console.log('Number of chunks in sample document:', sample.chunks.length);
            console.log('First chunk structure:');
            if (sample.chunks[0]) {
                console.log('- Has text:', !!sample.chunks[0].text);
                console.log('- Has embedding:', !!sample.chunks[0].embedding);
                console.log('- Embedding dimensions:', sample.chunks[0].embedding ? sample.chunks[0].embedding.length : 0);
            }
        }

        // Check how many documents have multiple chunks
        const multiChunkDocs = await db.collection('content').countDocuments({
            'chunks.1': { $exists: true }
        });

        const totalDocs = await db.collection('content').countDocuments({});

        console.log('\nDocument statistics:');
        console.log('Total documents:', totalDocs);
        console.log('Documents with multiple chunks:', multiChunkDocs);

    } finally {
        await client.close();
    }
}

checkStructure().catch(console.error);