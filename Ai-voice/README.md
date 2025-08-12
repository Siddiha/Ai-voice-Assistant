# AI Voice Assistant - Setup Guide

## 🚀 Quick Start

### Step 1: Project Setup

```bash
# Create project directory
mkdir ai-voice-assistant
cd ai-voice-assistant

# Create backend directory
mkdir backend
cd backend

# Copy the server.js code into this directory
# Copy the package.json code into this directory

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys (see API Setup section)
```

### Step 2: Frontend Setup

```bash
# Go back to main project directory
cd ..

# Create frontend directory
mkdir frontend
cd frontend

# Copy the HTML file as index.html
# The frontend is a single HTML file with embedded CSS and JavaScript
```

### Step 3: Run the Application

```bash
# Terminal 1: Start the backend server
cd backend
npm run dev

# Terminal 2: Serve the frontend (simple HTTP server)
cd frontend
# Option 1: Use Python
python -m http.server 8080

# Option 2: Use Node.js http-server
npx http-server -p 8080

# Option 3: Use VS Code Live Server extension
```

### Step 4: Access the Application

- Frontend: http://localhost:8080
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/api/health

## 🔑 API Setup (Optional but Recommended)

### OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create an account and get your API key
3. Add to `.env`: `OPENAI_API_KEY=your_key_here`

### Gmail API Setup (for real email integration)

1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable Gmail API
4. Create credentials (OAuth 2.0)
5. Add to `.env`:
   ```
   GMAIL_CLIENT_ID=your_client_id
   GMAIL_CLIENT_SECRET=your_client_secret
   ```

### Google Calendar API

- Uses the same credentials as Gmail API
- Enable Google Calendar API in the same Google Cloud project

## 📁 Project Structure

```
ai-voice-assistant/
├── backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Dependencies
│   ├── .env              # Environment variables
│   └── .env.example      # Environment template
└── frontend/
    └── index.html        # Main HTML file with embedded JS/CSS
```

## 🎯 Current Features

### ✅ Working Now:

- Voice recognition (speech-to-text)
- Text-to-speech responses
- Basic conversation handling
- Simulated email/calendar/task responses
- Modern, responsive UI
- Error handling

### 🔄 Next Phase - Real Integrations:

- OpenAI API integration for smarter responses
- Gmail API for real email management
- Google Calendar API for calendar integration
- Task management API integration

## 🧪 Testing the Voice Assistant

Try these voice commands:

- "Hello" or "Hi"
- "What are my recent emails?"
- "What's on my calendar today?"
- "Add a task to review the project proposal"
- "Draft an email to John about the meeting"
- "Help me"

## 🔧 Development Tips

### Browser Compatibility

- **Best**: Chrome, Edge (full Web Speech API support)
- **Limited**: Firefox, Safari (may have speech issues)

### Voice Recognition Tips

- Speak clearly and at normal pace
- Use a good quality microphone
- Minimize background noise
- Allow microphone permissions when prompted

### Debugging

- Open browser DevTools (F12) to see console logs
- Check Network tab for API calls
- Backend logs show in terminal

## 🚀 Next Development Phases

### Phase 1: Enhanced AI (Week 1)

```javascript
// Add to server.js for better AI responses
const improvedAI = {
  contextAware: true,
  personalizedResponses: true,
  intentRecognition: true,
};
```

### Phase 2: Real Email Integration (Week 2)

```javascript
// Gmail API integration
const gmail = google.gmail({ version: "v1", auth: oauth2Client });
```

### Phase 3: Calendar Integration (Week 3)

```javascript
// Google Calendar API integration
const calendar = google.calendar({ version: "v3", auth: oauth2Client });
```

### Phase 4: Advanced Features (Week 4)

- Voice training for better recognition
- Multiple user support
- Mobile responsive improvements
- Offline mode capabilities

## 🎓 Learning Outcomes

This project teaches you:

- **Frontend**: HTML5 Speech APIs, Modern CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js, REST APIs, OAuth
- **Integration**: External APIs (OpenAI, Google APIs)
- **Architecture**: Client-server communication, async programming
- **DevOps**: Environment configuration, API key management

## 🆘 Troubleshooting

### Common Issues:

**1. Microphone not working**

- Check browser permissions
- Use Chrome/Edge for best support
- Ensure HTTPS in production

**2. Backend not connecting**

- Check if server is running on port 3000
- Verify CORS is enabled
- Check frontend API URL in JavaScript

**3. Voice recognition not accurate**

- Speak more clearly
- Check microphone quality
- Try different browser
- Adjust speech rate in code

**4. API errors**

- Check .env file configuration
- Verify API keys are valid
- Check network connectivity
- Review server logs

## 📚 Additional Resources

- Web Speech API Documentation: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- OpenAI API Documentation: https://platform.openai.com/docs
- Gmail API Guide: https://developers.google.com/gmail/api/guides
- Google Calendar API Guide: https://developers.google.com/calendar/api/guides/overview

## 🎉 You're Ready to Start!

Your AI voice assistant foundation is complete! Start with the basic version and gradually add more advanced features. This is a great project for your CS portfolio that demonstrates full-stack development, API integration, and modern web technologies.

Good luck with your second-year project! 🚀
