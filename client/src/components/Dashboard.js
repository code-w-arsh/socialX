// dashboard component showing user stats, connected accounts, and recent posts
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaLinkedin, FaReddit } from 'react-icons/fa';
import { FiLogOut, FiPlus, FiCalendar, FiBarChart, FiSettings, FiTwitter, FiZap } from 'react-icons/fi';
import { Trash2 } from 'lucide-react';
import apiService from '../utils/apiService';
import './Dashboard.css';

const Dashboard = ({ user, onLogout, onUserUpdate }) => {
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // initialize connectedaccounts if it doesn't exist
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
      loadDashboardData();
    }
    
    // handle oauth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    // removed unused variables: needsoauth1a, username
    
    if (success === 'twitter_fully_connected') {
      // clear url parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // reload dashboard data
      loadDashboardData();
    } else if (error) {
      let errorMessage = 'Connection failed. Please try again.';
      switch (error) {
        case 'oauth_denied':
          errorMessage = 'OAuth authorization was denied.';
          break;
        case 'oauth2_not_completed':
          errorMessage = 'Please complete Twitter OAuth 2.0 first.';
          break;
        case 'oauth1a_missing_params':
          errorMessage = 'OAuth 1.0a parameters missing.';
          break;
        case 'oauth1a_access_token_failed':
          errorMessage = 'Failed to get OAuth 1.0a access token.';
          break;
        case 'user_not_found':
          errorMessage = 'User account not found.';
          break;
        default:
          errorMessage = `Connection error: ${error}`;
      }
      alert(errorMessage);
      // clear url parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [userWithDefaults]);

  // early return if user data is not available
  if (!user) {
    return <div className="dashboard-loading">Loading user data...</div>;
  }

  const loadDashboardData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const [postsData, analyticsData] = await Promise.all([
        apiService.getScheduledPosts(),
        apiService.getPostAnalytics()
      ]);
      setScheduledPosts(postsData.reverse()); // Newest posts first
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('failed to load dashboard data:', error);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const handleConnectAccount = async (platform) => {
    try {
      const token = localStorage.getItem('token');
      
      if (platform === 'twitter') {
        // for twitter, start with oauth 2.0 flow
        window.location.href = `${process.env.REACT_APP_API_BASE_URL || 'https://socialx.arshfs.tech'}/api/auth/oauth?platform=twitter&token=${token}`;
      } else {
        // for other platforms, use existing flow
        window.location.href = `${process.env.REACT_APP_API_BASE_URL || 'https://socialx.arshfs.tech'}/api/auth/oauth?platform=${platform}&token=${token}`;
      }
    } catch (error) {
      console.error('Error connecting account:', error);
    }
  };

  // removed handletwitteroauth1a function - now handled server-side

  const handleDisconnectAccount = async (platform) => {
    // optimistic ui update - update immediately for instant feedback
    if (onUserUpdate) {
      const updatedUser = {
        ...user,
        connectedAccounts: {
          ...user.connectedAccounts,
          [platform]: { connected: false }
        }
      };
      onUserUpdate(updatedUser);
    }

    try {
      // make api call in background
      await apiService.disconnectSocialAccount(platform);
      
      // refresh dashboard data after successful api call (no loading spinner)
      await loadDashboardData(false);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      
      // revert optimistic update on error
      if (onUserUpdate) {
        const revertedUser = {
          ...user,
          connectedAccounts: {
            ...user.connectedAccounts,
            [platform]: { connected: true }
          }
        };
        onUserUpdate(revertedUser);
      }
      
      alert('Failed to disconnect account. Please try again.');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      if (!postId) {
        throw new Error('No post ID provided');
      }
      
      // optimistically update ui first for immediate response
      setScheduledPosts(scheduledPosts.filter(post => 
        (post.id || post._id) !== postId
      ));
      
      // then make api call in background
      await apiService.deleteScheduledPost(postId);
    } catch (error) {
      console.error('Delete post error:', error);
      // reload data if delete failed
      await loadDashboardData();
      alert('Failed to delete post. Please try again.');
    }
  };

  const getConnectedAccountsCount = () => {
    const { connectedAccounts } = userWithDefaults;
    return Object.values(connectedAccounts).filter(account => account?.connected).length;
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'twitter': return <FiTwitter size={20} />;
      case 'reddit': return <FaReddit size={20} />;
      case 'linkedin': return <FaLinkedin size={20} />;
      default: return <FaUsers size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* header */}
      <header className="dashboard-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <div className="logo">
                <div className="terminal-logo">
                  <div className="terminal-dot blue-gradient"></div>
                  <div className="terminal-dot white"></div>
                  <div className="terminal-dot blue-gradient"></div>
                </div>
                <span className="logo-text">Social<span className="gradient-text">X</span></span>
              </div>
            </div>
            <div className="header-right">
              <div className="user-info">
                <span className="welcome-text">Welcome, {userWithDefaults.name}</span>
                <button onClick={onLogout} className="logout-btn">
                  <FiLogOut size={18} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="container">
          {/* stats overview */}
          <div className="stats-grid">
            <div className="stat-card glass">
              <div className="stat-icon">
                <FiCalendar size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-number">{scheduledPosts.length}</h3>
                <p className="stat-label">Scheduled Posts</p>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-icon">
                <FaUsers size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-number">{getConnectedAccountsCount()}/3</h3>
                <p className="stat-label">Connected Accounts</p>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-icon">
                <FiBarChart size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-number">{analytics?.totalPosts || userWithDefaults.postsCount}</h3>
                <p className="stats-value">{userWithDefaults.postsCount || 0}</p>
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-icon">
                <FiSettings size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-number">{(userWithDefaults.maxPosts || 500) - (userWithDefaults.postsCount || 0)}</h3>
                <p className="stat-label">Posts Remaining</p>
              </div>
            </div>
          </div>

          {/* main content */}
          <div className="dashboard-main">
            {/* connected accounts */}
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">Connected Accounts</h2>
              </div>

              <div className="accounts-grid">
                {['twitter', 'linkedin', 'reddit'].map((platform) => {
                  const account = userWithDefaults.connectedAccounts[platform] || {};
                  const isConnected = account.connected || false;

                  return (
                    <div key={platform} className={`account-card glass ${isConnected ? 'connected' : ''}`}>
                      <div className="account-icon">
                        {getPlatformIcon(platform)}
                      </div>
                      <div className="account-info">
                        <h3 className="account-name">{platform.charAt(0).toUpperCase() + platform.slice(1)}</h3>
                        <p className="account-status">
                          {isConnected ? `@${account.username || 'Connected'}` : 'Not Connected'}
                        </p>
                      </div>
                      <div className="account-action">
                        {isConnected ? (
                          <div className="connected-actions">
                            <span className="status-badge connected">Connected</span>
                            <button
                              onClick={() => handleDisconnectAccount(platform)}
                              className="btn-secondary disconnect-btn"
                              title={`Disconnect ${platform}`}
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnectAccount(platform)}
                            className="btn-primary connect-btn"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* quick actions */}
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">Quick Actions</h2>
              </div>

              <div className="actions-grid">
                <Link 
                  to="/scheduler" 
                  className="action-card glass"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <div className="action-icon">
                    <FiPlus size={32} />
                  </div>
                  <h3 className="action-title">Schedule New Post</h3>
                  <p className="action-description">
                    Create and schedule posts across all connected platforms
                  </p>
                </Link>

                <Link 
                  to="/calendar" 
                  className="action-card glass"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <div className="action-icon">
                    <FiCalendar size={32} />
                  </div>
                  <h3 className="action-title">View Calendar</h3>
                  <p className="action-description">
                    See all your scheduled posts in calendar view
                  </p>
                </Link>

                <Link 
                  to="/ai-generator" 
                  className="action-card glass"
                  onClick={() => window.scrollTo(0, 0)}
                >
                  <div className="action-icon">
                    <FiZap size={32} />
                  </div>
                  <h3 className="action-title">AI Content Generator</h3>
                  <p className="action-description">
                    Generate engaging posts with AI for all platforms
                  </p>
                </Link>
              </div>
            </div>

            {/* recent posts */}
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title centered">Recent Scheduled Posts</h2>
              </div>

              {scheduledPosts.length > 0 ? (
                <div className="posts-list">
                  {scheduledPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="post-item glass" onClick={() => openPostModal(post)} style={{cursor: 'pointer'}}>
                      <div className="post-content">
                        <h4 className="post-title">{post.content.substring(0, 60)}...</h4>
                        <div className="post-meta">
                          <span className="post-platforms">
                            {post.platforms.map(platform => getPlatformIcon(platform))}
                          </span>
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
                          <span className="post-date">
                            {new Date(post.scheduledFor).toLocaleDateString()}
                          </span>
                          <span className={`post-status ${post.status}`}>
                            {post.status}
                          </span>
                        </div>
                      </div>
                      <div className="post-actions">
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePost(post.id || post._id);
                          }}
                          title="Delete post"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FiCalendar size={48} />
                  </div>
                  <h3>No Scheduled Posts</h3>
                  <p>Ready to schedule your first post?</p>
                  <Link to="/scheduler" className="create-first-post-btn">
                    Create your first post!
                  </Link>
                </div>
              )}
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

export default Dashboard;
