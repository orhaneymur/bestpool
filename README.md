# 🏊 Havuz Teklif & Cari Yönetim Sistemi

Havuz işletme, bakım, cankurtaran ve kimyasal hizmetleri için **fiyat teklifi hazırlama**, **PDF/Excel çıktısı alma** ve **müşteri (cari) yönetimi** yapan web tabanlı bir uygulama.

**Four Seasons Pool Management** için geliştirilmiştir. İleride **ön muhasebe** (fatura, tahsilat, gider) modüllerine genişletilebilecek şekilde tasarlanmıştır.

---

## ✨ Özellikler

- **Müşteri (Cari) Yönetimi** — müşteri kartları, arama, vergi bilgileri; her müşterinin **teklif geçmişi**.
- **Teklif Oluşturma** — tesis/sezon bilgileri, cankurtaran sayısı & saatleri gibi **değişkenler**.
- **Otomatik Fiyatlandırma + Manuel Düzeltme** — hizmet kataloğundan birim fiyat gelir; miktar × birim fiyat otomatik hesaplanır; indirim ve KDV canlı hesaplanır. Cankurtaran kalemi (kişi × saat × hafta) tek tıkla eklenir.
- **Ödeme Planı / Taksitler** — eşit taksitlere bölme veya elle satır ekleme.
- **Sözleşme Şablonları** — sabit yasal metin (varsayılan Türkçe şablon dahil), teklife eklenip PDF'e basılır.
- **PDF ve Excel Çıktısı** — Premier tarzı çok sayfalı sözleşme PDF’i (Kapak + Section I–V + genel hükümler); service line items, additional comments, taksit planı ve early bird notu basılır.
- **Proposal tracking** — season year filter, status cards, search, **Duplicate** for next season.
- **Standard clauses** — Section III presets (permit, overtime, opening/closing); one-click load.
- **Email to customer** — after reviewing the PDF, send an English auto-draft email with the PDF attached from `orhaneymur@gmail.com`.
- **Çok Kullanıcılı + Roller** — `admin`, `sales`, `viewer`. JWT tabanlı kimlik doğrulama.
- **Panel (Dashboard)** — teklif/müşteri sayıları, durum dağılımı, son teklifler.

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
