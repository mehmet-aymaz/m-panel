import sqlite3
import os

DB_PATH = "/opt/m-panel/app/data/panel.db"
MIGRATIONS_DIR = "/opt/m-panel/app/migrations"

def run_baseline_migrations(cursor):
    # Columns to add to inbounds
    inbound_cols = [
        ("network", "VARCHAR DEFAULT 'ws'"),
        ("security", "VARCHAR DEFAULT 'tls'"),
        ("sni", "VARCHAR"),
        ("ws_path", "VARCHAR DEFAULT '/'"),
        ("ws_host", "VARCHAR"),
        ("sniffing_enabled", "BOOLEAN DEFAULT 1"),
        ("grpc_service_name", "VARCHAR")
    ]

    # Columns to add to clients
    client_cols = [
        ("limit_ip", "INTEGER DEFAULT 0"),
        ("tg_id", "VARCHAR"),
        ("comment", "VARCHAR"),
        ("flow", "VARCHAR")
    ]

    # Columns to add to admin_users
    admin_user_cols = [
        ("two_factor_secret", "VARCHAR"),
        ("two_factor_enabled", "BOOLEAN DEFAULT 0")
    ]

    # Helper to check column existence
    def column_exists(table, column):
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            return column in columns
        except Exception:
            return False

    # Apply inbound migrations
    for col_name, col_type in inbound_cols:
        if not column_exists("inbounds", col_name):
            try:
                print(f"inbounds tablosuna {col_name} kolonu ekleniyor...")
                cursor.execute(f"ALTER TABLE inbounds ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Uyarı: {col_name} kolonu eklenemedi: {e}")
            
    # Apply client migrations
    for col_name, col_type in client_cols:
        if not column_exists("clients", col_name):
            try:
                print(f"clients tablosuna {col_name} kolonu ekleniyor...")
                cursor.execute(f"ALTER TABLE clients ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Uyarı: {col_name} kolonu eklenemedi: {e}")

    # Apply admin_user migrations
    for col_name, col_type in admin_user_cols:
        if not column_exists("admin_users", col_name):
            try:
                print(f"admin_users tablosuna {col_name} kolonu ekleniyor...")
                cursor.execute(f"ALTER TABLE admin_users ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Uyarı: {col_name} kolonu eklenemedi: {e}")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Veritabanı dosyası bulunamadı: {DB_PATH}. Migration atlanıyor.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Create migrations table if not exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version VARCHAR UNIQUE,
        description VARCHAR,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    conn.commit()

    # 2. Run baseline Python-based migrations
    run_baseline_migrations(cursor)
    conn.commit()

    # 3. Read and run SQL migrations from MIGRATIONS_DIR
    if os.path.exists(MIGRATIONS_DIR):
        files = [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")]
        files.sort()  # Sort to run in order

        for file in files:
            # Extract version and description from filename (e.g. v1.1.0_add_nodes_table.sql)
            base_name = os.path.splitext(file)[0]
            if "_" in base_name:
                version, description = base_name.split("_", 1)
            else:
                version = base_name
                description = "Migration file: " + file
            
            # Check if this migration was already applied
            cursor.execute("SELECT id FROM migrations WHERE version = ?", (version,))
            already_applied = cursor.fetchone()
            
            if not already_applied:
                print(f"Migration {version} ({description}) uygulanıyor...")
                file_path = os.path.join(MIGRATIONS_DIR, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        sql_script = f.read()
                    
                    # Split commands by semicolon and execute them individually
                    statements = [s.strip() for s in sql_script.split(";") if s.strip()]
                    for stmt in statements:
                        try:
                            cursor.execute(stmt)
                        except sqlite3.OperationalError as e:
                            if "duplicate column name" in str(e) or "already exists" in str(e):
                                print(f"Uyarı: Geçici çakışma atlanıyor: {e}")
                            else:
                                raise e
                    
                    # Log to migrations table
                    cursor.execute(
                        "INSERT INTO migrations (version, description) VALUES (?, ?)",
                        (version, description)
                    )
                    conn.commit()
                    print(f"Migration {version} uygulandı.")
                except Exception as e:
                    conn.rollback()
                    print(f"HATA: Migration {version} uygulanamadı: {e}")
                    raise e
            else:
                # Already applied, skip
                pass
    else:
        print(f"Migration dizini bulunamadı: {MIGRATIONS_DIR}. Klasör tabanlı SQL migrationları atlanıyor.")

    conn.close()
    print("Migration işlemi başarıyla tamamlandı.")

if __name__ == "__main__":
    migrate()
