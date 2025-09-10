// Clean version of chatbot-widget.js (theming removed)
(function() {
    'use strict';

    class ChatbotWidget {
        constructor(config = {}) {
            this.apiUrl = config.apiUrl || 'http://localhost:3001/api';
            this.businessId = config.businessId || 'default';
            this.sessionId = `widget_${this.businessId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.init();
        }

        init() {
            this.createStyles();
            this.createWidget();
            this.attachEvents();
            this.loadInitialMessage();
        }

        createStyles() {
            const styles = `
                #chatbot-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                    display: none;
                    flex-direction: column;
                    font-family: sans-serif;
                }
                #chatbot-header {
                    background: #007bff;
                    color: white;
                    padding: 15px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #chatbot-messages {
                    flex: 1;
                    padding: 10px;
                    overflow-y: auto;
                    background: #f8f8f8;
                }
                .chatbot-msg {
                    padding: 10px;
                    margin: 5px;
                    border-radius: 8px;
                    max-width: 80%;
                }
                .chatbot-msg.user { background: #007bff; color: white; align-self: flex-end; }
                .chatbot-msg.bot { background: #e1e1e1; align-self: flex-start; }
                #chatbot-input-area {
                    padding: 10px;
                    border-top: 1px solid #ddd;
                    display: flex;
                    gap: 10px;
                }
                #chatbot-input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    outline: none;
                }
                #chatbot-send {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 5px;
                    cursor: pointer;
                }
                #chatbot-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: #007bff;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
            `;
            const styleTag = document.createElement('style');
            styleTag.textContent = styles;
            document.head.appendChild(styleTag);
        }

        createWidget() {
            const html = `
                <div id="chatbot-widget">
                    <div id="chatbot-header">
                        Chatbot
                        <button onclick="document.getElementById('chatbot-widget').style.display='none'" style="background:none;border:none;color:white;font-size:16px;cursor:pointer">×</button>
                    </div>
                    <div id="chatbot-messages"></div>
                    <div id="chatbot-input-area">
                        <input id="chatbot-input" type="text" placeholder="Type your message..." />
                        <button id="chatbot-send">Send</button>
                    </div>
                </div>
                <div id="chatbot-toggle">💬</div>
            `;
            const div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div);

            this.elements = {
                widget: document.getElementById('chatbot-widget'),
                toggle: document.getElementById('chatbot-toggle'),
                messages: document.getElementById('chatbot-messages'),
                input: document.getElementById('chatbot-input'),
                send: document.getElementById('chatbot-send')
            };
        }

        attachEvents() {
            this.elements.toggle.onclick = () => {
                this.elements.widget.style.display = 'flex';
            };
            this.elements.send.onclick = () => this.sendMessage();
            this.elements.input.onkeypress = (e) => {
                if (e.key === 'Enter') this.sendMessage();
            };
        }

        appendMessage(text, sender = 'bot') {
            const msg = document.createElement('div');
            msg.className = `chatbot-msg ${sender}`;
            msg.textContent = text;
            this.elements.messages.appendChild(msg);
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }

        async loadInitialMessage() {
            try {
                const res = await fetch(`${this.apiUrl}/initial-message?business=${this.businessId}`);
                const data = await res.json();
                this.appendMessage(data.message || 'Hello! How can I help you today?');
            } catch (err) {
                this.appendMessage('Welcome!');
            }
        }

        async sendMessage() {
            const text = this.elements.input.value.trim();
            if (!text) return;
            this.appendMessage(text, 'user');
            this.elements.input.value = '';

            try {
                const res = await fetch(`${this.apiUrl}/chat?business=${this.businessId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': this.sessionId
                    },
                    body: JSON.stringify({ message: text })
                });
                const data = await res.json();
                this.appendMessage(data.response || 'Sorry, I didn\'t understand that.');
            } catch (err) {
                this.appendMessage('Something went wrong.');
            }
        }
    }

    window.initChatbotWidget = function(config) {
        return new ChatbotWidget(config);
    };
})();
