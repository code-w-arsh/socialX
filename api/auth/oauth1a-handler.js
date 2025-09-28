// twitter oauth 1.0a handler for media upload authentication
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { connectDB } = require('../utils/db');

// oauth 1.0a signature generation
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

// generate oauth 1.0a authorization header
function generateOAuthHeader(method, url, params, consumerKey, consumerSecret, accessToken = '', accessTokenSecret = '') {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0'
  };
  
  if (accessToken) {
    oauthParams.oauth_token = accessToken;
  }
  
  const allParams = { ...oauthParams, ...params };
  
  // generate signature
  const signature = generateOAuthSignature(method, url, allParams, consumerSecret, accessTokenSecret);
  oauthParams.oauth_signature = signature;
  
  // create authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
  
  return authHeader;
}

module.exports = async (req, res) => {
  try {
    await connectDB();
    
    const { action } = req.query;
    
    if (action === 'request-token') {
      return handleRequestToken(req, res);
    } else if (action === 'callback') {
      return handleCallback(req, res);
    }
    
    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    console.error('OAuth 1.0a handler error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

async function handleRequestToken(req, res) {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    // verify jwt token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const consumerKey = process.env.TWITTER_API_KEY;
    const consumerSecret = process.env.TWITTER_API_SECRET;
    const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;
    const callbackUrl = `${baseUrl}/api/auth/oauth1a-handler?action=callback&userId=${decoded.userId}`;
    
    const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
    const params = {
      oauth_callback: callbackUrl
    };
    
    const authHeader = generateOAuthHeader('POST', requestTokenUrl, params, consumerKey, consumerSecret);
    
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter request token failed:', errorText);
      return res.status(500).json({ error: 'Failed to get request token' });
    }
    
    const responseText = await response.text();
    const tokenData = new URLSearchParams(responseText);
    const oauthToken = tokenData.get('oauth_token');
    const oauthTokenSecret = tokenData.get('oauth_token_secret');
    
    if (!oauthToken || !oauthTokenSecret) {
      return res.status(500).json({ error: 'Invalid token response' });
    }
    
    const authorizeUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;
    
    res.json({ authorizeUrl });
    
  } catch (error) {
    console.error('OAuth 1.0a request token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

async function handleCallback(req, res) {
  try {
    const { oauth_token, oauth_verifier, userId } = req.query;
    
    if (!oauth_token || !oauth_verifier || !userId) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_missing_params`);
    }
    
    const consumerKey = process.env.TWITTER_API_KEY;
    const consumerSecret = process.env.TWITTER_API_SECRET;
    
    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
    const params = {
      oauth_verifier: oauth_verifier
    };
    
    const authHeader = generateOAuthHeader('POST', accessTokenUrl, params, consumerKey, consumerSecret, oauth_token);
    
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter access token failed:', errorText);
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_access_token_failed`);
    }
    
    const responseText = await response.text();
    const tokenData = new URLSearchParams(responseText);
    const accessToken = tokenData.get('oauth_token');
    const accessTokenSecret = tokenData.get('oauth_token_secret');
    const screenName = tokenData.get('screen_name');
    const userIdTwitter = tokenData.get('user_id');
    
    if (!accessToken || !accessTokenSecret) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_invalid_tokens`);
    }
    
    // update user with oauth 1.0a tokens
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=user_not_found`);
    }
    
    if (!user.connectedAccounts || !user.connectedAccounts.twitter) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth2_not_completed`);
    }
    
    // complete the twitter connection with both oauth 2.0 and oauth 1.0a tokens
    user.connectedAccounts.twitter = {
      ...user.connectedAccounts.twitter,
      connected: true,
      oauth1aAccessToken: accessToken,
      oauth1aAccessTokenSecret: accessTokenSecret,
      oauth1aConnectedAt: new Date(),
      needsOAuth1a: false,
      // keep existing oauth 2.0 tokens
      accessToken: user.connectedAccounts.twitter.oauth2AccessToken, // For backward compatibility
      refreshToken: user.connectedAccounts.twitter.oauth2RefreshToken
    };
    
    await user.save();
    
    res.redirect(`${process.env.CLIENT_URL}/dashboard?success=twitter_fully_connected&username=${screenName}`);
    
  } catch (error) {
    console.error('OAuth 1.0a callback error:', error);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_server_error`);
  }
}
