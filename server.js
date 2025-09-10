const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configurations and services
const appConfig = require('./config/app');
const databaseConfig = require('./config/database');
const businessService = require('./services/BusinessService');
const aiService = require('./services/AIService');
const ragService = require('./services/RAGService');

class ChatbotServer {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        
        console.log('🤖 ChatBot Server initialized');
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
        }));

        // Request logging
        if (appConfig.isDevelopment()) {
            this.app.use((req, res, next) => {
                console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
                next();
            });
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', this.healthCheck.bind(this));
        
        // Main chat endpoint
        this.app.post('/api/chat', this.handleChat.bind(this));
        
        // Initial message endpoint
        this.app.get('/api/initial-message', this.getInitialMessage.bind(this));
        
        // Business management endpoints
        this.app.get('/api/businesses', this.getAllBusinesses.bind(this));
        this.app.get('/api/business/:id', this.getBusinessDetails.bind(this));
        this.app.post('/api/business/:id/cache/clear', this.clearBusinessCache.bind(this));
        
        // Debug endpoints
        this.app.get('/api/debug/knowledge-base', this.debugKnowledgeBase.bind(this));
        this.app.post('/api/debug/test-rag', this.testRAG.bind(this));
        this.app.get('/api/debug/stats', this.getDebugStats.bind(this));
        
        // Admin endpoints
        this.app.post('/api/admin/cache/clear', this.clearAllCache.bind(this));
        this.app.get('/api/admin/sessions', this.getActiveSessions.bind(this));

        // Widget endpoints
        this.app.get('/widget/chatbot.js', this.serveWidgetScript.bind(this));
        this.app.get('/widget/embed/:businessId', this.serveEmbedScript.bind(this));
        this.app.get('/widget/demo/:businessId?', this.serveDemo.bind(this));

        // Widget configuration endpoint 
        this.app.get('/api/widget/config/:businessId', this.getWidgetConfig.bind(this));
        this.app.post('/api/widget/config/:businessId', this.saveWidgetConfig.bind(this));

        
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ 
                error: 'Endpoint not found',
                available_endpoints: [
                    'GET /api/health',
                    'POST /api/chat',
                    'GET /api/initial-message',
                    'GET /api/businesses'
                ]
            });
        });
    }

    async serveWidgetScript(req, res) {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Try to serve from public directory first
        const publicScriptPath = path.join(__dirname, 'public', 'chatbot-widget.js');
        
        if (fs.existsSync(publicScriptPath)) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.sendFile(publicScriptPath);
        } else {
            // Fallback - serve inline widget script
            const widgetScript = this.getInlineWidgetScript();
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(widgetScript);
        }
    } catch (error) {
        console.error('❌ Widget script error:', error);
        res.status(500).json({ error: 'Failed to serve widget script' });
    }
}

getInlineWidgetScript() {
    // Basic inline widget script as fallback
    return `
// Chatbot Widget Fallback Script
(function() {
    console.log('Loading chatbot widget...');
    
    // Create a simple fallback widget
    const widget = document.createElement('div');
    widget.innerHTML = \`
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
            <div style="background: #007bff; color: white; padding: 15px; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.2);" onclick="alert('Chatbot widget loaded! Please add chatbot-widget.js to public/ directory for full functionality.')">
                💬 Chat
            </div>
        </div>
    \`;
    document.body.appendChild(widget);
    
    console.warn('Chatbot widget fallback loaded. Add chatbot-widget.js to public/ directory for full functionality.');
})();
    `;
}

async serveEmbedScript(req, res) {
    try {
        const businessId = req.params.businessId;
        
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        // Verify business exists
        const businessData = await businessService.getBusinessConfig(businessId);
        if (!businessData) {
            return res.status(404).json({ error: 'Business not found' });
        }

        const embedScript = this.generateEmbedScript(businessId);
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(embedScript);
        
    } catch (error) {
        console.error('❌ Embed script error:', error);
        res.status(500).json({ error: 'Failed to serve embed script' });
    }
}

