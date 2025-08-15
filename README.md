# AI Voice Assistant

A comprehensive AI-powered voice assistant that helps you manage your calendar, emails, and tasks through natural voice commands. Built with React Native (Expo) for the frontend and Node.js/Express for the backend.

## Features

### 🎤 Voice Commands

- Natural language processing for calendar and email management
- Voice-to-text transcription using OpenAI Whisper
- Text-to-speech responses for hands-free interaction
- Support for complex multi-step commands

### 📅 Calendar Management

- View today's and upcoming events
- Create new calendar events with voice commands
- Schedule meetings with attendees
- Set reminders and notifications
- Integration with Google Calendar

### 📧 Email Management

- Read recent emails aloud
- Compose and send emails using voice
- Search through email history
- Mark emails as read/unread
- Integration with Gmail

### 🔐 Authentication

- Secure Google OAuth integration
- JWT token-based authentication
- Automatic token refresh
- Secure storage of credentials

### 🎨 Modern UI

- Beautiful gradient design
- Intuitive chat interface
- Real-time message updates
- Responsive layout for all devices
- Dark mode support

## Tech Stack

### Frontend

- **React Native** with Expo
- **TypeScript** for type safety
- **Expo AV** for audio recording and playback
- **Expo Speech** for text-to-speech
- **AsyncStorage** for local data persistence
- **Linear Gradient** for beautiful UI effects

### Backend

- **Node.js** with Express
- **TypeScript** for type safety
- **MongoDB** with Mongoose for data storage
- **Google APIs** for Calendar and Gmail integration
- **OpenAI API** for natural language processing
- **JWT** for authentication
- **Multer** for file uploads

### APIs & Services

- **Google Calendar API** - Calendar management
- **Gmail API** - Email management
- **OpenAI Whisper** - Speech-to-text
- **OpenAI GPT** - Natural language understanding
- **Google OAuth** - Authentication

## Project Structure

```
Ai-voice-Assistant/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   └── User.ts
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── calendarService.ts
│   │   │   ├── emailService.ts
│   │   │   └── openaiService.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   └── components/
│   │       └── VoiceCalendarApp.tsx
│   ├── App.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── app.json
└── README.md
```

## Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or cloud)
- Google Cloud Console account
- OpenAI API key

### Backend Setup

1. **Navigate to backend directory:**

   ```bash
   cd Ai-voice-Assistant/backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the backend directory:

   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   OPENAI_API_KEY=your_openai_api_key
   FRONTEND_URL=http://localhost:19006
   ```

4. **Build and start the server:**
   ```bash
   npm run build
   npm start
   ```

### Frontend Setup

1. **Navigate to frontend directory:**

   ```bash
   cd Ai-voice-Assistant/frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm start
   ```

4. **Run on device/simulator:**
   - Press `a` for Android
   - Press `i` for iOS
   - Press `w` for web

## Google Cloud Setup

1. **Create a Google Cloud Project:**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs:**

   - Google Calendar API
   - Gmail API
   - Google+ API

3. **Create OAuth 2.0 Credentials:**

   - Go to "Credentials" section
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs
   - Download the client configuration

4. **Update environment variables:**
   - Add your Google Client ID and Secret to the backend `.env` file

## Usage Examples

### Voice Commands

**Calendar Management:**

- "What meetings do I have today?"
- "Schedule a meeting with John tomorrow at 2 PM"
- "Create an event called 'Team Lunch' on Friday at noon"
- "What's on my calendar this week?"

**Email Management:**

- "Read my recent emails"
- "Send an email to john@example.com about the project update"
- "Search for emails from Sarah"
- "Mark the latest email as read"

**General Commands:**

- "What's the weather like?"
- "Set a reminder for tomorrow"
- "What time is my next meeting?"

## API Endpoints

### Authentication

- `GET /api/auth/google` - Get Google OAuth URL
- `POST /api/auth/google/callback` - Handle OAuth callback
- `GET /api/auth/verify` - Verify JWT token

### Voice Processing

- `POST /api/voice/process` - Process voice input
- `POST /api/chat` - Process text input

### Calendar

- `GET /api/calendar/events` - Get calendar events
- `POST /api/calendar/events` - Create new event
- `PUT /api/calendar/events/:id` - Update event
- `DELETE /api/calendar/events/:id` - Delete event

### Email

- `GET /api/email/messages` - Get recent emails
- `POST /api/email/send` - Send email
- `PUT /api/email/messages/:id/read` - Mark email as read

### Dashboard

- `GET /api/dashboard` - Get dashboard data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.

## Roadmap

- [ ] Add support for multiple calendar providers
- [ ] Implement email templates
- [ ] Add task management features
- [ ] Support for multiple languages
- [ ] Offline mode capabilities
- [ ] Advanced voice recognition
- [ ] Integration with smart home devices
- [ ] Team collaboration features
