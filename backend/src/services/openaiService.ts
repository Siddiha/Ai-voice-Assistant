import OpenAI from "openai";
import fs from "fs";

interface UserContext {
  recentEvents?: any[];
  recentEmails?: any[];
  todayEvents?: any[];
  weekEvents?: any[];
  userInfo?: any;
  currentTime?: string;
  timezone?: string;
}

interface AIResponse {
  response: string;
  action?: {
    type: string;
    data?: any;
    eventId?: string;
    query?: string;
    date?: string;
    duration?: number;
    limit?: number;
  };
  confidence: number;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Convert speech to text
  async speechToText(audioFilePath: string): Promise<string | null> {
    try {
      const audioFile = fs.createReadStream(audioFilePath);

      const response = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en",
        response_format: "text",
      });

      // Clean up uploaded file
      fs.unlinkSync(audioFilePath);

      return response || null;
    } catch (error) {
      console.error("Speech to text error:", error);
      // Clean up uploaded file even on error
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
      throw new Error("Failed to convert speech to text");
    }
  }

  // Process user input with comprehensive context
  async processUserInput(
    input: string,
    userId: string,
    context: UserContext
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(input, context);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        functions: this.getFunctionDefinitions(),
        function_call: "auto",
        temperature: 0.3, // Lower temperature for more consistent responses
        max_tokens: 1000,
      });

      const message = response.choices[0].message;

      // Check if AI wants to call a function
      if (message.function_call) {
        const functionName = message.function_call.name;
        const functionArgs = JSON.parse(
          message.function_call.arguments || "{}"
        );

        return {
          response: this.generateActionResponse(functionName, functionArgs),
          action: this.mapFunctionToAction(functionName, functionArgs),
          confidence: 0.9,
        };
      }

      return {
        response:
          message.content || "I'm sorry, I couldn't process that request.",
        confidence: 0.8,
      };
    } catch (error) {
      console.error("OpenAI processing error:", error);
      return {
        response:
          "I'm sorry, I encountered an error processing your request. Please try again.",
        confidence: 0.1,
      };
    }
  }

  // Build comprehensive system prompt
  private buildSystemPrompt(context: UserContext): string {
    const currentTime = context.currentTime
      ? new Date(context.currentTime)
      : new Date();
    const timeString = currentTime.toLocaleString("en-US", {
      timeZone: context.timezone || "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `You are an intelligent personal assistant specializing in calendar and email management.

Current Context:
- Current time: ${timeString}
- Timezone: ${context.timezone || "UTC"}
- User: ${context.userInfo?.name || "User"} (${
      context.userInfo?.email || "No email"
    })

Calendar Information:
- Today's events: ${context.todayEvents?.length || 0}
- This week's events: ${context.weekEvents?.length || 0}
- Recent events loaded: ${context.recentEvents?.length || 0}

Email Information:
- Recent emails loaded: ${context.recentEmails?.length || 0}

Your capabilities:
1. Calendar Management:
   - View calendar events for any date range
   - Create, update, and delete events
   - Check availability for scheduling
   - Find free time slots
   - Reschedule meetings

2. Email Management:
   - Read and search through emails
   - Send emails with proper formatting
   - Summarize email content
   - Find specific emails by sender, subject, or content

Instructions:
- Always be specific about dates and times
- When scheduling, consider the user's existing events to avoid conflicts
- For email searches, use relevant keywords from the user's request
- Provide helpful, accurate responses based on the actual data available
- If you need to perform an action, use the appropriate function
- Be conversational but professional
- Always confirm important actions like deleting events or sending emails

Current Data Context:
${this.formatContextData(context)}`;
  }

  // Build user prompt with context
  private buildUserPrompt(input: string, context: UserContext): string {
    return `User Request: "${input}"

Please help the user with their request. Use the available context and functions to provide accurate assistance.`;
  }

  // Format context data for the AI
  private formatContextData(context: UserContext): string {
    let contextStr = "";

    if (context.todayEvents && context.todayEvents.length > 0) {
      contextStr += "\nToday's Events:\n";
      context.todayEvents.forEach((event, index) => {
        const startTime = new Date(event.startDate).toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        contextStr += `${index + 1}. ${event.title} at ${startTime}\n`;
      });
    }

    if (context.weekEvents && context.weekEvents.length > 0) {
      contextStr += "\nThis Week's Upcoming Events:\n";
      context.weekEvents.slice(0, 10).forEach((event, index) => {
        const eventDate = new Date(event.startDate);
        const dateStr = eventDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = eventDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        contextStr += `${index + 1}. ${
          event.title
        } - ${dateStr} at ${timeStr}\n`;
      });
    }

    if (context.recentEmails && context.recentEmails.length > 0) {
      contextStr += "\nRecent Emails:\n";
      context.recentEmails.slice(0, 5).forEach((email, index) => {
        const emailDate = new Date(email.date).toLocaleDateString("en-US");
        contextStr += `${index + 1}. From: ${email.from} - Subject: ${
          email.subject
        } (${emailDate})\n`;
      });
    }

    return contextStr || "No specific context data available.";
  }

  // Define functions for OpenAI to call
  private getFunctionDefinitions() {
    return [
      {
        name: "create_calendar_event",
        description: "Create a new calendar event",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event title" },
            description: { type: "string", description: "Event description" },
            startDate: {
              type: "string",
              description: "Start date and time in ISO format",
            },
            endDate: {
              type: "string",
              description: "End date and time in ISO format",
            },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "Email addresses of attendees",
            },
            location: { type: "string", description: "Event location" },
          },
          required: ["title", "startDate", "endDate"],
        },
      },
      {
        name: "update_calendar_event",
        description: "Update an existing calendar event",
        parameters: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "ID of the event to update",
            },
            title: { type: "string", description: "New event title" },
            description: {
              type: "string",
              description: "New event description",
            },
            startDate: {
              type: "string",
              description: "New start date and time in ISO format",
            },
            endDate: {
              type: "string",
              description: "New end date and time in ISO format",
            },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "Email addresses of attendees",
            },
            location: { type: "string", description: "Event location" },
          },
          required: ["eventId"],
        },
      },
      {
        name: "delete_calendar_event",
        description: "Delete a calendar event",
        parameters: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "ID of the event to delete",
            },
          },
          required: ["eventId"],
        },
      },
      {
        name: "check_availability",
        description: "Check availability for a specific date and duration",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Date to check in ISO format",
            },
            duration: { type: "number", description: "Duration in minutes" },
          },
          required: ["date", "duration"],
        },
      },
      {
        name: "search_emails",
        description: "Search through emails",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query (can include sender, subject, keywords)",
            },
            limit: {
              type: "number",
              description: "Number of emails to return (default 10)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "send_email",
        description: "Send an email",
        parameters: {
          type: "object",
          properties: {
            to: {
              type: "array",
              items: { type: "string" },
              description: "Recipient email addresses",
            },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email body content" },
            cc: {
              type: "array",
              items: { type: "string" },
              description: "CC email addresses",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
    ];
  }

  // Generate appropriate response for actions
  private generateActionResponse(functionName: string, args: any): string {
    switch (functionName) {
      case "create_calendar_event":
        return `I'll create a new event "${args.title}" for ${new Date(
          args.startDate
        ).toLocaleString()}.`;
      case "update_calendar_event":
        return `I'll update the calendar event with the new information.`;
      case "delete_calendar_event":
        return `I'll delete that calendar event for you.`;
      case "check_availability":
        return `Let me check your availability for ${new Date(
          args.date
        ).toLocaleDateString()}.`;
      case "search_emails":
        return `I'll search your emails for "${args.query}".`;
      case "send_email":
        return `I'll send that email to ${args.to.join(", ")}.`;
      default:
        return `I'll help you with that request.`;
    }
  }

  // Map OpenAI function calls to our action format
  private mapFunctionToAction(functionName: string, args: any): any {
    switch (functionName) {
      case "create_calendar_event":
        return {
          type: "calendar_create",
          data: args,
        };
      case "update_calendar_event":
        return {
          type: "calendar_update",
          eventId: args.eventId,
          data: args,
        };
      case "delete_calendar_event":
        return {
          type: "calendar_delete",
          eventId: args.eventId,
        };
      case "check_availability":
        return {
          type: "calendar_check_availability",
          date: args.date,
          duration: args.duration,
        };
      case "search_emails":
        return {
          type: "email_search",
          query: args.query,
          limit: args.limit || 10,
        };
      case "send_email":
        return {
          type: "email_send",
          data: args,
        };
      default:
        return null;
    }
  }
}
