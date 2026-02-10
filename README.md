# 📈 Stock Screener

Technical analysis rating tracker for global stock markets (US, TH, HK, JP, IN, VN, UK).

---

## 🚀 Complete Setup & Restore Guide

### 1. 🛠️ Environment Setup

#### Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **Supabase Account** (Get your URL and Key)

#### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Frontend Setup
```bash
cd frontend
npm install
```

### 2. 🗄️ Database Initialization (Supabase)

Run the following SQL scripts in your **Supabase SQL Editor** in this exact order:

1.  **Create Tables**: Copy & Run [`database/01_schema.sql`](database/01_schema.sql)
2.  **Add Indexes**: Copy & Run [`database/02_indexes.sql`](database/02_indexes.sql)
3.  **UI Functions**: Copy & Run [`database/03_functions_ui.sql`](database/03_functions_ui.sql)
4.  **Screener Logic**: Copy & Run [`database/04_functions_screener.sql`](database/04_functions_screener.sql)

*(Note: `05_drop_open_column.sql` is not needed if you started fresh with `01_schema.sql` as it's already updated).*

### 3. � Import Data (Restore Backup)

You have two CSV files in the project root. Run these commands from the `scripts/` folder to restore them.

**Step 1: Restore Stock Ratings (~870k rows)**
```bash
cd scripts
python3 import_from_csv.py ../stock_ratings_20260210_120210.csv --table stock_ratings
```
*This may take a while (10-20 mins) as it uploads in batches.*

**Step 2: Restore Signal Returns**
```bash
python3 import_from_csv.py ../signal_returns_20260210_120722.csv --table signal_returns
```

### 4. 🚀 Running the App

**Start Backend** (API & Calculation Engine)
```bash
cd backend
python3 src/server.py
```
*The backend now handles "Calculate-on-Write" automatically for new data.*

**Start Frontend**
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) to view your screener.

---

## 🤖 Automated Data Fetching

### Initial Migration (One-time)
```bash
cd backend
python src/main.py --once
```

### GitHub Actions Setup
1. **Add Secrets** in GitHub repo:
   - Settings → Secrets and variables → Actions
   - Add `SUPABASE_URL` and `SUPABASE_KEY`
2. **Workflows**:
   - Market data fetching: Runs during trading hours.
   - Signal processing: Daily at 6 AM.
