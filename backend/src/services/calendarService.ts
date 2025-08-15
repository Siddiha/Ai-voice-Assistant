import { google } from "googleapis";
import { AuthService } from "./authService";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  attendees: string[];
  location?: string;
  status: string;
}

interface CreateEventData {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  attendees?: string[];
  location?: string;
  timezone?: string;
}

export class CalendarService {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Get authenticated calendar client for user
  private async getCalendarClient(userId: string) {
    const authClient = await this.authService.createAuthenticatedClient(userId);
    return google.calendar({ version: "v3", auth: authClient });
  }

  // Get calendar events
  async getEvents(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: false,
      });

      const events = response.data.items || [];

      return events.map((event: any) => ({
        id: event.id,
        title: event.summary || "No Title",
        description: event.description || "",
        startDate: event.start?.dateTime || event.start?.date,
        endDate: event.end?.dateTime || event.end?.date,
        attendees:
          event.attendees?.map((attendee: any) => attendee.email) || [],
        location: event.location || "",
        status: event.status,
      }));
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      throw new Error("Failed to fetch calendar events");
    }
  }

  // Create a new calendar event
  async createEvent(
    userId: string,
    eventData: CreateEventData
  ): Promise<CalendarEvent> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startDate,
          timeZone: eventData.timezone || "UTC",
        },
        end: {
          dateTime: eventData.endDate,
          timeZone: eventData.timezone || "UTC",
        },
        attendees: eventData.attendees?.map((email) => ({ email })),
        location: eventData.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 10 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        sendUpdates: "all",
      });

      return {
        id: response.data.id!,
        title: response.data.summary!,
        description: response.data.description || "",
        startDate: response.data.start?.dateTime || response.data.start?.date!,
        endDate: response.data.end?.dateTime || response.data.end?.date!,
        attendees:
          response.data.attendees?.map((attendee: any) => attendee.email) || [],
        location: response.data.location || "",
        status: response.data.status!,
      };
    } catch (error) {
      console.error("Error creating event:", error);
      throw new Error("Failed to create calendar event");
    }
  }

  // Update an existing calendar event
  async updateEvent(
    userId: string,
    eventId: string,
    updateData: Partial<CreateEventData>
  ): Promise<CalendarEvent> {
    try {
      const calendar = await this.getCalendarClient(userId);

      const updatePayload: any = {};

      if (updateData.title) updatePayload.summary = updateData.title;
      if (updateData.description)
        updatePayload.description = updateData.description;
      if (updateData.location) updatePayload.location = updateData.location;

      if (updateData.startDate) {
        updatePayload.start = {
          dateTime: updateData.startDate,
          timeZone: updateData.timezone || "UTC",
        };
      }

      if (updateData.endDate) {
        updatePayload.end = {
          dateTime: updateData.endDate,
          timeZone: updateData.timezone || "UTC",
        };
      }

      if (updateData.attendees) {
        updatePayload.attendees = updateData.attendees.map((email) => ({
          email,
        }));
      }

      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: eventId,
        requestBody: updatePayload,
        sendUpdates: "all",
      });

      return {
        id: response.data.id!,
        title: response.data.summary!,
        description: response.data.description || "",
        startDate: response.data.start?.dateTime || response.data.start?.date!,
        endDate: response.data.end?.dateTime || response.data.end?.date!,
        attendees:
          response.data.attendees?.map((attendee: any) => attendee.email) || [],
        location: response.data.location || "",
        status: response.data.status!,
      };
    } catch (error) {
      console.error("Error updating event:", error);
      throw new Error("Failed to update calendar event");
    }
  }

  // Delete a calendar event
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    try {
      const calendar = await this.getCalendarClient(userId);

      await calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
        sendUpdates: "all",
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      throw new Error("Failed to delete calendar event");
    }
  }

  // Check availability for a specific date and duration
  async checkAvailability(
    userId: string,
    date: Date,
    durationMinutes: number
  ): Promise<{
    isAvailable: boolean;
    conflictingEvents: CalendarEvent[];
    suggestedTimes: string[];
  }> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const events = await this.getEvents(userId, startOfDay, endOfDay);

      const requestedStart = new Date(date);
      const requestedEnd = new Date(
        date.getTime() + durationMinutes * 60 * 1000
      );

      // Check for conflicts
      const conflictingEvents = events.filter((event) => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);

        return (
          (requestedStart >= eventStart && requestedStart < eventEnd) ||
          (requestedEnd > eventStart && requestedEnd <= eventEnd) ||
          (requestedStart <= eventStart && requestedEnd >= eventEnd)
        );
      });

      const isAvailable = conflictingEvents.length === 0;

      // Generate suggested times if not available
      const suggestedTimes: string[] = [];
      if (!isAvailable) {
        // Find available slots throughout the day
        const workingHours = { start: 9, end: 17 }; // 9 AM to 5 PM

        for (
          let hour = workingHours.start;
          hour <= workingHours.end - Math.ceil(durationMinutes / 60);
          hour++
        ) {
          const slotStart = new Date(date);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(
            slotStart.getTime() + durationMinutes * 60 * 1000
          );

          const hasConflict = events.some((event) => {
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);

            return (
              (slotStart >= eventStart && slotStart < eventEnd) ||
              (slotEnd > eventStart && slotEnd <= eventEnd) ||
              (slotStart <= eventStart && slotEnd >= eventEnd)
            );
          });

          if (!hasConflict) {
            suggestedTimes.push(
              slotStart.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            );
          }

          if (suggestedTimes.length >= 3) break; // Limit to 3 suggestions
        }
      }

      return {
        isAvailable,
        conflictingEvents,
        suggestedTimes,
      };
    } catch (error) {
      console.error("Error checking availability:", error);
      throw new Error("Failed to check availability");
    }
  }
}
