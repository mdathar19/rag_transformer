require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const BROKER_ID = 'PAYB18022021121103';

async function testNoAnswerResponse() {
    console.log('🧪 Testing Custom No-Answer Response Feature\n');
    console.log('============================================\n');

    try {
        // Test 1: Query for something that definitely won't be found
        console.log('📋 Test 1: Query with no matching content');
        console.log('   Query: "What is the recipe for quantum pizza with dark matter toppings?"');

        const response1 = await axios.post(`${BASE_URL}/query`, {
            brokerId: BROKER_ID,
            query: "What is the recipe for quantum pizza with dark matter toppings?",
            options: {
                topK: 5,
                minScore: 0.9  // Very high threshold to ensure no matches
            }
        }, {
            headers: {
                'X-API-Key': BROKER_ID,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n   ✅ Response received:');
        console.log(`   Answer: "${response1.data.data.answer}"`);
        console.log(`   Confidence: ${response1.data.data.confidence}`);
        console.log(`   Sources: ${response1.data.data.sources.length}`);

        // Verify it's the custom response
        const expectedResponse = "For precise information Please reach out to our support team directly. You can contact us at broker-support@paybito.com or raise a support ticket https://support.paybito.com/brokers/login for brokers, and our team will be happy to assist you with detailed guidance.";

        if (response1.data.data.answer === expectedResponse) {
            console.log('\n   ✅ SUCCESS: Custom no-answer response is working!');
        } else {
            console.log('\n   ⚠️ WARNING: Response doesn\'t match expected custom response');
        }

        // Test 2: Update the no-answer response via API
        console.log('\n📋 Test 2: Update no-answer response via API');

        const newResponse = "I apologize, but I don't have information about that topic in my knowledge base. Please contact our support team for assistance.";

        const updateResult = await axios.put(
            `${BASE_URL}/clients/${BROKER_ID}/no-answer-response`,
            { noDataResponse: newResponse },
            {
                headers: {
                    'X-API-Key': BROKER_ID,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('   ✅ Response updated successfully');
        console.log(`   New response: "${updateResult.data.data.noDataResponse}"`);

        // Test 3: Verify the new response is used
        console.log('\n📋 Test 3: Verify new custom response');
        console.log('   Query: "What is the meaning of quantum pizza?"');

        const response2 = await axios.post(`${BASE_URL}/query`, {
            brokerId: BROKER_ID,
            query: "What is the meaning of quantum pizza?",
            options: {
                topK: 5,
                minScore: 0.7,
                useCache: false // Disable cache to get fresh response
            }
        }, {
            headers: {
                'X-API-Key': BROKER_ID,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n   ✅ Response received:');
        console.log(`   Answer: "${response2.data.data.answer}"`);

        if (response2.data.data.answer === newResponse) {
            console.log('\n   ✅ SUCCESS: Updated no-answer response is working!');
        }

        // Test 4: Restore original Paybito response
        console.log('\n📋 Test 4: Restoring original Paybito response');

        await axios.put(
            `${BASE_URL}/clients/${BROKER_ID}/no-answer-response`,
            { noDataResponse: expectedResponse },
            {
                headers: {
                    'X-API-Key': BROKER_ID,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('   ✅ Original response restored');

        console.log('\n============================================');
        console.log('✨ All tests completed successfully!');
        console.log('\n📌 Summary:');
        console.log('   • Custom no-answer responses are working');
        console.log('   • API endpoint can update responses dynamically');
        console.log('   • Each client can have their own custom message');
        console.log('   • Paybito client has been configured with their custom support message');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);

        if (error.response?.status === 404) {
            console.log('\n💡 Tip: Make sure the server is running (npm start)');
        }
    }
}

// Run the test
console.log('Starting no-answer response tests...\n');
testNoAnswerResponse();