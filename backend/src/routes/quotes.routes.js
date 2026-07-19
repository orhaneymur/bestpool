import { Router } from 'express';
import { Op } from 'sequelize';
import { sequelize, Quote, QuoteItem, QuoteInstallment, QuoteSchedule, QuoteNote, Customer, ContractTemplate, User, Setting } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { computeTotals } from '../services/pricing.js';
import { buildQuotePdf } from '../services/pdf.js';
import { buildQuoteExcel } from '../services/excel.js';

const router = Router();
router.use(auth());

async function nextQuoteNo() {
  const setting = await Setting.findByPk(1);
  const prefix = setting?.quote_prefix || 'TEK';
  const year = new Date().getFullYear();
  const count = await Quote.count();
  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

async function saveSchedules(quoteId, schedules, t) {
  const rows = Array.isArray(schedules) ? schedules : [];
  for (const [i, s] of rows.entries()) {
    if (!s || !s.day_label) continue;
    await QuoteSchedule.create({
      quote_id: quoteId,
      season_type: s.season_type === 'okul' ? 'okul' : 'normal',
      day_label: s.day_label,
      open_time: s.is_closed ? null : (s.open_time || null),
      close_time: s.is_closed ? null : (s.close_time || null),
      is_closed: !!s.is_closed,
      sort_order: s.sort_order ?? i,
    }, { transaction: t });
  }
}

async function saveNotes(quoteId, notes, t) {
  const rows = Array.isArray(notes) ? notes : [];
  for (const [i, n] of rows.entries()) {
    const body = (n?.body || '').trim();
    if (!body) continue;
    await QuoteNote.create({
      quote_id: quoteId,
      label: n.label || null,
      body,
      sort_order: n.sort_order ?? i,
    }, { transaction: t });
  }
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

// Liste (filtre: müşteri, durum, sezon yılı, arama)
router.get('/', async (req, res) => {
  const and = [];
  if (req.query.customer_id) and.push({ customer_id: req.query.customer_id });
  if (req.query.status) and.push({ status: req.query.status });
  if (req.query.year) {
    const y = Number(req.query.year);
    if (y) {
      and.push({
        [Op.or]: [
          { season_start: { [Op.between]: [`${y}-01-01`, `${y}-12-31`] } },
          { created_at: { [Op.between]: [`${y}-01-01`, `${y}-12-31 23:59:59`] } },
        ],
      });
    }
  }
  if (req.query.q) {
    const q = `%${String(req.query.q).trim()}%`;
    and.push({
      [Op.or]: [
        { quote_no: { [Op.like]: q } },
        { facility_name: { [Op.like]: q } },
      ],
    });
  }
  let rows = await Quote.findAll({
    where: and.length ? { [Op.and]: and } : {},
    include: [{ model: Customer, attributes: ['id', 'name', 'code'] }],
    order: [['created_at', 'DESC']],
  });
  if (req.query.q) {
    const needle = String(req.query.q).trim().toLowerCase();
    rows = rows.filter((r) => {
      const hay = [r.quote_no, r.facility_name, r.Customer?.name, r.Customer?.code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const q = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!q) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  res.json(q);
});

// Oluştur
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const body = req.body || {};
    if (!body.customer_id) return res.status(400).json({ error: 'Müşteri seçilmeli.' });
    const items = Array.isArray(body.items) ? body.items : [];
    const totals = computeTotals(items, { discount_rate: body.discount_rate, discount_amount: body.discount_amount });

    const quote = await Quote.create({
      quote_no: await nextQuoteNo(),
      customer_id: body.customer_id,
      contract_template_id: body.contract_template_id || null,
      created_by: req.user.id,
      facility_name: body.facility_name,
      facility_address: body.facility_address,
      season_start: body.season_start || null,
      season_end: body.season_end || null,
      lifeguard_count: body.lifeguard_count || 0,
      hours_per_week: body.hours_per_week || 0,
      subtotal: totals.subtotal,
      discount_rate: totals.discount_rate,
      discount_amount: totals.discount_amount,
      early_bird_discount: body.early_bird_discount || 0,
      vat_amount: totals.vat_amount,
      total: totals.total,
      currency: body.currency || 'TRY',
      status: body.status || 'taslak',
      valid_until: body.valid_until || null,
      notes: body.notes,
    }, { transaction: t });

    for (const [i, it] of totals.lines.entries()) {
      await QuoteItem.create({
        quote_id: quote.id,
        service_item_id: it.service_item_id || null,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || 'adet',
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        line_total: it.line_total,
        sort_order: i,
      }, { transaction: t });
    }

    for (const inst of (body.installments || [])) {
      await QuoteInstallment.create({
        quote_id: quote.id,
        label: inst.label,
        due_date: inst.due_date || null,
        amount: inst.amount || 0,
      }, { transaction: t });
    }

    await saveSchedules(quote.id, body.schedules, t);
    await saveNotes(quote.id, body.special_notes, t);

    await t.commit();
    const created = await Quote.findByPk(quote.id, { include: fullQuoteInclude() });
    res.status(201).json(created);
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Teklif oluşturulamadı: ' + err.message });
  }
});

// Güncelle (kalemler + taksitler tümüyle değiştirilir)
router.put('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) { await t.rollback(); return res.status(404).json({ error: 'Teklif bulunamadı.' }); }
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const totals = computeTotals(items, { discount_rate: body.discount_rate, discount_amount: body.discount_amount });

    await quote.update({
      customer_id: body.customer_id ?? quote.customer_id,
      contract_template_id: body.contract_template_id ?? quote.contract_template_id,
      facility_name: body.facility_name,
      facility_address: body.facility_address,
      season_start: body.season_start || null,
      season_end: body.season_end || null,
      lifeguard_count: body.lifeguard_count || 0,
      hours_per_week: body.hours_per_week || 0,
      subtotal: totals.subtotal,
      discount_rate: totals.discount_rate,
      discount_amount: totals.discount_amount,
      early_bird_discount: body.early_bird_discount || 0,
      vat_amount: totals.vat_amount,
      total: totals.total,
      currency: body.currency || quote.currency,
      status: body.status || quote.status,
      valid_until: body.valid_until || null,
      notes: body.notes,
    }, { transaction: t });

    await QuoteItem.destroy({ where: { quote_id: quote.id }, transaction: t });
    for (const [i, it] of totals.lines.entries()) {
      await QuoteItem.create({
        quote_id: quote.id, service_item_id: it.service_item_id || null, description: it.description,
        quantity: it.quantity, unit: it.unit || 'adet', unit_price: it.unit_price,
        vat_rate: it.vat_rate, line_total: it.line_total, sort_order: i,
      }, { transaction: t });
    }
    await QuoteInstallment.destroy({ where: { quote_id: quote.id }, transaction: t });
    for (const inst of (body.installments || [])) {
      await QuoteInstallment.create({ quote_id: quote.id, label: inst.label, due_date: inst.due_date || null, amount: inst.amount || 0 }, { transaction: t });
    }

    await QuoteSchedule.destroy({ where: { quote_id: quote.id }, transaction: t });
    await saveSchedules(quote.id, body.schedules, t);
    await QuoteNote.destroy({ where: { quote_id: quote.id }, transaction: t });
    await saveNotes(quote.id, body.special_notes, t);

    await t.commit();
    res.json(await Quote.findByPk(quote.id, { include: fullQuoteInclude() }));
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Teklif güncellenemedi: ' + err.message });
  }
});

