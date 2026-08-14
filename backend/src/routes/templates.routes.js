import { Router } from '../middleware/asyncRouter.js';
import { Op, fn, col } from 'sequelize';
import { ContractTemplate, Quote } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

/**
 * The list never returns `body`.
 *
 * It is a LONGTEXT holding the full terms and conditions of every template, and
 * it was going out with the contract wizard's opening request even though the
 * wizard only ever shows template names in a dropdown. The list carries a short
 * preview for the cards; the editor fetches the real thing by id.
 */
router.get('/', async (_req, res) => {
  const rows = await ContractTemplate.findAll({
    attributes: [
      'id',
      'name',
      'is_default',
      'created_at',
      'updated_at',
      [fn('LEFT', col('body'), 200), 'body_preview'],
    ],
    order: [['is_default', 'DESC'], ['name', 'ASC']],
  });
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const t = await ContractTemplate.findByPk(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  res.json(t);
});

router.post('/', auth(['admin', 'sales']), async (req, res) => {
  const t = await ContractTemplate.create(req.body || {});
  if (t.is_default) await ContractTemplate.update({ is_default: false }, { where: { id: { [Op.ne]: t.id } } }).catch(() => {});
  res.status(201).json(t);
});

router.put('/:id', auth(['admin', 'sales']), async (req, res) => {
  const t = await ContractTemplate.findByPk(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  await t.update(req.body || {});
  res.json(t);
});

router.delete('/:id', auth(['admin']), async (req, res) => {
  const t = await ContractTemplate.findByPk(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  // Contracts point at the template by foreign key; deleting one that is still
  // referenced failed on the constraint and returned an unexplained 500.
  const linked = await Quote.count({ where: { contract_template_id: t.id } });
  if (linked > 0) {
    return res.status(409).json({
      error: `This template is used by ${linked} contract(s). Switch them to another template first.`,
      contracts: linked,
    });
  }
  await t.destroy();
  res.json({ ok: true });
});

export default router;
