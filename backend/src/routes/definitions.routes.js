import { Router } from 'express';
import { Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import {
  PDF_BLOCKS,
  DEFAULT_DEFINITIONS,
  mergeDefinitions,
  validateDefinitions,
} from '../config/pdfDefinitions.js';

const router = Router();
router.use(auth());

/**
 * The frontend renders the Definitions screen from this payload rather than from
 * its own hard-coded copy, so adding a hideable block to pdfDefinitions.js makes
 * it appear in the UI without touching React.
 */
router.get('/schema', (_req, res) => {
  res.json({ blocks: PDF_BLOCKS, defaults: DEFAULT_DEFINITIONS });
});

router.get('/', async (_req, res) => {
  const s = await Setting.findByPk(1);
  res.json(mergeDefinitions(s?.definitions));
});

router.put('/', auth(['admin']), async (req, res) => {
  const { definitions, errors } = validateDefinitions(req.body);
  let s = await Setting.findByPk(1);
  if (!s) s = await Setting.create({ id: 1 });
  await s.update({ definitions });
  // Out-of-range values are corrected rather than rejected, but the caller is
  // told what was changed so the UI can surface it instead of silently differing.
  res.json({ definitions, errors });
});

router.post('/reset', auth(['admin']), async (_req, res) => {
  let s = await Setting.findByPk(1);
  if (!s) s = await Setting.create({ id: 1 });
  await s.update({ definitions: DEFAULT_DEFINITIONS });
  res.json({ definitions: mergeDefinitions(DEFAULT_DEFINITIONS), errors: [] });
});

export default router;
