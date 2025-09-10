# Yako Chatbot

A simple, efficient AI chatbot built with Node.js and Express, featuring:

- Real-time AI conversations using Groq API
- PDF knowledge base integration
- Clean, responsive UI
- Business configuration support

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables:
```bash
# Create a .env file with your Groq API key
GROQ_API_KEY=your_groq_api_key_here
```

3. Start the server:
```bash
npm start
```

4. Open `http://localhost:3002` in your browser

## Features

- **AI Chat**: Powered by Groq's Llama 3 model
- **Knowledge Base**: Upload PDFs to enhance responses
- **Business Config**: Customize chatbot personality and responses
- **Responsive Design**: Works on desktop and mobile

## Files Structure

- `server.js` - Main backend server with API endpoints
- `index.html` - Clean chat interface
- `script.js` - Frontend chat functionality
- `styles.css` - Responsive styling
- `knowledge_base.json` - Chatbot knowledge base
- `business-config.json` - Business configuration
- `uploads/` - Directory for uploaded PDFs

## API Endpoints

- `POST /api/chat` - Send messages to the chatbot
- `POST /api/upload` - Upload PDF files
- `GET /api/health` - Server health check 