// landing page component with hero section
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaRocket, FaUsers, FaBolt, FaClock, FaShieldAlt, FaLinkedin, FaCalendarAlt } from 'react-icons/fa';
import { FiGithub } from 'react-icons/fi';
import './LandingPage.css';

const LandingPage = () => {
  const [pausedRows, setPausedRows] = useState({ top: false, bottom: false });

  useEffect(() => {
    const handleScroll = () => {
      setPausedRows({ top: false, bottom: false });
    };

    const handleClickOutside = (e) => {
      if (!e.target.closest('.features-row')) {
        setPausedRows({ top: false, bottom: false });
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleRowClick = (rowType, e) => {
    e.stopPropagation();
    setPausedRows(prev => ({
      ...prev,
      [rowType]: !prev[rowType]
    }));
  };
  return (
    <div className="landing-page">
      {/* header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="terminal-logo">
              <div className="terminal-dot blue-gradient"></div>
              <div className="terminal-dot white"></div>
              <div className="terminal-dot blue-gradient"></div>
            </div>
            <span className="logo-text">Social<span className="gradient-text">X</span></span>
          </div>
          <Link to="/auth" className="nav-button">Get Started</Link>
        </div>
      </header>

      {/* hero section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Automate Your <span className="gradient-text">Social Media</span> Presence
            </h1>
            <p className="hero-description">
              Schedule up to 500 posts across multiple platforms. Connect Twitter, Reddit, and LinkedIn 
              with OAuth 2.0 authentication. Real-time scheduling with cron-based automation.
            </p>
            <div className="hero-actions">
              <Link to="/auth" className="btn-primary">Start Automating</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-content">
          <h2 className="section-title">Why Choose Social<span className="gradient-text">X</span>?</h2>
          <div className="features-grid">
            <div className={`features-row features-row-top ${pausedRows.top ? 'paused' : ''}`} onClick={(e) => handleRowClick('top', e)}>
              <div className="feature-card">
                <div className="feature-icon"><FaRocket /></div>
                <h3>Smart Scheduling</h3>
                <p>Schedule posts across Twitter, Reddit, and LinkedIn with precise timing control and reliable automation.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaUsers /></div>
                <h3>Multi-Platform Support</h3>
                <p>Connect Twitter, Reddit, and LinkedIn with secure OAuth 2.0 authentication and seamless integration.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaBolt /></div>
                <h3>Real-Time Automation</h3>
                <p>Cron-based system ensures your posts go live exactly when scheduled with reliable automation.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaRocket /></div>
                <h3>Smart Scheduling</h3>
                <p>Schedule posts across Twitter, Reddit, and LinkedIn with precise timing control and reliable automation.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaUsers /></div>
                <h3>Multi-Platform Support</h3>
                <p>Connect Twitter, Reddit, and LinkedIn with secure OAuth 2.0 authentication and seamless integration.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaBolt /></div>
                <h3>Real-Time Automation</h3>
                <p>Cron-based system ensures your posts go live exactly when scheduled with reliable automation.</p>
              </div>
            </div>
            <div className={`features-row features-row-bottom ${pausedRows.bottom ? 'paused' : ''}`} onClick={(e) => handleRowClick('bottom', e)}>
              <div className="feature-card">
                <div className="feature-icon"><FaCalendarAlt /></div>
                <h3>Visual Calendar View</h3>
                <p>See your scheduled posts in a beautiful monthly calendar. Click posts to view details and manage your content strategy.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaClock /></div>
                <h3>Bulk Scheduling</h3>
                <p>Schedule multiple posts in advance and manage your content queue with easy-to-use scheduling tools.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaShieldAlt /></div>
                <h3>Secure & Reliable</h3>
                <p>Built with secure OAuth 2.0 authentication to safely connect your social media accounts.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaCalendarAlt /></div>
                <h3>Visual Calendar View</h3>
                <p>See your scheduled posts in a beautiful monthly calendar. Click posts to view details and manage your content strategy.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaClock /></div>
                <h3>Bulk Scheduling</h3>
                <p>Schedule multiple posts in advance and manage your content queue with easy-to-use scheduling tools.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><FaShieldAlt /></div>
                <h3>Secure & Reliable</h3>
                <p>Built with secure OAuth 2.0 authentication to safely connect your social media accounts.</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p className="footer-text">Built with <span className="heart">♥</span> by <a href="https://arshfs.tech/" target="_blank" rel="noopener noreferrer" className="footer-link">Arsh</a></p>
          <span className="big-dot">•</span>
          <div className="social-links">
            <a href="https://www.linkedin.com/in/sync-w-arsh/" target="_blank" rel="noopener noreferrer" className="social-link">
              <FaLinkedin />
            </a>
            <a href="https://github.com/code-w-arsh" target="_blank" rel="noopener noreferrer" className="social-link">
              <FiGithub />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
