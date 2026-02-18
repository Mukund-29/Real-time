# Deployment Guide

This guide covers deploying the Real-Time Collaborative Task Board to various platforms.

## Option 1: Railway (Recommended - Full Stack)

Railway supports both backend and frontend deployment with PostgreSQL.

### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy Backend**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Choose the `backend` directory as the root
   - Add PostgreSQL service:
     - Click "+ New" → "Database" → "PostgreSQL"
   - Set environment variables:
     ```
     DB_HOST=${{Postgres.PGHOST}}
     DB_PORT=${{Postgres.PGPORT}}
     DB_NAME=${{Postgres.PGDATABASE}}
     DB_USER=${{Postgres.PGUSER}}
     DB_PASSWORD=${{Postgres.PGPASSWORD}}
     PORT=3001
     ```
   - Railway will auto-detect Node.js and deploy

3. **Deploy Frontend**
   - Create a new service in the same project
   - Select the `frontend` directory
   - Set environment variable:
     ```
     REACT_APP_WS_URL=wss://your-backend-url.railway.app
     ```
   - Railway will build and deploy the React app

4. **Get URLs**
   - Backend WebSocket URL: `wss://your-backend.railway.app`
   - Frontend URL: `https://your-frontend.railway.app`

## Option 2: Render (Full Stack)

### Backend Deployment:

1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect GitHub repository
4. Settings:
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node
5. Add PostgreSQL database:
   - Create new "PostgreSQL" database
   - Copy connection string
6. Set environment variables:
   ```
   DB_HOST=<from connection string>
   DB_PORT=5432
   DB_NAME=<from connection string>
   DB_USER=<from connection string>
   DB_PASSWORD=<from connection string>
   PORT=3001
   ```

### Frontend Deployment:

1. Create new "Static Site"
2. Connect GitHub repository
3. Settings:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/build`
4. Set environment variable:
   ```
   REACT_APP_WS_URL=wss://your-backend.onrender.com
   ```

## Option 3: Vercel (Frontend) + Railway/Render (Backend)

### Frontend on Vercel:

1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repository
3. Set root directory to `frontend`
4. Add environment variable:
   ```
   REACT_APP_WS_URL=wss://your-backend-url
   ```
5. Deploy

### Backend:
Follow Railway or Render instructions above.

## Option 4: GitHub Pages (Frontend Only - Limited)

**Note**: GitHub Pages only supports static sites. You'll need a separate backend deployment.

### Steps:

1. **Deploy Backend** first (Railway/Render)
2. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```
3. **Deploy to GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` (create this branch)
   - Folder: `/frontend/build`
4. **Set Environment Variable**:
   - In your build process, set `REACT_APP_WS_URL` to your backend URL

**Limitations**:
- No WebSocket support on GitHub Pages (use HTTPS backend with WSS)
- Requires separate backend hosting
- Not recommended for production

## Environment Variables Reference

### Backend:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskboard
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
```

### Frontend:
```env
REACT_APP_WS_URL=ws://localhost:3001  # Development
REACT_APP_WS_URL=wss://your-backend.railway.app  # Production
```

## Post-Deployment Checklist

- [ ] Backend is accessible and WebSocket connections work
- [ ] Frontend connects to backend WebSocket URL
- [ ] Database is persistent (survives restarts)
- [ ] Environment variables are set correctly
- [ ] HTTPS/WSS is enabled (required for production WebSockets)
- [ ] CORS is configured (if frontend and backend are on different domains)

## Troubleshooting

### WebSocket Connection Failed
- Ensure backend URL uses `wss://` (not `ws://`) in production
- Check that WebSocket support is enabled on your hosting platform
- Verify `REACT_APP_WS_URL` is set correctly

### Database Connection Issues
- Verify database credentials
- Check that database is accessible from backend
- Ensure connection string format is correct

### Build Failures
- Check Node.js version (requires 18+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

## Free Tier Limitations

Most free tiers have limitations:
- **Railway**: $5 free credit/month, then pay-as-you-go
- **Render**: Free tier with 15-minute spin-down after inactivity
- **Vercel**: Generous free tier for static sites

For production use, consider:
- Upgrading to paid tiers
- Using multiple free tiers strategically
- Self-hosting on a VPS
