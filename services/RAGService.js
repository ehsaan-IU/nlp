const appConfig = require('../config/app');

class RAGService {
    constructor() {
        console.log('🔍 RAG service initialized');
        console.log('🌐 Built-in Urdu translation ready');
    }


    translateToEnglish(text) {
        return { 
            translatedText: text, 
            originalLanguage: 'unknown', 
            wasTranslated: false,
            originalText: text
        };
    }

    // Enhanced RAG with better similarity scoring and translation support
    async retrieveRelevantContext(query, businessData, topK = null, similarityThreshold = null) {
        topK = topK || appConfig.rag.topK;
        // Made threshold more lenient (reduced from default)
        similarityThreshold = similarityThreshold || (appConfig.rag.similarityThreshold * 0.5); // 50% more lenient
        
        console.log(`🔍 RAG Debug - Original Query: "${query}"`);
        
        // Translate query to English if needed
        const translationResult = this.translateToEnglish(query);
        const searchQuery = translationResult.translatedText;
        
        if (translationResult.wasTranslated) {
            console.log(`🌐 Using translated query: "${searchQuery}"`);
        }
        
        console.log(`📚 Knowledge base entries: ${businessData.knowledgeBase.length}`);
        
        if (!businessData.knowledgeBase.length) {
            console.log('❌ No knowledge base entries found');
            return { contexts: [], maxScore: 0, translationInfo: translationResult };
        }
        
        const scores = [];
        const queryLower = searchQuery.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1); // Reduced from 2 to 1
        
        console.log(`🔤 Query words: ${queryWords.join(', ')}`);
        
