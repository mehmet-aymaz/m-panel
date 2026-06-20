# M-Panel — Aşama 4.5: Inbound & Kullanıcı Formlarını Genişletme

## Sunucu Bilgileri
*(Önceki aşamalarda kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## ÖNCELİKLE — Checkpoint
Bu aşamaya başlamadan önce hem backend hem frontend için checkpoint al:

```bash
cd /opt/m-panel
git add -A
git commit -m "CHECKPOINT: Asama 4.5 oncesi - temel CRUD formlari calisir durumda"
git tag checkpoint-pre-stage45
```

Yerelde `a:\M-Panel` için de aynısını yap. Onay bekle, sonra devam et.

## Bağlam
Aşama 4 tamamlandı: Inbound ve Client CRUD işlemleri gerçek API'ye bağlı, rollback mekanizması çalışıyor. Ancak mevcut formlar çok temel alanlar içeriyor (Inbound: remark/protocol/port — Client: email/uuid/total_gb/expiry_days). Gerçek bir Xray/3x-ui paneli çok daha fazla yapılandırma seçeneği sunar. Bu aşamada formları genişletip gerçek kullanım senaryolarını destekler hale getireceğiz.

## Şimdiki Görev

### Bölüm A: Inbound Formu Genişletme

**Backend (`routers/inbounds.py`, `xray_manager.py`):**

`POST /inbounds/` ve `PUT /inbounds/{id}` body'sine şu alanları ekle:

- `network` (string): `"ws"`, `"tcp"`, `"grpc"` — varsayılan `"ws"`
- `security` (string): `"tls"`, `"reality"`, `"none"` — varsayılan `"tls"`
- `sni` (string, opsiyonel): TLS serverName / SNI değeri (örn. `c.whatsapp.net` gibi spoofing senaryoları için)
- `ws_path` (string, opsiyonel): WebSocket path, varsayılan `"/"`
- `ws_host` (string, opsiyonel): WebSocket Host header
- `sniffing_enabled` (bool): varsayılan `true`
- `grpc_service_name` (string, opsiyonel): sadece network=grpc ise kullanılır

`xray_manager.generate_config()` fonksiyonunu bu alanları gerçek Xray `streamSettings` JSON yapısına dönüştürecek şekilde güncelle:

```json
{
  "network": "ws",
  "security": "tls",
  "tlsSettings": {"serverName": "..."},
  "wsSettings": {"path": "...", "headers": {"Host": "..."}}
}
```

`security: "none"` seçiliyse `tlsSettings` hiç eklenmesin. `network: "grpc"` seçiliyse `wsSettings` yerine `grpcSettings` eklensin.

**Frontend (`Inbounds.jsx`):**

Ekleme/düzenleme formuna şu alanları ekle:
- Protokol dropdown: VLESS, VMess, Trojan
- Network dropdown: WS, TCP, gRPC (seçime göre alttaki alanlar değişsin — örn. gRPC seçilince WS path alanı gizlensin, Service Name görünsün)
- Security dropdown: TLS, Reality, None
- SNI input (security=TLS veya Reality iken görünsün)
- WS Path / WS Host input (network=WS iken görünsün)
- gRPC Service Name input (network=gRPC iken görünsün)
- Sniffing aç/kapa toggle

### Bölüm B: Kullanıcı (Client) Formu Genişletme

**Backend (`routers/clients.py`):**

`POST /clients/` ve `PUT /clients/{id}` body'sine şu alanları ekle:

- `limit_ip` (int, opsiyonel): varsayılan `0` (sınırsız)
- `tg_id` (string, opsiyonel): Telegram ID
- `comment` (string, opsiyonel): not alanı
- `flow` (string, opsiyonel): örn. `"xtls-rprx-vision"` — sadece VLESS+TLS/Reality kombinasyonunda anlamlı, diğer durumlarda boş bırakılabilir
- `uuid` alanı: hâlâ otomatik üretilebilir ama kullanıcı isterse manuel UUID girebilsin (body'de `uuid` boş gelirse otomatik üret, doluysa onu kullan — format doğrulaması yap, geçersiz UUID formatı hata dönsün)

**Frontend (`Clients.jsx`):**

Forma şu alanları ekle:
- IP Limit input (sayısal, 0 = sınırsız)
- Telegram ID input
- Not/Comment textarea
- Flow dropdown (boş, xtls-rprx-vision) — sadece seçilen inbound'un security'si TLS/Reality ise göster, değilse gizle veya devre dışı bırak
- UUID alanı: varsayılan olarak "otomatik oluştur" seçili, kullanıcı isterse "manuel gir" seçeneğine geçip kendi UUID'sini yazabilsin

### Bölüm C: Veritabanı Şeması Güncelleme

Yukarıdaki yeni alanları barındıracak şekilde `models.py`'deki `Inbound` ve `Client` tablolarını güncelle. Mevcut veritabanında zaten kayıt olduğu için (test kayıtları), migration'ı dikkatli yap:
- SQLite'da yeni kolon eklerken `ALTER TABLE ADD COLUMN` kullan (varsayılan değerlerle), mevcut tabloyu silip yeniden oluşturma
- Mevcut test kayıtlarının (varsa) bozulmadığından emin ol

### Bölüm D: Doğrulama ve Hata Mesajları

- Geçersiz UUID formatı girilirse anlaşılır hata
- `network: "grpc"` seçiliyken `grpc_service_name` boşsa hata
- `flow` alanı VLESS olmayan bir protokolde doluysa, backend bunu sessizce yok sayabilir (hata vermesine gerek yok, sadece config'e eklemesin)

## Test Senaryosu
Tamamlandığında birlikte test edeceğiz:
1. Yeni bir inbound oluştur: VLESS + WS + TLS, SNI = `c.whatsapp.net` (M-Proxy projesindeki gerçek senaryo gibi)
2. O inbound'a, flow alanı boş, limit_ip=2, comment="test kullanıcı" ile bir client ekle
3. `cat /usr/local/etc/xray/config.json | jq` ile SNI ve diğer tüm alanların doğru yazıldığını doğrula
4. Reality + gRPC kombinasyonuyla ikinci bir inbound dene, config'in doğru üretildiğini doğrula

## Önemli Kurallar
- Bölüm A ve B'yi ayrı ayrı tamamla, her birini test edilebilir teslim et
- Form karmaşıklaşacağı için kullanıcı deneyimini bozmamaya dikkat et — alakasız alanları gizlemek (yukarıda belirtildiği gibi) önemli
- Daha önce unuttuğumuz Bölüm E rollback testini (kasıtlı port çakışması) bu turda da yapmayı unutma — backend'i bu kadar genişlettikten sonra rollback mantığının hâlâ sağlam çalıştığını doğrulamak özellikle önemli

## Tamamlandığında Rapor Ver
- Hangi yeni alanlar eklendi (liste)
- Veritabanı migration'ının nasıl yapıldığı, mevcut veri kaybı olup olmadığı
- Test senaryosu sonuçları (config.json çıktısıyla)
- Rollback testinin sonucu
