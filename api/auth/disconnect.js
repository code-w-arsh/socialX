// social account disconnection handler
const { connectDB } = require('../utils/db');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { platform } = req.body;

    if (!platform) {
      return res.status(400).json({ error: 'Platform is required' });
    }

    // find user and disconnect the platform
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // initialize connectedaccounts if it doesn't exist
    if (!user.connectedAccounts) {
      user.connectedAccounts = {};
    }

    // disconnect the platform
    user.connectedAccounts[platform] = {
      connected: false,
      accessToken: null,
      refreshToken: null,
      username: null,
      userId: null,
      connectedAt: null
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: `${platform} account disconnected successfully`
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};
