# 🏊 Havuz Teklif & Cari Yönetim Sistemi

Havuz işletme, bakım, cankurtaran ve kimyasal hizmetleri için **fiyat teklifi hazırlama**, **PDF/Excel çıktısı alma** ve **müşteri (cari) yönetimi** yapan web tabanlı bir uygulama.

**Four Seasons Pool Management** için geliştirilmiştir. İleride **ön muhasebe** (fatura, tahsilat, gider) modüllerine genişletilebilecek şekilde tasarlanmıştır.

---

## ✨ Özellikler

- **Müşteri (Cari) Yönetimi** — müşteri kartları, arama, vergi bilgileri; her müşterinin **teklif geçmişi**.
- **Teklif Oluşturma** — tesis/sezon bilgileri, cankurtaran sayısı & saatleri, county seçimi.
- **Specification v1.0 sözleşme akışı** — Dashboard menüleri (New / Drafts / Completed / Customers / Profile); PDF kapak “Commercial Pool Management Agreement”, müşteri + property + initials; Owner sol / Contractor sağ imza; günlük–haftalık–sezonluk personel saatleri; toplam fiyat → Mart–Ağustos 6 eşit taksit + aylık tutar / bakiye / %
- **2026 Bid Summary otomatik fiyatlandırma** (dokümandaki kurallarla):
  - **County saat ücreti:** Montgomery $20, Frederick $25, Prince George's $20, Howard $20, Anne Arundel $20, Baltimore County $20, Annapolis $25, Queen Anne's $27
  - **İşçilik:** toplam cankurtaran saati × county ücreti
  - **Sabit giderler:** Management $3.000 · Commission $1.000 · Insurance $2.500 · Drain/Cleaning ($2.000 veya $1.000/guard) · Winterization ($2.000 veya $1.000/guard) · Chemicals (1 guard $5.000 · 2–3 $7.500 · 4+ $10.500)
  - **Overhead %5 + Profit %5 + Sales tax %6** otomatik eklenir; kalemler tek tıkla satırlara yazılır
- **Specification Additional Comments (A–K)** — test kit / first aid restock, ek saat $35/$55, off-season visits, HD inspections, opening/closing, chemicals, 3 haftalık inspection, sertifikalar; serbest düzenlenebilir
- **Ödeme planı** — varsayılan **Mart–Ağustos 6 eşit taksit**; sezon ayları veya N eşit taksit de mümkün
- **Terms & Conditions** — müşteri belgesindeki metin birebir varsayılan şablon olarak PDF’e basılır (Section I–XVI)
- **PDF / Excel** — Kapak + Specification (I–V) + Terms & Conditions; kalemler, comments, taksit, early bird
- **Teklif takibi** — sezon yılı filtresi, durum kartları, arama, **Duplicate**
- **Müşteriye e-posta** — PDF ekli İngilizce taslak; `orhaneymur@gmail.com`
- **Çok kullanıcılı + roller** — `admin`, `sales`, `viewer` · JWT
- **Dashboard** — teklif/müşteri sayıları, durum dağılımı, son teklifler

## 🧱 Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Vite + React Router (Nginx ile sunulur) |
| Backend | Node.js 20 + Express + Sequelize |
| Veritabanı | MySQL 8 |
| Çıktı | pdfmake (PDF), exceljs (Excel) |
| Paketleme | Docker, Docker Compose |
| Yayınlama | Kubernetes manifest'leri + Helm chart |

## 📁 Proje Yapısı

```
havuz-teklif/
├── backend/            # Express API (REST), Sequelize modelleri, PDF/Excel servisleri
│   ├── src/
│   │   ├── config/     # DB bağlantısı
│   │   ├── models/     # Sequelize modelleri (tek dosya)
│   │   ├── routes/     # auth, customers, services, quotes, templates, settings, stats
│   │   ├── services/   # pricing (fiyat motoru), pdf, excel
│   │   ├── middleware/ # JWT auth
│   │   └── seed/       # ilk yönetici, hizmet kataloğu, varsayılan sözleşme
│   └── Dockerfile
├── frontend/           # React arayüzü
│   ├── src/pages/      # Login, Dashboard, Customers, Quotes, QuoteForm, ...
│   ├── nginx.conf      # SPA + /api proxy
│   └── Dockerfile
├── docker-compose.yml  # Tek komutla yerel/küçük sunucu kurulumu
├── k8s/                # Ham Kubernetes manifest'leri
└── helm/havuz-teklif/  # Helm chart (üretim için önerilir)
```

---

## 🚀 Hızlı Başlangıç (Docker Compose)

En kolay yol. Docker ve Docker Compose kurulu bir Linux makinede:

```bash
cd havuz-teklif
docker compose up -d --build
```

- Arayüz: **http://localhost:8080**
- API: **http://localhost:4000**
- Varsayılan giriş: **admin@havuz.local** / **Admin123!**

> İlk açılışta veritabanı tabloları ve örnek veriler (hizmet kataloğu, varsayılan sözleşme, örnek müşteri) otomatik oluşturulur.

Durdurmak için: `docker compose down` (verileri silmek için `-v` ekleyin).

---

## 💻 Yerel Geliştirme (Docker'sız)

MySQL 8 kurulu olmalı (veya `docker compose up -d db`).

```bash
# Backend
cd backend
cp .env.example .env      # değerleri düzenleyin
npm install
npm run seed              # tabloları oluştur + ilk verileri yükle
npm run dev               # http://localhost:4000

# Frontend (yeni terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173 (API'yi otomatik proxy'ler)
```

---

## 🔒 Üretim HTTPS (`pool.derneklab.com`)

