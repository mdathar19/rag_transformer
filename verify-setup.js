require('dotenv').config();
const { MongoClient } = require('mongodb');

async function verifySetup() {
    console.log('🔍 MongoDB Atlas Setup Verification Tool\n');
    console.log('========================================\n');

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ MONGODB_URI not found in .env file');
        return;
    }

    console.log('✅ MongoDB URI found in .env\n');

    try {
        // Test connection
        console.log('📡 Testing MongoDB connection...');
        const client = new MongoClient(uri);
        await client.connect();
        console.log('✅ Successfully connected to MongoDB Atlas!\n');

        // Check database
        const db = client.db('test_rag');
        console.log('📊 Checking database: test_rag');

        // List collections
        const collections = await db.listCollections().toArray();
        console.log(`✅ Found ${collections.length} collections:`);
        collections.forEach(col => {
            console.log(`   - ${col.name}`);
        });

        // Check for required collections
        console.log('\n🔍 Checking required collections:');
        const requiredCollections = ['clients', 'content', 'query_logs', 'crawl_jobs'];

        for (const colName of requiredCollections) {
            const exists = collections.some(c => c.name === colName);
            if (exists) {
                const count = await db.collection(colName).countDocuments();
                console.log(`   ✅ ${colName} (${count} documents)`);
            } else {
                console.log(`   ⚠️  ${colName} (will be auto-created)`);
            }
        }

        // Check regular indexes
        console.log('\n🔍 Checking regular indexes:');
        const contentIndexes = await db.collection('content').indexes();
        console.log(`   ✅ Found ${contentIndexes.length} indexes on content collection`);

        // Check for vector search index (this is the critical part)
        console.log('\n🔍 Checking Vector Search Index:');
        console.log('   ⚠️  IMPORTANT: Vector search index CANNOT be verified programmatically');
        console.log('   📝 You MUST manually create it in MongoDB Atlas UI:');
        console.log('\n   Steps to create Vector Search Index:');
        console.log('   1. Go to MongoDB Atlas Dashboard');
        console.log('   2. Click on your cluster');
        console.log('   3. Go to "Atlas Search" tab');
        console.log('   4. Click "Create Search Index"');
        console.log('   5. Choose "JSON Editor"');
        console.log('   6. Select database: test_rag');
        console.log('   7. Select collection: content');
        console.log('   8. Index name: vector_index');
        console.log('   9. Paste this JSON configuration:\n');

        const indexConfig = {
            "fields": [
                {
                    "type": "vector",
                    "path": "chunks.embedding",
                    "numDimensions": 1536,
                    "similarity": "cosine"
                }
            ]
        };

        console.log(JSON.stringify(indexConfig, null, 2));

        console.log('\n   10. Click "Create Search Index"');
        console.log('   11. Wait for status to show "Active"\n');

        // Check if content collection has documents with embeddings
        const contentWithEmbeddings = await db.collection('content').findOne({
            'chunks.embedding': { $exists: true }
        });

        if (contentWithEmbeddings) {
            console.log('✅ Found documents with embeddings in content collection');
            console.log('   Your vector search should work if index is created');
        } else {
            console.log('ℹ️  No documents with embeddings yet');
            console.log('   Run a crawl first to populate embeddings');
        }

        // Check for Paybito client
        console.log('\n🔍 Checking for initial client:');
        const paybitoClient = await db.collection('clients').findOne({
            brokerId: 'PAYB18022021121103'
        });

        if (paybitoClient) {
            console.log('✅ Paybito client exists');
            console.log(`   Name: ${paybitoClient.name}`);
            console.log(`   Status: ${paybitoClient.status}`);
            console.log(`   Content count: ${paybitoClient.contentCount || 0}`);
        } else {
            console.log('ℹ️  Paybito client will be created on first run');
        }

        console.log('\n========================================');
        console.log('📋 SETUP CHECKLIST:\n');
        console.log('✅ MongoDB connection working');
        console.log('✅ Database accessible');
        console.log(collections.length > 0 ? '✅ Collections exist' : '⚠️  Collections will be auto-created');
        console.log('⚠️  Vector search index must be created manually in Atlas UI');
        console.log('\n✨ Your system is ready! Just ensure the vector index is created.\n');

        await client.close();

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('authentication')) {
            console.log('\n🔧 Fix: Check your username and password in the connection string');
        } else if (error.message.includes('whitelist')) {
            console.log('\n🔧 Fix: Add your IP address to Network Access in Atlas');
        } else if (error.message.includes('ENOTFOUND')) {
            console.log('\n🔧 Fix: Check your cluster URL in the connection string');
        }
    }
}

// Run verification
console.log('Starting MongoDB Atlas setup verification...\n');
verifySetup();