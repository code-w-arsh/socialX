// ai content generation using google gemini api
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // verify jwt token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { topic, tone, platforms, includeHashtags, includeEmojis, contentType } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!platforms || platforms.length === 0) {
      return res.status(400).json({ error: 'At least one platform must be selected' });
    }

    // build the prompt for ai generation
    let prompt = `Create a ${tone} ${contentType} social media post about: ${topic}\n\n`;
    
    // add platform-specific instructions with character limits
    if (platforms.includes('twitter')) {
      prompt += `For Twitter: Maximum 250 characters, punchy and engaging.\n`;
    }
    if (platforms.includes('linkedin')) {
      prompt += `For LinkedIn: Maximum 250 characters, professional and concise.\n`;
    }
    if (platforms.includes('reddit')) {
      prompt += `For Reddit: Maximum 250 characters, conversational and authentic.\n`;
    }

    // add formatting preferences
    if (includeHashtags) {
      prompt += `Include 3-5 relevant hashtags at the end.\n`;
    } else {
      prompt += `Do NOT include any hashtags.\n`;
    }
    
    if (includeEmojis) {
      prompt += `Include 2-3 appropriate emojis strategically placed.\n`;
    } else {
      prompt += `Do NOT include any emojis.\n`;
    }

    prompt += `\nIMPORTANT REQUIREMENTS:
- Keep it concise and to the point
- Single paragraph only, no line breaks
- Focus on one key message or insight
- Make every word count
- Be direct and actionable
- Stay within 250 character limit

Generate ONE short, optimized post that is engaging, valuable, and fits the character limit.`;

    // define fallback models in order of preference
    const models = [
      'gemini-2.5-flash',      // primary: latest fast model
      'gemini-2.0-flash',      // fallback 1: stable fast model
      'gemini-2.5-pro',        // fallback 2: more capable
      'gemini-flash-latest'    // fallback 3: latest alias
    ];

    let geminiResponse;
    let lastError;

    // try each model until one works
    for (const model of models) {
      try {
        console.log(`Trying Gemini model: ${model}`);
        
        geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 3072,  // increased to handle Gemini 2.5's high reasoning token usage
            }
          })
        });

        if (geminiResponse.ok) {
          console.log(`Successfully used model: ${model}`);
          break; // success! exit the loop
        } else {
          const errorText = await geminiResponse.text();
          console.log(`Model ${model} failed with status ${geminiResponse.status}:`, errorText);
          lastError = errorText;
        }
      } catch (error) {
        console.log(`Model ${model} error:`, error.message);
        lastError = error.message;
      }
    }

    // if all models failed
    if (!geminiResponse || !geminiResponse.ok) {
      console.error('All Gemini models failed. Last error:', lastError);
      return res.status(500).json({ error: 'Failed to generate content with AI - all models unavailable' });
    }

    const geminiData = await geminiResponse.json();
    
    // log the full response for debugging
    console.log('Gemini response structure:', JSON.stringify(geminiData, null, 2));
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      console.error('Unexpected Gemini response structure:', geminiData);
      return res.status(500).json({ error: 'Invalid response from AI service' });
    }

    const candidate = geminiData.candidates[0];
    const content = candidate.content;
    
    // check if parts array exists and has content
    if (!content.parts || !content.parts[0] || !content.parts[0].text) {
      console.error('Missing parts in Gemini response. Finish reason:', candidate.finishReason);
      
      // handle specific finish responses
      if (candidate.finishReason === 'MAX_TOKENS') {
        return res.status(500).json({ error: 'AI response was truncated. Please try a shorter topic or regenerate.' });
      } else if (candidate.finishReason === 'SAFETY') {
        return res.status(500).json({ error: 'Content blocked by safety filters. Please try a different topic.' });
      } else {
        return res.status(500).json({ error: 'AI service returned incomplete response. Please try again.' });
      }
    }

    const generatedContent = content.parts[0].text;

    // return the generated content
    res.status(200).json({
      success: true,
      content: generatedContent.trim(),
      metadata: {
        platforms,
        tone,
        contentType,
        characterCount: generatedContent.trim().length
      }
    });

  } catch (error) {
    console.error('AI generation error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate AI content',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
