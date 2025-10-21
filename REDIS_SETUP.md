# Redis Setup Guide

## Current Status

✅ Redis configuration updated to use `localhost`
⚠️ Redis is **optional** - the application works without it (caching disabled)

## Option 1: Run Without Redis (Current)

The application is already configured to work without Redis. When Redis is unavailable:
- ✅ All features work normally
- ✅ Authentication works
- ✅ Queries work
- ⚠️ No caching (slightly slower repeated queries)

**No action needed!** The app will automatically detect Redis is unavailable and continue.

## Option 2: Install Redis on Windows

### Using Memurai (Redis for Windows)

1. **Download Memurai** (Redis-compatible for Windows):
   ```
   https://www.memurai.com/get-memurai
   ```

2. **Install Memurai Developer Edition** (free)

3. **Start Memurai**:
   - It runs as a Windows service automatically
   - Default: `localhost:6379`

4. **Verify Installation**:
   ```bash
   memurai-cli ping
   # Should return: PONG
   ```

### Using WSL2 (Windows Subsystem for Linux)

1. **Install WSL2**:
   ```powershell
   wsl --install
   ```

2. **Install Redis in WSL**:
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

3. **Start Redis**:
   ```bash
   sudo service redis-server start
   ```

4. **Test**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

## Option 3: Use Docker

1. **Install Docker Desktop** for Windows:
   ```
   https://www.docker.com/products/docker-desktop
   ```

2. **Run Redis Container**:
   ```bash
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

3. **Verify**:
   ```bash
   docker ps
   # Should show redis container running
   ```

4. **Stop/Start**:
   ```bash
   docker stop redis
   docker start redis
   ```

## Testing Redis Connection

After installing Redis, restart the backend server:

```bash
cd C:\work\rag_transformer
node index.js
```

You should see:
```
[Cache] Redis connected successfully
```

Instead of:
```
[Cache] Redis not available - running without cache
```

## Current .env Configuration

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Benefits of Using Redis

When Redis is enabled:
- ✅ **Faster queries** - Cached responses return instantly
- ✅ **Reduced API costs** - Fewer OpenAI API calls for repeated queries
- ✅ **Better performance** - Embedding caching speeds up vector search
- ✅ **Rate limiting** - More accurate request tracking

## Without Redis

- ✅ All features work
- ⚠️ No query caching
- ⚠️ No embedding caching
- ⚠️ Basic rate limiting (in-memory)
- ⚠️ Slower repeated queries

## Recommendation

**For Development**: Run without Redis - it's simpler and works fine

**For Production**: Install Redis for better performance and caching

## Current Setup

Your application is currently configured to:
1. Try to connect to Redis at `localhost:6379`
2. If connection fails, continue without Redis
3. Log: "Redis not available - running without cache"

This is the **recommended development setup** unless you need to test caching specifically.