generateEmbedScript(businessId) {
    const serverUrl = process.env.SERVER_URL || `http://localhost:${appConfig.server.port}`;
    
    return `
// Chatbot Embed Script for Business: ${businessId}
(function() {
    const CHATBOT_CONFIG = {
        businessId: '${businessId}',
        serverUrl: '${serverUrl}',
        apiEndpoint: '${serverUrl}/api/chat',
        initialMessageEndpoint: '${serverUrl}/api/initial-message'
    };

    // Create chatbot container
    const chatbotContainer = document.createElement('div');
    chatbotContainer.id = 'chatbot-container-${businessId}';
    chatbotContainer.innerHTML = \`
        <div id="chatbot-widget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 5px 30px rgba(0,0,0,0.3);
            z-index: 9999;
            display: none;
            flex-direction: column;
        ">
            <div id="chatbot-header" style="
                background: #007bff;
                color: white;
                padding: 15px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 style="margin: 0; font-size: 16px;">Chat Support</h3>
                <button id="close-chatbot" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                ">×</button>
            </div>
            <div id="chatbot-messages" style="
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                max-height: 350px;
            ">
                <div class="message bot-message" style="
                    margin-bottom: 10px;
                    padding: 10px;
                    background: #f1f1f1;
                    border-radius: 10px;
                ">
                    <div class="message-text">Loading...</div>
                </div>
            </div>
            <div id="chatbot-input-area" style="
                padding: 15px;
                border-top: 1px solid #eee;
            ">
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="chatbot-input" placeholder="Type your message..." style="
                        flex: 1;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        outline: none;
                    ">
                    <button id="send-message" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Send</button>
                </div>
            </div>
        </div>
        
        <div id="chatbot-toggle" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: #007bff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            z-index: 9999;
        ">
            <span style="color: white; font-size: 24px;">💬</span>
        </div>
    \`;

    document.body.appendChild(chatbotContainer);

    // Initialize chatbot functionality
    let sessionId = null;
    const widget = document.getElementById('chatbot-widget');
    const toggle = document.getElementById('chatbot-toggle');
    const closeBtn = document.getElementById('close-chatbot');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('send-message');
    const messagesContainer = document.getElementById('chatbot-messages');

    // Generate session ID
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Toggle widget
    toggle.addEventListener('click', () => {
        widget.style.display = widget.style.display === 'none' ? 'flex' : 'none';
        if (widget.style.display === 'flex') {
            loadInitialMessage();
        }
    });

    closeBtn.addEventListener('click', () => {
        widget.style.display = 'none';
    });

    // Send message functionality
    function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        input.value = '';

        // Send to API
        fetch(CHATBOT_CONFIG.apiEndpoint + '?business=' + CHATBOT_CONFIG.businessId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.response) {
                addMessage(data.response, 'bot');
            } else {
                addMessage('Sorry, I couldn\\'t process your message. Please try again.', 'bot');
            }
        })
        .catch(error => {
            console.error('Chatbot error:', error);
            addMessage('Sorry, something went wrong. Please try again later.', 'bot');
        });
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${sender}-message\`;
        messageDiv.style.cssText = \`
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 10px;
            \${sender === 'user' ? 
                'background: #007bff; color: white; margin-left: 20px;' : 
                'background: #f1f1f1; margin-right: 20px;'
            }
        \`;
        messageDiv.innerHTML = \`<div class="message-text">\${text}</div>\`;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function loadInitialMessage() {
        fetch(CHATBOT_CONFIG.initialMessageEndpoint + '?business=' + CHATBOT_CONFIG.businessId)
        .then(response => response.json())
        .then(data => {
            messagesContainer.innerHTML = '';
            addMessage(data.message || 'Hello! How can I help you today?', 'bot');
        })
        .catch(error => {
            console.error('Initial message error:', error);
            messagesContainer.innerHTML = '';
            addMessage('Hello! How can I help you today?', 'bot');
        });
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    console.log('Chatbot embed loaded for business:', CHATBOT_CONFIG.businessId);
})();
    `;
}

