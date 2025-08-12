const { PrismaClient } = require('@prisma/client');

class Database {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // User Management
  async createUser(userData) {
    return this.prisma.user.create({
      data: userData,
      include: {
        userPreferences: true
      }
    });
  }

  async getUserByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userPreferences: true
      }
    });
  }

  async updateUserTokens(userId, tokens) {
    return this.prisma.user.update({
      where: { id: userId },
      data: tokens
    });
  }

  // User Preferences
  async getUserPreferences(userId) {
    return this.prisma.userPreferences.findUnique({
      where: { userId }
    });
  }

  async updateUserPreferences(userId, preferences) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    });
  }

  // Conversation Management
  async getOrCreateConversation(userId, sessionId = 'default') {
    return this.prisma.conversation.upsert({
      where: {
        userId_sessionId: {
          userId,
          sessionId
        }
      },
      update: {
        updatedAt: new Date()
      },
      create: {
        userId,
        sessionId
      }
    });
  }

  async addMessage(conversationId, message) {
    return this.prisma.conversationMessage.create({
      data: {
        conversationId,
        role: message.role,
        content: message.content,
        metadata: message.metadata
      }
    });
  }

  async getConversationHistory(userId, sessionId = 'default', limit = 50) {
    const conversation = await this.getOrCreateConversation(userId, sessionId);
    
    return this.prisma.conversationMessage.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    });
  }

  // Email Management
  async scheduleEmail(emailData) {
    return this.prisma.scheduledEmail.create({
      data: emailData
    });
  }

  async getPendingEmails() {
    return this.prisma.scheduledEmail.findMany({
      where: {
        status: 'PENDING',
        sendAt: {
          lte: new Date()
        }
      },
      orderBy: {
        sendAt: 'asc'
      }
    });
  }

  async updateEmailStatus(emailId, status, error) {
    return this.prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status,
        lastError: error,
        sentAt: status === 'SENT' ? new Date() : undefined,
        attempts: {
          increment: 1
        }
      }
    });
  }

  // Voice Session Management
  async createVoiceSession(sessionData) {
    return this.prisma.voiceSession.create({
      data: {
        ...sessionData,
        status: 'RECORDING'
      }
    });
  }

  async updateVoiceSession(sessionId, updates) {
    return this.prisma.voiceSession.update({
      where: { id: sessionId },
      data: updates
    });
  }

  // Calendar Sync Management
  async updateCalendarSync(userId, syncData) {
    return this.prisma.calendarSync.upsert({
      where: { userId },
      update: syncData,
      create: {
        userId,
        ...syncData
      }
    });
  }

  async getCalendarSync(userId) {
    return this.prisma.calendarSync.findUnique({
      where: { userId }
    });
  }

  // Analytics and Reporting
  async getUserStats(userId, timeRange) {
    const [messagesCount, emailsCount, voiceSessionsCount] = await Promise.all([
      this.prisma.conversationMessage.count({
        where: {
          conversation: {
            userId
          },
          timestamp: {
            gte: timeRange.start,
            lte: timeRange.end
          }
        }
      }),
      this.prisma.scheduledEmail.count({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end
          }
        }
      }),
      this.prisma.voiceSession.count({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end
          }
        }
      })
    ]);

    return {
      messagesCount,
      emailsCount,
      voiceSessionsCount,
      period: timeRange
    };
  }

  // Cleanup and Maintenance
  async cleanupOldData(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await Promise.all([
      // Clean up old voice sessions
      this.prisma.voiceSession.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: {
            in: ['COMPLETED', 'FAILED']
          }
        }
      }),
      // Clean up old sent/failed emails
      this.prisma.scheduledEmail.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: {
            in: ['SENT', 'FAILED']
          }
        }
      })
    ]);
  }

  // Close database connection
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = Database;
