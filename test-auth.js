require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// Test data
const testUser = {
    email: 'test@company.com',
    password: 'test123456',
    companyName: 'Test Company Inc',
    profile: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
    }
};

const adminUser = {
    email: 'admin@rag-platform.com',
    password: 'admin123456',
    companyName: 'RAG Platform Admin',
    userType: 'ADMIN',
    profile: {
        firstName: 'Admin',
        lastName: 'User'
    }
};

async function testAuthFlow() {
    console.log('🚀 Starting Authentication Flow Test\n');

    try {
        // Test 1: Register a new regular user
        console.log('📝 Test 1: Registering new regular user...');
        const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
        console.log('✅ Registration successful!');
        console.log('User Data:', JSON.stringify(registerResponse.data.data.user, null, 2));
        console.log('Broker ID:', registerResponse.data.data.user.brokerId);
        console.log('Token received:', registerResponse.data.data.token ? 'Yes' : 'No');
        console.log('');

        const userToken = registerResponse.data.data.token;
        const userBrokerId = registerResponse.data.data.user.brokerId;

        // Test 2: Register an admin user
        console.log('📝 Test 2: Registering admin user...');
        const adminRegisterResponse = await axios.post(`${BASE_URL}/auth/register`, adminUser);
        console.log('✅ Admin registration successful!');
        console.log('Admin Data:', JSON.stringify(adminRegisterResponse.data.data.user, null, 2));
        console.log('Admin Broker ID:', adminRegisterResponse.data.data.user.brokerId);
        console.log('');

        const adminToken = adminRegisterResponse.data.data.token;
        const adminBrokerId = adminRegisterResponse.data.data.user.brokerId;

        // Test 3: Login with the registered user
        console.log('📝 Test 3: Login with regular user...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('✅ Login successful!');
        console.log('Login Data:', JSON.stringify(loginResponse.data.data.user, null, 2));
        console.log('');

        // Test 4: Get user profile with token
        console.log('📝 Test 4: Getting user profile...');
        const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        console.log('✅ Profile retrieved successfully!');
        console.log('Profile Data:', JSON.stringify(profileResponse.data.data, null, 2));
        console.log('');

        // Test 5: Verify token
        console.log('📝 Test 5: Verifying token...');
        const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        console.log('✅ Token verified successfully!');
        console.log('Verified User:', JSON.stringify(verifyResponse.data.data.user, null, 2));
        console.log('');

        // Test 6: Generate API key
        console.log('📝 Test 6: Generating API key...');
        const apiKeyResponse = await axios.post(`${BASE_URL}/auth/api-key`, {
            keyName: 'Test API Key'
        }, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        console.log('✅ API key generated successfully!');
        console.log('API Key:', apiKeyResponse.data.data.apiKey);
        console.log('');

        const apiKey = apiKeyResponse.data.data.apiKey;

        // Test 7: Test with invalid credentials
        console.log('📝 Test 7: Testing with invalid credentials...');
        try {
            await axios.post(`${BASE_URL}/auth/login`, {
                email: testUser.email,
                password: 'wrongpassword'
            });
            console.log('❌ Should have failed!');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Invalid credentials properly rejected!');
                console.log('Error message:', error.response.data.error);
            } else {
                throw error;
            }
        }
        console.log('');

        // Test 8: Update profile
        console.log('📝 Test 8: Updating user profile...');
        const updateResponse = await axios.put(`${BASE_URL}/auth/profile`, {
            profile: {
                firstName: 'Jane',
                lastName: 'Smith',
                phone: '+9876543210'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        console.log('✅ Profile updated successfully!');
        console.log('Updated Profile:', JSON.stringify(updateResponse.data.data.profile, null, 2));
        console.log('');

        // Test 9: Change password
        console.log('📝 Test 9: Changing password...');
        const changePasswordResponse = await axios.post(`${BASE_URL}/auth/change-password`, {
            oldPassword: testUser.password,
            newPassword: 'newpassword123'
        }, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        console.log('✅ Password changed successfully!');
        console.log('Message:', changePasswordResponse.data.message);
        console.log('');

        // Test 10: Login with new password
        console.log('📝 Test 10: Login with new password...');
        const newLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: testUser.email,
            password: 'newpassword123'
        });
        console.log('✅ Login with new password successful!');
        console.log('');

        // Summary
        console.log('🎉 All tests passed successfully!\n');
        console.log('=' .repeat(60));
        console.log('SUMMARY:');
        console.log('=' .repeat(60));
        console.log(`Regular User Email: ${testUser.email}`);
        console.log(`Regular User Broker ID: ${userBrokerId}`);
        console.log(`Regular User Token: ${userToken.substring(0, 20)}...`);
        console.log(`Regular User API Key: ${apiKey.substring(0, 20)}...`);
        console.log('');
        console.log(`Admin User Email: ${adminUser.email}`);
        console.log(`Admin User Broker ID: ${adminBrokerId}`);
        console.log(`Admin User Token: ${adminToken.substring(0, 20)}...`);
        console.log('');
        console.log('All authentication features are working correctly!');
        console.log('=' .repeat(60));

    } catch (error) {
        console.error('❌ Test failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
console.log('⏳ Make sure the server is running on port 3000...\n');
setTimeout(() => {
    testAuthFlow();
}, 1000);
