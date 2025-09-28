const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { connectDB } = require('../utils/db');

// consolidated oauth handler for all platforms
module.exports = async (req, res) => {
  try {
    await connectDB();

    const { platform } = req.query;
    
    if (req.method === 'GET') {
      // handle oauth initiation and callbacks
      if (platform === 'twitter') {
        return handleTwitterOAuth(req, res);
      } else if (platform === 'reddit') {
        return handleRedditOAuth(req, res);
      } else if (platform === 'linkedin') {
        return handleLinkedInOAuth(req, res);
      }
    }

    return res.status(404).json({ error: 'Platform not supported' });
  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleTwitterOAuth(req, res) {
  const { code, state, error, token } = req.query;

  if (error) {
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth_denied`);
  }

  if (code) {
    // handle twitter callback
    try {
      const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;
      const redirectUri = `${baseUrl}/api/auth/oauth?platform=twitter`;
      // extract code verifier from state token
      const stateData = jwt.verify(state, process.env.JWT_SECRET);
      const codeVerifier = stateData.codeVerifier;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Twitter token exchange failed:', tokenResponse.status, errorText);
        return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json();
      
      // get user info
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('Twitter user info fetch failed:', userResponse.status, errorText);
        return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=user_info_failed`);
      }

      const twitterUser = await userResponse.json();
      
      // update user in database
      if (state) {
        try {
          const decoded = jwt.verify(state, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);
        
        if (user) {
          user.connectedAccounts = user.connectedAccounts || {};
          user.connectedAccounts.twitter = {
            connected: false, // Will be true only after OAuth 1.0a is also complete
            userId: twitterUser.data.id,
            username: twitterUser.data.username,
            oauth2AccessToken: tokenData.access_token,
            oauth2RefreshToken: tokenData.refresh_token,
            oauth2ConnectedAt: new Date(),
            needsOAuth1a: true,
            // store oauth 2.0 token as accesstoken for posting (fallback)
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token
          };
          
          await user.save();
          
          // instead of redirecting to dashboard, directly initiate oauth 1.0a
          console.log('OAuth 2.0 completed, automatically initiating OAuth 1.0a...');
          
          // generate oauth 1.0a request token and redirect to twitter authorization
          try {
            const consumerKey = process.env.TWITTER_API_KEY;
            const consumerSecret = process.env.TWITTER_API_SECRET;
            const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;
            const callbackUrl = `${baseUrl}/api/auth/oauth1a-handler?action=callback&userId=${decoded.userId}`;
            
            const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
            const params = {
              oauth_callback: callbackUrl
            };
            
            // generate oauth 1.0a header
            const oauthParams = {
              oauth_consumer_key: consumerKey,
              oauth_nonce: crypto.randomBytes(16).toString('hex'),
              oauth_signature_method: 'HMAC-SHA1',
              oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
              oauth_version: '1.0'
            };
            
            const allParams = { ...oauthParams, ...params };
            
            // generate signature
            const sortedParams = Object.keys(allParams)
              .sort()
              .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
              .join('&');
            
            const baseString = `POST&${encodeURIComponent(requestTokenUrl)}&${encodeURIComponent(sortedParams)}`;
            const signingKey = `${encodeURIComponent(consumerSecret)}&`;
            
            const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
            oauthParams.oauth_signature = signature;
            
            const authHeader = 'OAuth ' + Object.keys(oauthParams)
              .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
              .join(', ');
            
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
              console.error('OAuth 1.0a request token failed:', errorText);
              return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_request_failed&username=${twitterUser.data.username}`);
            }
            
            const responseText = await response.text();
            const tokenData = new URLSearchParams(responseText);
            const oauthToken = tokenData.get('oauth_token');
            
            if (!oauthToken) {
              return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_token_invalid&username=${twitterUser.data.username}`);
            }
            
            // redirect directly to twitter oauth 1.0a authorization
            const authorizeUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;
            console.log('Redirecting to OAuth 1.0a authorization:', authorizeUrl);
            return res.redirect(authorizeUrl);
            
          } catch (oauth1aError) {
            console.error('OAuth 1.0a initiation failed:', oauth1aError);
            return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=oauth1a_initiation_failed&username=${twitterUser.data.username}`);
          }
        } else {
          return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=user_not_found`);
        }
        } catch (jwtError) {
          console.error('JWT verification failed:', jwtError);
          return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=invalid_state`);
        }
      } else {
        return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=missing_state`);
      }
    } catch (error) {
      console.error('Twitter OAuth callback error:', error);
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=server_error`);
    }
  } else if (token) {
    // handle twitter oauth initiation
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const clientId = process.env.TWITTER_CLIENT_ID;
      const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;
      const redirectUri = `${baseUrl}/api/auth/oauth?platform=twitter`;
      // generate random code verifier for security
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      
      // create new state token with code verifier
      const stateToken = jwt.sign(
        { userId: decoded.userId, codeVerifier: codeVerifier },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      
      const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
      authUrl.searchParams.set('state', stateToken);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      return res.redirect(authUrl.toString());
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
}

async function handleRedditOAuth(req, res) {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('Reddit OAuth error:', error);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=reddit_auth_failed&details=${encodeURIComponent(error)}`);
  }

  if (!code) {
    // initiate oauth flow
    try {
      // check for token in query params first, then headers
      const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const state = Buffer.from(JSON.stringify({ userId: decoded.userId })).toString('base64');

      const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
      authUrl.searchParams.set('client_id', process.env.REDDIT_CLIENT_ID);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;
      authUrl.searchParams.set('redirect_uri', `${baseUrl}/api/auth/oauth?platform=reddit`);
      authUrl.searchParams.set('duration', 'permanent');
      authUrl.searchParams.set('scope', 'identity submit');

      return res.redirect(authUrl.toString());
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // handle callback
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = stateData.userId;

    // define baseurl for callback
    const baseUrl = process.env.SERVER_URL.endsWith('/') ? process.env.SERVER_URL.slice(0, -1) : process.env.SERVER_URL;

    // exchange code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
        'User-Agent': 'SocialX/1.0'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${baseUrl}/api/auth/oauth?platform=reddit`
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Reddit token exchange failed:', tokenData);
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=reddit_token_failed`);
    }

    // get user info
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'SocialX/1.0'
      }
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('Reddit user info failed:', userData);
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=reddit_user_failed`);
    }

    // update user in database
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=user_not_found`);
    }

    user.connectedAccounts.reddit = {
      connected: true,
      userId: userData.id,
      username: userData.name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      connectedAt: new Date()
    };

    await user.save();

    return res.redirect(`${process.env.CLIENT_URL}/dashboard?success=reddit_connected`);
  } catch (error) {
    console.error('Reddit OAuth callback error:', error);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=reddit_callback_failed`);
  }
}

async function handleLinkedInOAuth(req, res) {
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('LinkedIn OAuth error:', error);
    console.error('Full query params:', req.query);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=linkedin_auth_failed&details=${encodeURIComponent(error)}`);
  }

  if (!code) {
    // check if this is a callback without code (potential error case)
    // only trigger error if we have oauth-specific params but no code
    if (req.query.state && !req.query.token) {
      console.log('LinkedIn callback without code, query params:', req.query);
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=linkedin_no_code`);
    }
    
    // step 1: redirect to linkedin authorization
    const serverUrl = process.env.SERVER_URL || 'https://socialx.arshfs.tech';
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    const redirectUri = `${baseUrl}/api/auth/oauth/linkedin/callback`;
    
    console.log('LinkedIn OAuth redirect URI:', redirectUri);
    console.log('LinkedIn Client ID:', process.env.LINKEDIN_CLIENT_ID);
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${req.query.token || Date.now()}&` +
      `scope=openid profile email w_member_social`;
    
    return res.redirect(authUrl);
  }

  try {
    // step 2: exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${(process.env.SERVER_URL || 'https://socialx.arshfs.tech').endsWith('/') ? (process.env.SERVER_URL || 'https://socialx.arshfs.tech').slice(0, -1) : (process.env.SERVER_URL || 'https://socialx.arshfs.tech')}/api/auth/oauth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('LinkedIn token exchange failed:', await tokenResponse.text());
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=linkedin_token_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // step 3: get user profile
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('LinkedIn profile fetch failed:', await profileResponse.text());
      return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=linkedin_profile_failed`);
    }

    const profileData = await profileResponse.json();

    // step 4: update user in database
    // try to get token from state parameter or cookies
    let token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    // if token is in state parameter (passed from frontend)
    if (!token && state && state !== Date.now().toString()) {
      token = state;
    }
    
    if (!token) {
      console.error('No token found in LinkedIn OAuth callback');
      return res.redirect(`${process.env.CLIENT_URL}/auth?error=no_session`);
    }

    let decoded, user;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      console.error('Token received:', token);
      return res.redirect(`${process.env.CLIENT_URL}/auth?error=invalid_session`);
    }

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/auth?error=user_not_found`);
    }

    // update user with linkedin connection
    user.connectedAccounts.linkedin = {
      connected: true,
      userId: profileData.sub,
      username: profileData.name,
      email: profileData.email,
      accessToken: access_token,
      connectedAt: new Date()
    };

    await user.save();

    console.log('LinkedIn connected successfully for user:', user.email);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?success=linkedin_connected`);

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?error=linkedin_connection_failed`);
  }
}
