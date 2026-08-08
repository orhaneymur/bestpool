import PdfPrinter from 'pdfmake';
import { mergeDefinitions, sanitizeHiddenFields } from '../config/pdfDefinitions.js';

/**
 * Commercial Swimming Pool Management Agreement PDF.
 *
 * Editorial layout — oversized section numerals, hairline rules, no filled bands:
 *   Page 1  : Cover — tagline, title, contract no, facility, company block
 *   Page 2  : Specification sheet, sections numbered 1..n
 *   Page 3+ : Terms and Conditions from the selected template
 *
 * Everything visible here is driven by `settings.definitions` (company-wide) and
 * `quote.hidden_fields` (this contract only). Section numbers are Arabic and are
 * assigned at render time, so hiding section 3 renumbers 4 and 5 rather than
 * leaving a gap.
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

export const DEFAULT_TAGLINE = 'Safety Is Our Standard, Service Is Our Promise';

const PAGE_WIDTH = { LETTER: 612, A4: 595.28 };

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

const ROMAN_MAP = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** "XIV" -> 14. Returns null for anything that is not a clean Roman numeral. */
function romanToInt(s) {
  const str = String(s || '').toUpperCase();
  if (!str || !/^[IVXLCDM]+$/.test(str)) return null;
  let total = 0;
  for (let i = 0; i < str.length; i += 1) {
    const cur = ROMAN_MAP[str[i]];
    const next = ROMAN_MAP[str[i + 1]];
    total += next && next > cur ? -cur : cur;
  }
  return total > 0 ? total : null;
}

function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}

/**
 * Builds every style helper bound to the resolved definitions, so a colour or
 * density change flows through the whole document from one place.
 */
function makeTheme(def) {
  const size = PAGE_WIDTH[def.page.size] ? def.page.size : 'LETTER';
  const margin = def.page.margin;
  const contentW = PAGE_WIDTH[size] - margin * 2;
  const tight = def.page.density === 'compact';
  const fs = (n) => Math.round(n * def.page.fontScale * 100) / 100;
  const pad = tight ? 1.0 : 2.6;
  const gap = (n) => (tight ? n : Math.round(n * 1.6));

  const { primary, rule: ruleColor } = def.theme;

  const rule = (width = contentW, color = ruleColor, lineWidth = 0.4, marginArr = [0, 0, 0, 0]) => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth, lineColor: color }],
    margin: marginArr,
  });

  const centeredRule = (width = 170, marginArr = [0, 0, 0, 0]) => {
    const inset = (contentW - width) / 2;
    return {
      canvas: [{ type: 'line', x1: inset, y1: 0, x2: inset + width, y2: 0, lineWidth: 0.6, lineColor: ruleColor }],
      margin: marginArr,
    };
  };

  /** Oversized soft numeral + letterspaced title + hairline. */
  const sectionHead = (no, title, topMargin = gap(5)) => ({
    unbreakable: true,
    margin: [0, topMargin, 0, 3],
    stack: [
      {
        columns: [
          { width: 24, text: String(no), fontSize: fs(15), bold: true, color: def.theme.numeral, margin: [0, -2, 0, 0] },
          {
            width: '*',
            text: String(title).toUpperCase(),
            fontSize: fs(9),
            bold: true,
            color: primary,
            characterSpacing: 1.2,
            margin: [0, 3, 0, 0],
          },
        ],
        columnGap: 0,
      },
      rule(contentW, primary, 0.7, [0, 1, 0, 0]),
    ],
  });

  /** Rules only — no vertical borders, no zebra fills. */
  const hairline = () => ({
    hLineWidth: (i, node) => {
      if (i === 0) return 0;
      if (i === 1) return 0.7;
      return i === node.table.body.length ? 0.7 : 0.35;
    },
    vLineWidth: () => 0,
    hLineColor: (i, node) => (i === 1 || i === node.table.body.length ? primary : ruleColor),
    paddingLeft: (i) => (i === 0 ? 0 : 5),
    paddingRight: () => 5,
    paddingTop: () => pad,
    paddingBottom: () => pad,
  });

  const sigLine = (label, width = Math.floor((contentW - 24) / 2) - 16) => ({
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, lineColor: def.theme.ink }] },
      { text: label, fontSize: fs(6.8), color: def.theme.muted, characterSpacing: 0.6, margin: [0, 2, 0, gap(4)] },
    ],
  });

  // Spread the palette first: `theme.rule` is a colour string and would otherwise
  // shadow the `rule()` helper, which is exposed as `ruleColor` instead.
  return {
    ...def.theme,
    ruleColor,
    size,
    margin,
    contentW,
    fs,
    gap,
    pad,
    rule,
    centeredRule,
    sectionHead,
    hairline,
    sigLine,
  };
}

