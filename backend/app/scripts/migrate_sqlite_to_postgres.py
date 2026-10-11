"""
SQLite to PostgreSQL Data Migration Tool for GreenWave
Preserves all source SQLite records, relationships, and sequences without data loss.
"""

import os
import sys
import argparse
import sqlite3
import shutil
import json
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.models.domain import Base

# Dependency-ordered tables for foreign key integrity
MIGRATION_TABLES = [
    "countries",
    "states",
    "districts",
    "cities",
    "operational_zones",
    "corridors",
    "road_segments",
    "users",
    "user_scopes",
    "intersections",
    "traffic_observations",
    "demo_sessions",
    "demo_decisions",
    "demo_measurements",
    "alembic_version"
]


def backup_sqlite_db(source_path: str, backup_dir: Optional[str] = None) -> str:
    """Create a verified, timestamped backup of the source SQLite database."""
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source SQLite database not found at: {source_path}")

    if not backup_dir:
        backup_dir = os.path.join(os.path.dirname(source_path), "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"greenwave_backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)

    shutil.copy2(source_path, backup_path)
    
    # Verify backup
    src_size = os.path.getsize(source_path)
    bak_size = os.path.getsize(backup_path)
    if src_size != bak_size:
        raise IOError(f"Backup verification failed: source size ({src_size}) != backup size ({bak_size})")

    return backup_path


def get_sqlite_table_counts(source_conn: sqlite3.Connection) -> Dict[str, int]:
    """Get row count for each table in SQLite."""
    counts = {}
    cursor = source_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in cursor.fetchall()]
    for t in tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{t}";')
        counts[t] = cursor.fetchone()[0]
    return counts


