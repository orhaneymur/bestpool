import { Router } from '../middleware/asyncRouter.js';
import { Op } from 'sequelize';
import { Customer, Quote } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { parsePaging, pageResult } from '../middleware/pagination.js';

const router = Router();
router.use(auth());

/**
 * Columns the list screens and the customer picker actually render. `address`
 * and `notes` are TEXT and were being shipped for every row to draw a table
 * that shows neither.
 */
const LIST_ATTRIBUTES = ['id', 'code', 'name', 'contact_person', 'phone', 'city'];

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
  const { limit, offset, page } = parsePaging(req.query);
  const { rows, count } = await Customer.findAndCountAll({
    where,
    attributes: LIST_ATTRIBUTES,
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  res.json(pageResult({ rows, count, page, limit }));
});

/**
 * Tekil müşteri + teklif geçmişi (cari).
 *
 * The contract history is opt-in. The edit form and the contract wizard only
 * need the customer record, and pulling every contract they have ever had made
 * opening that form far more expensive than it looks.
 */
router.get('/:id', async (req, res) => {
  const withQuotes = req.query.include === 'quotes';
  const customer = await Customer.findByPk(req.params.id, {
    include: withQuotes
      ? [{
          model: Quote,
          separate: true,
          order: [['created_at', 'DESC']],
          attributes: ['id', 'quote_no', 'facility_name', 'status', 'total', 'currency', 'created_at'],
        }]
      : [],
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
