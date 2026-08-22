import { Router } from '../middleware/asyncRouter.js';
import { Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { DEFAULT_TAGLINE } from '../services/pdf.js';
import { resolveSmtp, sendTestEmail, verifySmtp } from '../services/mail.js';

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

/**
 * The settings row as the browser is allowed to see it.
 *
 * The mail password is write-only. Sending it back would put the mailbox
 * credential into every settings page load, in the browser's memory and in
 * anything that logs a response body — for no gain, because the form only ever
 * needs to know whether one is stored, not what it is.
 */
function publicSetting(row) {
  const { smtp_pass, ...rest } = row.toJSON ? row.toJSON() : row;
  return { ...rest, smtp_pass_set: !!smtp_pass };
}

router.get('/', async (_req, res) => {
  res.json(publicSetting(await getOrCreate()));
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
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user',
  'smtp_from_email', 'smtp_from_name', 'smtp_reply_to',
  // smtp_pass is handled separately below: absent means "leave it alone", which
  // is what every save from a form that never received it has to mean.
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
    smtp_host: 160, smtp_user: 160, smtp_from_email: 160, smtp_from_name: 200,
    smtp_reply_to: 160,
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
  if (patch.smtp_port !== undefined) {
    const n = Number(patch.smtp_port);
    patch.smtp_port = Number.isFinite(n) && n > 0 ? Math.min(65535, Math.round(n)) : null;
  }
  if (patch.smtp_secure !== undefined) patch.smtp_secure = !!patch.smtp_secure;

  /**
   * The mail password.
   *
   * Absent means the form never had it and nothing should change — which is the
   * ordinary case, since it is never sent to the browser. An empty string is a
   * deliberate "forget it", and clears the stored one.
   */
  if (Object.prototype.hasOwnProperty.call(body, 'smtp_pass')) {
    const pass = body.smtp_pass == null ? '' : String(body.smtp_pass);
    if (pass !== '') patch.smtp_pass = pass.slice(0, 255);
    else if (body.smtp_pass === '') patch.smtp_pass = null;
  }

  await s.update(patch);
  res.json(publicSetting(s));
});

/**
 * Proves the mail account works, from the screen where it is entered.
 *
 * `check` authenticates and stops there; `send` posts a short message. A wrong
 * password should surface here rather than on the contract somebody was trying
 * to send a customer — nodemailer's own errors are passed through, because
 * "Invalid login" and "getaddrinfo ENOTFOUND" say more than anything generic
 * this could put in their place.
 */
router.post('/smtp-test', auth(['admin']), async (req, res) => {
  const s = await getOrCreate();
  const setting = s.toJSON();
  const mode = req.body?.mode === 'send' ? 'send' : 'check';

  try {
    if (mode === 'check') {
      return res.json({ ok: true, mode, ...(await verifySmtp(setting)) });
    }
    return res.json({ ok: true, mode, ...(await sendTestEmail(setting, req.body?.to)) });
  } catch (err) {
    const status = err.code === 'SMTP_NOT_CONFIGURED' || err.code === 'NO_RECIPIENT' ? 400 : 502;
    return res.status(status).json({ error: err.message || 'The mail server refused the connection.' });
  }
});

/**
 * What the server would use to send, with nothing secret in it.
 *
 * Answers "which account is actually going out?" — the fields fall back to the
 * pod's environment one at a time, so the stored settings alone do not tell you.
 */
router.get('/smtp', auth(['admin']), async (_req, res) => {
  const s = await getOrCreate();
  const { pass, ...rest } = resolveSmtp(s.toJSON());
  res.json({ ...rest, configured: !!pass });
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
