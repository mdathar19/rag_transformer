require('dotenv').config();
const { MongoClient } = require('mongodb');

async function migrateData() {
    // Configuration
    const SOURCE_URI = process.env.MONGODB_URI_OLD;
    const DEST_URI = process.env.MONGODB_URI_NEW;
    const DATABASE_NAME = 'test_rag';
    const COLLECTIONS = ['clients', 'content', 'crawl_jobs', 'query_logs'];

    let sourceClient, destClient;

    try {
        // Connect to both clusters
        console.log('Connecting to source cluster...');
        sourceClient = new MongoClient(SOURCE_URI);
        await sourceClient.connect();
        const sourceDb = sourceClient.db(DATABASE_NAME);

        console.log('Connecting to destination cluster...');
        destClient = new MongoClient(DEST_URI);
        await destClient.connect();
        const destDb = destClient.db(DATABASE_NAME);

        // Migrate each collection
        for (const collectionName of COLLECTIONS) {
            console.log(`\nMigrating collection: ${collectionName}`);

            // Get source collection
            const sourceCollection = sourceDb.collection(collectionName);
            const destCollection = destDb.collection(collectionName);

            // Count documents
            const count = await sourceCollection.countDocuments();
            console.log(`Found ${count} documents in ${collectionName}`);

            if (count === 0) {
                console.log(`Skipping empty collection: ${collectionName}`);
                continue;
            }

            // Clear destination collection (optional)
            await destCollection.deleteMany({});

            // Copy documents in batches
            const batchSize = 100;
            let processed = 0;

            const cursor = sourceCollection.find({});

            while (await cursor.hasNext()) {
                const batch = [];

                // Build batch
                for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
                    batch.push(await cursor.next());
                }

                // Insert batch
                if (batch.length > 0) {
                    await destCollection.insertMany(batch);
                    processed += batch.length;

                    // Progress update
                    const progress = Math.round((processed / count) * 100);
                    console.log(`${collectionName}: ${processed}/${count} documents (${progress}%)`);
                }
            }

            console.log(`✓ Completed ${collectionName}: ${processed} documents migrated`);
        }

        // Verify migration
        console.log('\n=== Migration Summary ===');
        for (const collectionName of COLLECTIONS) {
            const sourceCount = await sourceDb.collection(collectionName).countDocuments();
            const destCount = await destDb.collection(collectionName).countDocuments();
            const status = sourceCount === destCount ? '✓' : '✗';
            console.log(`${status} ${collectionName}: Source=${sourceCount}, Destination=${destCount}`);
        }

        console.log('\n✓ Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        // Close connections
        if (sourceClient) await sourceClient.close();
        if (destClient) await destClient.close();
    }
}

// Run migration
migrateData();