async serveDemo(req, res) {
    try {
        const businessId = req.params.businessId || 'default';
        
        // Get business data for demo
        const businessData = await businessService.getBusinessConfig(businessId);
        const businessName = businessData?.config?.business?.name || 'Demo Business';
        
        const demoHTML = this.generateDemoHTML(businessId, businessName);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(demoHTML);
        
    } catch (error) {
        console.error('❌ Demo page error:', error);
        res.status(500).send('<h1>Error loading demo page</h1>');
    }
}

generateDemoHTML(businessId, businessName) {
    const serverUrl = process.env.SERVER_URL || `http://localhost:${appConfig.server.port}`;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chatbot Demo - ${businessName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }
        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #007bff;
        }
        .demo-instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .code-snippet {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            overflow-x: auto;
            margin: 10px 0;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 5px;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Chatbot Demo</h1>
        <p class="subtitle">Business: <strong>${businessName}</strong> (ID: ${businessId})</p>
        
        <div class="info-box">
            <h3>📋 Demo Information</h3>
            <p><strong>Business ID:</strong> ${businessId}</p>
            <p><strong>Server URL:</strong> ${serverUrl}</p>
            <p><strong>Status:</strong> <span style="color: green;">Active</span></p>
        </div>

        <div class="demo-instructions">
            <h3>🚀 How to Test</h3>
            <p>Click the chat button in the bottom-right corner to start chatting with the AI assistant!</p>
            <p>The chatbot will load the specific configuration and knowledge base for <strong>${businessName}</strong>.</p>
        </div>

        <div class="info-box">
            <h3>🔧 Integration Code</h3>
            <p>To embed this chatbot on your website, add this script tag:</p>
            <div class="code-snippet">
&lt;script src="${serverUrl}/widget/embed/${businessId}"&gt;&lt;/script&gt;
            </div>
        </div>

        <div class="info-box">
            <h3>📡 API Endpoints</h3>
            <p><strong>Chat API:</strong> <code>POST ${serverUrl}/api/chat?business=${businessId}</code></p>
            <p><strong>Initial Message:</strong> <code>GET ${serverUrl}/api/initial-message?business=${businessId}</code></p>
            <p><strong>Widget Config:</strong> <code>GET ${serverUrl}/api/widget/config/${businessId}</code></p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${serverUrl}/api/health" class="btn" target="_blank">🔍 Health Check</a>
            <a href="${serverUrl}/api/businesses" class="btn" target="_blank">📋 All Businesses</a>
            <a href="${serverUrl}/api/debug/knowledge-base?business=${businessId}" class="btn" target="_blank">🧠 Knowledge Base</a>
        </div>
    </div>

    <!-- Load the chatbot widget -->
    <script src="${serverUrl}/widget/embed/${businessId}"></script>
</body>
</html>
    `;
}

async getWidgetConfig(req, res) {
    try {
        const businessId = req.params.businessId;
        
        // Get business data
        const businessData = await businessService.getBusinessConfig(businessId);
        if (!businessData) {
            return res.status(404).json({ error: 'Business not found' });
        }

        // Return widget configuration
        const config = {
            businessId: businessId,
            businessName: businessData.config.business.name,
            theme: businessData.config.widget?.theme || 'default',
            position: businessData.config.widget?.position || 'bottom-right',
            welcomeMessage: businessData.initialMessage,
            apiEndpoints: {
                chat: `/api/chat?business=${businessId}`,
                initialMessage: `/api/initial-message?business=${businessId}`
            }
        };

        res.json(config);
    } catch (error) {
        console.error('❌ Widget config error:', error);
        res.status(500).json({ error: 'Failed to get widget config' });
    }
}

async saveWidgetConfig(req, res) {
    try {
        const businessId = req.params.businessId;
        const { theme, position, welcomeMessage } = req.body;
        
        // This would typically save to database
        // For now, just return success
        res.json({
            message: 'Widget configuration saved',
            businessId: businessId,
            config: { theme, position, welcomeMessage }
        });
    } catch (error) {
        console.error('❌ Save widget config error:', error);
        res.status(500).json({ error: 'Failed to save widget config' });
    }
}

async getThemes(req, res) {
    try {
        const businessId = req.params.businessId;
        
        // Return available themes
        const themes = [
            {
                id: 'default',
                name: 'Default Blue',
                colors: {
                    primary: '#007bff',
                    secondary: '#6c757d',
                    background: '#ffffff'
                }
            },
            {
                id: 'light',
                name: 'Dark Mode',
                colors: {
                    primary: '#28a745',
                    secondary: '#343a40',
                    background: '#212529'
                }
            },
            {
                id: 'purple',
                name: 'Purple Theme',
                colors: {
                    primary: '#6f42c1',
                    secondary: '#6c757d',
                    background: '#ffffff'
                }
            }
        ];

        res.json({ themes, businessId });
    } catch (error) {
        console.error('❌ Get themes error:', error);
        res.status(500).json({ error: 'Failed to get themes' });
    }
}


    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            console.error('❌ Server error:', error);
            
            res.status(error.status || 500).json({
                error: appConfig.isDevelopment() ? error.message : 'Internal server error',
                timestamp: new Date().toISOString(),
                path: req.path
            });
        });
    }

    // Route handlers
    async healthCheck(req, res) {
        try {
            const dbHealth = await businessService.healthCheck();
            const aiStats = aiService.getStats();
            
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                environment: appConfig.server.nodeEnv,
                services: {
                    database: dbHealth,
                    ai: aiStats
                }
            });
        } catch (error) {
            res.status(503).json({
                status: 'error',
                error: error.message
            });
        }
    }

    async handleChat(req, res) {
        try {
            const { message } = req.body;
            const businessId = req.query.business || req.body.business_id || 'default';
            const sessionId = req.headers['x-session-id'] || `${businessId}_${Date.now()}`;

            // Validation
            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'Message is required' });
            }

            if (message.length > 1000) {
                return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
            }

            console.log(`📨 Chat request - Business: ${businessId}, Session: ${sessionId}`);
            console.log(`📝 Message: "${message}"`);

            // Get business configuration
            const businessData = await businessService.getBusinessConfig(businessId);
            if (!businessData) {
                return res.status(404).json({ 
                    error: 'Business not found',
                    business_id: businessId 
                });
            }

            // Generate AI response
            const fullSessionId = `${businessId}_${sessionId}`;
            const result = await aiService.generateResponse(message, businessData, fullSessionId);

            console.log(`✅ Response generated for ${businessId}:`, result.response.substring(0, 100));

            res.json({
                ...result,
                business_id: businessId,
                session_id: sessionId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Chat error:', error);
            res.status(500).json({
                error: 'Failed to process message',
                details: appConfig.isDevelopment() ? error.message : undefined,
                suggestions: ['hey you there?', 'can you try again?', 'what happened?']
            });
        }
    }

    async getInitialMessage(req, res) {
        try {
            const businessId = req.query.business || 'default';
            const businessData = await businessService.getBusinessConfig(businessId);

            const defaultSuggestions = [
                'hey what\'s up?', 
                'how\'s your day going?', 
                'you free to chat?'
            ];

            if (businessData) {
                res.json({
                    message: businessData.initialMessage,
                    business_name: businessData.config.business.name,
                    suggestions: defaultSuggestions,
                    business_id: businessId
                });
            } else {
                res.json({ 
                    message: 'hey! what\'s up?', 
                    suggestions: defaultSuggestions,
                    business_id: businessId
                });
            }
        } catch (error) {
            console.error('❌ Initial message error:', error);
            res.status(500).json({ error: 'Failed to get initial message' });
        }
    }

    async getAllBusinesses(req, res) {
        try {
            const businesses = await businessService.getAllBusinesses();
            res.json({
                businesses,
                total: businesses.length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Get businesses error:', error);
            res.status(500).json({ error: 'Failed to fetch businesses' });
        }
    }

    async getBusinessDetails(req, res) {
        try {
            const businessId = req.params.id;
            const businessData = await businessService.getBusinessConfig(businessId);
            
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Remove sensitive data
            const publicData = {
                config: businessData.config,
                knowledge_base_count: businessData.knowledgeBase.length,
                categories: [...new Set(businessData.knowledgeBase.map(kb => kb.category))],
                last_updated: new Date().toISOString()
            };

            res.json(publicData);
        } catch (error) {
            console.error('❌ Get business details error:', error);
            res.status(500).json({ error: 'Failed to get business details' });
        }
    }

    async clearBusinessCache(req, res) {
        try {
            const businessId = req.params.id;
            businessService.clearCache(businessId);
            
            res.json({
                message: `Cache cleared for business: ${businessId}`,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear cache' });
        }
    }

    async debugKnowledgeBase(req, res) {
        try {
            const businessId = req.query.business || 'default';
            const businessData = await businessService.getBusinessConfig(businessId);
            
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }

            res.json({
                business_id: businessId,
                business_name: businessData.config.business.name,
                total_entries: businessData.knowledgeBase.length,
                entries: businessData.knowledgeBase.map(entry => ({
                    question: entry.question,
                    answer: entry.answer.substring(0, 200) + '...',
                    category: entry.category,
                    priority: entry.priority
                })),
                categories: [...new Set(businessData.knowledgeBase.map(kb => kb.category))]
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async testRAG(req, res) {
        try {
            const { query } = req.body;
            const businessId = req.query.business || 'default';
            
            if (!query) {
                return res.status(400).json({ error: 'Query is required' });
            }

            const businessData = await businessService.getBusinessConfig(businessId);
            if (!businessData) {
                return res.status(404).json({ error: 'Business not found' });
            }

            const result = ragService.testRag(query, businessData);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDebugStats(req, res) {
        try {
            const aiStats = aiService.getStats();
            const dbHealth = await businessService.healthCheck();
            
            res.json({
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    node_version: process.version,
                    environment: appConfig.server.nodeEnv
                },
                services: {
                    ai: aiStats,
                    database: dbHealth
                },
                config: {
                    max_tokens: appConfig.api.maxTokens,
                    temperature: appConfig.api.temperature,
                    cache_ttl: appConfig.cache.ttl
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async clearAllCache(req, res) {
        try {
            businessService.clearCache();
            aiService.clearHistory();
            
            res.json({
                message: 'All caches cleared',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear caches' });
        }
    }

    async getActiveSessions(req, res) {
        try {
            const aiStats = aiService.getStats();
            
            res.json({
                active_sessions: aiStats.active_sessions,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get sessions' });
        }
    }

    // Start server
    async start() {
        try {
            // Test database connection
            const dbConnected = await databaseConfig.testConnection();
            if (!dbConnected) {
                console.error('❌ Failed to connect to database');
                process.exit(1);
            }

            const server = this.app.listen(appConfig.server.port, appConfig.server.host, () => {
                console.log('🚀 Chatbot API Server Started!');
                console.log(`📍 Server: http://${appConfig.server.host}:${appConfig.server.port}`);
                console.log(`🌍 Environment: ${appConfig.server.nodeEnv}`);
                console.log(`🤖 AI Model: ${appConfig.api.groqModel}`);
                console.log('📚 Available endpoints:');
                console.log('  - POST /api/chat');
                console.log('  - GET  /api/health');
                console.log('  - GET  /api/businesses');
                console.log('  - GET  /api/debug/knowledge-base');
            });

            // Graceful shutdown
            const gracefulShutdown = async (signal) => {
                console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
                
                server.close(() => {
                    console.log('✅ HTTP server closed');
                    process.exit(0);
                });

                // Force close after 10 seconds
                setTimeout(() => {
                    console.log('❌ Forced shutdown');
                    process.exit(1);
                }, 10000);
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new ChatbotServer();
    server.start();
}

module.exports = ChatbotServer;