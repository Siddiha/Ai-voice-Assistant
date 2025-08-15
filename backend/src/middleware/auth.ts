import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    const authService = new AuthService();
    const decoded = authService.verifyJWTToken(token);
    
    // Add userId to request for use in route handlers
    req.userId = decoded.userId;
    
    // Optionally, get full user data
    const User = require('../models/User').default;
    const user = await User.findById(decoded.userId).select('-accessToken -refreshToken');
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const authService = new AuthService();
      const decoded = authService.verifyJWTToken(token);
      req.userId = decoded.userId;
      
      const User = require('../models/User').default;
      const user = await User.findById(decoded.userId).select('-accessToken -refreshToken');
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
