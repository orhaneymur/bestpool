import { Router } from 'express';
import { Op } from 'sequelize';
import { ServiceItem, ServiceCategory, QuoteItem } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

const UNITS = ['unit', 'hour', 'day', 'week', 'month', 'season'];

/**
 * Whitelisted so a stray key cannot rewrite `id` or created_at, and so the
 * numeric columns never receive a string that MySQL would coerce to 0.
 */
async function cleanBody(body = {}, existing = null) {
  const patch = {};

  if (body.code !== undefined) patch.code = String(body.code).trim().slice(0, 40) || null;
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 200);
  if (body.unit !== undefined) {
    const unit = String(body.unit).trim().toLowerCase();
    patch.unit = UNITS.includes(unit) ? unit : existing?.unit || 'unit';
  }
  if (body.default_unit_price !== undefined) {
    const n = Number(body.default_unit_price);
    patch.default_unit_price = Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (body.vat_rate !== undefined) {
    const n = Number(body.vat_rate);
    patch.vat_rate = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;

  if (body.category !== undefined) {
    const code = String(body.category || '').trim();
    // A category that no longer exists would leave the service unreachable from
    // the dropdown, so it is rejected rather than stored.
    const known = code ? await ServiceCategory.findOne({ where: { code } }) : null;
    if (code && !known) {
      const err = new Error(`Unknown category "${code}".`);
      err.status = 400;
      throw err;
    }
    patch.category = code || null;
  }

  return patch;
}

router.get('/', async (req, res) => {
  const where = {};
  // Inactive services stay out of the proposal wizard but remain visible on the
  // catalogue page, which passes ?all=1.
  // `ne: false` rather than `eq: true` so a row written before the column
  // existed (is_active NULL) is still offered, instead of silently vanishing.
  if (req.query.all !== '1') where.is_active = { [Op.ne]: false };
  const rows = await ServiceItem.findAll({
    where,
    order: [['category', 'ASC'], ['name', 'ASC']],
  });
  res.json(rows);
});

router.post('/', auth(['admin', 'sales']), async (req, res, next) => {
  try {
    const patch = await cleanBody(req.body);
    if (!patch.name) return res.status(400).json({ error: 'Service name is required.' });
    if (patch.code) {
      const clash = await ServiceItem.findOne({ where: { code: patch.code } });
      if (clash) return res.status(409).json({ error: `Code "${patch.code}" is already used by “${clash.name}”.` });
    }
    const s = await ServiceItem.create({ is_active: true, ...patch });
    res.status(201).json(s);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.put('/:id', auth(['admin', 'sales']), async (req, res, next) => {
  try {
    const s = await ServiceItem.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Service not found.' });
    const patch = await cleanBody(req.body, s);
    if (patch.name !== undefined && !patch.name) {
      return res.status(400).json({ error: 'Service name is required.' });
    }
    if (patch.code) {
      const clash = await ServiceItem.findOne({
        where: { code: patch.code, id: { [Op.ne]: s.id } },
      });
      if (clash) return res.status(409).json({ error: `Code "${patch.code}" is already used by “${clash.name}”.` });
    }
    await s.update(patch);
    res.json(s);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  const s = await ServiceItem.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found.' });

  // quote_items.service_item_id points here. Hard-deleting a service that past
  // contracts reference failed on the foreign key and surfaced as a bare 500 —
  // and even if it succeeded it would rewrite history. Deactivating keeps the
  // old contracts intact and hides the service from new ones.
  const used = await QuoteItem.count({ where: { service_item_id: s.id } });
  if (used > 0) {
    return res.status(409).json({
      error: `“${s.name}” is used by ${used} contract line(s), so it cannot be deleted. Deactivate it instead to hide it from new contracts.`,
      contracts: used,
      canDeactivate: true,
    });
  }

  await s.destroy();
  res.json({ ok: true });
});

export default router;
