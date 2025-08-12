const OpenAI = require('openai');

class OpenAI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.conversations = new Map();
  }

  // Initialize or get conversation context
  getContext(userId, sessionId = 'default') {
    const contextId = `${userId}-${sessionId}`;
    
    if (!this.conversations.has(contextId)) {
      this.conversations.set(contextId, {
        userId,
        sessionId,
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI voice assistant for calendar and email management. 
            You can help users:
            1. Schedule meetings and events
            2. Check calendar availability
            3. View upcoming events
            4. Send emails
            5. Cancel or update events
            
            Be conversational and natural. When users want to perform actions, extract the necessary information and ask for clarification if needed.
            
            For scheduling: Extract title, date, time, duration, attendees, location
            For availability: Extract date/time range
            For emails: Extract recipients, subject, and message content
            
            Always confirm important actions before executing them.`
          }
        ]
      });
    }
    
    return this.conversations.get(contextId);
  }

  // Analyze user input and extract intent
  async analyzeIntent(userInput, userId, sessionId = 'default') {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for a calendar and email assistant. Analyze the user's message and return a JSON object with:
            {
              "action": "schedule_event" | "check_availability" | "send_email" | "get_events" | "cancel_event" | "update_event" | "none",
              "confidence": 0.0-1.0,
              "parameters": {
                // Relevant extracted parameters based on the action
              }
            }
            
            For schedule_event, extract: title, dateTime, duration, attendees, location
            For check_availability, extract: date, startTime, endTime
            For send_email, extract: recipients, subject, message
            For get_events, extract: timeframe (today, tomorrow, this week, etc.)
            For cancel_event or update_event, extract: eventIdentifier
            
            Only return valid JSON, no other text.`
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result || '{"action": "none", "confidence": 0, "parameters": {}}');
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return { action: 'none', confidence: 0, parameters: {} };
    }
  }

  // Generate conversational response
  async generateResponse(
    userInput,
    userId,
    sessionId = 'default',
    context
  ) {
    try {
      const conversationContext = this.getContext(userId, sessionId);
      
      // Add user message to context
      conversationContext.messages.push({
        role: 'user',
        content: userInput
      });

      // Analyze intent
      const intent = await this.analyzeIntent(userInput, userId, sessionId);

      // Add context information if available
      let systemMessage = '';
      if (context) {
        systemMessage = `Current context: ${JSON.stringify(context)}`;
      }

      // Generate response
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          ...conversationContext.messages,
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : [])
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const assistantResponse = response.choices[0].message.content || 'I apologize, but I had trouble processing that request.';

      // Add assistant response to context
      conversationContext.messages.push({
        role: 'assistant',
        content: assistantResponse
      });

      // Keep only last 10 messages to avoid token limits
      if (conversationContext.messages.length > 10) {
        const systemMsg = conversationContext.messages.find(msg => msg.role === 'system');
        conversationContext.messages = [
          ...(systemMsg ? [systemMsg] : []),
          ...conversationContext.messages.slice(-9)
        ];
      }

      return {
        response: assistantResponse,
        intent,
        needsMoreInfo: this.checkIfNeedsMoreInfo(intent)
      };
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        intent: { action: 'none', confidence: 0, parameters: {} }
      };
    }
  }

  // Check if we need more information for the intended action
  checkIfNeedsMoreInfo(intent) {
    switch (intent.action) {
      case 'schedule_event':
        return !intent.parameters.title || !intent.parameters.dateTime;
      case 'check_availability':
        return !intent.parameters.date;
      case 'send_email':
        return !intent.parameters.recipients || !intent.parameters.subject;
      default:
        return false;
    }
  }

  // Generate email content based on user input
  async generateEmail(
    purpose,
    recipients,
    context
  ) {
    try {
      const prompt = `Generate a professional email with the following details:
      Purpose: ${purpose}
      Recipients: ${recipients.join(', ')}
      ${context ? `Context: ${JSON.stringify(context)}` : ''}
      
      Return a JSON object with "subject" and "body" fields.
      Keep the email concise and professional.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional email writer. Generate appropriate subject lines and email bodies based on the given context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      });

      const result = JSON.parse(response.choices[0].message.content || '{"subject": "Meeting Request", "body": "Hello,\n\nI hope this email finds you well.\n\nBest regards"}');
      return result;
    } catch (error) {
      console.error('Error generating email:', error);
      return {
        subject: 'Meeting Request',
        body: 'Hello,\n\nI hope this email finds you well.\n\nBest regards'
      };
    }
  }

  // Convert speech to text (placeholder for integration with speech service)
  async speechToText(audioBuffer) {
    try {
      // Using OpenAI Whisper API
      const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
      
      const response = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en'
      });

      return response.text;
    } catch (error) {
      console.error('Error converting speech to text:', error);
      throw new Error('Failed to convert speech to text');
    }
  }

  // Generate summary of calendar events
  async generateCalendarSummary(events) {
    if (events.length === 0) {
      return "You have no events scheduled.";
    }

    try {
      const eventsText = events.map(event => 
        `${event.summary} at ${new Date(event.start.dateTime).toLocaleString()}`
      ).join(', ');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Generate a natural, conversational summary of the calendar events. Be concise but informative.'
          },
          {
            role: 'user',
            content: `Summarize these calendar events: ${eventsText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content || 'Here are your upcoming events.';
    } catch (error) {
      console.error('Error generating calendar summary:', error);
      return `You have ${events.length} upcoming events.`;
    }
  }

  // Extract entities from text (names, dates, times, etc.)
  async extractEntities(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Extract entities from the user's message and return a JSON object with:
            {
              "people": ["array of person names"],
              "dates": ["array of date expressions"],
              "times": ["array of time expressions"], 
              "locations": ["array of location names"],
              "subjects": ["array of meeting/email subjects"],
              "durations": ["array of duration expressions"]
            }`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error extracting entities:', error);
      return {};
    }
  }

  // Clear conversation context
  clearContext(userId, sessionId = 'default') {
    const contextId = `${userId}-${sessionId}`;
    this.conversations.delete(contextId);
  }

  // Get conversation history
  getConversationHistory(userId, sessionId = 'default') {
    const context = this.getContext(userId, sessionId);
    return context.messages.filter(msg => msg.role !== 'system');
  }

  // Handle follow-up questions and context continuation
  async handleFollowUp(
    userInput,
    userId,
    sessionId = 'default'
  ) {
    const context = this.getContext(userId, sessionId);
    
    if (context.currentTask) {
      // We're in the middle of a multi-step task
      const response = await this.generateResponse(userInput, userId, sessionId, {
        currentTask: context.currentTask,
        pendingData: context.pendingData
      });

      // Check if we have enough information to complete the task
      if (response.intent.confidence > 0.7 && !response.needsMoreInfo) {
        context.currentTask = undefined;
        context.pendingData = undefined;
        
        return {
          response: response.response,
          action: response.intent.action,
          parameters: response.intent.parameters
        };
      }

      return { response: response.response };
    }

    // Normal conversation flow
    const response = await this.generateResponse(userInput, userId, sessionId);
    return {
      response: response.response,
      action: response.intent.action,
      parameters: response.intent.parameters
    };
  }
}

module.exports = OpenAI;
