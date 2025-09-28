// calendar component for viewing scheduled posts in monthly view
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';
import { FaReddit, FaLinkedin } from 'react-icons/fa';
import { FiTwitter } from 'react-icons/fi';
import apiService from '../utils/apiService';
import './Calendar.css';

const Calendar = ({ user, onLogout, onUserUpdate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);

  useEffect(() => {
    loadScheduledPosts();
  }, [currentDate]);

  const loadScheduledPosts = async () => {
    try {
      setLoading(true);
      const posts = await apiService.getScheduledPosts();
      setScheduledPosts(posts);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'twitter': return <FiTwitter size={16} />;
      case 'reddit': return <FaReddit size={16} />;
      case 'linkedin': return <FaLinkedin size={16} />;
      default: return null;
    }
  };

  const getPostsForDate = (date) => {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduledFor || post.scheduledTime);
      return postDate.toDateString() === date.toDateString();
    });
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const closePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };


  const calendarDays = generateCalendarDays();

  return (
    <div className="calendar-container">
      <header className="calendar-header">
        <div className="container">
          <div className="header-content">
            <Link to="/dashboard" className="back-btn">
              <ArrowLeft size={20} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="calendar-main">
        <div className="container">
          <div className="calendar-content">
            <div className="calendar-controls">
              <button 
                className="nav-btn" 
                onClick={() => navigateMonth(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="calendar-title">{formatMonth(currentDate)}</h1>
              <button 
                className="nav-btn" 
                onClick={() => navigateMonth(1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="calendar-grid">
              <div className="calendar-header-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="calendar-header-cell">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-body">
                {calendarDays.map((date, index) => {
                  const postsForDate = getPostsForDate(date);
                  
                  return (
                    <div 
                      key={index} 
                      className={`calendar-cell ${
                        !isCurrentMonth(date) ? 'other-month' : ''
                      } ${isToday(date) ? 'today' : ''}`}
                    >
                      <div className="date-number">{date.getDate()}</div>
                      
                      {postsForDate.length > 0 && (
                        <div className={`posts-container ${postsForDate.length > 2 ? 'scrollable' : ''}`}>
                          {postsForDate.map((post, postIndex) => (
                            <div 
                              key={post._id || postIndex} 
                              className="post-card"
                              onClick={() => handlePostClick(post)}
                            >
                              <div className="post-platforms">
                                {(post.platforms || []).map(platform => (
                                  <span key={platform} className={`platform-icon ${platform}`}>
                                    {getPlatformIcon(platform)}
                                  </span>
                                ))}
                              </div>
                              <div className="post-status-icon">
                                {(post.status === 'sent' || post.status === 'published' || post.status === 'completed') ? 
                                  <Check size={12} /> : <Clock size={12} />
                                }
                              </div>
                              <div className="post-time">
                                {new Date(post.scheduledFor || post.scheduledTime).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {loading && (
              <div className="calendar-loading">
                <div className="loading-spinner"></div>
                <p>Loading calendar...</p>
              </div>
            )}
          </div>
        </div>
      </main>

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
                <div className="schedule-info">
                  <div className="schedule-status">
                    {(selectedPost.status === 'sent' || selectedPost.status === 'published' || selectedPost.status === 'completed') ? 
                      <Check size={16} /> : <Clock size={16} />
                    }
                    <span className={`status-text ${selectedPost.status || 'unknown'}`}>
                      {selectedPost.status || 'unknown'}
                    </span>
                  </div>
                  <div className="schedule-time">
                    {(selectedPost.scheduledFor || selectedPost.scheduledTime) ? 
                      new Date(selectedPost.scheduledFor || selectedPost.scheduledTime).toLocaleString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : 
                      'No date set'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
