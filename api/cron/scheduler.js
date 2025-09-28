const cron = require('node-cron');
const { connectDB } = require('../utils/db');
const User = require('../../models/User');
const Post = require('../../models/Post');
const crypto = require('crypto');

// oauth 1.0a signature generation for twitter v1.1 api
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  // create parameter string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // create signature base string
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  // create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // generate signature
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  
  return signature;
}

// generate oauth 1.0a authorization header
function generateOAuthHeader(method, url, params, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0'
  };
  
  // combine oauth params with request params for signature
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

// function to upload media to twitter using OAuth 1.0a with chunked upload for GIFs
async function uploadMediaToTwitterV1(imageUrl, appAccessToken, appAccessTokenSecret) {
  try {
    console.log('uploading media to twitter v1.1 with OAuth 1.0a...');
    
    // download media from cloudinary
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch media: ${imageResponse.status}`);
    }
    const mediaBuffer = await imageResponse.arrayBuffer();
    
    // detect media type
    const isGif = imageUrl.toLowerCase().includes('.gif');
    const mediaType = isGif ? 'image/gif' : 'image/jpeg';
    const mediaCategory = isGif ? 'tweet_gif' : 'tweet_image';
    
    // oauth 1.0a credentials
    const consumerKey = process.env.TWITTER_API_KEY;
    const consumerSecret = process.env.TWITTER_API_SECRET;
    
    if (!consumerKey || !consumerSecret) {
      throw new Error('Missing Twitter OAuth 1.0a app credentials');
    }
    
    if (isGif) {
      // use chunked upload for gifs
      return await uploadGifChunked(mediaBuffer, mediaType, mediaCategory, consumerKey, consumerSecret, appAccessToken, appAccessTokenSecret);
    } else {
      // use simple upload for images
      return await uploadImageSimple(mediaBuffer, mediaCategory, consumerKey, consumerSecret, appAccessToken, appAccessTokenSecret);
    }
  } catch (error) {
    console.error('Error uploading media to Twitter:', error.message);
    throw error;
  }
}

// simple upload for images
async function uploadImageSimple(mediaBuffer, mediaCategory, consumerKey, consumerSecret, appAccessToken, appAccessTokenSecret) {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');
  
  const bodyParams = {
    media_data: mediaBase64,
    media_category: mediaCategory
  };
  
  const authHeader = generateOAuthHeader(
    'POST', 
    uploadUrl, 
    bodyParams,
    consumerKey, 
    consumerSecret, 
    appAccessToken, 
    appAccessTokenSecret
  );
  
  const body = new URLSearchParams(bodyParams).toString();
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('Twitter media upload failed:', errorText);
    throw new Error(`Twitter media upload failed: ${uploadResponse.status}`);
  }

  const uploadResult = await uploadResponse.json();
  console.log('twitter media uploaded, media_id:', uploadResult.media_id_string);
  return uploadResult.media_id_string;
}

// chunked upload for gifs
async function uploadGifChunked(mediaBuffer, mediaType, mediaCategory, consumerKey, consumerSecret, appAccessToken, appAccessTokenSecret) {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const totalBytes = mediaBuffer.byteLength;
  
  // step 1: init
  console.log('GIF chunked upload - INIT phase');
  const initParams = {
    command: 'INIT',
    media_type: mediaType,
    total_bytes: totalBytes.toString(),
    media_category: mediaCategory
  };
  
  const initAuthHeader = generateOAuthHeader(
    'POST', 
    uploadUrl, 
    initParams,
    consumerKey, 
    consumerSecret, 
    appAccessToken, 
    appAccessTokenSecret
  );
  
  const initResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': initAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(initParams).toString()
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Twitter INIT failed: ${initResponse.status} - ${errorText}`);
  }

  const initResult = await initResponse.json();
  const mediaId = initResult.media_id_string;
  console.log('GIF chunked upload - INIT successful, media_id:', mediaId);

  // step 2: append
  console.log('GIF chunked upload - APPEND phase');
  
  // for append with url-encoded data, include all parameters in oauth signature
  const appendParams = {
    command: 'APPEND',
    media_id: mediaId,
    segment_index: '0',
    media_data: Buffer.from(mediaBuffer).toString('base64')
  };
  
  const appendAuthHeader = generateOAuthHeader(
    'POST', 
    uploadUrl, 
    appendParams,
    consumerKey, 
    consumerSecret, 
    appAccessToken, 
    appAccessTokenSecret
  );
  
  // create url-encoded body with base64 media for append
  const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');
  const appendBody = new URLSearchParams({
    command: 'APPEND',
    media_id: mediaId,
    segment_index: '0',
    media_data: mediaBase64
  });
  
  const appendResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': appendAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: appendBody.toString()
  });

  if (!appendResponse.ok) {
    const errorText = await appendResponse.text();
    throw new Error(`Twitter APPEND failed: ${appendResponse.status} - ${errorText}`);
  }
  
  console.log('GIF chunked upload - APPEND successful');

  // step 3: finalize
  console.log('GIF chunked upload - FINALIZE phase');
  const finalizeParams = {
    command: 'FINALIZE',
    media_id: mediaId
  };
  
  const finalizeAuthHeader = generateOAuthHeader(
    'POST', 
    uploadUrl, 
    finalizeParams,
    consumerKey, 
    consumerSecret, 
    appAccessToken, 
    appAccessTokenSecret
  );
  
  const finalizeResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': finalizeAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(finalizeParams).toString()
  });

  if (!finalizeResponse.ok) {
    const errorText = await finalizeResponse.text();
    throw new Error(`Twitter FINALIZE failed: ${finalizeResponse.status} - ${errorText}`);
  }

  const finalizeResult = await finalizeResponse.json();
  console.log('GIF chunked upload - FINALIZE result:', finalizeResult);
  
  // step 4: check for processing status
  if (finalizeResult.processing_info) {
    console.log('GIF requires processing - proceeding with async processing');
    console.log('Media uploaded successfully, media_id:', mediaId);
    
    // for gifs that require processing, return the media_id immediately
    // twitter will process it asynchronously and it will be available for tweeting
    // this prevents serverless function timeouts while waiting for processing
    return mediaId;
  }
  
  console.log('GIF chunked upload completed, media_id:', mediaId);
  return mediaId;
}

