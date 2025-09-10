const fetch = require('node-fetch');
const appConfig = require('../config/app');
const ragService = require('./RAGService');

class AIService {
    constructor() {
        this.conversationHistory = new Map();
        console.log('🤖 AI service initialized');
    }

    // Generate AI response
    async generateResponse(message, businessData, sessionId) {
        try {
            // Get conversation history
            let history = this.conversationHistory.get(sessionId) || [];
            const isNewConversation = history.length === 0;

            // Add user message to history
            history.push({ role: 'user', content: message });

            // Get relevant context using RAG (AWAIT THE PROMISE!)
            const ragResult = await ragService.retrieveRelevantContext(message, businessData, 3, 0.05);

            let botResponse;
            let suggestions = this.getCasualSuggestions();

            // Check for simple math
            if (this.isMathQuery(message)) {
                botResponse = this.handleMathQuery(message);
            }
            // AI-powered response
            else if (appConfig.api.groqApiKey) {
                botResponse = await this.getAIResponse(message, businessData, ragResult, history);
            }
            // Fallback response
            else {
                 botResponse = "I apologize, but I’m currently unable to provide a response. Could you please try again?";
            }

            // Add bot response to history
            history.push({ role: 'assistant', content: botResponse });
            
            // Limit history size
            if (history.length > 20) {
                history = history.slice(-20);
            }
            
            this.conversationHistory.set(sessionId, history);

            return {
                response: botResponse,
                isNewConversation,
                initialMessage: isNewConversation ? businessData.initialMessage : null,
                suggestions,
                debug: {
                    contextFound: ragResult.contexts ? ragResult.contexts.length : 0,
                    maxScore: ragResult.maxScore || 0,
                    hasAI: !!appConfig.api.groqApiKey,
                    wasTranslated: ragResult.translationInfo ? ragResult.translationInfo.wasTranslated : false,
                    originalLanguage: ragResult.translationInfo ? ragResult.translationInfo.originalLanguage : 'unknown'
                }
            };

        } catch (error) {
            console.error('❌ Error generating AI response:', error);
            return {
                response: "sorry something went wrong, try again?",
                  suggestions: ['Could you rephrase that?', 'Please try again.', 'Is there another way you can explain that?'],
                error: error.message
            };
        }
    }

    // Get AI response from Groq
    async getAIResponse(message, businessData, ragResult, history) {
        try {
            let messages = [{
                role: 'system',
                 content: businessData.systemMessage || "You are a professional business assistant. Respond in a clear, polite, and concise manner."
            }];

            // Add context if available (BETTER ERROR HANDLING)
            if (ragResult && ragResult.contexts && Array.isArray(ragResult.contexts) && ragResult.contexts.length > 0) {
                const contextMessage = ragService.buildContextMessage(ragResult.contexts, ragResult.translationInfo);
                if (contextMessage) {
                    messages.push({ role: 'system', content: contextMessage });
                    console.log(`📝 Added ${ragResult.contexts.length} context entries to prompt`);
                    console.log(`🎯 Top context score: ${ragResult.maxScore.toFixed(3)}`);
                    
                    // Log translation info if available
                    if (ragResult.translationInfo && ragResult.translationInfo.wasTranslated) {
                        console.log(`🌐 Query was translated from ${ragResult.translationInfo.originalLanguage}: "${ragResult.translationInfo.originalText}" -> "${ragResult.translationInfo.translatedText}"`);
                    }
                }
            } else {
                console.log('⚠️ No context found, using general business tone');
            }

            // Include recent conversation history
            messages.push(...history.slice(-6));

            const requestBody = {
                model: appConfig.api.groqModel,
                messages,
                max_tokens: appConfig.api.maxTokens,
                temperature: appConfig.api.temperature,
                top_p: appConfig.api.topP,
                stream: false
            };

            console.log('🤖 Sending request to Groq...');
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appConfig.api.groqApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!groqResponse.ok) {
                console.error('❌ Groq API error:', groqResponse.status, groqResponse.statusText);
                throw new Error(`Groq API error: ${groqResponse.status}`);
            }

            const data = await groqResponse.json();
            const response = data?.choices?.[0]?.message?.content?.trim() || "I’m sorry, I couldn’t understand that. Could you clarify?";
            
            console.log('✅ Got response from Groq:', response);
            return response;

        } catch (error) {
            console.error('❌ Groq API error:', error);
            return "I’m currently experiencing technical issues. Please try again shortly.";
        }
    }

    // Check if message is a math query
    isMathQuery(message) {
        return /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*=?\s*$/.test(message);
    }

    // Handle simple math queries
    handleMathQuery(message) {
        try {
            const result = eval(message.replace('=', ''));
            return `${message.replace('=', '')} = ${result} lol quick math`;
        } catch {
            return "I couldn’t process the calculation. Please ensure the format is correct.";
        }
    }

    // Get casual suggestions
    getCasualSuggestions() {
         const suggestions = [
            'Could you please elaborate?',
            'Would you like me to assist with that?',
            'Can you provide more details?',
            'Shall I look into that for you?',
            'Would you like further clarification on this topic?',
            'Is there a specific area you’d like to focus on?'
        ];

        // Return 3 random suggestions
        return suggestions.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    // Get conversation history for a session
    getConversationHistory(sessionId) {
        return this.conversationHistory.get(sessionId) || [];
    }

    // Clear conversation history
    clearHistory(sessionId = null) {
        if (sessionId) {
            this.conversationHistory.delete(sessionId);
            console.log(`🗑️ Cleared history for session: ${sessionId}`);
        } else {
            this.conversationHistory.clear();
            console.log('🗑️ Cleared all conversation history');
        }
    }

    // Get service stats
    getStats() {
        return {
            active_sessions: this.conversationHistory.size,
            groq_api_available: !!appConfig.api.groqApiKey,
            model: appConfig.api.groqModel,
            max_tokens: appConfig.api.maxTokens
        };
    }
}

module.exports = new AIService();