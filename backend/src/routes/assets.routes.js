import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/**
 * Brand artwork, served so the live contract preview can show the same logo the
 * PDF prints instead of the frontend keeping its own copy that would drift.
 *
 * Deliberately unauthenticated and allow-listed: these are public brand images,
 * and the fixed list means the path can never be steered somewhere else.
 */
const ALLOWED = {
  'logo.png': 'image/png',
  'background-watermark.png': 'image/png',
};

router.get('/:name', (req, res) => {
  const type = ALLOWED[req.params.name];
  if (!type) return res.status(404).json({ error: 'Unknown asset.' });

  const file = path.join(ASSET_DIR, req.params.name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Asset not found.' });

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(file).pipe(res);
});

export default router;
