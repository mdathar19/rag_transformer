require('dotenv').config();
const { MongoClient } = require('mongodb');

async function restructureForVectorSearch() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('brain_platform');
        const contentCollection = db.collection('content');
        const contentChunksCollection = db.collection('content_chunks');

        // Drop existing chunks collection if it exists
        try {
            await contentChunksCollection.drop();
            console.log('Dropped existing content_chunks collection');
        } catch (error) {
            console.log('No existing content_chunks collection to drop');
        }

        // Get all content documents
        const documents = await contentCollection.find({}).toArray();
        console.log(`Found ${documents.length} documents to process`);

        let totalChunks = 0;
        const chunkDocuments = [];

        // Process each document
        for (const doc of documents) {
            if (doc.chunks && Array.isArray(doc.chunks)) {
                // Create a separate document for each chunk
                doc.chunks.forEach((chunk, index) => {
                    chunkDocuments.push({
                        // Reference to parent document
                        contentId: doc._id,
                        brokerId: doc.brokerId,
                        url: doc.url,
                        title: doc.title,
                        description: doc.description,
                        contentType: doc.contentType,
                        status: doc.status,
                        pageRank: doc.pageRank,

                        // Chunk specific data
                        chunkIndex: index,
                        chunkText: chunk.text,
                        embedding: chunk.embedding,
                        position: chunk.position,

                        // Metadata
                        crawledAt: doc.crawledAt,
                        createdAt: new Date()
                    });
                    totalChunks++;
                });
            }
        }

        // Insert chunks in batches
        if (chunkDocuments.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < chunkDocuments.length; i += batchSize) {
                const batch = chunkDocuments.slice(i, i + batchSize);
                await contentChunksCollection.insertMany(batch);
                console.log(`Inserted ${Math.min(i + batchSize, chunkDocuments.length)} / ${chunkDocuments.length} chunks`);
            }
        }

        console.log(`\nRestructuring complete!`);
        console.log(`Total chunks created: ${totalChunks}`);

        // Create indexes on the new collection
        console.log('\nCreating indexes on content_chunks collection...');

        // Create regular indexes
        await contentChunksCollection.createIndex({ brokerId: 1 });
        await contentChunksCollection.createIndex({ contentId: 1 });
        await contentChunksCollection.createIndex({ url: 1 });

        // Create text index for fallback search
        await contentChunksCollection.createIndex({ chunkText: 'text', title: 'text' });

        console.log('Indexes created successfully');

        // Verify the restructuring
        const chunkCount = await contentChunksCollection.countDocuments({});
        console.log(`\nVerification: ${chunkCount} chunks in content_chunks collection`);

    } catch (error) {
        console.error('Error during restructuring:', error);
    } finally {
        await client.close();
        console.log('Connection closed');
    }
}

// Run the restructuring
restructureForVectorSearch().catch(console.error);