import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';

export class AuthService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  // Generate Google OAuth URL
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  // Get user profile from Google
  async getUserProfile(accessToken: string) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      
      return {
        googleId: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (error) {
      throw new Error('Failed to get user profile');
    }
  }

  // Save or update user in database
  async saveUser(userProfile: any, tokens: any) {
    try {
      let user = await User.findOne({ googleId: userProfile.googleId });
      
      if (user) {
        // Update existing user
        user.accessToken = tokens.access_token;
        user.refreshToken = tokens.refresh_token || user.refreshToken;
        user.tokenExpiry = new Date(tokens.expiry_date);
        user.lastLogin = new Date();
      } else {
        // Create new user
        user = new User({
          googleId: userProfile.googleId,
          email: userProfile.email,
          name: userProfile.name,
          picture: userProfile.picture,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: new Date(tokens.expiry_date),
          createdAt: new Date(),
          lastLogin: new Date()
        });
      }
      
      await user.save();
      return user;
    } catch (error) {
      throw new Error('Failed to save user');
    }
  }

  // Generate JWT token
  generateJWTToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
  }

  // Verify JWT token
  verifyJWTToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Refresh Google access token
  async refreshAccessToken(refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      throw new Error('Failed to refresh access token');
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(userId: string): Promise<string> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if token is still valid (expires in 5 minutes)
      const now = new Date();
      const expiryTime = new Date(user.tokenExpiry);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiryTime > fiveMinutesFromNow) {
        return user.accessToken;
      }

      // Refresh token
      if (!user.refreshToken) {
        throw new Error('No refresh token available');
      }

      const newTokens = await this.refreshAccessToken(user.refreshToken);
      
      // Update user with new tokens
      user.accessToken = newTokens.access_token!;
      if (newTokens.refresh_token) {
        user.refreshToken = newTokens.refresh_token;
      }
      user.tokenExpiry = new Date(newTokens.expiry_date!);
      await user.save();

      return user.accessToken;
    } catch (error) {
      throw new Error('Failed to get valid access token');
    }
  }

  // Create authenticated Google client for a user
  async createAuthenticatedClient(userId: string) {
    const accessToken = await this.getValidAccessToken(userId);
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    client.setCredentials({ access_token: accessToken });
    return client;
  }
}
