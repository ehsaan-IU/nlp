/**
 * Chatbot Widget - Embeddable multi-tenant chatbot
 * Version: 1.0.2 - Enhanced UI/UX
 */
(function() {
    // Configuration - More robust script attribute detection
    let scriptTag = document.currentScript;
    if (!scriptTag) {
        // Fallback: find the script tag by src
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src && scripts[i].src.includes('chatbot-widget.js')) {
                scriptTag = scripts[i];
                break;
            }
        }
    }
    
    // Get configuration with fallbacks
    const businessId = scriptTag ? scriptTag.getAttribute('data-business-id') : 'default';
    const position = scriptTag ? scriptTag.getAttribute('data-position') : 'bottom-right';
    const primaryColor = scriptTag ? scriptTag.getAttribute('data-color') : '#000000';
    const apiUrl = scriptTag ? scriptTag.getAttribute('data-api-url') : window.location.origin;
    
    console.log('Chatbot Widget Config:', { businessId, position, primaryColor, apiUrl });
    
    // Create widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'chatbot-widget-container';
    document.body.appendChild(widgetContainer);
    
    // Create widget styles
    const widgetStyles = document.createElement('style');
    widgetStyles.textContent = `
        #chatbot-widget-container {
            position: fixed;
            z-index: 9999;
            ${position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        
        #chatbot-widget-button {
            min-width: 120px;
            height: 48px;
            border-radius: 24px;
            background: ${primaryColor};
            color: white;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-size: 15px;
            border: none;
            outline: none;
            padding: 0 18px 0 10px;
            gap: 10px;
            position: relative;
        }
        
        #chatbot-widget-button .chatbot-bot-icon {
            width: 26px;
            height: 26px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 6px;
        }
        
        #chatbot-widget-button .chatbot-bot-icon svg {
            width: 16px;
            height: 16px;
            color: ${primaryColor};
        }
        
        #chatbot-widget-button .chatbot-button-content {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
        }
        
        #chatbot-widget-button .chatbot-button-title {
            font-weight: 600;
            font-size: 15px;
            line-height: 1.1;
        }
        
        #chatbot-widget-button .chatbot-button-status {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #eaffea;
            margin-top: 1px;
        }
        
        #chatbot-widget-button .chatbot-online-dot {
            width: 7px;
            height: 7px;
            background: #2ecc40;
            border-radius: 50%;
            display: inline-block;
            border: 2px solid #fff;
            box-shadow: 0 0 2px #2ecc40;
        }
        
        #chatbot-widget-button:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.25);
        }
        
        #chatbot-widget-button:active {
            transform: scale(0.95);
        }
        
        #chatbot-widget-chat {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 320px;
            height: 450px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
            display: none;
            flex-direction: column;
            overflow: hidden;
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        #chatbot-widget-chat.open {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        @media (max-width: 480px) {
            #chatbot-widget-chat {
                width: calc(100vw - 40px);
                right: -10px;
                height: 400px;
            }
        }
        
        #chatbot-widget-header {
            background-color: ${primaryColor};
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 12px 12px 0 0;
        }
        
        #chatbot-widget-title {
            font-weight: 600;
            font-size: 15px;
        }
        
        #chatbot-widget-close {
            cursor: pointer;
            font-size: 20px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s ease;
        }
        
        #chatbot-widget-close:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
        
        #chatbot-widget-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            scroll-behavior: smooth;
        }
        
        #chatbot-widget-messages::-webkit-scrollbar {
            width: 4px;
        }
        
        #chatbot-widget-messages::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 2px;
        }
        
        #chatbot-widget-messages::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 2px;
        }
        
        #chatbot-widget-messages::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
        }
        
        .chatbot-message {
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 16px;
            word-wrap: break-word;
            line-height: 1.4;
            font-size: 13px;
            animation: messageSlideIn 0.3s ease-out;
            position: relative;
        }
        
        .chatbot-message-timestamp {
            position: absolute;
            bottom: -16px;
            font-size: 10px;
            color: #999;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }
        
        .chatbot-message.bot .chatbot-message-timestamp {
            left: 0;
        }
        
        .chatbot-message.user .chatbot-message-timestamp {
            right: 0;
        }
        
        .chatbot-message:hover .chatbot-message-timestamp {
            opacity: 1;
        }
        
        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .chatbot-message h2 {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #2c5530;
        }
        
        .chatbot-message h3 {
            font-size: 14px;
            font-weight: 600;
            margin: 8px 0 6px 0;
            color: #333;
        }
        
        .chatbot-message ul, .chatbot-message ol {
            margin: 6px 0;
            padding-left: 20px;
        }
        
        .chatbot-message li {
            margin: 3px 0;
        }
        
        .chatbot-message strong {
            font-weight: 600;
            color: #2c5530;
        }
        
        .chatbot-message p {
            margin: 6px 0;
        }
        
        .chatbot-message.bot {
            background-color: #f5f5f5;
            color: #333;
            align-self: flex-start;
            border-bottom-left-radius: 6px;
            border: 1px solid #e5e5e5;
        }
        
        .chatbot-message.user {
            background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        #chatbot-widget-input-container {
            display: flex;
            padding: 12px 16px;
            border-top: 1px solid #e5e5e5;
            background-color: #fafafa;
            align-items: flex-end;
            gap: 8px;
        }
        
        #chatbot-widget-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 16px;
            outline: none;
            font-size: 13px;
            resize: none;
            overflow: hidden;
            min-height: 16px;
            max-height: 60px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            font-family: inherit;
            line-height: 1.3;
        }
        
        #chatbot-widget-input:focus {
            border-color: ${primaryColor};
            box-shadow: 0 0 0 3px ${primaryColor}20;
        }
        
        #chatbot-widget-input::placeholder {
            color: #999;
        }
        
        #chatbot-widget-send {
            background-color: ${primaryColor};
            color: white;
            border: none;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        
        #chatbot-widget-send:hover:not(:disabled) {
            background-color: ${primaryColor}dd;
            transform: scale(1.05);
        }
        
        #chatbot-widget-send:active:not(:disabled) {
            transform: scale(0.95);
        }
        
        #chatbot-widget-send:disabled {
            background-color: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .chatbot-typing-indicator {
            display: flex;
            padding: 10px 14px;
            background-color: #f5f5f5;
            border-radius: 16px;
            align-self: flex-start;
            border-bottom-left-radius: 6px;
            border: 1px solid #e5e5e5;
            animation: messageSlideIn 0.3s ease-out;
        }
        
        .chatbot-typing-dot {
            width: 8px;
            height: 8px;
            background-color: #999;
            border-radius: 50%;
            margin: 0 2px;
            animation: chatbot-typing 1.4s infinite ease-in-out;
        }
        
        .chatbot-typing-dot:nth-child(1) { animation-delay: 0s; }
        .chatbot-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .chatbot-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes chatbot-typing {
            0%, 60%, 100% { 
                transform: translateY(0);
                opacity: 0.4;
            }
            30% { 
                transform: translateY(-4px);
                opacity: 1;
            }
        }
        
        .chatbot-error-message {
            color: #e74c3c;
            font-size: 13px;
            padding: 8px 16px;
            background-color: #ffeaea;
            border-radius: 12px;
            border: 1px solid #f5b7b1;
            align-self: flex-start;
            animation: messageSlideIn 0.3s ease-out;
        }
    `;
    document.head.appendChild(widgetStyles);
    
    // Load business theme
    const themeLink = document.createElement('link');
    themeLink.rel = 'stylesheet';
    themeLink.href = `${apiUrl}/api/business-theme?business=${businessId}`;
    document.head.appendChild(themeLink);
    
    // Create widget HTML
    widgetContainer.innerHTML = `
        <div id="chatbot-widget-button" title="Open chat">
            <span class="chatbot-bot-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="8" width="16" height="8" rx="4" stroke="currentColor" stroke-width="2"/>
                    <circle cx="8.5" cy="12" r="1.5" fill="currentColor"/>
                    <circle cx="15.5" cy="12" r="1.5" fill="currentColor"/>
                    <rect x="11" y="4" width="2" height="4" rx="1" fill="currentColor"/>
                </svg>
            </span>
            <span class="chatbot-button-content">
                <span class="chatbot-button-title">Chat Now</span>
                <span class="chatbot-button-status"><span class="chatbot-online-dot"></span>Online</span>
            </span>
        </div>
        <div id="chatbot-widget-chat">
            <div id="chatbot-widget-header">
                <div id="chatbot-widget-title">Chat with us</div>
                <div id="chatbot-widget-close" title="Close chat">✕</div>
            </div>
            <div id="chatbot-widget-messages"></div>
            <div id="chatbot-widget-input-container">
                <textarea id="chatbot-widget-input" placeholder="Type your message..." rows="1"></textarea>
                <button id="chatbot-widget-send" title="Send message">➤</button>
            </div>
        </div>
    `;
    
    // Widget elements
    const widgetButton = document.getElementById('chatbot-widget-button');
    const widgetChat = document.getElementById('chatbot-widget-chat');
    const widgetClose = document.getElementById('chatbot-widget-close');
    const widgetMessages = document.getElementById('chatbot-widget-messages');
    const widgetInput = document.getElementById('chatbot-widget-input');
    const widgetSend = document.getElementById('chatbot-widget-send');
    const widgetTitle = document.getElementById('chatbot-widget-title');
    
    // Session ID for conversation tracking
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    
    // Widget state
    let isOpen = false;
    let isLoading = false;
    let businessConfig = null;
    
    console.log('Chatbot Widget initialized successfully');
    
    // Auto-resize textarea
    function autoResizeTextarea() {
        widgetInput.style.height = 'auto';
        widgetInput.style.height = Math.min(widgetInput.scrollHeight, 60) + 'px';
    }
    
    // Load business configuration
    async function loadBusinessConfig() {
        try {
            console.log('Loading business config for:', businessId);
            const response = await fetch(`${apiUrl}/api/business-config?business=${businessId}`);
            if (response.ok) {
                businessConfig = await response.json();
                widgetTitle.textContent = `Chat with ${businessConfig.business?.name || 'us'}`;
                console.log('Business config loaded:', businessConfig.business?.name);
                
                // Add initial message
                const initialResponse = await fetch(`${apiUrl}/api/initial-message?business=${businessId}`);
                if (initialResponse.ok) {
                    const data = await initialResponse.json();
                    if (data.message) {
                        setTimeout(() => addMessage(data.message, 'bot'), 500);
                    }
                }
            } else {
                console.error('Failed to load business config:', response.status);
            }
        } catch (error) {
            console.error('Failed to load business config:', error);
        }
    }
    
    // Toggle chat widget
    function toggleChat() {
        isOpen = !isOpen;
        
        if (isOpen) {
            widgetChat.style.display = 'flex';
            // Trigger animation
            setTimeout(() => {
                widgetChat.classList.add('open');
            }, 10);
            
            if (!businessConfig) {
                loadBusinessConfig();
            }
            
            setTimeout(() => {
                widgetInput.focus();
            }, 300);
        } else {
            widgetChat.classList.remove('open');
            setTimeout(() => {
                widgetChat.style.display = 'none';
            }, 300);
        }
    }
    
    // Add message to chat
    function addMessage(text, sender, isError = false) {
        const messageDiv = document.createElement('div');
        
        if (isError) {
            messageDiv.className = 'chatbot-error-message';
            messageDiv.textContent = text;
        } else {
            messageDiv.className = `chatbot-message ${sender}`;
            
            // Create timestamp
            const timestamp = document.createElement('div');
            timestamp.className = 'chatbot-message-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // For bot messages, render HTML to support formatting
            if (sender === 'bot') {
                messageDiv.innerHTML = text;
            } else {
                messageDiv.textContent = text;
            }
            
            // Add timestamp to message
            messageDiv.appendChild(timestamp);
        }
        
        widgetMessages.appendChild(messageDiv);
        
        // Smooth scroll to bottom
        setTimeout(() => {
            widgetMessages.scrollTop = widgetMessages.scrollHeight;
        }, 100);
    }
    
    // Show typing indicator
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'chatbot-typing-indicator';
        indicator.id = 'chatbot-typing-indicator';
        indicator.innerHTML = `
            <div class="chatbot-typing-dot"></div>
            <div class="chatbot-typing-dot"></div>
            <div class="chatbot-typing-dot"></div>
        `;
        widgetMessages.appendChild(indicator);
        
        setTimeout(() => {
            widgetMessages.scrollTop = widgetMessages.scrollHeight;
        }, 100);
    }
    
    // Hide typing indicator
    function hideTypingIndicator() {
        const indicator = document.getElementById('chatbot-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Send message to API
    async function sendMessage() {
        const message = widgetInput.value.trim();
        if (message === '' || isLoading) return;
        
        // Add user message
        addMessage(message, 'user');
        widgetInput.value = '';
        autoResizeTextarea();
        
        // Show loading state
        isLoading = true;
        widgetInput.disabled = true;
        widgetSend.disabled = true;
        showTypingIndicator();
        
        try {
            const response = await fetch(`${apiUrl}/api/chat?business=${businessId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            hideTypingIndicator();
            
            if (response.ok && data.response) {
                // Add small delay for better UX
                setTimeout(() => {
                    addMessage(data.response, 'bot');
                }, 300);
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', '', true);
            }
        } catch (error) {
            hideTypingIndicator();
            addMessage('Network error. Please check your connection and try again.', '', true);
        } finally {
            isLoading = false;
            widgetInput.disabled = false;
            widgetSend.disabled = false;
            widgetInput.focus();
        }
    }
    
    // Event listeners
    widgetButton.addEventListener('click', toggleChat);
    widgetClose.addEventListener('click', toggleChat);
    
    widgetSend.addEventListener('click', sendMessage);
    
    widgetInput.addEventListener('input', autoResizeTextarea);
    
    widgetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Handle clicks outside widget to close
    document.addEventListener('click', (e) => {
        if (isOpen && !widgetContainer.contains(e.target)) {
            toggleChat();
        }
    });
    
    // Expose API for external use
    window.ChatbotWidget = {
        open: () => {
            if (!isOpen) toggleChat();
        },
        close: () => {
            if (isOpen) toggleChat();
        },
        toggle: toggleChat
    };
    
    console.log('Chatbot Widget setup complete');
})();