// post scheduler component for creating and managing scheduled social media posts
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Send, Twitter, Linkedin, Plus, Trash2, Check } from 'lucide-react';
import { FaReddit, FaUpload } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import apiService from '../utils/apiService';
import './PostScheduler.css';
import 'react-datepicker/dist/react-datepicker.css';

const PostScheduler = ({ user, onLogout }) => {
  const [postData, setPostData] = useState({
    content: '',
    platforms: [],
    scheduledFor: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    media: []
  });
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // initialize user data with defaults
  const userWithDefaults = useMemo(() => {
    return user ? {
      ...user,
      connectedAccounts: user.connectedAccounts || {
        twitter: { connected: false },
        reddit: { connected: false },
        linkedin: { connected: false }
      },
      postsCount: user.postsCount || 0,
      maxPosts: user.maxPosts || 500
    } : null;
  }, [user]);

  useEffect(() => {
    if (userWithDefaults) {
      loadScheduledPosts();
    }
  }, [userWithDefaults]);

  // check for url parameters to pre-fill content from ai generator
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const content = urlParams.get('content');
    const platforms = urlParams.get('platforms');
    
    if (content) {
      setPostData(prev => ({
        ...prev,
        content: content,
        platforms: platforms ? platforms.split(',') : prev.platforms
      }));
      
      // clear url parameters after using them
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // early return if user data is not available
  if (!user) {
    return <div className="scheduler-loading">Loading user data...</div>;
  }

  const loadScheduledPosts = async () => {
    try {
      const posts = await apiService.getScheduledPosts();
      console.log('Loaded posts:', posts);
      // map backend data structure to frontend expectations
      const mappedPosts = posts.map(post => ({
        ...post,
        id: post._id, // MongoDB uses _id
        scheduledFor: post.scheduledTime // Backend uses scheduledTime
      }));
      setScheduledPosts(mappedPosts.reverse()); // Newest posts first
    } catch (error) {
      console.error('failed to load scheduled posts:', error);
    }
  };

  const handleContentChange = (e) => {
    setPostData({
      ...postData,
      content: e.target.value
    });
    // clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handlePlatformToggle = (platform) => {
    const isSelected = postData.platforms.includes(platform);
    const newPlatforms = isSelected
      ? postData.platforms.filter(p => p !== platform)
      : [...postData.platforms, platform];

    setPostData({
      ...postData,
      platforms: newPlatforms
    });
  };

  const handleDateChange = (date) => {
    setPostData({
      ...postData,
      scheduledFor: date
    });
  };

  const processFiles = async (files) => {
    if (files.length === 0) return;

    // check if adding these files would exceed the limit
    const totalFiles = postData.media.length + files.length;
    if (totalFiles > 4) {
      setError(`Maximum 4 images allowed. You can add ${4 - postData.media.length} more image(s).`);
      return;
    }

    // validate each file
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
    }

    setUploadingMedia(true);
    setError('');

    try {
      const uploadPromises = files.map(file => apiService.uploadMedia(file));
      const uploadedMedia = await Promise.all(uploadPromises);
      
      setPostData({
        ...postData,
        media: [...postData.media, ...uploadedMedia]
      });
      setSuccess(`${files.length} image(s) uploaded successfully!`);
      
      // auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      setError(`Failed to upload media: ${error.message}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    await processFiles(files);
    // clear the input so same files can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  const handleRemoveMedia = (indexToRemove) => {
    setPostData({
      ...postData,
      media: postData.media.filter((_, index) => index !== indexToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // validation with detailed logging
      console.log('Form validation - postData:', postData);
      console.log('Content:', postData.content);
      console.log('Content trimmed:', postData.content.trim());
      console.log('Platforms:', postData.platforms);
      console.log('Scheduled for:', postData.scheduledFor);
      console.log('Media:', postData.media);
      console.log('Current time:', new Date());
      
      if (!postData.content.trim()) {
        throw new Error('Post content is required');
      }
      if (postData.platforms.length === 0) {
        throw new Error('Please select at least one platform');
      }
      if (new Date(postData.scheduledFor) <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      // check if user has reached post limit
      if (userWithDefaults.postsCount >= userWithDefaults.maxPosts) {
        throw new Error(`you have reached your limit of ${userWithDefaults.maxPosts} posts`);
      }

      // create scheduled post - fix field name mismatch
      const postPayload = {
        content: postData.content,
        scheduledTime: postData.scheduledFor, // backend expects scheduledTime
        platforms: postData.platforms,
        timezone: postData.timezone,
        media: postData.media
      };
      
      // check for problematic scheduling time (hr:30 to hr:40)
      const scheduledDate = new Date(postData.scheduledFor);
      const minutes = scheduledDate.getMinutes();
      
      if (minutes >= 30 && minutes <= 40) {
        const suggestedTime = new Date(scheduledDate);
        suggestedTime.setMinutes(41);
        
        throw new Error(
          `Scheduling Conflict: Our cron-job.org scheduler experiences maintenance from minute :30 to :40 every hour. ` +
          `Please exclude this timeframe and schedule your post at ${suggestedTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} or later.`
        );
      }

      console.log('Sending payload:', postPayload);
      await apiService.createScheduledPost(postPayload);

      setSuccess('post scheduled successfully!');
      
      // auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
      
      setPostData({
        content: '',
        platforms: [],
        scheduledFor: new Date(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        media: []
      });

      // reload scheduled posts
      loadScheduledPosts();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      console.log('Deleting post with ID:', postId);
      console.log('Post ID type:', typeof postId);
      
      if (!postId) {
        throw new Error('No post ID provided');
      }
      
      // optimistically update ui first for immediate response
      setScheduledPosts(scheduledPosts.filter(post => 
        (post.id || post._id) !== postId
      ));
      setSuccess('post deleted successfully');
      
      // auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
      
      // then make api call in background
      await apiService.deleteScheduledPost(postId);
    } catch (error) {
      console.error('Delete post error:', error);
      setError(`failed to delete post: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'twitter': return <Twitter size={20} />;
      case 'reddit': return <FaReddit size={20} />;
      case 'linkedin': return <Linkedin size={20} />;
      default: return null;
    }
  };

  const getConnectedPlatforms = () => {
    return Object.entries(userWithDefaults.connectedAccounts)
      .filter(([_, account]) => account.connected)
      .map(([platform]) => platform);
  };

  const connectedPlatforms = getConnectedPlatforms();

  return (
    <div className="post-scheduler">
      {/* header */}
      <header className="scheduler-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <Link to="/dashboard" className="back-btn">
                <ArrowLeft size={20} />
                Back to Dashboard
              </Link>
            </div>
            <div className="header-right">
              <span className="posts-remaining">
                {userWithDefaults.maxPosts - userWithDefaults.postsCount} Posts Remaining
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="scheduler-content">
        <div className="container">
          <div className="scheduler-layout">
            {/* post creation form */}
            <div className="create-post-section">
              <div className="section-card glass">
                <h2 className="section-title">Create New Post</h2>
                
                <form onSubmit={handleSubmit} className="post-form">
                  {/* content input */}
                  <div className="form-group">
                    <label className="form-label">Post Content</label>
                    <textarea
                      value={postData.content}
                      onChange={handleContentChange}
                      placeholder="What's happening?"
                      className="content-textarea"
                      rows="4"
                      maxLength="280"
                      required
                    />
                    <div className="character-count">
                      {postData.content.length}/280
                    </div>
                  </div>

                  {/* media upload */}
                  <div className="form-group">
                    <label className="form-label">Media (Optional) <span className="max-hint">(Max: 4)</span></label>
                    <div 
                      className={`drag-drop-container ${isDragOver ? 'drag-over' : ''} ${uploadingMedia ? 'uploading' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        id="media-upload"
                        accept="image/*"
                        multiple
                        onChange={handleMediaUpload}
                        disabled={uploadingMedia}
                        className="file-input"
                      />
                      
                      <div className="drag-drop-content">
                        <div className="drag-drop-icon">
                          <FaUpload size={18} className="upload-icon" />
                        </div>
                        
                        <div className="drag-drop-text">
                          <h4 className="drag-drop-title">
                            {uploadingMedia ? 'Uploading...' : 'Drop images here or click to browse'}
                          </h4>
                          <p className="drag-drop-subtitle">
                            {postData.media.length > 0 ? `${postData.media.length}/4 images selected` : 'PNG, JPG up to 10MB each'}
                          </p>
                        </div>
                        
                        <label htmlFor="media-upload" className="drag-drop-btn">
                          Choose Files
                        </label>
                      </div>
                    </div>

                    {/* Image previews - redesigned */}
                    {postData.media.length > 0 && (
                      <div className="media-preview-container">
                        <div className="media-preview-grid">
                          {postData.media.map((mediaItem, index) => (
                            <div key={index} className="media-preview-card">
                              <div className="media-preview-wrapper">
                                <img 
                                  src={mediaItem.cloudinaryUrl} 
                                  alt={`Preview ${index + 1}`} 
                                  className="media-preview-image"
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveMedia(index)}
                                  className="media-remove-btn"
                                  title="Remove image"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* platform selection */}
                  <div className="form-group">
                    <label className="form-label">Select Platforms</label>
                    <div className="platforms-grid">
                      {['twitter', 'reddit', 'linkedin'].map((platform) => {
                        const isConnected = connectedPlatforms.includes(platform);
                        const isSelected = postData.platforms.includes(platform);

                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => isConnected && handlePlatformToggle(platform)}
                            disabled={!isConnected}
                            className={`platform-btn ${isSelected ? 'selected' : ''} ${!isConnected ? 'disabled' : ''}`}
                          >
                            {getPlatformIcon(platform)}
                            <span className="platform-name">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                            {!isConnected && (
                              <span className="not-connected">Not Connected</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reddit posts always go to r/test */}
                  {postData.platforms.includes('reddit') && (
                    <div className="form-group">
                      <div className="reddit-info">
                        <span className="reddit-icon">Note:</span>
                        Reddit posts will be published to <strong>r/test</strong>
                      </div>
                    </div>
                  )}

                  {/* date and time selection */}
                  <div className="form-group">
                    <label className="form-label">Scheduled For</label>
                    <div className="datetime-container">
                      <DatePicker
                        selected={postData.scheduledFor}
                        onChange={handleDateChange}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        minDate={new Date()}
                        className="datetime-picker"
                        placeholderText="Select date and time"
                      />
                      <Calendar className="datetime-icon" size={20} />
                    </div>
                    <div className="timezone-info">
                      Timezone: {postData.timezone}
                    </div>
                  </div>

                  {/* messages */}
                  {error && (
                    <div className="error-message">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="success-message">
                      {success}
                    </div>
                  )}

                  {/* submit button */}
                  <button 
                    type="submit" 
                    className="post-schedule-button"
                    disabled={loading || postData.platforms.length === 0}
                  >
                    {loading ? 'Scheduling...' : 'Schedule Post'}
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>

            {/* scheduled posts list */}
            <div className="scheduled-posts-section">
              <div className="section-card glass">
                <div className="section-header">
                  <h2 className="section-title">Scheduled Posts</h2>
                  <span className="posts-count">{scheduledPosts.length} posts</span>
                </div>

                {scheduledPosts.length > 0 ? (
                  <div className="posts-list">
                    {scheduledPosts.map((post) => (
                    <div key={post.id} className="scheduled-post-item glass" onClick={() => openPostModal(post)} style={{cursor: 'pointer'}}>
                        <div className="post-content">
                          <p className="post-text">{post.content || 'No content'}</p>
                          <div className="post-meta">
                            <div className="post-platforms">
                              {(post.platforms || []).map(platform => (
                                <span key={platform} className="platform-tag">
                                  {getPlatformIcon(platform)}
                                </span>
                              ))}
                            </div>
                            {post.media && post.media.length > 0 && (() => {
                              const images = post.media.filter(m => !m.url?.toLowerCase().includes('.gif') && !m.cloudinaryUrl?.toLowerCase().includes('.gif'));
                              const gifs = post.media.filter(m => m.url?.toLowerCase().includes('.gif') || m.cloudinaryUrl?.toLowerCase().includes('.gif'));
                              
                              return (
                                <div className="media-tags">
                                  {images.length > 0 && (
                                    <span className="media-tag">
                                      {images.length} img{images.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {gifs.length > 0 && (
                                    <span className="media-tag gif-tag">
                                      {gifs.length} gif{gifs.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="post-schedule">
                              {(post.status === 'sent' || post.status === 'published' || post.status === 'completed') ? <Check size={14} /> : <Clock size={14} />}
                              {(post.scheduledFor || post.scheduledTime) ? 
                                new Date(post.scheduledFor || post.scheduledTime).toLocaleDateString('en-GB') + ', ' + new Date(post.scheduledFor || post.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 
                                'No date set'}
                            </div>
                            <span className={`post-status ${post.status || 'unknown'}`}>
                              {post.status || 'unknown'}
                            </span>
                          </div>
                        </div>
                        <div className="post-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(post.id || post._id);
                            }}
                            className="delete-btn"
                            title="delete post"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Plus size={48} />
                    <h3>No Scheduled Posts</h3>
                    <p>Create Your First Scheduled Post Above</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && selectedPost && (
        <div className="post-modal-overlay" onClick={closePostModal}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="post-modal-header">
              <h3>Post Details</h3>
              <button className="close-btn" onClick={closePostModal}>×</button>
            </div>
            <div className="post-modal-content">
              <div className="post-platforms-section">
                <h4>Platforms:</h4>
                <div className="post-platforms-list">
                  {(selectedPost.platforms || []).map(platform => (
                    <span key={platform} className={`platform-badge ${platform}`}>
                      {getPlatformIcon(platform)}
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="post-content-section">
                <h4>Content:</h4>
                <p className="post-content-text">{selectedPost.content || 'No content'}</p>
              </div>

              {selectedPost.media && selectedPost.media.length > 0 && (
                <div className="post-media-section">
                  <h4>Media ({selectedPost.media.length}):</h4>
                  <div className="media-grid">
                    {selectedPost.media.map((media, index) => (
                      <div key={index} className="media-item">
                        <img 
                          src={media.cloudinaryUrl || media.url} 
                          alt={`Media ${index + 1}`}
                          className="media-preview"
                          onClick={() => window.open(media.cloudinaryUrl || media.url, '_blank')}
                        />
                        <div className="media-info">
                          <span className="media-type">
                            {(media.cloudinaryUrl || media.url)?.toLowerCase().includes('.gif') ? 'GIF' : 'Image'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="post-schedule-section">
                <h4>Scheduled For:</h4>
                <p className="post-schedule-time">
                  {new Date(selectedPost.scheduledFor).toLocaleString()}
                </p>
              </div>

              <div className="post-status-section">
                <h4>Status:</h4>
                <span className={`post-status ${selectedPost.status}`}>
                  {selectedPost.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // helper functions
  function openPostModal(post) {
    setSelectedPost(post);
    setShowPostModal(true);
  }

  function closePostModal() {
    setShowPostModal(false);
    setSelectedPost(null);
  }
};

export default PostScheduler;
