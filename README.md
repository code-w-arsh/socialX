# SocialX - Social Media Automation Platform

Tired of posting the same content everywhere manually? SocialX automates your entire social media workflow - from content creation to cross-platform publishing - It works harder than you do, so you don't have to.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20SocialX-3b82f6?style=for-the-badge&logo=vercel)](https://socialx.arshfs.tech/)

## Features

- **Multi-Platform Posting** - Schedule posts across Twitter, LinkedIn, and Reddit simultaneously
- **AI Content Generation** - Generate engaging posts using Google Gemini AI with platform optimization
- **Smart Scheduling** - Calendar-based scheduling with up to 500 posts per user
- **Media Upload Support** - Cloudinary integration for images with automatic optimization
- **OAuth Integration** - Secure social media account connections with hybrid OAuth flows
- **Dark Theme Interface** - Modern glassmorphism design with responsive mobile support

## Tech Stack

**Frontend:** React.js 18+ • React Router • CSS3 Grid/Flexbox • Lucide Icons  
**Backend:** Node.js Serverless Functions • MongoDB Atlas • JWT Authentication  
**AI Integration:** Google Gemini API • Content Optimization • Platform-specific Generation  
**Media:** Cloudinary • Image Processing • Multi-format Support  
**Deployment:** Vercel Platform • Environment Management • CI/CD Pipeline

## Project Structure

```
socialx/
├── api/
│   ├── auth/
│   │   ├── auth.js              # login/signup with jwt tokens
│   │   ├── oauth.js             # multi-platform oauth flows
│   │   ├── oauth1a-handler.js   # twitter oauth 1.0a for media
│   │   └── disconnect.js        # social account disconnection
│   ├── posts/
│   │   └── posts.js             # crud operations and analytics
│   ├── media/
│   │   └── upload.js            # cloudinary integration
│   ├── ai/
│   │   └── generate.js          # ai content generation
│   ├── cron/
│   │   └── scheduler.js         # automated post processing
│   ├── users/
│   │   └── profile.js           # user profile management
│   └── utils/
│       └── db.js                # mongodb connection utility
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.js   # animated hero with features
│   │   │   ├── Auth.js          # login/signup component
│   │   │   ├── Dashboard.js     # main user dashboard
│   │   │   ├── PostScheduler.js # post creation interface
│   │   │   ├── Calendar.js      # calendar view for posts
│   │   │   └── AIGenerator.js   # ai content generation
│   │   ├── utils/
│   │   │   └── apiService.js    # centralized api communication
│   │   ├── App.js               # root component with routing
│   │   └── index.js             # react entry point
│   └── package.json             # frontend dependencies
├── models/
│   ├── User.js                  # user schema with oauth accounts
│   └── Post.js                  # post schema with media support
├── .env.example                 # environment template
├── vercel.json                  # deployment configuration
└── package.json                 # root dependencies
```

## Quick Setup

**Clone & Install**
```bash
git clone https://github.com/code-w-arsh/socialX.git
cd socialX
npm install
cd client && npm install && cd ..
```

**Run Locally**
```bash
cd client && npm start
# app runs on http://localhost:3000
```

## API Endpoints

**Authentication**
- **POST /api/auth/login** - User authentication with JWT
- **POST /api/auth/signup** - User registration
- **GET /api/users/profile** - Get user profile with connected accounts

**OAuth Integration**
- **GET /api/auth/oauth/twitter** - Twitter OAuth 2.0 + 1.0a flow
- **GET /api/auth/oauth/linkedin** - LinkedIn OAuth 2.0 flow
- **GET /api/auth/oauth/reddit** - Reddit OAuth 2.0 flow
- **POST /api/auth/disconnect** - Disconnect social accounts

**Post Management**
- **POST /api/posts/schedule** - Schedule new post with media
- **GET /api/posts/scheduled** - Get user's scheduled posts
- **DELETE /api/posts** - Delete scheduled post
- **GET /api/posts/analytics** - Get post performance metrics

**AI & Media**
- **POST /api/ai/generate** - Generate AI content with platform optimization
- **POST /api/media/upload** - Upload media to Cloudinary

## Technical Implementation

**Multi-Platform OAuth**
- Twitter: Hybrid OAuth 2.0 + 1.0a for media upload capabilities
- LinkedIn: Standard OAuth 2.0 with post publishing scopes
- Reddit: OAuth 2.0 with gallery post support for multiple images
- Secure token management with refresh capabilities

**AI Content Generation**
- Google Gemini integration for intelligent content creation
- Platform-specific optimization (character limits, tone, hashtags)
- Customizable content types (professional, casual, promotional)
- Real-time generation with error handling

**Media Processing**
- Cloudinary integration for image optimization
- Multi-image support with gallery posts
- Automatic resizing and format conversion
- Secure upload with validation

## Performance

- **Response Time:** < 300ms average for post operations
- **AI Generation:** < 5s for content creation
- **Uptime:** 99.9% with Vercel infrastructure
- **Scalability:** Auto-scaling serverless functions
- **Database:** Optimized MongoDB queries with indexing

## Skills Demonstrated

- Multi-platform API integration and OAuth flows
- AI integration for content generation
- Real-time web application development
- Serverless architecture and deployment
- Modern React patterns and state management
- Database design and optimization
- Media processing and cloud storage

---

<div align="center">

**Built with** ❤️ **by Arsh**

[![Portfolio](https://img.shields.io/badge/Portfolio-Visit-3b82f6?style=flat-square&logo=vercel)](https://arshfs.tech/) [![GitHub](https://img.shields.io/badge/GitHub-Follow-28a745?style=flat-square&logo=github)](https://github.com/code-w-arsh) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/sync-w-arsh/)

</div>