// wait for gif processing to complete
async function waitForProcessing(mediaId, consumerKey, consumerSecret, appAccessToken, appAccessTokenSecret) {
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  const maxAttempts = 10;
  const delay = 2000; // 2 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const statusParams = {
      command: 'STATUS',
      media_id: mediaId
    };
    
    const statusAuthHeader = generateOAuthHeader(
      'GET', 
      uploadUrl, 
      statusParams,
      consumerKey, 
      consumerSecret, 
      appAccessToken, 
      appAccessTokenSecret
    );
    
    const statusUrl = `${uploadUrl}?${new URLSearchParams(statusParams).toString()}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': statusAuthHeader
      }
    });

    if (!statusResponse.ok) {
      console.error('Status check failed:', statusResponse.status);
      continue;
    }

    const statusResult = await statusResponse.json();
    console.log('GIF processing status:', statusResult.processing_info?.state);
    console.log('Full status result:', JSON.stringify(statusResult, null, 2));
    
    if (statusResult.processing_info?.state === 'succeeded') {
      console.log('GIF processing completed successfully');
      return mediaId;
    } else if (statusResult.processing_info?.state === 'failed') {
      throw new Error('GIF processing failed on Twitter servers');
    }
    
    // wait for the recommended time from twitter if provided
    const checkAfter = statusResult.processing_info?.check_after_secs || 2;
    console.log(`Waiting ${checkAfter} seconds before next status check...`);
    await new Promise(resolve => setTimeout(resolve, checkAfter * 1000));
  }
  
  throw new Error('GIF processing timeout - exceeded maximum wait time');
}

// function to post to twitter
async function postToTwitter(content, accessToken, media = null, userAccount = null) {
  try {
    console.log('posting to twitter:', content);
    console.log('media present:', !!media);
    console.log('user account:', userAccount ? 'provided' : 'missing');
    
    let tweetData = {
      text: content
    };
    
    // handle media upload using user's oauth 1.0a tokens
    if (media && (media.hasMedia || (Array.isArray(media) && media.length > 0))) {
      console.log('Media detected - attempting upload with user OAuth 1.0a tokens');
      
      // check if user has oauth 1.0a tokens
      if (userAccount && userAccount.oauth1aAccessToken && userAccount.oauth1aAccessTokenSecret) {
        try {
          const mediaArray = Array.isArray(media) ? media : [media];
          const mediaIds = [];
          
          for (const mediaItem of mediaArray) {
            const imageUrl = mediaItem.cloudinaryUrl || mediaItem.url;
            if (imageUrl) {
              console.log('Uploading media with user OAuth 1.0a tokens:', imageUrl);
              const mediaId = await uploadMediaToTwitterV1(
                imageUrl,
                userAccount.oauth1aAccessToken,
                userAccount.oauth1aAccessTokenSecret
              );
              if (mediaId) {
                mediaIds.push(mediaId);
              }
            }
          }
          
          if (mediaIds.length > 0) {
            tweetData.media = {
              media_ids: mediaIds
            };
            console.log('Media uploaded successfully, media IDs:', mediaIds);
          } else {
            console.log('No media IDs returned, posting text-only tweet');
          }
        } catch (mediaError) {
          console.error('Media upload failed:', mediaError.message);
          console.log('Falling back to text-only tweet');
        }
      } else {
        console.log('User OAuth 1.0a tokens not available - posting text-only tweet');
        console.log('User needs to complete dual OAuth flow for media upload support');
      }
    }
    
    if (!accessToken) {
      throw new Error('No access token provided');
    }
    
    // use twitter v2 api to post tweet with media
    console.log('posting tweet with data:', JSON.stringify(tweetData, null, 2));
    
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData)
    });

    console.log('Twitter API response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Twitter API error response:', errorData);
      
      // try to parse error as json for better debugging
      try {
        const errorJson = JSON.parse(errorData);
        console.error('Parsed error:', errorJson);
      } catch (parseError) {
        console.error('Could not parse error as JSON');
      }
      
      throw new Error(`Twitter API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Tweet posted successfully:', JSON.stringify(data, null, 2));
    
    return {
      success: true,
      postId: data.data?.id || 'unknown',
      sentAt: new Date()
    };
  } catch (error) {
    console.error('=== TWITTER POST ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message,
      sentAt: new Date()
    };
  }
}

