import express from "express";
import multer from "multer";
import { CalendarService } from "../services/calendarService";
import { OpenAIService } from "../services/openaiService";
import { EmailService } from "../services/emailService";
import { authenticate, optionalAuth } from "../middleware/auth";
import authRoutes from "./auth";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Services
const calendarService = new CalendarService();
const openaiService = new OpenAIService();
const emailService = new EmailService();

// Auth routes
router.use("/auth", authRoutes);

// Get user's calendar events
router.get("/calendar/events", authenticate, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate
      ? new Date(endDate as string)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const events = await calendarService.getEvents(req.userId, start, end);

    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error: any) {
    console.error("Calendar events error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch calendar events",
    });
  }
});

// Create calendar event
router.post("/calendar/create-event", authenticate, async (req: any, res) => {
  try {
    const eventData = req.body;
    const event = await calendarService.createEvent(req.userId, eventData);

    res.json({
      success: true,
      event,
      message: "Event created successfully",
    });
  } catch (error: any) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create event",
    });
  }
});

// Update calendar event
router.put("/calendar/events/:eventId", authenticate, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const updateData = req.body;

    const updatedEvent = await calendarService.updateEvent(
      req.userId,
      eventId,
      updateData
    );

    res.json({
      success: true,
      event: updatedEvent,
      message: "Event updated successfully",
    });
  } catch (error: any) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update event",
    });
  }
});

// Delete calendar event
router.delete(
  "/calendar/events/:eventId",
  authenticate,
  async (req: any, res) => {
    try {
      const { eventId } = req.params;
      await calendarService.deleteEvent(req.userId, eventId);

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete event",
      });
    }
  }
);

// Check availability
router.post(
  "/calendar/check-availability",
  authenticate,
  async (req: any, res) => {
    try {
      const { date, duration } = req.body;
      const availability = await calendarService.checkAvailability(
        req.userId,
        new Date(date),
        duration
      );

      res.json({
        success: true,
        availability,
      });
    } catch (error: any) {
      console.error("Check availability error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to check availability",
      });
    }
  }
);

// Get user's recent emails
router.get("/email/recent", authenticate, async (req: any, res) => {
  try {
    const { limit = 10 } = req.query;
    const emails = await emailService.getRecentEmails(
      req.userId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      emails,
      count: emails.length,
    });
  } catch (error: any) {
    console.error("Recent emails error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch recent emails",
    });
  }
});

// Search emails
router.get("/email/search", authenticate, async (req: any, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Search query is required",
      });
    }

    const emails = await emailService.searchEmails(
      req.userId,
      query as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      emails,
      count: emails.length,
      query,
    });
  } catch (error: any) {
    console.error("Email search error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to search emails",
    });
  }
});

// Send email
router.post("/email/send", authenticate, async (req: any, res) => {
  try {
    const emailData = req.body;
    const result = await emailService.sendEmail(req.userId, emailData);

    res.json({
      success: true,
      messageId: result.messageId,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("Send email error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send email",
    });
  }
});

// Process voice input
router.post(
  "/voice/process",
  authenticate,
  upload.single("audio"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No audio file provided",
        });
      }

      // Convert speech to text
      const transcription = await openaiService.speechToText(req.file.path);

      if (!transcription) {
        return res.status(400).json({
          success: false,
          error: "Could not transcribe audio",
        });
      }

      // Get user context (recent events and emails for better AI responses)
      const [recentEvents, recentEmails] = await Promise.all([
        calendarService.getEvents(
          req.userId,
          new Date(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ),
        emailService.getRecentEmails(req.userId, 5),
      ]);

      // Process with AI including user context
      const aiResponse = await openaiService.processUserInput(
        transcription,
        req.userId,
        {
          recentEvents,
          recentEmails,
          userInfo: req.user,
        }
      );

      // Execute any actions
      let actionResult = null;
      if (aiResponse.action) {
        actionResult = await executeAction(aiResponse.action, req.userId);
      }

      res.json({
        success: true,
        transcription,
        response: aiResponse.response,
        action: aiResponse.action,
        actionResult,
      });
    } catch (error: any) {
      console.error("Voice processing error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to process voice input",
      });
    }
  }
);

// Process chat message
router.post("/chat", authenticate, async (req: any, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // Get comprehensive user context for accurate AI responses
    const [recentEvents, recentEmails, todayEvents, weekEvents] =
      await Promise.all([
        calendarService.getEvents(
          req.userId,
          new Date(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ),
        emailService.getRecentEmails(req.userId, 10),
        calendarService.getEvents(
          req.userId,
          new Date(),
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        ),
        calendarService.getEvents(
          req.userId,
          new Date(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ),
      ]);

    // Process with AI including comprehensive context
    const aiResponse = await openaiService.processUserInput(
      message,
      req.userId,
      {
        recentEvents,
        recentEmails,
        todayEvents,
        weekEvents,
        userInfo: req.user,
        currentTime: new Date().toISOString(),
        timezone: req.user?.preferences?.timezone || "UTC",
      }
    );

    // Execute any actions the AI determined
    let actionResult = null;
    if (aiResponse.action) {
      actionResult = await executeAction(aiResponse.action, req.userId);
    }

    res.json({
      success: true,
      response: aiResponse.response,
      action: aiResponse.action,
      actionResult,
      context: {
        eventsFound: recentEvents.length,
        emailsFound: recentEmails.length,
      },
    });
  } catch (error: any) {
    console.error("Chat processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process message",
    });
  }
});

// Get comprehensive dashboard data
router.get("/dashboard", authenticate, async (req: any, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [todayEvents, weekEvents, recentEmails, unreadEmails] =
      await Promise.all([
        calendarService.getEvents(req.userId, todayStart, todayEnd),
        calendarService.getEvents(req.userId, now, weekEnd),
        emailService.getRecentEmails(req.userId, 10),
        emailService.getUnreadEmails(req.userId, 5),
      ]);

    // Get next upcoming event
    const upcomingEvents = weekEvents.filter(
      (event) => new Date(event.startDate) > now
    );
    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

    res.json({
      success: true,
      dashboard: {
        todayEvents: todayEvents.length,
        weekEvents: weekEvents.length,
        recentEmails: recentEmails.length,
        unreadEmails: unreadEmails.length,
        nextEvent,
        user: {
          name: req.user.name,
          email: req.user.email,
          picture: req.user.picture,
        },
      },
      data: {
        todayEvents,
        weekEvents,
        recentEmails,
        unreadEmails,
      },
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to load dashboard",
    });
  }
});

// Execute AI-determined actions
async function executeAction(action: any, userId: string) {
  try {
    switch (action.type) {
      case "calendar_create":
        return await calendarService.createEvent(userId, action.data);

      case "calendar_update":
        return await calendarService.updateEvent(
          userId,
          action.eventId,
          action.data
        );

      case "calendar_delete":
        await calendarService.deleteEvent(userId, action.eventId);
        return { success: true, message: "Event deleted" };

      case "calendar_check_availability":
        return await calendarService.checkAvailability(
          userId,
          new Date(action.date),
          action.duration
        );

      case "email_send":
        return await emailService.sendEmail(userId, action.data);

      case "email_search":
        return await emailService.searchEmails(
          userId,
          action.query,
          action.limit || 10
        );

      default:
        return { success: false, error: "Unknown action type" };
    }
  } catch (error: any) {
    console.error("Action execution error:", error);
    return { success: false, error: error.message };
  }
}

export default router;
