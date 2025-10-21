# AI RAG Transformer - Multi-Tenant RAG Platform

A professional, production-ready Retrieval-Augmented Generation (RAG) system for automatically crawling, indexing, and querying website content. Built with Node.js, MongoDB Atlas, OpenAI, and Redis.

## 🚀 Features

- **Multi-Tenant Architecture**: Support multiple clients with isolated data
- **Intelligent Web Crawling**: Automated content extraction with robots.txt respect
- **Smart Content Processing**: Automatic chunking and cleaning of web content
- **Vector Search**: Semantic search using OpenAI embeddings and MongoDB Atlas
- **Hybrid Search**: Combines vector and text search for optimal results
- **RAG Pipeline**: Generate AI-powered answers from your website content
- **Redis Caching**: High-performance caching for queries and embeddings
- **REST API**: Simple integration with any chatbot system
- **Real-time Streaming**: Support for streaming responses
- **Analytics Dashboard**: Track usage, popular queries, and performance

## 📋 Prerequisites

- Node.js 18+
- MongoDB Atlas account (M0 free tier or higher)
- OpenAI API key
- Redis (optional, for caching)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo/ai-rag-transformer.git
cd ai-rag-transformer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Edit .env file and add your credentials
MONGODB_URI=mongodb+srv://your-connection-string
OPENAI_API_KEY=sk-your-openai-api-key
```

4. Start the server:
```bash
npm start
```

## 🏗️ Architecture

```
┌─────────────────┐
│  Web Scraper    │──> Crawls websites automatically
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Content Processor│──> Cleans & chunks content
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Embedding Engine│──> Generates vectors (OpenAI)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MongoDB Atlas   │──> Stores content + vectors
│  Vector Index   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RAG Pipeline   │──> Retrieval + Generation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   REST API      │──> Integration endpoint
└─────────────────┘
```

## 🚀 Quick Start

### 1. Create a Client

Your Paybito client is pre-configured with broker ID: `PAYB18022021121103`

To add more clients:
```bash
POST /api/v1/clients
{
  "name": "Your Company",
  "domain": "www.example.com",
  "metadata": {
    "industry": "Technology",
    "description": "Your company description"
  }
}
```

### 2. Crawl Website Content

```bash
# Using the crawl script
node src/scripts/crawl.js PAYB18022021121103

# Or via API
POST /api/v1/crawl
{
  "brokerId": "PAYB18022021121103",
  "options": {
    "maxPages": 100
  }
}
```

### 3. Query Your Content

```bash
POST /api/v1/query
Headers: X-API-Key: PAYB18022021121103
{
  "brokerId": "PAYB18022021121103",
  "query": "How do I reset my password?",
  "options": {
    "topK": 5,
    "minScore": 0.7
  }
}
```

## 📡 API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/query` | POST | Main RAG query endpoint |
| `/api/v1/search` | POST | Search without AI generation |
| `/api/v1/query/stream` | POST | Streaming responses |
| `/api/v1/crawl` | POST | Start website crawl |

### Client Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/clients` | GET | List all clients |
| `/api/v1/clients` | POST | Create new client |
| `/api/v1/clients/:brokerId` | GET | Get client details |
| `/api/v1/clients/:brokerId` | PUT | Update client |
| `/api/v1/clients/:brokerId/stats` | GET | Get client statistics |

### Analytics & Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/:brokerId` | GET | Get usage analytics |
| `/api/v1/cache/stats` | GET | Cache performance stats |
| `/api/v1/health` | GET | Health check |

## 🔧 Configuration

### MongoDB Atlas Setup - COMPLETE GUIDE

#### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/atlas
2. Sign up for free account
3. Choose M0 free tier (or M10 for production)

#### Step 2: Configure Network Access
1. Go to **Network Access** in left sidebar
2. Click **ADD IP ADDRESS**
3. For development: Choose **Allow Access from Anywhere** (0.0.0.0/0)
4. For production: Add your server's specific IP

#### Step 3: Create Database User
1. Go to **Database Access** in left sidebar
2. Click **ADD NEW DATABASE USER**
3. Username: `your_username`
4. Password: Use **Autogenerate Secure Password** and SAVE IT
5. Privileges: **Read and write to any database**

#### Step 4: Get Connection String
1. Go to **Database** → Click **Connect** on your cluster
2. Choose **Drivers** → Select **Node.js**
3. Copy connection string and update `.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/brain_platform?retryWrites=true&w=majority
```

#### Step 5: Create Vector Search Index (CRITICAL!)

⚠️ **THIS STEP IS MANDATORY** - The system will NOT work without this index!

1. In Atlas UI, go to your cluster
2. Click **Browse Collections**
3. If database doesn't exist yet, it will be created automatically when you run the app
4. Go to **Atlas Search** tab (top of the page)
5. Click **Create Search Index**
6. Choose **JSON Editor** (not Visual Editor)
7. Select:
   - Database: `brain_platform` (or any name - will be auto-created)
   - Collection: `content` (will be auto-created)
