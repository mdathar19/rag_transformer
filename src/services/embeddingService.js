const { OpenAI } = require('openai');
const crypto = require('crypto');

class EmbeddingService {
    constructor(cacheService = null) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.cache = cacheService;
        this.model = 'text-embedding-3-small';
        this.dimensions = 1536;
        this.batchSize = 100; // OpenAI allows up to 2048 inputs per request
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    async generateEmbedding(text, useCache = true) {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        // Check cache first
        if (useCache && this.cache) {
            const cacheKey = this.getCacheKey(text);
            const cached = await this.cache.get(`embedding:${cacheKey}`);
            if (cached) {
                console.log('[Embedding] Cache hit');
                return JSON.parse(cached);
            }
        }

        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: text.substring(0, 8192), // Max input length
                encoding_format: 'float'
            });

            const embedding = response.data[0].embedding;

            // Cache the result
            if (useCache && this.cache) {
                const cacheKey = this.getCacheKey(text);
                await this.cache.set(
                    `embedding:${cacheKey}`,
                    JSON.stringify(embedding),
                    86400 // 24 hours TTL
                );
            }

            return embedding;
        } catch (error) {
            console.error('[Embedding] Error generating embedding:', error.message);
            throw error;
        }
    }

    async generateBatchEmbeddings(texts, useCache = true) {
        const results = [];
        const uncachedTexts = [];
        const uncachedIndices = [];

        // Check cache for each text
        if (useCache && this.cache) {
            for (let i = 0; i < texts.length; i++) {
                const cacheKey = this.getCacheKey(texts[i]);
                const cached = await this.cache.get(`embedding:${cacheKey}`);

                if (cached) {
                    results[i] = JSON.parse(cached);
                } else {
                    uncachedTexts.push(texts[i]);
                    uncachedIndices.push(i);
                }
            }

            console.log(`[Embedding] Cache hits: ${texts.length - uncachedTexts.length}/${texts.length}`);
        } else {
            uncachedTexts.push(...texts);
            uncachedIndices.push(...Array.from({ length: texts.length }, (_, i) => i));
        }

        // Process uncached texts in batches
        if (uncachedTexts.length > 0) {
            const batches = this.createBatches(uncachedTexts, this.batchSize);

            for (const batch of batches) {
                let retries = 0;
                let success = false;

                while (retries < this.maxRetries && !success) {
                    try {
                        const response = await this.openai.embeddings.create({
                            model: this.model,
                            input: batch.map(text => text.substring(0, 8192))
                        });

                        // Store results and cache them
                        for (let i = 0; i < batch.length; i++) {
                            const embedding = response.data[i].embedding;
                            const originalIndex = uncachedIndices.shift();
                            results[originalIndex] = embedding;

                            // Cache the embedding
                            if (useCache && this.cache) {
                                const cacheKey = this.getCacheKey(batch[i]);
                                await this.cache.set(
                                    `embedding:${cacheKey}`,
                                    JSON.stringify(embedding),
                                    86400
                                );
                            }
                        }

                        success = true;
                    } catch (error) {
                        retries++;
                        console.error(`[Embedding] Batch error (attempt ${retries}):`, error.message);

                        if (retries < this.maxRetries) {
                            await this.delay(this.retryDelay * retries);
                        } else {
                            throw error;
                        }
                    }
                }
            }
        }

        return results;
    }

    async generateChunkEmbeddings(chunks, brokerId) {
        const embeddings = [];
        const texts = chunks.map(chunk => chunk.text);

        console.log(`[Embedding] Generating embeddings for ${chunks.length} chunks`);

        const batchEmbeddings = await this.generateBatchEmbeddings(texts);

        for (let i = 0; i < chunks.length; i++) {
            embeddings.push({
                ...chunks[i],
                embedding: batchEmbeddings[i],
                embeddingModel: this.model,
                embeddingDimensions: this.dimensions
            });
        }

        return embeddings;
    }

    async processContentForEmbeddings(processedContent, brokerId) {
        const { chunks, ...contentData } = processedContent;

        // Generate embeddings for all chunks
        const chunksWithEmbeddings = await this.generateChunkEmbeddings(chunks, brokerId);

        // Calculate average embedding for the entire document (optional)
        const documentEmbedding = this.calculateAverageEmbedding(
            chunksWithEmbeddings.map(c => c.embedding)
        );

        return {
            ...contentData,
            chunks: chunksWithEmbeddings,
            documentEmbedding,
            embeddingModel: this.model,
            embeddingsGenerated: chunksWithEmbeddings.length,
            processingDate: new Date()
        };
    }

    calculateAverageEmbedding(embeddings) {
        if (!embeddings || embeddings.length === 0) {
            return null;
        }

        const dimensions = embeddings[0].length;
        const average = new Array(dimensions).fill(0);

        // Sum all embeddings
        for (const embedding of embeddings) {
            for (let i = 0; i < dimensions; i++) {
                average[i] += embedding[i];
            }
        }

        // Calculate average
        for (let i = 0; i < dimensions; i++) {
            average[i] /= embeddings.length;
        }

        // Normalize the vector
        const magnitude = Math.sqrt(average.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < dimensions; i++) {
                average[i] /= magnitude;
            }
        }

        return average;
    }

    calculateSimilarity(embedding1, embedding2) {
        // Cosine similarity
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            magnitude1 += embedding1[i] * embedding1[i];
            magnitude2 += embedding2[i] * embedding2[i];
        }

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }

        return dotProduct / (magnitude1 * magnitude2);
    }

    getCacheKey(text) {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getUsageStats() {
        // Estimate token usage for billing purposes
        return {
            model: this.model,
            dimensions: this.dimensions,
            estimatedCost: {
                perMillionTokens: 0.02, // $0.02 per 1M tokens for text-embedding-3-small
                currency: 'USD'
            }
        };
    }
}

module.exports = EmbeddingService;