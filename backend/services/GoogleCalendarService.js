const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // Set user credentials
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Generate OAuth URL for user authentication
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to get access tokens');
    }
  }

  // Get calendar events for a date range
  async getEvents(startDate, endDate, maxResults = 50) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items.map((event) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location
      }));
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  // Create a new calendar event
  async createEvent(eventData) {
    try {
      const event = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.start.dateTime,
          timeZone: eventData.start.timeZone || 'UTC',
        },
        end: {
          dateTime: eventData.end.dateTime,
          timeZone: eventData.end.timeZone || 'UTC',
        },
        attendees: eventData.attendees,
        location: eventData.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: response.data.start,
        end: response.data.end,
        attendees: response.data.attendees,
        location: response.data.location
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  // Update an existing calendar event
  async updateEvent(eventId, eventData) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: eventData,
        sendUpdates: 'all',
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  // Delete a calendar event
  async deleteEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  // Check availability for a specific time range
  async checkAvailability(startDate, endDate) {
    try {
      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate).toISOString(),
          items: [{ id: 'primary' }],
          timeZone: 'UTC',
        },
      });

      const busyTimes = response.data.calendars['primary'].busy || [];
      const timeSlots = [];

      // Generate hourly time slots for the day
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let current = new Date(start); current < end; current.setHours(current.getHours() + 1)) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + 60 * 60 * 1000); // 1 hour later
        
        // Check if this slot conflicts with any busy time
        const isAvailable = !busyTimes.some((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        timeSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          available: isAvailable
        });
      }

      return timeSlots;
    } catch (error) {
      console.error('Error checking availability:', error);
      throw new Error('Failed to check availability');
    }
  }

  // Get events for today
  async getTodaysEvents() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    return this.getEvents(startOfDay, endOfDay);
  }

  // Get events for this week
  async getThisWeeksEvents() {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return this.getEvents(startOfWeek.toISOString(), endOfWeek.toISOString());
  }

  // Find available time slots for a meeting
  async findAvailableSlots(
    duration, // in minutes
    startDate,
    endDate,
    workingHours = { start: 9, end: 17 } // 9 AM to 5 PM
  ) {
    try {
      const availability = await this.checkAvailability(startDate, endDate);
      const availableSlots = [];

      for (let i = 0; i < availability.length; i++) {
        const slot = availability[i];
        const slotStart = new Date(slot.start);
        const slotHour = slotStart.getHours();

        // Check if slot is within working hours and available
        if (slot.available && slotHour >= workingHours.start && slotHour < workingHours.end) {
          // Check if we have enough consecutive available slots for the duration
          let consecutiveMinutes = 0;
          let j = i;
          
          while (j < availability.length && availability[j].available) {
            consecutiveMinutes += 60; // Each slot is 1 hour
            if (consecutiveMinutes >= duration) {
              availableSlots.push({
                start: slot.start,
                end: new Date(slotStart.getTime() + duration * 60 * 1000).toISOString(),
                available: true
              });
              break;
            }
            j++;
          }
        }
      }

      return availableSlots;
    } catch (error) {
      console.error('Error finding available slots:', error);
      throw new Error('Failed to find available time slots');
    }
  }

  // Parse natural language date/time
  parseDateTime(dateTimeString) {
    // This is a simple implementation - you might want to use a library like chrono-node
    const now = new Date();
    let startDate;
    let endDate;

    const lowerStr = dateTimeString.toLowerCase();

    if (lowerStr.includes('tomorrow')) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 1);
    } else if (lowerStr.includes('next week')) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 7);
    } else if (lowerStr.includes('monday') || lowerStr.includes('tuesday') || 
               lowerStr.includes('wednesday') || lowerStr.includes('thursday') || 
               lowerStr.includes('friday') || lowerStr.includes('saturday') || 
               lowerStr.includes('sunday')) {
      // Handle specific day of the week
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.findIndex(day => lowerStr.includes(day));
      startDate = new Date(now);
      const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
      startDate.setDate(startDate.getDate() + daysUntilTarget);
    } else {
      startDate = new Date(now);
    }

    // Extract time if mentioned
    const timeMatch = lowerStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3];

      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }

      startDate.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 2 PM if no time specified
      startDate.setHours(14, 0, 0, 0);
    }

    // Default duration: 1 hour
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    };
  }
}

module.exports = GoogleCalendar;
