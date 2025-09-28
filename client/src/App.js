// main app component with routing and authentication state management
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import PostScheduler from './components/PostScheduler';
import Calendar from './components/Calendar';
import AIGenerator from './components/AIGenerator';
import apiService from './utils/apiService';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // check if user is logged in on app start
    const token = localStorage.getItem('token');
    if (token) {
      apiService.setToken(token);
      // verify token and get user data
      apiService.getProfile()
        .then(userData => {
          setUser(userData);
        })
        .catch(() => {
          // invalid token, remove it
          localStorage.removeItem('token');
          apiService.setToken(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    apiService.setToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    apiService.setToken(null);
    setUser(null);
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>loading socialx...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={
              user ? <Navigate to="/dashboard" /> : <LandingPage />
            } 
          />
          <Route 
            path="/auth" 
            element={
              user ? <Navigate to="/dashboard" /> : <Auth onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              user ? <Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to="/auth" />
            } 
          />
          <Route 
            path="/scheduler" 
            element={
              user ? <PostScheduler user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to="/auth" />
            } 
          />
          <Route 
            path="/calendar" 
            element={
              user ? <Calendar user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to="/auth" />
            } 
          />
          <Route 
            path="/ai-generator" 
            element={
              user ? <AIGenerator user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to="/auth" />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
