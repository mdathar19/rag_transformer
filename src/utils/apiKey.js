const crypto = require('crypto');

/**
 * Generate a secure API key
 * Format: runit_live_<random_32_chars>
 */
function generateApiKey() {
    const randomBytes = crypto.randomBytes(24);
    const apiKey = `runit_live_${randomBytes.toString('hex')}`;
    return apiKey;
}

/**
 * Hash API key for secure storage
 */
function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate API key format
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey) return false;
    return /^runit_live_[a-f0-9]{48}$/.test(apiKey);
}

module.exports = {
    generateApiKey,
    hashApiKey,
    validateApiKeyFormat
};
