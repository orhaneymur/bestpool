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
}, { tableName: 'customers' });

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
  // Personel değişkenleri
  lifeguard_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  hours_per_week: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Tutarlar
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  discount_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // %
  discount_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  vat_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(8), defaultValue: 'TRY' },
  status: { type: DataTypes.ENUM('taslak', 'gonderildi', 'kabul', 'red'), defaultValue: 'taslak' },
  valid_until: { type: DataTypes.DATEONLY }, // teklif geçerlilik tarihi
  notes: { type: DataTypes.TEXT },
}, { tableName: 'quotes' });

// --- Teklif Kalemleri ---
export const QuoteItem = sequelize.define('QuoteItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quote_id: { type: DataTypes.INTEGER, allowNull: false },
  service_item_id: { type: DataTypes.INTEGER },
  description: { type: DataTypes.STRING(300), allowNull: false },
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

// --- Şirket Ayarları ---
export const Setting = sequelize.define('Setting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_name: { type: DataTypes.STRING(200) },
  company_address: { type: DataTypes.TEXT },
  company_phone: { type: DataTypes.STRING(60) },
  company_email: { type: DataTypes.STRING(160) },
  tax_office: { type: DataTypes.STRING(120) },
  tax_no: { type: DataTypes.STRING(40) },
  logo_url: { type: DataTypes.STRING(300) },
  quote_prefix: { type: DataTypes.STRING(20), defaultValue: 'TEK' },
  default_vat_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20 },
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

export { sequelize };
