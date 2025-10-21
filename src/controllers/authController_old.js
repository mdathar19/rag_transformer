const jwt = require('jsonwebtoken');
const userManager = require('../services/userManager');
const emailService = require('../services/email/emailService');

class AuthController {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.jwtExpiration = process.env.JWT_EXPIRATION || '7d';
        this.otpStore = new Map(); // In-memory OTP storage (use Redis in production)
        this.pendingRegistrations = new Map(); // Store registration data temporarily
    }

    // Generate 6-digit OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Request OTP for Login/Signup
    async requestOTP(req, res) {
        try {
            const { email, type = 'login' } = req.body; // type: 'login' or 'signup'

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }

            // Check if user exists
            const userExists = await userManager.getUserByEmail(email);

            if (type === 'login' && !userExists) {
                return res.status(404).json({
                    success: false,
                    error: 'No account found with this email. Please sign up first.'
                });
            }

            if (type === 'signup' && userExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already registered. Please login instead.'
                });
            }

            const otp = this.generateOTP();
            const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

            this.otpStore.set(email, { otp, expiresAt, type });

            // Send OTP via email
            try {
                await emailService.sendOtpEmail({ email, otp });
                console.log(`[Auth] OTP sent to ${email}: ${otp}`);
            } catch (emailError) {
                console.error('[Auth] Failed to send OTP email:', emailError);
                // Still log OTP for development
                console.log(`\n🔐 OTP for ${email}: ${otp}\n`);
            }

            res.json({
                success: true,
                message: 'OTP sent successfully to your email',
                data: {
                    expiresIn: 900, // 15 minutes in seconds
                    ...(process.env.NODE_ENV === 'development' && { otp }) // Only in dev
                }
            });
        } catch (error) {
            console.error('[AuthController] Request OTP error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Verify OTP
    async verifyOTP(req, res) {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and OTP are required'
                });
            }

            const storedOTP = this.otpStore.get(email);

            if (!storedOTP) {
                return res.status(400).json({
                    success: false,
                    error: 'No OTP found for this email'
                });
            }

            if (Date.now() > storedOTP.expiresAt) {
                this.otpStore.delete(email);
                return res.status(400).json({
                    success: false,
                    error: 'OTP has expired'
                });
            }

            if (storedOTP.otp !== otp) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid OTP'
                });
            }

            // OTP is valid, delete it
            this.otpStore.delete(email);

            // Get user by email
            const user = await userManager.getUserByEmail(email);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Update last login
            await userManager.updateUser(user.brokerId, { lastLogin: new Date() });

            // Generate token
            const token = this.generateToken(user);

            res.json({
                success: true,
                message: 'OTP verified successfully',
                data: {
                    user: {
                        email: user.email,
                        companyName: user.companyName,
                        brokerId: user.brokerId,
                        userType: user.userType,
                        status: user.status,
                        subscription: user.subscription,
                        lastLogin: user.lastLogin
                    },
                    token
                }
            });
        } catch (error) {
            console.error('[AuthController] Verify OTP error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Generate JWT token
    generateToken(user) {
        const payload = {
            userId: user._id,
            email: user.email,
            brokerId: user.brokerId,
            userType: user.userType,
            companyName: user.companyName
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiration
        });
    }

    // Register new user
    async register(req, res) {
        try {
            const {
                email,
                password,
                companyName,
                userType,
                profile
            } = req.body;

            // Validate input
            if (!email || !password || !companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, password, and company name are required'
                });
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }

            // Password validation (minimum 6 characters)
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters long'
                });
            }

            // Create user
            const user = await userManager.createUser({
                email,
                password,
                companyName,
                userType: userType || 'USER',
                profile
            });

            // Generate token
            const token = this.generateToken(user);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        email: user.email,
                        companyName: user.companyName,
                        brokerId: user.brokerId,
                        userType: user.userType,
                        status: user.status
                    },
                    token
                }
            });
        } catch (error) {
            console.error('[AuthController] Register error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Login user
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            // Authenticate user
            const user = await userManager.authenticateUser(email, password);

            // Generate token
            const token = this.generateToken(user);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        email: user.email,
                        companyName: user.companyName,
                        brokerId: user.brokerId,
                        userType: user.userType,
                        status: user.status,
                        subscription: user.subscription,
                        lastLogin: user.lastLogin
                    },
                    token
                }
            });
        } catch (error) {
            console.error('[AuthController] Login error:', error);
            res.status(401).json({
                success: false,
                error: error.message
            });
        }
    }

    // Get current user profile
    async getProfile(req, res) {
        try {
            // req.user is set by authentication middleware
            const user = await userManager.getUserByBrokerId(req.user.brokerId);

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('[AuthController] Get profile error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { companyName, profile } = req.body;

            const updates = {};
            if (companyName) updates.companyName = companyName;
            if (profile) updates.profile = { ...req.user.profile, ...profile };

            const user = await userManager.updateUser(req.user.brokerId, updates);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: user
            });
        } catch (error) {
            console.error('[AuthController] Update profile error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { oldPassword, newPassword } = req.body;

            if (!oldPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Old password and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters long'
                });
            }

            await userManager.changePassword(req.user.brokerId, oldPassword, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('[AuthController] Change password error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // Generate API key for user
    async generateApiKey(req, res) {
        try {
            const { keyName } = req.body;

            const apiKey = await userManager.generateApiKey(
                req.user.brokerId,
                keyName || 'API Key'
            );

            res.json({
                success: true,
                message: 'API key generated successfully',
                data: {
                    apiKey,
                    note: 'Please save this API key. You will not be able to see it again.'
                }
            });
        } catch (error) {
            console.error('[AuthController] Generate API key error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Verify token (useful for frontend to check if token is still valid)
    async verifyToken(req, res) {
        try {
            // If we reach here, token is valid (middleware already verified it)
            res.json({
                success: true,
                message: 'Token is valid',
                data: {
                    user: {
                        email: req.user.email,
                        brokerId: req.user.brokerId,
                        userType: req.user.userType,
                        companyName: req.user.companyName
                    }
                }
            });
        } catch (error) {
            res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    }

    // Refresh token
    async refreshToken(req, res) {
        try {
            // Generate new token with same user data
            const token = this.generateToken(req.user);

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: { token }
            });
        } catch (error) {
            console.error('[AuthController] Refresh token error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

// Singleton instance
const authController = new AuthController();

module.exports = authController;
