import { Router } from '../middleware/asyncRouter.js';
import { Op, fn, col, QueryTypes } from 'sequelize';
import { sequelize, Quote, QuoteItem, QuoteInstallment, QuoteSchedule, QuoteNote, Customer, ContractTemplate, User, Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { computeTotals } from '../services/pricing.js';
import { renderDocument } from '../services/renderPool.js';
import { parsePaging, pageResult } from '../middleware/pagination.js';
import { mergeDefinitions, sanitizeHiddenFields } from '../config/pdfDefinitions.js';
import { buildProposalEmail, sendProposalEmail } from '../services/mail.js';

const router = Router();
router.use(auth());

/**
 * Contract numbers read "FSPM-2026-001": prefix, calendar year, 3-digit sequence
 * that restarts each year. The sequence continues from the highest number already
 * issued this year rather than from the row count, so deleting a quote cannot make
 * the next one collide with the unique quote_no index.
 */
async function nextQuoteNo(attempt = 0) {
  const setting = await Setting.findByPk(1);
  const def = mergeDefinitions(setting?.definitions);
  const prefix = (setting?.quote_prefix || 'FSPM').trim().toUpperCase();
  const year = new Date().getFullYear();
  const stem = def.numbering.yearlyReset ? `${prefix}-${year}-` : `${prefix}-`;

  // MySQL finds the highest sequence. This used to pull every contract number
  // issued this year back into Node just to run Math.max over them, so saving a
  // contract got steadily slower as the year went on.
  const [row] = await sequelize.query(
    `SELECT MAX(CAST(SUBSTRING(quote_no, :stemLength) AS UNSIGNED)) AS highest
       FROM quotes
      WHERE quote_no LIKE :pattern
        AND SUBSTRING(quote_no, :stemLength) REGEXP '^[0-9]+$'`,
    {
      // SUBSTRING is 1-indexed, so the sequence starts one past the stem.
      replacements: { stemLength: stem.length + 1, pattern: `${stem}%` },
      type: QueryTypes.SELECT,
    }
  );

  const highest = Number(row?.highest) || 0;

  // `attempt` walks the sequence forward when a concurrent request grabbed the
  // same number first — see createWithUniqueNo().
  return `${stem}${String(highest + 1 + attempt).padStart(def.numbering.padding, '0')}`;
}

/**
 * Two users saving a new contract at the same moment can compute the same
 * quote_no. The unique index then rejects the second one with a 500 that looks
 * random to the user, so retry with the next number instead.
 */
async function createWithUniqueNo(build, transaction) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Quote.create({ ...build, quote_no: await nextQuoteNo(attempt) }, { transaction });
    } catch (err) {
      const isDuplicate =
        err?.name === 'SequelizeUniqueConstraintError' ||
        /duplicate entry/i.test(err?.parent?.message || '');
      if (!isDuplicate || attempt === 4) throw err;
    }
  }
  throw new Error('Could not allocate a contract number.');
}

const QUOTE_STATUSES = ['taslak', 'gonderildi', 'kabul', 'red'];

/** Company-wide default set of hidden PDF blocks, used to seed a new contract. */
async function defaultHiddenFields() {
  const setting = await Setting.findByPk(1);
  return mergeDefinitions(setting?.definitions).hidden;
}

/**
 * Saving a contract writes four child tables. Each row used to be its own
 * awaited INSERT inside the transaction — a typical contract meant forty-odd
 * sequential round trips, all of them holding locks while the next one waited
 * for the network. bulkCreate sends each table as a single statement.
 */
async function saveSchedules(quoteId, schedules, t) {
  const rows = (Array.isArray(schedules) ? schedules : [])
    .map((s, i) => (!s || !s.day_label ? null : {
      quote_id: quoteId,
      season_type: s.season_type === 'okul' ? 'okul' : 'normal',
      day_label: s.day_label,
      open_time: s.is_closed ? null : (s.open_time || null),
      close_time: s.is_closed ? null : (s.close_time || null),
      is_closed: !!s.is_closed,
      sort_order: s.sort_order ?? i,
    }))
    .filter(Boolean);
  if (rows.length) await QuoteSchedule.bulkCreate(rows, { transaction: t });
}

