# M-Panel — UFW Otomasyonu + Responsive Tasarım

## Sunucu Bilgileri
*(Önceki aşamalarda kullandığın bilgilerin aynısı geçerli, tam yetki devam ediyor)*

## ÖNCELİKLE — Checkpoint
```bash
cd /opt/m-panel
git add -A
git commit -m "CHECKPOINT: UFW otomasyonu ve responsive tasarim oncesi"
git tag checkpoint-pre-ufw-responsive
```
Yerelde de aynısını yap. Onay bekle, sonra devam et.

## BÖLÜM 1 (ÖNCELİKLİ) — UFW Otomasyonu

### Bulunan Sorun
Az önce canlı testte tespit edildi: M-Panel üzerinden port 1453'te yeni bir inbound oluşturulduğunda, bu port Xray config'ine yazılıp Xray restart edildi ama **UFW firewall kuralı otomatik eklenmedi**. Bu yüzden Xray portu dinliyordu ama firewall dışarıdan gelen bağlantıları engelliyordu — kullanıcı saatlerce "neden bağlanamıyorum" sorunuyla uğraşabilirdi. Bunu manuel `ufw allow 1453/tcp` ile çözdük ama backend bunu otomatik yapmalı.

### Yapılacaklar
0. panelde inbound trafik kullanımı güncellenmiyor ve textleri pillbadge tarzında olsun 
 
`xray_manager.py`'deki `apply_config()` fonksiyonuna (veya inbound CRUD endpoint'lerine) şu mantığı ekle:

1. **Inbound oluşturma/port değiştirme sırasında:**
   - Yeni port için `ufw allow <port>/tcp` çalıştır (subprocess ile)
   - Eğer komut başarısız olursa logla ama işlemi durdurma (UFW kapalıysa bile Xray çalışmaya devam etmeli)

2. **Inbound silme sırasında:**
   - Silinen inbound'un portunu **başka hiçbir inbound kullanmıyorsa**, `ufw delete allow <port>/tcp` çalıştırarak kuralı kaldır
   - Önce veritabanında o portu kullanan başka inbound var mı kontrol et, varsa kuralı kaldırma

3. **Port düzenleme (eski port → yeni port) sırasında:**
   - Yeni porta `ufw allow` ekle
   - Eski port başka inbound tarafından kullanılmıyorsa `ufw delete allow` ile kaldır

4. **Sistem rezerve portlarını (22, 80, 443, 8443, 8000) bu otomasyondan muaf tut** — bunlar zaten kurulumda elle eklenmişti, tekrar dokunma/silme.

5. **Mevcut inbound'lar için tek seferlik düzeltme:** Şu an veritabanında kayıtlı olan tüm inbound'ların portlarını tara, her biri için UFW'de kural olup olmadığını kontrol et, eksik olanları ekle (bu, geçmişte UFW otomasyonu olmadan eklenmiş inbound'ları da düzeltir — örn. 1453, varsa başka eksikler).

### Test
- Yeni bir test inbound oluştur, `ufw status` ile kuralın otomatik eklendiğini doğrula
- O inbound'u sil, kuralın kaldırıldığını doğrula
- Sistem rezerve portlarının (8443 gibi) hiç etkilenmediğini doğrula

---

## BÖLÜM 2 — Responsive Tasarım

### Amaç
Mevcut React frontend şu an muhtemelen sadece masaüstü ekran genişliğine göre tasarlandı (sabit sidebar, geniş tablolar). Panelin mobil/tablet tarayıcıdan da kullanılabilir olması gerekiyor.

### Yapılacaklar

**1. Genel Layout (`Layout.jsx`, `Sidebar.jsx`):**
- Ekran genişliği belirli bir breakpoint'in (örn. 768px) altına düştüğünde sidebar gizlensin, hamburger menü ikonu ile açılıp kapanabilsin
- Üst bar (admin profili) mobilde de erişilebilir kalsın

**2. Genel Bakış Sayfası (`Dashboard.jsx`):**
- Şu an yan yana duran kartlar (CPU/RAM/Disk) mobilde alt alta dizilsin (CSS grid/flexbox ile responsive breakpoint)
- Grafik (recharts) mobil genişliğe sığacak şekilde otomatik ölçeklensin

**3. Inbound ve Kullanıcı Tabloları (`Inbounds.jsx`, `Clients.jsx`):**
- Geniş tablolar mobilde yatay scroll ile kullanılabilir hale getirilsin **veya** (daha iyi UX için) mobilde tablo yerine kart görünümüne dönüşsün — her satır bir kart olarak gösterilsin, önemli bilgiler (remark, port, durum) üstte, detaylar altta
- "Yeni Ekle" formları mobilde tam ekran modal olarak açılsın (masaüstünde yan panel/modal neyse)

**4. Genel CSS:**
- Mevcut `index.css`/`App.css`'teki sabit piksel genişlikleri, mümkün olduğunca `%`, `rem`, `vw` gibi göreceli birimlere veya CSS Grid/Flexbox `minmax()` gibi esnek yapılara çevir
- Font boyutları küçük ekranlarda okunabilir kalsın (çok küçülmesin)
- Touch hedefleri (butonlar, ikonlar) mobilde parmakla rahat tıklanabilir büyüklükte olsun (en az 44x44px)

### Test
- Tarayıcının geliştirici araçlarında (Chrome DevTools) farklı cihaz boyutlarını (iPhone SE, iPad, Galaxy S20 gibi) simüle ederek her sayfayı kontrol et
- Gerçek bir telefon tarayıcısından da (varsa) test et
- Build edip deploy ettikten sonra, hangi sayfaların responsive olduğunu/olmadığını raporla

## Önemli Kurallar
- Bölüm 1'i (UFW) tamamlayıp test ettikten sonra Bölüm 2'ye geç, ikisini karıştırma
- Frontend değişikliklerinden sonra `npm run build` + sunucuya deploy + Nginx reload adımlarını eksiksiz yap
- Masaüstü görünümünü bozma — sadece mobil/tablet için ek davranış ekleniyor

## Tamamlandığında Rapor Ver
- UFW otomasyonunun test sonucu (kural ekleme/kaldırma)
- Mevcut inbound'lar için tek seferlik düzeltmenin sonucu (hangi eksik kurallar bulunup eklendi)
- Responsive tasarımın hangi sayfalarda tamamlandığı
- Ekran görüntüsü mümkünse (mobil görünüm)
