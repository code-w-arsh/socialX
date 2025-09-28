// post model for scheduled social media posts
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  platforms: [{
    type: String,
    enum: ['twitter', 'reddit', 'linkedin'],
    required: true
  }],
  scheduledTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed'],
    default: 'scheduled'
  },
  publishedAt: Date,
  errorMessage: String,
  media: {
    type: mongoose.Schema.Types.Mixed,
    default: { hasMedia: false }
  },
  platformResults: {
    twitter: {
      success: Boolean,
      postId: String,
      error: String
    },
    reddit: {
      success: Boolean,
      postId: String,
      error: String
    },
    linkedin: {
      success: Boolean,
      postId: String,
      error: String
    }
  }
}, {
  timestamps: true
});

// index for faster queries
postSchema.index({ userId: 1, scheduledTime: 1 });
postSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model('Post', postSchema);
