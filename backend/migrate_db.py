import sqlite3
import os

db_path = "greenwave.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
try:
    cur.execute("ALTER TABLE intersections ADD COLUMN source VARCHAR DEFAULT 'manual'")
    cur.execute("ALTER TABLE intersections ADD COLUMN is_verified BOOLEAN DEFAULT 0")
    cur.execute("ALTER TABLE intersections ADD COLUMN verified_by_id INTEGER REFERENCES users(id)")
    cur.execute("ALTER TABLE intersections ADD COLUMN verified_at DATETIME")
    cur.execute("ALTER TABLE intersections ADD COLUMN match_distance FLOAT")
    cur.execute("ALTER TABLE intersections ADD COLUMN last_updated DATETIME")
    conn.commit()
    print("Columns added successfully")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