async function saveNotes(quoteId, notes, t) {
  const rows = (Array.isArray(notes) ? notes : [])
    .map((n, i) => {
      const body = (n?.body || '').trim();
      if (!body) return null;
      return { quote_id: quoteId, label: n.label || null, body, sort_order: n.sort_order ?? i };
    })
    .filter(Boolean);
  if (rows.length) await QuoteNote.bulkCreate(rows, { transaction: t });
}

/** Contract line items, in the order the form listed them. */
function itemRows(quoteId, lines) {
  return (lines || []).map((it, i) => ({
    quote_id: quoteId,
    service_item_id: it.service_item_id || null,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit || 'unit',
    unit_price: it.unit_price,
    vat_rate: it.vat_rate,
    line_total: it.line_total,
    sort_order: i,
  }));
}

function installmentRows(quoteId, installments) {
  return (installments || []).map((inst) => ({
    quote_id: quoteId,
    label: inst.label,
    due_date: nullIfEmpty(inst.due_date),
    amount: toNum(inst.amount, 0),
  }));
}

function nullIfEmpty(v) {
  if (v === undefined || v === null || v === '') return null;
  return v;
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => (it?.description || '').trim())
    .map((it) => ({
      ...it,
      description: String(it.description).trim().slice(0, 500),
      quantity: toNum(it.quantity, 0),
      unit_price: toNum(it.unit_price, 0),
      vat_rate: toNum(it.vat_rate, 0),
      unit: it.unit || 'unit',
      service_item_id: nullIfEmpty(it.service_item_id),
    }));
}

function quoteFieldsFromBody(body, existing = {}) {
  return {
    customer_id: body.customer_id ?? existing.customer_id,
    contract_template_id: nullIfEmpty(body.contract_template_id ?? existing.contract_template_id),
    facility_name: body.facility_name ?? existing.facility_name ?? null,
    facility_address: body.facility_address ?? existing.facility_address ?? null,
    season_start: nullIfEmpty(body.season_start),
    season_end: nullIfEmpty(body.season_end),
    lifeguard_count: toInt(body.lifeguard_count, 0),
    hours_per_week: toInt(body.hours_per_week, 0),
    county: nullIfEmpty(body.county),
    peak_weeks: toInt(body.peak_weeks, 0),
    early_bird_discount: toNum(body.early_bird_discount, 0),
    currency: body.currency || existing.currency || 'USD',
    status: QUOTE_STATUSES.includes(body.status) ? body.status : existing.status || 'taslak',
    valid_until: nullIfEmpty(body.valid_until),
    notes: body.notes ?? existing.notes ?? null,
    school_closes: nullIfEmpty(body.school_closes),
    school_reopens: nullIfEmpty(body.school_reopens),
    holiday_policy:
      body.holiday_policy && typeof body.holiday_policy === 'object'
        ? body.holiday_policy
        : existing.holiday_policy ?? null,
    hidden_fields: Array.isArray(body.hidden_fields)
      ? sanitizeHiddenFields(body.hidden_fields)
      : sanitizeHiddenFields(existing.hidden_fields),
  };
}

