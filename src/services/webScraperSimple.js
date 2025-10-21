const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const URL = require('url-parse');
const crypto = require('crypto');
const pLimit = require('p-limit');
const logStreamService = require('./logStreamService');

class WebScraperSimple {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 3;
        this.crawlDelay = options.crawlDelay || 1000;
        this.userAgent = options.userAgent || 'RAG-Bot/1.0 (Compatible; AI Content Indexer)';
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
        this.axios = axios.create({
            timeout: this.timeout,
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
        });
    }

    async initialize() {
        // No browser to initialize with axios
        console.log('[Scraper] Using simplified HTTP crawler');
    }

    async crawlWebsite(domain, brokerId, options = {}, jobId = null) {
        const {
            maxPages = 100,
            respectRobots = true,
            allowedPaths = [],
            excludedPaths = [],
            crawlDelay = this.crawlDelay
        } = options;

        // Helper to log both console and stream
        const log = (message, level = 'info') => {
            console.log(message);
            if (jobId) {
                logStreamService.addLog(jobId, message, level);
            }
        };

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
        console.log(`[Scraper] Settings: maxPages=${maxPages}, respectRobots=${respectRobots}, excludedPaths=[${excludedPaths.join(', ')}]`);

        // Create concurrency limiter
        const limit = pLimit(this.maxConcurrent);

        while (toVisit.length > 0 && visitedUrls.size < maxPages) {
            log(`[Scraper] Queue: ${toVisit.length} pending, ${visitedUrls.size}/${maxPages} crawled`);
            const batch = toVisit.splice(0, Math.min(this.maxConcurrent, maxPages - visitedUrls.size));

            const promises = batch.map(url =>
                limit(async () => {
                    if (visitedUrls.has(url)) return null;

                    // Check robots.txt rules
                    if (robots && !robots.isAllowed(url, this.userAgent)) {
                        log(`[Scraper] ⊘ Skipped (robots.txt): ${url}`);
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
                            const newLinksAdded = [];
                            pageData.links.forEach(link => {
                                if (!visitedUrls.has(link) && !toVisit.includes(link)) {
                                    toVisit.push(link);
                                    newLinksAdded.push(link);
                                }
                            });

                            log(`[Scraper] ✓ Crawled: ${url} (found ${pageData.links.length} links, added ${newLinksAdded.length} new)`);
                        }

                        // Respect crawl delay
                        await this.delay(crawlDelay);

                        return pageData;
                    } catch (error) {
                        log(`[Scraper] ✗ Error: ${url} - ${error.message}`, 'error');
                        errors.push({ url, error: error.message, timestamp: new Date() });
                        return null;
                    }
                })
            );

            await Promise.all(promises);
        }

        log(`[Scraper] Crawl completed. Pages: ${crawledContent.length}, Errors: ${errors.length}`, 'success');

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
        try {
            // Fetch the page
            const response = await this.axios.get(url);
            const html = response.data;
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
            const allLinks = [];
            $('a[href]').each((_, elem) => {
                const href = $(elem).attr('href');
                const absoluteUrl = this.resolveUrl(href, baseUrl);
                if (absoluteUrl) {
                    allLinks.push(absoluteUrl);
                    if (this.isSameDomain(absoluteUrl, baseUrl)) {
                        links.push(absoluteUrl);
                    }
                }
            });

            console.log(`[Scraper] Extracted ${allLinks.length} total links, ${links.length} are same-domain`);

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
        }
    }

    extractMainContent($) {
        // Comprehensive list of content selectors for modern websites
        const contentSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '#content',
            '.post-content',
            '.entry-content',
            '.page-content',
            '.main-content',
            '[class*="content"]',
            '.container',
            '.wrapper',
            '.body-content',
            '.site-content',
            '.article-body',
            '.text-content',
            'section',
            '.section-content',
            'div[class*="main"]',
            'div[id*="main"]'
        ];

        let content = '';
        let contentFound = false;

        // Try each selector and accumulate content
        for (const selector of contentSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                elements.each((_, elem) => {
                    const elementText = $(elem).text().trim();
                    // Only add if it has substantial unique content
                    if (elementText.length > 100 && !content.includes(elementText)) {
                        content += ' ' + elementText;
                        contentFound = true;
                    }
                });

                // If we found good content, stop looking
                if (contentFound && content.length > 500) {
                    break;
                }
            }
        }

        // If still no content, extract all text from body
        // but try to exclude navigation, footer, header
        if (!content || content.length < 200) {
            // Remove non-content elements
            const $copy = $.html();
            const $clean = cheerio.load($copy);
            $clean('header, nav, footer, .header, .footer, .navigation, .nav, .menu, .sidebar, .cookie-notice, .popup').remove();

            // Get all paragraph, div, section, article text
            let bodyContent = '';
            $clean('p, div, section, article, li, td, th, blockquote, pre').each((_, elem) => {
                const text = $clean(elem).text().trim();
                if (text.length > 20) { // Only include meaningful text
                    bodyContent += ' ' + text;
                }
            });

            content = bodyContent || $clean('body').text();
        }

        // Clean up the content
        return content
            .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
            .replace(/\n{3,}/g, '\n\n')    // Replace multiple newlines with double newline
            .replace(/\t+/g, ' ')          // Replace tabs with spaces
            .trim()
            .substring(0, 200000); // Increased limit to 200K characters for better coverage
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
            const urlObj = new URL(baseUrl);
            const robotsUrl = urlObj.origin + '/robots.txt';

            console.log(`[Scraper] Fetching robots.txt from: ${robotsUrl}`);
            const response = await axios.get(robotsUrl, {
                timeout: 5000,
                maxRedirects: 5  // Follow redirects to www
            });

            if (response.status === 200) {
                // Use the final URL after redirects for the robots parser
                const finalUrl = response.request?.res?.responseUrl || robotsUrl;
                console.log(`[Scraper] Robots.txt final URL: ${finalUrl}`);
                console.log(`[Scraper] Robots.txt content preview: ${response.data.substring(0, 200)}`);

                // Parse robots.txt using the base domain (without path)
                const finalOrigin = new URL(finalUrl).origin;
                return robotsParser(finalOrigin + '/robots.txt', response.data);
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

            // Normalize hostnames (remove www. prefix for comparison)
            const normalizeHost = (host) => host.replace(/^www\./, '');
            const urlHost = normalizeHost(urlObj.hostname);
            const baseHost = normalizeHost(baseObj.hostname);

            return urlHost === baseHost;
        } catch {
            return false;
        }
    }

    resolveUrl(url, baseUrl) {
        try {
            if (!url) return null;
            if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) return null;

            let absoluteUrl;
            if (url.startsWith('http')) {
                absoluteUrl = url;
            } else if (url.startsWith('//')) {
                absoluteUrl = 'https:' + url;
            } else if (url.startsWith('/')) {
                absoluteUrl = new URL(url, baseUrl).href;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }

            // Normalize URL: remove fragment and trailing slash
            const urlObj = new URL(absoluteUrl);
            urlObj.hash = ''; // Remove fragment (#section)
            let normalized = urlObj.href;

            // Remove trailing slash from path (but keep for root)
            if (urlObj.pathname !== '/' && normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }

            return normalized;
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
        // Nothing to close with axios
        console.log('[Scraper] Crawler session completed');
    }
}

module.exports = WebScraperSimple;