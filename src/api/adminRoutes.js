const express = require('express');
const router = express.Router();
const clientManager = require('../services/clientManager');
const userManager = require('../services/userManager');
const crawlerController = require('../controllers/crawlerController');
const ragController = require('../controllers/ragController');
const chatController = require('../controllers/chatController');
const logStreamService = require('../services/logStreamService');
const { authenticateJWT, authenticateSSE, rateLimiter } = require('../middleware/auth');

// ============================================================================
// ADMIN ROUTES - Full access to all data
// ============================================================================

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.userType !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
    next();
};

// Apply authentication and admin check to all routes
router.use(authenticateJWT);
router.use(requireAdmin);

// ============================================================================
// Admin - Website Management (All Websites)
// ============================================================================

// Get all websites
router.get('/websites', async (req, res) => {
    try {
        const { page, limit, status, industry, search, owner } = req.query;

        // Admin can see all websites, optionally filter by owner
        const filters = { status, industry, search };
        if (owner) {
            filters.owner = owner;
        }

        const result = await clientManager.listClients(
            filters,
            { page: parseInt(page) || 1, limit: parseInt(limit) || 10 }
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Admin API] List websites error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create website (can create for any user)
router.post('/websites', async (req, res) => {
    try {
        const client = await clientManager.createClient(req.body);

        res.status(201).json({
            success: true,
            data: client,
            message: 'Website created successfully'
        });
    } catch (error) {
        console.error('[Admin API] Create website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get any website
router.get('/websites/:brokerId', async (req, res) => {
    try {
        const client = await clientManager.getClient(req.params.brokerId);

        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('[Admin API] Get website error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Update any website
router.put('/websites/:brokerId', async (req, res) => {
    try {
        const client = await clientManager.updateClient(req.params.brokerId, req.body);

        res.json({
            success: true,
            data: client,
            message: 'Website updated successfully'
        });
    } catch (error) {
        console.error('[Admin API] Update website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Delete any website
router.delete('/websites/:brokerId', async (req, res) => {
    try {
        await clientManager.deleteClient(req.params.brokerId);

        res.json({
            success: true,
            message: 'Website deleted successfully'
        });
    } catch (error) {
        console.error('[Admin API] Delete website error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get website stats
router.get('/websites/:brokerId/stats', async (req, res) => {
    try {
        const stats = await clientManager.getClientStats(req.params.brokerId);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[Admin API] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update no-answer response for any website
router.put('/websites/:brokerId/no-answer-response', async (req, res) => {
    try {
        const { noDataResponse } = req.body;

        if (!noDataResponse) {
            return res.status(400).json({
                success: false,
                error: 'noDataResponse field is required'
            });
        }

        const client = await clientManager.updateClient(req.params.brokerId, { noDataResponse });

        res.json({
            success: true,
            data: {
                brokerId: client.brokerId,
                name: client.name,
                noDataResponse: client.noDataResponse
            },
            message: 'Custom no-answer response updated successfully'
        });
    } catch (error) {
        console.error('[Admin API] Update no-answer response error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Admin - User Management
// ============================================================================

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, userType } = req.query;

        const query = {};
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

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [users, total] = await Promise.all([
            userManager.collection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .project({ password: 0 }) // Exclude password
                .toArray(),
            userManager.collection.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[Admin API] List users error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific user
router.get('/users/:brokerId', async (req, res) => {
    try {
        const user = await userManager.getUserByBrokerId(req.params.brokerId);

        // Remove password from response
        delete user.password;

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('[Admin API] Get user error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Update user
router.put('/users/:brokerId', async (req, res) => {
    try {
        const user = await userManager.updateUser(req.params.brokerId, req.body);

        // Remove password from response
        delete user.password;

        res.json({
            success: true,
            data: user,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('[Admin API] Update user error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Delete user
router.delete('/users/:brokerId', async (req, res) => {
    try {
        await userManager.deleteUser(req.params.brokerId);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('[Admin API] Delete user error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Admin - Crawling Management
// ============================================================================

// Start crawl for any website
router.post('/crawl', async (req, res) => {
    try {
        const { brokerId, options } = req.body;
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
        console.error('[Admin API] Start crawl error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Batch crawl
router.post('/crawl/batch', async (req, res) => {
    try {
        const { brokerIds } = req.body;
        const jobs = await crawlerController.batchCrawl(brokerIds);

        res.json({
            success: true,
            data: {
                jobs,
                message: `Started ${jobs.length} crawl jobs`
            }
        });
    } catch (error) {
        console.error('[Admin API] Batch crawl error:', error);
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
        console.error('[Admin API] Get crawl status error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Stream crawl logs in real-time (Server-Sent Events)
// Note: Uses authenticateSSE + requireAdmin for token from query param
router.get('/crawl/:jobId/logs', authenticateSSE, requireAdmin, (req, res) => {
    const { jobId } = req.params;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Register client
    logStreamService.addClient(jobId, res);

    // Handle client disconnect
    req.on('close', () => {
        logStreamService.removeClient(jobId, res);
    });
});

// ============================================================================
// Admin - System Stats & Analytics
// ============================================================================

// Get system-wide dashboard stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const db = require('../config/database').getDb();

        const [totalUsers, totalWebsites, totalPages, totalQueries] = await Promise.all([
            userManager.collection.countDocuments({}),
            clientManager.collection.countDocuments({}),
            db.collection('content').countDocuments({}),
            db.collection('query_logs').countDocuments({})
        ]);

        res.json({
            success: true,
            data: {
                users: totalUsers,
                websites: totalWebsites,
                crawledPages: totalPages,
                totalQueries: totalQueries
            }
        });
    } catch (error) {
        console.error('[Admin API] Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get analytics for any website
router.get('/analytics/:brokerId', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await ragController.getAnalytics(
            req.params.brokerId,
            { startDate, endDate }
        );

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('[Admin API] Get analytics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Admin - Content Management
// ============================================================================

// Get content for any website
router.get('/content/:brokerId', async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const content = await ragController.getContent(
            req.params.brokerId,
            { page: parseInt(page), limit: parseInt(limit), search }
        );

        res.json({
            success: true,
            data: content
        });
    } catch (error) {
        console.error('[Admin API] Get content error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete content
router.delete('/content/:brokerId/:contentId', async (req, res) => {
    try {
        await ragController.deleteContent(req.params.brokerId, req.params.contentId);

        res.json({
            success: true,
            message: 'Content deleted successfully'
        });
    } catch (error) {
        console.error('[Admin API] Delete content error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Admin - Cache Management
// ============================================================================

// Clear cache for specific broker
router.post('/cache/clear', async (req, res) => {
    try {
        const { brokerId } = req.body;
        await ragController.clearCache(brokerId);

        res.json({
            success: true,
            message: `Cache cleared for broker ${brokerId}`
        });
    } catch (error) {
        console.error('[Admin API] Clear cache error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get cache stats
router.get('/cache/stats', async (req, res) => {
    try {
        const stats = await ragController.getCacheStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[Admin API] Get cache stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// Admin - Query & Chat (Any Website)
// ============================================================================

// Query any website
router.post('/query', rateLimiter, async (req, res) => {
    try {
        const { brokerId, query, options = {} } = req.body;

        if (!brokerId || !query) {
            return res.status(400).json({
                success: false,
                error: 'brokerId and query are required'
            });
        }

        const result = await ragController.processQuery(brokerId, query, options);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Admin API] Query error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Chat endpoint
router.post('/chat', rateLimiter, async (req, res) => {
    await chatController.handleChatMessage(req, res);
});

module.exports = router;
