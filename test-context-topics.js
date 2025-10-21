const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/v1';
const BROKER_ID = 'PAYB18022021121103';
const ACCESS_TOKEN = 'test-token';

async function testTopicContext(topic, initialQuery, followUpQuery) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${topic}`);
    console.log('='.repeat(60));

    const sessionId = `topic_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        // Initial query
        console.log(`\n1. Initial Query: "${initialQuery}"`);
        console.log('-'.repeat(60));

        const response1 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: sessionId,
                query: initialQuery
            })
        });

        const result1 = await response1.json();

        if (result1.success) {
            console.log('✓ Response received');
            console.log('First 200 chars:', result1.data.answer.substring(0, 200) + '...');
        } else {
            console.log('✗ Failed:', result1.error);
            return;
        }

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Follow-up query
        console.log(`\n2. Follow-up Query: "${followUpQuery}"`);
        console.log('-'.repeat(60));

        const response2 = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Broker-Id': BROKER_ID
            },
            body: JSON.stringify({
                brokerId: BROKER_ID,
                sessionId: sessionId,
                query: followUpQuery
            })
        });

        const result2 = await response2.json();

        if (result2.success) {
            console.log('✓ Context-aware response received');
            console.log('Context used:', result2.data.contextUsed);
            console.log('\nFull response:');
            console.log(result2.data.answer);
        } else {
            console.log('✗ Failed:', result2.error);
        }

    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

async function runAllTests() {
    console.log('\n');
    console.log('#'.repeat(60));
    console.log('CONTEXT-AWARE RESPONSE TESTING');
    console.log('Testing various topics with follow-up questions');
    console.log('#'.repeat(60));

    // Test 1: P2P Trading (The specific case mentioned by user)
    await testTopicContext(
        'P2P Trading',
        'i want to know about p2p',
        'can you please tell me in short about this?'
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Security Features
    await testTopicContext(
        'Security Features',
        'what security features does paybito have?',
        'give me a brief summary'
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 3: Account Types
    await testTopicContext(
        'Account Types',
        'tell me about different account types on paybito',
        'can you tell me that in short?'
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: KYC Process
    await testTopicContext(
        'KYC Process',
        'how does kyc work on paybito?',
        'summarize this please'
    );

    console.log('\n');
    console.log('#'.repeat(60));
    console.log('ALL CONTEXT TESTS COMPLETE');
    console.log('#'.repeat(60));
    console.log('\n');
}

// Run all tests
runAllTests();