# API Request Examples for Multi-Domain Clients

## Quick Start: Adding a New Client

### Step 1: Create a New Client (Basic)

The simplest way to add a new client with a single domain:

```bash
POST /api/v1/clients
Content-Type: application/json

{
  "brokerId": "NEWCLIENT001",
  "name": "New Client Name",
  "domains": [
    {
      "url": "https://www.example.com",
      "type": "main"
    }
  ],
  "metadata": {
    "industry": "Technology",
    "description": "Brief description of the client"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "brokerId": "NEWCLIENT001",
    "name": "New Client Name",
    "status": "active",
    "createdAt": "2025-10-17T10:30:00.000Z"
  }
}
```

### Step 2: Start Crawling

After creating the client, initiate the crawl:

```bash
POST /api/v1/crawl
Content-Type: application/json
X-API-Key: NEWCLIENT001

{
  "brokerId": "NEWCLIENT001",
  "options": {
    "type": "full",
    "maxPages": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "crawl_1697544600_abc123",
    "message": "Crawl job started",
    "status": "processing"
  }
}
```

### Step 3: Check Crawl Status

Monitor the crawl progress:

```bash
GET /api/v1/crawl/{jobId}/status
X-API-Key: NEWCLIENT001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "crawl_1697544600_abc123",
    "status": "completed",
    "pagesProcessed": 45,
    "startTime": "2025-10-17T10:31:00.000Z",
    "endTime": "2025-10-17T10:35:30.000Z"
  }
}
```

### Step 4: Set Custom No-Answer Response (Optional)

Configure what users see when the AI doesn't have an answer:

```bash
PUT /api/v1/clients/NEWCLIENT001/no-answer-response
Content-Type: application/json
X-API-Key: NEWCLIENT001

{
  "noDataResponse": "I don't have specific information about that. Please contact our support team at support@example.com or call +1-800-XXX-XXXX for assistance."
}
```

### Step 5: Test Query

Test that your data is searchable:

```bash
POST /api/v1/query
Content-Type: application/json
X-API-Key: NEWCLIENT001

{
  "brokerId": "NEWCLIENT001",
  "query": "What services do you offer?",
  "options": {
    "topK": 5,
    "minScore": 0.7
  }
}
```

---

## 1. Create/Update Paybito Client with Multiple Domains

### Option A: Full Domain Crawling
This will crawl all pages from each domain (up to maxPages limit):

```json
POST /api/v1/clients
{
  "brokerId": "PAYB18022021121103",
  "name": "Paybito",
  "domains": [
    {
      "url": "https://www.paybito.com",
      "type": "main",
      "crawlSettings": {
        "maxPages": 100
      }
    },
    {
      "url": "https://launch-platform.paybito.com",
      "type": "subdomain",
      "crawlSettings": {
        "maxPages": 50
      }
    }
  ],
  "crawlSettings": {
    "maxPages": 150,
    "crawlDelay": 1000,
    "respectRobots": true,
    "excludedPaths": ["/admin", "/api", "/private", "/wp-admin"]
  },
  "metadata": {
    "industry": "Cryptocurrency Exchange",
    "description": "Full-service cryptocurrency exchange and white-label platform provider",
    "tags": ["crypto", "exchange", "trading", "bitcoin", "white-label", "algorithmic-trading"]
  }
}
```

### Option B: Specific Pages Only
This will crawl ONLY the specific pages you list:

```json
POST /api/v1/clients
{
  "brokerId": "PAYB18022021121103",
  "name": "Paybito",
  "domains": [
    {
      "url": "https://www.paybito.com",
      "type": "main",
      "specificPages": [
        "https://www.paybito.com",
        "https://www.paybito.com/help",
        "https://www.paybito.com/matching-engine",
        "https://www.paybito.com/algorithmic-trading-for-buy-side/",
        "https://www.paybito.com/white-label-cryptocurrency-exchange/",
        "https://www.paybito.com/about",
        "https://www.paybito.com/contact",
        "https://www.paybito.com/features",
        "https://www.paybito.com/security"
      ]
    },
    {
      "url": "https://launch-platform.paybito.com",
      "type": "subdomain",
      "specificPages": [
        "https://launch-platform.paybito.com",
        "https://launch-platform.paybito.com/build-your-exchange.html",
        "https://launch-platform.paybito.com/my-settlement.html",
        "https://launch-platform.paybito.com/features.html",
        "https://launch-platform.paybito.com/pricing.html"
      ]
    }
  ],
  "crawlSettings": {
    "crawlDelay": 1000,
    "respectRobots": true
  },
  "metadata": {
    "industry": "Cryptocurrency Exchange",
    "description": "Full-service cryptocurrency exchange and white-label platform provider",
    "tags": ["crypto", "exchange", "trading", "bitcoin", "white-label", "algorithmic-trading"]
  }
}
```

### Option C: Hybrid Approach (Recommended)
Crawl main domain fully, but only specific pages from subdomains:

