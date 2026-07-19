import { Router } from 'express';
import { Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth());

async function getOrCreate() {
  let s = await Setting.findByPk(1);
  if (!s) {
    s = await Setting.create({
      id: 1,
      company_name: 'Four Seasons Pool Management',
      company_email: 'orhaneymur@gmail.com',
      company_tagline: 'Where Customer Service is a Policy, Not a Department',
    });
  }
  return s;
}

router.get('/', async (_req, res) => {
  res.json(await getOrCreate());
});

router.put('/', auth(['admin']), async (req, res) => {
  const s = await getOrCreate();
  await s.update(req.body || {});
  res.json(s);
});

export default router;