// Sadece durum güncelle
router.patch('/:id/status', async (req, res) => {
  const quote = await Quote.findByPk(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  await quote.update({ status: req.body.status });
  res.json(quote);
});

// Mevcut teklifi kopyala (yeni sezon için hızlı başlangıç)
router.post('/:id/duplicate', auth(['admin', 'sales']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const src = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
    if (!src) {
      await t.rollback();
      return res.status(404).json({ error: 'Teklif bulunamadı.' });
    }
    const copy = await Quote.create({
      quote_no: await nextQuoteNo(),
      customer_id: src.customer_id,
      contract_template_id: src.contract_template_id,
      created_by: req.user.id,
      facility_name: src.facility_name,
      facility_address: src.facility_address,
      season_start: src.season_start,
      season_end: src.season_end,
      lifeguard_count: src.lifeguard_count,
      hours_per_week: src.hours_per_week,
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
    }, { transaction: t });

    for (const [i, it] of (src.items || []).entries()) {
      await QuoteItem.create({
        quote_id: copy.id,
        service_item_id: it.service_item_id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        line_total: it.line_total,
        sort_order: i,
      }, { transaction: t });
    }
    for (const inst of (src.installments || [])) {
      await QuoteInstallment.create({
        quote_id: copy.id,
        label: inst.label,
        due_date: inst.due_date,
        amount: inst.amount,
      }, { transaction: t });
    }
    await saveSchedules(copy.id, (src.schedules || []).map((s) => s.toJSON ? s.toJSON() : s), t);
    await saveNotes(copy.id, (src.special_notes || []).map((n) => n.toJSON ? n.toJSON() : n), t);

    await t.commit();
    res.status(201).json(await Quote.findByPk(copy.id, { include: fullQuoteInclude() }));
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Teklif kopyalanamadı: ' + err.message });
  }
});

router.delete('/:id', auth(['admin', 'sales']), async (req, res) => {
  const quote = await Quote.findByPk(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  await quote.destroy();
  res.json({ ok: true });
});

// --- Çıktılar ---
router.get('/:id/pdf', async (req, res) => {
  const quote = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  const setting = await Setting.findByPk(1);
  const buffer = await buildQuotePdf(quote.toJSON(), setting?.toJSON() || {});
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_no}.pdf"`);
  res.send(buffer);
});

router.get('/:id/excel', async (req, res) => {
  const quote = await Quote.findByPk(req.params.id, { include: fullQuoteInclude() });
  if (!quote) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  const setting = await Setting.findByPk(1);
  const buffer = await buildQuoteExcel(quote.toJSON(), setting?.toJSON() || {});
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_no}.xlsx"`);
  res.send(buffer);
});

export default router;
