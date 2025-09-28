const { connectDB } = require('../utils/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

// consolidated auth handler for login and signup
module.exports = async (req, res) => {
  try {
    await connectDB();

    const { action } = req.query;
    
    if (req.method === 'POST') {
      if (action === 'login') {
        return handleLogin(req, res);
      } else if (action === 'signup') {
        return handleSignup(req, res);
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name,
      connectedAccounts: user.connectedAccounts || {
        twitter: { connected: false },
        reddit: { connected: false },
        linkedin: { connected: false }
      },
      postsCount: user.postsCount || 0,
      createdAt: user.createdAt
    };

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleSignup(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      connectedAccounts: {
        twitter: { connected: false },
        reddit: { connected: false },
        linkedin: { connected: false }
      },
      postsCount: 0
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name,
      connectedAccounts: user.connectedAccounts,
      postsCount: user.postsCount,
      createdAt: user.createdAt
    };

    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