// function to upload media for gallery posts and return media_id
async function uploadMediaForGallery(imageUrl, accessToken) {
  try {
    // step 1: get upload lease from reddit media asset api
    const leaseResponse = await fetch('https://oauth.reddit.com/api/media/asset.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialX/1.0'
      },
      body: new URLSearchParams({
        filepath: 'image.jpg',
        mimetype: 'image/jpeg'
      })
    });

    if (!leaseResponse.ok) {
      throw new Error(`Failed to get gallery upload lease: ${leaseResponse.status}`);
    }

    const leaseData = await leaseResponse.json();
    const uploadLease = leaseData.args;
    const mediaId = leaseData.asset.asset_id;

    // step 2: download image from cloudinary
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // step 3: upload image to reddit's aws
    const formData = new FormData();
    
    // add all the fields from the lease
    uploadLease.fields.forEach(field => {
      formData.append(field.name, field.value);
    });
    
    // add the file
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }));

    const uploadResponse = await fetch(`https:${uploadLease.action}`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload gallery image: ${uploadResponse.status}`);
    }

    console.log('gallery media upload successful, media_id:', mediaId);
    return mediaId;

  } catch (error) {
    console.error('Gallery media upload error:', error);
    throw error;
  }
}

// function to upload image to reddit media asset API and return both asset_id and reddit URL
async function uploadImageToRedditAsset(imageUrl, accessToken) {
  try {
    // step 1: get upload lease from reddit media asset api
    const leaseResponse = await fetch('https://oauth.reddit.com/api/media/asset.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialX/1.0'
      },
      body: new URLSearchParams({
        filepath: 'image.jpg',
        mimetype: 'image/jpeg'
      })
    });

    if (!leaseResponse.ok) {
      throw new Error(`Failed to get asset upload lease: ${leaseResponse.status}`);
    }

    const leaseData = await leaseResponse.json();
    const uploadLease = leaseData.args;
    const assetId = leaseData.asset.asset_id;

    // step 2: download image from cloudinary
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // step 3: upload image to reddit's aws
    const formData = new FormData();
    
    // add all the fields from the lease
    uploadLease.fields.forEach(field => {
      formData.append(field.name, field.value);
    });
    
    // add the file
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }));

    const uploadResponse = await fetch(`https:${uploadLease.action}`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.status}`);
    }

    // get the uploaded image key/path
    const uploadKey = uploadLease.fields.find(f => f.name === 'key')?.value;
    const redditImageUrl = `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${uploadKey}`;

    return {
      assetId: assetId,
      imageUrl: redditImageUrl
    };

  } catch (error) {
    console.error('Reddit asset upload error:', error);
    throw error;
  }
}

