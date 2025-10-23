const express = require('express');
const router = express.Router();
const clientManager = require('../services/clientManager');
const crawlerController = require('../controllers/crawlerController');
const ragController = require('../controllers/ragController');
const chatController = require('../controllers/chatController');
const widgetManager = require('../services/widgetManager');
const userManager = require('../services/userManager');
const { authenticateJWT, rateLimiter } = require('../middleware/auth');

// ============================================================================
// USER ROUTES - All routes automatically filtered by user's brokerId
// ============================================================================

// Middleware to inject user context
router.use(authenticateJWT);

// ============================================================================
// User's Websites Management
// ============================================================================

// Get user's own websites
router.get('/websites', async (req, res) => {
    try {
        const { page, limit, status, search } = req.query;

        // Automatically filter by owner (current user's brokerId)
        const filters = {
            owner: req.user.brokerId,
            status,
            search
        };

        const result = await clientManager.listClients(
            filters,
            { page: parseInt(page) || 1, limit: parseInt(limit) || 10 }
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[User API] List websites error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create a new website (automatically assigns current user as owner)
router.post('/websites', async (req, res) => {
    try {
        // Check if user already has a website (one website per user limit)
        const existingWebsites = await clientManager.listClients(
            { owner: req.user.brokerId },
            { limit: 1 }
        );

        if (existingWebsites.clients && existingWebsites.clients.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'You already have a website. Each user can only create one website. You can add multiple domains/subdomains to your existing website.'
            });
        }

        // Automatically add owner info from authenticated user
        const clientData = {
            ...req.body,
            owner: req.user.brokerId,
            ownerEmail: req.user.email
        };

        const client = await clientManager.createClient(clientData);

        res.status(201).json({
            success: true,
            data: client,
            message: 'Website added successfully'
        });
    } catch (error) {
        console.error('[User API] Create website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific website (only if owned by user)
router.get('/websites/:brokerId', async (req, res) => {
    try {
        const client = await clientManager.getClient(req.params.brokerId);

        // Verify ownership
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('[User API] Get website error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Update website (only if owned by user)
router.put('/websites/:brokerId', async (req, res) => {
    try {
        // First verify ownership
        const existingClient = await clientManager.getClient(req.params.brokerId);

        if (existingClient.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const client = await clientManager.updateClient(req.params.brokerId, req.body);

        res.json({
            success: true,
            data: client,
            message: 'Website updated successfully'
        });
    } catch (error) {
        console.error('[User API] Update website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Delete website (only if owned by user)
router.delete('/websites/:brokerId', async (req, res) => {
    try {
        // First verify ownership
        const existingClient = await clientManager.getClient(req.params.brokerId);

        if (existingClient.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        await clientManager.deleteClient(req.params.brokerId);

        res.json({
            success: true,
            message: 'Website deleted successfully'
        });
    } catch (error) {
        console.error('[User API] Delete website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get website stats (only if owned by user)
router.get('/websites/:brokerId/stats', async (req, res) => {
    try {
        const client = await clientManager.getClient(req.params.brokerId);

        // Verify ownership
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const stats = await clientManager.getClientStats(req.params.brokerId);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[User API] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Crawling Routes (User's own websites)
// ============================================================================

// Start crawl for user's website
router.post('/crawl', async (req, res) => {
    try {
        const { brokerId, options } = req.body;

        // Verify ownership
        const client = await clientManager.getClient(brokerId);
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const jobId = await crawlerController.startCrawl(brokerId, options);

        res.json({
            success: true,
            data: {
                jobId,
                message: 'Crawl job started',
                status: 'processing'
            }
        });
    } catch (error) {
        console.error('[User API] Start crawl error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get crawl status
router.get('/crawl/:jobId/status', async (req, res) => {
    try {
        const status = await crawlerController.getCrawlStatus(req.params.jobId);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[User API] Get crawl status error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================================================
// Query & Chat Routes (User's own websites)
// ============================================================================

// Query user's website
router.post('/query', rateLimiter, async (req, res) => {
    try {
        const { brokerId, query, options = {} } = req.body;

        if (!brokerId || !query) {
            return res.status(400).json({
                success: false,
                error: 'brokerId and query are required'
            });
        }

        // Verify ownership
        const client = await clientManager.getClient(brokerId);
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const result = await ragController.processQuery(brokerId, query, options);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[User API] Query error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Chat endpoint with session management
router.post('/chat', rateLimiter, async (req, res) => {
    await chatController.handleChatMessage(req, res);
});

// Get chat session history
router.get('/chat/session/:sessionId', async (req, res) => {
    await chatController.getSessionHistory(req, res);
});

// Clear chat session
router.delete('/chat/session/:sessionId', async (req, res) => {
    await chatController.clearSession(req, res);
});

// Create new session
router.post('/session/new', async (req, res) => {
    await chatController.createNewSession(req, res);
});

// ============================================================================
// User Dashboard Stats
// ============================================================================

// Get user dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const db = require('../config/database').getDb();

        // Count user's websites
        const websiteCount = await clientManager.collection.countDocuments({
            owner: req.user.brokerId
        });

        // Get total pages crawled for user's websites
        const userWebsites = await clientManager.collection
            .find({ owner: req.user.brokerId })
            .project({ brokerId: 1 })
            .toArray();

        const brokerIds = userWebsites.map(w => w.brokerId);

        const totalPages = await db.collection('content').countDocuments({
            brokerId: { $in: brokerIds }
        });

        const totalQueries = await db.collection('query_logs').countDocuments({
            brokerId: { $in: brokerIds }
        });

        res.json({
            success: true,
            data: {
                websites: websiteCount,
                crawledPages: totalPages,
                totalQueries: totalQueries
            }
        });
    } catch (error) {
        console.error('[User API] Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Widget Settings Routes
// ============================================================================

// Get widget settings for user's website
router.get('/widget/:brokerId', async (req, res) => {
    try {
        const { brokerId } = req.params;

        // Verify ownership
        const client = await clientManager.getClient(brokerId);
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const settings = await widgetManager.getSettings(brokerId);

        res.json({
            success: true,
            data: {
                settings
            }
        });
    } catch (error) {
        console.error('[User API] Get widget settings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update widget settings for user's website
router.put('/widget/:brokerId', async (req, res) => {
    try {
        const { brokerId } = req.params;

        // Verify ownership
        const client = await clientManager.getClient(brokerId);
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const settings = await widgetManager.updateSettings(brokerId, req.body);

        res.json({
            success: true,
            data: {
                settings
            },
            message: 'Widget settings updated successfully'
        });
    } catch (error) {
        console.error('[User API] Update widget settings error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get widget API key for user
router.get('/widget/:brokerId/api-key', async (req, res) => {
    try {
        const { brokerId } = req.params;
        // Verify ownership
        const client = await clientManager.getClient(brokerId);
        if (client.owner !== req.user.brokerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this website.'
            });
        }

        const apiKeyData = await userManager.getWidgetApiKey(brokerId);

        res.json({
            success: true,
            data: apiKeyData
        });
    } catch (error) {
        console.error('[User API] Get widget API key error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
