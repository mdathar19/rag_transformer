# MongoDB Atlas Search Index Setup Instructions

## Steps to Create the Vector Search Index:

1. **Log into MongoDB Atlas**
   - Go to https://cloud.mongodb.com
   - Navigate to your cluster (hashcashcluster10)

2. **Navigate to Atlas Search**
   - In your cluster view, click on the "Search" tab
   - Click "Create Search Index"

3. **Choose Index Type**
   - Select "JSON Editor" option (not Visual Editor)
   - Click "Next"

4. **Configure the Index**
   - **Database**: `brain_platform`
   - **Collection**: `content_chunks` (NOT content - we restructured the data)
   - **Index Name**: `vector_index`

5. **Paste the Index Definition**
   Copy and paste this exact JSON configuration into the JSON editor:

```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1536,
    "similarity": "cosine"
  }]
}
```

   **Important**:
   - This uses the simpler "vector" type (not "knnVector")
   - Path is now just "embedding" (not "chunks.embedding")
   - Use "numDimensions" for the vector field
   - The index name should be entered in the separate "Index Name" field as `vector_index`
   - This is for Atlas Vector Search on the new `content_chunks` collection

6. **Create the Index**
   - Click "Create Search Index"
   - Wait for the index to build (this may take a few minutes)
   - The status should show "Active" when ready

## Important Notes:

- **Index Name**: The index MUST be named `vector_index` to match the code
- **Collection**: The index must be created on the `content` collection
- **Dimensions**: 1536 dimensions matches OpenAI's text-embedding-3-small model
- **Similarity**: Cosine similarity is the standard for text embeddings
- **Filters**: The filter fields allow efficient filtering by brokerId during search

## What Changed in the Code:

The vectorSearch.js file has been updated to use MongoDB Atlas Search instead of the $function operator:

### Before (with $function):
- Used custom JavaScript function for cosine similarity
- Required M10+ tier but still had issues
- Calculated similarity in the aggregation pipeline

### After (with Atlas Search):
- Uses native MongoDB Atlas Search with knnBeta
- Leverages MongoDB's optimized vector search
- Better performance and reliability
- Proper integration with Atlas infrastructure

## Testing the Vector Search:

After creating the index, test it by:
1. Making a query through the API
2. Check the logs - you should NOT see "Falling back to text search"
3. Vector search results should appear with similarity scores

## Troubleshooting:

If vector search still falls back to text search:
1. Verify the index is "Active" in Atlas console
2. Check the index name is exactly `vector_index`
3. Ensure all documents have properly formatted embeddings
4. Check that chunks.embedding arrays have 1536 dimensions