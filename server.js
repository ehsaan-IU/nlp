const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const natural = require('natural');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fsExtra = require('fs-extra');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Business cache to improve performance
const businessCache = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Get business ID from request
        const businessId = req.query.business || 'default';
        
        // Create business uploads directory if it doesn't exist
        const businessUploadsDir = path.join(__dirname, 'businesses', businessId, 'uploads');
        if (!fs.existsSync(businessUploadsDir)) {
            fs.mkdirSync(businessUploadsDir, { recursive: true });
        }
        
        cb(null, businessUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API configuration
// IMPORTANT: Replace this with your actual API key from Groq
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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"; 

// Function to get business configuration
async function getBusinessConfig(businessId) {
    // Check cache first
    if (businessCache.has(businessId)) {
        return businessCache.get(businessId);
    }
    
    // Business directory path
    const businessDir = path.join(__dirname, 'businesses', businessId);
    
    // Check if business directory exists
    if (!fs.existsSync(businessDir)) {
        console.warn(`⚠️ Business directory not found: ${businessId}`);
        return null;
    }
    
    try {
        // Load business configuration
        const configPath = path.join(businessDir, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Load knowledge base if it exists
        let knowledgeBase = [];
        const knowledgeBasePath = path.join(businessDir, 'knowledge_base.json');
        if (fs.existsSync(knowledgeBasePath)) {
            knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
        }
        
        // Prepare TF-IDF for this business
        const TfIdf = natural.TfIdf;
        const tfidf = new TfIdf();
        knowledgeBase.forEach((entry, idx) => {
            tfidf.addDocument(entry.question + ' ' + entry.answer, idx.toString());
        });
        
        // Create business data object
        const businessData = {
            config,
            knowledgeBase,
            tfidf,
            systemMessage: config.chatbot?.system_message || `You are ${config.business?.name || 'Yako'}, a professional business AI assistant representing ${config.business?.name || 'our company'}.

RESPONSE FORMATTING GUIDELINES:
- Use proper headings (##) and subheadings (###) to organize information
- Structure responses with bullet points (•) for lists and key features
- Use numbered lists (1., 2., 3.) for steps or sequential information
- Format prices and important details with **bold text**
- Use smaller, professional font styling for better readability
- Organize information in logical sections with clear separation

RESPONSE CONTENT GUIDELINES:
- Provide concise, professional answers (2-3 sentences maximum)
- Maintain formal business tone with consistent formatting
- Focus exclusively on business information, products, services, pricing, policies, and procedures
- Use "We" and "Our" (company voice) consistently
- Provide complete, actionable information in brief format
- Use professional language without excessive emojis

TOPIC RESTRICTIONS:
- ONLY address questions about ${config.business?.name || 'our business'} products, services, pricing, policies, location, contact information, delivery, shipping, and business operations
- For off-topic questions, professionally redirect: "I'm here to assist with ${config.business?.name || 'our business'} information. How can I help you with our products or services?"
- If similarity score is below 0.6, respond: "I don't have specific information about that. Please contact us directly at ${config.contact?.phone || 'our phone number'} for assistance."

CONVERSATION FLOW:
- Maintain professional context throughout conversation
- Provide structured, business-focused responses with proper formatting
- Redirect irrelevant questions professionally and courteously`,
            initialMessage: config.chatbot?.initial_message || `Welcome to ${config.business?.name || 'our business'}. How can we assist you today?`
        };
        
        // Cache the business data
        businessCache.set(businessId, businessData);
        
        console.log(`✅ Loaded business configuration for: ${businessData.config.business?.name || 'Unknown Business'}`);
        return businessData;
    } catch (e) {
        console.error(`❌ Error loading business configuration for ${businessId}:`, e.message);
        return null;
    }
}

// Store conversation history
const conversationHistory = new Map();

// Simple response patterns as fallback
const fallbackResponses = [
    "How can we assist you further?",
    "What would you like to know about our products?",
    "How can we help you with our services?",
    "What else would you like to discuss?",
    "How can we assist you today?",
    "What would you like to explore next?",
    "Is there anything specific we can help with?",
    "How can we better serve you?"
];

// Check if a message is relevant to the business
function isMessageRelevant(message = '', conversationHistory = [], businessConfig = {}) {
    const lowerMessage = message.toLowerCase();
    
    // Enhanced classification for off-topic questions
    const isOffTopicQuestion = 
        // General knowledge questions
        /what.*capital.*of/i.test(lowerMessage) ||
        /capital.*of.*what/i.test(lowerMessage) ||
        /tell.*me.*capital/i.test(lowerMessage) ||
        /who.*founded/i.test(lowerMessage) ||
        /when.*war/i.test(lowerMessage) ||
        /what.*year/i.test(lowerMessage) ||
        /what.*element/i.test(lowerMessage) ||
        /how.*many.*planets/i.test(lowerMessage) ||
        /what.*temperature/i.test(lowerMessage) ||
        /what.*country/i.test(lowerMessage) ||
        /where.*located/i.test(lowerMessage) ||
        /what.*continent/i.test(lowerMessage) ||
        /what.*square root/i.test(lowerMessage) ||
        /what.*percentage/i.test(lowerMessage) ||
        /what.*formula/i.test(lowerMessage) ||
        /what.*population/i.test(lowerMessage) ||
        /who.*invented/i.test(lowerMessage) ||
        /what.*language/i.test(lowerMessage) ||
        /what.*currency/i.test(lowerMessage) ||
        // Entertainment and pop culture
        /who.*actor/i.test(lowerMessage) ||
        /what.*movie/i.test(lowerMessage) ||
        /who.*singer/i.test(lowerMessage) ||
        /what.*song/i.test(lowerMessage) ||
        /who.*celebrity/i.test(lowerMessage) ||
        // Sports questions
        /who.*won.*game/i.test(lowerMessage) ||
        /what.*score/i.test(lowerMessage) ||
        /who.*team/i.test(lowerMessage) ||
        // Personal questions
        /how.*old.*are.*you/i.test(lowerMessage) ||
        /what.*your.*favorite/i.test(lowerMessage) ||
        /do.*you.*like/i.test(lowerMessage) ||
        /what.*your.*hobby/i.test(lowerMessage) ||
        // Philosophical questions
        /what.*meaning.*life/i.test(lowerMessage) ||
        /why.*exist/i.test(lowerMessage) ||
        /what.*purpose/i.test(lowerMessage) ||
        // Technical questions not related to business
        /how.*computer.*work/i.test(lowerMessage) ||
        /what.*programming.*language/i.test(lowerMessage) ||
        /how.*internet.*work/i.test(lowerMessage);
    
    // If it's an off-topic question, it's NOT relevant
    if (isOffTopicQuestion) {
        return false;
    }
    
    // Check against business keywords
    const businessKeywords = businessConfig.config?.keywords || [];
    const hasBusinessKeyword = businessKeywords.some(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
    );
    
    // Check for business name, type, or specialization
    const hasBusinessReference = 
        lowerMessage.includes(businessConfig.config?.business?.name?.toLowerCase() || '') ||
        lowerMessage.includes(businessConfig.config?.business?.type?.toLowerCase() || '') ||
        lowerMessage.includes(businessConfig.config?.business?.specialization?.toLowerCase() || '');
    
    // Check for common business-related terms
    const hasBusinessTerms = 
        lowerMessage.includes('service') ||
        lowerMessage.includes('price') ||
        lowerMessage.includes('cost') ||
        lowerMessage.includes('quote') ||
        lowerMessage.includes('contact') ||
        lowerMessage.includes('phone') ||
        lowerMessage.includes('email') ||
        lowerMessage.includes('hour') ||
        lowerMessage.includes('time') ||
        lowerMessage.includes('schedule') ||
        lowerMessage.includes('booking') ||
        lowerMessage.includes('appointment') ||
        lowerMessage.includes('deliver') ||
        lowerMessage.includes('delivery') ||
        lowerMessage.includes('ship') ||
        lowerMessage.includes('shipping') ||
        lowerMessage.includes('location') ||
        lowerMessage.includes('city') ||
        lowerMessage.includes('area');
    
    // Check for common business question patterns
    const hasBusinessQuestionPattern = 
        /what.*are.*(the|your).*(hours|timings|services|prices|costs|rates)/i.test(lowerMessage) ||
        /what.*are.*(the|your).*(operating|business|working).*(hours|times)/i.test(lowerMessage) ||
        /when.*are.*you.*open/i.test(lowerMessage) ||
        /what.*do.*you.*offer/i.test(lowerMessage) ||
        /how.*much.*do.*you.*charge/i.test(lowerMessage) ||
        /what.*are.*your.*rates/i.test(lowerMessage);
    
    // Check for conversation flow indicators (always relevant)
    const isConversationFlow = 
        lowerMessage.includes('what about') ||
        lowerMessage.includes('tell me more') ||
        lowerMessage.includes('can you explain') ||
        lowerMessage.includes('how does') ||
        lowerMessage.includes('why') ||
        lowerMessage.includes('when') ||
        lowerMessage.includes('where') ||
        lowerMessage.includes('which');
    
    // Check for basic conversation starters (allow these)
    const isConversationStarter = 
        lowerMessage.includes('hello') ||
        lowerMessage.includes('hi') ||
        lowerMessage.includes('help') ||
        lowerMessage.includes('bye') ||
        lowerMessage.includes('goodbye') ||
        lowerMessage.includes('how are you');
    
    // If this is a follow-up question and we have conversation history, be more lenient
    const hasConversationHistory = conversationHistory.length > 0;
    const isShortMessage = lowerMessage.length < 20;
    const isFollowUpQuestion = hasConversationHistory && (isShortMessage || isConversationFlow);
    
    return hasBusinessKeyword || hasBusinessReference || hasBusinessTerms || hasBusinessQuestionPattern || isConversationStarter || isFollowUpQuestion;
}

// Smart fallback based on message content
function getSmartFallback(message = '', conversationHistory = [], businessConfig = {}) {
    const lowerMessage = message.toLowerCase();
    
    // Check if message is relevant to the business
    const isRelevant = isMessageRelevant(message, conversationHistory, businessConfig);
    
    // If not relevant, redirect to business topics
    if (!isRelevant) {
        const redirectResponses = [
            `I'm here to help you with information about ${businessConfig.config?.business?.name || 'our business'} and our products. For general knowledge questions, I recommend using a search engine or an encyclopedia.`,
            `I'm here to assist you with questions about ${businessConfig.config?.business?.name || 'our business'} and our products. For general knowledge questions such as this, I recommend using a search engine or encyclopedia.`,
            `We'd be happy to help with questions about ${businessConfig.config?.business?.name || 'our services'}! What would you like to know about our business?`,
            `We're here to assist with ${businessConfig.config?.business?.type || 'our services'}. Is there anything specific about our business you'd like to know?`,
            `We focus on helping customers with ${businessConfig.config?.business?.specialization || 'our services'}. How can we assist you with that?`
        ];
        return redirectResponses[Math.floor(Math.random() * redirectResponses.length)];
    }
    
    // Business-specific responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return businessConfig.config?.chatbot?.greeting || "Hello! How can we assist you today?";
    } else if (lowerMessage.includes('how are you')) {
        return "We're doing well, thank you. How can we assist you with our products?";
    } else if (lowerMessage.includes('what') && lowerMessage.includes('name')) {
        return `We're ${businessConfig.config?.business?.name || 'Yako'}, your business assistant. How can we help you?`;
    } else if (lowerMessage.includes('help')) {
        return "What would you like assistance with regarding our products or services?";
    } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
        return "Thank you for your interest. Have a great day!";
    } else if (lowerMessage.includes('service') || lowerMessage.includes('area')) {
        const areas = businessConfig.config?.service_areas?.slice(0, 3).join(', ') || 'our service areas';
        return `We service ${areas} and surrounding areas. How can we assist you?`;
    } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('quote')) {
        return `We offer competitive pricing with free quotes. Would you like pricing information?`;
    } else if (lowerMessage.includes('contact') || lowerMessage.includes('phone') || lowerMessage.includes('email')) {
        const contact = businessConfig.config?.contact;
        return `Contact us at ${contact?.phone || 'our phone number'} or ${contact?.email || 'our email'}. Business hours: ${contact?.hours || 'Monday-Friday'}.`;
    } else if (lowerMessage.includes('hour') || lowerMessage.includes('time')) {
        return `Our business hours are ${businessConfig.config?.contact?.hours || 'Monday-Friday'}. When would you like to schedule?`;
    } else {
        return businessConfig.config?.chatbot?.fallback || fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

function retrieveRelevantContext(query, businessData, topK = 1, similarityThreshold = 0.6) {
    if (!businessData.knowledgeBase.length) return { contexts: [], maxScore: 0 };
    
    const scores = [];
    businessData.tfidf.tfidfs(query, (i, measure) => {
        scores.push({ idx: i, score: measure });
    });
    
    scores.sort((a, b) => b.score - a.score);
    const maxScore = scores.length > 0 ? scores[0].score : 0;
    
    // Only return contexts if similarity score meets threshold
    if (maxScore < similarityThreshold) {
        return { contexts: [], maxScore };
    }
    
    const top = scores.slice(0, topK).filter(s => s.score >= similarityThreshold);
    return { 
        contexts: top.map(s => businessData.knowledgeBase[s.idx].answer),
        maxScore: maxScore
    };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString()
    });
});

