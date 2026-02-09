# 📈 Stock Screener

Technical analysis rating tracker for global stock markets (US, TH, HK, JP, IN, VN, UK).

---

## 🚀 Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/server.py  # http://localhost:8000
```

---

## ⚙️ Configuration

### Frontend Environment (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

### Backend Environment (`backend/.env`)

```env
# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key

# API Settings
API_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173
```

---

## 🗄️ Database Setup

### 1. Create Supabase Project
- Sign up at [supabase.com](https://supabase.com)
- Create new project
- Get credentials from Settings → API

### 2. Run Database Schema

Open SQL Editor in Supabase and run [`database_schema.sql`](database_schema.sql):

**Creates:**
- `stock_ratings` - Main stock data table
- `signal_changes` - Rating change history
- `signal_returns` - Performance tracking (1/10/30 day returns)

**Functions:**
- `get_stocks_with_previous_rating()` - Get stocks with last different rating
- `get_signal_changes()` - Track rating changes
- `calculate_signal_returns()` - Calculate performance metrics

### 3. Initial Data Migration

```bash
cd backend

# Fetch initial data (one market)
python src/main.py --market TH --once

# Or fetch all markets (takes 5-10 min)
python src/main.py --once
```

**Available Markets:** `US`, `TH`, `HK`, `JP`, `IN`, `VN`, `UK`

### 4. Backfill Signal Returns (Optional)

```bash
cd backend
python src/backfill_signals.py
```

This calculates historical returns for existing signals.

---

## 🔄 Migrate Data from Dev to Production

### Scenario: Moving from Dev Supabase to Production Database

If you have data in a **dev Supabase** and want to migrate to a **new Supabase** or **PostgreSQL** for production:

#### Step 1: Setup New Production Database

**For Supabase:**
1. Create new Supabase project for production
2. Run `database_schema.sql` in SQL Editor
3. Get new credentials (URL and Key)

**For PostgreSQL:**
1. Create new PostgreSQL database
2. Run `database_schema.sql` using psql or pgAdmin
3. Get connection credentials

#### Step 2: Configure Migration Script

Edit `backend/src/migrate_to_postgres.py` to set source and destination:

```python
# Source (Dev Supabase)
SOURCE_SUPABASE_URL = "https://dev-project.supabase.co"
SOURCE_SUPABASE_KEY = "dev-anon-key"

# Destination (Production Supabase or PostgreSQL)
DEST_SUPABASE_URL = "https://prod-project.supabase.co"
DEST_SUPABASE_KEY = "prod-anon-key"

# OR for PostgreSQL
DEST_POSTGRES_URL = "postgresql://user:pass@host:5432/dbname"
```

#### Step 3: Run Migration

```bash
cd backend
source venv/bin/activate
python src/migrate_to_postgres.py
```

**What it does:**
- Reads all data from dev database
- Migrates to production database
- Preserves all historical data and signals

#### Step 4: Update Production Environment

Update `backend/.env` with production credentials:

```env
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_KEY=prod-anon-key
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

#### Step 5: Backfill Signal Returns

```bash
cd backend
python src/backfill_signals.py
```

This recalculates returns for all migrated signals.

---

## 🤖 Automated Data Fetching

### GitHub Actions Setup

1. **Add Secrets** in GitHub repo:
   - Settings → Secrets and variables → Actions
   - Add `SUPABASE_URL` and `SUPABASE_KEY`

2. **Workflows** (in `.github/workflows/`):
   - Market data fetching: Runs during trading hours
   - Signal processing: Daily at 6 AM

---
