import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: Date;
  createdAt: Date;
  lastLogin: Date;
  preferences?: {
    timezone: string;
    defaultEventDuration: number;
    emailSignature: string;
    voiceLanguage: string;
  };
}

const UserSchema: Schema = new Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  tokenExpiry: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  preferences: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    defaultEventDuration: {
      type: Number,
      default: 60 // minutes
    },
    emailSignature: {
      type: String,
      default: ''
    },
    voiceLanguage: {
      type: String,
      default: 'en-US'
    }
  }
});

// Index for faster queries
UserSchema.index({ googleId: 1 });
UserSchema.index({ email: 1 });

export default mongoose.model<IUser>('User', UserSchema);
