# M-Proxy VPN — Yeni Sunucu Seçeneği Ekleme: M-Panel (Xeon-2)

## ÖNCELİKLE — Checkpoint
Bu değişikliğe başlamadan önce M-Proxy VPN projesinde checkpoint al, böylece bir sorun çıkarsa "geri yükle" dediğimde şu anki çalışan duruma dönebiliriz:

```bash
cd [M-Proxy VPN proje yolu]
git add -A
git commit -m "CHECKPOINT: M-Panel sunucu eklemeden once stabil durum"
git tag checkpoint-pre-mpanel-server
```

Onay bekle, sonra devam et.

## Amaç
M-Proxy VPN uygulamasındaki `SERVERS` array'ine, mevcut `wmehmet.web.tr` sunucusuna **hiç dokunmadan**, yeni bir sunucu seçeneği eklemek. Bu yeni sunucu, M-Panel ile yönetilen Xeon-2 sunucusudur (`panel.mehmetaymaz.com.tr`).

## KRİTİK KURAL
Mevcut `wmehmet.web.tr` sunucusuna ait hiçbir kod, endpoint, veya ayar değiştirilmeyecek. Bu tamamen ek/yeni bir giriş, var olan hiçbir şeyi bozmamalı.

## Eklenecek Sunucu Bilgisi

Gerçek, test edilmiş VLESS bağlantı bilgisi:

```
vless://25775520-229b-5fdd-36d4-89d79341eca1@panel.mehmetaymaz.com.tr:443?type=ws&security=tls&encryption=none&sni=c.whatsapp.net&alpn=http%2F1.1&fp=chrome&path=%2F&host=c.whatsapp.net#Whatsapp-S%C4%B1n%C4%B1rs%C4%B1z-Mehmet%20Aymaz
```

Parametreler:
- **Sunucu adresi:** `panel.mehmetaymaz.com.tr`
- **Port:** 443
- **Network:** ws
- **Security:** tls
- **SNI:** c.whatsapp.net
- **ALPN:** http/1.1
- **Fingerprint:** chrome
- **WS Path:** /
- **WS Host:** c.whatsapp.net
- **UUID (test kullanıcı):** 25775520-229b-5fdd-36d4-89d79341eca1

## Yapılacaklar

### 1. SERVERS Array'e Yeni Giriş Ekle

`m_proxy_vpn.tsx` (veya SERVERS array'inin tanımlı olduğu dosya) içinde, mevcut WhatsApp/YouTube/Instagram sunucu girişlerinin yanına yeni bir giriş ekle:

```javascript
{
  id: [sıradaki uygun id],
  name: "WHATSAPP SINIRSIZ (M-PANEL)",
  domain: "panel.mehmetaymaz.com.tr",
  port: 443,
  sni: "c.whatsapp.net",
  network: "ws",
  path: "/",
  host: "c.whatsapp.net",
  ping: 0,
  pingUrl: "https://panel.mehmetaymaz.com.tr:8443/ping",  // M-Panel API'sinde bu endpoint yoksa not düş, eklenmesi gerekebilir
}
```
M-Proxy VPN Proje yolu : A:\M-Proxy VPN

**Not:** Mevcut sunucularda `pingUrl` alanı `https://wmehmet.web.tr:8443/ping` şeklindeydi (ayrı bir API sunucusundan). M-Panel'in böyle bir `/ping` endpoint'i olup olmadığını kontrol et — yoksa bu alanı geçici olarak boş bırak veya M-Panel backend'inde basit bir `/ping` endpoint'i eklenmesi gerektiğini bana bildir (ayrı bir görev olarak ele alırız).

### 2. UUID Doğrulama Akışını Kontrol Et

Mevcut UUID doğrulama akışı (`/api?uuid=...` çağrısı) `wmehmet.web.tr`'deki `api_server.py`'ye özel. M-Panel'in API yapısı farklı (FastAPI, JWT tabanlı, farklı endpoint isimleri). Bu yeni sunucu seçeneği için:

- Eğer kullanıcı bu sunucuyu seçtiğinde uygulamanın UUID doğrulaması yapması gerekiyorsa, M-Panel'in böyle bir public (kimlik doğrulama gerektirmeyen) UUID sorgu endpoint'i olup olmadığını kontrol et
- Yoksa, bu sunucu seçeneği için **basitleştirilmiş bir akış** kullanılabilir: kullanıcı doğrudan yukarıdaki UUID'yi girdiğinde, uygulama VLESS linkini sunucudan çekmek yerine **statik/sabit olarak** (yukarıdaki parametrelerle) oluştursun — bu, M-Panel'de henüz public API endpoint'i olmadığı için geçici bir çözüm olur
- Hangi yaklaşımı uyguladığını bana raporla, ihtiyaç varsa M-Panel tarafında ayrı bir görevle public endpoint ekleriz

### 3. Build ve Test

- Uygulamayı yeniden build et
- Yeni sunucu seçeneğinin listede göründüğünü doğrula
- Yukarıdaki test UUID'siyle bağlantı kurmayı dene, gerçekten internete çıkabiliyor mu doğrula
- Mevcut `wmehmet.web.tr` sunucularının (WhatsApp/YouTube/Instagram) hiçbirinin etkilenmediğini doğrula (hepsiyle ayrı ayrı bağlanmayı dene)

## Tamamlandığında Rapor Ver
- SERVERS array'ine eklenen tam giriş
- UUID doğrulama akışı için hangi yaklaşımı seçtiğin (statik link mi, M-Panel API'sine bağlanma mı)
- Test sonucu: yeni sunucuyla bağlantı kurulabiliyor mu
- Mevcut sunucuların etkilenmediğinin doğrulaması