function scheduleColumn(T, schedules, seasonType, title, subtitle) {
  const rows = (schedules || [])
    .filter((s) => s.season_type === seasonType)
    .sort((a, b) => DAY_ORDER.indexOf(a.day_label) - DAY_ORDER.indexOf(b.day_label));

  const bodyRows = DAY_ORDER.map((day) => {
    const r = rows.find((x) => x.day_label === day);
    const open = r ? (r.is_closed ? 'Closed' : to12h(r.open_time) || '-') : '-';
    const close = r ? (r.is_closed ? '—' : to12h(r.close_time) || '-') : '-';
    return [
      { text: DAY_EN[day], fontSize: T.fs(7.5), color: T.ink },
      { text: open, fontSize: T.fs(7.5), alignment: 'center', color: T.muted },
      { text: close, fontSize: T.fs(7.5), alignment: 'center', color: T.muted },
    ];
  });

  return {
    width: '*',
    stack: [
      { text: title, bold: true, fontSize: T.fs(8), color: T.ink, characterSpacing: 0.4, margin: [0, 0, 0, 1] },
      subtitle
        ? { text: subtitle, italics: true, fontSize: T.fs(6.5), color: T.muted, margin: [0, 0, 0, 2] }
        : { text: ' ', fontSize: T.fs(6.5), margin: [0, 0, 0, 2] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 50, 50],
          body: [
            [
              { text: '', style: 'th' },
              { text: 'OPEN', style: 'th', alignment: 'center' },
              { text: 'CLOSE', style: 'th', alignment: 'center' },
            ],
            ...bodyRows,
          ],
        },
        layout: T.hairline(),
      },
    ],
  };
}

/** Spec: daily, weekly, and seasonal staffing hours */
function personnelRows(T, lifeguards, hoursPer, totalStaffHours, peakWeeks) {
  const daily = Math.round((Number(hoursPer) / 7) * 10) / 10;
  const weekly = Number(totalStaffHours) || 0;
  const seasonal = Math.round(weekly * Number(peakWeeks || 0) * 10) / 10;
  const row = (label, value) => [
    { text: label, fontSize: T.fs(7.5), color: T.muted },
    { text: value, fontSize: T.fs(7.5), bold: true, color: T.ink, alignment: 'right' },
  ];
  return {
    width: '*',
    table: {
      widths: ['*', 'auto'],
      body: [
        row('Number of Lifeguards', `${lifeguards} Lifeguard(s)`),
        row('Daily Staffing Hours (per guard)', `${daily} Hrs/day`),
        row('Weekly Staffing Hours', `${weekly} Hrs/week`),
        row('Seasonal Staffing Hours', `${seasonal} Hrs/season`),
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 0 ? 0 : 0.35),
      vLineWidth: () => 0,
      hLineColor: () => T.ruleColor,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => T.pad,
      paddingBottom: () => T.pad,
    },
    margin: [0, 3, 0, 0],
  };
}