def migrate_data(source_path: str, target_url: str, dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate existing data from SQLite or JSON export to PostgreSQL.
    Returns a comprehensive migration result report.
    """
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_path": source_path,
        "backup_path": None,
        "dry_run": dry_run,
        "tables": {},
        "sequences_reset": [],
        "foreign_key_checks": {},
        "success": False,
        "error": None
    }

    is_json = source_path.endswith(".json")
    json_source_data = {}

    if is_json:
        with open(source_path, "r", encoding="utf-8") as f:
            json_source_data = json.load(f)
        source_counts = {t: len(json_source_data.get(t, [])) for t in MIGRATION_TABLES if t in json_source_data}
        src_conn = None
        src_cur = None
    else:
        # 1. Back up SQLite before anything else
        if not dry_run:
            report["backup_path"] = backup_sqlite_db(source_path)

        # 2. Open SQLite in read-only mode
        sqlite_uri = f"file:{os.path.abspath(source_path)}?mode=ro"
        src_conn = sqlite3.connect(sqlite_uri, uri=True)
        src_conn.row_factory = sqlite3.Row
        src_cur = src_conn.cursor()
        source_counts = get_sqlite_table_counts(src_conn)

    # Normalize target URL for psycopg
    norm_target_url = target_url
    if norm_target_url.startswith("postgres://"):
        norm_target_url = norm_target_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif norm_target_url.startswith("postgresql://") and not norm_target_url.startswith("postgresql+"):
        norm_target_url = norm_target_url.replace("postgresql://", "postgresql+psycopg://", 1)

    target_engine = create_engine(
        norm_target_url,
        pool_pre_ping=True
    )

    try:
        if not dry_run:
            # 3. Ensure target schema exists
            Base.metadata.create_all(bind=target_engine)

            # Ensure alembic_version table exists if needed
            with target_engine.begin() as conn:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS alembic_version (
                        version_num VARCHAR(32) NOT NULL,
                        CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                    );
                """))

        # 3.5 Reconcile orphan session IDs for demo measurements/decisions
        if not dry_run:
            orphan_sessions = set()
            for child_table in ["demo_decisions", "demo_measurements"]:
                if child_table in source_counts and source_counts[child_table] > 0:
                    if is_json:
                        parent_ids = {r["id"] for r in json_source_data.get("demo_sessions", []) if "id" in r}
                        for r in json_source_data.get(child_table, []):
                            s_id = r.get("session_id")
                            if s_id and s_id not in parent_ids:
                                orphan_sessions.add(s_id)
                    else:
                        src_cur.execute(f'SELECT DISTINCT session_id FROM "{child_table}" WHERE session_id NOT IN (SELECT id FROM demo_sessions);')
                        for r in src_cur.fetchall():
                            if r[0]:
                                orphan_sessions.add(r[0])
            if orphan_sessions:
                with target_engine.begin() as conn:
                    for s_id in orphan_sessions:
                        conn.execute(text("""
                            INSERT INTO demo_sessions (id, start_time, status)
                            VALUES (:id, :start_time, :status)
                            ON CONFLICT (id) DO NOTHING;
                        """), {"id": s_id, "start_time": datetime.now(timezone.utc), "status": "completed"})
                        report.setdefault("reconciled_sessions", []).append(s_id)

        # 4. Migrate tables in dependency order
        for table_name in MIGRATION_TABLES:
            if table_name not in source_counts:
                continue

            src_count = source_counts.get(table_name, 0)
            table_report = {
                "source_count": src_count,
                "inserted_count": 0,
                "skipped_count": 0,
                "destination_count": 0,
                "status": "pending"
            }

            if src_count == 0:
                table_report["status"] = "empty_source"
                report["tables"][table_name] = table_report
                continue

            if dry_run:
                table_report["status"] = "dry_run_ready"
                report["tables"][table_name] = table_report
                continue

            # Fetch source records and columns
            if is_json:
                rows = json_source_data.get(table_name, [])
                col_names = list(rows[0].keys()) if rows else []
                pk_col = "id" if "id" in col_names else ("version_num" if table_name == "alembic_version" else None)
            else:
                src_cur.execute(f'PRAGMA table_info("{table_name}");')
                columns_info = src_cur.fetchall()
                col_names = [c["name"] for c in columns_info]
                pk_col = next((c["name"] for c in columns_info if c["pk"] == 1), None)

                src_cur.execute(f'SELECT * FROM "{table_name}";')
                rows = src_cur.fetchall()

            with target_engine.begin() as conn:
                # Check existing records in destination
                existing_pks = set()
                if pk_col:
                    try:
                        res = conn.execute(text(f'SELECT "{pk_col}" FROM "{table_name}";'))
                        existing_pks = {r[0] for r in res.fetchall()}
                    except Exception:
                        existing_pks = set()

                inserted = 0
                skipped = 0

                cols_placeholder = ", ".join([f'"{c}"' for c in col_names])
                vals_placeholder = ", ".join([f":{c}" for c in col_names])
                insert_sql = text(f'INSERT INTO "{table_name}" ({cols_placeholder}) VALUES ({vals_placeholder});')

                for row in rows:
                    row_dict = dict(row)
                    if pk_col and row_dict.get(pk_col) in existing_pks:
                        skipped += 1
                        continue

                    # Convert boolean values and datetimes safely
                    for k, v in row_dict.items():
                        if isinstance(v, int) and any(b in k.lower() for b in ["is_active", "is_verified"]):
                            row_dict[k] = bool(v)
                        elif isinstance(v, str) and ("date" in k.lower() or "time" in k.lower() or "timestamp" in k.lower()):
                            # Parse string datetime if needed
                            try:
                                if "T" in v:
                                    row_dict[k] = datetime.fromisoformat(v.replace("Z", "+00:00"))
                            except Exception:
                                pass

                    conn.execute(insert_sql, row_dict)
                    inserted += 1

                table_report["inserted_count"] = inserted
                table_report["skipped_count"] = skipped

                # Verify destination count
                dest_res = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}";'))
                dest_count = dest_res.scalar()
                table_report["destination_count"] = dest_count
                table_report["status"] = "verified" if dest_count >= src_count else "count_mismatch"

            report["tables"][table_name] = table_report

        # 5. Reset PostgreSQL Sequences for auto-incrementing primary keys
        if not dry_run and "postgres" in norm_target_url:
            with target_engine.begin() as conn:
                for table_name in MIGRATION_TABLES:
                    if table_name == "alembic_version" or table_name == "demo_sessions":
                        continue
                    try:
                        seq_res = conn.execute(text(f"""
                            SELECT pg_get_serial_sequence('"{table_name}"', 'id');
                        """))
                        seq_name = seq_res.scalar()
                        if seq_name:
                            conn.execute(text(f"""
                                SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM "{table_name}"), 1), true);
                            """))
                            report["sequences_reset"].append(f"{table_name} -> {seq_name}")
                    except Exception as seq_err:
                        # Non-serial table or no sequence
                        pass

        # 6. Verify foreign-key relationships
        if not dry_run and "postgres" in norm_target_url:
            with target_engine.begin() as conn:
                # Check user -> district integrity
                u_dist = conn.execute(text("""
                    SELECT COUNT(*) FROM users u 
                    WHERE u.district_id IS NOT NULL 
                    AND NOT EXISTS (SELECT 1 FROM districts d WHERE d.id = u.district_id);
                """)).scalar()
                report["foreign_key_checks"]["orphan_user_districts"] = u_dist

                # Check district -> state integrity
                d_state = conn.execute(text("""
                    SELECT COUNT(*) FROM districts d 
                    WHERE d.state_id IS NOT NULL 
                    AND NOT EXISTS (SELECT 1 FROM states s WHERE s.id = d.state_id);
                """)).scalar()
                report["foreign_key_checks"]["orphan_district_states"] = d_state

        report["success"] = True

    except Exception as e:
        report["success"] = False
        report["error"] = str(e)
        raise
    finally:
        if src_conn:
            src_conn.close()
        target_engine.dispose()

    return report


