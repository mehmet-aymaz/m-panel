# M-Panel Mobile 📱

[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-0175C2?style=for-the-badge&logo=dart&logoColor=white)](https://dart.dev)
[![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://android.com)

M-Panel, Xray-core tabanlı sunucularınızı mobil cihazlarınız üzerinden kolayca yönetmenizi sağlayan modern, şık ve güçlü bir **Flutter** mobil uygulamasıdır. M-Panel FastAPI backend sunucunuzla güvenli API entegrasyonu kurarak çalışır.

---

## ✨ Özellikler

* 🔐 **Güvenli Kimlik Doğrulama:** JWT Token tabanlı oturum yönetimi ve **İki Faktörlü Doğrulama (2FA/OTP)** desteği.
* 📊 **Gerçek Zamanlı Sunucu İzleme:**
  * CPU, RAM, Disk ve Swap kullanımı için dairesel göstergeler.
  * Anlık ağ yükleme (Upload) ve indirme (Download) hız göstergeleri.
  * Toplam kullanılan ağ trafiği verisi.
* ⚙️ **Xray Servis Yönetimi:** Xray servisini uzaktan başlatma, durdurma ve yeniden başlatma işlemleri.
* 🌐 **Inbound (Giriş) Yönetimi:** Tüm protokol detayları (VLESS, VMess, Trojan, Shadowsocks) ve gelişmiş güvenlik/iletim ayarlarıyla yeni girişler ekleme, düzenleme ve silme.
* 👥 **Client (Kullanıcı) Yönetimi:**
  * Kota ve süre limitlerine sahip yeni kullanıcılar ekleme.
  * VLESS/VMess bağlantı linkini kopyalama ve **QR Kod** ile hızlı paylaşım.
  * Tek tıkla trafik sıfırlama veya kullanıcısı aktifleştirme/devre dışı bırakma.
* 🎨 **Tema ve Dil Desteği:**
  * 7 farklı özel tema seçeneği (Cyberpunk, Dracula, Nord, Emerald, Light, Dark, Gold).
  * Çoklu dil desteği (Türkçe, English, Deutsch).
* 🔄 **Otomatik Güncelleme:** GitHub üzerinden tek tıkla yeni sürümleri kontrol etme ve uygulama içerisinden güncelleme.

---

## 🛠️ Kurulum & Yapılandırma

### Geliştirici Ortamı Kurulumu

1. **Flutter SDK'sının yüklü olduğundan emin olun:**
   ```bash
   flutter doctor
   ```
2. **M-Panel ana klasöründen `mobile` klasörüne geçiş yapın:**
   ```bash
   cd mobile
   ```
3. **Bağımlılıkları yükleyin:**
   ```bash
   flutter pub get
   ```
4. **Projeyi çalıştırın:**
   ```bash
   flutter run
   ```

---

## 🔐 Güvenlik

* Hassas veriler ve API anahtarları cihaz üzerinde Android Keystore tabanlı `flutter_secure_storage` kullanılarak şifrelenmiş olarak saklanır.
* Sunucu adresi girilirken protokol ön eki (`https://`) belirtilmediğinde sistem otomatik olarak HTTPS protokolünü yapılandırır.

---

## 📄 Lisans

Bu proje MIT Lisansı ile lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına göz atabilirsiniz.
