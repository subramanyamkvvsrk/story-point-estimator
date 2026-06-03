# Deployment Guide for Story Point Estimator

## Fixed Issues
✅ **CORS Error Fixed**: Updated API configuration to dynamically detect environment
✅ **Backend CORS**: Configured to allow requests from Render and GitHub Pages
✅ **Dynamic API Base**: Frontend now uses correct backend URL based on environment

## Quick Deploy Process

### 1. Deploy Backend to Render (First)

**Option A: Using Render Dashboard**
1. Go to [Render.com](https://render.com) and login
2. Click "New" → "Web Service"
3. Connect your GitHub repository: `story-point-estimator`
4. Configure service:
   - **Name**: `story-point-estimator-backend`
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Add Environment Variable:
   - **NODE_ENV**: `production`
6. Deploy and note the URL (should be: `https://story-point-estimator-backend.onrender.com`)

**Option B: Using render.yaml**
1. Push the updated `server/render.yaml` file to GitHub  
2. Use Render's Blueprint feature to auto-deploy

### 2. Update Frontend API URL (If Needed)

Current frontend is configured to use:
- **Local**: `http://localhost:3001/api`
- **Production**: `https://story-point-estimator-backend.onrender.com/api`

If your backend URL is different, update line 209 in `index.html`:
```javascript
: 'https://YOUR-BACKEND-URL.onrender.com/api';
```

### 3. Deploy Frontend

**GitHub Pages (Current)**
- Push updated `index.html` to GitHub
- Existing URL: `https://subramanyamkvvsrk.github.io/story-point-estimator/`

**OR Render Frontend (Optional)**
- Deploy frontend separately to Render
- Use the existing `render.yaml` configuration

## Expected URLs After Deployment

- **Frontend**: `https://story-point-estimator.onrender.com` OR `https://subramanyamkvvsrk.github.io/story-point-estimator/`
- **Backend**: `https://story-point-estimator-backend.onrender.com`
- **Health Check**: `https://story-point-estimator-backend.onrender.com/api/health`

## Testing the Fix

1. Access frontend URL
2. Try to create/join a session
3. Check browser console - no more CORS errors
4. Verify session data persists across users

## Environment Detection Logic

The app automatically detects where it's running:
```javascript
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'  // Local development
    : 'https://story-point-estimator-backend.onrender.com/api';  // Production
```

## Notes

- **Free Tier**: Render free tier may have cold starts (~30 seconds)
- **Persistence**: Sessions stored in `sessions.json` on backend server
- **CORS**: Configured for GitHub Pages and Render domains
- **Fallback**: LocalStorage fallback if backend unavailable

## Troubleshooting

If CORS errors persist:
1. Check backend deployment logs
2. Verify frontend is using correct backend URL
3. Ensure CORS origins include your actual deployment URLs