/**
 * Replaces the generic defined term with the company's actual name.
 * Preserves the original casing pattern: "CONTRACTOR" -> "FOUR SEASONS…",
 * "Contractor" -> "Four Seasons…". A preceding "the " is swallowed so the text
 * reads "Four Seasons Pool Management shall…" and not "the Four Seasons…".
 */
function applyContractorLabel(text, label) {
  if (!text || !label) return text;
  return String(text).replace(/\b(the\s+)?(CONTRACTOR|Contractor)\b/g, (_m, _the, word) =>
    word === 'CONTRACTOR' ? label.toUpperCase() : label
  );
}

/**
 * Turns the stored template body into styled blocks.
 * "SECTION XIV" plus the title on the following line collapse into one editorial
 * heading numbered 14, so templates written with Roman numerals still print Arabic.
 */
function renderTemplateBody(T, body) {
  const lines = String(body || '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length);

  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // A leading all-caps line ("TERMS AND CONDITIONS") is the document title.
    if (i === 0 && line.length <= 60 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      out.push({
        text: line,
        bold: true,
        fontSize: T.fs(12),
        color: T.primary,
        characterSpacing: 1.6,
        alignment: 'center',
        margin: [0, 0, 0, 4],
      });
      out.push(T.rule(T.contentW, T.primary, 0.7, [0, 0, 0, 8]));
      continue;
    }

    const heading = line.match(/^SECTION\s+([IVXLCDM]+|\d+)\.?\s*(.*)$/i);
    if (heading) {
      const raw = heading[1];
      const num = /^\d+$/.test(raw) ? Number(raw) : romanToInt(raw);
      let title = (heading[2] || '').replace(/^[.\-–—\s]+/, '').trim();
      if (!title && lines[i + 1] && !/^SECTION\s+/i.test(lines[i + 1])) {
        title = lines[i + 1].trim();
        i += 1;
      }
      out.push(T.sectionHead(num ?? raw, title || 'SECTION', out.length ? T.gap(9) : 0));
      continue;
    }

    // "A. Scope of Agreement" style sub-heads
    if (/^[A-Z]\.\s+\S/.test(line) && line.length <= 80) {
      out.push({ text: line, bold: true, fontSize: T.fs(8.5), color: T.ink, margin: [0, 4, 0, 1] });
      continue;
    }

    out.push({ text: line, fontSize: T.fs(8), color: T.ink, margin: [0, 0, 0, 2.5], alignment: 'justify' });
  }
  return out;
}

