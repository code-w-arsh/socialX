// api service for socialx frontend
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // auth endpoints
  async signup(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'signup failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('signup error:', error);
      throw error;
    }
  }

  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'login failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('login error:', error);
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to get profile');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('get profile error:', error);
      throw error;
    }
  }

  // oauth endpoints
  async connectSocialAccount(platform) {
    try {
      const token = localStorage.getItem('token');
      // for oauth, we need to redirect directly to the authorization url
      // use the correct oauth endpoint (not callback)
      const authUrl = `${API_BASE_URL}/auth/oauth/${platform}?token=${token}`;
      
      // return the url for the frontend to redirect to
      return { authUrl };
    } catch (error) {
      console.error('connect social account error:', error);
      throw error;
    }
  }

  async disconnectSocialAccount(platform) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/disconnect`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to disconnect account');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('disconnect social account error:', error);
      throw error;
    }
  }

  // post scheduling endpoints
  async createScheduledPost(postData) {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/schedule`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to schedule post');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('schedule post error:', error);
      throw error;
    }
  }

  async getScheduledPosts() {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/scheduled`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to get scheduled posts');
      }

      const data = await response.json();
      return data.posts;
    } catch (error) {
      console.error('get scheduled posts error:', error);
      throw error;
    }
  }

  async updateScheduledPost(postId, updateData) {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to update post');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('update post error:', error);
      throw error;
    }
  }

  async deleteScheduledPost(postId) {
    try {
      console.log('API: Deleting post with ID:', postId);
      console.log('API: Request URL:', `${API_BASE_URL}/posts?postId=${postId}`);
      
      const response = await fetch(`${API_BASE_URL}/posts?postId=${postId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      console.log('API: Response status:', response.status);
      console.log('API: Response ok:', response.ok);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.log('API: Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.log('API: Error data:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: failed to delete post`);
      }

      const data = await response.json();
      console.log('API: Success data:', data);
      return data;
    } catch (error) {
      console.error('delete post error:', error);
      throw error;
    }
  }

  // media upload endpoint
  async uploadMedia(file) {
    try {
      const formData = new FormData();
      formData.append('media', file);

      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to upload media');
      }

      const data = await response.json();
      return data.media;
    } catch (error) {
      console.error('upload media error:', error);
      throw error;
    }
  }

  // analytics endpoints
  async getPostAnalytics() {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/analytics`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to get analytics');
      }

      const data = await response.json();
      return data.analytics;
    } catch (error) {
      console.error('get analytics error:', error);
      throw error;
    }
  }

  // ai content generation endpoint
  async generateAIContent(formData) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'failed to generate AI content');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI content generation error:', error);
      throw error;
    }
  }
}

const apiService = new ApiService();
export default apiService;
