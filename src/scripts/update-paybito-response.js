require('dotenv').config();
const database = require('../config/database');
const clientManager = require('../services/clientManager');

const PAYBITO_NO_ANSWER_RESPONSE = `For precise information Please reach out to our support team directly. You can contact us at broker-support@paybito.com or raise a support ticket https://support.paybito.com/brokers/login for brokers, and our team will be happy to assist you with detailed guidance.`;

async function updatePaybitoResponse() {
    try {
        // Connect to database
        await database.connect();
        await clientManager.initialize();

        console.log('🔄 Updating Paybito client with custom no-answer response...\n');

        // Update Paybito client
        const updatedClient = await clientManager.updateClient('PAYB18022021121103', {
            noDataResponse: PAYBITO_NO_ANSWER_RESPONSE
        });

        console.log('✅ Successfully updated Paybito client!');
        console.log('\n📝 Client Details:');
        console.log(`   Name: ${updatedClient.name}`);
        console.log(`   Broker ID: ${updatedClient.brokerId}`);
        console.log(`   Domain: ${updatedClient.domain}`);
        console.log('\n💬 Custom No-Answer Response:');
        console.log(`   "${updatedClient.noDataResponse}"`);

    } catch (error) {
        console.error('❌ Error updating Paybito client:', error.message);
    } finally {
        // Close database connection
        if (database.client) {
            await database.client.close();
        }
        process.exit(0);
    }
}

// Run the update
updatePaybitoResponse();