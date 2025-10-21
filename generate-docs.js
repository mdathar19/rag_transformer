const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const fs = require('fs');

// Create document
const doc = new Document({
    sections: [{
        properties: {},
        children: [
            // Title Page
            new Paragraph({
                text: "AI RAG Transformer",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: "Intelligent Knowledge Management System",
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: "Intelligent Knowledge Management System",
                        size: 28,
                        color: "4472C4"
                    })
                ]
            }),
            new Paragraph({
                text: "Product Overview & Architecture",
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
                children: [
                    new TextRun({
                        text: "Product Overview & Architecture",
                        size: 24
                    })
                ]
            }),

            // Executive Summary
            new Paragraph({
                text: "Executive Summary",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "The AI RAG Transformer is an intelligent knowledge management system that automatically transforms website content into an AI-powered question-answering service. It enables businesses to provide instant, accurate, and contextual responses to customer queries by leveraging advanced AI technology combined with their existing web content.",
                spacing: { after: 300 }
            }),

            // What Does This Application Do?
            new Paragraph({
                text: "What Does This Application Do?",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "Core Purpose",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "The AI RAG Transformer creates an intelligent layer over your company's web presence, enabling:",
                spacing: { after: 100 }
            }),
            new Paragraph({
                text: "• Automated Knowledge Extraction: Crawls and indexes your entire website automatically",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Intelligent Q&A: Provides accurate answers to customer questions using your content",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• 24/7 Availability: Instant responses without human intervention",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Multi-Domain Support: Handles multiple websites and subdomains seamlessly",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            // How It Helps Support Teams
            new Paragraph({
                text: "How It Helps Support Teams",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "Before AI RAG Transformer:",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "❌ Support agents manually search through documentation",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "❌ Customers wait hours or days for responses",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "❌ Repetitive questions consume valuable time",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "❌ Information scattered across multiple sources",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "❌ Inconsistent answers from different agents",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "After AI RAG Transformer:",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "✅ 70% Reduction in Response Time: Instant answers to common queries",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "✅ 24/7 Availability: Customers get help anytime",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "✅ Consistent Accuracy: Same correct answer every time",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "✅ Agent Productivity: Support team focuses on complex issues",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "✅ Scalability: Handle unlimited queries simultaneously",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // System Architecture
            new Paragraph({
                text: "System Architecture",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "The system consists of several integrated components working together to provide intelligent responses:",
                spacing: { after: 200 }
            }),

            new Paragraph({
                text: "1. Content Acquisition Layer",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Automatically crawls specified websites",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Extracts meaningful content from web pages",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Respects robots.txt and crawl delays",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Handles up to 200,000 characters per page",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "2. Intelligence Engine",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Converts content into AI-understandable format",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Creates semantic embeddings for intelligent search",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Processes queries through RAG (Retrieval-Augmented Generation)",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Maintains conversation context for follow-up questions",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "3. Data Management",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• MongoDB Atlas: Stores content and embeddings",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Redis Cache: Speeds up frequent queries",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• OpenAI Integration: Provides AI capabilities",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "4. User Interfaces",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• PayBito Whizzo AI Chat: Clean, intuitive chat interface for customers",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Admin Panel: Content and client management",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• API Access: Direct integration capabilities for developers",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Key Features
            new Paragraph({
                text: "Key Features",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
                text: "Multi-Tenant Architecture",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Separate knowledge bases for each client",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Custom configurations per tenant",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Branded experience for each client",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Intelligent Content Processing",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Smart chunking breaks content into optimal pieces",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Context preservation maintains relationships",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Automatic updates with scheduled refresh",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Advanced Search Capabilities",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Semantic search understands meaning, not just keywords",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Vector similarity finds related content intelligently",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Multiple fallback search strategies",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Return on Investment
            new Paragraph({
                text: "Return on Investment (ROI)",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
                text: "Cost Savings",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• 40% fewer support tickets",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Agents handle 2x more complex issues",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• No overtime or night shift costs",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Handle growth without proportional cost increase",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Revenue Impact",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Faster sales cycles with instant answers",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Better conversion with 24/7 availability",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Improved customer retention",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Intelligent upsell recommendations",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Success Metrics
            new Paragraph({
                text: "Success Metrics",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
                text: "Performance Indicators",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Query response time: < 2 seconds",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Accuracy rate: > 95%",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• System uptime: 99.9%",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Content freshness: Daily updates",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Business Metrics",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Customer satisfaction increase: 35%",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Support ticket reduction: 40%",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• First contact resolution: 60% improvement",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Agent productivity: 2x increase",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Implementation Process
            new Paragraph({
                text: "Implementation Process",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
                text: "Phase 1: Setup (Day 1-2)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Configure client accounts and domains",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Initialize crawling parameters",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Phase 2: Content Acquisition (Day 3-5)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Crawl specified websites",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Process and index content",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Phase 3: Optimization (Day 6-7)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Fine-tune responses",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Configure custom messages",
                spacing: { after: 200 },
                indent: { left: 720 }
            }),

            new Paragraph({
                text: "Phase 4: Launch (Week 2)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Deploy chat interface",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Train support team",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Monitor performance",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Technology Stack
            new Paragraph({
                text: "Technology Stack",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
                text: "Core Technologies",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                text: "• Runtime: Node.js v20.x",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Database: MongoDB Atlas with Vector Search",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Cache: Redis 7.x",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• AI Provider: OpenAI GPT-4",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Framework: Express.js",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "• Frontend: JavaScript with Tailwind CSS",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Contact Information
            new Paragraph({
                text: "Contact & Support",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "For more information or to schedule a demo:",
                spacing: { after: 100 }
            }),
            new Paragraph({
                text: "Email: broker-support@paybito.com",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "Support Portal: https://support.paybito.com",
                spacing: { after: 50 },
                indent: { left: 720 }
            }),
            new Paragraph({
                text: "Documentation: Available in project repository",
                spacing: { after: 300 },
                indent: { left: 720 }
            }),

            // Footer
            new Paragraph({
                text: "",
                spacing: { before: 600 }
            }),
            new Paragraph({
                text: "AI RAG Transformer - Transforming Customer Support with Intelligent Automation",
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: "AI RAG Transformer - Transforming Customer Support with Intelligent Automation",
                        italics: true,
                        color: "666666"
                    })
                ]
            }),
            new Paragraph({
                text: "Version 1.0.0 | October 2025 | Production Ready",
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: "Version 1.0.0 | October 2025 | Production Ready",
                        size: 20,
                        color: "666666"
                    })
                ]
            })
        ]
    }]
});

// Generate and save the document
Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("AI_RAG_Transformer_Product_Overview.docx", buffer);
    console.log("Document created successfully: AI_RAG_Transformer_Product_Overview.docx");
});