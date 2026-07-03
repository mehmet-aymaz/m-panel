# M-Panel — Aşama 5: Aynı Sunucuda VPN Trafiği Desteği

## Sunucu Bilgileri
*(Önceki aşamalarda kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## ÖNCELİKLE — Checkpoint
```bash
cd /opt/m-panel
git add -A
git commit -m "CHECKPOINT: Asama 5 oncesi - port 443 paylasimi degisikligi oncesi"
git tag checkpoint-pre-stage5
```
Yerelde de aynısını yap. Onay bekle, sonra devam et.

## Sorun
Şu anda Xeon-2 sunucusunda (`panel.mehmetaymaz.com.tr`) Nginx, panel arayüzünü 443 portunda (HTTPS) sunuyor. Aynı sunucuda gerçek VPN trafiği (Xray inbound'ları) için kullanıcı port 443 veya 80 vermeye çalıştığında çakışma oluyor çünkü bu portlar zaten Nginx tarafından kullanımda.

## Çözüm Yönü (Onaylandı)
SNI-based routing gibi karmaşık bir çözüme gitmiyoruz. Bunun yerine:
- **Panel (Nginx)** mevcut 443 portunda kalsın, hiçbir değişiklik gerekmiyor
- **VPN trafiği (Xray inbound'ları)** port 443 ve 80'i serbestçe kullanabilsin — Nginx bu işin dışında kalsın

Bekle — bu ikisi doğrudan çakışıyor çünkü ikisi de aynı IP üzerinde aynı portu istiyor. Bu yüzden gerçek çözüm şu olacak: **panel arayüzü farklı bir porta (8443) taşınacak**, VPN trafiği (Xray inbound'ları) gerçek 443 ve 80 portlarını serbestçe kullanabilecek. Bu, `wmehmet.web.tr` sunucusundaki 3x-ui kurulumunun da kullandığı yöntemle aynı mantık (panel paneli ayrı port, gerçek trafik portları boş).

## Yapılacaklar

### 1. Nginx Konfigürasyonunu Port 8443'e Taşı

`/etc/nginx/sites-enabled/default` dosyasını güncelle:
- Mevcut `listen 443 ssl` direktiflerini `listen 8443 ssl` olarak değiştir
- SSL sertifika ayarları (Certbot'un eklediği) aynı kalsın
- `listen 80` bloğu varsa (genelde HTTP→HTTPS redirect için) bunu da kaldır veya farklı bir porta taşı — port 80'i tamamen Xray'e bırakacağız
- Değişiklik öncesi mevcut dosyayı yedekle

### 2. Firewall Kurallarını Güncelle

```bash
ufw allow 8443/tcp
ufw allow 443/tcp
ufw allow 80/tcp
```
(443 ve 80 zaten açıktı muhtemelen ama Xray'in bu portları gerçekten dinleyebildiğini doğrula)

### 3. Backend CORS/URL Ayarlarını Kontrol Et

Frontend'in API'ye yaptığı çağrılar (`api.js` içindeki base URL) hâlâ doğru çalışıyor mu kontrol et — panel artık `https://panel.mehmetaymaz.com.tr:8443` üzerinden erişilecek, `/api/` proxy yönlendirmesi bu yeni portta da çalışmalı.

### 4. Inbound Ekleme Validasyonunu Güncelle

`routers/inbounds.py`'deki port çakışma kontrolünü gözden geçir:
- Şu an muhtemelen sadece veritabanındaki diğer inbound'larla çakışmayı kontrol ediyor
- Buna ek olarak, **sistemde gerçekten kullanımda olan portları** da kontrol etmeli (örn. 8443 artık Nginx'in kullandığı port, SSH'ın 22'si gibi) — bu portlara inbound eklenmeye çalışılırsa anlamlı bir hata dönsün
- Artık 443 ve 80 inbound için **izin verilen** portlar olmalı (önceki kısıtlama varsa kaldır)

### 5. Test Et

1. `nginx -t` ile config syntax kontrolü, sonra `systemctl reload nginx`
2. Panelin yeni adresten (`https://panel.mehmetaymaz.com.tr:8443`) hâlâ erişilebilir olduğunu doğrula
3. Panelden port 443 üzerinde yeni bir test inbound (VLESS + WS + TLS, SNI spoofing senaryosu) oluştur
4. `systemctl status xray` ile Xray'in 443'ü başarıyla dinlediğini doğrula (`ss -tlnp | grep 443` ile de kontrol edilebilir)
5. Oluşan VLESS linkini gerçekten bir VPN istemcisinde (NPV Tunnel gibi) test et, bağlantı kurulabiliyor mu

## Önemli Notlar
- Bu değişiklik panelin erişim adresini değiştireceği için (artık `:8443` eklenmesi gerekecek), DNS veya domain tarafında ekstra bir şey yapmana gerek yok, sadece URL'ye port ekleniyor
- Mevcut test/gerçek panel kullanıcıları (admin girişi) bu değişiklikten etkilenmemeli, sadece erişim portu değişiyor

## Tamamlandığında Rapor Ver
- Nginx config'inde ne değişti
- Firewall kuralları durumu
- Test sonucu: panelin yeni port üzerinden erişilebilirliği + port 443'te oluşturulan test inbound'un gerçek bir VPN istemcisinde çalışıp çalışmadığı