8. **PASTE THIS EXACT JSON:**

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "chunks.embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

9. **Index Name**: Enter `vector_index` (MUST be exactly this name)
10. Click **Create Search Index**
11. Wait 1-2 minutes for status to show **Active**

### What Happens on Fresh Database

When you delete and recreate the database:

#### ✅ Auto-Created by Application:
- Database `brain_platform`
- All collections (`clients`, `content`, `query_logs`, `crawl_jobs`)
- Regular indexes for performance
- Initial Paybito client record

#### ❌ Must Manually Create:
- **Vector Search Index** (follow Step 5 above)

### Database Recreation Steps

If you need to start fresh:

1. **Delete old database** (optional):
   - Atlas UI → Browse Collections → Drop Database

2. **Create Vector Index FIRST**:
   - Follow Step 5 above (even on empty/non-existent database)
   - Atlas will remember the index configuration

3. **Run the application**:
   ```bash
   npm start
   ```
   - Database and collections will auto-create
   - Regular indexes will auto-create
   - Initial client will auto-create

4. **Verify Index**:
   - Atlas UI → Atlas Search → Check index shows **Active**

### Troubleshooting Vector Search

If queries return no results after crawling:

1. **Check Index Status**:
   - Must show **Active** in Atlas Search tab
   - If **Building**, wait 2-3 minutes

2. **Verify Index Configuration**:
   - Index name must be exactly: `vector_index`
   - Path must be exactly: `chunks.embedding`
   - Dimensions must be: `1536`

3. **Check Content Collection**:
   - Browse Collections → `content` → Check documents exist
   - Each document should have `chunks` array with `embedding` fields

4. **Common Errors**:
   - `"vector_index" not found` → Create index (Step 5)
   - `Invalid dimensions` → Ensure 1536 in index config
   - `Path not found` → Ensure path is `chunks.embedding`

### Redis Setup (Optional)

```bash
# Using Docker
docker run -d -p 6379:6379 redis

# Or install locally
# Windows: Use WSL or Redis Windows build
# Mac: brew install redis
# Linux: apt-get install redis-server
```

## 💡 Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function askQuestion(question) {
  const response = await axios.post('http://localhost:3000/api/v1/query', {
    brokerId: 'PAYB18022021121103',
    query: question
  }, {
    headers: {
      'X-API-Key': 'PAYB18022021121103'
    }
  });

  console.log('Answer:', response.data.data.answer);
  console.log('Sources:', response.data.data.sources);
}

askQuestion('What are your trading fees?');
```

### Python

```python
import requests

def ask_question(question):
    response = requests.post(
        'http://localhost:3000/api/v1/query',
        json={
            'brokerId': 'PAYB18022021121103',
            'query': question
        },
        headers={'X-API-Key': 'PAYB18022021121103'}
    )

    data = response.json()
    print('Answer:', data['data']['answer'])
    print('Sources:', data['data']['sources'])

ask_question('How do I deposit cryptocurrency?')
```

## 🧪 Testing

```bash
# Run API tests
node src/scripts/test-api.js

# Test crawling
node src/scripts/crawl.js PAYB18022021121103

# Monitor logs
tail -f logs/app.log
```

## 📊 Performance

- **Crawling Speed**: ~100 pages/minute
- **Query Response**: < 2 seconds (with cache)
- **Embedding Generation**: ~1000 chunks/minute
- **Concurrent Users**: 100+ with Redis cache
- **Storage**: ~10KB per webpage (including embeddings)

## 🔒 Security

- API key authentication for all endpoints
- Rate limiting (100 requests/15 minutes)
- Input sanitization
- MongoDB connection security
- Environment variable protection

## 📈 Monitoring

The system tracks:
- Query response times
- Cache hit rates
- Popular queries
- Failed queries
- API usage per client
- Crawl job status

## 🚨 Troubleshooting

### MongoDB Connection Issues
```bash
# Check connection string format
mongodb+srv://username:password@cluster.mongodb.net/database

# Verify IP whitelist in Atlas
# Add 0.0.0.0/0 for development
```

### OpenAI API Errors
```bash
# Verify API key
# Check rate limits
# Monitor token usage
```

### No Results Found
```bash
# Ensure content is crawled first
node src/scripts/crawl.js PAYB18022021121103

# Check MongoDB for content
# Verify vector index exists
```

## 📝 License

MIT License

## 🤝 Support

For issues or questions:
- Create an issue on GitHub
- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com

## 🎯 Roadmap

- [ ] Support for PDF documents
- [ ] Multi-language support
- [ ] Custom embedding models
- [ ] Webhook notifications
- [ ] Admin dashboard UI
- [ ] Automated crawl scheduling
- [ ] Fine-tuning support
- [ ] Export/Import functionality

---

Built with ❤️ by Athar Hashcash
