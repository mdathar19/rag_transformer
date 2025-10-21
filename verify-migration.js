const { MongoClient } = require('mongodb');
require('dotenv').config();

const OLD_DB_URI = 'mongodb+srv://athar_db_user:UlmeuWtBt8HVG8u1@hashcashcluster10.mhwwps.mongodb.net/test_rag?retryWrites=true&w=majority';
const NEW_DB_URI = 'mongodb+srv://mdathar:uxlO42gl129UGMi3@athar01.hdc30.mongodb.net/brain_platform?retryWrites=true&w=majority';

async function verifyMigration() {
    let oldClient, newClient;

    try {
        console.log('🔍 Verifying database migration...\n');

        // Connect to old database
        console.log('📡 Connecting to OLD database (test_rag)...');
        oldClient = new MongoClient(OLD_DB_URI);
        await oldClient.connect();
        const oldDb = oldClient.db('test_rag');

        // Connect to new database
        console.log('📡 Connecting to NEW database (brain_platform)...\n');
        newClient = new MongoClient(NEW_DB_URI);
        await newClient.connect();
        const newDb = newClient.db('brain_platform');

        // Check content_chunks in both databases
        const collections = ['content', 'content_chunks', 'users', 'clients', 'crawl_jobs'];

        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 COLLECTION COMPARISON');
        console.log('═══════════════════════════════════════════════════════\n');

        for (const collectionName of collections) {
            const oldCount = await oldDb.collection(collectionName).countDocuments();
            const newCount = await newDb.collection(collectionName).countDocuments();

            const status = oldCount === newCount ? '✅' : '⚠️ ';
            console.log(`${status} ${collectionName}:`);
            console.log(`   OLD: ${oldCount} documents`);
            console.log(`   NEW: ${newCount} documents`);
            console.log('');
        }

        // Check for embeddings in old database
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔍 EMBEDDINGS CHECK');
        console.log('═══════════════════════════════════════════════════════\n');

        const oldChunksWithEmbeddings = await oldDb.collection('content_chunks').countDocuments({
            embedding: { $exists: true, $ne: null }
        });

        const newChunksWithEmbeddings = await newDb.collection('content_chunks').countDocuments({
            embedding: { $exists: true, $ne: null }
        });

        console.log(`OLD database chunks with embeddings: ${oldChunksWithEmbeddings}`);
        console.log(`NEW database chunks with embeddings: ${newChunksWithEmbeddings}\n`);

        // Sample a chunk from old database
        const oldSample = await oldDb.collection('content_chunks').findOne();
        if (oldSample) {
            console.log('📄 Sample chunk from OLD database:');
            console.log(`   Has embedding: ${!!oldSample.embedding}`);
            console.log(`   Fields: ${Object.keys(oldSample).join(', ')}\n`);
        }

        // Sample a chunk from new database
        const newSample = await newDb.collection('content_chunks').findOne();
        if (newSample) {
            console.log('📄 Sample chunk from NEW database:');
            console.log(`   Has embedding: ${!!newSample.embedding}`);
            console.log(`   Fields: ${Object.keys(newSample).join(', ')}\n`);
        }

        // Recommendations
        console.log('═══════════════════════════════════════════════════════');
        console.log('💡 RECOMMENDATIONS');
        console.log('═══════════════════════════════════════════════════════\n');

        if (newChunksWithEmbeddings === 0) {
            console.log('⚠️  Issue: No embeddings found in NEW database');
            console.log('\n📝 Solution:');
            if (oldChunksWithEmbeddings > 0) {
                console.log('   1. Re-run the migration script to copy embeddings from old database');
                console.log('      Command: node migrate-database.js');
            } else {
                console.log('   1. Old database also has no embeddings.');
                console.log('   2. You need to recrawl your websites to generate embeddings');
                console.log('      OR');
                console.log('   3. Run a script to generate embeddings for existing content');
            }
        } else {
            console.log('✅ Embeddings are present in the new database');
        }

        console.log('\n📋 Next steps:');
        console.log('   1. Create vector search index in MongoDB Atlas (see instructions below)');
        console.log('   2. Ensure embeddings are generated for all chunks');
        console.log('   3. Test vector search functionality\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (oldClient) await oldClient.close();
        if (newClient) await newClient.close();
    }
}

verifyMigration()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