export function buildQuotePdf(quote, setting = {}, options = {}) {
  const printer = getPrinter();
  const def = options.definitions
    ? mergeDefinitions(options.definitions)
    : mergeDefinitions(setting.definitions);
  const T = makeTheme(def);

  const hidden = new Set(sanitizeHiddenFields(quote.hidden_fields));
  const show = (key) => !hidden.has(key);

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
  const seasonWeeks = weeksBetween(quote.season_start, quote.season_end);
  const peakWeeks = Number(quote.peak_weeks || seasonWeeks || 0);
  const customerName = quote.Customer?.name || '';

  const company = setting.company_name || 'Four Seasons Pool Management';
  const contractorName = (def.contractor.label || '').trim() || company;
  const useContractorName = def.contractor.replaceWord;
  /** The party label used in running prose on the specification page. */
  const contractorWord = useContractorName ? contractorName.toUpperCase() : 'the CONTRACTOR';
  const ownerWord = def.labels.ownerParty || 'OWNER';

  const facilityAddr = [quote.facility_name, quote.facility_address].filter(Boolean).join('\n');
  const ownerAddr = [
    quote.Customer?.name,
    quote.Customer?.address || [quote.Customer?.city].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  const proposalNo = quote.quote_no || '-';
  const contractLabel = `${def.labels.contractPrefix} ${proposalNo}`;
  const tagline = setting.company_tagline || DEFAULT_TAGLINE;
  const contactLine = [
    setting.company_phone ? `Tel: ${setting.company_phone}` : '',
    setting.company_fax ? `Fax: ${setting.company_fax}` : '',
    setting.company_email || '',
  ]
    .filter(Boolean)
    .join('  •  ');

  // The cover names the client once. When the facility carries the same name as
  // the customer, printing both would repeat it — so the second line is dropped.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const coverFacility =
    quote.facility_name && norm(quote.facility_name) !== norm(customerName) ? quote.facility_name : '';

  const notes = (quote.special_notes || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const commentLines = notes.length
    ? notes.map((n) => ({
        text: [
          { text: `${n.label ? `${n.label}. ` : ''}`, bold: true },
          { text: applyContractorLabel(n.body || '', useContractorName ? contractorName : '') },
        ],
        fontSize: T.fs(8),
        margin: [0, 0, 0, 1],
      }))
    : [{ text: 'None.', fontSize: T.fs(8), italics: true, color: T.muted }];

  const items = (quote.items || []).filter((it) => (it.description || '').trim());
  const itemTable = items.length
    ? {
        table: {
          headerRows: 1,
          widths: ['*', 34, 38, 54, 54],
          body: [
            [
              { text: 'DESCRIPTION', style: 'th' },
              { text: 'QTY', style: 'th', alignment: 'right' },
              { text: 'UNIT', style: 'th', alignment: 'center' },
              { text: 'UNIT PRICE', style: 'th', alignment: 'right' },
              { text: 'AMOUNT', style: 'th', alignment: 'right' },
            ],
            ...items.map((it) => {
              const qty = Number(it.quantity || 0);
              const price = Number(it.unit_price || 0);
              const amount = it.line_total != null ? Number(it.line_total) : qty * price;
              return [
                { text: it.description || '', fontSize: T.fs(8), color: T.ink },
                { text: String(qty), fontSize: T.fs(8), alignment: 'right', color: T.muted },
                { text: it.unit || '', fontSize: T.fs(8), alignment: 'center', color: T.muted },
                { text: money(price, cur), fontSize: T.fs(8), alignment: 'right', color: T.muted },
                { text: money(amount, cur), fontSize: T.fs(8), alignment: 'right', bold: true, color: T.ink },
              ];
            }),
          ],
        },
        layout: T.hairline(),
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
        { text: `Due ${inst.due_date ? dateEN(inst.due_date) : inst.label || '-'}`, fontSize: T.fs(8), color: T.muted },
        { text: money(inst.amount, cur), fontSize: T.fs(8), bold: true, color: T.ink, alignment: 'right', width: 70 },
      ],
      margin: [0, 0, 0, 1],
    }));

  const termsSource =
    useContractorName && def.contractor.scope === 'all'
      ? applyContractorLabel(quote.template?.body, contractorName)
      : quote.template?.body;
  const generalTerms = show('terms') ? renderTemplateBody(T, termsSource) : [];

  const earlyBirdDeadline = quote.valid_until ? dateEN(quote.valid_until) : 'the stated deadline';
  const showEarlyBird = earlyBird > 0 && show('spec.earlyBird');

  // ---- Specification sections, numbered after the hidden ones are removed ----
  const specSections = [];
  const addSection = (key, title, content) => {
    if (!show(key)) return;
    const body = content.filter(Boolean);
    if (!body.length) return;
    specSections.push({ title, content: body });
  };

  addSection('spec.property', def.sectionTitles.property, [
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: def.labels.facilityHeading, style: 'th' },
            { text: def.labels.ownerHeading, style: 'th' },
          ],
          [
            { text: facilityAddr || '-', fontSize: T.fs(8), color: T.ink },
            { text: ownerAddr || '-', fontSize: T.fs(8), color: T.ink },
          ],
        ],
      },
      layout: T.hairline(),
      margin: [0, 0, 0, 1],
    },
  ]);

  addSection('spec.duration', def.sectionTitles.duration, [
    {
      text: `${contractorWord} will maintain the aforementioned swimming pool between ${dateEN(quote.season_start)} and ${dateEN(quote.season_end)}.`,
      fontSize: T.fs(8),
      color: T.ink,
      margin: [0, 0, 0, 3],
    },
    show('spec.schedule')
      ? {
          columns: [
            scheduleColumn(T, quote.schedules, 'normal', def.labels.normalSeason),
            show('spec.scheduleSchool')
              ? scheduleColumn(T, quote.schedules, 'okul', def.labels.schoolSeason, def.labels.schoolSeasonNote)
              : { width: '*', text: '' },
          ],
          columnGap: 18,
          margin: [0, 0, 0, 2],
        }
      : null,
    show('spec.personnel')
      ? {
          columns: [
            personnelRows(T, lifeguards, hoursPer, totalStaffHours, peakWeeks),
            show('spec.scheduleSchool')
              ? personnelRows(T, lifeguards, hoursPer, totalStaffHours, peakWeeks)
              : { width: '*', text: '' },
          ],
          columnGap: 18,
          margin: [0, 0, 0, 2],
        }
      : null,
    quote.notes && show('spec.scheduleNote')
      ? {
          text: [
            { text: 'NOTE (school / off-season calendar): ', bold: true },
            { text: quote.notes },
          ],
          fontSize: T.fs(7),
          color: T.muted,
          margin: [0, 2, 0, 0],
        }
      : null,
  ]);

  addSection('spec.comments', def.sectionTitles.comments, commentLines);

  addSection('spec.compensation', def.sectionTitles.compensation, [
    {
      text: `Payment from the ${ownerWord} is to be received by ${contractorWord} by the dates listed below.`,
      fontSize: T.fs(8),
      color: T.muted,
      margin: [0, 0, 0, 3],
    },
    itemTable && show('spec.items')
      ? {
          text: def.labels.servicesIncluded,
          bold: true,
          fontSize: T.fs(7.5),
          color: T.primary,
          characterSpacing: 0.6,
          margin: [0, 0, 0, 2],
        }
      : null,
    itemTable && show('spec.items') ? itemTable : null,
    show('spec.totals')
      ? {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: [
                    { text: 'Total Contract Price   ', color: T.muted, fontSize: T.fs(8) },
                    { text: money(total, cur), bold: true, fontSize: T.fs(11), color: T.primary },
                  ],
                  margin: [0, 0, 0, 2],
                },
                ...(showEarlyBird
                  ? [
                      {
                        text: [
                          { text: '“Early Bird Discount” Price   ', color: T.muted, fontSize: T.fs(8) },
                          { text: money(contractAmount, cur), bold: true, fontSize: T.fs(11), color: T.primary },
                        ],
                        margin: [0, 0, 0, 2],
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
                        fontSize: T.fs(7),
                        color: T.muted,
                        margin: [0, 0, 0, 1],
                      },
                    ]
                  : []),
              ],
            },
            showEarlyBird
              ? {
                  width: '48%',
                  text: `Note: In order for the “Early Bird Discount” to be honored the executed contract must be received by ${contractorWord} no later than ${earlyBirdDeadline}. If applicable, the discount will be applied to the last Installment payment.`,
                  fontSize: T.fs(7),
                  italics: true,
                  color: T.muted,
                }
              : { width: '48%', text: '' },
          ],
          columnGap: 12,
          margin: [0, 0, 0, 4],
        }
      : null,
    show('spec.installments')
      ? insts.length
        ? {
            columns: [
              { width: '*', stack: dueStack(insts.slice(0, half)) },
              { width: '*', stack: dueStack(insts.slice(half)) },
            ],
            columnGap: 24,
            margin: [0, 0, 0, 4],
          }
        : {
            text: 'No payment schedule defined.',
            fontSize: T.fs(8),
            italics: true,
            color: T.muted,
            margin: [0, 0, 0, 4],
          }
      : null,
  ]);

  addSection('spec.acceptance', def.sectionTitles.acceptance, [
    {
      text: generalTerms.length
        ? `This Contract consists of the Specification page (sections 1–${specSections.length + 1}) and the attached Terms and Conditions.`
        : `This Contract consists of the Specification page (sections 1–${specSections.length + 1}).`,
      fontSize: T.fs(8),
      color: T.muted,
      margin: [0, 0, 0, 6],
    },
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: def.labels.ownerColumn,
              bold: true,
              fontSize: T.fs(8),
              color: T.primary,
              characterSpacing: 1,
              margin: [0, 0, 0, 8],
            },
            T.sigLine('SIGNATURE'),
            T.sigLine('TITLE'),
            T.sigLine('COMPANY'),
            T.sigLine('DATE'),
          ],
        },
        {
          width: '*',
          stack: [
            {
              text: def.labels.contractorColumn,
              bold: true,
              fontSize: T.fs(8),
              color: T.primary,
              characterSpacing: 1,
              margin: [0, 0, 0, 8],
            },
            T.sigLine('SIGNATURE'),
            T.sigLine(`BY — ${contractorName.toUpperCase()}`),
            T.sigLine('TITLE'),
            T.sigLine('DATE'),
          ],
        },
      ],
      columnGap: 24,
    },
    show('spec.signatureNote')
      ? {
          text: def.labels.signatureNote,
          fontSize: T.fs(7),
          italics: true,
          color: T.muted,
          margin: [0, 6, 0, 0],
        }
      : null,
  ]);

  const specContent = specSections.flatMap((s, i) => [
    T.sectionHead(i + 1, s.title, i === 0 ? T.gap(6) : T.gap(5)),
    ...s.content,
  ]);

  const specHeader = show('spec.header')
    ? [
        {
          text: company.toUpperCase(),
          bold: true,
          fontSize: T.fs(13),
          color: T.primary,
          characterSpacing: 2.2,
          alignment: 'center',
        },
        {
          text: setting.company_address || '',
          fontSize: T.fs(8.5),
          color: T.muted,
          alignment: 'center',
          margin: [0, 2, 0, 0],
        },
        {
          text: def.labels.specTitle,
          bold: true,
          fontSize: T.fs(10.5),
          color: T.ink,
          characterSpacing: 1.1,
          alignment: 'center',
          margin: [0, 6, 0, 0],
        },
        {
          text: contractLabel,
          fontSize: T.fs(9.5),
          color: T.muted,
          characterSpacing: 0.6,
          alignment: 'center',
          margin: [0, 1, 0, 5],
        },
        // Double rule — the signature mark of this layout
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: T.contentW, y2: 0, lineWidth: 1.4, lineColor: T.primary },
            { type: 'line', x1: 0, y1: 3.2, x2: T.contentW, y2: 3.2, lineWidth: 0.4, lineColor: T.primary },
          ],
          margin: [0, 0, 0, 2],
        },
      ]
    : [];

  // ---- Cover ----
  const cover = [
    show('cover.tagline')
      ? {
          text: `“${tagline}”`,
          italics: true,
          alignment: 'center',
          fontSize: T.fs(12.5),
          color: T.muted,
          margin: [0, 26, 0, 0],
        }
      : null,
    show('cover.tagline') ? T.centeredRule(170, [0, 15, 0, 30]) : null,
    show('cover.title')
      ? {
          text: def.labels.titleLine1,
          bold: true,
          alignment: 'center',
          fontSize: T.fs(24),
          color: T.primary,
          characterSpacing: 0.4,
        }
      : null,
    show('cover.title')
      ? {
          text: def.labels.titleLine2,
          bold: true,
          alignment: 'center',
          fontSize: T.fs(24),
          color: T.primary,
          characterSpacing: 7,
          margin: [0, 3, 0, 24],
        }
      : null,
    show('cover.contractNo')
      ? {
          text: contractLabel,
          bold: true,
          alignment: 'center',
          fontSize: T.fs(15),
          color: T.ink,
          characterSpacing: 0.9,
          margin: [0, 0, 0, 34],
        }
      : null,
    show('cover.customer')
      ? { text: customerName || 'Customer', bold: true, alignment: 'center', fontSize: T.fs(19), color: T.ink }
      : null,
    coverFacility && show('cover.facility')
      ? { text: coverFacility, alignment: 'center', fontSize: T.fs(15), color: T.ink, margin: [0, 7, 0, 0] }
      : null,
    show('cover.facilityAddress')
      ? {
          text: quote.facility_address || '',
          alignment: 'center',
          fontSize: T.fs(11.5),
          color: T.muted,
          lineHeight: 1.3,
          margin: [0, 6, 0, 0],
        }
      : null,

    // Pushes the company block toward the foot of the cover. Kept as a spacer
    // rather than an absolute position so an unusually long facility address
    // still reflows instead of colliding with it.
    { text: ' ', margin: [0, 235, 0, 0] },

    show('cover.company') ? T.centeredRule(220, [0, 0, 0, 14]) : null,
    show('cover.company')
      ? {
          text: company.toUpperCase(),
          bold: true,
          alignment: 'center',
          fontSize: T.fs(14),
          color: T.primary,
          characterSpacing: 2.2,
          margin: [0, 0, 0, 6],
        }
      : null,
    show('cover.company')
      ? { text: setting.company_address || '', alignment: 'center', fontSize: T.fs(9.5), color: T.muted }
      : null,
    show('cover.company')
      ? { text: contactLine, alignment: 'center', fontSize: T.fs(9.5), color: T.muted, margin: [0, 3, 0, 0] }
      : null,
    show('cover.company')
      ? {
          text: (setting.company_website || '').toUpperCase(),
          alignment: 'center',
          fontSize: T.fs(9.5),
          color: T.primary,
          characterSpacing: 1,
          margin: [0, 3, 0, 0],
        }
      : null,
    show('cover.initials')
      ? {
          text: `${def.labels.initials}   ____________________`,
          alignment: 'center',
          fontSize: T.fs(9),
          color: T.muted,
          margin: [0, 30, 0, 0],
        }
      : null,
  ].filter(Boolean);

  const content = [...cover];
  if (specContent.length || specHeader.length) {
    content.push({ text: '', pageBreak: 'before' }, ...specHeader, ...specContent);
  }
  if (generalTerms.length) {
    content.push({ text: '', pageBreak: 'before' }, ...generalTerms);
  }

  const docDefinition = {
    pageSize: T.size,
    pageMargins: [T.margin, T.margin - 6, T.margin, T.margin - 4],
    defaultStyle: { font: 'Roboto', fontSize: T.fs(9), color: T.ink, lineHeight: 1.06 },
    footer: (currentPage, pageCount) => ({
      margin: [T.margin, 6, T.margin, 0],
      columns: [
        {
          text: currentPage > 1 && show('footer.initials') ? `${def.labels.initials} __________` : '',
          fontSize: T.fs(7),
          color: T.muted,
          width: '*',
        },
        {
          text: show('footer.rev') ? setting.rev_label || '' : '',
          fontSize: T.fs(7),
          color: T.muted,
          alignment: 'center',
          width: 'auto',
        },
        {
          text: show('footer.pageNo') ? `Page ${currentPage} of ${pageCount}` : '',
          fontSize: T.fs(7),
          color: T.muted,
          alignment: 'right',
          width: '*',
        },
      ],
    }),
    content,
    styles: {
      th: { bold: true, color: T.primary, fontSize: T.fs(7.5), characterSpacing: 0.6, margin: [0, 1, 0, 1] },
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
