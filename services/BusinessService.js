const natural = require('natural');
const databaseConfig = require('../config/database');
const appConfig = require('../config/app');

class BusinessService {
    constructor() {
        this.supabase = databaseConfig.getClient();
        this.businessCache = new Map();
        console.log('📊 Business service initialized');
    }

    // Get business configuration with caching
    async getBusinessConfig(businessId) {
        const cacheKey = businessId;
        const cached = this.businessCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < appConfig.cache.ttl) {
            console.log(`📦 Using cached business data for: ${businessId}`);
            return cached.data;
        }

        try {
            console.log(`🔍 Fetching business config from database for: ${businessId}`);

            // Get business details
            const { data: business, error } = await this.supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.warn(`⚠️ Business not found: ${businessId}`);
                    return null;
                }
                throw error;
            }

            // Get knowledge base
            const { data: knowledgeBase, error: kbError } = await this.supabase
                .from('knowledge_base')
                .select('*')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });

            if (kbError) throw kbError;

            console.log(`📚 Loaded ${knowledgeBase.length} knowledge base entries for ${businessId}`);

            const businessData = await this.buildBusinessData(business, knowledgeBase);
            
            // Cache the result
            this.businessCache.set(cacheKey, {
                data: businessData,
                timestamp: Date.now()
            });

            // Cleanup cache if too large
            if (this.businessCache.size > appConfig.cache.maxSize) {
                const oldestKey = this.businessCache.keys().next().value;
                this.businessCache.delete(oldestKey);
            }

            console.log(`✅ Loaded business configuration for: ${business.name}`);
            return businessData;

        } catch (error) {
            console.error(`❌ Error loading business config for ${businessId}:`, error.message);
            return null;
        }
    }

    // Build complete business data structure
    async buildBusinessData(business, knowledgeBase) {
    const configData = business.config || {};

   const defaultInitial = `Welcome to ${business.name}! How can we assist you today?`;


    const config = {
        business: {
            name: business.name,
            type: business.type,
            specialization: business.specialization,
            location: business.location,
            description: business.description
        },
        contact: {
            phone: business.phone,
            email: business.email,
            address: business.address,
            hours: business.hours,
            website: business.website
        },
        chatbot: {
            initial_message: configData.initial_message || defaultInitial,
            system_prompt: configData.system_prompt || this.getDefaultSystemPrompt(),
            theme_color: configData.theme_color || '#25d366',
            show_suggestions: configData.show_suggestions !== false,
            max_response_length: configData.max_response_length || 200
        },
        keywords: business.keywords || []
    };

    const kbData = knowledgeBase.map(kb => ({
        question: kb.question,
        answer: kb.answer,
        category: kb.category,
        priority: kb.priority
    }));

    const tfidf = this.buildTfIdf(kbData);

    const systemMessage = this.generateSystemMessage(config, kbData);

    return {
        config,
        knowledgeBase: kbData,
        tfidf,
        systemMessage,
        initialMessage: configData.initial_message || defaultInitial
    };
}


    // Build TF-IDF with error handling
    buildTfIdf(knowledgeBase) {
        const TfIdf = natural.TfIdf;
        const tfidf = new TfIdf();

        knowledgeBase.forEach((entry, idx) => {
            try {
                const docText = `${entry.question} ${entry.answer}`.trim();
                if (docText.length > 0) {
                    tfidf.addDocument(docText, idx.toString());
                }
            } catch (error) {
                console.warn(`⚠️ TF-IDF error for entry ${idx}:`, error.message);
            }
        });

        return tfidf;
    }

  // Generate system message for AI
generateSystemMessage(config, knowledgeBase) {
    const customPrompt = config.chatbot?.system_prompt;

    if (customPrompt && customPrompt.trim() !== "") {
        return customPrompt; // ✅ Always use business-specific prompt
    }

    // Default prompt for generic businesses
 return `You are a virtual assistant for ${config.business?.name || 'this business'}.
Your primary goal is to guide customers, answer their questions accurately, and help them solve problems in a simple and professional manner.

📌 **Core Guidelines:**
- Always use information from the knowledge base if relevant.
- Do not mention AI, databases, or internal systems.
- Keep answers clear, accurate, and easy to follow.
- If you are unsure, politely acknowledge it and offer to connect the user with support.

📱 **Tone & Style:**
- Professional, friendly, and approachable.
- No slang or overly casual language.
- Use plain, simple language that’s easy for anyone to understand.
- Keep sentences and paragraphs short for readability.
- Provide step-by-step guidance when explaining solutions.
- Avoid unnecessary filler or repeating the same points.
- Use emojis only when they add clarity or positive tone (e.g., ✅, ℹ️).

Business details:
- Name: ${config.business?.name || 'N/A'}
- Location: ${config.business?.location || 'N/A'}
- Type: ${config.business?.type || 'N/A'}
- Specialization: ${config.business?.specialization || 'N/A'}`;
    }

// Default system prompt (if config.system_prompt is missing)
getDefaultSystemPrompt() {
    return `You are a professional AI assistant for this business.
Your goal is to guide customers, answer their questions accurately, and help them solve problems in a simple and polite manner.

📌 Guidelines:
- Be friendly, professional, and approachable.
- Always use the knowledge base if relevant.
- Keep answers clear and easy to understand.
- If you are unsure, politely say you are not certain and offer to connect with support.
- Avoid technical jargon unless the customer expects it.
- Keep sentences short and focused.`;
}


    // Get all businesses (for admin purposes)
    async getAllBusinesses() {
        try {
            const { data, error } = await this.supabase
                .from('businesses')
                .select('id, name, type, is_active')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('❌ Error fetching businesses:', error.message);
            return [];
        }
    }

    // Clear cache for specific business
    clearCache(businessId) {
        if (businessId) {
            this.businessCache.delete(businessId);
            console.log(`🗑️ Cleared cache for business: ${businessId}`);
        } else {
            this.businessCache.clear();
            console.log('🗑️ Cleared all business cache');
        }
    }

    // Health check
    async healthCheck() {
        try {
            const { data, error } = await this.supabase
                .from('businesses')
                .select('count')
                .limit(1);

            return {
                database: !error,
                cache_size: this.businessCache.size,
                error: error?.message
            };
        } catch (error) {
            return {
                database: false,
                cache_size: this.businessCache.size,
                error: error.message
            };
        }
    }
}

module.exports = new BusinessService();