import { sequelize } from '../config/db.js';
import { DataTypes } from 'sequelize';

/**
 * Tüm modeller tek dosyada tanımlanır (kompakt tutmak için).
 * İleride ön muhasebe modülleri (fatura, tahsilat, gider) buraya eklenebilir.
 */

// --- Kullanıcılar (çok kullanıcılı + roller) ---
export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(200), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'sales', 'viewer'), defaultValue: 'sales' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users' });

// --- Cari / Müşteriler ---
export const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(40), unique: true }, // cari kodu
  name: { type: DataTypes.STRING(200), allowNull: false }, // tesis / site / müşteri adı
  contact_person: { type: DataTypes.STRING(160) },
  phone: { type: DataTypes.STRING(40) },
  email: { type: DataTypes.STRING(160) },
  address: { type: DataTypes.TEXT },
  city: { type: DataTypes.STRING(80) },
  tax_office: { type: DataTypes.STRING(120) }, // vergi dairesi
  tax_no: { type: DataTypes.STRING(40) },      // vergi / TC no
  notes: { type: DataTypes.TEXT },
}, {
  tableName: 'customers',
  // The list is always sorted by name; without this MySQL sorted the whole
  // table on every request.
  indexes: [{ name: 'idx_customers_name', fields: ['name'] }],
});

// --- Hizmet Kategorileri (panelden yönetilir) ---
// ServiceItem.category, buradaki `code` değerini metin olarak tutar. Yabancı
// anahtar yerine kod tutulmasının sebebi: kategori adı değişince mevcut
// hizmetlerin bağı kopmaz ve eski kayıtlar için veri taşıma gerekmez.
export const ServiceCategory = sequelize.define('ServiceCategory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'service_categories' });

// --- Hizmet Kataloğu (değişken birim fiyatlar) ---
export const ServiceItem = sequelize.define('ServiceItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(40), unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  category: { type: DataTypes.STRING(80) }, // bakim, cankurtaran, kimyasal, ruhsat, kis_bakim...
  unit: { type: DataTypes.STRING(30), defaultValue: 'adet' }, // adet, saat, hafta, ay, sezon
  default_unit_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  vat_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20 }, // KDV %
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'service_items' });

// --- Sözleşme Şablonları (sabit yasal metin) ---
export const ContractTemplate = sequelize.define('ContractTemplate', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(160), allowNull: false },
  body: { type: DataTypes.TEXT('long') }, // düzenlenebilir madde metinleri (markdown/plain)
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'contract_templates' });

// --- Teklifler ---
export const Quote = sequelize.define('Quote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_no: { type: DataTypes.STRING(40), unique: true }, // TEK-2026-0001
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  contract_template_id: { type: DataTypes.INTEGER },
  created_by: { type: DataTypes.INTEGER },
  // Tesis / sezon bilgileri (değişkenler)
  facility_name: { type: DataTypes.STRING(200) },
  facility_address: { type: DataTypes.TEXT },
  season_start: { type: DataTypes.DATEONLY },
  season_end: { type: DataTypes.DATEONLY },
  // Personel / Bid Summary değişkenleri
  lifeguard_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  hours_per_week: { type: DataTypes.INTEGER, defaultValue: 0 },
  county: { type: DataTypes.STRING(80) }, // montgomery, frederick, ...
  peak_weeks: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Tutarlar
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // %
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  early_bird_discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // Erken rezervasyon indirimi (sabit tutar)
  vat_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(8), defaultValue: 'USD' },
  status: { type: DataTypes.ENUM('taslak', 'gonderildi', 'kabul', 'red'), defaultValue: 'taslak' },
  valid_until: { type: DataTypes.DATEONLY }, // teklif geçerlilik tarihi
  // Okul döneminin bittiği/başladığı tarihler. Sezon takvimi bu tarihlere
  // bakarak her güne "normal" mi yoksa "okul" programını mı uygulayacağına
  // karar verir. Boş bırakılırsa tüm sezon normal program sayılır.
  school_closes: { type: DataTypes.DATEONLY },
  school_reopens: { type: DataTypes.DATEONLY },
  // { holidayKey: false } — o resmi tatilde havuzun KAPALI kalacağı anlamına
  // gelir. Varsayılan (kayıt yoksa) tatilde Holiday programıyla açık olmasıdır.
  holiday_policy: { type: DataTypes.JSON },
  notes: { type: DataTypes.TEXT },
  // PDF'te gizlenecek blokların anahtarları (bkz. config/pdfDefinitions.js).
  // Yeni sözleşme oluşturulurken definitions.hidden'dan kopyalanır, sonra
  // sözleşmenin kendi listesi olur — şirket varsayılanı değişse bile
  // imzalanmış evrakın çıktısı değişmez.
  // No defaultValue: a literal [] would be one array shared by every instance.
  // Readers go through sanitizeHiddenFields(), which turns null into [].
  hidden_fields: { type: DataTypes.JSON },
}, {
  tableName: 'quotes',
  /**
   * The contract list is the hottest query in the app: filter by status and/or
   * season year, always ordered by created_at DESC. With no index MySQL read
   * every row and sorted the lot on each keystroke.
   *
   * idx_quotes_status_created serves both the filtered and the unfiltered list —
   * the leading column is optional for a range scan on the second only when the
   * filter is present, so created_at also gets its own index for the "All
   * statuses" case.
   */
  indexes: [
    { name: 'idx_quotes_created', fields: ['created_at'] },
    { name: 'idx_quotes_status_created', fields: ['status', 'created_at'] },
    { name: 'idx_quotes_customer', fields: ['customer_id'] },
    { name: 'idx_quotes_season_start', fields: ['season_start'] },
  ],
});

