# 📈 Stock Screener - Technical Analysis Rating Tracker

A powerful web application for tracking and analyzing technical analysis ratings across multiple global stock markets (US, Thailand, Hong Kong, Japan). Get real-time signals when stocks change ratings, with historical backtesting to validate signal accuracy.

![Tech Stack](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)

---

## 🚀 Quick Start

Get the project running in 3 steps:

```bash
# 1. Install and start frontend
npm install
npm run dev

# 2. Setup backend (in another terminal)
cd src/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure database and start server
# Create .env file with your Supabase credentials (see below)
python server.py
```

Visit `http://localhost:5173` to see the app! 🎉

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **Python** 3.8 or higher ([Download](https://www.python.org/downloads/))
- **Supabase Account** (free) OR **PostgreSQL** 12+ installed locally
- **Git** for cloning the repository

---

## 🛠️ Detailed Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/stockscreener.git
cd stockscreener
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server (runs on port 5173)
npm run dev
```

The frontend will automatically connect to `http://localhost:8000` for the API.

### 3. Backend Setup

```bash
# Navigate to API directory
cd src/api

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Database Setup

#### Option A: Supabase (Recommended for Quick Start)

1. **Create Account**: Sign up at [supabase.com](https://supabase.com) (free tier available)
2. **Create Project**: Click "New Project" and choose a name
3. **Get Credentials**: 
   - Go to Settings → API
   - Copy your `Project URL` and `anon public` key
4. **Run Database Schema**:
   - Open SQL Editor in Supabase dashboard
   - Copy contents of `full_refresh.sql` from this repository
   - Paste and click "Run"
5. **Configure Environment**:

Create `src/api/.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key-here
ALLOWED_ORIGINS=http://localhost:5173
```

#### Option B: Custom PostgreSQL Database

For using your own PostgreSQL database, you'll need to:
1. Install PostgreSQL 12+ locally or use a managed service
2. Create a database and user
3. Run `full_refresh.sql` to create tables and functions
4. Update `.env` with your database credentials

### 5. Fetch Initial Data

```bash
# Make sure you're in src/api directory with venv activated
cd src/api
source venv/bin/activate

# Fetch single market to test (Thailand)
python main.py --market TH --once

# Or fetch all markets (takes 5-10 minutes)
python main.py --once
```

**Available Markets**: `US`, `TH`, `HK`, `JP`, `IN`, `VN`, `UK`

### 6. Start Backend Server

```bash
# In src/api directory with venv activated
python server.py
```

The API server runs on `http://localhost:8000`

Visit `http://localhost:8000/docs` to see interactive API documentation.

---

## 🤖 Automated Data Fetching with GitHub Actions

### Why Use GitHub Actions?

GitHub Actions can automatically fetch stock data daily **for free**, eliminating the need to keep your computer running 24/7.

**Benefits:**
- ✅ Free for public repositories (2,000 minutes/month for private repos)
- ✅ Runs automatically on schedule
- ✅ No server maintenance required
- ✅ Parallel fetching for all markets
- ✅ Built-in error logging and monitoring

### Setup GitHub Workflow

#### Step 1: Enable GitHub Actions

1. Push your code to GitHub
2. Go to your repository on GitHub.com
3. Click on the "Actions" tab
4. If prompted, click "I understand my workflows, go ahead and enable them"

#### Step 2: Add Database Credentials as Secrets

GitHub Secrets keep your database credentials safe and hidden from public view.

**For Supabase users:**

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the following secrets (one at a time):

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://your-project.supabase.co` (get from Supabase Dashboard → Settings → API)
   
   **Secret 2:**
   - Name: `SUPABASE_KEY`
   - Value: Your anon/public key (get from Supabase Dashboard → Settings → API)

**For PostgreSQL users:**

Add these secrets instead:
- `DB_HOST` - Your database host (e.g., `localhost` or `db.example.com`)
- `DB_PORT` - Database port (usually `5432`)
- `DB_NAME` - Database name (e.g., `stockscreener`)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

#### Step 3: Workflow Schedule

This project includes multiple workflows in `.github/workflows/` that run automatically:

💡 **Why multiple fetches per day?**
- Captures **intraday rating changes** (not just end-of-day)
- Tracks how ratings change during market hours
- Better for short-term trading signals
- More accurate signal timing

💡 **How it works**: 
- Individual workflows run automatically during trading hours (Monday-Friday)
- Each workflow fetches data for one specific market
- Data is saved to your database with timestamps
- You can see the full history of rating changes throughout the day
ไกฟหกไฟ-
**Manual Trigger:**

You can also run any workflow manually:
1. Go to **Actions** tab on GitHub
2. Select a workflow (e.g., "Fetch Thailand Market Data")
3. Click **"Run workflow"** → **"Run workflow"**

**View Schedule Details:**
- Check `.github/workflows/` folder to see exact timing for each market
- Each workflow file shows its cron schedule at the top

#### Step 4: Monitor Workflow

- Check the **Actions** tab to see workflow runs
- Green checkmark ✅ = Success
- Red X ❌ = Failed (click to see error logs)
- View logs for each market to verify data was saved

### Troubleshooting GitHub Actions

**Workflow not running:**
- Check that secrets are correctly named (case-sensitive!)
- Verify workflow files exist in `.github/workflows/`
- Make sure GitHub Actions is enabled in repository settings
- Check the **Actions** tab for any error messages

**"Error: No database credentials" in logs:**
- Verify you added the secrets in the correct repository
- Check secret names match exactly: `SUPABASE_URL` and `SUPABASE_KEY`
- Secrets may take a few seconds to become available after adding

**Workflow runs but no data in database:**
- Check workflow logs for specific error messages
- Verify your Supabase credentials are correct
- Test locally first: `python main.py --market TH --once`

**Too many workflow runs (quota exceeded):**
- GitHub free tier: 2,000 minutes/month for private repos
- Public repos: unlimited
- Each fetch takes ~2-5 minutes
- With multiple daily runs: Monitor your usage in Settings → Billing
- Consider reducing frequency if needed

### Manual Data Fetching

```bash
# Fetch specific market
python main.py --market US --once

# Fetch all markets
python main.py --once

# Schedule for continuous operation (runs daily at 16:30)
python main.py

# Recovery mode (import failed local files)
python main.py --import-local
```

---

## 📊 Signal Returns Tracking

Analyze performance of technical rating signals over 1/10/30 trading days.

### Usage

```bash
# 1. Backfill historical data (one-time)
cd src/api
python backfill_signals.py

# 2. Query analytics
curl "http://localhost:8000/api/analytics/signal-performance?period=10"
curl "http://localhost:8000/api/analytics/rating-comparison?period=1"
curl "http://localhost:8000/api/analytics/stock-signals/NASDAQ:AAPL"
```

**Automation:** GitHub Actions runs daily at 6 AM (`.github/workflows/daily-signal-processing.yml`)

---

## 📚 API Documentation

Once the backend is running, visit:

**Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Key Endpoints

**Stock Data:**
- `GET /api/stocks` - Get stocks with ratings and filters
- `GET /api/summary` - Dashboard statistics
- `GET /api/stock/{symbol}` - Historical data for specific stock
- `GET /api/stock/{symbol}/detail` - Detailed analysis with backtest
- `GET /api/signal-changes` - Stocks with rating changes

**Analytics (Signal Returns):**
- `GET /api/analytics/signal-performance` - Performance statistics
- `GET /api/analytics/rating-comparison` - Compare ratings
- `GET /api/analytics/stock-signals/{symbol}` - Stock signal history

---

## 🔧 Environment Variables

### Backend (.env in src/api/)

```env
# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# API Configuration
API_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
API_KEY=optional-api-key-for-protection

# Logging
LOG_LEVEL=INFO
```

See `src/api/env.example` for a complete template with all available options.

