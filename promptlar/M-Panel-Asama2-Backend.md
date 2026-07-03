# M-Panel — Aşama 2: FastAPI Backend Geliştirme

## Sunucu Bilgileri
*(Antigravity'ye tam yetki veriliyor, doğrudan SSH ile bağlanıp işlem yapacak)*

- **Sunucu IP:** [185.254.28.210]
- **SSH Kullanıcı:** root
- **SSH Şifre / Key:** mehmet_1905
- **SSH Port:** 22

---

## Bağlam
M-Panel projesinin Aşama 1'i tamamlandı. Sunucuda şunlar hazır:

- Python 3.10 venv: `/opt/m-panel/venv` (fastapi, uvicorn, python-jose, passlib, psutil kurulu)
- Node.js 20.x kurulu
- Nginx + Certbot kurulu
- **SSL sertifikası alındı: `panel.mehmetaymaz.com.tr` için** (`/etc/letsencrypt/live/panel.mehmetaymaz.com.tr/`) — panel bu domain üzerinden erişilecek
- Ayrıca `api.mehmetaymaz.com.tr` de DNS'te aynı sunucuya yönlendirilmiş durumda (ileride backend API için ayrı subdomain olarak kullanılabilir, şimdilik gerekli değil)
- Xray-core v26.3.27 kurulu, systemd servisi olarak çalışıyor (`xray.service`), config: `/usr/local/etc/xray/config.json`
- UFW firewall aktif (22, 80, 443 portları açık)
- Sunucu yakın zamanda reboot edildi (kernel güncellemesi nedeniyle), tüm servisler tekrar ayağa kalkmış olmalı — devam etmeden önce `systemctl status xray nginx` ile doğrula

## Şimdiki Görev — Aşama 2: FastAPI Backend Geliştirme

Proje yapısını `/opt/m-panel/app/` altında oluştur:

```
/opt/m-panel/
├── venv/                     (zaten var)
├── app/
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── models.py
│   ├── xray_manager.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── inbounds.py
│   │   ├── clients.py
│   │   └── system.py
│   └── data/
│       └── panel.db
```

### Sırayla şu adımları uygula, her birini ayrı ayrı test edilebilir şekilde teslim et:

**1. Veritabanı şeması** (`database.py`, `models.py`):
- `admin_users` tablosu: id, username, password_hash
- `inbounds` tablosu: id, remark, protocol, port, settings (JSON text), stream_settings (JSON text), enable, up, down, total, expiry_time
- `clients` tablosu: id, inbound_id (foreign key), email, uuid, total_gb, expiry_time, up, down, enable
- Başlangıçta bir admin kullanıcı oluşturan bir seed script de ekle (kullanıcı adı/şifreyi env variable'dan oku, hardcode etme)

**2. Kimlik doğrulama** (`auth.py` + `routers/auth.py`):
- `POST /auth/login` — kullanıcı adı/şifre doğrula, JWT token döndür
- JWT secret'ı `.env` dosyasından oku (rastgele güçlü bir secret üret ve `.env`'e yaz)
- Token süresi 24 saat
- Diğer tüm router'larda kullanılacak bir `get_current_user` dependency'si yaz

**3. Xray config yönetimi** (`xray_manager.py`) — EN KRİTİK PARÇA:
- `generate_config()`: veritabanındaki inbounds + clients'tan Xray'in anlayacağı tam `config.json` formatını üret
- `apply_config()`:
  - a) Mevcut `/usr/local/etc/xray/config.json`'u `/usr/local/etc/xray/config.json.backup` olarak yedekle
  - b) Yeni config'i yaz
  - c) `systemctl restart xray` çalıştır
  - d) 2 saniye bekle, `systemctl is-active xray` kontrol et
  - e) Eğer "active" değilse: backup'ı geri yükle, tekrar restart et, hata fırlat ve API yanıtında detaylı hata mesajı dön
  - f) Başarılıysa onay dön
- Bu fonksiyonu izole, iyi test edilmiş şekilde yaz çünkü tüm CRUD endpoint'leri buna bağımlı olacak

**4. `main.py`:** FastAPI app'i oluştur, CORS ayarlarını yap (frontend `https://panel.mehmetaymaz.com.tr`'den çağıracak şekilde), router'ları include et, `/health` endpoint'i ekle

**5. Systemd servisi oluştur:**
```ini
[Unit]
Description=M-Panel FastAPI Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/m-panel/app
ExecStart=/opt/m-panel/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Dosya adı: `/etc/systemd/system/m-panel-api.service`

**6. Nginx reverse proxy ayarla:** `panel.mehmetaymaz.com.tr` üzerinden gelen `/api/` isteklerini `127.0.0.1:8000`'e yönlendir. Mevcut Certbot SSL ayarlarını koru, sadece location bloğu ekle. Nginx config dosyasını değiştirmeden önce yedeğini al (`cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup`).

### Her adımdan sonra:
- Hangi dosyaları oluşturduğunu/değiştirdiğini listele
- Servisi başlatıp `systemctl status m-panel-api` çıktısını paylaş
- `curl http://127.0.0.1:8000/health` ile doğrula
- Nginx config değiştiyse `nginx -t` ile syntax kontrolü yap, sonra reload et
- Sıradaki adıma geç

### Henüz yapma:
Inbound/Client CRUD endpoint'lerini (adım 3'teki `xray_manager.py` sağlamlaştıktan sonra, ayrı bir turda yapılacak).

### Tamamlandığında özet rapor ver:
- Hangi dosyalar oluştu
- Servis durumu
- Health check sonucu
- `https://panel.mehmetaymaz.com.tr/api/health` dışarıdan da erişilebiliyor mu
