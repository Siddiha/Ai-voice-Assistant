# Quick Start Guide

Get your AI Voice Assistant up and running in 5 minutes!

## 🚀 Prerequisites

- Node.js v16 or higher
- npm or yarn
- MongoDB (local or cloud)
- OpenAI API key
- Google Cloud Console account

## ⚡ Quick Setup

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Ai-voice-Assistant

# Run the setup script
# On macOS/Linux:
chmod +x setup.sh
./setup.sh

# On Windows:
setup.bat
```

### 2. Configure Environment

Edit `backend/.env` with your API keys:

```env
# Required: Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key

# Required: Get from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Required: MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/ai-voice-assistant

# Required: Generate a random secret
JWT_SECRET=your-super-secret-jwt-key
```

### 3. Google Cloud Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - Google Calendar API
   - Gmail API
   - Google+ API
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copy Client ID and Secret to your `.env` file

### 4. Start the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start
```

### 5. Test the App

1. Open your browser/device
2. Navigate to the Expo development server URL
3. Click "Connect Google Account"
4. Complete OAuth flow
5. Start using voice commands!

## 🎤 Test Voice Commands

Try these commands:

- "What meetings do I have today?"
- "Schedule a meeting with John tomorrow at 2 PM"
- "Read my recent emails"
- "Send an email to john@example.com about the project"

## 🔧 Troubleshooting

### Common Issues

**Backend won't start:**

- Check if MongoDB is running
- Verify all environment variables are set
- Check port 3000 is available

**Frontend won't start:**

- Make sure you have Expo CLI installed: `npm install -g @expo/cli`
- Check if port 19006 is available

**Authentication fails:**

- Verify Google OAuth credentials
- Check redirect URI matches exactly
- Ensure APIs are enabled in Google Cloud Console

**Voice not working:**

- Grant microphone permissions
- Check if using HTTPS (required for voice in production)
- Try different browser/device

### Getting Help

- Check the full [README.md](README.md) for detailed instructions
- Review the [API documentation](README.md#api-endpoints)
- Check console logs for error messages

## 🎉 You're Ready!

Your AI Voice Assistant is now running! Start exploring the features and customizing it for your needs.