// function to upload image to reddit's servers (legacy method for single image posts)
async function uploadImageToReddit(imageUrl, accessToken) {
  try {
    // step 1: get upload lease from reddit
    const leaseResponse = await fetch('https://oauth.reddit.com/api/media/asset.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialX/1.0'
      },
      body: new URLSearchParams({
        filepath: 'image.jpg',
        mimetype: 'image/jpeg'
      })
    });

    if (!leaseResponse.ok) {
      throw new Error(`Failed to get upload lease: ${leaseResponse.status}`);
    }

    const leaseData = await leaseResponse.json();
    const uploadLease = leaseData.args;

    // step 2: download image from cloudinary
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // step 3: upload image to reddit's aws
    const formData = new FormData();
    
    // add all the fields from the lease
    uploadLease.fields.forEach(field => {
      formData.append(field.name, field.value);
    });
    
    // add the file
    formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }));

    const uploadResponse = await fetch(`https:${uploadLease.action}`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.status}`);
    }

    // return the reddit image url
    const uploadKey = uploadLease.fields.find(f => f.name === 'key')?.value;
    return `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${uploadKey}`;

  } catch (error) {
    console.error('Reddit image upload error:', error);
    throw error;
  }
}

// function to post to reddit
async function postToReddit(content, accessToken, media = null, userAccount = null, customSubreddit = null) {
  try {
    console.log('posting to reddit:', content);
    console.log('media object:', JSON.stringify(media, null, 2));
    console.log('media present:', !!(media && (media.hasMedia || (Array.isArray(media) && media.length > 0))));
    console.log('custom subreddit:', customSubreddit);
    
    // reddit requires posting to a specific subreddit
    // user profile posting (u/username) is not supported by reddit api
    // use custom subreddit or default to 'test'
    const subreddit = customSubreddit && customSubreddit.trim() ? customSubreddit.trim() : 'test';
    
    let postData;
    
    if (media && (media.hasMedia || (Array.isArray(media) && media.length > 0))) {
      // upload images to reddit first
      console.log('uploading images to reddit servers...');
      
      if (Array.isArray(media) && media.length > 1) {
        // multiple images - use reddit's gallery submission endpoint
        console.log('Multiple images detected, creating gallery post using /api/submit_gallery_post');
        
        // upload all images and get media_ids
        const galleryItems = [];
        for (const mediaItem of media) {
          const mediaId = await uploadMediaForGallery(mediaItem.cloudinaryUrl, accessToken);
          galleryItems.push({
            caption: '',
            outbound_url: '',
            media_id: mediaId
          });
          console.log('uploaded media_id for gallery:', mediaId);
        }
        
        // use reddit's gallery submission endpoint
        postData = {
          api_type: 'json',
          items: galleryItems,
          nsfw: false,
          sendreplies: true,
          show_error_list: true,
          spoiler: false,
          sr: subreddit,
          title: content.substring(0, 300),
          kind: 'gallery'  // Explicitly set kind for gallery posts
        };

        const response = await fetch('https://oauth.reddit.com/api/submit_gallery_post', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SocialX/1.0'
          },
          body: JSON.stringify(postData)
        });

        if (!response.ok) {
          throw new Error(`Reddit gallery post failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Reddit gallery post result:', result);

        // check for reddit api errors
        if (result.json?.errors && result.json.errors.length > 0) {
          console.error('Reddit API errors:', JSON.stringify(result.json.errors, null, 2));
          throw new Error(`Reddit API error: ${JSON.stringify(result.json.errors)}`);
        }

        // check if post was successful
        if (!result.json?.data?.id) {
          console.error('No post ID returned, full result:', JSON.stringify(result, null, 2));
          throw new Error('Reddit post failed - no post ID returned');
        }

        return {
          success: true,
          postId: result.json.data.id,
          url: result.json.data.url || '',
          sentAt: new Date()
        };
      } else if (Array.isArray(media) && media.length === 1) {
        // single image - use image link post with reddit's uploaded image url
        console.log('Single image detected, creating image link post');
        
        const uploadResult = await uploadImageToRedditAsset(media[0].cloudinaryUrl, accessToken);
        console.log('uploaded asset for single image, using imageUrl:', uploadResult.imageUrl);
        
        postData = {
          api_type: 'json',
          kind: 'image',
          sr: subreddit,
          title: content.substring(0, 300),
          url: uploadResult.imageUrl
        };

        const response = await fetch('https://oauth.reddit.com/api/submit', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SocialX/1.0'
          },
          body: new URLSearchParams(postData)
        });

        if (!response.ok) {
          throw new Error(`Reddit single image post failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Reddit single image post result:', result);

        // check for reddit api errors
        if (result.json?.errors && result.json.errors.length > 0) {
          console.error('Reddit API errors:', JSON.stringify(result.json.errors, null, 2));
          throw new Error(`Reddit API error: ${JSON.stringify(result.json.errors)}`);
        }

        // check if post was successful - image posts have different response format
        const postId = result.json?.data?.id || result.json?.data?.name || 'unknown';
        const postUrl = result.json?.data?.url || result.json?.data?.user_submitted_page || '';
        
        // for image posts, reddit returns user_submitted_page instead of direct post url
        if (!result.json?.data?.id && !result.json?.data?.user_submitted_page) {
          console.error('No post ID or submission page returned, full result:', JSON.stringify(result, null, 2));
          throw new Error('Reddit post failed - no post confirmation returned');
        }

        console.log('Reddit image post successful, postId:', postId, 'url:', postUrl);

        return {
          success: true,
          postId: postId,
          url: postUrl,
          sentAt: new Date()
        };
      } else {
        // text-only post
        postData = {
          api_type: 'json',
          kind: 'self',
          sr: subreddit,
          title: content.substring(0, 300),
          text: content
        };

        const response = await fetch('https://oauth.reddit.com/api/submit', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SocialX/1.0'
          },
          body: new URLSearchParams(postData)
        });

        if (!response.ok) {
          throw new Error(`Reddit post failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Reddit post result:', result);

        return {
          success: true,
          postId: result.json?.data?.id || 'unknown',
          url: result.json?.data?.url || '',
          sentAt: new Date()
        };
      }
    } else {
      // text-only post
      postData = {
        api_type: 'json',
        kind: 'self',
        sr: subreddit,
        title: content.substring(0, 300),
        text: content
      };

      const response = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SocialX/1.0'
        },
        body: new URLSearchParams(postData)
      });

      if (!response.ok) {
        throw new Error(`Reddit post failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Reddit text post result:', result);

      // check for reddit api errors
      if (result.json?.errors && result.json.errors.length > 0) {
        console.error('Reddit API errors:', JSON.stringify(result.json.errors, null, 2));
        throw new Error(`Reddit API error: ${JSON.stringify(result.json.errors)}`);
      }

      // check if post was successful
      if (!result.json?.data?.id) {
        console.error('No post ID returned, full result:', JSON.stringify(result, null, 2));
        throw new Error('Reddit post failed - no post ID returned');
      }

      return {
        success: true,
        postId: result.json.data.id,
        url: result.json.data.url || '',
        sentAt: new Date()
      };
    }
  } catch (error) {
    console.error('Reddit posting error:', error);
    return {
      success: false,
      error: error.message,
      sentAt: new Date()
    };
  }
}

// function to upload image to linkedin's servers
async function uploadImageToLinkedin(imageUrl, accessToken, personUrn) {
  try {
    console.log('uploadImageToLinkedin called with imageUrl:', imageUrl);
    // step 1: register upload with linkedin assets api
    const registerData = {
      registerUploadRequest: {
        owner: personUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [
          {
            identifier: 'urn:li:userGeneratedContent',
            relationshipType: 'OWNER'
          }
        ],
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD']
      }
    };

    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(registerData)
    });

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error('LinkedIn register upload error:', errorText);
      throw new Error(`Failed to register LinkedIn upload: ${registerResponse.status} - ${errorText}`);
    }

    const registerResult = await registerResponse.json();
    console.log('LinkedIn register response:', JSON.stringify(registerResult, null, 2));
    
    const uploadMechanism = registerResult.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
    const uploadUrl = uploadMechanism.uploadUrl;
    const uploadHeaders = uploadMechanism.headers || {};
    
    console.log('Upload URL:', uploadUrl);
    console.log('Upload Headers:', uploadHeaders);
    
    if (!uploadUrl) {
      throw new Error('No upload URL received from LinkedIn');
    }
    const assetUrn = registerResult.value.asset;

    // step 2: download image from cloudinary
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // step 3: upload image to linkedin using put with proper headers
    const uploadRequestHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
      ...uploadHeaders // Include any headers from the registration response
    };

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: uploadRequestHeaders,
      body: imageBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image to LinkedIn: ${uploadResponse.status}`);
    }

    return assetUrn;

  } catch (error) {
    console.error('LinkedIn image upload error:', error);
    throw error;
  }
}

