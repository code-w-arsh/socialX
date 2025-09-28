// ai content generator component for creating social media posts
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiZap, FiCopy, FiRefreshCw, FiSend, FiTwitter } from 'react-icons/fi';
import { FaLinkedin, FaReddit } from 'react-icons/fa';
import apiService from '../utils/apiService';
import './AIGenerator.css';

const AIGenerator = () => {
  const [formData, setFormData] = useState({
    topic: '',
    tone: 'professional',
    platforms: ['twitter'],
    includeHashtags: true,
    includeEmojis: false,
    contentType: 'informative'
  });
  
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tones = [
    { value: 'professional', label: 'Professional' },
    { value: 'casual', label: 'Casual' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'authoritative', label: 'Authoritative' },
    { value: 'humorous', label: 'Humorous' }
  ];

  const contentTypes = [
    { value: 'informative', label: 'Informative' },
    { value: 'promotional', label: 'Promotional' },
    { value: 'question', label: 'Question' },
    { value: 'tips', label: 'Tips & Advice' },
    { value: 'announcement', label: 'Announcement' }
  ];

  const platforms = [
    { value: 'twitter', label: 'Twitter', icon: <FiTwitter size={18} /> },
    { value: 'linkedin', label: 'LinkedIn', icon: <FaLinkedin size={18} /> },
    { value: 'reddit', label: 'Reddit', icon: <FaReddit size={18} /> }
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };

  const generateContent = async () => {
    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (formData.platforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.generateAIContent(formData);
      setGeneratedContent(response.content);
    } catch (error) {
      console.error('AI generation error:', error);
      setError('Service Outage: Gemini 1.5 Flash, try again later');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    // could add a toast notification here
  };

  const schedulePost = () => {
    // navigate to scheduler with pre-filled content only
    const params = new URLSearchParams({
      content: generatedContent
    });
    window.location.href = `/scheduler?${params.toString()}`;
  };

  return (
    <div className="ai-generator">
      {/* Header */}
      <header className="ai-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <Link to="/dashboard" className="back-btn">
                <FiArrowLeft size={18} />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="ai-content">
        <div className="container">
          <div className="ai-layout">
            {/* Input Form */}
            <div className="ai-form-section">
              <div className="form-card glass">
                <div className="form-header">
                  <h2>Generate Content</h2>
                  <p>Tell AI what you want to post about</p>
                </div>

                <div className="form-body">
                  {/* Topic Input */}
                  <div className="form-group">
                    <label htmlFor="topic">What do you want to post about?</label>
                    <textarea
                      id="topic"
                      name="topic"
                      value={formData.topic}
                      onChange={handleInputChange}
                      placeholder="e.g., Latest trends in web development, New product launch, Industry insights..."
                      rows={3}
                      className="form-textarea"
                    />
                  </div>

                  {/* Platform Selection */}
                  <div className="form-group">
                    <label>Select Platforms</label>
                    <div className="platform-grid">
                      {platforms.map(platform => (
                        <div
                          key={platform.value}
                          className={`platform-option ${formData.platforms.includes(platform.value) ? 'selected' : ''}`}
                          onClick={() => handlePlatformChange(platform.value)}
                        >
                          {platform.icon}
                          <span>{platform.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tone Selection */}
                  <div className="form-group">
                    <label htmlFor="tone">Tone</label>
                    <select
                      id="tone"
                      name="tone"
                      value={formData.tone}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      {tones.map(tone => (
                        <option key={tone.value} value={tone.value}>
                          {tone.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Content Type */}
                  <div className="form-group">
                    <label htmlFor="contentType">Content Type</label>
                    <select
                      id="contentType"
                      name="contentType"
                      value={formData.contentType}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      {contentTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Options */}
                  <div className="form-group">
                    <label>Options</label>
                    <div className="checkbox-group">
                      <label className="checkbox-item">
                        <input
                          type="checkbox"
                          name="includeHashtags"
                          checked={formData.includeHashtags}
                          onChange={handleInputChange}
                        />
                        <span className="checkbox-label">Include Hashtags</span>
                      </label>
                      <label className="checkbox-item">
                        <input
                          type="checkbox"
                          name="includeEmojis"
                          checked={formData.includeEmojis}
                          onChange={handleInputChange}
                        />
                        <span className="checkbox-label">Include Emojis</span>
                      </label>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={generateContent}
                    disabled={loading}
                    className="generate-btn"
                  >
                    <FiZap size={18} />
                    {loading ? 'Generating...' : 'Generate Content'}
                  </button>

                  {error && (
                    <div className="error-message">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Generated Content */}
            <div className="ai-output-section">
              <div className="output-card glass">
                <div className="output-header">
                  <h2>Generated Content</h2>
                  {generatedContent && (
                    <div className="output-actions">
                      <button onClick={copyToClipboard} className="action-btn">
                        <FiCopy size={16} />
                        Copy
                      </button>
                      <button onClick={generateContent} className="action-btn">
                        <FiRefreshCw size={16} />
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>

                <div className="output-body">
                  {generatedContent ? (
                    <>
                      <div className="generated-text">
                        {generatedContent}
                      </div>
                      <div className="output-footer">
                        <div className="character-count">
                          {generatedContent.length} characters
                        </div>
                        <button onClick={schedulePost} className="schedule-btn">
                          <FiSend size={16} />
                          Schedule Post
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-output">
                      <FiZap size={48} />
                      <h3>Ready to Generate</h3>
                      <p>Fill out the form and click "Generate Content" to create your AI-powered post</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIGenerator;