function fullQuoteInclude() {
  return [
    { model: Customer },
    { model: QuoteItem, as: 'items' },
    { model: QuoteInstallment, as: 'installments' },
    { model: QuoteSchedule, as: 'schedules' },
    { model: QuoteNote, as: 'special_notes' },
    { model: ContractTemplate, as: 'template' },
    { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
  ];
}

/** Columns the contract table renders — the rest stays in the database. */
const LIST_ATTRIBUTES = [
  'id', 'quote_no', 'customer_id', 'facility_name', 'season_start', 'season_end',
  'status', 'total', 'currency', 'created_at',
];

/**
 * Everything except the status filter, so the status tiles can be counted over
 * the same year and search the user is looking at.
 */
function baseFilter(query) {
  const and = [];
  if (query.customer_id) and.push({ customer_id: query.customer_id });
  if (query.year) {
    const y = Number(query.year);
    if (y) {
      and.push({
        [Op.or]: [
          { season_start: { [Op.between]: [`${y}-01-01`, `${y}-12-31`] } },
          { created_at: { [Op.between]: [`${y}-01-01`, `${y}-12-31 23:59:59`] } },
        ],
      });
    }
  }
  if (query.q) {
    const q = `%${String(query.q).trim()}%`;
    // The customer columns are matched in SQL through the joined table. This
    // used to be a second pass in JavaScript over every row the database had
    // already returned, which meant fetching rows only to throw them away.
    and.push({
      [Op.or]: [
        { quote_no: { [Op.like]: q } },
        { facility_name: { [Op.like]: q } },
        { '$Customer.name$': { [Op.like]: q } },
        { '$Customer.code$': { [Op.like]: q } },
      ],
    });
  }
  return and;
}

// Liste (filtre: müşteri, durum, sezon yılı, arama)
router.get('/', async (req, res) => {
  const base = baseFilter(req.query);
  const and = [...base];
  if (req.query.status) and.push({ status: req.query.status });

  const { limit, offset, page } = parsePaging(req.query);
  const customerJoin = { model: Customer, attributes: ['id', 'name', 'code'] };

  const [{ rows, count }, statusRows] = await Promise.all([
    Quote.findAndCountAll({
      where: and.length ? { [Op.and]: and } : {},
      attributes: LIST_ATTRIBUTES,
      include: [customerJoin],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      // belongsTo is one row per contract, so LIMIT can be applied directly
      // instead of Sequelize wrapping the query in a subquery.
      subQuery: false,
      distinct: true,
    }),
    // The tiles show totals for the whole filter, not for the page on screen.
    Quote.findAll({
      where: base.length ? { [Op.and]: base } : {},
      attributes: ['status', [fn('COUNT', col('Quote.id')), 'count']],
      include: req.query.q ? [{ ...customerJoin, attributes: [] }] : [],
      group: ['Quote.status'],
      raw: true,
    }),
  ]);

  const counts = { taslak: 0, gonderildi: 0, kabul: 0, red: 0 };
  statusRows.forEach((r) => {
    if (counts[r.status] != null) counts[r.status] = Number(r.count);
  });

  res.json(pageResult({ rows, count, page, limit, extra: { counts } }));
});

router.get('/:id', async (req, res) => {
  const q = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!q) return res.status(404).json({ error: 'Proposal not found.' });
  res.json(q);
});

// Oluştur
router.post('/', auth(['admin', 'sales']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const body = req.body || {};
    if (!body.customer_id) {
      await t.rollback();
      return res.status(400).json({ error: 'Customer is required.' });
    }
    const items = normalizeItems(body.items);
    const totals = computeTotals(items, { discount_rate: body.discount_rate, discount_amount: body.discount_amount });
    const fields = quoteFieldsFromBody(body);

    const quote = await createWithUniqueNo({
      ...fields,
      // A brand-new contract inherits the company-wide default visibility, then
      // owns its own list — later changes to the default leave it untouched.
      hidden_fields: Array.isArray(body.hidden_fields)
        ? sanitizeHiddenFields(body.hidden_fields)
        : await defaultHiddenFields(),
      created_by: req.user.id,
      subtotal: totals.subtotal,
      discount_rate: totals.discount_rate,
      discount_amount: totals.discount_amount,
      vat_amount: totals.vat_amount,
      total: totals.total,
    }, t);

    const items_ = itemRows(quote.id, totals.lines);
    if (items_.length) await QuoteItem.bulkCreate(items_, { transaction: t });
    const installments_ = installmentRows(quote.id, body.installments);
    if (installments_.length) await QuoteInstallment.bulkCreate(installments_, { transaction: t });

    await saveSchedules(quote.id, body.schedules, t);
    await saveNotes(quote.id, body.special_notes, t);

    await t.commit();
    const created = await Quote.findByPk(quote.id, { include: fullQuoteInclude() });
    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create proposal: ' + err.message });
  }
});

