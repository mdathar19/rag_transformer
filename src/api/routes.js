const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authenticateJWT, authenticateSSE } = require('../middleware/auth');

// Import separate route modules
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');

// ============================================================================
// COMMON ROUTES - Available to all
// ============================================================================

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// ============================================================================
// Authentication Routes (Public - No authentication required)
// ============================================================================

// Request OTP for login (existing user)
router.post('/auth/request-login-otp', (req, res) => authController.requestLoginOTP(req, res));

// Request OTP for signup (new user)
router.post('/auth/request-signup-otp', (req, res) => authController.requestSignupOTP(req, res));

// Verify OTP and login
router.post('/auth/verify-login-otp', (req, res) => authController.verifyLoginOTP(req, res));

// Verify OTP and complete signup
router.post('/auth/verify-signup-otp', (req, res) => authController.verifySignupOTP(req, res));

// Verify token
router.get('/auth/verify', authenticateJWT, (req, res) => authController.verifyToken(req, res));

// Refresh token
router.post('/auth/refresh', authenticateJWT, (req, res) => authController.refreshToken(req, res));

// ============================================================================
// User Profile Routes (Protected - JWT authentication required)
// ============================================================================

// Get current user profile
router.get('/auth/profile', authenticateJWT, (req, res) => authController.getProfile(req, res));

// Update user profile
router.put('/auth/profile', authenticateJWT, (req, res) => authController.updateProfile(req, res));

// Generate API key
router.post('/auth/api-key', authenticateJWT, (req, res) => authController.generateApiKey(req, res));

// ============================================================================
// LEGACY CLIENT ROUTES (Backward compatibility)
// ============================================================================
// These routes redirect to user or admin routes based on user type

const clientManager = require('../services/clientManager');

// Legacy GET /clients - redirects based on user type
router.get('/clients', authenticateJWT, async (req, res) => {
    try {
        const { page, limit, status, industry, search } = req.query;
        const filters = { status, industry, search };

        // If user is not admin, filter by owner
        if (req.user.userType !== 'ADMIN') {
            filters.owner = req.user.brokerId;
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
        console.error('[Legacy API] List clients error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy POST /clients
router.post('/clients', authenticateJWT, async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            owner: req.user.brokerId,
            ownerEmail: req.user.email
        };

        const client = await clientManager.createClient(clientData);

        res.status(201).json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('[Legacy API] Create client error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy GET /clients/:brokerId
router.get('/clients/:brokerId', authenticate, async (req, res) => {
    try {
        const client = await clientManager.getClient(req.params.brokerId);
        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('[Legacy API] Get client error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy PUT /clients/:brokerId
router.put('/clients/:brokerId', authenticate, async (req, res) => {
    try {
        const client = await clientManager.updateClient(req.params.brokerId, req.body);
        res.json({
            success: true,
            data: client
        });
    } catch (error) {
        console.error('[Legacy API] Update client error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy DELETE /clients/:brokerId
router.delete('/clients/:brokerId', authenticate, async (req, res) => {
    try {
        await clientManager.deleteClient(req.params.brokerId);
        res.json({
            success: true,
            message: 'Client deleted successfully'
        });
    } catch (error) {
        console.error('[Legacy API] Delete client error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy crawl routes
const crawlerController = require('../controllers/crawlerController');
const logStreamService = require('../services/logStreamService');

router.post('/crawl', authenticate, async (req, res) => {
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
        console.error('[Legacy API] Start crawl error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/crawl/:jobId/status', authenticate, async (req, res) => {
    try {
        const status = await crawlerController.getCrawlStatus(req.params.jobId);
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[Legacy API] Get crawl status error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

// Stream crawl logs in real-time (Server-Sent Events)
// Note: Uses authenticateSSE instead of authenticateJWT because EventSource doesn't support custom headers
router.get('/crawl/:jobId/logs',authenticateSSE, (req, res) => {
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
// MOUNT SEPARATE ROUTERS
// ============================================================================

// User routes - for regular users (filtered by owner)
router.use('/user', userRoutes);

// Admin routes - for admin users (full access)
router.use('/admin', adminRoutes);

module.exports = router;
