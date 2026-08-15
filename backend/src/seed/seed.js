import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { sequelize, User, ServiceItem, ServiceCategory, ContractTemplate, Setting, Customer } from '../models/index.js';
import { applyDefinitionMigrations } from '../config/pdfDefinitions.js';
import { DEFAULT_CONTRACT_BODY } from './contractTemplate.js';
import { DEFAULT_CONTRACT_BODY_EN, EN_TEMPLATE_NAME } from './contractTemplateEn.js';
import { DEFAULT_TAGLINE } from '../services/pdf.js';

const COMPANY_NAME = 'Four Seasons Pool Management';
const COMPANY_EMAIL = 'orhaneymur@gmail.com';
const QUOTE_PREFIX = 'FSPM';

/** Taglines/prefixes we shipped before and may safely overwrite on an existing DB. */
const LEGACY_TAGLINES = ['Where Customer Service is a Policy, Not a Department'];
const LEGACY_PREFIXES = ['PROP', 'TEK'];

/** Categories the catalogue ships with. Managed from the Services page afterwards. */
const CATEGORIES = [
  { code: 'lifeguard', name: 'Lifeguard' },
  { code: 'management', name: 'Management' },
  { code: 'maintenance', name: 'Maintenance' },
  { code: 'chemical', name: 'Chemicals' },
  { code: 'winterization', name: 'Winterization' },
  { code: 'permit', name: 'Permits & Inspections' },
  { code: 'equipment', name: 'Equipment' },
  { code: 'other', name: 'Other' },
];

dotenv.config();

