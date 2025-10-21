const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const URL = require('url-parse');
const crypto = require('crypto');
const pLimit = require('p-limit');

class WebScraper {
    constructor(options = {}) {
        this.browser = null;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.crawlDelay = options.crawlDelay || 1000;
        this.userAgent = options.userAgent || 'RAG-Bot/1.0 (Compatible; AI Content Indexer)';
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
        }
    }

    async crawlWebsite(domain, brokerId, options = {}) {
        await this.initialize();

        const {
            maxPages = 100,
            respectRobots = true,
            allowedPaths = [],
            excludedPaths = [],
            crawlDelay = this.crawlDelay
        } = options;

        const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
        const visitedUrls = new Set();
        const toVisit = [baseUrl];
        const crawledContent = [];
        const errors = [];

        // Check robots.txt
        let robots = null;
        if (respectRobots) {
            robots = await this.checkRobotsTxt(baseUrl);
        }

        console.log(`[Scraper] Starting crawl for ${domain} (brokerId: ${brokerId})`);

        // Create concurrency limiter
        const limit = pLimit(this.maxConcurrent);

        while (toVisit.length > 0 && visitedUrls.size < maxPages) {
            const batch = toVisit.splice(0, Math.min(this.maxConcurrent, maxPages - visitedUrls.size));

            const promises = batch.map(url =>
                limit(async () => {
                    if (visitedUrls.has(url)) return null;

                    // Check robots.txt rules
                    if (robots && !robots.isAllowed(url, this.userAgent)) {
                        console.log(`[Scraper] Skipping ${url} - blocked by robots.txt`);
                        return null;
                    }

                    // Check path rules
                    if (!this.isPathAllowed(url, baseUrl, allowedPaths, excludedPaths)) {
                        return null;
                    }

                    visitedUrls.add(url);

                    try {
                        const pageData = await this.scrapePage(url, baseUrl, brokerId);

                        if (pageData) {
                            crawledContent.push(pageData);

                            // Add new URLs to queue
                            pageData.links.forEach(link => {
                                if (!visitedUrls.has(link) && !toVisit.includes(link)) {
                                    toVisit.push(link);
                                }
                            });
                        }

                        // Respect crawl delay
                        await this.delay(crawlDelay);

                        return pageData;
                    } catch (error) {
                        console.error(`[Scraper] Error crawling ${url}:`, error.message);
                        errors.push({ url, error: error.message, timestamp: new Date() });
                        return null;
                    }
                })
            );

            await Promise.all(promises);
        }

        console.log(`[Scraper] Crawl completed. Pages: ${crawledContent.length}, Errors: ${errors.length}`);

        return {
            brokerId,
            domain,
            pages: crawledContent,
            errors,
            stats: {
                totalPages: crawledContent.length,
                failedPages: errors.length,
                crawlDate: new Date()
            }
        };
    }

    async scrapePage(url, baseUrl, brokerId) {
        const page = await this.browser.newPage();

        try {
            await page.setUserAgent(this.userAgent);
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to page
            const response = await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: this.timeout
            });

            if (!response || !response.ok()) {
                throw new Error(`HTTP ${response?.status()} ${response?.statusText()}`);
            }

            // Wait for content to load
            await page.waitForSelector('body', { timeout: 10000 });

            // Get page content
            const html = await page.content();
            const $ = cheerio.load(html);

            // Extract structured data
            const title = $('title').text() || $('h1').first().text() || '';
            const description = $('meta[name="description"]').attr('content') ||
                              $('meta[property="og:description"]').attr('content') || '';

            // Remove script and style elements
            $('script, style, noscript, iframe').remove();

            // Extract main content
            const mainContent = this.extractMainContent($);

            // Extract headings for structure
            const headings = [];
            $('h1, h2, h3, h4').each((_, elem) => {
                const text = $(elem).text().trim();
                if (text) headings.push(text);
            });

            // Extract internal links
            const links = [];
            $('a[href]').each((_, elem) => {
                const href = $(elem).attr('href');
                const absoluteUrl = this.resolveUrl(href, baseUrl);
                if (absoluteUrl && this.isSameDomain(absoluteUrl, baseUrl)) {
                    links.push(absoluteUrl);
                }
            });

            // Extract metadata
            const metadata = {
                author: $('meta[name="author"]').attr('content') || null,
                publishDate: $('meta[property="article:published_time"]').attr('content') || null,
                lastModified: $('meta[property="article:modified_time"]').attr('content') || null,
                language: $('html').attr('lang') || 'en',
                keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [],
                headings: headings.slice(0, 10), // Limit headings
                images: []
            };

            // Extract images
            $('img[src]').each((_, elem) => {
                const src = $(elem).attr('src');
                const alt = $(elem).attr('alt') || '';
                if (src) {
                    metadata.images.push({ src: this.resolveUrl(src, baseUrl), alt });
                }
            });

            // Calculate content hash
            const contentHash = this.calculateHash(mainContent);

            // Parse URL
            const urlObj = new URL(url, true);

            return {
                brokerId,
                url,
                domain: urlObj.hostname,
                path: urlObj.pathname,
                title: title.substring(0, 200),
                description: description.substring(0, 500),
                content: mainContent,
                contentType: this.detectContentType($, urlObj.pathname),
                metadata,
                links: [...new Set(links)].slice(0, 100), // Unique links, limited
                crawledAt: new Date(),
                hash: contentHash
            };

        } catch (error) {
            console.error(`[Scraper] Error scraping ${url}:`, error.message);
            throw error;
        } finally {
            await page.close();
        }
    }

    extractMainContent($) {
        // Try to find main content areas
        const contentSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '#content',
            '.post-content',
            '.entry-content',
            '.page-content'
        ];

        let content = '';

        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                content = element.text();
                break;
            }
        }

        // Fallback to body if no main content found
        if (!content) {
            content = $('body').text();
        }

        // Clean up the content
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .substring(0, 50000); // Limit content size
    }

    detectContentType($, path) {
        // Detect content type based on patterns
        if (path.includes('/blog/') || path.includes('/news/') || path.includes('/article/')) {
            return 'article';
        }
        if (path.includes('/product/') || path.includes('/shop/')) {
            return 'product';
        }
        if (path === '/' || path === '/index') {
            return 'homepage';
        }
        if (path.includes('/about')) {
            return 'about';
        }
        if (path.includes('/contact')) {
            return 'contact';
        }
        if (path.includes('/faq') || path.includes('/help')) {
            return 'support';
        }

        // Check for schema.org markup
        if ($('[itemtype*="Article"]').length > 0) return 'article';
        if ($('[itemtype*="Product"]').length > 0) return 'product';

        return 'page';
    }

    async checkRobotsTxt(baseUrl) {
        try {
            const robotsUrl = new URL(baseUrl).origin + '/robots.txt';
            const response = await fetch(robotsUrl);

            if (response.ok) {
                const robotsTxt = await response.text();
                return robotsParser(robotsUrl, robotsTxt);
            }
        } catch (error) {
            console.log(`[Scraper] Could not fetch robots.txt: ${error.message}`);
        }
        return null;
    }

    isPathAllowed(url, baseUrl, allowedPaths, excludedPaths) {
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Check excluded paths
        for (const excluded of excludedPaths) {
            if (path.startsWith(excluded)) {
                return false;
            }
        }

        // If allowed paths specified, check inclusion
        if (allowedPaths.length > 0) {
            for (const allowed of allowedPaths) {
                if (path.startsWith(allowed)) {
                    return true;
                }
            }
            return false;
        }

        return true;
    }

    isSameDomain(url, baseUrl) {
        try {
            const urlObj = new URL(url);
            const baseObj = new URL(baseUrl);
            return urlObj.hostname === baseObj.hostname;
        } catch {
            return false;
        }
    }

    resolveUrl(url, baseUrl) {
        try {
            if (!url) return null;
            if (url.startsWith('http')) return url;
            if (url.startsWith('//')) return 'https:' + url;
            if (url.startsWith('/')) return new URL(url, baseUrl).href;
            if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) return null;
            return new URL(url, baseUrl).href;
        } catch {
            return null;
        }
    }

    calculateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = WebScraper;