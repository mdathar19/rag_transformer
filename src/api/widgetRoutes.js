const express = require('express');
const router = express.Router();
const widgetManager = require('../services/widgetManager');
const chatController = require('../controllers/chatController');
const clientManager = require('../services/clientManager');
const userManager = require('../services/userManager');
const { rateLimiter } = require('../middleware/auth');

// ============================================================================
// PUBLIC WIDGET ROUTES - No authentication required
// These routes are used by the embedded chat widget on client websites
// ============================================================================

// Get widget settings (public - requires API key)
router.get('/config/:brokerId', async (req, res) => {
    try {
        const { brokerId } = req.params;
        const { apiKey } = req.query;

        // Validate API key is provided
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key is required'
            });
        }

        // Validate API key belongs to this brokerId
        const validation = await userManager.validateWidgetApiKey(apiKey, brokerId);
        if (!validation.valid) {
            return res.status(403).json({
                success: false,
                error: validation.message || 'Invalid API key'
            });
        }

        // Check if broker exists
        try {
            await clientManager.getClient(brokerId);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Widget not found'
            });
        }

        // Get widget settings
        const settings = await widgetManager.getSettings(brokerId);

        // Don't expose the widget if it's disabled
        if (!settings.enabled) {
            return res.status(403).json({
                success: false,
                error: 'Widget is currently disabled'
            });
        }

        // Return only public-facing settings (exclude internal config)
        const publicSettings = {
            brokerId: settings.brokerId,
            enabled: settings.enabled,
            greetingMessage: settings.greetingMessage,
            primaryColor: settings.primaryColor,
            secondaryColor: settings.secondaryColor,
            textColor: settings.textColor,
            position: settings.position,
            widgetTitle: settings.widgetTitle,
            placeholderText: settings.placeholderText,
            logoUrl: settings.logoUrl,
            settings: settings.settings,
            branding: settings.branding
        };

        res.json({
            success: true,
            data: publicSettings
        });
    } catch (error) {
        console.error('[Widget API] Get config error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load widget configuration'
        });
    }
});

// Widget chat endpoint (public - uses rate limiting and API key)
router.post('/chat', rateLimiter, async (req, res) => {
    try {
        const { brokerId, query, sessionId, apiKey } = req.body;

        if (!brokerId || !query) {
            return res.status(400).json({
                success: false,
                error: 'brokerId and query are required'
            });
        }

        // Validate API key is provided
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key is required'
            });
        }

        // Validate API key belongs to this brokerId
        const validation = await userManager.validateWidgetApiKey(apiKey, brokerId);
        if (!validation.valid) {
            return res.status(403).json({
                success: false,
                error: validation.message || 'Invalid API key'
            });
        }

        // Check if widget is enabled
        const isEnabled = await widgetManager.isWidgetEnabled(brokerId);
        if (!isEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Widget is currently disabled'
            });
        }

        // Check if broker exists
        try {
            await clientManager.getClient(brokerId);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Widget not found'
            });
        }

        // Create a mock request object for the chat controller
        const mockReq = {
            body: {
                brokerId,
                query,
                sessionId
            },
            headers: req.headers,
            ip: req.ip
        };

        // Handle chat using existing chat controller
        await chatController.handleChatMessage(mockReq, res);

    } catch (error) {
        console.error('[Widget API] Chat error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Failed to process chat message'
            });
        }
    }
});

// Widget health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Widget API is operational',
        version: '1.0.0'
    });
});

module.exports = router;