```json
POST /api/v1/clients
{
  "brokerId": "PAYB18022021121103",
  "name": "Paybito",
  "domains": [
    {
      "url": "https://www.paybito.com",
      "type": "main",
      "crawlSettings": {
        "maxPages": 100,
        "allowedPaths": ["/", "/help", "/features", "/about", "/security", "/trading"],
        "excludedPaths": ["/blog", "/news", "/wp-admin", "/admin"]
      }
    },
    {
      "url": "https://launch-platform.paybito.com",
      "type": "marketing",
      "specificPages": [
        "https://launch-platform.paybito.com/index.html",
        "https://launch-platform.paybito.com/build-your-exchange.html",
        "https://launch-platform.paybito.com/my-settlement.html",
        "https://launch-platform.paybito.com/features.html",
        "https://launch-platform.paybito.com/pricing.html",
        "https://launch-platform.paybito.com/contact.html"
      ]
    }
  ],
  "crawlSettings": {
    "maxPages": 150,
    "crawlDelay": 1000,
    "respectRobots": true,
    "userAgent": "PaybitoBot/1.0 (RAG Content Indexer)"
  },
  "metadata": {
    "industry": "Cryptocurrency Exchange",
    "description": "Full-service cryptocurrency exchange and white-label platform provider",
    "tags": ["crypto", "exchange", "trading", "bitcoin", "white-label", "algorithmic-trading", "DeFi", "blockchain"]
  }
}
```

## 2. Update Existing Client (Add New Domains)

```json
PUT /api/v1/clients/PAYB18022021121103
Headers: X-API-Key: PAYB18022021121103

{
  "domains": [
    {
      "url": "https://www.paybito.com",
      "type": "main",
      "crawlSettings": {
        "maxPages": 100
      }
    },
    {
      "url": "https://launch-platform.paybito.com",
      "type": "subdomain",
      "specificPages": [
        "https://launch-platform.paybito.com/build-your-exchange.html",
        "https://launch-platform.paybito.com/my-settlement.html"
      ]
    },
    {
      "url": "https://docs.paybito.com",
      "type": "documentation",
      "crawlSettings": {
        "maxPages": 200,
        "allowedPaths": ["/api", "/guides", "/tutorials"]
      }
    }
  ]
}
```

## 3. Start Crawling All Domains

```json
POST /api/v1/crawl
Headers: X-API-Key: PAYB18022021121103

{
  "brokerId": "PAYB18022021121103",
  "options": {
    "type": "full",
    "maxPages": 200
  }
}
```

## 4. Crawl Specific Domain Only

```json
POST /api/v1/crawl
Headers: X-API-Key: PAYB18022021121103

{
  "brokerId": "PAYB18022021121103",
  "options": {
    "type": "specific",
    "urls": [
      "https://www.paybito.com/help",
      "https://www.paybito.com/security",
      "https://launch-platform.paybito.com/features.html"
    ]
  }
}
```

## 5. Query Across All Domains

```json
POST /api/v1/query
Headers: X-API-Key: PAYB18022021121103

{
  "brokerId": "PAYB18022021121103",
  "query": "How to build a white-label exchange?",
  "options": {
    "topK": 5,
    "minScore": 0.7,
    "searchDomains": ["all"]  // or specify: ["launch-platform.paybito.com"]
  }
}
```

## Important Notes:

### Domain Types:
- **main**: Primary website
- **subdomain**: Related subdomain
- **marketing**: Marketing/landing pages
- **documentation**: Technical documentation
- **blog**: Blog content
- **support**: Help/support content

### Crawling Strategies:

1. **Full Crawl**: Crawls entire domain following links
   - Good for: Main websites with interconnected content
   - Set: Don't specify `specificPages`

2. **Specific Pages**: Crawls only listed URLs
   - Good for: Landing pages, marketing sites
   - Set: Use `specificPages` array

3. **Path-Based**: Crawls only certain paths
   - Good for: Large sites where you need specific sections
   - Set: Use `allowedPaths` and `excludedPaths`

### Best Practices:

1. **Start Small**: Begin with specific pages to test
2. **Respect Rate Limits**: Use appropriate `crawlDelay` (1000-2000ms recommended)
3. **Exclude Unnecessary**: Add common excludes like `/admin`, `/wp-admin`, `/api`
4. **Monitor Progress**: Check crawl job status regularly
5. **Incremental Updates**: After initial crawl, use specific page updates

## Testing with cURL:

```bash
# Create client with multiple domains
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{
    "brokerId": "PAYB18022021121103",
    "name": "Paybito",
    "domains": [
      {
        "url": "https://www.paybito.com",
        "type": "main"
      },
      {
        "url": "https://launch-platform.paybito.com",
        "type": "subdomain"
      }
    ]
  }'

# Start crawling
curl -X POST http://localhost:3000/api/v1/crawl \
  -H "Content-Type: application/json" \
  -H "X-API-Key: PAYB18022021121103" \
  -d '{
    "brokerId": "PAYB18022021121103",
    "options": {"type": "full"}
  }'
```

## Monitoring Crawl Progress:

```json
GET /api/v1/crawl/{jobId}/status
Headers: X-API-Key: PAYB18022021121103
```

Response will show progress across all domains being crawled.