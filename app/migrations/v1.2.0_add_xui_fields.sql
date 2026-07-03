-- v1.2.0: 3x-ui API tabanlı çoklu sunucu desteği için nodes tablosuna yeni alanlar
-- SSH alanları geriye dönük uyumluluk için bırakılıyor

-- Bağlantı türü: 'ssh' (eski) veya 'xui_api' (yeni 3x-ui API)
ALTER TABLE nodes ADD COLUMN node_type TEXT DEFAULT 'ssh';

-- 3x-ui panel URL (örn: https://wmehmet.web.tr:2053)
ALTER TABLE nodes ADD COLUMN url TEXT;

-- 3x-ui login kullanıcı adı
ALTER TABLE nodes ADD COLUMN xui_username TEXT;

-- 3x-ui login şifresi (Fernet ile şifreli)
ALTER TABLE nodes ADD COLUMN xui_password TEXT;

-- Son bağlantı durumu: 'unknown' / 'online' / 'offline' / 'error'
ALTER TABLE nodes ADD COLUMN last_status TEXT DEFAULT 'unknown';
