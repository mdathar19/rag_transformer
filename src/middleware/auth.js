const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const clientManager = require('../services/clientManager');
const cacheService = require('../services/cacheService');
const userManager = require('../services/userManager');

// JWT Authentication middleware (for user login)
const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication token required'
            });
        }

        // Verify JWT token
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, jwtSecret);

        // Get user from database
        const user = await userManager.getUserByBrokerId(decoded.brokerId);

        if (!user || user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'User account is not active'
            });
        }

        // Attach user info to request
        req.user = user;
        req.brokerId = user.brokerId;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        console.error('[Auth] JWT Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// JWT Authentication for SSE (accepts token from query parameter)
// EventSource doesn't support custom headers, so we use query params
const authenticateSSE = async (req, res, next) => {
    try {
        console.log('hittingggg.')
        // Get token from query parameter
        const token = req.query.token;
console.log('token',token)
        console.log('[Auth SSE] Token from query:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

        if (!token) {
            console.log('[Auth SSE] No token provided in query params');
            return res.status(401).json({
                success: false,
                error: 'Authentication token required'
            });
        }

        // Verify JWT token
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, jwtSecret);
        console.log('[Auth SSE] Token decoded, brokerId:', decoded.brokerId);

        // Get user from database
        const user = await userManager.getUserByBrokerId(decoded.brokerId);

        if (!user || user.status !== 'active') {
            console.log('[Auth SSE] User not found or inactive:', decoded.brokerId);
            return res.status(403).json({
                success: false,
                error: 'User account is not active'
            });
        }

        // Attach user info to request
        req.user = user;
        req.brokerId = user.brokerId;

        console.log('[Auth SSE] Authentication successful for:', user.email);
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        console.error('[Auth] SSE Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// Legacy Authentication middleware (backward compatibility)
const authenticate = async (req, res, next) => {
    try {
        // First, try JWT authentication
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        if (token) {
            try {
                const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
                const decoded = jwt.verify(token, jwtSecret);

                // Get user from database
                const user = await userManager.getUserByBrokerId(decoded.brokerId);

                if (user && user.status === 'active') {
                    req.user = user;
                    req.brokerId = user.brokerId;
                    next();
                    return;
                }
            } catch (jwtError) {
                // JWT verification failed, try other methods
                console.log('[Auth] JWT verification failed, trying other methods');
            }
        }

        // Get broker ID from custom header (for authenticated chat UI)
        const brokerIdFromHeader = req.headers['x-broker-id'];
        const accessToken = req.headers['x-api-key'];

        // If broker ID is provided in header (from authenticated chat UI)
        if (brokerIdFromHeader && accessToken) {
            // Validate that the broker exists
            const brokerExists = await clientManager.validateApiKey(brokerIdFromHeader);

            if (!brokerExists) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid broker ID'
                });
            }

            // Add broker ID to request
            req.brokerId = brokerIdFromHeader;
            req.userId = req.headers['x-user-id'];
            req.sessionId = req.headers['x-uuid'];
            next();
            return;
        }

        // Fallback to API key authentication (for direct API calls)
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Try to validate as user API key first
        const userByApiKey = await userManager.validateApiKey(apiKey);
        if (userByApiKey) {
            req.user = userByApiKey;
            req.brokerId = userByApiKey.brokerId;
            next();
            return;
        }

        // Validate API key (using brokerId as API key for now)
        const isValid = await clientManager.validateApiKey(apiKey);

        if (!isValid) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or inactive API key'
            });
        }

        // Add broker ID to request
        req.brokerId = apiKey;
        next();
    } catch (error) {
        console.error('[Auth] Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// Rate limiting middleware
const rateLimiter = rateLimit({
    windowMs: parseInt(process.env.API_RATE_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.API_RATE_LIMIT) || 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
        });
    }
});

// Custom rate limiter using Redis
const customRateLimiter = async (req, res, next) => {
    try {
        const identifier = req.brokerId || req.ip;
        const limit = parseInt(process.env.API_RATE_LIMIT) || 100;
        const window = parseInt(process.env.API_RATE_WINDOW_MS) / 1000 || 900;

        const result = await cacheService.checkRateLimit(identifier, limit, window);

        if (!result.allowed) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                retryAfter: result.reset
            });
        }

        // Add rate limit info to response headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.reset);

        next();
    } catch (error) {
        console.error('[RateLimit] Error:', error);
        // Continue if rate limiting fails
        next();
    }
};

const corsMiddleware = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Broker-Id', 'X-User-Id', 'X-UUID']
};
// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('[Error]', err);

    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
};

// Validation middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        next();
    };
};

module.exports = {
    authenticate,
    authenticateJWT,
    authenticateSSE,
    rateLimiter,
    customRateLimiter,
    corsMiddleware,
    errorHandler,
    requestLogger,
    validateRequest
};