// Widget file endpoint
app.get('/public/chatbot-widget.js', (req, res) => {
    const widgetPath = path.join(__dirname, 'public', 'chatbot-widget.js');
    if (fs.existsSync(widgetPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(widgetPath);
    } else {
        res.status(404).json({ error: 'Widget file not found' });
    }
});

// Business theme endpoint
app.get('/api/business-theme', (req, res) => {
    const businessId = req.query.business || 'default';
    const themePath = path.join(__dirname, 'businesses', businessId, 'theme.css');
    
    if (fs.existsSync(themePath)) {
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(themePath);
    } else {
        // Send default theme if business theme doesn't exist
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(path.join(__dirname, 'styles.css'));
    }
});

// Business config endpoint
app.get('/api/business-config', async (req, res) => {
    const businessId = req.query.business || 'default';
    const businessData = await getBusinessConfig(businessId);
    
    if (businessData) {
        res.json(businessData.config);
    } else {
        res.status(404).json({ error: 'Business not found' });
    }
});

// Start server
async function startServer() {
    console.log('🤖 Starting AI Chatbot Server...');
    
    // Chat endpoint
    app.post('/api/chat', async (req, res) => {
        try {
            const { message } = req.body;
            const businessId = req.query.business || 'default';
            
            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'Message is required' });
            }
            
            console.log(`Received message for business ${businessId}:`, message);
            
            // Get business configuration
            const businessData = await getBusinessConfig(businessId);
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Get conversation history
            const sessionId = `${businessId}_${req.headers['x-session-id'] || 'default'}`;
            let history = conversationHistory.get(sessionId) || [];
            
            // Check if this is a new conversation (no history yet)
            const isNewConversation = history.length === 0;
            
            if (isNewConversation) {
                console.log('New conversation started, will include initial message in response');
            }
            
            // Add user message to history
            history.push({ role: 'user', content: message });
            
            let botResponse;
            
            try {
                // Handle common queries with rule-based system first for faster response
                const lowerMessage = message.toLowerCase();
                
                if (/^(what\s+is\s+)?2\s*\+\s*2(\s*=\s*)?$/i.test(lowerMessage)) {
                    botResponse = "2 + 2 = 4";
                } 
                else if (/what.*time|current time/i.test(lowerMessage)) {
                    botResponse = `The current time is ${new Date().toLocaleTimeString()}.`;
                } 
                else if (/what.*date|today.*date|current date/i.test(lowerMessage)) {
                    botResponse = `Today's date is ${new Date().toLocaleDateString()}.`;
                }
                else if (/\d+\s*\+\s*\d+/.test(lowerMessage)) {
                    // Addition
                    const numbers = lowerMessage.match(/(\d+)\s*\+\s*(\d+)/);
                    if (numbers && numbers.length >= 3) {
                        const result = parseInt(numbers[1]) + parseInt(numbers[2]);
                        botResponse = `${numbers[1]} + ${numbers[2]} = ${result}`;
                    }
                }
                else if (GROQ_API_KEY) {
                    // Check if message is relevant before using AI (consider conversation context)
                    if (!isMessageRelevant(message, history, businessData)) {
                        const redirectResponses = [
                            `I'm here to help with ${businessData.config?.business?.name || 'our business'} information. How can I assist you with our services?`,
                            `We focus on ${businessData.config?.business?.name || 'our business'} services. What would you like to know about us?`,
                            `I'm here to help with ${businessData.config?.business?.name || 'our business'} questions. How can I assist you?`
                        ];
                        botResponse = redirectResponses[Math.floor(Math.random() * redirectResponses.length)];
                    } else {
                        // If no rule matches and we have an API key, use Groq
                        console.log('Using Groq API for response...');

                        // RAG: Retrieve relevant context with lower similarity threshold for better matching
                        const ragResult = retrieveRelevantContext(message, businessData, 1, 0.6);
                        let contextString = '';
                        
                        // Check if similarity score is too low
                        if (ragResult.maxScore < 0.6) {
                            botResponse = `I don't have specific information about that. Please contact us directly at ${businessData.config?.contact?.phone || 'our phone number'} for assistance.`;
                        } else if (ragResult.contexts.length > 0) {
                            contextString = `Relevant info: ${ragResult.contexts.join('\n')}`;
                        }

                        if (!botResponse) {
                            // Prepare the conversation history for Groq
                            const messages = [
                                { role: 'system', content: businessData.systemMessage },
                            ];
                            if (contextString) {
                                messages.push({ role: 'system', content: contextString });
                            }
                            // Include up to 10 recent messages for context
                            messages.push(...history.slice(-10));

                            // Call Groq API
                            console.log('Making request to Groq API...');

                            const requestBody = {
                                model: 'llama3-8b-8192',  // Using Llama 3 8B model, fast and efficient
                                messages: messages,
                                max_tokens: 150,  // Reduced for concise responses
                                temperature: 0.2  // Lower temperature for more consistent responses
                            };
                            
                            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(requestBody)
                            });
                            
                            if (groqResponse.ok) {
                                const data = await groqResponse.json();
                                
                                if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                                    botResponse = data.choices[0].message.content.trim();
                                    console.log('✅ Groq API response received');
                                } else {
                                    console.error('Unexpected response format:', data);
                                    throw new Error('Invalid response format from Groq API');
                                }
                            } else {
                                console.error('API response not ok:', groqResponse.status);
                                let errorText = '';
                                
                                try {
                                    const errorData = await groqResponse.json();
                                    console.error('API error details:', errorData);
                                    errorText = JSON.stringify(errorData);
                                } catch (e) {
                                    errorText = await groqResponse.text().catch(() => 'Could not get error details');
                                    console.error('API error text:', errorText);
                                }
                                
                                if (groqResponse.status === 401) {
                                    throw new Error(`Groq API error: Authentication failed. Please check your API key. Details: ${errorText}`);
                                } else {
                                    throw new Error(`Groq API error (${groqResponse.status}): ${errorText}`);
                                }
                            }
                        }
                    }
                } else {
                    // No API key, use fallback
                    console.log('⚠️ No Groq API key available, using fallback');
                    botResponse = getSmartFallback(message, history, businessData);
                }
                
                console.log('Bot response:', botResponse);
                
            } catch (error) {
                console.error('❌ Error generating response:', error.message);
                // Use fallback if all methods fail
                botResponse = getSmartFallback(message, history, businessData);
            }
            
            // Add bot response to history and store
            history.push({ role: 'assistant', content: botResponse });
            
            // Keep history manageable
            if (history.length > 20) {
                history = history.slice(-20);
            }
            
            conversationHistory.set(sessionId, history);
            
            res.json({ 
                response: botResponse,
                isNewConversation: isNewConversation,
                initialMessage: isNewConversation ? businessData.initialMessage : null
            });

        } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({ 
                error: 'Sorry, we encountered an error. Please try again.',
                details: error.message 
            });
        }
    });

    // Add a route to get conversation history
    app.get('/api/history', (req, res) => {
        const businessId = req.query.business || 'default';
        const sessionId = `${businessId}_${req.headers['x-session-id'] || 'default'}`;
        const history = conversationHistory.get(sessionId) || [];
        res.json({ history });
    });

    // Add a route to get initial message
    app.get('/api/initial-message', async (req, res) => {
        const businessId = req.query.business || 'default';
        const businessData = await getBusinessConfig(businessId);
        
        if (businessData) {
            res.json({ message: businessData.initialMessage });
        } else {
            res.json({ message: "👋 Hello! How can we help you today?" });
        }
    });

    // Endpoint to check if Groq API key is valid
    app.get('/api/check-api-key', async (req, res) => {
        if (!GROQ_API_KEY) {
            return res.json({ valid: false, message: 'No API key provided' });
        }
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                }
            });
            
            if (response.ok) {
                res.json({ valid: true, message: 'API key is valid' });
            } else {
                const error = await response.json();
                res.json({ valid: false, message: error.error?.message || 'Invalid API key' });
            }
        } catch (error) {
            res.json({ valid: false, message: error.message });
        }
    });

    // PDF Upload and Processing Endpoints
    app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No PDF file uploaded' });
            }

            const businessId = req.query.business || 'default';
            const businessData = await getBusinessConfig(businessId);
            
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            const businessName = businessData.config.business?.name || 'Business';
            const filePath = req.file.path;
            
            console.log(`Processing uploaded PDF for ${businessName}: ${req.file.originalname}`);
            
            // Process PDF to knowledge base
            const newEntries = await processPDFToKnowledgeBase(filePath, businessName);
            
            // Update knowledge base
            const updatedKB = await updateBusinessKnowledgeBase(businessId, newEntries);
            
            // Clean up uploaded file
            fsExtra.remove(filePath);
            
            res.json({
                success: true,
                message: `PDF processed successfully! Added ${newEntries.length} entries to knowledge base.`,
                entriesAdded: newEntries.length,
                totalEntries: updatedKB.length,
                filename: req.file.originalname
            });
            
        } catch (error) {
            console.error('PDF upload error:', error);
            
            // Clean up file if it exists
            if (req.file && req.file.path) {
                fsExtra.remove(req.file.path).catch(console.error);
            }
            
            res.status(500).json({
                error: 'Failed to process PDF',
                details: error.message
            });
        }
    });

    // Get knowledge base statistics
    app.get('/api/knowledge-base-stats', async (req, res) => {
        try {
            const businessId = req.query.business || 'default';
            const businessData = await getBusinessConfig(businessId);
            
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            const stats = {
                totalEntries: businessData.knowledgeBase.length,
                sources: [...new Set(businessData.knowledgeBase.map(entry => entry.source).filter(Boolean))],
                lastUpdated: new Date().toISOString()
            };
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get knowledge base stats' });
        }
    });

    // Get uploaded files list
    app.get('/api/uploaded-files', async (req, res) => {
        try {
            const businessId = req.query.business || 'default';
            const uploadsDir = path.join(__dirname, 'businesses', businessId, 'uploads');
            
            if (!fs.existsSync(uploadsDir)) {
                return res.json({ files: [] });
            }
            
            const files = fs.readdirSync(uploadsDir)
                .filter(file => file.endsWith('.pdf'))
                .map(file => ({
                    name: file,
                    size: fs.statSync(path.join(uploadsDir, file)).size,
                    uploaded: fs.statSync(path.join(uploadsDir, file)).mtime
                }));
            
            res.json({ files });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get uploaded files' });
        }
    });

    // List available businesses
    app.get('/api/businesses', (req, res) => {
        try {
            const businessesDir = path.join(__dirname, 'businesses');
            if (!fs.existsSync(businessesDir)) {
                return res.json({ businesses: [] });
            }
            
            const businesses = fs.readdirSync(businessesDir)
                .filter(dir => fs.statSync(path.join(businessesDir, dir)).isDirectory())
                .filter(dir => fs.existsSync(path.join(businessesDir, dir, 'config.json')))
                .map(dir => {
                    try {
                        const config = JSON.parse(fs.readFileSync(path.join(businessesDir, dir, 'config.json'), 'utf8'));
                        return {
                            id: dir,
                            name: config.business?.name || dir,
                            type: config.business?.type || 'Business',
                            location: config.business?.location || ''
                        };
                    } catch (e) {
                        return {
                            id: dir,
                            name: dir,
                            type: 'Unknown',
                            location: ''
                        };
                    }
                });
            
            res.json({ businesses });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get businesses list' });
        }
    });

    // PDF Processing Functions
    function chunkText(text, maxChunkSize = 500) {
        // Split by sentences first
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            const sentenceLength = sentence.trim().length;
            
            // If adding this sentence would exceed max size, start a new chunk
            if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                // If single sentence is too long, split it by commas or semicolons
                if (sentenceLength > maxChunkSize) {
                    const subChunks = sentence.split(/[,;]/).filter(s => s.trim().length > 0);
                    let subChunk = '';
                    for (const sub of subChunks) {
                        if ((subChunk + sub).length > maxChunkSize) {
                            if (subChunk) chunks.push(subChunk.trim());
                            subChunk = sub;
                        } else {
                            subChunk += (subChunk ? ', ' : '') + sub;
                        }
                    }
                    if (subChunk) currentChunk = subChunk;
                } else {
                    currentChunk = sentence;
                }
            } else {
                currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    function generateQuestionsFromText(text) {
        const questions = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Generate questions based on content
        sentences.forEach(sentence => {
            const cleanSentence = sentence.trim();
            if (cleanSentence.length > 20) {
                // Create a question from the sentence
                const question = `What is ${cleanSentence.toLowerCase().replace(/^the\s+/i, '').replace(/^a\s+/i, '').replace(/^an\s+/i, '')}?`;
                questions.push({
                    question: question,
                    answer: cleanSentence
                });
            }
        });
        
        return questions;
    }

    async function processPDFToKnowledgeBase(filePath, businessName = 'Business') {
        try {
            console.log(`Processing PDF: ${filePath}`);
            
            // Read PDF file
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            
            console.log(`PDF text extracted: ${data.text.length} characters`);
            
            // Clean and process text
            let cleanText = data.text
                .replace(/\s+/g, ' ')
                .replace(/\n+/g, ' ')
                .trim();
            
            // Split into chunks
            const chunks = chunkText(cleanText, 800);
            console.log(`Created ${chunks.length} text chunks`);
            
            // Generate knowledge base entries
            const newEntries = [];
            
            chunks.forEach((chunk, index) => {
                if (chunk.length > 50) {
                    // Create a general question about this chunk
                    const question = `What information is available about ${businessName} in section ${index + 1}?`;
                    newEntries.push({
                        question: question,
                        answer: chunk,
                        source: path.basename(filePath),
                        section: index + 1
                    });
                    
                    // Generate specific questions from the chunk
                    const specificQuestions = generateQuestionsFromText(chunk);
                    specificQuestions.forEach(q => {
                        newEntries.push({
                            question: q.question,
                            answer: q.answer,
                            source: path.basename(filePath),
                            section: index + 1
                        });
                    });
                }
            });
            
            console.log(`Generated ${newEntries.length} knowledge base entries`);
            return newEntries;
            
        } catch (error) {
            console.error('Error processing PDF:', error);
            throw error;
        }
    }

    async function updateBusinessKnowledgeBase(businessId, newEntries) {
        try {
            const businessDir = path.join(__dirname, 'businesses', businessId);
            if (!fs.existsSync(businessDir)) {
                throw new Error(`Business directory not found: ${businessId}`);
            }
            
            // Load existing knowledge base
            let existingKB = [];
            const knowledgeBasePath = path.join(businessDir, 'knowledge_base.json');
            if (fs.existsSync(knowledgeBasePath)) {
                existingKB = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
            }
            
            // Add new entries
            const updatedKB = [...existingKB, ...newEntries];
            
            // Add business-specific knowledge if business config exists
            const businessData = await getBusinessConfig(businessId);
            if (businessData && businessData.config.business?.name) {
                const businessEntries = generateBusinessSpecificEntries(businessData.config);
                updatedKB.push(...businessEntries);
            }
            
            // Save updated knowledge base
            fs.writeFileSync(knowledgeBasePath, JSON.stringify(updatedKB, null, 2));
            
            // Update cache
            businessCache.delete(businessId);
            
            console.log(`Knowledge base updated for ${businessId} with ${newEntries.length} new entries. Total: ${updatedKB.length}`);
            return updatedKB;
            
        } catch (error) {
            console.error('Error updating knowledge base:', error);
            throw error;
        }
    }

    function generateBusinessSpecificEntries(businessConfig) {
        const entries = [];
        const business = businessConfig.business;
        const services = businessConfig.services;
        const contact = businessConfig.contact;
        
        // Basic business information
        entries.push({
            question: `What is ${business.name}?`,
            answer: `${business.name} is a ${business.type} specializing in ${business.specialization}. Founded in ${business.founded}, we are a family-owned and operated business serving ${business.location}.`,
            source: 'business-config',
            section: 'company-info'
        });
        
        // Services
        if (services?.primary) {
            entries.push({
                question: `What services does ${business.name} offer?`,
                answer: `We offer the following services: ${services.primary.join(', ')}.`,
                source: 'business-config',
                section: 'services'
            });
        }
        
        // Contact information
        if (contact) {
            entries.push({
                question: `How can I contact ${business.name}?`,
                answer: `You can reach us at ${contact.phone} or email us at ${contact.email}. Our address is ${contact.address}.`,
                source: 'business-config',
                section: 'contact'
            });
            
            entries.push({
                question: `What are ${business.name}'s operating hours?`,
                answer: `Our operating hours are: ${contact.hours}.`,
                source: 'business-config',
                section: 'contact'
            });
        }
        
        // Service areas
        if (businessConfig.service_areas) {
            entries.push({
                question: `What areas does ${business.name} service?`,
                answer: `We service the following areas: ${businessConfig.service_areas.join(', ')}.`,
                source: 'business-config',
                section: 'service-areas'
            });
        }
        
        // Certifications
        if (businessConfig.certifications) {
            entries.push({
                question: `What certifications does ${business.name} have?`,
                answer: `We are certified by: ${businessConfig.certifications.join(', ')}.`,
                source: 'business-config',
                section: 'certifications'
            });
        }
        
        return entries;
    }

    // Start the server
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
        
        // Get local IP address for mobile access
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        let localIp = '127.0.0.1';
        
        // Find a non-internal IPv4 address
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
        }
        
        console.log(`📱 Access on your phone at http://${localIp}:${PORT}`);
        console.log(`🌐 Server bound to ${HOST}:${PORT}`);
        console.log('✅ Multi-tenant Chatbot SaaS is ready!');
        console.log('💬 Using Groq API with rule-based fallback');
    });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});

startServer();