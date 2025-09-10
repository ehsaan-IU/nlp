require('dotenv').config();

class AppConfig {
    constructor() {
        // Server Configuration
        this.server = {
            port: process.env.PORT,
            host: process.env.HOST,
            nodeEnv: process.env.NODE_ENV
        };

        // API Configuration
        this.api = {
            groqApiKey: process.env.GROQ_API_KEY ,
            groqModel: process.env.GROQ_MODEL ,
            maxTokens: parseInt(process.env.MAX_TOKENS) || 200,
            temperature: parseFloat(process.env.TEMPERATURE) || 0.8,
            topP: parseFloat(process.env.TOP_P) || 0.9
        };

        // Cache Configuration
        this.cache = {
            ttl: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
            maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100
        };


        // RAG Configuration
        this.rag = {
            topK: parseInt(process.env.RAG_TOP_K) || 5,
            similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.2,
            maxContextLength: parseInt(process.env.RAG_MAX_CONTEXT_LENGTH) || 2000
        };

        // Validation
        this.validate();
    }

    validate() {
        const errors = [];

        if (!this.api.groqApiKey) {
            console.warn('⚠️ GROQ_API_KEY not found - AI responses will be limited');
        }

        if (this.server.port < 1000 || this.server.port > 65535) {
            errors.push('Invalid PORT - must be between 1000 and 65535');
        }

        if (errors.length > 0) {
            console.error('❌ Configuration errors:');
            errors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }

        console.log('✅ Application configuration loaded');
    }

    // Get configuration for specific business (can be extended)
    getBusinessConfig(businessId) {
        return {
            ...this.whatsapp,
            businessId,
            sessionPath: `./whatsapp-sessions/${businessId}`
        };
    }

    isDevelopment() {
        return this.server.nodeEnv === 'development';
    }

    isProduction() {
        return this.server.nodeEnv === 'production';
    }
}

module.exports = new AppConfig();