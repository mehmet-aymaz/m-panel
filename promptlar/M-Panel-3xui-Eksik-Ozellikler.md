# M-Panel — Özellik Genişletme: 3x-ui Eksiklerini Tamamlama

## Sunucu Bilgileri
*(Önceki aşamalarda kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## ÖNCELİKLE — Checkpoint
Her aşamaya başlamadan önce ayrı ayrı checkpoint al:
```bash
cd /opt/m-panel
git add -A
git commit -m "CHECKPOINT: [aşama adı] öncesi"
git tag checkpoint-pre-[aşama-adı]
```
Yerelde de aynısını yap. Her checkpoint'ten sonra onay bekle.

## Genel Sıralama (Kolaydan Zora)
1. API Belgeleri
2. Panel Ayarları (2FA, Telegram Bot, port/path)
3. Gruplar
4. Xray Yapılandırmaları arayüzü
5. Giden Bağlantılar (Outbounds)
6. Düğümler (Multi-server)

**Her aşamayı ayrı ayrı tamamla, test et, rapor ver, onay al — sonra sıradakine geç. Hepsini tek seferde yapmaya çalışma.**

---

## AŞAMA 1 — API Belgeleri

FastAPI zaten otomatik Swagger UI üretir (`/docs` endpoint'i). Bu aşamada:
- Mevcut `/docs` sayfasının erişilebilir olduğunu doğrula (Nginx proxy ayarlarında bu path engelleniyor olabilir, kontrol et)
- Panel arayüzüne sol menüye "API Belgeleri" linki ekle, tıklandığında yeni sekmede `/api/docs`'u açsın
- API endpoint'lerinin açıklamalarını (FastAPI'deki `summary`/`description` parametreleri) gözden geçir, eksikse ekle ki dokümantasyon anlamlı olsun
- Üçüncü parti entegrasyon yapacak geliştiriciler için bir API key/token oluşturma mekanizması olup olmadığını kontrol et — yoksa basit bir "API Token" sayfası ekle (mevcut admin JWT'den ayrı, uzun ömürlü API erişim tokenları)

**Test:** `/api/docs` dışarıdan erişilebiliyor mu, tüm endpoint'ler dokümante mi.

---

## AŞAMA 2 — Panel Ayarları

Yeni bir "Panel Ayarları" sayfası ve bu sayfa altında alt sekmeler:

**2.1 Genel:**
- Oturum zaman aşımı süresi (şu an JWT 24 saat sabit, ayarlanabilir yap)
- Veritabanı yedekleme: manuel "Şimdi Yedekle" butonu (panel.db + xray config.json'u zip'leyip indirilebilir hale getir)

**2.2 Kimlik Doğrulama:**
- Admin şifre değiştirme formu (panelden, SSH'a gerek kalmadan)
- 2FA (Google Authenticator/TOTP) ekleme — `pyotp` kütüphanesi ile, kullanıcı QR kod tarayıp aktif etsin

**2.3 Telegram Bot:**
- Bot token ve chat ID girilen bir form
- Bildirim tetikleyicileri: sunucu CPU/RAM kritik seviye, kullanıcı süresi/kotası dolduğunda
- Basit bir Telegram bot entegrasyonu (`python-telegram-bot` veya doğrudan Telegram API)

**2.4 Abonelik (Subscription):**
- Zaten bir subscription linki özelliği var (`/api/sub/{uuid}`) — bu sayfada bu özelliğin ayarlarını (link formatı, ön ek, vb.) yönetilebilir hale getir

**Önemli:** Bu aşama hassas (şifre, 2FA, bot token). Her özelliği ekledikten hemen sonra test et, birini bitirmeden diğerine geçme.

**Test:** Şifre değiştirme, 2FA aktif/test, Telegram bildirimi gönderme, yedek alma/indirme.

---

## AŞAMA 3 — Gruplar

**Backend:**
- Yeni tablo: `groups` (id, name, description)
- `clients` tablosuna `group_id` (foreign key, nullable) ekle
- CRUD endpoint'leri: `/groups/` (GET/POST/PUT/DELETE)
- Toplu işlem endpoint'i: `/groups/{id}/bulk-update` (örn. tüm grup üyelerinin süresini uzat, kota değiştir)

**Frontend:**
- Yeni "Gruplar" sayfası: grup listesi, oluşturma/düzenleme/silme
- Kullanıcı ekleme/düzenleme formuna "Grup" dropdown'u ekle
- Kullanıcılar sayfasında gruba göre filtreleme

**Test:** Grup oluştur, birkaç kullanıcıyı gruba ata, toplu işlem dene (örn. grup bazlı süre uzatma).

---

## AŞAMA 4 — Xray Yapılandırmaları Arayüzü

**Dikkat: En hassas aşamalardan biri, dikkatli ilerle.**

**4.1 Routing Rules:**
- Mevcut `xray_manager.py`'deki routing mantığını arayüzden düzenlenebilir hale getir
- Basit kurallar: "şu domain/IP'ler direkt git", "şu protokol engellensin" gibi görsel kural ekleme arayüzü
- Backend'de bu kuralları veritabanında tut, config üretirken routing bloğuna ekle

**4.2 DNS:**
- DNS sunucu adresleri (DoH/DoT) için ayarlanabilir form
- `xray_manager.generate_config()`'e DNS bloğu üretimini ekle

**4.3 Gelişmiş (Ham JSON Editör):**
- Mevcut config.json'u görüntüleyip düzenleyebilen bir kod editörü (Monaco Editor veya CodeMirror)
- **Kritik güvenlik önlemi:** Kaydet butonuna basıldığında, önce JSON syntax doğrulaması yap, sonra mevcut `apply_config()`'teki rollback mekanizmasından geçir — bozuk JSON girilirse Xray restart başarısız olur, otomatik eski config'e dönsün ve kullanıcıya hata göster
- Bu özellik en son eklenmeli çünkü en riskli

**4.4 Temeller (Basic):**
- Xray-core versiyon bilgisini göster (zaten Genel Bakış'ta var)
- Log seviyesi ayarlanabilir dropdown (none/warning/info/debug)

**Test:** Her alt sekmeyi ayrı test et, özellikle 4.3'ü (ham JSON editör) kasıtlı bozuk JSON ile test ederek rollback'in çalıştığını doğrula.

---

## AŞAMA 5 — Giden Bağlantılar (Outbounds)

**Backend:**
- Yeni tablo: `outbounds` (id, tag, protocol, settings JSON)
- `xray_manager.generate_config()`'i, artık tek bir sabit `freedom` outbound yerine, veritabanındaki outbound listesini kullanacak şekilde güncelle
- Inbound'lara hangi outbound'u kullanacağını seçme alanı ekle (routing kuralı olarak)
- Yaygın senaryoları destekle: `freedom` (direkt), `blackhole` (engelle), `proxy` (başka bir sunucuya zincirleme)

**Frontend:**
- "Giden Bağlantılar" sayfası: outbound listesi, ekleme/düzenleme/silme
- Inbound formuna "Outbound" seçimi ekle (routing ile ilişkilendirme)

**Test:** Yeni bir outbound oluştur (örn. blackhole ile belirli bir trafik tipini engelleme), bir inbound'u ona yönlendir, davranışın doğru olduğunu doğrula.

---

## AŞAMA 6 — Düğümler (Multi-Server / Node Yönetimi)

**En büyük mimari değişiklik. Dikkatli planla.**

**Kavram:**
- Mevcut M-Panel sunucusu "Master" rolünde kalır (veritabanı, arayüz burada)
- Diğer sunucular "Node" olarak eklenir — her node'da sadece Xray-core çalışır, kendi config'i Master'dan gelir

**Backend:**
- Yeni tablo: `nodes` (id, name, ip_address, ssh_port, ssh_credentials_encrypted, status)
- Node ekleme: SSH ile bağlanıp Xray-core kurulumunu otomatikleştiren bir kurulum scripti (Aşama 1'de elle yaptığımız adımların otomasyonu)
- Inbound oluştururken hangi node'a deploy edileceğini seçme
- `xray_manager.apply_config()`'i, local config yazmak yerine SSH ile ilgili node'a config gönderip orada Xray restart edecek şekilde genişlet (mevcut local-only mantık Master/kendi sunucusu için fallback olarak kalmalı)
- Trafik istatistiklerini her node'dan toplayıp birleştiren bir senkronizasyon mekanizması (periyodik, örn. her 60 saniyede bir node'lardan veri çek)

**Frontend:**
- "Düğümler" sayfası: node listesi, durum (online/offline), ekleme formu (IP, SSH bilgileri)
- Inbound formuna "Hangi node'da çalışacak" seçimi

**Güvenlik notu:** SSH credential'larının veritabanında nasıl saklanacağı kritik — düz metin olmamalı, şifrelenmiş (örn. `cryptography` kütüphanesi ile Fernet) saklanmalı.

**Test:** Yeni bir test node ekle (üçüncü bir sunucu gerekebilir, bu konuda bana sor), oradan bir inbound oluştur, gerçekten o sunucuda Xray'in çalıştığını doğrula.

---

## Genel Kurallar (Tüm Aşamalar İçin)
- Her aşama kendi checkpoint'i ile başlasın
- Bir aşama bitmeden diğerine geçme, her birinde test sonucu raporla
- Mevcut çalışan özellikleri (Genel Bakış, Inbound/Client CRUD, UFW otomasyonu, responsive tasarım) bozmadığından emin ol
- Hassas aşamalarda (2, 4, 6) özellikle dikkatli ilerle, acele etme

## Her Aşama Sonunda Rapor Formatı
- Ne eklendi (liste)
- Nasıl test edildi, sonuç ne
- Bir sonraki aşamaya geçmeden önce dikkat edilmesi gereken bir şey var mı
