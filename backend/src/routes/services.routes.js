import { Router } from 'express';
import { ServiceItem } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

router.get('/', async (_req, res) => {
  const rows = await ServiceItem.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });
  res.json(rows);
});

router.post('/', auth(['admin', 'sales']), async (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'Service name is required.' });
  const s = await ServiceItem.create(body);
  res.status(201).json(s);
});

router.put('/:id', auth(['admin', 'sales']), async (req, res) => {
  const s = await ServiceItem.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found.' });
  await s.update(req.body || {});
  res.json(s);
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  const s = await ServiceItem.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found.' });
  await s.destroy();
  res.json({ ok: true });
});

export default router;
