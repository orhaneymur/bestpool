import PdfPrinter from 'pdfmake';

/**
 * pdfmake ile kurumsal, çok sayfalı "Commercial Swimming Pool Management Agreement"
 * PDF'i üretir. Örnek (Premier Pool Management) sözleşmesinin düzeni temel alınmıştır:
 *   Sayfa 1  : Kapak
 *   Sayfa 2  : Spesifikasyon (SECTION I–V)
 *   Sayfa 3+ : Genel Hükümler (SECTION VI–XIX) — sözleşme şablonundan
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function getPrinter() {
  const vfs = require('pdfmake/build/vfs_fonts.js');
  const vfsData = vfs?.pdfMake?.vfs || vfs?.vfs || vfs?.default?.pdfMake?.vfs || vfs;
  if (!vfsData || !vfsData['Roboto-Regular.ttf']) {
    throw new Error('pdfmake font (vfs_fonts) yüklenemedi. "npm install pdfmake" kurulu olmalı.');
  }
  return new PdfPrinter({
    Roboto: {
      normal: Buffer.from(vfsData['Roboto-Regular.ttf'], 'base64'),
      bold: Buffer.from(vfsData['Roboto-Medium.ttf'], 'base64'),
      italics: Buffer.from(vfsData['Roboto-Italic.ttf'], 'base64'),
      bolditalics: Buffer.from(vfsData['Roboto-MediumItalic.ttf'], 'base64'),
    },
  });
}

const BLUE = '#0d47a1';
const DAY_EN = {
  pazartesi: 'Monday', sali: 'Tuesday', carsamba: 'Wednesday', persembe: 'Thursday',
  cuma: 'Friday', cumartesi: 'Saturday', pazar: 'Sunday', tatil: 'Holiday',
};
const DAY_ORDER = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar', 'tatil'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const sym = (cur) => (cur === 'TRY' ? '₺' : cur === 'EUR' ? '€' : '$');
const money = (n, cur) => sym(cur) + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function dateEN(d) {
  if (!d) return '____________';
  const dt = new Date(d);
  return `${MONTHS_EN[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

// "14:30" -> "02:30 PM"
function to12h(t) {
  if (!t) return '';
  const [hh, mm] = String(t).split(':').map(Number);
  if (Number.isNaN(hh)) return t;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${String(h12).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')} ${ampm}`;
}

// Bir sezon için Open/Close saat tablosu (pdfmake node'u)
function scheduleColumn(schedules, seasonType, title, subtitle) {
  const rows = (schedules || [])
    .filter((s) => s.season_type === seasonType)
    .sort((a, b) => DAY_ORDER.indexOf(a.day_label) - DAY_ORDER.indexOf(b.day_label));
  const bodyRows = DAY_ORDER.map((day) => {
    const r = rows.find((x) => x.day_label === day);
    const open = r ? (r.is_closed ? 'Closed' : to12h(r.open_time) || '-') : '-';
    const close = r ? (r.is_closed ? '—' : to12h(r.close_time) || '-') : '-';
    return [
      { text: DAY_EN[day], fontSize: 8 },
      { text: open, fontSize: 8, alignment: 'center' },
      { text: close, fontSize: 8, alignment: 'center' },
    ];
  });
  return {
    width: '*',
    stack: [
      { text: title, bold: true, fontSize: 8, margin: [0, 0, 0, 1] },
      subtitle ? { text: subtitle, italics: true, fontSize: 6.5, color: '#666', margin: [0, 0, 0, 2] } : {},
      {
        table: {
          headerRows: 1,
          widths: ['*', 52, 52],
          body: [
            [{ text: '', style: 'th' }, { text: 'Open', style: 'th', alignment: 'center' }, { text: 'Close', style: 'th', alignment: 'center' }],
            ...bodyRows,
          ],
        },
        layout: {
          fillColor: (r) => (r === 0 ? BLUE : r % 2 === 0 ? '#f4f7fb' : null),
          hLineColor: '#c9d3e0', vLineColor: '#c9d3e0', hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        },
      },
    ],
  };
}

export function buildQuotePdf(quote, setting) {
  const printer = getPrinter();
  const cur = quote.currency || 'USD';
  const earlyBird = Number(quote.early_bird_discount || 0);
  const total = Number(quote.total || 0);
  const contractAmount = total - earlyBird;
  const lifeguards = Number(quote.lifeguard_count || 0);
  const hoursPer = Number(quote.hours_per_week || 0);
  const totalStaffHours = lifeguards * hoursPer;

  const facilityAddr = [quote.facility_name, quote.facility_address].filter(Boolean).join('\n');
  const ownerAddr = [quote.Customer?.name, quote.Customer?.address].filter(Boolean).join('\n');
  const proposalNo = quote.quote_no || '-';

  // --- SECTION III. Additional Comments ---
  const notes = (quote.special_notes || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const commentLines = notes.length
    ? notes.map((n) => ({ text: [{ text: `${n.label ? n.label + '. ' : ''}`, bold: true }, { text: n.body || '' }], fontSize: 8, margin: [0, 0, 0, 2] }))
    : [{ text: 'None.', fontSize: 8, italics: true, color: '#666' }];

  // --- SECTION IV. Compensation Schedule ---
  const insts = (quote.installments || []);
  const half = Math.ceil(insts.length / 2);
  const dueRow = (inst) => ({
    columns: [
      { text: `Due: ${inst.due_date ? dateEN(inst.due_date) : (inst.label || '-')}`, fontSize: 8 },
      { text: money(inst.amount, cur), fontSize: 8, alignment: 'right', width: 80 },
    ],
    margin: [0, 0, 0, 1],
  });

  // --- Genel Hükümler (SECTION VI–XIX) ---
  const bodyLines = (quote.template?.body || '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length);
  const generalTerms = bodyLines.map((line) => {
    if (/^SECTION\s+[IVXLC]+\./i.test(line) || /^SECTION\b/i.test(line)) {
      return { text: line, bold: true, fontSize: 9, color: BLUE, margin: [0, 6, 0, 3] };
    }
    return { text: line, fontSize: 8, color: '#333', margin: [0, 0, 0, 3], alignment: 'justify' };
  });

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [42, 46, 42, 54],
    defaultStyle: { font: 'Roboto', fontSize: 9, lineHeight: 1.1 },
    footer: (currentPage, pageCount) => ({
      margin: [42, 8, 42, 0],
      columns: [
        { text: currentPage > 1 ? 'Owner’s Initial(s) __________' : '', fontSize: 7, color: '#666', width: '*' },
        { text: setting.rev_label || 'Rev 06/2025', fontSize: 7, color: '#666', alignment: 'center', width: 'auto' },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#666', alignment: 'right', width: '*' },
      ],
    }),
    content: [
      // ===================== PAGE 1: COVER =====================
      { text: setting.company_tagline || '', italics: true, alignment: 'center', fontSize: 10, color: '#555', margin: [0, 60, 0, 30] },
      { text: 'COMMERCIAL SWIMMING POOL', bold: true, alignment: 'center', fontSize: 22, color: BLUE, characterSpacing: 1 },
      { text: 'MANAGEMENT AGREEMENT', bold: true, alignment: 'center', fontSize: 22, color: BLUE, characterSpacing: 1, margin: [0, 0, 0, 24] },
      { text: `PROPOSAL #${proposalNo}`, alignment: 'center', bold: true, fontSize: 13, margin: [0, 0, 0, 20] },
      { text: quote.facility_name || '', alignment: 'center', bold: true, fontSize: 13 },
      { text: quote.facility_address || '', alignment: 'center', fontSize: 10, color: '#444', margin: [0, 2, 0, 0] },
      // Firma künyesi (alt)
      { text: (setting.company_name || '').toUpperCase(), alignment: 'center', bold: true, fontSize: 12, color: BLUE, characterSpacing: 2, margin: [0, 150, 0, 4] },
      { text: setting.company_address || '', alignment: 'center', fontSize: 8, color: '#555' },
      {
        text: [
          setting.company_phone ? `Tel: ${setting.company_phone}` : '',
          setting.company_fax ? `Fax: ${setting.company_fax}` : '',
          setting.company_email || '',
        ].filter(Boolean).join('  •  '),
        alignment: 'center', fontSize: 8, color: '#555', margin: [0, 2, 0, 0],
      },
      { text: (setting.company_website || '').toUpperCase(), alignment: 'center', fontSize: 8, color: BLUE, characterSpacing: 1, margin: [0, 2, 0, 0] },

      // ===================== PAGE 2: SPECIFICATION =====================
      { text: '', pageBreak: 'before' },
      { text: (setting.company_name || '').toUpperCase(), bold: true, fontSize: 11, color: BLUE, alignment: 'center' },
      { text: setting.company_address || '', fontSize: 8, color: '#555', alignment: 'center' },
      { text: 'SWIMMING POOL MANAGEMENT AGREEMENT', bold: true, fontSize: 11, alignment: 'center', margin: [0, 6, 0, 0] },
      { text: `Proposal # ${proposalNo}`, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 1, lineColor: BLUE }], margin: [0, 0, 0, 8] },

      // SECTION I
      { text: 'SECTION I. PROPERTY INFORMATION', bold: true, fontSize: 9, color: BLUE, margin: [0, 0, 0, 4] },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [{ text: 'Facility Name and Address', bold: true, fontSize: 8, fillColor: '#f0f3f8' }, { text: 'Facility Owner/Agent', bold: true, fontSize: 8, fillColor: '#f0f3f8' }],
            [{ text: facilityAddr || '-', fontSize: 8 }, { text: ownerAddr || '-', fontSize: 8 }],
          ],
        },
        layout: { hLineColor: '#c9d3e0', vLineColor: '#c9d3e0', hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
        margin: [0, 0, 0, 8],
      },

      // SECTION II
      { text: 'SECTION II. CONTRACT DURATION, OPERATING SCHEDULE AND PERSONNEL', bold: true, fontSize: 9, color: BLUE, margin: [0, 0, 0, 4] },
      { text: `The CONTRACTOR will maintain the aforementioned swimming pool between ${dateEN(quote.season_start)} and ${dateEN(quote.season_end)}.`, fontSize: 8, margin: [0, 0, 0, 6] },
      {
        columns: [
          scheduleColumn(quote.schedules, 'normal', 'Normal / Season Hours of Operation'),
          scheduleColumn(quote.schedules, 'okul', 'School / Off Season Hours of Operation', 'Note: Operating hours while public schools are in session.'),
        ],
        columnGap: 16,
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ['*', 'auto', '*', 'auto'],
          body: [
            [
              { text: 'Number of Lifeguards:', bold: true, fontSize: 8 }, { text: `${lifeguards} Lifeguard(s)`, fontSize: 8 },
              { text: 'Total Staff Hours:', bold: true, fontSize: 8 }, { text: `${totalStaffHours} Hrs/week`, fontSize: 8 },
            ],
            [
              { text: 'Hours per Lifeguard:', bold: true, fontSize: 8 }, { text: `${hoursPer} Hrs/week`, fontSize: 8 },
              { text: '', fontSize: 8 }, { text: '', fontSize: 8 },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 8],
      },

      // SECTION III
      { text: 'SECTION III. ADDITIONAL COMMENTS', bold: true, fontSize: 9, color: BLUE, margin: [0, 0, 0, 4] },
      ...commentLines,

      // SECTION IV
      { text: 'SECTION IV. COMPENSATION SCHEDULE', bold: true, fontSize: 9, color: BLUE, margin: [0, 8, 0, 4] },
      { text: 'Payment from the OWNER is to be received by the CONTRACTOR by the dates listed below.', fontSize: 8, margin: [0, 0, 0, 4] },
      {
        columns: [
          { text: [{ text: 'Total Contract Price: ', bold: true }, { text: money(total, cur) }], fontSize: 9, width: '*' },
          earlyBird > 0
            ? { text: [{ text: '“Early Bird Discount” Price: ', bold: true }, { text: money(contractAmount, cur) }], fontSize: 9, alignment: 'right', width: '*' }
            : { text: '', width: '*' },
        ],
        margin: [0, 0, 0, 2],
      },
      earlyBird > 0
        ? { text: 'Note: In order for the “Early Bird Discount” to be honored the executed contract must be received by the CONTRACTOR by the stated deadline. If applicable, the discount will be applied to the last installment payment.', fontSize: 7, italics: true, color: '#666', margin: [0, 0, 0, 6] }
        : { text: '', margin: [0, 0, 0, 2] },
      insts.length
        ? {
            columns: [
              { width: '*', stack: insts.slice(0, half).map(dueRow) },
              { width: '*', stack: insts.slice(half).map(dueRow) },
            ],
            columnGap: 24,
            margin: [0, 0, 0, 8],
          }
        : { text: 'No payment schedule defined.', fontSize: 8, italics: true, color: '#666', margin: [0, 0, 0, 8] },

      // SECTION V
      { text: 'SECTION V. ACCEPTANCE OF PROPOSAL', bold: true, fontSize: 9, color: BLUE, margin: [0, 0, 0, 4] },
      { text: 'This Contract consists of six (6) pages and nineteen (19) sections.', fontSize: 8, margin: [0, 0, 0, 8] },
      {
        columns: [
          { width: '*', stack: [
            { text: 'CONTRACTOR', bold: true, fontSize: 8 },
            { text: 'Signature: _______________________________', fontSize: 8, margin: [0, 8, 0, 4] },
            { text: `By: ${setting.company_name || ''}`, fontSize: 8 },
            { text: 'Date: ______________', fontSize: 8, margin: [0, 4, 0, 0] },
          ] },
          { width: '*', stack: [
            { text: 'OWNER', bold: true, fontSize: 8 },
            { text: 'Signature: _______________________________', fontSize: 8, margin: [0, 8, 0, 4] },
            { text: 'By: _______________________', fontSize: 8 },
            { text: 'Date: ______________', fontSize: 8, margin: [0, 4, 0, 0] },
          ] },
        ],
        columnGap: 24,
      },
      { text: 'Please initial page(s) 2, 3, 4 and 5 of this contract where indicated.', fontSize: 7, italics: true, color: '#666', margin: [0, 8, 0, 0] },

      // ===================== PAGE 3+: GENERAL TERMS =====================
      ...(generalTerms.length ? [{ text: '', pageBreak: 'before' }, ...generalTerms] : []),
    ],
    styles: {
      th: { bold: true, color: 'white', fontSize: 8, margin: [0, 2, 0, 2] },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) { reject(e); }
  });
}
