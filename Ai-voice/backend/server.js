// server.js - Express.js backend for AI Voice Assistant
const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// Import services
const VoiceAssistant = require('./services/VoiceAssistantService');
const GoogleCalendar = require('./services/GoogleCalendarService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const voiceAssistant = new VoiceAssistant();
const calendarService = new GoogleCalendar();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// In-memory storage for demo (replace with database in production)
const userSessions = new Map();

// Helper function to create user session
function createUserSession(userId = 'default') {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      id: userId,
      emails: [],
      calendar: [],
      tasks: [],
      preferences: {},
      conversationHistory: [],
    });
  }
  return userSessions.get(userId);
}

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Google OAuth endpoints
app.get('/auth/google', (req, res) => {
  const authUrl = calendarService.getAuthUrl();
  res.json({ authUrl });
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await calendarService.getTokens(code);
    
    // Store tokens in session (in production, store in database)
    const userId = req.query.state || 'default';
    const session = createUserSession(userId);
    session.googleTokens = tokens;
    
    // Initialize user with tokens
    await voiceAssistant.initializeUser(userId, tokens);
    
    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Voice input processing
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  try {
    const { userId = 'default', sessionId = 'default' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const result = await voiceAssistant.processVoiceInput(
      req.file.buffer,
      userId,
      sessionId
    );

    res.json(result);
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({ error: 'Failed to process voice input' });
  }
});

// Text input processing
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 'default', sessionId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const result = await voiceAssistant.processTextInput(
      message,
      userId,
      sessionId
    );

    res.json(result);
  } catch (error) {
    console.error('Chat processing error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Calendar endpoints
app.get('/api/calendar/events', async (req, res) => {
  try {
    const { startDate, endDate, userId = 'default' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const events = await calendarService.getEvents(startDate, endDate);
    res.json({ events });
  } catch (error) {
    console.error('Calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

app.post('/api/calendar/events', async (req, res) => {
  try {
    const { eventData, userId = 'default' } = req.body;
    
    if (!eventData) {
      return res.status(400).json({ error: 'Event data is required' });
    }

    const event = await calendarService.createEvent(eventData);
    res.json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.get('/api/calendar/availability', async (req, res) => {
  try {
    const { startDate, endDate, userId = 'default' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const availability = await calendarService.checkAvailability(startDate, endDate);
    res.json({ availability });
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Email endpoints
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, text, html, userId = 'default' } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Recipients and subject are required' });
    }

    const result = await voiceAssistant.emailService.sendEmail({
      to,
      subject,
      text,
      html
    });

    res.json(result);
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/email/meeting-invitation', async (req, res) => {
  try {
    const { attendees, meetingDetails, userId = 'default' } = req.body;
    
    if (!attendees || !meetingDetails) {
      return res.status(400).json({ error: 'Attendees and meeting details are required' });
    }

    const result = await voiceAssistant.emailService.sendMeetingInvitation(
      attendees,
      meetingDetails
    );

    res.json(result);
  } catch (error) {
    console.error('Meeting invitation error:', error);
    res.status(500).json({ error: 'Failed to send meeting invitation' });
  }
});

// User preferences endpoints
app.get('/api/user/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = await voiceAssistant.getUserPreferences(userId);
    res.json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
});

app.put('/api/user/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    const updatedPreferences = await voiceAssistant.updateUserPreferences(userId, preferences);
    res.json({ preferences: updatedPreferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
});

// Conversation history
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId = 'default', limit = 50 } = req.query;
    
    const history = await voiceAssistant.getConversationHistory(userId, sessionId, parseInt(limit));
    res.json({ history });
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
});

// User statistics
app.get('/api/user/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const timeRange = {
      start: new Date(startDate || new Date().setDate(new Date().getDate() - 30)),
      end: new Date(endDate || new Date())
    };
    
    const stats = await voiceAssistant.getUserStats(userId, timeRange);
    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

// Fallback simulated responses for development (legacy support)
function getSimulatedResponse(userMessage) {
  const message = userMessage.toLowerCase();

  if (message.includes('hello') || message.includes('hi')) {
    return "Hello! I'm your AI assistant. I can help you with emails, calendar events, and task management. What would you like to do?";
  }

  if (message.includes('email')) {
    if (message.includes('recent') || message.includes('new') || message.includes('unread')) {
      return 'You have 3 unread emails: One from your project manager about the deadline, one from HR about the team meeting, and one newsletter. Would you like me to read any of these?';
    }
    if (message.includes('draft') || message.includes('write') || message.includes('compose')) {
      return 'I can help you draft an email. Who would you like to send it to and what should it be about?';
    }
    return 'I can help you manage your emails. You can ask me to read recent emails, draft new ones, or send messages. What would you like to do?';
  }

  if (message.includes('calendar') || message.includes('schedule') || message.includes('meeting')) {
    if (message.includes('today') || message.includes('schedule')) {
      return 'You have 2 meetings today: Team standup at 10 AM and client call at 2 PM. Would you like me to schedule a new meeting?';
    }
    if (message.includes('schedule') || message.includes('book') || message.includes('create')) {
      return 'I can help you schedule a meeting. What time and date would you like, and who should be invited?';
    }
    return 'I can help you manage your calendar. You can check your schedule, book meetings, or view upcoming events. What would you like to do?';
  }

  if (message.includes('task') || message.includes('todo')) {
    if (message.includes('add') || message.includes('create')) {
      return 'I can help you add a task. What task would you like to add to your list?';
    }
    if (message.includes('list') || message.includes('show')) {
      return 'You have 5 tasks: Complete project proposal, Review code changes, Schedule team meeting, Update documentation, and Prepare presentation.';
    }
    return 'I can help you manage your tasks. You can add new tasks, mark them as complete, or view your current list. What would you like to do?';
  }

  return "I'm here to help you manage your emails, calendar, and tasks. You can ask me to check your schedule, read emails, or add tasks. What would you like to do?";
}

// Legacy endpoints for backward compatibility
app.post('/api/assistant', async (req, res) => {
  try {
    const { message, userId = 'default' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // Use the new service
    const result = await voiceAssistant.processTextInput(message, userId);
    res.json({ response: result.response });
  } catch (error) {
    console.error('Assistant error:', error);
    // Fallback to simulated response
    const response = getSimulatedResponse(req.body.message);
    res.json({ response });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await voiceAssistant.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await voiceAssistant.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Voice Assistant server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