const SERVICES = [
  { code: 'LG-WAGE', name: 'Lifeguard wages (county hourly)', category: 'lifeguard', unit: 'hour', default_unit_price: 20, vat_rate: 0 },
  { code: 'LG-ADD-48', name: 'Additional lifeguard (48+ hrs notice)', category: 'lifeguard', unit: 'hour', default_unit_price: 35, vat_rate: 0 },
  { code: 'LG-ADD-LT48', name: 'Additional lifeguard (<48 hrs notice)', category: 'lifeguard', unit: 'hour', default_unit_price: 55, vat_rate: 0 },
  { code: 'MGT-001', name: 'Management', category: 'management', unit: 'season', default_unit_price: 3000, vat_rate: 0 },
  { code: 'DRN-001', name: 'Drain and cleaning', category: 'maintenance', unit: 'season', default_unit_price: 2000, vat_rate: 0 },
  { code: 'CHM-1G', name: 'Chemicals (1-guard pool)', category: 'chemical', unit: 'season', default_unit_price: 5000, vat_rate: 0 },
  { code: 'CHM-23G', name: 'Chemicals (2–3 guard pool)', category: 'chemical', unit: 'season', default_unit_price: 7500, vat_rate: 0 },
  { code: 'CHM-4G', name: 'Chemicals (4+ guard pool)', category: 'chemical', unit: 'season', default_unit_price: 10500, vat_rate: 0 },
  { code: 'COM-001', name: 'Commission', category: 'other', unit: 'season', default_unit_price: 1000, vat_rate: 0 },
  { code: 'INS-001', name: 'Insurance', category: 'other', unit: 'season', default_unit_price: 2500, vat_rate: 0 },
  { code: 'WIN-001', name: 'Winterization', category: 'winterization', unit: 'season', default_unit_price: 2000, vat_rate: 0 },
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
      company_tagline: DEFAULT_TAGLINE,
      company_phone: '',
      company_email: COMPANY_EMAIL,
      quote_prefix: QUOTE_PREFIX,
      rev_label: 'Rev 07/2026',
      default_vat_rate: 0,
    });
    console.log('[seed] Company settings created.');
  } else {
    const s = await Setting.findByPk(1);
    if (s) {
      const patch = {};
      if (s.company_name !== COMPANY_NAME) patch.company_name = COMPANY_NAME;
      // Replace only our own former defaults — never a tagline the user typed.
      if (!s.company_tagline || LEGACY_TAGLINES.includes(s.company_tagline.trim())) {
        patch.company_tagline = DEFAULT_TAGLINE;
      }
      if (!s.quote_prefix || LEGACY_PREFIXES.includes(s.quote_prefix.trim().toUpperCase())) {
        patch.quote_prefix = QUOTE_PREFIX;
      }
      if (!s.rev_label) patch.rev_label = 'Rev 07/2026';
      if (s.company_email !== COMPANY_EMAIL) patch.company_email = COMPANY_EMAIL;

      /**
       * New PDF defaults reach an existing install through here, once each.
       *
       * `definitions.hidden` is the user's own choice, so a new default cannot
       * simply be applied on every boot — it would undo their edits after each
       * deploy. Each change is recorded in definitions.migrations and offered a
       * single time.
       */
      const migrated = applyDefinitionMigrations(s.definitions);
      if (migrated) {
        patch.definitions = migrated.definitions;
        console.log('[seed] Definition defaults applied:', migrated.applied.join(', '));
      }

      if (Object.keys(patch).length) {
        await s.update(patch);
        console.log('[seed] Company settings updated:', Object.keys(patch).join(', '));
      }
    }
  }

  // The table is created explicitly: production runs without DB_SYNC in some
  // environments, and ensureSchemaPatches only adds columns, not tables.
  try {
    await ServiceCategory.sync();
  } catch (err) {
    console.warn('[seed] service_categories sync warning:', err.message);
  }

  for (const [i, cat] of CATEGORIES.entries()) {
    const existing = await ServiceCategory.findOne({ where: { code: cat.code } });
    if (!existing) {
      await ServiceCategory.create({ ...cat, sort_order: i });
      console.log('[seed] Service category created:', cat.code);
    }
  }

  // Anything already sitting in service_items.category but missing from the list
  // above gets a category row too, so no existing service is left pointing at a
  // category the dropdown cannot show.
  try {
    const orphans = await ServiceItem.findAll({ attributes: ['category'], group: ['category'], raw: true });
    for (const row of orphans) {
      const code = (row.category || '').trim();
      if (!code) continue;
      const known = await ServiceCategory.findOne({ where: { code } });
      if (!known) {
        const last = await ServiceCategory.max('sort_order');
        await ServiceCategory.create({
          code,
          name: code.charAt(0).toUpperCase() + code.slice(1).replace(/[-_]/g, ' '),
          sort_order: Number.isFinite(last) ? last + 1 : 0,
        });
        console.log('[seed] Adopted existing service category:', code);
      }
    }
  } catch (err) {
    console.warn('[seed] Category adoption warning:', err.message);
  }

  for (const svc of SERVICES) {
    const existing = await ServiceItem.findOne({ where: { code: svc.code } });
    if (!existing) {
      await ServiceItem.create(svc);
      console.log('[seed] Service created:', svc.code);
    } else {
      await existing.update({
        name: svc.name,
        category: svc.category,
        unit: svc.unit,
        default_unit_price: svc.default_unit_price,
        vat_rate: svc.vat_rate,
        is_active: true,
      });
    }
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
    // Migrate old English template name if present
    const old = await ContractTemplate.findOne({
      where: { name: 'Commercial Swimming Pool Management Agreement — General Terms (EN)' },
    });
    if (old) {
      await ContractTemplate.update({ is_default: false }, { where: {} });
      await old.update({
        name: EN_TEMPLATE_NAME,
        body: DEFAULT_CONTRACT_BODY_EN,
        is_default: true,
      });
      enTpl = old;
      console.log('[seed] Migrated English template to Terms and Conditions.');
    } else {
      await ContractTemplate.update({ is_default: false }, { where: {} });
      enTpl = await ContractTemplate.create({
        name: EN_TEMPLATE_NAME,
        body: DEFAULT_CONTRACT_BODY_EN,
        is_default: true,
      });
      console.log('[seed] Terms and Conditions template created.');
    }
  } else {
    await ContractTemplate.update({ is_default: false }, { where: {} });
    await enTpl.update({ body: DEFAULT_CONTRACT_BODY_EN, is_default: true });
    console.log('[seed] Terms and Conditions template refreshed from source document.');
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
