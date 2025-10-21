# Vector Search Index Setup Guide

## Problem
Your vector search is returning 0 results because the **vector search index** is not configured in MongoDB Atlas.

## Verification Results
✅ Database migration: **SUCCESS** (all 434 documents migrated)
✅ Embeddings in content_chunks: **257/257 chunks have embeddings**
❌ Vector search index: **NOT CONFIGURED**

## Solution: Create Vector Search Index in MongoDB Atlas

### Step 1: Access MongoDB Atlas Dashboard
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Log in with your credentials
3. Select your cluster: **athar01**

### Step 2: Create Search Index
1. Click on your cluster **athar01**
2. Navigate to the **"Search"** tab (or **"Atlas Search"**)
3. Click **"Create Search Index"**

### Step 3: Choose Configuration Method
1. Select **"JSON Editor"** (not Visual Editor)
2. Click **"Next"**

### Step 4: Configure Index
**Database:** `brain_platform`
**Collection:** `content_chunks`
**Index Name:** `vector_index`

**JSON Configuration:**
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "brokerId"
    }
  ]
}
```

### Step 5: Create and Wait
1. Click **"Create Search Index"**
2. Wait for the index to build (usually 2-5 minutes for 257 documents)
3. Status will change from "Building" to "Active"

## Verify Setup

After creating the index, run this command to verify:

```bash
node check-embeddings.js
```

You should see:
```
✅ Vector search index found!
```

## Test Vector Search

Once the index is active, test your chat API:

```bash
curl -X POST http://your-domain/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "tell me about this platform",
    "sessionId": "test-session"
  }'
```

You should see in the logs:
```
[VectorSearch] Vector search returned 5 results  ✅
```

Instead of:
```
[VectorSearch] Vector search returned 0 results  ❌
[VectorSearch] Falling back to keyword search
```

## Alternative: Atlas CLI (Advanced)

If you prefer command-line:

```bash
# Install Atlas CLI
npm install -g mongodb-atlas-cli

# Login
atlas auth login

# Create index
atlas search indexes create \
  --clusterName athar01 \
  --db brain_platform \
  --collection content_chunks \
  --file vector-index-config.json
```

Where `vector-index-config.json` contains the JSON configuration above.

## Important Notes

⚠️ **The index MUST be named exactly:** `vector_index`
⚠️ **The collection MUST be:** `content_chunks`
⚠️ **The database MUST be:** `brain_platform`
⚠️ **Dimensions MUST be:** `1536` (for text-embedding-3-small)

## Troubleshooting

### Index creation fails
- Ensure you have proper permissions in MongoDB Atlas
- Verify you're on M10+ cluster (vector search requires M10 or higher)
- Check that embeddings field exists in your documents

### Vector search still returns 0 results
1. Verify index status is "Active"
2. Check index name matches exactly: `vector_index`
3. Ensure embeddings are arrays of 1536 numbers
4. Restart your Node.js application

### Check current indexes
Run this in MongoDB shell:
```javascript
db.content_chunks.getIndexes()
```

For Atlas Search indexes, you need to check in the Atlas UI under the Search tab.

## Additional Resources

- [MongoDB Atlas Vector Search Documentation](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)
- [Atlas Search Index Management](https://www.mongodb.com/docs/atlas/atlas-search/create-index/)
- [Vector Search Tutorial](https://www.mongodb.com/docs/atlas/atlas-vector-search/tutorials/)
