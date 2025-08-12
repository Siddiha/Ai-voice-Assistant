const OpenAI = require('./OpenAIService');
const GoogleCalendar = require('./GoogleCalendarService');
const Email = require('./EmailService');
const Database = require('./DatabaseService');

class VoiceAssistant {
  constructor() {
    this.openaiService = new OpenAI();
    this.calendarService = new GoogleCalendar();
    this.emailService = new Email();
    this.databaseService = new Database();
  }

  // Initialize services for a user
  async initializeUser(userId, tokens = null) {
    try {
      if (tokens) {
        this.calendarService.setCredentials(tokens);
        this.emailService.setCredentials(tokens);
        
        // Update user tokens in database
        await this.databaseService.updateUserTokens(userId, {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing user:', error);
      throw error;
    }
  }

  // Process voice input and generate response
  async processVoiceInput(audioBuffer, userId, sessionId = 'default') {
    try {
      // Create voice session
      const voiceSession = await this.databaseService.createVoiceSession({
        userId,
        duration: audioBuffer.length
      });

      // Convert speech to text
      const transcription = await this.openaiService.speechToText(audioBuffer);
      
      // Update session with transcription
      await this.databaseService.updateVoiceSession(voiceSession.id, {
        transcription,
        status: 'PROCESSING'
      });

      // Process the transcribed text
      const result = await this.processTextInput(transcription, userId, sessionId);
      
      // Update session with results
      await this.databaseService.updateVoiceSession(voiceSession.id, {
        intent: result.intent,
        response: result.response,
        status: 'COMPLETED'
      });

      return result;
    } catch (error) {
      console.error('Error processing voice input:', error);
      throw error;
    }
  }

  // Process text input and generate response
  async processTextInput(text, userId, sessionId = 'default') {
    try {
      // Get or create conversation
      const conversation = await this.databaseService.getOrCreateConversation(userId, sessionId);
      
      // Add user message to database
      await this.databaseService.addMessage(conversation.id, {
        role: 'USER',
        content: text
      });

      // Generate AI response
      const aiResponse = await this.openaiService.generateResponse(text, userId, sessionId);
      
      // Add assistant response to database
      await this.databaseService.addMessage(conversation.id, {
        role: 'ASSISTANT',
        content: aiResponse.response,
        metadata: {
          intent: aiResponse.intent,
          needsMoreInfo: aiResponse.needsMoreInfo
        }
      });

      // Handle specific actions based on intent
      if (aiResponse.intent.confidence > 0.7) {
        await this.handleIntent(aiResponse.intent, userId, sessionId);
      }

      return aiResponse;
    } catch (error) {
      console.error('Error processing text input:', error);
      throw error;
    }
  }

  // Handle specific intents and perform actions
  async handleIntent(intent, userId, sessionId) {
    try {
      switch (intent.action) {
        case 'schedule_event':
          return await this.handleScheduleEvent(intent.parameters, userId);
        
        case 'check_availability':
          return await this.handleCheckAvailability(intent.parameters, userId);
        
        case 'get_events':
          return await this.handleGetEvents(intent.parameters, userId);
        
        case 'send_email':
          return await this.handleSendEmail(intent.parameters, userId);
        
        case 'cancel_event':
          return await this.handleCancelEvent(intent.parameters, userId);
        
        case 'update_event':
          return await this.handleUpdateEvent(intent.parameters, userId);
        
        default:
          return { success: false, message: 'Intent not handled' };
      }
    } catch (error) {
      console.error('Error handling intent:', error);
      throw error;
    }
  }

  // Handle schedule event intent
  async handleScheduleEvent(parameters, userId) {
    try {
      const { title, dateTime, duration, attendees, location } = parameters;
      
      if (!title || !dateTime) {
        return { success: false, message: 'Missing required parameters for scheduling' };
      }

      // Parse date/time if it's a natural language string
      const parsedDateTime = this.calendarService.parseDateTime(dateTime);
      
      const eventData = {
        summary: title,
        description: parameters.description || '',
        start: {
          dateTime: parsedDateTime.start,
          timeZone: 'UTC'
        },
        end: {
          dateTime: parsedDateTime.end,
          timeZone: 'UTC'
        },
        attendees: attendees ? attendees.map(email => ({ email })) : [],
        location: location || ''
      };

      const event = await this.calendarService.createEvent(eventData);
      
      // Send meeting invitations if attendees are specified
      if (attendees && attendees.length > 0) {
        await this.emailService.sendMeetingInvitation(attendees, {
          title: event.summary,
          date: new Date(event.start.dateTime).toLocaleDateString(),
          time: new Date(event.start.dateTime).toLocaleTimeString(),
          duration: `${Math.round((new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000)} minutes`,
          location: event.location || 'No location specified',
          organizer: 'AI Assistant',
          description: event.description || ''
        });
      }

      return { 
        success: true, 
        message: `Event "${event.summary}" scheduled successfully`,
        event 
      };
    } catch (error) {
      console.error('Error scheduling event:', error);
      throw error;
    }
  }

  // Handle check availability intent
  async handleCheckAvailability(parameters, userId) {
    try {
      const { date, startTime, endTime } = parameters;
      
      if (!date) {
        return { success: false, message: 'Date is required to check availability' };
      }

      const startDate = startTime ? new Date(`${date}T${startTime}`) : new Date(date);
      const endDate = endTime ? new Date(`${date}T${endTime}`) : new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const availability = await this.calendarService.checkAvailability(
        startDate.toISOString(),
        endDate.toISOString()
      );

      const availableSlots = availability.filter(slot => slot.available);
      
      return {
        success: true,
        message: `Found ${availableSlots.length} available time slots`,
        availability: availableSlots
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  // Handle get events intent
  async handleGetEvents(parameters, userId) {
    try {
      const { timeframe } = parameters;
      let events;

      switch (timeframe) {
        case 'today':
          events = await this.calendarService.getTodaysEvents();
          break;
        case 'this week':
          events = await this.calendarService.getThisWeeksEvents();
          break;
        default:
          // Default to today's events
          events = await this.calendarService.getTodaysEvents();
      }

      const summary = await this.openaiService.generateCalendarSummary(events);
      
      return {
        success: true,
        message: summary,
        events,
        count: events.length
      };
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }

  // Handle send email intent
  async handleSendEmail(parameters, userId) {
    try {
      const { recipients, subject, message } = parameters;
      
      if (!recipients || !subject) {
        return { success: false, message: 'Recipients and subject are required' };
      }

      // Validate email addresses
      const { valid, invalid } = this.emailService.validateEmailAddresses(recipients);
      
      if (invalid.length > 0) {
        return { 
          success: false, 
          message: `Invalid email addresses: ${invalid.join(', ')}` 
        };
      }

      // Generate email content if message is not provided
      let emailContent = message;
      if (!emailContent) {
        const generatedEmail = await this.openaiService.generateEmail(
          subject,
          valid,
          { userId }
        );
        emailContent = generatedEmail.body;
      }

      const result = await this.emailService.sendEmail({
        to: valid,
        subject,
        text: emailContent
      });

      return {
        success: true,
        message: `Email sent successfully to ${valid.length} recipient(s)`,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Handle cancel event intent
  async handleCancelEvent(parameters, userId) {
    try {
      const { eventIdentifier } = parameters;
      
      if (!eventIdentifier) {
        return { success: false, message: 'Event identifier is required' };
      }

      await this.calendarService.deleteEvent(eventIdentifier);
      
      return {
        success: true,
        message: 'Event cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling event:', error);
      throw error;
    }
  }

  // Handle update event intent
  async handleUpdateEvent(parameters, userId) {
    try {
      const { eventIdentifier, updates } = parameters;
      
      if (!eventIdentifier || !updates) {
        return { success: false, message: 'Event identifier and updates are required' };
      }

      const updatedEvent = await this.calendarService.updateEvent(eventIdentifier, updates);
      
      return {
        success: true,
        message: 'Event updated successfully',
        event: updatedEvent
      };
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  // Get conversation history
  async getConversationHistory(userId, sessionId = 'default', limit = 50) {
    return this.databaseService.getConversationHistory(userId, sessionId, limit);
  }

  // Get user statistics
  async getUserStats(userId, timeRange) {
    return this.databaseService.getUserStats(userId, timeRange);
  }

  // Get user preferences
  async getUserPreferences(userId) {
    return this.databaseService.getUserPreferences(userId);
  }

  // Update user preferences
  async updateUserPreferences(userId, preferences) {
    return this.databaseService.updateUserPreferences(userId, preferences);
  }

  // Cleanup old data
  async cleanupOldData(daysToKeep = 30) {
    return this.databaseService.cleanupOldData(daysToKeep);
  }

  // Close all services
  async close() {
    await this.databaseService.disconnect();
  }
}

module.exports = VoiceAssistant;
