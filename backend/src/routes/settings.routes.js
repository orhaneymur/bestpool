import { Router } from '../middleware/asyncRouter.js';
import { Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { DEFAULT_TAGLINE } from '../services/pdf.js';

const router = Router();
router.use(auth());

async function getOrCreate() {
  let s = await Setting.findByPk(1);
  if (!s) {
    s = await Setting.create({
      id: 1,
      company_name: 'Four Seasons Pool Management',
      company_email: 'orhaneymur@gmail.com',
      company_tagline: DEFAULT_TAGLINE,
      quote_prefix: 'FSPM',
    });
  }
  return s;
}

router.get('/', async (_req, res) => {
  res.json(await getOrCreate());
});

/**
 * Whitelisted so a stray key in the request body cannot rewrite `id` (which would
 * orphan the single settings row) or `definitions` (which has its own validated
 * endpoint at /api/definitions and would bypass those checks here).
 */
const EDITABLE = [
  'company_name', 'company_address', 'company_phone', 'company_fax',
  'company_email', 'company_website', 'company_tagline', 'rev_label',
  'tax_office', 'tax_no', 'logo_url', 'quote_prefix', 'default_vat_rate',
  'signature_image',
];

/**
 * The authorised signatory's signature, uploaded as a data URI.
 *
 * Validated here rather than trusted: it is handed straight to pdfmake, which
 * throws on anything it cannot decode, and a rejected upload with a clear reason
 * beats every future export failing. An empty string clears it.
 *
 * The ceiling is well under the 2 MB express.json limit — a signature is a small
 * transparent PNG, and anything approaching a megabyte is a photograph that
 * would print as a grey smudge anyway.
 */
const SIGNATURE_MAX_BYTES = 1_000_000;

/** File signatures, checked against the decoded bytes rather than the header. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function validateSignature(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  const str = String(value);
  const header = /^data:image\/(png|jpe?g);base64,/.exec(str);
  if (!header) return { error: 'The signature must be a PNG or JPEG image.' };
  if (str.length > SIGNATURE_MAX_BYTES) {
    return { error: `The signature image is too large (max ${Math.round(SIGNATURE_MAX_BYTES / 1000)} KB).` };
  }

  /**
   * The declared type is not enough.
   *
   * pdfmake throws on image data it cannot decode, and by then the damage is
   * done: every export fails, on a contract, with an error that says nothing
   * about an upload made days earlier. A truncated or mislabelled file is
   * rejected here, while someone is looking at the upload button.
   */
  let bytes;
  try {
    bytes = Buffer.from(str.slice(str.indexOf(',') + 1), 'base64');
  } catch {
    return { error: 'That image could not be decoded.' };
  }
  const isPng = bytes.subarray(0, 8).equals(PNG_MAGIC);
  const isJpeg = bytes.subarray(0, 3).equals(JPEG_MAGIC);
  if (!isPng && !isJpeg) return { error: 'That file is not a valid PNG or JPEG image.' };
  // A PNG must end with an IEND chunk; a truncated upload will not.
  if (isPng && !bytes.subarray(-8).includes(Buffer.from('IEND'))) {
    return { error: 'That PNG looks incomplete. Try exporting it again.' };
  }

  return { value: str };
}

router.put('/', auth(['admin']), async (req, res) => {
  const s = await getOrCreate();
  const body = req.body || {};
  const patch = {};
  // Column widths, so an over-long value is trimmed rather than rejected by
  // MySQL. Keep in step with the Setting model.
  const MAXLEN = {
    company_name: 200, company_address: 2000, company_phone: 60, company_fax: 60,
    company_email: 160, company_website: 160, company_tagline: 200, rev_label: 40,
    tax_office: 120, tax_no: 40, logo_url: 300,
  };
  for (const key of EDITABLE) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const limit = MAXLEN[key];
    patch[key] = limit && body[key] != null ? String(body[key]).slice(0, limit) : body[key];
  }

  if (Object.prototype.hasOwnProperty.call(body, 'signature_image')) {
    const checked = validateSignature(body.signature_image);
    if (checked.error) return res.status(400).json({ error: checked.error });
    patch.signature_image = checked.value;
  }
  if (patch.quote_prefix !== undefined) {
    // Feeds straight into contract numbers, so keep it to safe filename characters.
    patch.quote_prefix = String(patch.quote_prefix).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 20) || 'FSPM';
  }
  if (patch.default_vat_rate !== undefined) {
    const n = Number(patch.default_vat_rate);
    patch.default_vat_rate = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }
  await s.update(patch);
  res.json(s);
});

/**
 * Just the signature, for the live preview.
 *
 * A separate endpoint so the contract wizard does not have to fetch the whole
 * settings row — and authenticated, unlike the brand logo: this image goes on
 * signed paperwork and should not sit behind a guessable public URL.
 */
router.get('/signature', async (_req, res) => {
  const s = await Setting.findByPk(1);
  res.json({ image: s?.signature_image || null });
});

export default router;
