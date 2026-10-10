import sqlite3

conn = sqlite3.connect('e:/Greenwave/backend/greenwave.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("TABLES:", tables)

for table in tables:
    table_name = table[0]
    cursor.execute(f"PRAGMA table_info({table_name});")
    columns = cursor.fetchall()
    
    cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
    count = cursor.fetchone()[0]
    
    print(f"\nTable: {table_name} (Rows: {count})")
    for col in columns:
        print(f"  - {col[1]} ({col[2]}) PK:{col[5]}")

conn.close()