// --- Teklif Kalemleri ---
export const QuoteItem = sequelize.define('QuoteItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_id: { type: DataTypes.INTEGER, allowNull: false },
  service_item_id: { type: DataTypes.INTEGER },
  description: { type: DataTypes.STRING(500), allowNull: false },
  quantity: { type: DataTypes.DECIMAL(12, 2), defaultValue: 1 },
  unit: { type: DataTypes.STRING(30), defaultValue: 'adet' },
  unit_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  vat_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20 },
  line_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // KDV hariç
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'quote_items' });

// --- Teklif Ödeme Planı / Taksitler ---
export const QuoteInstallment = sequelize.define('QuoteInstallment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_id: { type: DataTypes.INTEGER, allowNull: false },
  label: { type: DataTypes.STRING(120) }, // "1. Taksit", "Peşinat"
  due_date: { type: DataTypes.DATEONLY },
  amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  is_paid: { type: DataTypes.BOOLEAN, defaultValue: false }, // ileride ön muhasebe için
  paid_at: { type: DataTypes.DATEONLY },
}, { tableName: 'quote_installments' });

// --- Teklif Çalışma Saatleri (Haftalık Program) ---
// Her teklif için iki sezon (normal / okul dönemi) x gün bazlı açılış-kapanış saatleri.
export const QuoteSchedule = sequelize.define('QuoteSchedule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_id: { type: DataTypes.INTEGER, allowNull: false },
  season_type: { type: DataTypes.ENUM('normal', 'okul'), defaultValue: 'normal' }, // Normal Sezon / Okul Dönemi
  day_label: { type: DataTypes.STRING(20), allowNull: false }, // pazartesi..pazar, tatil
  open_time: { type: DataTypes.STRING(5) },  // "09:00"
  close_time: { type: DataTypes.STRING(5) }, // "19:00"
  is_closed: { type: DataTypes.BOOLEAN, defaultValue: false }, // o gün kapalı
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'quote_schedules' });

// --- Teklif Özel Maddeleri / Ek Açıklamalar (Additional Comments) ---
// Kullanıcının dinamik ekleyip çıkarabildiği, PDF'e basılan özel maddeler.
export const QuoteNote = sequelize.define('QuoteNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_id: { type: DataTypes.INTEGER, allowNull: false },
  label: { type: DataTypes.STRING(10) }, // A, B, C... (opsiyonel)
  body: { type: DataTypes.TEXT, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'quote_notes' });

// --- Şirket Ayarları ---
export const Setting = sequelize.define('Setting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_name: { type: DataTypes.STRING(200) },
  company_address: { type: DataTypes.TEXT },
  company_phone: { type: DataTypes.STRING(60) },
  company_fax: { type: DataTypes.STRING(60) },
  company_email: { type: DataTypes.STRING(160) },
  company_website: { type: DataTypes.STRING(160) },
  company_tagline: { type: DataTypes.STRING(200) }, // Kapak sloganı
  rev_label: { type: DataTypes.STRING(40), defaultValue: 'Rev 06/2025' }, // PDF alt bilgi revizyon etiketi
  tax_office: { type: DataTypes.STRING(120) },
  tax_no: { type: DataTypes.STRING(40) },
  logo_url: { type: DataTypes.STRING(300) },
  quote_prefix: { type: DataTypes.STRING(20), defaultValue: 'TEK' },
  default_vat_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20 },
  // "Tanımlamalar" modülü: PDF biçimi, etiketler, renkler, varsayılan gizli
  // bloklar. Şeması config/pdfDefinitions.js içinde. Tek satırlık ayar
  // tablosunda JSON tutulur ki her yeni tercih için ALTER TABLE gerekmesin.
  definitions: { type: DataTypes.JSON },
}, { tableName: 'settings' });

// --- İlişkiler ---
Customer.hasMany(Quote, { foreignKey: 'customer_id' });
Quote.belongsTo(Customer, { foreignKey: 'customer_id' });

User.hasMany(Quote, { foreignKey: 'created_by' });
Quote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

ContractTemplate.hasMany(Quote, { foreignKey: 'contract_template_id' });
Quote.belongsTo(ContractTemplate, { foreignKey: 'contract_template_id', as: 'template' });

Quote.hasMany(QuoteItem, { foreignKey: 'quote_id', as: 'items', onDelete: 'CASCADE' });
QuoteItem.belongsTo(Quote, { foreignKey: 'quote_id' });
ServiceItem.hasMany(QuoteItem, { foreignKey: 'service_item_id' });
QuoteItem.belongsTo(ServiceItem, { foreignKey: 'service_item_id', as: 'service' });

Quote.hasMany(QuoteInstallment, { foreignKey: 'quote_id', as: 'installments', onDelete: 'CASCADE' });
QuoteInstallment.belongsTo(Quote, { foreignKey: 'quote_id' });

Quote.hasMany(QuoteSchedule, { foreignKey: 'quote_id', as: 'schedules', onDelete: 'CASCADE' });
QuoteSchedule.belongsTo(Quote, { foreignKey: 'quote_id' });

Quote.hasMany(QuoteNote, { foreignKey: 'quote_id', as: 'special_notes', onDelete: 'CASCADE' });
QuoteNote.belongsTo(Quote, { foreignKey: 'quote_id' });

export { sequelize };