// function to post to linkedin
async function postToLinkedin(content, accessToken, media = null) {
  try {
    console.log('posting to linkedin:', content);
    console.log('media present:', !!media);
    console.log('media object from database:', JSON.stringify(media, null, 2));
    
    // get user profile id first
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get LinkedIn profile');
    }

    const profileData = await profileResponse.json();
    const personUrn = `urn:li:person:${profileData.sub}`;

    let shareData;

    if (media && (media.hasMedia || (Array.isArray(media) && media.length > 0))) {
      // upload images to linkedin first
      console.log('uploading images to linkedin servers...');
      
      let assetUrns = [];
      
      if (Array.isArray(media)) {
        // handle multiple images (up to 4 for consistency)
        const imagesToUpload = media.slice(0, 4); // Limit to 4 images for consistency
        console.log('LinkedIn media array:', JSON.stringify(imagesToUpload, null, 2));
        
        for (const mediaItem of imagesToUpload) {
          console.log('Processing media item:', JSON.stringify(mediaItem, null, 2));
          const imageUrl = mediaItem.cloudinaryUrl || mediaItem.url;
          console.log('Extracted imageUrl:', imageUrl);
          const assetUrn = await uploadImageToLinkedin(imageUrl, accessToken, personUrn);
          assetUrns.push(assetUrn);
        }
      } else {
        // handle single image (old format)
        console.log('LinkedIn single media:', JSON.stringify(media, null, 2));
        const imageUrl = media.cloudinaryUrl || media.url;
        console.log('Single image URL:', imageUrl);
        const assetUrn = await uploadImageToLinkedin(imageUrl, accessToken, personUrn);
        assetUrns.push(assetUrn);
      }
      
      console.log('linkedin asset urns:', assetUrns);

      // create post with images
      shareData = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: 'IMAGE',
            media: assetUrns.map((assetUrn, index) => ({
              status: 'READY',
              description: {
                text: content.substring(0, 200) // LinkedIn description limit
              },
              media: assetUrn,
              title: {
                text: `Shared Image ${index + 1}`
              }
            }))
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    } else {
      // text-only post
      shareData = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    }

    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(shareData)
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('LinkedIn post failed:', errorText);
      throw new Error(`LinkedIn API error: ${postResponse.status}`);
    }

    const postResult = await postResponse.json();
    
    return {
      success: true,
      postId: postResult.id || 'linkedin_' + Date.now(),
      sentAt: new Date()
    };
  } catch (error) {
    console.error('LinkedIn posting error:', error);
    return {
      success: false,
      error: error.message,
      sentAt: new Date()
    };
  }
}

