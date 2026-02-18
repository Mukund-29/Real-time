# Quick Start Guide

## For GitHub Repository Setup

### 1. Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Real-time collaborative task board"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Push to GitHub
git push -u origin main
```

### 2. Set Up GitHub Actions (Optional)

The repository includes a CI/CD workflow (`.github/workflows/ci.yml`) that will:
- Run tests on every push
- Build both backend and frontend
- Verify everything works

No configuration needed - it works automatically!

### 3. Deploy to Production

Choose one of these options:

#### Option A: Railway (Easiest - Recommended)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect and deploy both services
6. Add PostgreSQL database in Railway dashboard
7. Set environment variables (see DEPLOYMENT.md)

#### Option B: Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Create new Web Service for backend
4. Create new Static Site for frontend
5. Connect your GitHub repo
6. Follow setup in DEPLOYMENT.md

#### Option C: Local Development Only

If you just want to run it locally:

```bash
# Using Docker (easiest)
docker-compose up

# Or manually:
# Terminal 1: Start PostgreSQL
# Terminal 2: cd backend && npm install && npm run dev
# Terminal 3: cd frontend && npm install && npm start
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details
- Read [DESIGN.md](./DESIGN.md) for architecture details

## Need Help?

- Check the Troubleshooting section in README.md
- Verify all environment variables are set
- Ensure PostgreSQL is running (if not using Docker)
