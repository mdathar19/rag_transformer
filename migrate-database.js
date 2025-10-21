const { MongoClient } = require('mongodb');

// Database connection strings
const OLD_DB_URI = 'mongodb+srv://athar_db_user:UlmeuWtBt8HVG8u1@hashcashcluster10.mhwwps.mongodb.net/test_rag?retryWrites=true&w=majority';
const NEW_DB_URI = 'mongodb+srv://mdathar:uxlO42gl129UGMi3@athar01.hdc30.mongodb.net/brain_platform?retryWrites=true&w=majority';

// Extract database names from URIs
const OLD_DB_NAME = 'test_rag';
const NEW_DB_NAME = 'brain_platform';

async function migrateDatabase() {
  let oldClient;
  let newClient;

  try {
    console.log('🔄 Starting database migration...\n');

    // Connect to old database
    console.log('📡 Connecting to old database...');
    oldClient = new MongoClient(OLD_DB_URI);
    await oldClient.connect();
    const oldDb = oldClient.db(OLD_DB_NAME);
    console.log('✅ Connected to old database\n');

    // Connect to new database
    console.log('📡 Connecting to new database...');
    newClient = new MongoClient(NEW_DB_URI);
    await newClient.connect();
    const newDb = newClient.db(NEW_DB_NAME);
    console.log('✅ Connected to new database\n');

    // Get all collections from old database
    const collections = await oldDb.listCollections().toArray();
    console.log(`📚 Found ${collections.length} collections to migrate:\n`);

    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });
    console.log('');

    // Migrate each collection
    let totalDocuments = 0;
    const migrationSummary = [];

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      // Skip system collections
      if (collectionName.startsWith('system.')) {
        console.log(`⏭️  Skipping system collection: ${collectionName}\n`);
        continue;
      }

      console.log(`🔄 Migrating collection: ${collectionName}`);

      try {
        // Get all documents from old collection
        const oldCollection = oldDb.collection(collectionName);
        const documents = await oldCollection.find({}).toArray();

        console.log(`   📄 Found ${documents.length} documents`);

        if (documents.length > 0) {
          // Insert documents into new collection
          const newCollection = newDb.collection(collectionName);

          // Check if collection exists and has data
          const existingCount = await newCollection.countDocuments();

          if (existingCount > 0) {
            console.log(`   ⚠️  Collection already has ${existingCount} documents`);
            console.log(`   ❓ Clearing existing data before migration...`);
            await newCollection.deleteMany({});
          }

          // Insert all documents
          const result = await newCollection.insertMany(documents, { ordered: false });
          console.log(`   ✅ Migrated ${result.insertedCount} documents`);

          totalDocuments += result.insertedCount;
          migrationSummary.push({
            collection: collectionName,
            documentsCount: result.insertedCount,
            status: 'success'
          });

          // Copy indexes
          const indexes = await oldCollection.indexes();
          if (indexes.length > 1) { // More than just the default _id index
            console.log(`   🔍 Copying ${indexes.length - 1} indexes...`);
            for (const index of indexes) {
              if (index.name !== '_id_') {
                try {
                  const indexSpec = { ...index.key };
                  const indexOptions = {
                    name: index.name,
                    ...(index.unique && { unique: index.unique }),
                    ...(index.sparse && { sparse: index.sparse }),
                    ...(index.background && { background: index.background })
                  };
                  await newCollection.createIndex(indexSpec, indexOptions);
                } catch (indexError) {
                  console.log(`   ⚠️  Index ${index.name} might already exist`);
                }
              }
            }
          }
        } else {
          console.log(`   ℹ️  Collection is empty, creating empty collection`);
          await newDb.createCollection(collectionName);
          migrationSummary.push({
            collection: collectionName,
            documentsCount: 0,
            status: 'empty'
          });
        }

        console.log('');
      } catch (error) {
        console.error(`   ❌ Error migrating collection ${collectionName}:`, error.message);
        migrationSummary.push({
          collection: collectionName,
          documentsCount: 0,
          status: 'failed',
          error: error.message
        });
        console.log('');
      }
    }

    // Print migration summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    migrationSummary.forEach((summary, index) => {
      const statusEmoji = summary.status === 'success' ? '✅' :
                         summary.status === 'empty' ? 'ℹ️' : '❌';
      console.log(`${index + 1}. ${statusEmoji} ${summary.collection}: ${summary.documentsCount} documents`);
      if (summary.error) {
        console.log(`   Error: ${summary.error}`);
      }
    });

    console.log(`\n📈 Total documents migrated: ${totalDocuments}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🎉 Migration completed successfully!');
    console.log(`\n💡 Old database: ${OLD_DB_NAME}`);
    console.log(`💡 New database: ${NEW_DB_NAME}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (oldClient) {
      await oldClient.close();
      console.log('🔌 Closed connection to old database');
    }
    if (newClient) {
      await newClient.close();
      console.log('🔌 Closed connection to new database');
    }
  }
}

// Run migration
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('\n✨ Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDatabase };
