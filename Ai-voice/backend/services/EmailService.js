const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class Email {
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.transporter = null;
  }

  // Set user credentials for Gmail API
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
    this.setupTransporter();
  }

  // Setup nodemailer transporter with OAuth2
  async setupTransporter() {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();
      
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: this.oauth2Client.credentials.refresh_token,
          accessToken: accessToken.token,
        },
      });
    } catch (error) {
      console.error('Error setting up email transporter:', error);
      throw new Error('Failed to setup email service');
    }
  }

  // Send email using Gmail API
  async sendEmail(options) {
    try {
      if (!this.transporter) {
        await this.setupTransporter();
      }

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc,
        bcc: Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        messageId: result.messageId,
        success: true
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  // Send meeting invitation email
  async sendMeetingInvitation(attendees, meetingDetails) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007AFF; padding-bottom: 10px;">
          Meeting Invitation: ${meetingDetails.title}
        </h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007AFF; margin-top: 0;">Meeting Details</h3>
          <p><strong>📅 Date:</strong> ${meetingDetails.date}</p>
          <p><strong>🕐 Time:</strong> ${meetingDetails.time}</p>
          <p><strong>⏱️ Duration:</strong> ${meetingDetails.duration}</p>
          ${meetingDetails.location ? `<p><strong>📍 Location:</strong> ${meetingDetails.location}</p>` : ''}
          <p><strong>👤 Organizer:</strong> ${meetingDetails.organizer}</p>
        </div>
        ${meetingDetails.description ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Description</h3>
            <p style="line-height: 1.6;">${meetingDetails.description}</p>
          </div>
        ` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #666;">Best regards,<br/>Your AI Calendar Assistant</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: attendees,
      subject: `Meeting Invitation: ${meetingDetails.title} - ${meetingDetails.date} at ${meetingDetails.time}`,
      html: htmlContent
    });
  }

  // Validate email addresses
  validateEmailAddresses(emails) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = [];
    const invalid = [];

    emails.forEach(email => {
      if (emailRegex.test(email.trim())) {
        valid.push(email.trim());
      } else {
        invalid.push(email.trim());
      }
    });

    return { valid, invalid };
  }

  // Extract email addresses from text
  extractEmailAddresses(text) {
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
    return text.match(emailRegex) || [];
  }
}

module.exports = Email;
