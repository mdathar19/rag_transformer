const axios = require('axios');

async function testSettlementQuery() {
    try {
        console.log('Testing settlement options query...\n');

        const response = await axios.post('http://localhost:3000/api/v1/query', {
            brokerId: 'PAYB18022021121103',
            query: 'please tell me what is my settlement option in broker admin ?',
            options: {
                topK: 5,
                minScore: 0.7,
                useCache: false  // Disable cache to get fresh response
            }
        }, {
            headers: {
                'X-API-Key': 'PAYB18022021121103',
                'Content-Type': 'application/json'
            }
        });

        console.log('Response received:');
        console.log('================\n');
        console.log('Answer:', response.data.data.answer);
        console.log('\nSources found:', response.data.data.sources.length);
        console.log('Confidence:', response.data.data.confidence);

        // Check if it's using the custom Paybito response
        const expectedResponse = "For precise information Please reach out to our support team directly. You can contact us at broker-support@paybito.com or raise a support ticket https://support.paybito.com/brokers/login for brokers, and our team will be happy to assist you with detailed guidance.";

        if (response.data.data.answer === expectedResponse) {
            console.log('\n✅ SUCCESS: Custom Paybito response is being used!');
        } else {
            console.log('\n⚠️ Note: Response is not the custom Paybito message');
        }

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testSettlementQuery();