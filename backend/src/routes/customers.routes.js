import { Router } from 'express';
import { Op } from 'sequelize';
import { Customer, Quote } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

// Liste + arama
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const where = q
    ? { [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { code: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
        { tax_no: { [Op.like]: `%${q}%` } },
      ] }
    : {};
  const rows = await Customer.findAll({ where, order: [['name', 'ASC']] });
  res.json(rows);
});

// Tekil müşteri + teklif geçmişi (cari)
router.get('/:id', async (req, res) => {
  const customer = await Customer.findByPk(req.params.id, {
    include: [{ model: Quote, separate: true, order: [['created_at', 'DESC']] }],
  });
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json(customer);
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'Customer name is required.' });
  if (!body.code) body.code = 'C' + Date.now().toString().slice(-8);
  const c = await Customer.create(body);
  res.status(201).json(c);
});

router.put('/:id', async (req, res) => {
  const c = await Customer.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found.' });
  await c.update(req.body || {});
  res.json(c);
});

router.delete('/:id', auth(['admin', 'sales']), async (req, res) => {
  const c = await Customer.findByPk(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found.' });
  // quotes.customer_id has no cascade, so deleting a customer that still has
  // contracts used to fail on the foreign key and surface as an opaque 500.
  const linked = await Quote.count({ where: { customer_id: c.id } });
  if (linked > 0) {
    return res.status(409).json({
      error: `This customer has ${linked} contract(s). Delete or reassign them first.`,
      contracts: linked,
    });
  }
  await c.destroy();
  res.json({ ok: true });
});

export default router;
