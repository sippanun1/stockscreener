# 📈 Stock Screener

Technical analysis rating tracker for global stock markets (US, TH, HK, JP, IN, VN, UK).

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.9+
- Node.js 18+
- Supabase Account

### 2. Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### 3. Backend
```bash
cd backend
python -m venv venv
# Linux/Mac
source venv/bin/activate
# Windows
venv\Scripts\activate

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

## 🗄️ Database Setup (4-Step Modular)

To prevent execution timeouts in Supabase, the setup is split into four parts. Run these in the **Supabase SQL Editor** in numeric order:

1.  **Core Schema**: Run [`database/01_schema.sql`](database/01_schema.sql) (Creates Tables)
2.  **Performance Indexes**: Run [`database/02_indexes.sql`](database/02_indexes.sql) (Optimizes Sorting)
3.  **UI Functions**: Run [`database/03_functions_ui.sql`](database/03_functions_ui.sql) (Dashboard & Stats)
4.  **Screener Logic**: Run [`database/04_functions_screener.sql`](database/04_functions_screener.sql) (V7.2 High-Performance Logic)

---

## 💾 Data Portability (CSV to Database)

We provide tools to export data from one database and import it into another via CSV.

### 📤 Export Data to CSV (Full Backup)
Exports both `stock_ratings` and `signal_returns` tables by default.
```bash
cd scripts
# Exports separate CSV files for each table to the current directory
python export_to_csv.py
```

### 📥 Import Data from CSV (Restore)
Restores data from CSV files into your Supabase database.

**Restore Stock Ratings:**
```bash
# Uses UPSERT (updates existing records)
python import_from_csv.py stock_ratings_202X.csv --table stock_ratings
```

**Restore Signal Returns:**
```bash
# Uses INSERT (append only - be careful of duplicates)
python import_from_csv.py signal_returns_202X.csv --table signal_returns
```

---

## 🤖 Automated Data Fetching

### Initial Migration (One-time)
```bash
cd backend
python src/main.py --once
```

### GitHub Actions Setup
1. **Add Secrets** in GitHub repo: `SUPABASE_URL` and `SUPABASE_KEY`.
2. **Workflows**:
   - Market data fetching: Runs during trading hours.
   - Signal processing: Daily at 6 AM.
