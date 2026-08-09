import { Router } from 'express';
import { Op } from 'sequelize';
import { sequelize, ServiceItem, ServiceCategory, QuoteItem } from '../models/index.js';
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

/**
 * Removes a service from the catalogue.
 *
 * quote_items.service_item_id points here, so a plain delete used to fail on the
 * foreign key and surface as a bare 500. Without ?force it refuses and reports
 * how many contract lines are affected.
 *
 * With ?force=1 the link is cut first (service_item_id -> NULL) and only then is
 * the row removed. Contract lines are NOT deleted: description, quantity, unit,
 * unit price, tax and line total all live on quote_items, so every existing
 * contract keeps its wording and its totals to the cent. The only thing lost is
 * the pointer back to a catalogue entry that no longer exists.
 */
async function detachAndDestroy(service) {
  return sequelize.transaction(async (t) => {
    const [detached] = await QuoteItem.update(
      { service_item_id: null },
      { where: { service_item_id: service.id }, transaction: t }
    );
    await service.destroy({ transaction: t });
    return detached;
  });
}

router.delete('/:id', auth(['admin']), async (req, res, next) => {
  try {
    const s = await ServiceItem.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Service not found.' });

    const used = await QuoteItem.count({ where: { service_item_id: s.id } });
    const force = req.query.force === '1' || req.query.force === 'true';

    if (used > 0 && !force) {
      return res.status(409).json({
        error: `“${s.name}” is used by ${used} contract line(s).`,
        contracts: used,
        canDeactivate: true,
        canForce: true,
      });
    }

    const detached = used > 0 ? await detachAndDestroy(s) : (await s.destroy(), 0);
    res.json({ ok: true, detached });
  } catch (err) {
    next(err);
  }
});

/** Deletes several services in one go — used to clear out test leftovers. */
router.post('/bulk-delete', auth(['admin']), async (req, res, next) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map((n) => Number(n))
      .filter(Number.isInteger);
    if (!ids.length) return res.status(400).json({ error: 'No services selected.' });

    const force = req.body?.force === true;
    const rows = await ServiceItem.findAll({ where: { id: { [Op.in]: ids } } });

    const deleted = [];
    const blocked = [];
    let detached = 0;

    for (const s of rows) {
      const used = await QuoteItem.count({ where: { service_item_id: s.id } });
      if (used > 0 && !force) {
        blocked.push({ id: s.id, name: s.name, contracts: used });
        continue;
      }
      if (used > 0) detached += await detachAndDestroy(s);
      else await s.destroy();
      deleted.push({ id: s.id, name: s.name });
    }

    res.json({ ok: true, deleted, blocked, detached });
  } catch (err) {
    next(err);
  }
});

export default router;
