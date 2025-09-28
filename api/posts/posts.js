const { connectDB } = require('../utils/db');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Post = require('../../models/Post');

// consolidated posts handler for scheduling and managing posts
module.exports = async (req, res) => {
  try {
    await connectDB();

    const { action, postId } = req.query;
    console.log('Posts API - Method:', req.method, 'Action:', action, 'PostId:', postId);
    console.log('Posts API - Query params:', req.query);
    console.log('Posts API - Headers:', req.headers.authorization ? 'Token present' : 'No token');
    
    if (req.method === 'GET') {
      if (action === 'scheduled') {
        return getScheduledPosts(req, res);
      } else if (action === 'analytics') {
        return getAnalytics(req, res);
      } else if (postId) {
        return getPost(req, res, postId);
      }
    } else if (req.method === 'POST') {
      if (action === 'schedule') {
        return schedulePost(req, res);
      }
    } else if (req.method === 'DELETE') {
      if (postId) {
        return deletePost(req, res, postId);
      } else {
        return res.status(400).json({ error: 'Post ID is required for deletion' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Posts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function getScheduledPosts(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const posts = await Post.find({ userId: decoded.userId }).sort({ scheduledTime: 1 });
    
    // ensure consistent date field naming
    const formattedPosts = posts.map(post => ({
      ...post.toObject(),
      scheduledFor: post.scheduledTime // Add scheduledFor field for frontend compatibility
    }));
    
    return res.status(200).json({ posts: formattedPosts });
  } catch (error) {
    console.error('Get scheduled posts error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function getAnalytics(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalPosts = await Post.countDocuments({ userId: decoded.userId });
    const scheduledPosts = await Post.countDocuments({ 
      userId: decoded.userId, 
      status: 'scheduled' 
    });
    const publishedPosts = await Post.countDocuments({ 
      userId: decoded.userId, 
      status: 'published' 
    });
    const failedPosts = await Post.countDocuments({ 
      userId: decoded.userId, 
      status: 'failed' 
    });

    const connectedPlatforms = Object.values(user.connectedAccounts || {})
      .filter(account => account.connected).length;

    return res.status(200).json({
      analytics: {
        totalPosts,
        scheduledPosts,
        publishedPosts,
        failedPosts,
        connectedPlatforms,
        postsRemaining: Math.max(0, 500 - totalPosts)
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function getPost(req, res, postId) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const post = await Post.findOne({ _id: postId, userId: decoded.userId });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(200).json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function schedulePost(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { content, scheduledTime, platforms, media } = req.body;
    
    console.log('schedulePost - received media:', JSON.stringify(media, null, 2));
    console.log('Media is array:', Array.isArray(media));
    console.log('Media length:', media?.length);

    if (!content || !scheduledTime || !platforms || platforms.length === 0) {
      return res.status(400).json({ 
        error: 'Content, scheduled time, and platforms are required' 
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userPostsCount = await Post.countDocuments({ userId: decoded.userId });
    if (userPostsCount >= 500) {
      return res.status(400).json({ 
        error: 'You have reached the maximum limit of 500 posts' 
      });
    }

    // determine media format to save
    let mediaToSave;
    if (Array.isArray(media) && media.length > 0) {
      mediaToSave = media; // Save array directly
      console.log('Saving media as array:', media.length, 'items');
    } else if (media && media.cloudinaryUrl) {
      mediaToSave = {
        hasMedia: true,
        cloudinaryUrl: media.cloudinaryUrl,
        publicId: media.publicId,
        originalName: media.originalName,
        fileType: media.fileType,
        fileSize: media.fileSize
      };
      console.log('Saving media as single object');
    } else {
      mediaToSave = { hasMedia: false };
      console.log('Saving media as hasMedia: false');
    }

    const post = new Post({
      userId: decoded.userId,
      content,
      scheduledTime: new Date(scheduledTime),
      platforms,
      status: 'scheduled',
      media: mediaToSave,
      createdAt: new Date()
    });

    await post.save();

    user.postsCount = (user.postsCount || 0) + 1;
    await user.save();

    return res.status(201).json({
      message: 'Post scheduled successfully',
      post
    });
  } catch (error) {
    console.error('Schedule post error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deletePost(req, res, postId) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (!postId) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Attempting to delete post:', postId, 'for user:', decoded.userId);
    
    const post = await Post.findOneAndDelete({ _id: postId, userId: decoded.userId });
    
    if (!post) {
      console.log('Post not found:', postId);
      return res.status(404).json({ error: 'Post not found' });
    }

    console.log('Post deleted successfully:', postId);
    
    const user = await User.findById(decoded.userId);
    if (user && user.postsCount > 0) {
      user.postsCount = user.postsCount - 1;
      await user.save();
    }

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