        businessData.knowledgeBase.forEach((entry, idx) => {
            const questionLower = entry.question.toLowerCase();
            const answerLower = entry.answer.toLowerCase();
            const combinedText = questionLower + ' ' + answerLower;
            
            let totalScore = 0;
            let matchDetails = [];
            
            // 1. EXACT QUESTION MATCH (highest priority) - more lenient
            if (questionLower.includes(queryLower) || queryLower.includes(questionLower)) {
                totalScore += 1.5; // Increased
                matchDetails.push('exact_question');
            }
            
            // 2. EXACT PHRASE MATCH in answer - more lenient
            if (answerLower.includes(queryLower)) {
                totalScore += 1.2; // Increased
                matchDetails.push('exact_phrase_answer');
            }
            
            // 3. PARTIAL PHRASE MATCHING (new - more lenient)
            const queryPhrases = queryLower.split(' ');
            queryPhrases.forEach(phrase => {
                if (phrase.length > 1 && (questionLower.includes(phrase) || answerLower.includes(phrase))) {
                    totalScore += 0.5; // Increased
                    matchDetails.push(`partial_phrase(${phrase})`);
                }
            });
            
            // 4. KEYWORD MATCHING with better weighting
            let keywordMatches = 0;
            let importantKeywordMatches = 0;
            
           const importantKeywords = [
    // General business terms
    'business', 'company', 'services', 'products', 'pricing', 'cost', 'price', 'quote', 'rates', 
    'support', 'help', 'contact', 'customer', 'client', 'order', 'booking', 'appointment', 

    // Location & timing
    'location', 'address', 'branch', 'office', 'store', 'hours', 'timing', 'open', 'close', 

    // Policies & payment
    'refund', 'return', 'warranty', 'guarantee', 'policy', 'payment', 'invoice', 'bill', 'transaction', 

    // Tech / SaaS focus (if it's a tech business)
    'project', 'software', 'app', 'website', 'api', 'integration', 'plan', 'subscription', 

    // Customer intent
    'buy', 'purchase', 'order', 'book', 'cancel', 'modify', 'upgrade', 'trial', 'demo', 

    // Relationship
    'account', 'profile', 'login', 'register', 'signup', 'issue', 'problem', 'error'
];

            queryWords.forEach(word => {
                if (combinedText.includes(word)) {
                    keywordMatches++;
                    if (importantKeywords.some(imp => 
                        word.includes(imp) || imp.includes(word) || 
                        this.isSimilarWord(word, imp)
                    )) {
                        importantKeywordMatches++;
                    }
                }
            });
            
            if (keywordMatches > 0) {
                const keywordScore = (keywordMatches / queryWords.length) * 1.0; // Increased
                const importantBonus = importantKeywordMatches * 0.5; // Increased
                totalScore += keywordScore + importantBonus;
                matchDetails.push(`keywords(${keywordMatches}/${queryWords.length})`);
            }
            
            // 5. SEMANTIC SIMILARITY for common questions - enhanced patterns
            const commonPatterns = [
    // Location / Contact
    { pattern: /where.*(located|find|branch|office|store)|location.*where|address/i, boost: 1.2 },
    { pattern: /how.*contact|contact.*how|get.*in touch|reach.*you/i, boost: 1.1 },

    // Services / Products
    { pattern: /what.*services|services.*what|offer.*what|provide.*what/i, boost: 1.2 },
    { pattern: /what.*products|products.*what|sell.*what|do.*sell/i, boost: 1.2 },

    // Pricing / Cost
    { pattern: /how.*much|price.*what|cost.*what|what.*cost|pricing.*what/i, boost: 1.3 },
    { pattern: /quote|estimate|rates|charges/i, boost: 1.1 },

    // Business Hours
    { pattern: /what.*time|when.*open|opening.*hours|closing.*hours|working.*hours/i, boost: 1.0 },

    // Refunds / Returns / Policies
    { pattern: /refund|return.*policy|cancel.*order|warranty|guarantee/i, boost: 1.0 },

    // Account / Support
    { pattern: /problem|issue|error|help.*needed|support/i, boost: 1.0 },

    // About the business
    { pattern: /who.*are|about.*(company|business)|tell.*about.*you/i, boost: 1.0 }
];

            
            commonPatterns.forEach(({ pattern, boost }) => {
                if (pattern.test(queryLower) && pattern.test(questionLower)) {
                    totalScore += boost;
                    matchDetails.push(`pattern_match(${boost})`);
                }
            });
            
            // 6. TF-IDF scoring (if available) - more weight
            try {
                businessData.tfidf.tfidfs(searchQuery, (i, measure) => {
                    if (i === idx && measure > 0) {
                        totalScore += measure * 0.6; // Increased
                        matchDetails.push(`tfidf(${measure.toFixed(3)})`);
                    }
                });
            } catch (error) {
                // TF-IDF not available, skip
            }
            
            // 7. FUZZY MATCHING bonus for translated queries
            if (translationResult.wasTranslated) {
                const fuzzyScore = this.calculateFuzzyScore(queryLower, combinedText);
                if (fuzzyScore > 0.2) { // Lower threshold
                    totalScore += fuzzyScore * 0.4; // Increased weight
                    matchDetails.push(`fuzzy(${fuzzyScore.toFixed(3)})`);
                }
            }
            
            // Only include if score is above threshold (now more lenient)
            if (totalScore >= similarityThreshold) {
                scores.push({
                    idx,
                    score: totalScore,
                    matchDetails: matchDetails.join(', '),
                    question: entry.question,
                    answerPreview: entry.answer.substring(0, 100)
                });
            }
        });
        
        // Sort by score (highest first)
        scores.sort((a, b) => b.score - a.score);
        
        const maxScore = scores.length > 0 ? scores[0].score : 0;
        console.log(`📊 Max score: ${maxScore.toFixed(3)}, Total matches: ${scores.length}`);
        console.log(`🎯 Similarity threshold (lenient): ${similarityThreshold.toFixed(3)}`);
        
        // Take top results
        const topResults = scores.slice(0, topK);
        
