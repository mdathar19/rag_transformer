require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const database = require('./src/config/database');
const cacheService = require('./src/services/cacheService');
const clientManager = require('./src/services/clientManager');
const userManager = require('./src/services/userManager');
const chatController = require('./src/controllers/chatController');
const routes = require('./src/api/routes');
const { corsMiddleware, errorHandler, requestLogger } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Create default admin user
async function createDefaultAdmin() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@runit.in';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
        const companyDomain = process.env.ADMIN_COMPANY_DOMAIN || 'https://runit.in';

        // Check if admin already exists
        try {
            await userManager.getUserByEmail(adminEmail);
            console.log('[Server] Admin user already exists');
            return;
        } catch (error) {
            // Admin doesn't exist, create it
        }

        const adminUser = await userManager.createUser({
            email: adminEmail,
            password: adminPassword,
            companyName: 'Runit Platform',
            userType: 'ADMIN',
            profile: {
                firstName: 'Platform',
                lastName: 'Admin',
                phone: '',
                address: ''
            }
        });

        console.log('[Server] ✅ Default admin user created');
        console.log(`[Server] 📧 Email: ${adminEmail}`);
        console.log(`[Server] 🔑 Password: ${adminPassword}`);
        console.log(`[Server] 🆔 Broker ID: ${adminUser.brokerId}`);
        console.log(`[Server] 🌐 Company Domain: ${companyDomain}`);

    } catch (error) {
        console.error('[Server] Error creating default admin:', error.message);
    }
}

// Initialize services
async function initializeServices() {
    try {
        console.log('[Server] Initializing services...');

        // Connect to MongoDB
        await database.connect();

        // Initialize user manager (multi-tenant layer)
        await userManager.initialize();

        // Create default admin user if doesn't exist
        await createDefaultAdmin();

        // Initialize client manager
        await clientManager.initialize();

        // Connect to Redis (optional - will work without it)
        await cacheService.connect();

        // Initialize chat controller
        await chatController.initialize();

        console.log('[Server] All services initialized successfully');
    } catch (error) {
        console.error('[Server] Failed to initialize services:', error);
        process.exit(1);
    }
}

// Configure middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for chat UI
}));
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static files for chat UI
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/v1', routes);


// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'AI RAG Transformer',
        version: '1.0.1',
        status: 'operational',
        endpoints: {
            health: '/api/v1/health',
            query: '/api/v1/query',
            chat: '/api/v1/chat',
            search: '/api/v1/search',
            clients: '/api/v1/clients',
            crawl: '/api/v1/crawl',
            documentation: 'https://github.com/your-repo/docs'
        },
        authentication: 'Required via URL parameters: brokerId, uuid, accessToken'
    });
});

// Error handling
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Graceful shutdown
async function gracefulShutdown() {
    console.log('[Server] Shutting down gracefully...');

    await database.disconnect();
    await cacheService.disconnect();

    process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
    try {
        await initializeServices();
        app.listen(PORT, () => {
            console.log(`[Server] AI RAG Transformer is running on port ${PORT}`);
            console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[Server] MongoDB: Connected`);
            console.log(`[Server] Redis: ${cacheService.connected ? 'Connected' : 'Not connected (running without cache)'}`);
            console.log(`[Server] Ready to accept requests`);
            console.log(`\n[Server] Access Points:`);
            console.log(`  🌐 Chat UI: http://localhost:${PORT}/chat-bot.html?brokerId=<BROKER_ID>&uuid=<UUID>&accessToken=<TOKEN>`);
            console.log(`  📊 Health Check: http://localhost:${PORT}/api/v1/health`);
            console.log(`  🔍 Query Endpoint: POST http://localhost:${PORT}/api/v1/query`);
            console.log(`  💬 Chat Endpoint: POST http://localhost:${PORT}/api/v1/chat`);
            console.log(`  ⚠️  Authentication required via URL parameters for chat UI\n`);
        });
    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

// Start the application
startServer();