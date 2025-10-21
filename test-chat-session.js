const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/v1';
const BROKER_ID = 'PAYB18022021121103';
const ACCESS_TOKEN = 'test-token';
const SESSION_ID = 'test_session_' + Date.now();

async function testChat() {
    console.log('Testing chat session management...\n');
    console.log(`Session ID: ${SESSION_ID}\n`);

    // First query about P2P
    console.log('1. Sending first query: "i want to know about p2p"');
    console.log('-------------------------------------------');

    try {
        const response1 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: SESSION_ID,
                query: 'i want to know about p2p'
            })
        });

        const result1 = await response1.json();

        if (result1.success) {
            console.log('Response received:');
            console.log(result1.data.answer.substring(0, 200) + '...\n');
        } else {
            console.log('Error:', result1.error);
        }

        // Wait a moment
        console.log('Waiting 2 seconds before next query...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Second query asking for short version
        console.log('2. Sending follow-up query: "can you please tell me in short about this ?"');
        console.log('-------------------------------------------');

        const response2 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: SESSION_ID,
                query: 'can you please tell me in short about this ?'
            })
        });

        const result2 = await response2.json();

        if (result2.success) {
            console.log('Response received:');
            console.log(result2.data.answer);
            console.log('\nContext used:', result2.data.contextUsed);
        } else {
            console.log('Error:', result2.error);
        }

        // Check session history
        console.log('\n3. Checking session history...');
        console.log('-------------------------------------------');

        const historyResponse = await fetch(`${API_BASE}/chat/session/${SESSION_ID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            }
        });

        const history = await historyResponse.json();

        if (history.success) {
            console.log(`Session has ${history.data.history.length} messages`);
            history.data.history.forEach((msg, idx) => {
                console.log(`\n[${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}...`);
            });
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testChat();