Canlı ortam k3s + Traefik + Cloudflare kullanır. HTTPS için en güvenli ve diğer siteleri etkilemeyen yol:

1. Cloudflare DNS’te `pool.derneklab.com` kaydını **Proxied (turuncu bulut)** yapın.
2. **SSL/TLS → Overview** → encryption mode: **Flexible**.
3. **SSL/TLS → Edge Certificates** → **Always Use HTTPS: ON**.
4. Manifest’i uygulayıp pod’ları yenileyin:
   ```bash
   cd ~/bestpool
   git pull
   bash k8s/deploy-production.sh
   ```
5. Tarayıcıdan test: **https://pool.derneklab.com**

> `CORS_ORIGIN` ConfigMap’te `https://pool.derneklab.com` olarak ayarlıdır.

## 📱 Mobil Uyumluluk

- Telefonda hamburger menü + sola kayan drawer (masaüstünde klasik sidebar)
- Listeler mobilde **kart**, tablette/masaüstünde **tablo**
- Dashboard metrikleri 2 sütun; teklif sihirbazı adım çubuğu + Preview sheet
- Formlar tek sütuna düşer; dokunma alanları büyütülmüştür

## ☸️ Kubernetes ile Yayınlama

### Yöntem A — Ham manifest'ler

```bash
# 1) İmajları derleyip registry'nize gönderin
docker build -t <registry>/havuz-teklif-backend:latest ./backend
docker build -t <registry>/havuz-teklif-frontend:latest ./frontend
docker push <registry>/havuz-teklif-backend:latest
docker push <registry>/havuz-teklif-frontend:latest

# 2) k8s/20-backend.yaml ve k8s/30-frontend.yaml içindeki image alanlarını güncelleyin
# 3) k8s/00-namespace-and-config.yaml içindeki Secret değerlerini DEĞİŞTİRİN
kubectl apply -f k8s/
kubectl get pods -n havuz
```

Ingress host'u `havuz.local` olarak ayarlıdır; kendi alan adınızla değiştirin (bir Ingress Controller — ör. ingress-nginx — kurulu olmalı).

### Yöntem B — Helm (önerilir)

```bash
helm install havuz ./helm/havuz-teklif \
  --namespace havuz --create-namespace \
  --set image.registry=<registry> \
  --set ingress.host=teklif.sirketiniz.com \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set secrets.adminPassword='GucluBirSifre!' \
  --set secrets.dbPassword='GucluDBSifre!' \
  --set secrets.mysqlRootPassword='GucluRootSifre!'

# Güncelleme
helm upgrade havuz ./helm/havuz-teklif -n havuz --set image.tag=v1.0.1
```

> **Not:** Üretimde harici/yönetilen bir MySQL kullanmak isterseniz `--set mysql.enabled=false` verip `havuz-config` içindeki `DB_HOST`'u kendi veritabanınıza yönlendirin.

---

## 🔐 Güvenlik Notları (Üretim Öncesi)

- `JWT_SECRET`, tüm parolalar ve `ADMIN_PASSWORD` mutlaka değiştirilmeli (Secret / `--set`).
- `CORS_ORIGIN` değerini kendi alan adınızla sınırlayın (`*` yerine).
- `DB_SYNC=true` geliştirme kolaylığı içindir; üretimde şema oturduktan sonra `false` yapıp migration kullanmanız önerilir.
- İlk girişten sonra yönetici şifresini değiştirin ve ek kullanıcıları rolleriyle tanımlayın.

## 🔌 API Özeti

Tüm uçlar `/api` altında; `/auth/login` hariç `Authorization: Bearer <token>` ister.

| Yöntem | Uç | Açıklama |
|--------|-----|----------|
| POST | `/api/auth/login` | Giriş, JWT döner |
| GET/POST | `/api/customers` | Müşteri listesi / oluştur |
| GET | `/api/customers/:id` | Müşteri + teklif geçmişi |
| GET/POST | `/api/services` | Hizmet kataloğu |
| GET/POST/PUT | `/api/quotes` | Teklif CRUD |
| GET | `/api/quotes/:id/pdf` | Teklif PDF çıktısı |
| GET | `/api/quotes/:id/excel` | Teklif Excel çıktısı |
| GET/POST | `/api/templates` | Sözleşme şablonları |
| GET/PUT | `/api/settings` | Şirket ayarları |
| GET | `/api/stats/summary` | Panel istatistikleri |

## 🗺️ Yol Haritası (Ön Muhasebeye Doğru)

Mimari, aşağıdaki modüllerin sonradan eklenmesine uygun kurgulanmıştır:

- **Fatura** — kabul edilen tekliften fatura üretimi (taksit yapısı zaten mevcut).
- **Tahsilat/Ödeme** — `quote_installments.is_paid` alanı bu amaç için hazır.
- **Gider ve kasa/banka** — yeni modeller `models/index.js`'e eklenerek.
- **Cari ekstre / bakiye** — müşteri bazlı borç-alacak raporu.
- **e-Fatura/e-Arşiv entegrasyonu**, **KDV raporları**.

---

## ⚠️ Doğrulama Durumu

Bu paket; tüm backend/frontend dosyalarının sözdizimi, fiyat hesaplama motorunun gerçek verilerle testi, Kubernetes YAML ve Helm şablonlarının geçerliliği doğrulanarak teslim edilmiştir. Node.js bağımlılıkları (Express, Sequelize, pdfmake, exceljs) ilk `docker compose up --build` / `npm install` sırasında kurulur ve uygulama o aşamada tam olarak ayağa kalkar.
