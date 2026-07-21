import PdfPrinter from 'pdfmake';

/**
 * Commercial Swimming Pool Management Agreement PDF
 * Clean classic layout matching the Premier sample style:
 *   Page 1  : Cover — tagline, title, proposal #, facility, company footer
 *   Page 2  : Spec sheet Sections I–V (dense, no decorative bars)
 *   Page 3+ : Terms and Conditions from template
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function getPrinter() {
  const vfs = require('pdfmake/build/vfs_fonts.js');
  const vfsData = vfs?.pdfMake?.vfs || vfs?.vfs || vfs?.default?.pdfMake?.vfs || vfs;
  if (!vfsData || !vfsData['Roboto-Regular.ttf']) {
    throw new Error('pdfmake fonts (vfs_fonts) could not be loaded. Ensure pdfmake is installed.');
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
const INK = '#222222';
const GRAY = '#555555';
const LINE = '#b0bec5';

const DAY_EN = {
  pazartesi: 'Monday', sali: 'Tuesday', carsamba: 'Wednesday', persembe: 'Thursday',
  cuma: 'Friday', cumartesi: 'Saturday', pazar: 'Sunday', tatil: 'Holiday',
};
const DAY_ORDER = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar', 'tatil'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const sym = (cur) => (cur === 'TRY' ? '₺' : cur === 'EUR' ? '€' : '$');
const money = (n, cur) =>
  sym(cur) +
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function dateEN(d) {
  if (!d) return '____________';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '____________';
  return `${MONTHS_EN[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function to12h(t) {
  if (!t) return '';
  const [hh, mm] = String(t).split(':').map(Number);
  if (Number.isNaN(hh)) return t;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${String(h12).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')} ${ampm}`;
}

function sectionTitle(text) {
  return { text, bold: true, fontSize: 9, color: BLUE, margin: [0, 6, 0, 2] };
}

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
      subtitle
        ? { text: subtitle, italics: true, fontSize: 6.5, color: GRAY, margin: [0, 0, 0, 2] }
        : { text: ' ', fontSize: 6.5, margin: [0, 0, 0, 2] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 50, 50],
          body: [
            [
              { text: '', style: 'th' },
              { text: 'Open', style: 'th', alignment: 'center' },
              { text: 'Close', style: 'th', alignment: 'center' },
            ],
            ...bodyRows,
          ],
        },
        layout: {
          fillColor: (i) => (i === 0 ? BLUE : i % 2 === 0 ? '#f5f7fa' : null),
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    ],
  };
}

function personnelRows(lifeguards, hoursPer, totalStaffHours) {
  return {
    width: '*',
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'Number of Lifeguards:', bold: true, fontSize: 8 },
          { text: `${lifeguards} Lifeguard(s)`, fontSize: 8, alignment: 'right' },
        ],
        [
          { text: 'Hours per Lifeguard:', bold: true, fontSize: 8 },
          { text: `${hoursPer} Hrs/week`, fontSize: 8, alignment: 'right' },
        ],
        [
          { text: 'Total Staff Hours:', bold: true, fontSize: 8 },
          { text: `${totalStaffHours} Hrs/week`, fontSize: 8, alignment: 'right' },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 3, 0, 0],
  };
}

export function buildQuotePdf(quote, setting) {
  const printer = getPrinter();
  const cur = quote.currency || 'USD';
  const earlyBird = Number(quote.early_bird_discount || 0);
  const total = Number(quote.total || 0);
  const subtotal = Number(quote.subtotal || 0);
  const discountAmount = Number(quote.discount_amount || 0);
  const vatAmount = Number(quote.vat_amount || 0);
  const contractAmount = Math.max(0, total - earlyBird);
  const lifeguards = Number(quote.lifeguard_count || 0);
  const hoursPer = Number(quote.hours_per_week || 0);
  const totalStaffHours = lifeguards * hoursPer;

  const facilityAddr = [quote.facility_name, quote.facility_address].filter(Boolean).join('\n');
  const ownerAddr = [
    quote.Customer?.name,
    quote.Customer?.address || [quote.Customer?.city].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  const proposalNo = quote.quote_no || '-';
  const tagline = setting.company_tagline || 'Where Customer Service is a Policy, Not a Department';
  const company = setting.company_name || 'Four Seasons Pool Management';
  const contactLine = [
    setting.company_phone ? `Tel: ${setting.company_phone}` : '',
    setting.company_fax ? `Fax: ${setting.company_fax}` : '',
    setting.company_email || 'orhaneymur@gmail.com',
  ]
    .filter(Boolean)
    .join('  •  ');

  const notes = (quote.special_notes || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const commentLines = notes.length
    ? notes.map((n) => ({
        text: [
          { text: `${n.label ? `${n.label}. ` : ''}`, bold: true },
          { text: n.body || '' },
        ],
        fontSize: 8,
        margin: [0, 0, 0, 1],
      }))
    : [{ text: 'None.', fontSize: 8, italics: true, color: GRAY }];

  const items = (quote.items || []).filter((it) => (it.description || '').trim());
  const itemTable = items.length
    ? {
        table: {
          headerRows: 1,
          widths: ['*', 34, 38, 54, 54],
          body: [
            [
              { text: 'Description', style: 'th' },
              { text: 'Qty', style: 'th', alignment: 'right' },
              { text: 'Unit', style: 'th', alignment: 'center' },
              { text: 'Unit Price', style: 'th', alignment: 'right' },
              { text: 'Amount', style: 'th', alignment: 'right' },
            ],
            ...items.map((it) => {
              const qty = Number(it.quantity || 0);
              const price = Number(it.unit_price || 0);
              const amount = it.line_total != null ? Number(it.line_total) : qty * price;
              return [
                { text: it.description || '', fontSize: 8 },
                { text: String(qty), fontSize: 8, alignment: 'right' },
                { text: it.unit || '', fontSize: 8, alignment: 'center' },
                { text: money(price, cur), fontSize: 8, alignment: 'right' },
                { text: money(amount, cur), fontSize: 8, alignment: 'right' },
              ];
            }),
          ],
        },
        layout: {
          fillColor: (i) => (i === 0 ? BLUE : i % 2 === 0 ? '#f5f7fa' : null),
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 4],
      }
    : null;

  const insts = (quote.installments || []).slice().sort((a, b) => {
    if (a.due_date && b.due_date) return String(a.due_date).localeCompare(String(b.due_date));
    return 0;
  });
  const half = Math.ceil(insts.length / 2) || 0;
  const dueStack = (list) =>
    list.map((inst) => ({
      columns: [
        {
          text: `Due: ${inst.due_date ? dateEN(inst.due_date) : inst.label || '-'}`,
          fontSize: 8,
        },
        { text: money(inst.amount, cur), fontSize: 8, alignment: 'right', width: 70 },
      ],
      margin: [0, 0, 0, 1],
    }));

  const bodyLines = (quote.template?.body || '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length);
  const generalTerms = bodyLines.map((line) => {
    if (/^SECTION\s+[IVXLC]+\./i.test(line) || /^SECTION\b/i.test(line)) {
      return { text: line, bold: true, fontSize: 9, color: BLUE, margin: [0, 5, 0, 2] };
    }
    return { text: line, fontSize: 8, color: INK, margin: [0, 0, 0, 2], alignment: 'justify' };
  });

  const earlyBirdDeadline = quote.valid_until ? dateEN(quote.valid_until) : 'the stated deadline';

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 40, 40, 42],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK, lineHeight: 1.12 },
    footer: (currentPage, pageCount) => ({
      margin: [40, 6, 40, 0],
      columns: [
        {
          text: currentPage > 1 ? 'Owner’s Initial(s) __________' : '',
          fontSize: 7,
          color: GRAY,
          width: '*',
        },
        {
          text: setting.rev_label || 'Rev 06/2025',
          fontSize: 7,
          color: GRAY,
          alignment: 'center',
          width: 'auto',
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: GRAY,
          alignment: 'right',
          width: '*',
        },
      ],
    }),
    content: [
      // ========== COVER (classic Premier style) ==========
      {
        text: `"${tagline}"`,
        italics: true,
        alignment: 'center',
        fontSize: 11,
        color: GRAY,
        margin: [0, 36, 0, 22],
      },
      {
        text: 'COMMERCIAL SWIMMING POOL',
        bold: true,
        alignment: 'center',
        fontSize: 20,
        color: BLUE,
      },
      {
        text: 'MANAGEMENT AGREEMENT',
        bold: true,
        alignment: 'center',
        fontSize: 20,
        color: BLUE,
        margin: [0, 0, 0, 18],
      },
      {
        text: `PROPOSAL #${proposalNo}`,
        bold: true,
        alignment: 'center',
        fontSize: 13,
        margin: [0, 0, 0, 16],
      },
      {
        text: quote.facility_name || '',
        bold: true,
        alignment: 'center',
        fontSize: 13,
      },
      {
        text: quote.facility_address || '',
        alignment: 'center',
        fontSize: 10,
        color: GRAY,
        margin: [0, 3, 0, 0],
      },

      // Modest gap — not a huge empty band
      { text: ' ', margin: [0, 48, 0, 0] },

      {
        text: company.toUpperCase(),
        bold: true,
        alignment: 'center',
        fontSize: 12,
        color: BLUE,
        characterSpacing: 1.5,
        margin: [0, 0, 0, 3],
      },
      {
        text: setting.company_address || '',
        alignment: 'center',
        fontSize: 8,
        color: GRAY,
      },
      {
        text: contactLine,
        alignment: 'center',
        fontSize: 8,
        color: GRAY,
        margin: [0, 2, 0, 0],
      },
      {
        text: (setting.company_website || '').toUpperCase(),
        alignment: 'center',
        fontSize: 8,
        color: BLUE,
        characterSpacing: 1,
        margin: [0, 2, 0, 0],
      },

      // ========== SPEC SHEET ==========
      { text: '', pageBreak: 'before' },

      {
        text: company.toUpperCase(),
        bold: true,
        fontSize: 11,
        color: BLUE,
        alignment: 'center',
      },
      {
        text: setting.company_address || '',
        fontSize: 8,
        color: GRAY,
        alignment: 'center',
      },
      {
        text: 'SWIMMING POOL MANAGEMENT AGREEMENT',
        bold: true,
        fontSize: 11,
        alignment: 'center',
        margin: [0, 5, 0, 0],
      },
      {
        text: `Proposal # ${proposalNo}`,
        fontSize: 9,
        alignment: 'center',
        margin: [0, 1, 0, 5],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 532, y2: 0, lineWidth: 1, lineColor: BLUE }],
        margin: [0, 0, 0, 5],
      },

      // SECTION I
      sectionTitle('SECTION I. PROPERTY INFORMATION'),
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'Facility Name and Address', bold: true, fontSize: 8, fillColor: '#eef2f7' },
              { text: 'Facility Owner/Agent', bold: true, fontSize: 8, fillColor: '#eef2f7' },
            ],
            [
              { text: facilityAddr || '-', fontSize: 8 },
              { text: ownerAddr || '-', fontSize: 8 },
            ],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 2],
      },

      // SECTION II
      sectionTitle('SECTION II. CONTRACT DURATION, OPERATING SCHEDULE AND PERSONNEL'),
      {
        text: `The CONTRACTOR will maintain the aforementioned swimming pool between ${dateEN(quote.season_start)} and ${dateEN(quote.season_end)}.`,
        fontSize: 8,
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          scheduleColumn(quote.schedules, 'normal', 'Normal / Season Hours of Operation'),
          scheduleColumn(
            quote.schedules,
            'okul',
            'School / Off Season Hours of Operation',
            'Note: Operating hours while county public schools are in session.'
          ),
        ],
        columnGap: 14,
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          personnelRows(lifeguards, hoursPer, totalStaffHours),
          personnelRows(lifeguards, hoursPer, totalStaffHours),
        ],
        columnGap: 14,
        margin: [0, 0, 0, 2],
      },
      quote.notes
        ? {
            text: [
              { text: 'NOTE (school / off-season calendar): ', bold: true },
              { text: quote.notes },
            ],
            fontSize: 7,
            color: GRAY,
            margin: [0, 1, 0, 2],
          }
        : {},

      // SECTION III
      sectionTitle('SECTION III. ADDITIONAL COMMENTS'),
      ...commentLines,

      // SECTION IV
      sectionTitle('SECTION IV. COMPENSATION SCHEDULE'),
      {
        text: 'Payment from the OWNER is to be received by the CONTRACTOR by the dates listed below.',
        fontSize: 8,
        margin: [0, 0, 0, 3],
      },

      ...(itemTable
        ? [
            { text: 'Services Included', bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
            itemTable,
          ]
        : []),

      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: 'Total Contract Price: ', bold: true },
                  { text: money(total, cur) },
                ],
                fontSize: 9,
                margin: [0, 0, 0, 1],
              },
              ...(earlyBird > 0
                ? [
                    {
                      text: [
                        { text: '“Early Bird Discount” Price: ', bold: true },
                        { text: money(contractAmount, cur) },
                      ],
                      fontSize: 9,
                      margin: [0, 0, 0, 1],
                    },
                  ]
                : []),
              ...(discountAmount > 0 || vatAmount > 0 || (items.length && subtotal)
                ? [
                    {
                      text: [
                        discountAmount > 0 ? `Discount: -${money(discountAmount, cur)}  ` : '',
                        vatAmount > 0 ? `Tax: ${money(vatAmount, cur)}` : '',
                      ]
                        .filter(Boolean)
                        .join(''),
                      fontSize: 7,
                      color: GRAY,
                      margin: [0, 0, 0, 1],
                    },
                  ]
                : []),
            ],
          },
          earlyBird > 0
            ? {
                width: '48%',
                text: `Note: In order for the “Early Bird Discount” to be honored the executed contract must be received by the CONTRACTOR no later than ${earlyBirdDeadline}. If applicable, the discount will be applied to the last Installment payment.`,
                fontSize: 7,
                italics: true,
                color: GRAY,
              }
            : { width: '48%', text: '' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 4],
      },

      insts.length
        ? {
            columns: [
              { width: '*', stack: dueStack(insts.slice(0, half)) },
              { width: '*', stack: dueStack(insts.slice(half)) },
            ],
            columnGap: 20,
            margin: [0, 0, 0, 4],
          }
        : {
            text: 'No payment schedule defined.',
            fontSize: 8,
            italics: true,
            color: GRAY,
            margin: [0, 0, 0, 4],
          },

      // SECTION V
      sectionTitle('SECTION V. ACCEPTANCE OF PROPOSAL'),
      {
        text: generalTerms.length
          ? 'This Contract consists of the Specification page (Sections I–V) and the attached Terms and Conditions.'
          : 'This Contract consists of the Specification page (Sections I–V).',
        fontSize: 8,
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CONTRACTOR', bold: true, fontSize: 8 },
              { text: 'Signature: _______________________________', fontSize: 8, margin: [0, 8, 0, 3] },
              { text: `By: ${company}`, fontSize: 8 },
              { text: 'Date: ______________', fontSize: 8, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'OWNER', bold: true, fontSize: 8 },
              { text: 'Signature: _______________________________', fontSize: 8, margin: [0, 8, 0, 3] },
              { text: 'By: _______________________', fontSize: 8 },
              { text: 'Date: ______________', fontSize: 8, margin: [0, 3, 0, 0] },
            ],
          },
        ],
        columnGap: 20,
      },
      {
        text: 'Please initial page(s) 2, 3, 4 and 5 of this contract where indicated.',
        fontSize: 7,
        italics: true,
        color: GRAY,
        margin: [0, 6, 0, 0],
      },

      ...(generalTerms.length ? [{ text: '', pageBreak: 'before' }, ...generalTerms] : []),
    ],
    styles: {
      th: { bold: true, color: 'white', fontSize: 8, margin: [0, 1, 0, 1] },
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
    } catch (e) {
      reject(e);
    }
  });
}
