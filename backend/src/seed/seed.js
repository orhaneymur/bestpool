import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { sequelize, User, ServiceItem, ContractTemplate, Setting, Customer } from '../models/index.js';
import { DEFAULT_CONTRACT_BODY } from './contractTemplate.js';
import { DEFAULT_CONTRACT_BODY_EN } from './contractTemplateEn.js';

const EN_TEMPLATE_NAME = 'Commercial Swimming Pool Management Agreement — General Terms (EN)';
const COMPANY_NAME = 'Four Seasons Pool Management';
const COMPANY_EMAIL = 'orhaneymur@gmail.com';

dotenv.config();

const SERVICES = [
  { code: 'MNT-001', name: 'Periodic pool maintenance', category: 'maintenance', unit: 'month', default_unit_price: 15000, vat_rate: 0 },
  { code: 'MNT-002', name: 'Season opening preparation', category: 'maintenance', unit: 'season', default_unit_price: 25000, vat_rate: 0 },
  { code: 'LG-001', name: 'Lifeguard service', category: 'lifeguard', unit: 'hour', default_unit_price: 35, vat_rate: 0 },
  { code: 'LG-002', name: 'Additional / special event lifeguard', category: 'lifeguard', unit: 'hour', default_unit_price: 50, vat_rate: 0 },
  { code: 'CHM-001', name: 'Chemical supply (chlorine, pH balancer)', category: 'chemical', unit: 'month', default_unit_price: 6000, vat_rate: 0 },
  { code: 'PMT-001', name: 'Health department permit processing', category: 'permit', unit: 'unit', default_unit_price: 5000, vat_rate: 0 },
  { code: 'WIN-001', name: 'Winterization service', category: 'winterization', unit: 'season', default_unit_price: 18000, vat_rate: 0 },
  { code: 'EQP-001', name: 'Equipment / repair (project-based)', category: 'equipment', unit: 'unit', default_unit_price: 0, vat_rate: 0 },
];

export async function ensureSeed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@havuz.local';
  let admin = await User.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const password_hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: adminEmail,
      password_hash,
      role: 'admin',
    });
    console.log('[seed] Admin created:', adminEmail);
  }

  const settingCount = await Setting.count();
  if (settingCount === 0) {
    await Setting.create({
      id: 1,
      company_name: COMPANY_NAME,
      company_tagline: 'Where Customer Service is a Policy, Not a Department',
      company_phone: '',
      company_email: COMPANY_EMAIL,
      quote_prefix: 'PROP',
      rev_label: 'Rev 06/2025',
      default_vat_rate: 0,
    });
    console.log('[seed] Company settings created.');
  } else {
    const s = await Setting.findByPk(1);
    if (s) {
      const patch = {};
      if (s.company_name !== COMPANY_NAME) patch.company_name = COMPANY_NAME;
      if (!s.company_tagline) {
        patch.company_tagline = 'Where Customer Service is a Policy, Not a Department';
      }
      if (!s.rev_label) patch.rev_label = 'Rev 06/2025';
      if (s.company_email !== COMPANY_EMAIL) patch.company_email = COMPANY_EMAIL;
      if (Object.keys(patch).length) {
        await s.update(patch);
        console.log('[seed] Company settings updated:', patch);
      }
    }
  }

  const svcCount = await ServiceItem.count();
  if (svcCount === 0) {
    await ServiceItem.bulkCreate(SERVICES);
    console.log('[seed] Service catalog loaded.');
  }

  const tplCount = await ContractTemplate.count();
  if (tplCount === 0) {
    await ContractTemplate.create({
      name: 'Pool Operations Agreement (TR archive)',
      body: DEFAULT_CONTRACT_BODY,
      is_default: false,
    });
    console.log('[seed] Archive TR template created.');
  }

  let enTpl = await ContractTemplate.findOne({ where: { name: EN_TEMPLATE_NAME } });
  if (!enTpl) {
    await ContractTemplate.update({ is_default: false }, { where: {} });
    enTpl = await ContractTemplate.create({
      name: EN_TEMPLATE_NAME,
      body: DEFAULT_CONTRACT_BODY_EN,
      is_default: true,
    });
    console.log('[seed] English contract template created and set as default.');
  }

  const custCount = await Customer.count();
  if (custCount === 0) {
    await Customer.create({
      code: 'C0001',
      name: 'Sample Community Association',
      contact_person: 'Property Manager',
      phone: '(301) 555-0100',
      email: 'manager@example.com',
      city: 'Ellicott City',
      address: '3010 Homeland Way, Ellicott City, MD 21043',
    });
    console.log('[seed] Sample customer created.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await ensureSeed();
    console.log('[seed] Done.');
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
