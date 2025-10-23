const database = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateApiKey } = require('../utils/apiKey');
class UserManager {
    constructor() {
        this.collection = null;
    }

    async initialize() {
        const db = database.getDb();
        this.collection = db.collection('users');

        // Create unique index on email
        await this.collection.createIndex({ email: 1 }, { unique: true });
        await this.collection.createIndex({ brokerId: 1 }, { unique: true });

        console.log('[UserManager] Initialized');
    }

    async createUser(userData) {
        const {
            email,
            password,
            companyName,
            userType = 'USER',
            profile = {},
            subscription = {}
        } = userData;

        // Validate required fields (password is now optional for OTP-only auth)
        if (!email || !companyName) {
            throw new Error('Email and company name are required');
        }

        // Check if user already exists
        const existingUser = await this.collection.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Hash password only if provided (for backward compatibility)
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Generate unique broker ID for this user/company
        const brokerId = this.generateBrokerId(companyName);

        // Set default subscription based on user type
        const defaultSubscription = {
            plan: userType === 'ADMIN' ? 'enterprise' : 'free',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            maxClients: userType === 'ADMIN' ? 999999 : 5,
            maxApiCalls: userType === 'ADMIN' ? 999999 : 1000
        };

        const user = {
            email: email.toLowerCase(),
            password: hashedPassword,
            companyName,
            brokerId,
            userType,
            status: 'active',
            profile: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                phone: profile.phone || '',
                address: profile.address || ''
            },
            subscription: { ...defaultSubscription, ...subscription },
            clients: [],
            apiKeys: [],
            lastLogin: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            const result = await this.collection.insertOne(user);
            console.log(`[UserManager] Created user: ${email} (${brokerId}) - Type: ${userType}`);

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error('User with this email or broker ID already exists');
            }
            throw error;
        }
    }

    async authenticateUser(email, password) {
        const user = await this.collection.findOne({ email: email.toLowerCase() });

        if (!user) {
            throw new Error('Invalid email or password');
        }

        if (user.status !== 'active') {
            throw new Error('Account is not active. Please contact support.');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Update last login
        await this.collection.updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async getUserById(userId) {
        const user = await this.collection.findOne({ _id: userId });
        if (!user) {
            throw new Error('User not found');
        }

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async getUserByBrokerId(brokerId) {
        const user = await this.collection.findOne({ brokerId });
        if (!user) {
            throw new Error('User not found');
        }

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async getUserByEmail(email) {
        const user = await this.collection.findOne({ email: email.toLowerCase() });
        if (!user) {
            return null; // Return null instead of throwing error (for OTP auth flow)
        }

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async updateUser(brokerId, updates) {
        const allowedUpdates = [
            'companyName', 'profile', 'subscription', 'status', 'lastLogin'
        ];

        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }

        updateData.updatedAt = new Date();

        const result = await this.collection.updateOne(
            { brokerId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            throw new Error('User not found');
        }

        return this.getUserByBrokerId(brokerId);
    }

    async changePassword(brokerId, oldPassword, newPassword) {
        const user = await this.collection.findOne({ brokerId });

        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

        if (!isPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.collection.updateOne(
            { brokerId },
            {
                $set: {
                    password: hashedPassword,
                    updatedAt: new Date()
                }
            }
        );

        return { success: true, message: 'Password updated successfully' };
    }

    async addClientToBroker(brokerId, clientBrokerId) {
        const result = await this.collection.updateOne(
            { brokerId },
            {
                $addToSet: { clients: clientBrokerId },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.matchedCount === 0) {
            throw new Error('User not found');
        }

        return { success: true };
    }

    async removeClientFromBroker(brokerId, clientBrokerId) {
        const result = await this.collection.updateOne(
            { brokerId },
            {
                $pull: { clients: clientBrokerId },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.matchedCount === 0) {
            throw new Error('User not found');
        }

        return { success: true };
    }

    async generateApiKey(brokerId, keyName) {
        const apiKey = crypto.randomBytes(32).toString('hex');

        const apiKeyData = {
            key: apiKey,
            name: keyName || 'Default API Key',
            createdAt: new Date(),
            lastUsed: null,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        };

        await this.collection.updateOne(
            { brokerId },
            {
                $push: { apiKeys: apiKeyData },
                $set: { updatedAt: new Date() }
            }
        );

        return apiKey;
    }

    async validateApiKey(apiKey) {
        const user = await this.collection.findOne({
            'apiKeys.key': apiKey,
            status: 'active'
        });

        if (!user) {
            return null;
        }

        // Check if API key is expired
        const keyData = user.apiKeys.find(k => k.key === apiKey);
        if (keyData && keyData.expiresAt < new Date()) {
            return null;
        }

        // Update last used
        await this.collection.updateOne(
            { brokerId: user.brokerId, 'apiKeys.key': apiKey },
            { $set: { 'apiKeys.$.lastUsed': new Date() } }
        );

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async listUsers(filters = {}, options = {}) {
        const {
            status,
            userType,
            search
        } = filters;

        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = -1
        } = options;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (userType) {
            query.userType = userType;
        }

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { brokerId: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.collection
                .find(query, { projection: { password: 0 } })
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.collection.countDocuments(query)
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    generateBrokerId(companyName) {
        const prefix = companyName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(2).toString('hex').toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    async deleteUser(brokerId) {
        // Note: In production, you might want to delete all related clients and data
        const result = await this.collection.deleteOne({ brokerId });

        if (result.deletedCount === 0) {
            throw new Error('User not found');
        }

        console.log(`[UserManager] Deleted user: ${brokerId}`);
        return { success: true, message: 'User deleted successfully' };
    }
    /**
     * Get or create widget API key for a user
     */
    async getWidgetApiKey(brokerId) {
        const user = await this.collection.findOne({ brokerId });
        if (!user) {
            throw new Error('User not found');
        }

        // Check if widget API key already exists
        const widgetKey = user.apiKeys?.find(k => k.name === 'Widget API Key');
        
        if (widgetKey && widgetKey.expiresAt > new Date()) {
            return {
                apiKey: widgetKey.key,
                createdAt: widgetKey.createdAt,
                expiresAt: widgetKey.expiresAt
            };
        }

        // Generate new widget API key
        const apiKey = generateApiKey();

        const apiKeyData = {
            key: apiKey,
            name: 'Widget API Key',
            createdAt: new Date(),
            lastUsed: null,
            expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) // 10 years
        };

        // Remove old widget API key if exists
        await this.collection.updateOne(
            { brokerId },
            { $pull: { apiKeys: { name: 'Widget API Key' } } }
        );

        // Add new widget API key
        await this.collection.updateOne(
            { brokerId },
            {
                $push: { apiKeys: apiKeyData },
                $set: { updatedAt: new Date() }
            }
        );

        console.log(`[UserManager] Generated widget API key for ${brokerId}`);

        return {
            apiKey: apiKey,
            createdAt: apiKeyData.createdAt,
            expiresAt: apiKeyData.expiresAt
        };
    }

    /**
     * Validate widget API key and check if it belongs to the provided brokerId
     */
    async validateWidgetApiKey(apiKey, brokerId) {
        const { validateApiKeyFormat } = require('../utils/apiKey');
        
        if (!validateApiKeyFormat(apiKey)) {
            return { valid: false, message: 'Invalid API key format' };
        }

        const user = await this.collection.findOne({
            'apiKeys.key': apiKey,
            status: 'active'
        });

        if (!user) {
            return { valid: false, message: 'Invalid API key' };
        }

        // Check if API key is expired
        const keyData = user.apiKeys.find(k => k.key === apiKey);
        if (keyData && keyData.expiresAt < new Date()) {
            return { valid: false, message: 'API key expired' };
        }

        // Check if API key name is Widget API Key
        if (keyData && keyData.name !== 'Widget API Key') {
            return { valid: false, message: 'Not a widget API key' };
        }

        // Check if brokerId matches
        if (user.brokerId !== brokerId) {
            return { valid: false, message: 'API key does not belong to this widget' };
        }

        // Update last used
        await this.collection.updateOne(
            { brokerId: user.brokerId, 'apiKeys.key': apiKey },
            { $set: { 'apiKeys.$.lastUsed': new Date() } }
        );

        return { 
            valid: true, 
            user: { brokerId: user.brokerId, email: user.email, companyName: user.companyName }
        };
    }
}

// Singleton instance
const userManager = new UserManager();

module.exports = userManager;