// Güncelle (kalemler + taksitler tümüyle değiştirilir)
router.put('/:id', auth(['admin', 'sales']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) { await t.rollback(); return res.status(404).json({ error: 'Proposal not found.' }); }
    const body = req.body || {};
    const items = normalizeItems(body.items);
    const totals = computeTotals(items, { discount_rate: body.discount_rate, discount_amount: body.discount_amount });
    const fields = quoteFieldsFromBody(body, quote.toJSON());

    await quote.update({
      ...fields,
      subtotal: totals.subtotal,
      discount_rate: totals.discount_rate,
      discount_amount: totals.discount_amount,
      vat_amount: totals.vat_amount,
      total: totals.total,
    }, { transaction: t });

    // Four deletes and four inserts, instead of four deletes and one insert per
    // line, instalment, schedule row and note.
    await QuoteItem.destroy({ where: { quote_id: quote.id }, transaction: t });
    await QuoteInstallment.destroy({ where: { quote_id: quote.id }, transaction: t });
    await QuoteSchedule.destroy({ where: { quote_id: quote.id }, transaction: t });
    await QuoteNote.destroy({ where: { quote_id: quote.id }, transaction: t });

    const items_ = itemRows(quote.id, totals.lines);
    if (items_.length) await QuoteItem.bulkCreate(items_, { transaction: t });
    const installments_ = installmentRows(quote.id, body.installments);
    if (installments_.length) await QuoteInstallment.bulkCreate(installments_, { transaction: t });
    await saveSchedules(quote.id, body.schedules, t);
    await saveNotes(quote.id, body.special_notes, t);

    await t.commit();
    res.json(await Quote.findByPk(quote.id, { include: fullQuoteInclude() }));
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update proposal: ' + err.message });
  }
});

