import { Router } from '../middleware/asyncRouter.js';
import { fn, col } from 'sequelize';
import { Quote, Customer } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

router.get('/summary', async (_req, res) => {
  const [customerCount, quoteCount, statusRows, totalAccepted, totalPotential] = await Promise.all([
    Customer.count(),
    Quote.count(),
    Quote.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
    Quote.sum('total', { where: { status: 'kabul' } }),
    Quote.sum('total'),
  ]);

  const byStatus = { taslak: 0, gonderildi: 0, kabul: 0, red: 0 };
  statusRows.forEach((r) => { byStatus[r.status] = Number(r.count); });

  const recent = await Quote.findAll({
    include: [{ model: Customer, attributes: ['name'] }],
    order: [['created_at', 'DESC']],
    limit: 8,
  });

  res.json({
    customerCount,
    quoteCount,
    byStatus,
    totalAccepted: Number(totalAccepted || 0),
    totalPotential: Number(totalPotential || 0),
    recent,
  });
});

export default router;