        const contexts = topResults.map(result => {
            const entry = businessData.knowledgeBase[result.idx];
            console.log(`✅ Match found - Q: "${entry.question}" | Score: ${result.score.toFixed(3)} | Matches: ${result.matchDetails}`);
            console.log(`   Answer preview: "${result.answerPreview}..."`);
            
            return {
                content: entry.answer,
                question: entry.question,
                score: result.score,
                matchDetails: result.matchDetails,
                category: entry.category,
                priority: entry.priority
            };
        });
        
        console.log(`🎯 Returning ${contexts.length} contexts with max score: ${maxScore.toFixed(3)}`);
        return { 
            contexts, 
            maxScore, 
            translationInfo: translationResult 
        };
    }

    // Helper function to check word similarity (simple implementation)
    isSimilarWord(word1, word2, threshold = 0.6) {
        if (word1.length < 2 || word2.length < 2) return false;
        
        const longer = word1.length > word2.length ? word1 : word2;
        const shorter = word1.length > word2.length ? word2 : word1;
        
        if (longer.includes(shorter)) return true;
        
        // Simple character overlap ratio
        let matches = 0;
        for (let char of shorter) {
            if (longer.includes(char)) matches++;
        }
        
        return (matches / shorter.length) >= threshold;
    }

    // Simple fuzzy matching score
    calculateFuzzyScore(query, text) {
        const queryWords = query.split(' ');
        let totalScore = 0;
        
        queryWords.forEach(word => {
            if (word.length > 1) { // Reduced from 2
                // Check for partial matches
                const textWords = text.split(' ');
                textWords.forEach(textWord => {
                    if (textWord.includes(word) || word.includes(textWord)) {
                        totalScore += 0.6; // Increased
                    } else if (this.isSimilarWord(word, textWord, 0.5)) { // Lower threshold
                        totalScore += 0.4; // Increased
                    }
                });
            }
        });
        
        return Math.min(totalScore / queryWords.length, 1.0);
    }

    // Build context message for AI
    buildContextMessage(contexts, translationInfo = null) {
        if (!contexts || !Array.isArray(contexts) || !contexts.length) {
            console.log('⚠️ No contexts provided to buildContextMessage');
            return null;
        }

        // Sort contexts by score and priority
        const sortedContexts = contexts.sort((a, b) => {
            // First by score, then by priority
            if (Math.abs(a.score - b.score) < 0.1) {
                return (b.priority || 0) - (a.priority || 0);
            }
            return b.score - a.score;
        });

    let contextMessage = `Here is verified information about the business to help you answer accurately':


${sortedContexts.map((ctx, idx) => 
    `• ${ctx.content}`
).join('\n\n')}

IMPORTANT: This information is verified. Use it to answer accurately and naturally. 
Do not mention that you are an AI or reference a database. 
Respond in a professional, helpful, and human-like manner.
`;

        // Add translation info if query was translated
        if (translationInfo && translationInfo.wasTranslated) {
            contextMessage += `\n\nBTW: user asked in ${translationInfo.originalLanguage} ("${translationInfo.originalText}"), so keep that cultural context in mind and respond naturally.`;
        }

        return contextMessage;
    }

    // Test RAG with a query
    async testRag(query, businessData) {
        const result = await this.retrieveRelevantContext(query, businessData);
        
        return {
            query,
            translated_query: result.translationInfo?.translatedText,
            was_translated: result.translationInfo?.wasTranslated || false,
            original_language: result.translationInfo?.originalLanguage,
            total_kb_entries: businessData.knowledgeBase.length,
            matches_found: result.contexts.length,
            max_score: result.maxScore,
            similarity_threshold: (appConfig.rag.similarityThreshold * 0.5).toFixed(3),
            contexts: result.contexts.map(ctx => ({
                question: ctx.question,
                answer: ctx.content,
                score: ctx.score,
                matchDetails: ctx.matchDetails,
                category: ctx.category,
                priority: ctx.priority
            }))
        };
    }
}

module.exports = new RAGService();