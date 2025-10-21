const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/v1';
const BROKER_ID = 'PAYB18022021121103';
const ACCESS_TOKEN = 'test-token-12345';
const UUID = 'uuid-' + Date.now();
const USER_ID = 'user123';

async function testAuthFlow() {
    console.log('===========================================');
    console.log('Testing Complete Authentication Flow');
    console.log('===========================================\n');

    console.log('Authentication Parameters:');
    console.log(`- Broker ID: ${BROKER_ID}`);
    console.log(`- Access Token: ${ACCESS_TOKEN}`);
    console.log(`- UUID: ${UUID}`);
    console.log(`- User ID: ${USER_ID}\n`);

    const sessionId = 'auth_test_session_' + Date.now();

    try {
        // Test 1: First query about trading fees
        console.log('TEST 1: Initial Query - Trading Fees');
        console.log('--------------------------------------');
        const response1 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID,
                'X-User-Id': USER_ID,
                'X-UUID': UUID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: sessionId,
                query: 'what are the trading fees on paybito?'
            })
        });

        const result1 = await response1.json();

        if (result1.success) {
            console.log('✓ Query successful');
            console.log('Response (first 300 chars):');
            console.log(result1.data.answer.substring(0, 300) + '...\n');
        } else {
            console.log('✗ Query failed:', result1.error);
        }

        // Wait before next query
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Context-aware follow-up
        console.log('TEST 2: Context-Aware Follow-up');
        console.log('--------------------------------');
        const response2 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID,
                'X-User-Id': USER_ID,
                'X-UUID': UUID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: sessionId,
                query: 'give me a short summary of that'
            })
        });

        const result2 = await response2.json();

        if (result2.success) {
            console.log('✓ Context-aware response successful');
            console.log('Full response:');
            console.log(result2.data.answer);
            console.log('\nContext used:', result2.data.contextUsed);
        } else {
            console.log('✗ Context query failed:', result2.error);
        }

        // Test 3: Session history retrieval
        console.log('\nTEST 3: Session History Retrieval');
        console.log('----------------------------------');
        const historyResponse = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            }
        });

        const history = await historyResponse.json();

        if (history.success) {
            console.log(`✓ Retrieved ${history.data.history.length} messages from session`);
            console.log('\nSession history:');
            history.data.history.forEach((msg, idx) => {
                const preview = msg.content.substring(0, 80);
                console.log(`  [${idx + 1}] ${msg.role.toUpperCase().padEnd(9)}: ${preview}...`);
            });
        } else {
            console.log('✗ History retrieval failed:', history.error);
        }

        // Test 4: New session creation
        console.log('\nTEST 4: New Session Creation');
        console.log('-----------------------------');
        const newSessionId = 'new_session_' + Date.now();

        const newSessionResponse = await fetch(`${API_BASE}/session/new`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            },
            body: JSON.stringify({
                newSessionId: newSessionId,
                oldSessionId: sessionId
            })
        });

        const newSession = await newSessionResponse.json();

        if (newSession.success) {
            console.log('✓ New session created:', newSessionId);
            console.log('✓ Old session cleared:', sessionId);
        } else {
            console.log('✗ Session creation failed:', newSession.error);
        }

        // Test 5: Verify old session is cleared
        console.log('\nTEST 5: Verify Old Session Cleared');
        console.log('-----------------------------------');
        const oldHistoryResponse = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            }
        });

        const oldHistory = await oldHistoryResponse.json();

        if (oldHistory.success) {
            if (oldHistory.data.history.length === 0) {
                console.log('✓ Old session successfully cleared');
            } else {
                console.log('✗ Old session still has', oldHistory.data.history.length, 'messages');
            }
        }

        console.log('\n===========================================');
        console.log('All Authentication Flow Tests Complete!');
        console.log('===========================================');

    } catch (error) {
        console.error('\n✗ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testAuthFlow();