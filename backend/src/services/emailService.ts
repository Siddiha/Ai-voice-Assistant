import { google } from "googleapis";
import { AuthService } from "./authService";

interface EmailData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
  isUnread: boolean;
}

export class EmailService {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Get authenticated Gmail client for user
  private async getGmailClient(userId: string) {
    const authClient = await this.authService.createAuthenticatedClient(userId);
    return google.gmail({ version: "v1", auth: authClient });
  }

  // Get recent emails
  async getRecentEmails(
    userId: string,
    limit: number = 10
  ): Promise<GmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults: limit,
        q: "in:inbox", // Only inbox emails
      });

      if (!response.data.messages) {
        return [];
      }

      const emailPromises = response.data.messages.map(async (message) => {
        const emailDetails = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
        });

        return this.parseGmailMessage(emailDetails.data);
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter((email) => email !== null) as GmailMessage[];
    } catch (error) {
      console.error("Error fetching recent emails:", error);
      throw new Error("Failed to fetch recent emails");
    }
  }

  // Get unread emails
  async getUnreadEmails(
    userId: string,
    limit: number = 5
  ): Promise<GmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults: limit,
        q: "in:inbox is:unread", // Only unread inbox emails
      });

      if (!response.data.messages) {
        return [];
      }

      const emailPromises = response.data.messages.map(async (message) => {
        const emailDetails = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
        });

        return this.parseGmailMessage(emailDetails.data);
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter((email) => email !== null) as GmailMessage[];
    } catch (error) {
      console.error("Error fetching unread emails:", error);
      throw new Error("Failed to fetch unread emails");
    }
  }

  // Search emails
  async searchEmails(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<GmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults: limit,
        q: query, // Gmail search query
      });

      if (!response.data.messages) {
        return [];
      }

      const emailPromises = response.data.messages.map(async (message) => {
        const emailDetails = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
        });

        return this.parseGmailMessage(emailDetails.data);
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter((email) => email !== null) as GmailMessage[];
    } catch (error) {
      console.error("Error searching emails:", error);
      throw new Error("Failed to search emails");
    }
  }

  // Send email
  async sendEmail(
    userId: string,
    emailData: EmailData
  ): Promise<{ messageId: string }> {
    try {
      const gmail = await this.getGmailClient(userId);

      // Create email message
      const messageParts = [
        `To: ${emailData.to.join(", ")}`,
        emailData.cc && emailData.cc.length > 0
          ? `Cc: ${emailData.cc.join(", ")}`
          : "",
        emailData.bcc && emailData.bcc.length > 0
          ? `Bcc: ${emailData.bcc.join(", ")}`
          : "",
        `Subject: ${emailData.subject}`,
        emailData.isHtml
          ? "Content-Type: text/html; charset=utf-8"
          : "Content-Type: text/plain; charset=utf-8",
        "",
        emailData.body,
      ]
        .filter((part) => part !== "")
        .join("\n");

      // Encode message
      const encodedMessage = Buffer.from(messageParts)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        messageId: response.data.id!,
      };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  // Parse Gmail message to our format
  private parseGmailMessage(message: any): GmailMessage | null {
    try {
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => {
        const header = headers.find(
          (h: any) => h.name.toLowerCase() === name.toLowerCase()
        );
        return header ? header.value : "";
      };

      const subject = getHeader("Subject") || "No Subject";
      const from = getHeader("From") || "Unknown Sender";
      const to =
        getHeader("To")
          ?.split(",")
          .map((email: string) => email.trim()) || [];
      const date = getHeader("Date") || new Date().toISOString();

      // Check if email is unread
      const isUnread = message.labelIds?.includes("UNREAD") || false;

      // Get email body
      let body = "";
      if (message.payload?.parts) {
        // Multi-part email
        const textPart = message.payload.parts.find(
          (part: any) =>
            part.mimeType === "text/plain" || part.mimeType === "text/html"
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
      } else if (message.payload?.body?.data) {
        // Simple email
        body = Buffer.from(message.payload.body.data, "base64").toString(
          "utf-8"
        );
      }

      return {
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        to,
        date: new Date(date).toISOString(),
        snippet: message.snippet || "",
        body: body.substring(0, 500), // Limit body length
        isUnread,
      };
    } catch (error) {
      console.error("Error parsing Gmail message:", error);
      return null;
    }
  }

  // Get email by ID
  async getEmailById(
    userId: string,
    emailId: string
  ): Promise<GmailMessage | null> {
    try {
      const gmail = await this.getGmailClient(userId);

      const response = await gmail.users.messages.get({
        userId: "me",
        id: emailId,
        format: "full",
      });

      return this.parseGmailMessage(response.data);
    } catch (error) {
      console.error("Error fetching email by ID:", error);
      throw new Error("Failed to fetch email");
    }
  }

  // Mark email as read
  async markAsRead(userId: string, emailId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient(userId);

      await gmail.users.messages.modify({
        userId: "me",
        id: emailId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch (error) {
      console.error("Error marking email as read:", error);
      throw new Error("Failed to mark email as read");
    }
  }

  // Get email stats
  async getEmailStats(userId: string): Promise<{
    totalUnread: number;
    todayEmails: number;
    weekEmails: number;
  }> {
    try {
      const gmail = await this.getGmailClient(userId);

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayString = today.toISOString().split("T")[0];
      const weekString = weekAgo.toISOString().split("T")[0];

      const [unreadResponse, todayResponse, weekResponse] = await Promise.all([
        gmail.users.messages.list({
          userId: "me",
          q: "in:inbox is:unread",
        }),
        gmail.users.messages.list({
          userId: "me",
          q: `in:inbox after:${todayString}`,
        }),
        gmail.users.messages.list({
          userId: "me",
          q: `in:inbox after:${weekString}`,
        }),
      ]);

      return {
        totalUnread: unreadResponse.data.messages?.length || 0,
        todayEmails: todayResponse.data.messages?.length || 0,
        weekEmails: weekResponse.data.messages?.length || 0,
      };
    } catch (error) {
      console.error("Error getting email stats:", error);
      throw new Error("Failed to get email statistics");
    }
  }
}