def main():
    default_src = os.path.join(backend_dir, "greenwave.db")
    if not os.path.exists(default_src):
        default_src = os.path.join(backend_dir, "app", "db", "initial_data.json")
    parser = argparse.ArgumentParser(description="Migrate GreenWave SQLite database to PostgreSQL (Neon)")
    parser.add_argument("--source", default=default_src, help="Source SQLite DB or JSON path")
    parser.add_argument("--target", default=None, help="Target PostgreSQL connection string (defaults to POSTGRES_URL)")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and simulate migration without committing")
    args = parser.parse_args()

    target_url = args.target or os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or settings.SQLALCHEMY_DATABASE_URI
    if not target_url or "sqlite" in target_url:
        print("ERROR: Target PostgreSQL connection string not specified. Provide --target or set POSTGRES_URL.")
        sys.exit(1)

    print(f"--- GreenWave SQLite -> PostgreSQL Migration ---")
    print(f"Source: {args.source}")
    print(f"Target: {'[PostgreSQL connection string provided]'}")
    print(f"Dry Run: {args.dry_run}\n")

    res = migrate_data(source_path=args.source, target_url=target_url, dry_run=args.dry_run)

    print("\n=== Migration Summary Report ===")
    print(f"Backup created: {res['backup_path']}")
    for tbl, data in res["tables"].items():
        print(f"Table '{tbl}': Source={data['source_count']}, Migrated={data.get('inserted_count', 0)}, Skipped={data.get('skipped_count', 0)}, Dest Total={data.get('destination_count', 0)} [{data['status']}]")

    print(f"\nSequences reset: {len(res['sequences_reset'])}")
    print(f"FK Integrity checks: {res['foreign_key_checks']}")
    print(f"Result: {'SUCCESS' if res['success'] else 'FAILED'}")


if __name__ == "__main__":
    main()
