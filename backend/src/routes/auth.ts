import express from 'express';
import { AuthService } from '../services/authService';

const router = express.Router();
const authService = new AuthService();

// Get Google OAuth URL
router.get('/google', async (req, res) => {
  try {
    const authUrl = authService.generateAuthUrl();
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate auth URL'
    });
  }
});

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    // Exchange code for tokens
    const tokens = await authService.getTokensFromCode(code);
    
    // Get user profile
    const userProfile = await authService.getUserProfile(tokens.access_token!);
    
    // Save user to database
    const user = await authService.saveUser(userProfile, tokens);
    
    // Generate JWT token
    const jwtToken = authService.generateJWTToken(user._id.toString());
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture
      },
      token: jwtToken
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Verify token and get user info
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = authService.verifyJWTToken(token);
    const User = require('../models/User').default;
    const user = await User.findById(decoded.userId).select('-accessToken -refreshToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

// Logout (client-side should remove token)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = authService.verifyJWTToken(token);
    await authService.getValidAccessToken(decoded.userId);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

export default router;
