import OpenAI from "openai";
import fs from "fs";
import path from "path";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ActionIntent {
  type: "calendar" | "email" | "general";
  action: string;
  parameters: any;
  confidence: number;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Transcribe audio to text using OpenAI Whisper
  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-1",
        language: "en",
        response_format: "text",
      });

      return transcription as string;
    } catch (error) {
      console.error("Audio transcription error:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  // Process text input and generate response
  async processTextInput(
    message: string,
    userContext: any,
    conversationHistory: ChatMessage[]
  ): Promise<{
    response: string;
    action?: ActionIntent;
    shouldRefreshData: boolean;
  }> {
    try {
      // Create system prompt with context
      const systemPrompt = this.createSystemPrompt(userContext);

      // Prepare messages for OpenAI
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: "user", content: message },
      ];

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages,
        max_tokens: 500,
        temperature: 0.7,
        functions: this.getFunctionDefinitions(),
        function_call: "auto",
      });

      const response = completion.choices[0].message;

      // Check if function was called
      if (response.function_call) {
        const functionCall = response.function_call;
        const parsedArgs = JSON.parse(functionCall.arguments);

        return {
          response: response.content || "I'll help you with that.",
          action: {
            type: parsedArgs.type || "general",
            action: functionCall.name,
            parameters: parsedArgs,
            confidence: 0.9,
          },
          shouldRefreshData: this.shouldRefreshData(functionCall.name),
        };
      }

      return {
        response: response.content || "I'm sorry, I didn't understand that.",
        shouldRefreshData: false,
      };
    } catch (error) {
      console.error("Text processing error:", error);
      throw new Error("Failed to process text input");
    }
  }

  // Create system prompt with user context
  private createSystemPrompt(userContext: any): string {
    return `You are an AI voice assistant that helps users manage their calendar and emails. 

User Context:
- Name: ${userContext.name || "User"}
- Email: ${userContext.email || "user@example.com"}
- Timezone: ${userContext.timezone || "UTC"}

Your capabilities:
1. Calendar Management: View, create, update, and delete calendar events
2. Email Management: Read, compose, and send emails
3. General Assistance: Answer questions, provide information

Guidelines:
- Be helpful, concise, and natural in your responses
- When users ask about calendar/email actions, use the appropriate functions
- Always confirm actions before executing them
- Provide clear, actionable responses
- If you're unsure about an action, ask for clarification

Current time: ${new Date().toISOString()}`;
  }

  // Define available functions for the AI
  private getFunctionDefinitions() {
    return [
      {
        name: "get_calendar_events",
        description: "Get calendar events for a specific date range",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["calendar"],
              description: "Type of action",
            },
            startDate: {
              type: "string",
              description: "Start date in ISO format (YYYY-MM-DD)",
            },
            endDate: {
              type: "string",
              description: "End date in ISO format (YYYY-MM-DD)",
            },
            query: {
              type: "string",
              description: "Search query for events",
            },
          },
          required: ["type"],
        },
      },
      {
        name: "create_calendar_event",
        description: "Create a new calendar event",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["calendar"],
              description: "Type of action",
            },
            title: {
              type: "string",
              description: "Event title",
            },
            description: {
              type: "string",
              description: "Event description",
            },
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
              items: {
                type: "string",
              },
              description: "List of attendee email addresses",
            },
            location: {
              type: "string",
              description: "Event location",
            },
          },
          required: ["type", "title", "startDate"],
        },
      },
      {
        name: "get_emails",
        description: "Get recent emails",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["email"],
              description: "Type of action",
            },
            query: {
              type: "string",
              description: "Search query for emails",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of emails to return",
            },
            unreadOnly: {
              type: "boolean",
              description: "Only return unread emails",
            },
          },
          required: ["type"],
        },
      },
      {
        name: "send_email",
        description: "Send an email",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["email"],
              description: "Type of action",
            },
            to: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Recipient email addresses",
            },
            subject: {
              type: "string",
              description: "Email subject",
            },
            body: {
              type: "string",
              description: "Email body",
            },
            cc: {
              type: "array",
              items: {
                type: "string",
              },
              description: "CC recipient email addresses",
            },
            bcc: {
              type: "array",
              items: {
                type: "string",
              },
              description: "BCC recipient email addresses",
            },
          },
          required: ["type", "to", "subject", "body"],
        },
      },
      {
        name: "general_response",
        description: "Provide a general response without specific actions",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["general"],
              description: "Type of action",
            },
            message: {
              type: "string",
              description: "Response message to user",
            },
          },
          required: ["type", "message"],
        },
      },
    ];
  }

  // Determine if data should be refreshed after an action
  private shouldRefreshData(actionName: string): boolean {
    const refreshActions = [
      "create_calendar_event",
      "update_calendar_event",
      "delete_calendar_event",
      "send_email",
      "mark_email_read",
    ];

    return refreshActions.includes(actionName);
  }

  // Generate a natural language response for actions
  async generateActionResponse(
    action: ActionIntent,
    result: any
  ): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "Generate a natural, conversational response confirming the action was completed successfully. Be brief and helpful.",
        },
        {
          role: "user",
          content: `Action: ${action.action}, Parameters: ${JSON.stringify(
            action.parameters
          )}, Result: ${JSON.stringify(result)}`,
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      return (
        completion.choices[0].message.content ||
        "Action completed successfully."
      );
    } catch (error) {
      console.error("Response generation error:", error);
      return "Action completed successfully.";
    }
  }

  // Extract entities from user input
  async extractEntities(text: string): Promise<{
    dates: string[];
    times: string[];
    people: string[];
    locations: string[];
  }> {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "Extract entities from the user input. Return only a JSON object with arrays of dates, times, people (names/emails), and locations.",
        },
        {
          role: "user",
          content: text,
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages,
        max_tokens: 200,
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content;
      if (response) {
        try {
          return JSON.parse(response);
        } catch {
          // Fallback if JSON parsing fails
          return { dates: [], times: [], people: [], locations: [] };
        }
      }

      return { dates: [], times: [], people: [], locations: [] };
    } catch (error) {
      console.error("Entity extraction error:", error);
      return { dates: [], times: [], people: [], locations: [] };
    }
  }
}
