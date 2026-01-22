#!/usr/bin/env python3
"""
Database Migration Script - Rebuild Table
Recreates stock_ratings table with new schema including session_type
"""

import sqlite3
from pathlib import Path
import shutil
from datetime import datetime

DB_PATH = Path(__file__).parent / "data" / "stocks.db"
BACKUP_PATH = Path(__file__).parent / "data" / f"stocks_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"

def migrate_database():
    """Rebuild stock_ratings table with new schema"""
    print(">> Starting database migration (rebuild)...")
    
    # Create backup
    print(f">> Creating backup at {BACKUP_PATH}...")
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print("✅ Backup created")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get existing data
        print(">> Fetching existing data...")
        cursor.execute("SELECT * FROM stock_ratings")
        existing_data = cursor.fetchall()
        print(f"✅ Found {len(existing_data)} existing records")
        
        # Drop old table
        print(">> Dropping old table...")
        cursor.execute("DROP TABLE IF EXISTS stock_ratings")
        print("✅ Old table dropped")
        
        # Create new table with correct schema
        print(">> Creating new table with updated schema...")
        cursor.execute("""
            CREATE TABLE stock_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                market TEXT NOT NULL,
                name TEXT,
                current_price REAL,
                technical_score REAL,
                technical_rating TEXT,
                fetched_date DATE NOT NULL,
                fetched_time TIME,
                session_type TEXT DEFAULT 'regular',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, fetched_date, session_type)
            )
        """)
        print("✅ New table created")
        
        # Migrate existing data (mark all as 'regular' session)
        print(">> Migrating existing data...")
        migrated = 0
        for row in existing_data:
            try:
                # row structure: id, symbol, market, name, price, score, rating, date, created_at, [fetched_time], [session_type]
                cursor.execute("""
                    INSERT INTO stock_ratings 
                    (symbol, market, name, current_price, technical_score, technical_rating, fetched_date, session_type, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', ?)
                """, (row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]))
                migrated += 1
            except Exception as e:
                print(f"   Warning: Could not migrate row {row[1]}: {e}")
        
        print(f"✅ Migrated {migrated} records")
        
        # Create indexes
        print(">> Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbol ON stock_ratings(symbol)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_date ON stock_ratings(fetched_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_market ON stock_ratings(market)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session ON stock_ratings(session_type)")
        print("✅ Indexes created")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Show table structure
        cursor.execute("PRAGMA table_info(stock_ratings)")
        print("\n📋 New table structure:")
        for col in cursor.fetchall():
            print(f"   - {col[1]} ({col[2]})")
        
        # Show record count
        cursor.execute("SELECT COUNT(*) FROM stock_ratings")
        count = cursor.fetchone()[0]
        print(f"\n📊 Total records: {count}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        print(f"\n💾 Restoring from backup...")
        conn.close()
        shutil.copy2(BACKUP_PATH, DB_PATH)
        print("✅ Database restored from backup")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