// function to process scheduled posts with timeout handling
async function processScheduledPosts() {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 8000; // 8 seconds max
  
  try {
    console.log('Connecting to database...');
    
    // add timeout to database connection
    const dbPromise = connectDB();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 3000)
    );
    
    await Promise.race([dbPromise, timeoutPromise]);
    console.log('Database connected successfully');
    
    // find posts that are due to be sent (within the last 5 minutes to catch missed posts)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const duePosts = await Post.find({
      status: 'scheduled',
      scheduledTime: { $lte: now, $gte: fiveMinutesAgo }
    }).populate('userId').limit(5); // Limit to 5 posts per execution

    console.log(`Found ${duePosts.length} posts to process`);

    if (duePosts.length === 0) {
      return { processed: 0, message: 'No posts to process' };
    }

    let processedCount = 0;

    // process posts with time limit
    for (const post of duePosts) {
      // check if we're running out of time
      if (Date.now() - startTime > MAX_EXECUTION_TIME - 2000) {
        console.log('Approaching time limit, stopping processing');
        break;
      }

      try {
        const user = post.userId;
        const results = [];
        let hasSuccess = false;

        // process platforms in parallel for faster execution
        const platformPromises = post.platforms.map(async (platform) => {
          console.log(`=== PROCESSING PLATFORM: ${platform} ===`);
          console.log('User ID:', user._id);
          console.log('User connected accounts:', JSON.stringify(user.connectedAccounts, null, 2));
          
          const account = user.connectedAccounts[platform];
          console.log(`${platform} account:`, account);
          
          if (!account) {
            console.log(`No ${platform} account found`);
            return {
              platform,
              success: false,
              error: `${platform} account not found`,
              sentAt: new Date()
            };
          }
          
          if (!account.connected) {
            console.log(`${platform} account not connected`);
            return {
              platform,
              success: false,
              error: `${platform} account not connected`,
              sentAt: new Date()
            };
          }
          
          if (!account.accessToken) {
            console.log(`${platform} account missing access token`);
            return {
              platform,
              success: false,
              error: `${platform} account missing access token`,
              sentAt: new Date()
            };
          }
          
          console.log(`${platform} account is valid, proceeding with post...`);
        

          let result;
          try {
            switch (platform) {
              case 'twitter':
                result = await Promise.race([
                  postToTwitter(post.content, account.accessToken, post.media, account),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Twitter API timeout')), 5000))
                ]);
                break;
              case 'linkedin':
                result = await postToLinkedin(post.content, account.accessToken, post.media);
                break;
              case 'reddit':
                result = await postToReddit(post.content, account.accessToken, post.media, account, 'test');
                break;
              default:
                result = {
                  success: false,
                  error: 'unsupported platform',
                  sentAt: new Date()
                };
            }
          } catch (error) {
            result = {
              success: false,
              error: error.message,
              sentAt: new Date()
            };
          }

          return {
            platform,
            ...result
          };
        });

        // wait for all platforms with timeout
        const platformResults = await Promise.allSettled(platformPromises);
        
        platformResults.forEach((promiseResult) => {
          if (promiseResult.status === 'fulfilled') {
            results.push(promiseResult.value);
            if (promiseResult.value.success) {
              hasSuccess = true;
            }
          } else {
            results.push({
              platform: 'unknown',
              success: false,
              error: promiseResult.reason?.message || 'Platform processing failed',
              sentAt: new Date()
            });
          }
        });

        // update post status and results
        post.platformResults = {};
        results.forEach(result => {
          post.platformResults[result.platform] = {
            success: result.success,
            postId: result.postId,
            error: result.error
          };
        });
        post.status = hasSuccess ? 'published' : 'failed';
        post.publishedAt = hasSuccess ? new Date() : undefined;
        await post.save();

        // increment user's sent posts count if at least one platform succeeded
        if (hasSuccess) {
          await User.findByIdAndUpdate(user._id, {
            $inc: { postsCount: 1 }
          });
        }

        // only count as processed if at least one platform succeeded
        if (hasSuccess) {
          processedCount++;
        }
        
        console.log(`Processed post ${post._id}: ${post.status} (hasSuccess: ${hasSuccess})`);

      } catch (error) {
        console.error(`Error processing post ${post._id}:`, error);
        
        // mark post as failed
        try {
          post.status = 'failed';
          post.errorMessage = error.message;
          await post.save();
        } catch (saveError) {
          console.error('Failed to save error status:', saveError);
        }
      }
    }

    return { processed: processedCount, message: `Processed ${processedCount} posts` };

  } catch (error) {
    console.error('Error in processScheduledPosts:', error);
    throw error;
  }
}

// cron job to run every minute
const startScheduler = () => {
  if (process.env.ENABLE_CRON !== 'true') {
    console.log('cron scheduler disabled');
    return;
  }

  console.log('starting cron scheduler...');
  
  // run every minute
  cron.schedule('* * * * *', () => {
    console.log('running scheduled posts check...');
    processScheduledPosts();
  });
};

// serverless function endpoint for Vercel cron
module.exports = async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Cron job triggered at:', new Date().toISOString());
    
    // set response timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          timestamp: new Date().toISOString()
        });
      }
    }, 9000); // 9 second timeout
    
    const result = await processScheduledPosts();
    
    clearTimeout(timeoutId);
    
    if (!res.headersSent) {
      const executionTime = Date.now() - startTime;
      res.status(200).json({
        success: true,
        message: result.message || 'Scheduled posts processed successfully',
        processed: result.processed || 0,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Scheduler endpoint error:', error);
    
    if (!res.headersSent) {
      const executionTime = Date.now() - startTime;
      res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        details: error.message,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// export the scheduler function for use in server
module.exports.startScheduler = startScheduler;
