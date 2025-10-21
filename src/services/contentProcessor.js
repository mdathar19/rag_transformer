class ContentProcessor {
    constructor(options = {}) {
        this.maxChunkSize = options.maxChunkSize || 1000; // Increased to capture more context
        this.chunkOverlap = options.chunkOverlap || 100; // Increased for better continuity
        this.minChunkSize = options.minChunkSize || 200; // Increased minimum size
    }

    processContent(pageData) {
        const { content, title, description, metadata } = pageData;

        // Clean the content
        const cleanedContent = this.cleanText(content);

        // Create contextual content with metadata
        const contextualContent = this.createContextualContent({
            title,
            description,
            content: cleanedContent,
            headings: metadata.headings || []
        });

        // Split into chunks
        const chunks = this.createSmartChunks(contextualContent);

        // Add metadata to each chunk
        const processedChunks = chunks.map((chunk, index) => ({
            text: chunk.text,
            position: index,
            tokens: this.estimateTokens(chunk.text),
            metadata: {
                ...chunk.metadata,
                pageTitle: title,
                pageUrl: pageData.url
            }
        }));

        return {
            ...pageData,
            content: cleanedContent,
            chunks: processedChunks,
            totalChunks: processedChunks.length,
            totalTokens: processedChunks.reduce((sum, c) => sum + c.tokens, 0)
        };
    }

    cleanText(text) {
        if (!text) return '';

        return text
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove special characters but keep punctuation
            .replace(/[^\w\s.,;:!?'"()\-\/]/g, '')
            // Fix common encoding issues
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            // Remove multiple punctuation
            .replace(/([.,;:!?])\1+/g, '$1')
            // Normalize quotes
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            // Trim
            .trim();
    }

    createContextualContent({ title, description, content, headings }) {
        // Build a context-rich version of the content
        let contextualContent = '';

        if (title) {
            contextualContent += `Title: ${title}\n\n`;
        }

        if (description) {
            contextualContent += `Description: ${description}\n\n`;
        }

        if (headings && headings.length > 0) {
            contextualContent += `Main Topics: ${headings.slice(0, 5).join(', ')}\n\n`;
        }

        contextualContent += `Content:\n${content}`;

        return contextualContent;
    }

    createSmartChunks(text) {
        const chunks = [];
        const sentences = this.splitIntoSentences(text);

        if (sentences.length === 0) return [];

        let currentChunk = {
            text: '',
            metadata: {
                startSentence: 0,
                endSentence: 0,
                type: 'content'
            }
        };

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const potentialChunk = currentChunk.text + ' ' + sentence;
            const tokens = this.estimateTokens(potentialChunk);

            if (tokens > this.maxChunkSize && currentChunk.text) {
                // Save current chunk
                currentChunk.metadata.endSentence = i - 1;
                chunks.push({ ...currentChunk });

                // Start new chunk with overlap
                const overlapStart = Math.max(0, i - Math.floor(this.chunkOverlap / 50));
                currentChunk = {
                    text: sentences.slice(overlapStart, i + 1).join(' ').trim(),
                    metadata: {
                        startSentence: overlapStart,
                        endSentence: i,
                        type: this.detectChunkType(sentence)
                    }
                };
            } else {
                currentChunk.text = potentialChunk.trim();
                currentChunk.metadata.endSentence = i;
            }
        }

        // Add the last chunk if it meets minimum size
        if (currentChunk.text && this.estimateTokens(currentChunk.text) >= this.minChunkSize) {
            chunks.push(currentChunk);
        }

        return this.optimizeChunks(chunks);
    }

    splitIntoSentences(text) {
        // Improved sentence splitting that handles edge cases
        const sentenceEnders = /([.!?])\s+/g;
        const sentences = [];
        let lastIndex = 0;
        let match;

        while ((match = sentenceEnders.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + 1).trim();
            if (sentence && !this.isLikelyAbbreviation(sentence)) {
                sentences.push(sentence);
                lastIndex = match.index + match[0].length;
            }
        }

        // Add remaining text as last sentence
        const remaining = text.substring(lastIndex).trim();
        if (remaining) {
            sentences.push(remaining);
        }

        return sentences.filter(s => s.length > 10); // Filter out very short sentences
    }

    isLikelyAbbreviation(sentence) {
        // Check if sentence ends with common abbreviations
        const abbreviations = ['Mr.', 'Mrs.', 'Dr.', 'Ms.', 'Prof.', 'Sr.', 'Jr.', 'Ph.D', 'M.D', 'B.A', 'M.A', 'B.S', 'M.S'];
        return abbreviations.some(abbr => sentence.endsWith(abbr));
    }

    optimizeChunks(chunks) {
        // Merge very small chunks with neighbors
        const optimized = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const tokens = this.estimateTokens(chunk.text);

            if (tokens < this.minChunkSize && i > 0) {
                // Merge with previous chunk if possible
                const prevChunk = optimized[optimized.length - 1];
                const combinedTokens = this.estimateTokens(prevChunk.text + ' ' + chunk.text);

                if (combinedTokens <= this.maxChunkSize * 1.2) {
                    prevChunk.text += ' ' + chunk.text;
                    prevChunk.metadata.endSentence = chunk.metadata.endSentence;
                    continue;
                }
            }

            optimized.push(chunk);
        }

        return optimized;
    }

    detectChunkType(text) {
        // Detect the type of content in the chunk
        const lowerText = text.toLowerCase();

        if (lowerText.includes('introduction') || lowerText.includes('overview')) {
            return 'introduction';
        }
        if (lowerText.includes('conclusion') || lowerText.includes('summary')) {
            return 'conclusion';
        }
        if (lowerText.includes('features') || lowerText.includes('benefits')) {
            return 'features';
        }
        if (lowerText.includes('pricing') || lowerText.includes('cost')) {
            return 'pricing';
        }
        if (lowerText.includes('how to') || lowerText.includes('tutorial')) {
            return 'tutorial';
        }
        if (lowerText.includes('faq') || lowerText.includes('question')) {
            return 'faq';
        }

        return 'content';
    }

    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters or 0.75 words
        const words = text.split(/\s+/).length;
        const chars = text.length;

        // Use average of both methods
        const wordEstimate = words / 0.75;
        const charEstimate = chars / 4;

        return Math.ceil((wordEstimate + charEstimate) / 2);
    }

    extractKeywords(text, maxKeywords = 10) {
        // Simple keyword extraction based on frequency
        const words = text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !this.isStopWord(word));

        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }

    isStopWord(word) {
        const stopWords = new Set([
            'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
            'was', 'were', 'been', 'be', 'being', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might',
            'can', 'could', 'must', 'ought', 'to', 'of', 'for', 'from', 'up',
            'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
            'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
            'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
        ]);

        return stopWords.has(word.toLowerCase());
    }

    calculatePageRank(pageData, allPages) {
        // Simple PageRank-like scoring based on internal links
        const incomingLinks = allPages.filter(page =>
            page.links && page.links.includes(pageData.url)
        ).length;

        const outgoingLinks = pageData.links ? pageData.links.length : 0;

        // Base score
        let score = 1.0;

        // Boost for incoming links
        score += incomingLinks * 0.1;

        // Penalty for too many outgoing links
        if (outgoingLinks > 50) {
            score *= 0.8;
        }

        // Boost for certain page types
        if (pageData.contentType === 'homepage') {
            score *= 2;
        } else if (pageData.contentType === 'article') {
            score *= 1.5;
        }

        // Boost for content length
        const contentLength = pageData.content ? pageData.content.length : 0;
        if (contentLength > 1000) {
            score *= 1.2;
        }

        return Math.min(score, 10); // Cap at 10
    }
}

module.exports = ContentProcessor;