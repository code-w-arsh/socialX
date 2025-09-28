// user profile retrieval with jwt authentication
const jwt = require('jsonwebtoken');
const { connectDB } = require('../utils/db');
const User = require('../../models/User');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    await connectDB();

    // get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'no token provided' });
    }

    const token = authHeader.substring(7);

    // verify jwt token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // find user by id
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    // return user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      connectedAccounts: user.connectedAccounts || {
        twitter: { connected: false },
        reddit: { connected: false },
        linkedin: { connected: false }
      },
      postsCount: user.postsCount || 0,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('get profile error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token expired' });
    }

    res.status(500).json({ 
      error: 'internal server error' 
    });
  }
};
