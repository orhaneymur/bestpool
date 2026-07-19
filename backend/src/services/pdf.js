import PdfPrinter from 'pdfmake';

/**
 * Commercial Swimming Pool Management Agreement PDF
 * Dense, corporate layout modeled on Premier-style contracts:
 *   Page 1  : Cover (tight, modern brand block — no large empty bands)
 *   Page 2  : Specification (SECTION I–V) packed like the sample
 *   Page 3+ : General Terms from contract template
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

const NAVY = '#0b1f3a';
const BLUE = '#0d47a1';
const ACCENT = '#0284c7';
const LINE = '#cbd5e1';
const MUTED = '#64748b';
const INK = '#0f172a';

const DAY_EN = {
  pazartesi: 'Monday', sali: 'Tuesday', carsamba: 'Wednesday', persembe: 'Thursday',
  cuma: 'Friday', cumartesi: 'Saturday', pazar: 'Sunday', tatil: 'Holiday',
};
const DAY_ORDER = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar', 'tatil'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

const tightTable = {
  hLineColor: () => LINE,
  vLineColor: () => LINE,
  hLineWidth: () => 0.4,
  vLineWidth: () => 0.4,
  paddingLeft: () => 3,
  paddingRight: () => 3,
  paddingTop: () => 1.5,
  paddingBottom: () => 1.5,
};

function sectionBar(text) {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, bold: true, fontSize: 8, color: '#fff', fillColor: NAVY, margin: [4, 2, 4, 2] }]],
    },
    layout: 'noBorders',
    margin: [0, 5, 0, 2],
  };
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
      { text: DAY_EN[day], fontSize: 7, color: INK },
      { text: open, fontSize: 7, alignment: 'center', color: INK },
      { text: close, fontSize: 7, alignment: 'center', color: INK },
    ];
  });
  return {
    width: '*',
    stack: [
      { text: title, bold: true, fontSize: 7.5, color: NAVY, margin: [0, 0, 0, 0] },
      subtitle
        ? { text: subtitle, italics: true, fontSize: 6, color: MUTED, margin: [0, 0, 0, 1] }
        : { text: '', fontSize: 1, margin: [0, 0, 0, 1] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 48, 48],
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
          ...tightTable,
          fillColor: (r) => (r === 0 ? BLUE : r % 2 === 0 ? '#f1f5f9' : null),
        },
      },
    ],
  };
}

function personnelBlock(lifeguards, hoursPer, totalStaffHours) {
  return {
    width: '*',
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          { text: 'Number of Lifeguards:', bold: true, fontSize: 7, color: INK },
          { text: `${lifeguards} Lifeguard(s)`, fontSize: 7, alignment: 'right', color: INK },
        ],
        [
          { text: 'Hours per Lifeguard:', bold: true, fontSize: 7, color: INK },
          { text: `${hoursPer} Hrs/week`, fontSize: 7, alignment: 'right', color: INK },
        ],
        [
          { text: 'Total Staff Hours:', bold: true, fontSize: 7, color: INK },
          { text: `${totalStaffHours} Hrs/week`, fontSize: 7, alignment: 'right', color: INK },
        ],
      ],
    },
    layout: {
      ...tightTable,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 0.5,
      paddingBottom: () => 0.5,
    },
    margin: [0, 2, 0, 0],
  };
}

function lineItemsTable(items, cur) {
  const lines = (items || []).filter((it) => (it.description || '').trim());
  if (!lines.length) return null;

  const body = [
    [
      { text: 'Description', style: 'th' },
      { text: 'Qty', style: 'th', alignment: 'right' },
      { text: 'Unit', style: 'th', alignment: 'center' },
      { text: 'Unit Price', style: 'th', alignment: 'right' },
      { text: 'Amount', style: 'th', alignment: 'right' },
    ],
    ...lines.map((it) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unit_price || 0);
      const amount = it.line_total != null ? Number(it.line_total) : qty * price;
      return [
        { text: it.description || '', fontSize: 7, color: INK },
        { text: String(qty), fontSize: 7, alignment: 'right', color: INK },
        { text: it.unit || '', fontSize: 7, alignment: 'center', color: INK },
        { text: money(price, cur), fontSize: 7, alignment: 'right', color: INK },
        { text: money(amount, cur), fontSize: 7, alignment: 'right', color: INK },
      ];
    }),
  ];

  return {
    stack: [
      { text: 'Services Included', bold: true, fontSize: 7.5, color: NAVY, margin: [0, 0, 0, 1] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 32, 36, 52, 52],
          body,
        },
        layout: {
          ...tightTable,
          fillColor: (r) => (r === 0 ? BLUE : r % 2 === 0 ? '#f1f5f9' : null),
        },
        margin: [0, 0, 0, 2],
      },
    ],
  };
}

function spacedCompanyName(name) {
  return String(name || '')
    .toUpperCase()
    .split('')
    .join(' ');
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
          { text: `${n.label ? `${n.label}. ` : ''}`, bold: true, color: NAVY },
          { text: n.body || '', color: INK },
        ],
        fontSize: 7,
        margin: [0, 0, 0, 1],
      }))
    : [{ text: 'None.', fontSize: 7, italics: true, color: MUTED, margin: [0, 0, 0, 1] }];

  const insts = (quote.installments || []).slice().sort((a, b) => {
    if (a.due_date && b.due_date) return String(a.due_date).localeCompare(String(b.due_date));
    return 0;
  });
  const half = Math.ceil(insts.length / 2) || 0;
  const dueRow = (inst) => [
    {
      text: `Due: ${inst.due_date ? dateEN(inst.due_date) : inst.label || '-'}`,
      fontSize: 7,
      color: INK,
    },
    { text: money(inst.amount, cur), fontSize: 7, alignment: 'right', bold: true, color: INK },
  ];

  const servicesBlock = lineItemsTable(quote.items, cur);

  const bodyLines = (quote.template?.body || '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length);
  const generalTerms = bodyLines.map((line) => {
    if (/^SECTION\s+[IVXLC]+\./i.test(line) || /^SECTION\b/i.test(line)) {
      return { text: line, bold: true, fontSize: 8, color: NAVY, margin: [0, 4, 0, 1] };
    }
    return { text: line, fontSize: 7.5, color: '#334155', margin: [0, 0, 0, 1.5], alignment: 'justify' };
  });

  const earlyBirdDeadline = quote.valid_until ? dateEN(quote.valid_until) : 'the stated deadline';
  const contentWidth = 530;

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [36, 32, 36, 36],
    defaultStyle: { font: 'Roboto', fontSize: 8, color: INK, lineHeight: 1.05 },
    footer: (currentPage, pageCount) => ({
      margin: [36, 4, 36, 0],
      columns: [
        {
          text: currentPage > 1 ? 'Owner’s Initial(s) __________' : '',
          fontSize: 6.5,
          color: MUTED,
          width: '*',
        },
        {
          text: setting.rev_label || 'Rev 06/2025',
          fontSize: 6.5,
          color: MUTED,
          alignment: 'center',
          width: 'auto',
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 6.5,
          color: MUTED,
          alignment: 'right',
          width: '*',
        },
      ],
    }),
    content: [
      // ===================== PAGE 1: COVER (dense, modern) =====================
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: spacedCompanyName(company),
                    alignment: 'center',
                    bold: true,
                    fontSize: 9,
                    color: '#fff',
                    characterSpacing: 1.2,
                    margin: [0, 0, 0, 2],
                  },
                  {
                    text: `"${tagline}"`,
                    italics: true,
                    alignment: 'center',
                    fontSize: 8,
                    color: '#bae6fd',
                  },
                ],
                fillColor: NAVY,
                margin: [10, 10, 10, 10],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 14],
      },

      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 2, lineColor: ACCENT },
        ],
        margin: [0, 0, 0, 12],
      },

      {
        text: 'COMMERCIAL SWIMMING POOL',
        bold: true,
        alignment: 'center',
        fontSize: 18,
        color: NAVY,
        characterSpacing: 0.8,
      },
      {
        text: 'MANAGEMENT AGREEMENT',
        bold: true,
        alignment: 'center',
        fontSize: 18,
        color: NAVY,
        characterSpacing: 0.8,
        margin: [0, 0, 0, 10],
      },

      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: `PROPOSAL #${proposalNo}`,
                alignment: 'center',
                bold: true,
                fontSize: 12,
                color: '#fff',
                fillColor: BLUE,
                margin: [8, 5, 8, 5],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [80, 0, 80, 12],
      },

      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'FACILITY',
                    fontSize: 7,
                    bold: true,
                    color: ACCENT,
                    characterSpacing: 1,
                    alignment: 'center',
                    margin: [0, 0, 0, 3],
                  },
                  {
                    text: quote.facility_name || 'Facility Name',
                    alignment: 'center',
                    bold: true,
                    fontSize: 13,
                    color: NAVY,
                  },
                  {
                    text: quote.facility_address || '',
                    alignment: 'center',
                    fontSize: 9,
                    color: MUTED,
                    margin: [0, 2, 0, 0],
                  },
                ],
                fillColor: '#f8fafc',
                border: [true, true, true, true],
                margin: [12, 10, 12, 10],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
        },
        margin: [40, 0, 40, 14],
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CONTRACT SEASON', fontSize: 6.5, bold: true, color: MUTED, characterSpacing: 0.6 },
              {
                text: `${dateEN(quote.season_start)} – ${dateEN(quote.season_end)}`,
                fontSize: 9,
                bold: true,
                color: NAVY,
                margin: [0, 2, 0, 0],
              },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'CONTRACT VALUE', fontSize: 6.5, bold: true, color: MUTED, characterSpacing: 0.6, alignment: 'right' },
              {
                text: earlyBird > 0 ? money(contractAmount, cur) : money(total, cur),
                fontSize: 9,
                bold: true,
                color: NAVY,
                alignment: 'right',
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
        margin: [40, 0, 40, 16],
      },

      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.6, lineColor: LINE },
        ],
        margin: [0, 0, 0, 10],
      },

      {
        text: spacedCompanyName(company),
        alignment: 'center',
        bold: true,
        fontSize: 10,
        color: BLUE,
        characterSpacing: 1,
        margin: [0, 0, 0, 2],
      },
      {
        text: setting.company_address || '',
        alignment: 'center',
        fontSize: 7.5,
        color: MUTED,
      },
      {
        text: contactLine,
        alignment: 'center',
        fontSize: 7.5,
        color: MUTED,
        margin: [0, 1, 0, 0],
      },
      {
        text: (setting.company_website || '').toUpperCase(),
        alignment: 'center',
        fontSize: 7.5,
        color: BLUE,
        characterSpacing: 0.8,
        margin: [0, 1, 0, 0],
      },

      // ===================== PAGE 2: SPECIFICATION (packed) =====================
      { text: '', pageBreak: 'before' },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: company.toUpperCase(), bold: true, fontSize: 9, color: NAVY },
              { text: setting.company_address || '', fontSize: 6.5, color: MUTED },
            ],
          },
          {
            width: 'auto',
            stack: [
              { text: `Proposal # ${proposalNo}`, bold: true, fontSize: 8, color: BLUE, alignment: 'right' },
              { text: setting.rev_label || 'Rev 06/2025', fontSize: 6.5, color: MUTED, alignment: 'right' },
            ],
          },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        text: 'SWIMMING POOL MANAGEMENT AGREEMENT',
        bold: true,
        fontSize: 10,
        alignment: 'center',
        color: NAVY,
        margin: [0, 1, 0, 2],
      },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 1.5, lineColor: NAVY },
        ],
        margin: [0, 0, 0, 3],
      },

      sectionBar('SECTION I. PROPERTY INFORMATION'),
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'Facility Name and Address', bold: true, fontSize: 7, color: '#fff', fillColor: BLUE },
              { text: 'Facility Owner/Agent', bold: true, fontSize: 7, color: '#fff', fillColor: BLUE },
            ],
            [
              { text: facilityAddr || '-', fontSize: 7.5, color: INK },
              { text: ownerAddr || '-', fontSize: 7.5, color: INK },
            ],
          ],
        },
        layout: tightTable,
        margin: [0, 0, 0, 1],
      },

      sectionBar('SECTION II. CONTRACT DURATION, OPERATING SCHEDULE AND PERSONNEL'),
      {
        text: `The CONTRACTOR will maintain the aforementioned swimming pool between ${dateEN(quote.season_start)} and ${dateEN(quote.season_end)}.`,
        fontSize: 7.5,
        margin: [0, 0, 0, 2],
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
        columnGap: 10,
        margin: [0, 0, 0, 1],
      },
      {
        columns: [
          personnelBlock(lifeguards, hoursPer, totalStaffHours),
          personnelBlock(lifeguards, hoursPer, totalStaffHours),
        ],
        columnGap: 10,
        margin: [0, 0, 0, 1],
      },
      quote.notes
        ? {
            text: [
              { text: 'NOTE (school / off-season calendar): ', bold: true, color: NAVY },
              { text: quote.notes, color: INK },
            ],
            fontSize: 6.5,
            margin: [0, 1, 0, 1],
          }
        : {},

      sectionBar('SECTION III. ADDITIONAL COMMENTS'),
      ...commentLines,

      sectionBar('SECTION IV. COMPENSATION SCHEDULE'),
      {
        text: 'Payment from the OWNER is to be received by the CONTRACTOR by the dates listed below.',
        fontSize: 7,
        margin: [0, 0, 0, 2],
      },

      ...(servicesBlock ? [servicesBlock] : []),

      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'Subtotal (services)', fontSize: 7, color: MUTED },
                  { text: money(subtotal, cur), fontSize: 7, alignment: 'right', color: INK },
                ],
                ...(discountAmount > 0
                  ? [
                      [
                        { text: 'Discount', fontSize: 7, color: MUTED },
                        { text: `-${money(discountAmount, cur)}`, fontSize: 7, alignment: 'right', color: INK },
                      ],
                    ]
                  : []),
                ...(vatAmount > 0
                  ? [
                      [
                        { text: 'Tax', fontSize: 7, color: MUTED },
                        { text: money(vatAmount, cur), fontSize: 7, alignment: 'right', color: INK },
                      ],
                    ]
                  : []),
                [
                  { text: 'Total Contract Price:', bold: true, fontSize: 8, color: NAVY },
                  { text: money(total, cur), bold: true, fontSize: 8, alignment: 'right', color: NAVY },
                ],
                ...(earlyBird > 0
                  ? [
                      [
                        { text: '“Early Bird Discount” Price:', bold: true, fontSize: 8, color: ACCENT },
                        {
                          text: money(contractAmount, cur),
                          bold: true,
                          fontSize: 8,
                          alignment: 'right',
                          color: ACCENT,
                        },
                      ],
                    ]
                  : []),
              ],
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingTop: () => 0.5,
              paddingBottom: () => 0.5,
              paddingLeft: () => 0,
              paddingRight: () => 0,
            },
          },
          earlyBird > 0
            ? {
                width: '42%',
                text: `Note: In order for the “Early Bird Discount” to be honored the executed contract must be received by the CONTRACTOR no later than ${earlyBirdDeadline}. If applicable, the discount will be applied to the last Installment payment.`,
                fontSize: 6.5,
                italics: true,
                color: MUTED,
                margin: [8, 0, 0, 0],
              }
            : { width: '42%', text: '' },
        ],
        columnGap: 6,
        margin: [0, 0, 0, 2],
      },

      insts.length
        ? {
            columns: [
              {
                width: '*',
                table: {
                  widths: ['*', 56],
                  body: insts.slice(0, half).map(dueRow),
                },
                layout: {
                  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.4 : 0.2),
                  vLineWidth: () => 0,
                  hLineColor: () => LINE,
                  paddingTop: () => 1,
                  paddingBottom: () => 1,
                  paddingLeft: () => 0,
                  paddingRight: () => 2,
                },
              },
              {
                width: '*',
                table: {
                  widths: ['*', 56],
                  body: insts.slice(half).map(dueRow),
                },
                layout: {
                  hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.4 : 0.2),
                  vLineWidth: () => 0,
                  hLineColor: () => LINE,
                  paddingTop: () => 1,
                  paddingBottom: () => 1,
                  paddingLeft: () => 0,
                  paddingRight: () => 2,
                },
              },
            ],
            columnGap: 14,
            margin: [0, 0, 0, 2],
          }
        : {
            text: 'No payment schedule defined.',
            fontSize: 7,
            italics: true,
            color: MUTED,
            margin: [0, 0, 0, 2],
          },

      sectionBar('SECTION V. ACCEPTANCE OF PROPOSAL'),
      {
        text: generalTerms.length
          ? 'This Contract consists of the Specification page (Sections I–V) and the General Terms (Sections VI–XIX).'
          : 'This Contract consists of the Specification page (Sections I–V).',
        fontSize: 7,
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CONTRACTOR', bold: true, fontSize: 7.5, color: NAVY },
              { text: 'Signature: _______________________________', fontSize: 7, margin: [0, 6, 0, 2] },
              { text: `By: ${company}`, fontSize: 7 },
              { text: 'Date: ______________', fontSize: 7, margin: [0, 2, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'OWNER', bold: true, fontSize: 7.5, color: NAVY },
              { text: 'Signature: _______________________________', fontSize: 7, margin: [0, 6, 0, 2] },
              { text: 'By: _______________________', fontSize: 7 },
              { text: 'Date: ______________', fontSize: 7, margin: [0, 2, 0, 0] },
            ],
          },
        ],
        columnGap: 16,
      },
      {
        text: 'Please initial page(s) 2, 3, 4 and 5 of this contract where indicated.',
        fontSize: 6.5,
        italics: true,
        color: MUTED,
        margin: [0, 4, 0, 0],
      },

      ...(generalTerms.length ? [{ text: '', pageBreak: 'before' }, ...generalTerms] : []),
    ],
    styles: {
      th: { bold: true, color: 'white', fontSize: 7, margin: [0, 1, 0, 1] },
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
