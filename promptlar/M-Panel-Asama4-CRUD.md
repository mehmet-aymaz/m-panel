# M-Panel — Aşama 4: Backend CRUD Tamamlama + Frontend Entegrasyonu

## Sunucu Bilgileri
*(Önceki aşamalarda kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## ÖNCELİKLE — Bu Aşama İçin Checkpoint
Backend ve frontend için ayrı ayrı checkpoint oluştur, böylece bir sorun çıkarsa "geri yükle" dediğimde şu anki çalışan duruma (taslak modlu ama stabil panel) dönebiliriz:

```bash
cd /opt/m-panel
git init 2>/dev/null
git add -A
git commit -m "CHECKPOINT: Asama 4 oncesi - taslak CRUD ile stabil durum"
git tag checkpoint-pre-stage4
```

Yerel frontend projesi için de aynısını yap (`a:\M-Panel\frontend`).

Checkpoint oluşturduktan sonra bana onay ver, ondan sonra devam et.

## Bağlam
Aşama 3 tamamlandı ve doğrulandı:
- Panel `https://panel.mehmetaymaz.com.tr` üzerinden erişilebiliyor
- Giriş/çıkış çalışıyor
- Genel Bakış sayfası gerçek veriyle çalışıyor (`/api/system/status`)
- Inbound ve Kullanıcı sayfaları **taslak modda** — butonlar yerel state'i değiştiriyor ama backend'e hiçbir şey yazmıyor

## Şimdiki Görev — Aşama 4

### Bölüm A: Backend — Inbound CRUD

`routers/inbounds.py`'yi tamamla:

- `GET /inbounds/` — veritabanından tüm inbound'ları döndür (zaten var, taslak değilse doğrula)
- `POST /inbounds/` — yeni inbound oluştur:
  - Body: `{remark, protocol, port, settings, stream_settings}`
  - Port çakışması kontrolü yap (aynı port zaten kullanılıyorsa hata dön)
  - Veritabanına yaz
  - `xray_manager.generate_config()` + `apply_config()` çağır
  - Xray restart başarısız olursa veritabanı kaydını da geri al (rollback), hatayı dön
- `PUT /inbounds/{id}` — inbound düzenle (aynı rollback mantığıyla)
- `DELETE /inbounds/{id}` — inbound sil (bağlı tüm client'ları da sil, Xray config'i güncelle)
- `PATCH /inbounds/{id}/toggle` — aktif/pasif yap

### Bölüm B: Backend — Client (Kullanıcı) CRUD

`routers/clients.py`'yi tamamla:

- `GET /clients/` — tüm kullanıcıları döndür
- `POST /clients/` — yeni kullanıcı oluştur:
  - Body: `{inbound_id, email, total_gb, expiry_days, ...}`
  - UUID otomatik üret
  - Email çakışması kontrolü
  - Veritabanına yaz, Xray config güncelle (aynı rollback mantığı)
- `PUT /clients/{id}` — düzenle
- `DELETE /clients/{id}` — sil
- `PATCH /clients/{id}/toggle` — aktif/pasif
- `POST /clients/{id}/reset-traffic` — trafik sıfırla (sadece veritabanı güncellemesi, Xray restart gerekmez)

### Bölüm C: Her İki Bölüm İçin Ortak Kural

**Rollback mekanizması zorunlu.** Aşama 2'de yazdığımız `xray_manager.apply_config()` fonksiyonu zaten config dosyası seviyesinde rollback yapıyor (restart başarısız olursa eski config'e döner). Buna ek olarak, eğer Xray restart başarısız olursa, **veritabanındaki değişikliği de geri almalısın** (transaction mantığıyla) — yoksa veritabanı "yeni inbound var" derken Xray hâlâ eskisini çalıştırıyor olur, bu tutarsızlık ciddi bir hataya yol açar.

Önerilen akış her CRUD işleminde:
```
1. Veritabanı işlemini yap (commit etme, sadece session'da tut)
2. xray_manager.generate_config() çağır
3. xray_manager.apply_config() çağır
4. apply_config() başarılıysa → veritabanı commit
5. apply_config() başarısızsa → veritabanı rollback, HTTPException fırlat (detaylı hata mesajıyla)
```

### Bölüm D: Frontend Entegrasyonu

`Inbounds.jsx` ve `Clients.jsx` sayfalarındaki taslak/mock state mantığını kaldır, gerçek API çağrılarına bağla:

- Sayfa yüklendiğinde `GET` ile listele
- "Yeni Ekle" formu gerçek `POST` çağırsın
- Düzenle/Sil butonları gerçek `PUT`/`DELETE` çağırsın
- API hata dönerse (örn. port çakışması, Xray restart hatası) kullanıcıya **açık ve anlaşılır** hata mesajı göster (toast/bildirim component'i kullanılabilir)
- İşlem sırasında (özellikle Xray restart birkaç saniye sürebilir) loading/spinner göster
- "Aşama 3 Bilgilendirmesi" kutularını kaldır

### Bölüm E: Test Senaryosu

Tamamlandığında şunu birlikte test edeceğiz:
1. Panelden yeni bir test inbound oluştur (örn. port 9999, VLESS+WS)
2. O inbound'a yeni bir test kullanıcı ekle
3. Sunucuda `cat /usr/local/etc/xray/config.json | jq` ile gerçekten o inbound'un config'e yazıldığını doğrula
4. `systemctl status xray` ile servisin hâlâ "active" olduğunu doğrula
5. Test inbound/kullanıcıyı panelden sil, config'in gerçekten temizlendiğini doğrula
6. Kasıtlı olarak bozuk bir config'e yol açacak bir senaryo dene (örn. aynı portu iki kere kullanmaya çalış) — sistemin hata verip rollback yaptığını doğrula

## Önemli Kurallar
- Her Bölüm (A, B, C, D) ayrı ayrı test edilebilir şekilde ilerlesin, hepsini tek seferde bitirip sunma
- Özellikle Bölüm C (rollback mantığı) için ekstra dikkatli ol — bu panelin güvenilirliğinin temeli
- Frontend değişikliklerinden sonra `npm run build` + sunucuya deploy + Nginx reload adımlarını eksiksiz yap

## Tamamlandığında Rapor Ver
- Hangi endpoint'ler tamamlandı (liste)
- Rollback mekanizmasının nasıl çalıştığına dair kısa teknik özet
- Frontend'in hangi sayfalarda artık gerçek veriyle çalıştığı
- Bölüm E'deki test senaryosunun sonuçları
