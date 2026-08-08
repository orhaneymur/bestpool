import { Router } from 'express';
import { Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { DEFAULT_TAGLINE } from '../services/pdf.js';

const router = Router();
router.use(auth());

async function getOrCreate() {
  let s = await Setting.findByPk(1);
  if (!s) {
    s = await Setting.create({
      id: 1,
      company_name: 'Four Seasons Pool Management',
      company_email: 'orhaneymur@gmail.com',
      company_tagline: DEFAULT_TAGLINE,
      quote_prefix: 'FSPM',
    });
  }
  return s;
}

router.get('/', async (_req, res) => {
  res.json(await getOrCreate());
});

/**
 * Whitelisted so a stray key in the request body cannot rewrite `id` (which would
 * orphan the single settings row) or `definitions` (which has its own validated
 * endpoint at /api/definitions and would bypass those checks here).
 */
const EDITABLE = [
  'company_name', 'company_address', 'company_phone', 'company_fax',
  'company_email', 'company_website', 'company_tagline', 'rev_label',
  'tax_office', 'tax_no', 'logo_url', 'quote_prefix', 'default_vat_rate',
];

router.put('/', auth(['admin']), async (req, res) => {
  const s = await getOrCreate();
  const body = req.body || {};
  const patch = {};
  for (const key of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
  }
  if (patch.quote_prefix !== undefined) {
    // Feeds straight into contract numbers, so keep it to safe filename characters.
    patch.quote_prefix = String(patch.quote_prefix).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 20) || 'FSPM';
  }
  if (patch.default_vat_rate !== undefined) {
    const n = Number(patch.default_vat_rate);
    patch.default_vat_rate = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }
  await s.update(patch);
  res.json(s);
});

export default router;
