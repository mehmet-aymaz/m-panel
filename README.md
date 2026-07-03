# M-Panel 🎛️

Modern, açık kaynak kodlu VPN/Proxy yönetim paneli ve mobil uygulaması. Xray-core tabanlı olup, 3x-ui paneline modern ve mobil destekli güçlü bir alternatiftir.

Bu depo hem **Web Yönetim Panelini** hem de **Flutter Mobil Uygulamasını** içermektedir.

---

## 📂 Proje Yapısı (Project Structure)

- **`app/`**: Python FastAPI tabanlı backend servis kodları.
- **`frontend/`**: Vite + React tabanlı web yönetim arayüzü.
- **`mobile/`**: Flutter tabanlı mobil istemci uygulaması (Android/iOS).
- **`install.sh`**: Sunucu kurulum scripti.

---

## 🌐 1. Web Yönetim Paneli (M-Panel Web)

### ✨ Özellikler (Features)
- **Protokol Desteği:** VLESS, VMess, Trojan, Shadowsocks protokol desteği.
- **Gerçek Zamanlı İzleme:** Anlık CPU, RAM, Disk, Swap ve ağ trafiği kullanımı.
- **Abonelik (Subscription) Yönetimi:** Kullanıcılara özel kota ve süre limitli abonelik linkleri.
- **Telegram Bot Entegrasyonu:** Bot üzerinden trafik izleme, kullanıcı bildirimleri ve yönetim.
- **API Token Sistemi:** Üçüncü parti entegrasyonlar için güvenli API erişimi.
- **Modern Arayüz:** Karanlık ve açık tema destekli, akıcı kullanıcı deneyimi.

### 🚀 Sunucu Kurulumu (Server Installation - One Command)
Ubuntu veya Debian tabanlı sunucunuzda aşağıdaki komut ile tek tıkla kurulum yapabilirsiniz:
```bash
bash <(curl -s https://raw.githubusercontent.com/mehmet-aymaz/m-panel/main/install.sh)
```

### 🧹 Kaldırma (Uninstall)
```bash
bash <(curl -s https://raw.githubusercontent.com/mehmet-aymaz/m-panel/main/install.sh) --uninstall
```

---

## 📱 2. Mobil Uygulama (M-Panel Mobile)

FastAPI sunucunuza uzaktan bağlanarak sunucu ve kullanıcı yönetimini cebinizden yapmanızı sağlayan modern bir **Flutter** uygulamasıdır.

### ✨ Özellikler (Features)
- 🔐 **JWT Yetkilendirme & 2FA:** Güvenli giriş ve iki aşamalı doğrulama desteği.
- 📊 **Cepte Sunucu Takibi:** CPU, RAM, Disk, anlık indirme/yükleme hız grafikleri.
- ⚙️ **Uzaktan Servis Yönetimi:** Xray servisini başlatma, durdurma ve yeniden başlatma.
- 🌐 **Inbound & Kullanıcı Yönetimi:** Telefonunuzdan yeni giriş portları (VLESS/VMess/Trojan) oluşturma ve kullanıcılara ait QR kodları anında paylaşma.
- 🎨 **Çoklu Tema:** Cyberpunk, Dracula, Nord, Emerald gibi 7 farklı görsel tema seçeneği.

### 🛠️ Geliştirici Ortamı Kurulumu (Mobile Local Setup)
1. **`mobile` klasörüne geçiş yapın:**
   ```bash
   cd mobile
   ```
2. **Flutter bağımlılıklarını indirin:**
   ```bash
   flutter pub get
   ```
3. **Uygulamayı çalıştırın:**
   ```bash
   flutter run
   ```

---

## 🔐 Güvenlik (Security)
* Tüm hassas API anahtarları mobil cihazda Android Keystore ve iOS Keychain tabanlı `flutter_secure_storage` kullanılarak şifreli tutulur.
* Sunucu veritabanı sorguları SQL injection açıklarına karşı parametrik olarak korunmaktadır.

## 📄 Lisans (License)
Bu proje **MIT Lisansı** ile lisanslanmıştır.
