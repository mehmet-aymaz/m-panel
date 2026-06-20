import sqlite3
import os

DB_PATH = "/opt/m-panel/app/data/panel.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Veritabanı dosyası bulunamadı: {DB_PATH}. Migration atlanıyor.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

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

    # Helper to check column existence
    def column_exists(table, column):
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        return column in columns

    # Apply inbound migrations
    for col_name, col_type in inbound_cols:
        if not column_exists("inbounds", col_name):
            print(f"inbounds tablosuna {col_name} kolonu ekleniyor...")
            cursor.execute(f"ALTER TABLE inbounds ADD COLUMN {col_name} {col_type}")
            
    # Apply client migrations
    for col_name, col_type in client_cols:
        if not column_exists("clients", col_name):
            print(f"clients tablosuna {col_name} kolonu ekleniyor...")
            cursor.execute(f"ALTER TABLE clients ADD COLUMN {col_name} {col_type}")

    conn.commit()
    conn.close()
    print("Migration başarıyla tamamlandı.")

if __name__ == "__main__":
    migrate()
