-- Nodes tablosu
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT DEFAULT 'root',
    password TEXT,
    ssh_key TEXT,
    xray_config_path TEXT DEFAULT '/usr/local/etc/xray/config.json',
    panel_port INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME
);

-- inbounds tablosuna node_id ekle (NULL = local node)
ALTER TABLE inbounds ADD COLUMN node_id INTEGER REFERENCES nodes(id);

-- Local node kaydı oluştur (mevcut sunucu)
INSERT OR IGNORE INTO nodes (id, name, host, port, username, is_active)
VALUES (1, 'Local', 'localhost', 22, 'root', 1);
