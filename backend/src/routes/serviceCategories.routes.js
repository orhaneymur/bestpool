import { Router } from 'express';
import { ServiceCategory, ServiceItem } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

/** Turns "Winter Care" into "winter-care" — the stable key stored on services. */
export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

router.get('/', async (_req, res) => {
  const rows = await ServiceCategory.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] });
  // The service count travels with each row so the UI can warn before deleting
  // and can grey out a category nothing uses.
  const counts = await ServiceItem.findAll({
    attributes: ['category'],
    raw: true,
  });
  const used = counts.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  res.json(rows.map((r) => ({ ...r.toJSON(), service_count: used[r.code] || 0 })));
});

router.post('/', auth(['admin']), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required.' });

  const code = slugify(req.body?.code || name);
  if (!code) return res.status(400).json({ error: 'Category name must contain a letter or a digit.' });

  const clash = await ServiceCategory.findOne({ where: { code } });
  if (clash) return res.status(409).json({ error: `“${clash.name}” already uses the key "${code}".` });

  const last = await ServiceCategory.max('sort_order');
  const row = await ServiceCategory.create({
    code,
    name: name.slice(0, 120),
    sort_order: Number.isFinite(last) ? last + 1 : 0,
    is_active: req.body?.is_active !== false,
  });
  res.status(201).json({ ...row.toJSON(), service_count: 0 });
});

router.put('/:id', auth(['admin']), async (req, res) => {
  const row = await ServiceCategory.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found.' });

  const patch = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Category name cannot be empty.' });
    patch.name = name.slice(0, 120);
  }
  if (req.body?.sort_order !== undefined) patch.sort_order = Number(req.body.sort_order) || 0;
  if (req.body?.is_active !== undefined) patch.is_active = !!req.body.is_active;

  // `code` is intentionally not editable: services store it, so changing it
  // would silently orphan every service in this category.
  await row.update(patch);
  res.json(row);
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  const row = await ServiceCategory.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found.' });

  const inUse = await ServiceItem.count({ where: { category: row.code } });
  if (inUse > 0) {
    return res.status(409).json({
      error: `“${row.name}” is used by ${inUse} service(s). Move them to another category first.`,
      services: inUse,
    });
  }
  await row.destroy();
  res.json({ ok: true });
});

export default router;
