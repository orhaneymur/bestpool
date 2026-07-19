import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { sequelize, User, ServiceItem, ContractTemplate, Setting, Customer } from '../models/index.js';
import { DEFAULT_CONTRACT_BODY } from './contractTemplate.js';
import { DEFAULT_CONTRACT_BODY_EN } from './contractTemplateEn.js';

const EN_TEMPLATE_NAME = 'Commercial Swimming Pool Management Agreement — General Terms (EN)';

dotenv.config();

const SERVICES = [
  { code: 'BKM-001', name: 'Havuz periyodik bakım hizmeti', category: 'bakim', unit: 'ay', default_unit_price: 15000, vat_rate: 20 },
  { code: 'BKM-002', name: 'Havuz sezon açılış hazırlığı', category: 'bakim', unit: 'sezon', default_unit_price: 25000, vat_rate: 20 },
  { code: 'CNK-001', name: 'Cankurtaran hizmeti', category: 'cankurtaran', unit: 'saat', default_unit_price: 350, vat_rate: 20 },
  { code: 'CNK-002', name: 'Ek/özel etkinlik cankurtaran', category: 'cankurtaran', unit: 'saat', default_unit_price: 450, vat_rate: 20 },
  { code: 'KMY-001', name: 'Kimyasal (klor, pH dengeleyici) tedariki', category: 'kimyasal', unit: 'ay', default_unit_price: 6000, vat_rate: 20 },
  { code: 'RHS-001', name: 'Sağlık müdürlüğü ruhsat/izin işlemleri', category: 'ruhsat', unit: 'adet', default_unit_price: 5000, vat_rate: 20 },
  { code: 'KIS-001', name: 'Kışa hazırlık (winterizasyon) hizmeti', category: 'kis_bakim', unit: 'sezon', default_unit_price: 18000, vat_rate: 20 },
  { code: 'EKP-001', name: 'Ekipman/onarım (proje bazlı)', category: 'ekipman', unit: 'adet', default_unit_price: 0, vat_rate: 20 },
];

export async function ensureSeed() {
  // Yönetici
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@havuz.local';
  let admin = await User.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const password_hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    admin = await User.create({ name: process.env.ADMIN_NAME || 'Sistem Yöneticisi', email: adminEmail, password_hash, role: 'admin' });
    console.log('[seed] Yönetici oluşturuldu:', adminEmail);
  }

  // Ayarlar
  const COMPANY_NAME = 'Four Seasons Pool Management';
  const settingCount = await Setting.count();
  if (settingCount === 0) {
    await Setting.create({
      id: 1,
      company_name: COMPANY_NAME,
      company_tagline: 'Where Customer Service is a Policy, Not a Department',
      company_phone: '',
      company_email: 'sporistanbulyapayzeka@gmail.com',
      quote_prefix: 'PROP',
      rev_label: 'Rev 06/2025',
      default_vat_rate: 0,
    });
    console.log('[seed] Şirket ayarları oluşturuldu.');
  } else {
    const s = await Setting.findByPk(1);
    if (s) {
      const patch = {};
      if (s.company_name !== COMPANY_NAME) patch.company_name = COMPANY_NAME;
      if (!s.company_tagline) {
        patch.company_tagline = 'Where Customer Service is a Policy, Not a Department';
      }
      if (!s.rev_label) patch.rev_label = 'Rev 06/2025';
      if (Object.keys(patch).length) {
        await s.update(patch);
        console.log('[seed] Şirket ayarları güncellendi:', patch);
      }
    }
  }

  // Hizmet kataloğu
  const svcCount = await ServiceItem.count();
  if (svcCount === 0) {
    await ServiceItem.bulkCreate(SERVICES);
    console.log('[seed] Hizmet kataloğu yüklendi.');
  }

  // Türkçe sözleşme şablonu (ilk kurulumda)
  const tplCount = await ContractTemplate.count();
  if (tplCount === 0) {
    await ContractTemplate.create({ name: 'Havuz İşletme ve Bakım Sözleşmesi (TR)', body: DEFAULT_CONTRACT_BODY, is_default: false });
    console.log('[seed] Türkçe sözleşme şablonu oluşturuldu.');
  }

  // İngilizce genel hükümler şablonu (örnek sözleşmeden) — mevcut değilse ekle ve varsayılan yap
  let enTpl = await ContractTemplate.findOne({ where: { name: EN_TEMPLATE_NAME } });
  if (!enTpl) {
    await ContractTemplate.update({ is_default: false }, { where: {} });
    enTpl = await ContractTemplate.create({ name: EN_TEMPLATE_NAME, body: DEFAULT_CONTRACT_BODY_EN, is_default: true });
    console.log('[seed] İngilizce sözleşme şablonu oluşturuldu ve varsayılan yapıldı.');
  }

  // Örnek müşteri
  const custCount = await Customer.count();
  if (custCount === 0) {
    await Customer.create({ code: 'C0001', name: 'Örnek Sitesi Yönetimi', contact_person: 'Yönetici', phone: '0212 000 00 00', city: 'İstanbul', address: 'Örnek Mah. Havuz Cad. No:1, İstanbul' });
    console.log('[seed] Örnek müşteri oluşturuldu.');
  }
}

// Doğrudan çalıştırıldığında (npm run seed)
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await ensureSeed();
    console.log('[seed] Tamamlandı.');
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
