import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signToken, auth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  const user = await User.findOne({ where: { email, is_active: true } });
  if (!user) return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', auth(), async (req, res) => {
  res.json({ user: req.user });
});

// Sadece admin yeni kullanıcı ekleyebilir
router.get('/users', auth(['admin']), async (_req, res) => {
  const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'is_active'], order: [['id', 'ASC']] });
  res.json(users);
});

router.post('/users', auth(['admin']), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Ad, e-posta ve şifre gerekli.' });
  const exists = await User.findOne({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password_hash, role: role || 'sales' });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

export default router;
