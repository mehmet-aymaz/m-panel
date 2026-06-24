# M-Panel Mobile — Android Uygulaması Proje Planı

## Amaç
M-Panel web yönetim panelinin tüm işlevlerini (Genel Bakış, Inbound/Client yönetimi, sistem izleme ve ileride eklenecek Gruplar/Outbounds/Nodes) Android'den native olarak kullanabilmek.

## Teknoloji
**Flutter.** Sebepleri:
- Daha önce M-Proxy Dashboard projesi için de değerlendirilmişti, aynı karar geçerli
- Android + ileride Windows için tek kod tabanı
- Backend zaten REST API (FastAPI) olarak hazır — Flutter'ın `http`/`dio` paketleriyle doğrudan entegre olur
- Karanlık tema, kart/grafik ağırlıklı arayüzler için olgun kütüphane desteği var (`fl_chart` grafikler için)

## Mimarinin Genel Hatları
```
[Flutter Mobile App] <--HTTPS/REST--> [Mevcut M-Panel FastAPI Backend]
                                              |
                                    (panel.mehmetaymaz.com.tr:8443/api)
```
Yeni bir backend gerekmiyor — mevcut M-Panel API'si zaten JWT tabanlı, mobil app aynı endpoint'leri kullanacak. Web panel ile mobil app paralel, aynı veriye bakan iki istemci olacak.

## Geliştirme Sırası

### 1. Proje Kurulumu ve Kimlik Doğrulama
- Flutter projesi oluştur
- Giriş ekranı: kullanıcı adı/şifre, `POST /api/auth/login`
- JWT token'ı `flutter_secure_storage` ile cihazda güvenli sakla
- Token süresi dolunca otomatik logout + giriş ekranına yönlendirme
- "Sunucu adresi" ayarlanabilir olsun (varsayılan `panel.mehmetaymaz.com.tr:8443`) — ileride Düğümler özelliğiyle birden fazla M-Panel kurulumu olabileceği için esnek bırak

### 2. Genel Bakış Ekranı
- CPU/RAM/Disk/Swap kartları (`GET /api/system/status`)
- Xray durumu, versiyon, çalışma süresi
- Kullanıcı özet kartı (toplam/aktif/süresi dolmuş)
- Pull-to-refresh ile manuel yenileme + periyodik otomatik yenileme (örn. 10 saniyede bir, web'deki gibi)

### 3. Inbound Yönetimi
- Liste ekranı: remark, port, protokol, durum, trafik
- Detay/düzenleme ekranı: web'deki genişletilmiş form alanlarının (network, security, SNI, WS path/host, gRPC service name, sniffing) mobil karşılığı
- Yeni ekleme akışı
- Silme (onay diyaloğuyla)

### 4. Kullanıcı (Client) Yönetimi
- Liste ekranı: email, inbound, kota, kalan süre, durum
- Detay/düzenleme ekranı: limit_ip, telegram ID, comment, flow, manuel/otomatik UUID seçimi
- VLESS linkini görüntüleme + kopyalama + QR kod gösterme (mobil için özellikle faydalı — müşteriye QR okutarak bağlantı verebilirsin)
- Trafik sıfırlama, aktif/pasif toggle

### 5. Bildirimler (İleride Telegram Bot özelliğiyle paralel düşünülebilir)
- Push notification altyapısı (Firebase Cloud Messaging) — kullanıcı süresi dolmak üzereyken, sunucu kritik seviyedeyken bildirim
- Bu özellik backend'de Aşama 2 (Panel Ayarları / Telegram Bot) tamamlandıktan sonra daha anlamlı olur, şimdilik iskelet bırakılabilir

## Tasarım Yönü
- Web panelle tutarlı: karanlık tema, mor/camgöbeği vurgular, cam morfolojisi hissi
- Material 3 (Flutter'ın güncel tasarım dili) üzerine özelleştirilmiş tema

## Güvenlik Notları
- API token'ı cihazda düz metin saklama, `flutter_secure_storage` (Android Keystore tabanlı) kullan
- Sertifika doğrulamasını atlama (yani `badCertificateCallback` ile SSL hatalarını yok sayma) — production'da kesinlikle yapılmamalı

## Test Senaryosu
1. Giriş yap, token saklanıyor mu doğrula (uygulamayı kapatıp aç, oturum devam ediyor mu)
2. Genel Bakış'ta gerçek sunucu verisi görünüyor mu
3. Mobilden yeni bir test inbound + kullanıcı oluştur, web panelde de göründüğünü doğrula (iki istemcinin aynı veriye baktığını kanıtlar)
4. Mobilden oluşturulan kullanıcının VLESS linkiyle gerçekten bağlantı kurulabiliyor mu

## Antigravity'ye Görev Tanımı
1. Flutter proje iskeletini oluştur, yukarıdaki sırayla ilerle
2. Her ekran ayrı test edilebilir parça olarak teslim edilsin
3. Mevcut M-Panel backend'ine yeni bir endpoint eklemen gerekirse (örn. mobile-specific bir optimizasyon), önce bana sor — backend web panel ile paylaşılıyor, dikkatli olunmalı
4. APK build edip test için paylaş

Bu plan onaylandıktan sonra Antigravity'ye verilecek.
