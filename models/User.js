// user model for socialx authentication and account management
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  connectedAccounts: {
    twitter: {
      connected: { type: Boolean, default: false },
      userId: String,
      username: String,
      accessToken: String,
      refreshToken: String,
      connectedAt: Date,
      // oauth 2.0 tokens
      oauth2AccessToken: String,
      oauth2RefreshToken: String,
      oauth2ConnectedAt: Date,
      // oauth 1.0a tokens
      oauth1aAccessToken: String,
      oauth1aAccessTokenSecret: String,
      oauth1aConnectedAt: Date,
      needsOAuth1a: { type: Boolean, default: false }
    },
    reddit: {
      connected: { type: Boolean, default: false },
      userId: String,
      username: String,
      accessToken: String,
      refreshToken: String,
      connectedAt: Date
    },
    linkedin: {
      connected: { type: Boolean, default: false },
      userId: String,
      username: String,
      accessToken: String,
      refreshToken: String,
      connectedAt: Date
    }
  },
  postsCount: {
    type: Number,
    default: 0,
    max: 500
  }
}, {
  timestamps: true
});

// index for faster queries
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);