// Sadece durum güncelle
router.patch('/:id/status', auth(['admin', 'sales']), async (req, res) => {
  const quote = await Quote.findByPk(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
  // An unknown value used to reach the ENUM column and surface as a raw 500.
  if (!QUOTE_STATUSES.includes(req.body?.status)) {
    return res.status(400).json({ error: `Status must be one of: ${QUOTE_STATUSES.join(', ')}` });
  }
  await quote.update({ status: req.body.status });
  res.json(quote);
});

/** Toggle which PDF blocks this contract prints, without re-saving the whole form. */
router.patch('/:id/visibility', auth(['admin', 'sales']), async (req, res) => {
  const quote = await Quote.findByPk(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
  const hidden_fields = sanitizeHiddenFields(req.body?.hidden_fields);
  await quote.update({ hidden_fields });
  res.json({ id: quote.id, hidden_fields });
});

// Mevcut teklifi kopyala (yeni sezon için hızlı başlangıç)
router.post('/:id/duplicate', auth(['admin', 'sales']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const src = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
    if (!src) {
      await t.rollback();
      return res.status(404).json({ error: 'Proposal not found.' });
    }
    const copy = await createWithUniqueNo({
      customer_id: src.customer_id,
      contract_template_id: src.contract_template_id,
      created_by: req.user.id,
      facility_name: src.facility_name,
      facility_address: src.facility_address,
      season_start: src.season_start,
      season_end: src.season_end,
      lifeguard_count: src.lifeguard_count,
      hours_per_week: src.hours_per_week,
      county: src.county,
      peak_weeks: src.peak_weeks,
      subtotal: src.subtotal,
      discount_rate: src.discount_rate,
      discount_amount: src.discount_amount,
      early_bird_discount: src.early_bird_discount,
      vat_amount: src.vat_amount,
      total: src.total,
      currency: src.currency,
      status: 'taslak',
      valid_until: null,
      notes: src.notes,
      hidden_fields: sanitizeHiddenFields(src.hidden_fields),
    }, t);

    const copiedItems = itemRows(copy.id, src.items || []);
    if (copiedItems.length) await QuoteItem.bulkCreate(copiedItems, { transaction: t });
    const copiedInstallments = installmentRows(copy.id, src.installments || []);
    if (copiedInstallments.length) await QuoteInstallment.bulkCreate(copiedInstallments, { transaction: t });
    await saveSchedules(copy.id, (src.schedules || []).map((s) => s.toJSON ? s.toJSON() : s), t);
    await saveNotes(copy.id, (src.special_notes || []).map((n) => n.toJSON ? n.toJSON() : n), t);

    await t.commit();
    res.status(201).json(await Quote.findByPk(copy.id, { include: fullQuoteInclude() }));
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to duplicate proposal: ' + err.message });
  }
});

router.delete('/:id', auth(['admin', 'sales']), async (req, res) => {
  const quote = await Quote.findByPk(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
  await quote.destroy();
  res.json({ ok: true });
});

// --- Çıktılar ---
/** Quote numbers are generated, but never trust one straight into a header. */
const safeFilename = (name) => String(name || 'contract').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);

const MIME = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Both exports follow the same path: load the contract, hand it to a render
 * thread, stream the bytes back.
 *
 * The render never runs here. renderPool.js owns the worker threads and the
 * watchdog, so a slow contract costs one background thread instead of freezing
 * every other request in the process.
 */
async function sendRender(req, res, kind, extension) {
  const quote = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
  const setting = await Setting.findByPk(1);

  let buffer;
  try {
    buffer = await renderDocument(kind, quote.toJSON(), setting?.toJSON() || {});
  } catch (err) {
    console.error(`[${kind}] Contract ${quote.quote_no} (id ${quote.id}) failed:`, err?.stack || err);
    return res
      .status(err.status || 500)
      .json({ error: `Could not build the ${kind === 'pdf' ? 'PDF' : 'Excel file'}: ${err.message}` });
  }

  res.setHeader('Content-Type', MIME[kind]);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(quote.quote_no)}.${extension}"`);
  // Content-Length lets the browser show a real progress bar instead of an
  // open-ended spinner. res.end() rather than res.send() so Express does not
  // hash the whole document again just to produce an ETag nobody revalidates.
  res.setHeader('Content-Length', buffer.length);
  return res.end(buffer);
}

router.get('/:id/pdf', (req, res) => sendRender(req, res, 'pdf', 'pdf'));
router.get('/:id/excel', (req, res) => sendRender(req, res, 'excel', 'xlsx'));

// Email draft preview (auto-filled English body)
router.get('/:id/email-preview', async (req, res) => {
  const quote = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
  const setting = await Setting.findByPk(1);
  const draft = buildProposalEmail(quote.toJSON(), setting?.toJSON() || {});
  res.json({
    ...draft,
    customer_name: quote.Customer?.name || '',
    customer_email: quote.Customer?.email || '',
    configured: !!(process.env.SMTP_PASS || process.env.SMTP_PASSWORD),
  });
});

// Send proposal PDF to customer (after user reviews PDF)
router.post('/:id/email', auth(['admin', 'sales']), async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
    if (!quote) return res.status(404).json({ error: 'Proposal not found.' });
    const setting = await Setting.findByPk(1);
    const result = await sendProposalEmail(quote.toJSON(), setting?.toJSON() || {}, {
      to: req.body?.to,
      subject: req.body?.subject,
      text: req.body?.text,
    });
    if (quote.status === 'taslak') {
      await quote.update({ status: 'gonderildi' });
    }
    res.json({
      ok: true,
      ...result,
      status: quote.status === 'taslak' ? 'gonderildi' : quote.status,
    });
  } catch (err) {
    const status = err.code === 'SMTP_NOT_CONFIGURED' || err.code === 'NO_RECIPIENT' ? 400 : 500;
    res.status(status).json({ error: err.message || 'Failed to send email.' });
  }
});

export default router;
