# M-Panel — Aşama 3: Frontend Geliştirme

## Sunucu Bilgileri
*(Aşama 2'de kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## Bağlam
Aşama 1 (sunucu kurulumu) ve Aşama 2 (FastAPI backend) tamamlandı ve doğrulandı:
- Backend çalışıyor: `https://panel.mehmetaymaz.com.tr/api/health` → `{"status":"ok","xray_active":true}`
- JWT tabanlı `/api/auth/login` endpoint'i hazır
- Xray config yönetimi (`xray_manager.py`) backend'de mevcut
- SSL aktif, Nginx reverse proxy `/api/` → FastAPI yönlendirmesi çalışıyor

## Teknoloji
React + Vite (önerin onaylandı). Karanlık mod varsayılan tema olsun.

## Tasarım Yönü
- Modern, premium görünüm — 3x-ui'nin sade/eski arayüzünden belirgin şekilde ayrışsın
- Karanlık mod ana tema (3x-ui ekran görüntülerinde gördüğümüz koyu lacivert/siyah tonlara benzer ama daha rafine)
- Dairesel/kart tabanlı sistem göstergeleri (CPU, RAM, disk, swap)
- Grafikler için bir chart kütüphanesi kullan (recharts veya chart.js)

## Geliştirilecek Sayfalar (Sırasıyla, Her Biri Ayrı Test Edilebilir Parça Olarak)

### 1. Giriş Ekranı
- Kullanıcı adı/şifre formu
- `/api/auth/login`'e istek at, JWT'yi `localStorage`'da sakla
- Token süresi dolunca otomatik logout + giriş ekranına yönlendirme
- Hatalı giriş için kullanıcı dostu hata mesajı

### 2. Genel Bakış (Dashboard Ana Sayfa)
- CPU, RAM, Disk, Swap kullanımı — dairesel gösterge kartları
- Xray durumu (çalışıyor/durdu), versiyon, çalışma süresi kartı
- Toplam kullanıcı sayısı, aktif/süresi dolmuş/pasif özet kartı
- Bu veriler için backend'de henüz `/api/dashboard/stats` gibi bir endpoint yoksa, **önce bana sor** — backend'de eksik bir endpoint varsa onu da bu turda ekleyebilirsin ama beni bilgilendirerek ilerle

### 3. Inbound Yönetimi Sayfası
- Tablo: tüm inbound'lar (remark, port, protokol, durum, trafik)
- Backend'de inbound CRUD endpoint'leri henüz yoksa (Aşama 2 planında "ayrı turda yapılacak" denmişti), bu sayfanın UI'sını yaz ama API entegrasyonunu placeholder bırak ve bana bildir — önce backend'de bu endpoint'leri eklememiz gerekecek

### 4. Kullanıcı (Client) Yönetimi Sayfası
- Tablo: tüm kullanıcılar (email, inbound, kota, kalan süre, durum)
- Aynı şekilde, backend endpoint'i yoksa UI'yı hazırla, entegrasyonu bekletip bildir

## Önemli Kurallar
- **Önce mevcut backend endpoint'lerini listele** (`/api/` altında neler var, bir `curl` veya FastAPI'nin otomatik `/docs` sayfasından kontrol et) — hangi sayfaların tam entegre, hangilerinin placeholder kalacağını buna göre belirle
- Her sayfa bittiğinde ekran görüntüsü alıp bana göster (mümkünse), en azından hangi route'ların çalıştığını bildir
- Inbound ve Client CRUD endpoint'leri backend'de eksikse, bu turda frontend'i tamamladıktan sonra backend'e dönüp onları ekleyeceğiz — şimdi sırayı karıştırma, önce mevcut olanla frontend iskeletini kur

## Deployment
Frontend build edilip Nginx üzerinden `panel.mehmetaymaz.com.tr` kök path'inde servis edilecek (build çıktısı `/var/www/html/`'e konabilir, mevcut Nginx default sayfasının yerine geçecek — bunu yaparken yedek al).

## Tamamlandığında Rapor Ver
- Hangi sayfalar tam fonksiyonel (gerçek API'ye bağlı)
- Hangi sayfalar placeholder/UI-only
- Backend'de eksik bulduğun endpoint'lerin listesi
- `https://panel.mehmetaymaz.com.tr` adresinden giriş ekranı görünüyor mu
