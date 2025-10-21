const redis = require('redis');

class CacheService {
    constructor() {
        this.client = null;
        this.connected = false;
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    async connect() {
        try {
            // Try to connect to Redis, but continue without it if not available

            // If test succeeded, create actual connection
            this.client = redis.createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379
                },
                password: process.env.REDIS_PASSWORD || undefined,
                database: 0
            });

            this.client.on('error', (err) => {
                // Silently handle errors
                this.stats.errors++;
            });

            this.client.on('connect', () => {
                console.log('[Cache] Redis connected successfully');
                this.connected = true;
            });

            await this.client.connect();
            return true;

        } catch (error) {
            console.log('[Cache] Redis not available - running without cache');
            this.connected = false;
            this.client = null;
            return false;
        }
    }

    async get(key) {
        if (!this.connected || !this.client) {
            this.stats.misses++;
            return null;
        }

        try {
            const value = await this.client.get(key);

            if (value) {
                this.stats.hits++;
                console.log(`[Cache] Hit for key: ${key.substring(0, 20)}...`);
            } else {
                this.stats.misses++;
            }

            return value;
        } catch (error) {
            console.error('[Cache] Get error:', error.message);
            this.stats.errors++;
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

            if (ttl) {
                await this.client.setEx(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }

            console.log(`[Cache] Set key: ${key.substring(0, 20)}... (TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            console.error('[Cache] Set error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async delete(key) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            await this.client.del(key);
            console.log(`[Cache] Deleted key: ${key.substring(0, 20)}...`);
            return true;
        } catch (error) {
            console.error('[Cache] Delete error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async deletePattern(pattern) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            const keys = await this.client.keys(pattern);

            if (keys.length > 0) {
                await this.client.del(keys);
                console.log(`[Cache] Deleted ${keys.length} keys matching pattern: ${pattern}`);
            }

            return true;
        } catch (error) {
            console.error('[Cache] Delete pattern error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async flush() {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            await this.client.flushDb();
            console.log('[Cache] Flushed all cache');
            this.resetStats();
            return true;
        } catch (error) {
            console.error('[Cache] Flush error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async exists(key) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            console.error('[Cache] Exists error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async expire(key, ttl) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            await this.client.expire(key, ttl);
            return true;
        } catch (error) {
            console.error('[Cache] Expire error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    async increment(key, amount = 1) {
        if (!this.connected || !this.client) {
            return 0;
        }

        try {
            const value = await this.client.incrBy(key, amount);
            return value;
        } catch (error) {
            console.error('[Cache] Increment error:', error.message);
            this.stats.errors++;
            return 0;
        }
    }

    async getMultiple(keys) {
        if (!this.connected || !this.client || keys.length === 0) {
            return {};
        }

        try {
            const values = await this.client.mGet(keys);
            const result = {};

            keys.forEach((key, index) => {
                if (values[index]) {
                    result[key] = values[index];
                    this.stats.hits++;
                } else {
                    this.stats.misses++;
                }
            });

            return result;
        } catch (error) {
            console.error('[Cache] Get multiple error:', error.message);
            this.stats.errors++;
            return {};
        }
    }

    async setMultiple(keyValuePairs, ttl = 3600) {
        if (!this.connected || !this.client) {
            return false;
        }

        try {
            const pipeline = this.client.multi();

            Object.entries(keyValuePairs).forEach(([key, value]) => {
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                if (ttl) {
                    pipeline.setEx(key, ttl, stringValue);
                } else {
                    pipeline.set(key, stringValue);
                }
            });

            await pipeline.exec();
            console.log(`[Cache] Set ${Object.keys(keyValuePairs).length} keys`);
            return true;
        } catch (error) {
            console.error('[Cache] Set multiple error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    // Cache invalidation for specific broker
    async invalidateBroker(brokerId) {
        const patterns = [
            `search:*:${brokerId}:*`,
            `answer:*:${brokerId}:*`,
            `content:${brokerId}:*`
        ];

        for (const pattern of patterns) {
            await this.deletePattern(pattern);
        }

        console.log(`[Cache] Invalidated cache for broker: ${brokerId}`);
    }

    // Cache warming
    async warmCache(key, generator, ttl = 3600) {
        const cached = await this.get(key);
        if (cached) {
            return JSON.parse(cached);
        }

        const value = await generator();
        await this.set(key, JSON.stringify(value), ttl);
        return value;
    }

    // Get cache statistics
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            total,
            hitRate: `${hitRate}%`,
            connected: this.connected
        };
    }

    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.connected = false;
            console.log('[Cache] Redis disconnected');
        }
    }

    // Rate limiting using Redis
    async checkRateLimit(identifier, limit = 100, window = 3600) {
        if (!this.connected || !this.client) {
            return { allowed: true, remaining: limit };
        }

        const key = `ratelimit:${identifier}`;

        try {
            const current = await this.client.incr(key);

            if (current === 1) {
                await this.client.expire(key, window);
            }

            const ttl = await this.client.ttl(key);
            const allowed = current <= limit;
            const remaining = Math.max(0, limit - current);

            return {
                allowed,
                remaining,
                reset: Date.now() + (ttl * 1000)
            };
        } catch (error) {
            console.error('[Cache] Rate limit error:', error.message);
            return { allowed: true, remaining: limit };
        }
    }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;