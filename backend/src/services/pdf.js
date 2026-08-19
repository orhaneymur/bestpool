import PdfPrinter from 'pdfmake';
import { mergeDefinitions, sanitizeHiddenFields, fillTemplate } from '../config/pdfDefinitions.js';
import { computeSeason } from './seasonCalendar.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * The printer is built once per process, not once per contract.
 *
 * Constructing it decodes four Roboto TTFs out of pdfmake's base64 font bundle —
 * roughly 700 KB of synchronous work that used to run on every single PDF
 * request, on the same thread that answers every other API call.
 */
let printerInstance = null;
function getPrinter() {
  if (printerInstance) return printerInstance;
  const vfs = require('pdfmake/build/vfs_fonts.js');
  const vfsData = vfs?.pdfMake?.vfs || vfs?.vfs || vfs?.default?.pdfMake?.vfs || vfs;
  if (!vfsData || !vfsData['Roboto-Regular.ttf']) {
    throw new Error('pdfmake fonts (vfs_fonts) could not be loaded. Ensure pdfmake is installed.');
  }
  printerInstance = new PdfPrinter({
    Roboto: {
      normal: Buffer.from(vfsData['Roboto-Regular.ttf'], 'base64'),
      bold: Buffer.from(vfsData['Roboto-Medium.ttf'], 'base64'),
      italics: Buffer.from(vfsData['Roboto-Italic.ttf'], 'base64'),
      bolditalics: Buffer.from(vfsData['Roboto-MediumItalic.ttf'], 'base64'),
    },
  });
  return printerInstance;
}

/** Pays the font-decoding cost at boot so the first contract is not the slow one. */
export function warmUpPdf() {
  getPrinter();
}

export const DEFAULT_TAGLINE = 'Safety Is Our Standard, Service Is Our Promise';

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/**
 * Brand artwork, read once and cached as data URIs.
 *
 * The transparent PNGs are what get drawn — the source JPEGs have no alpha, so
 * their white background prints as a visible grey box once opacity is applied.
 * Replacing the artwork means regenerating the PNGs, not just swapping the JPEGs.
 * A missing file is not fatal: the PDF simply renders without that piece.
 */
const assetCache = new Map();
function asset(name) {
  if (assetCache.has(name)) return assetCache.get(name);
  let value = null;
  try {
    const file = path.join(ASSET_DIR, name);
    value = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  } catch (err) {
    console.warn(`[pdf] Brand asset "${name}" is unavailable:`, err.message);
  }
  assetCache.set(name, value);
  return value;
}

const PAGE_WIDTH = { LETTER: 612, A4: 595.28 };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * A data URI pdfmake will actually accept, or null.
 *
 * The upload endpoint checks this too, but the renderer refuses to trust it:
 * pdfmake throws on image data it cannot decode, and an image stored before that
 * check existed would take down every export with an error that names a
 * contract rather than the setting at fault. Printing without the signature is
 * the better failure.
 */
function usableImageDataUri(value) {
  const str = String(value || '');
  if (!/^data:image\/(png|jpe?g);base64,/.test(str)) return null;
  try {
    const bytes = Buffer.from(str.slice(str.indexOf(',') + 1), 'base64');
    const isPng = bytes.subarray(0, 8).equals(PNG_MAGIC);
    const isJpeg = bytes.subarray(0, 3).equals(JPEG_MAGIC);
    if (!isPng && !isJpeg) return null;
    if (isPng && !bytes.subarray(-8).includes(Buffer.from('IEND'))) return null;
    return str;
  } catch {
    return null;
  }
}

/**
 * "BY —" as typed for a run-in name, cut back to the caption "BY".
 *
 * The signatory's name now prints above its rule rather than beside the prefix,
 * so the dash that used to join them would sit under the line pointing at
 * nothing. Applied at render time because the prefix is a saved setting: an
 * install that never reopens the Definitions page still reads right.
 */
function trimTrailingSeparators(text) {
  let out = String(text ?? '').trim();
  while (out.length && ' -–—:.'.includes(out[out.length - 1])) out = out.slice(0, -1).trim();
  return out;
}

/**
 * The pixel size of a PNG or JPEG data URI, or null when it cannot be read.
 *
 * The acceptance block needs the aspect ratio to sit a signature exactly on its
 * rule: `fit` renders the image shorter than the box it is given whenever the
 * proportions say so, and without knowing by how much the ink floats above the
 * line by an amount that changes with every upload.
 */
function imagePixelSize(dataUri) {
  try {
    const bytes = Buffer.from(String(dataUri).slice(String(dataUri).indexOf(',') + 1), 'base64');
    if (bytes.subarray(0, 8).equals(PNG_MAGIC)) {
      // IHDR is the first chunk, and its width/height lead its payload.
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (bytes.subarray(0, 3).equals(JPEG_MAGIC)) {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = bytes[i + 1];
        // SOF0-SOF15 carry the frame size; DHT/DAC/RST/SOS never do.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
        }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
          i += 2;
          continue;
        }
        i += 2 + bytes.readUInt16BE(i + 2);
      }
    }
  } catch {
    /* falls through to null: the signature still prints, just box-aligned */
  }
  return null;
}

/**
 * Steps the specification page is squeezed through until it fits one sheet.
 *
 * The first entry is "leave the customer's settings alone", so a contract that
 * already fits comes out byte-for-byte as before. After that both the type and
 * the space between sections tighten together — whitespace is the cheaper of
 * the two to give up, which is why it shrinks faster than the font does.
 *
 * The last step is the floor, not an expected landing place: most contracts
 * settle in the first three or four.
 */
const FIT_STEPS = [
  { scale: 1, spacing: 1 },
  { scale: 1, spacing: 0.8, density: 'compact' },
  { scale: 0.96, spacing: 0.7, density: 'compact' },
  { scale: 0.92, spacing: 0.6, density: 'compact' },
  { scale: 0.88, spacing: 0.5, density: 'compact' },
  { scale: 0.84, spacing: 0.4, density: 'compact' },
  { scale: 0.8, spacing: 0.3, density: 'compact' },
  { scale: 0.76, spacing: 0.25, density: 'compact' },
  { scale: 0.72, spacing: 0.2, density: 'compact' },
  { scale: 0.68, spacing: 0.15, density: 'compact' },
];

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
  /**
   * Vertical breathing room, as a multiplier.
   *
   * Only the fit pass sets it (see FIT_STEPS): past a point, shrinking the type
   * alone stops reclaiming height because the whitespace between sections does
   * not shrink with it. Squeezing the gaps buys a page back at a far more
   * readable font size than dropping to 6pt would.
   */
  const spacing = Number.isFinite(def.page.spacing) ? def.page.spacing : 1;
  const pad = (tight ? 1.0 : 2.6) * spacing;
  const gap = (n) => Math.max(1, Math.round((tight ? n : n * 1.6) * spacing));

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

  const sigWidth = Math.floor((contentW - 24) / 2) - 16;

  /**
   * One ruled line in the acceptance block, optionally with something printed
   * above it — a signature image, or a date already filled in.
   *
   * `boxHeight` reserves that space whether or not this particular line uses it.
   * Both signature columns pass the same value, so the owner's rules stay level
   * with the contractor's instead of riding up where the contractor has an image
   * and the owner has blank paper. The fixed-height table row is what guarantees
   * it: an image sized with `fit` renders shorter than its box whenever the
   * aspect ratio says so, and stacking it directly would misalign the columns by
   * exactly that difference.
   */
  const sigLine = (
    label,
    {
      width = sigWidth,
      value = '',
      image = null,
      imageFit = null,
      boxHeight = 0,
      overlap = 0,
      rule: ruled = true,
    } = {}
  ) => {
    const above = boxHeight > 0
      ? [{
          table: {
            widths: [width],
            heights: [boxHeight],
            body: [[
              image
                ? {
                    image,
                    fit: imageFit || [width, boxHeight],
                    alignment: 'left',
                    border: [false, false, false, false],
                  }
                : {
                    text: value,
                    fontSize: fs(8),
                    color: def.theme.ink,
                    alignment: 'left',
                    margin: [0, Math.max(0, boxHeight - fs(8) - 2), 0, 0],
                    border: [false, false, false, false],
                  },
            ]],
          },
          layout: 'noBorders',
          /**
           * A negative bottom margin pulls the rule up under the box, so the ink
           * crosses the line the way a pen would. Both columns pass the same
           * value, so their rules still finish level with each other.
           */
          margin: [0, 0, 0, -overlap],
        }]
      : [];

    return {
      stack: [
        ...above,
        /**
         * `rule: false` keeps the geometry and drops the ruled line, which is
         * how one column reserves the height of a line the other column has and
         * it does not — without inviting anyone to write on it.
         */
        ruled
          ? { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, lineColor: def.theme.ink }] }
          : { canvas: [] },
        { text: label, fontSize: fs(6.8), color: def.theme.muted, characterSpacing: 0.6, margin: [0, 2, 0, gap(4)] },
      ],
    };
  };

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
    sigWidth,
    pad,
    rule,
    centeredRule,
    sectionHead,
    hairline,
    sigLine,
  };
}

function scheduleColumn(T, schedules, seasonType, title, subtitle, labels) {
  const rows = (schedules || [])
    .filter((s) => s.season_type === seasonType)
    .sort((a, b) => DAY_ORDER.indexOf(a.day_label) - DAY_ORDER.indexOf(b.day_label));

  const bodyRows = DAY_ORDER.map((day) => {
    const r = rows.find((x) => x.day_label === day);
    const open = r ? (r.is_closed ? labels.scheduleClosed : to12h(r.open_time) || '-') : '-';
    // A closed day says so in both columns; a dash under CLOSE read as missing
    // data rather than as "shut".
    const close = r ? (r.is_closed ? labels.scheduleClosed : to12h(r.close_time) || '-') : '-';
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
              { text: labels.scheduleDay, style: 'th' },
              { text: labels.scheduleOpen, style: 'th', alignment: 'center' },
              { text: labels.scheduleClose, style: 'th', alignment: 'center' },
            ],
            ...bodyRows,
          ],
        },
        layout: T.hairline(),
      },
    ],
  };
}

/**
 * Staffing figures, all derived from the season calendar rather than from a
 * hand-typed hours-per-week multiplied by a rounded week count.
 */
/**
 * Every staffing figure is its own hideable row.
 *
 * They used to travel together under a single "staffing" switch, so hiding the
 * hours also took the guard count with them — the one line most contracts want
 * to keep. `show` decides each row on its own; if all five are off the caller
 * drops the block entirely rather than printing an empty rule.
 */
function personnelRows(T, lifeguards, season, seasonType = 'normal', labels = {}, show = () => true) {
  const daily = season.avgDailyHoursPerGuard;
  // The configured week, not the season average — see scheduledWeekHours().
  const weekly = seasonType === 'okul' ? season.weeklyStaffHoursSchool : season.weeklyStaffHours;
  const seasonal = season.staffHours;
  const row = (label, value) => [
    { text: label, fontSize: T.fs(7.5), color: T.muted },
    { text: value, fontSize: T.fs(7.5), bold: true, color: T.ink, alignment: 'right' },
  ];

  const body = [
    show('spec.staffLifeguards') && row(labels.staffLifeguards, `${lifeguards} Lifeguard(s)`),
    show('spec.staffOperatingDays') && row(labels.staffOperatingDays, `${season.openDays} of ${season.days} days`),
    show('spec.staffDailyHours') && row(labels.staffDailyHours, `${daily} Hrs/day`),
    show('spec.staffWeeklyHours') && row(labels.staffWeeklyHours, `${weekly} Hrs/week`),
    show('spec.staffSeasonHours') && row(labels.staffSeasonHours, `${seasonal} Hrs/season`),
  ].filter(Boolean);

  if (!body.length) return { width: '*', text: '' };

  return {
    width: '*',
    table: {
      widths: ['*', 'auto'],
      body,
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

export async function buildQuotePdf(quote, setting = {}, options = {}) {
  const printer = getPrinter();
  const baseDef = options.definitions
    ? mergeDefinitions(options.definitions)
    : mergeDefinitions(setting.definitions);

  const hidden = new Set(sanitizeHiddenFields(quote.hidden_fields));
  const show = (key) => !hidden.has(key);

  /**
   * The uploaded signature, as stored: a data URI.
   *
   * Anything that is not a PNG or JPEG data URI is ignored rather than handed to
   * pdfmake, which throws on unrecognised image data — a bad upload would
   * otherwise surface as "PDF export failed" with nothing pointing at the cause.
   * Read once here because it does not vary with the layout scale.
   */
  const signatureAsset = usableImageDataUri(setting.signature_image);

  /**
   * Every piece of the document, laid out at one particular scale.
   *
   * This runs more than once. The specification is re-composed at progressively
   * tighter settings until it fits on a single sheet (see fitSpecification);
   * the cover and the Terms and Conditions always come from the first pass, at
   * exactly the scale the customer configured.
   */
  function composeParts(def) {
    const T = makeTheme(def);
    const cur = quote.currency || 'USD';
    const earlyBird = Number(quote.early_bird_discount || 0);
    const total = Number(quote.total || 0);
    const subtotal = Number(quote.subtotal || 0);
    const discountAmount = Number(quote.discount_amount || 0);
    const vatAmount = Number(quote.vat_amount || 0);
    // The second price on the page: what the owner pays if they execute by the
    // deadline. It never reduces the total contract price, which is what the
    // payment schedule is drawn from.
    const earlyBirdPrice = Math.max(0, total - earlyBird);
    const lifeguards = Number(quote.lifeguard_count || 0);
    // Staffing figures come from the day-by-day season calendar, so the PDF can
    // never disagree with the invoice the customer was quoted.
    const season = computeSeason({
      season_start: quote.season_start,
      season_end: quote.season_end,
      schedules: quote.schedules,
      lifeguard_count: lifeguards,
      school_closes: quote.school_closes,
      school_reopens: quote.school_reopens,
      holiday_policy: quote.holiday_policy,
    });
    const observedHolidays = season.holidays.filter((h) => h.observed && h.hours > 0);
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
    // Split so the email can be switched off on its own — the cover already
    // carries the website, and repeating the address is noise on a title page.
    const contactLine = [
      setting.company_phone ? `Tel: ${setting.company_phone}` : '',
      setting.company_fax ? `Fax: ${setting.company_fax}` : '',
      show('cover.email') ? setting.company_email || '' : '',
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
            {
              text: applyContractorLabel(n.body || '', useContractorName ? contractorName : ''),
              // Per clause, so the commercial terms can stand out from the
              // boilerplate they sit among.
              bold: !!n.is_bold,
            },
          ],
          fontSize: T.fs(8),
          margin: [0, 0, 0, 1],
        }))
      : [{ text: def.labels.noComments, fontSize: T.fs(8), italics: true, color: T.muted }];

    const items = (quote.items || []).filter((it) => (it.description || '').trim());
    const itemTable = items.length
      ? {
          table: {
            headerRows: 1,
            widths: ['*', 34, 38, 54, 54],
            body: [
              [
                { text: def.labels.itemsDescription, style: 'th' },
                { text: def.labels.itemsQty, style: 'th', alignment: 'right' },
                { text: def.labels.itemsUnit, style: 'th', alignment: 'center' },
                { text: def.labels.itemsUnitPrice, style: 'th', alignment: 'right' },
                { text: def.labels.itemsAmount, style: 'th', alignment: 'right' },
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
          {
            text: `${def.labels.dueLabel} ${inst.due_date ? dateEN(inst.due_date) : inst.label || '-'}`,
            fontSize: T.fs(8),
            color: T.muted,
          },
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
    // `keepTogether` marks a section that must never be split across a page
    // break — signature lines stranded on their own from the heading that
    // explains what is being signed.
    const addSection = (key, title, content, { keepTogether = false } = {}) => {
      if (!show(key)) return;
      const body = content.filter(Boolean);
      if (!body.length) return;
      specSections.push({ title, content: body, keepTogether });
    };

    // The facility and the owner/agent are the same party on most properties, so
    // either column can be switched off on its own. The survivor then spans the
    // full width instead of leaving an empty half.
    const propertyColumns = [
      show('spec.propertyFacility') && { heading: def.labels.facilityHeading, value: facilityAddr },
      show('spec.propertyOwner') && { heading: def.labels.ownerHeading, value: ownerAddr },
    ].filter(Boolean);

    addSection('spec.property', def.sectionTitles.property, [
      propertyColumns.length
        ? {
            table: {
              widths: propertyColumns.map(() => '*'),
              body: [
                propertyColumns.map((c) => ({ text: c.heading, style: 'th' })),
                propertyColumns.map((c) => ({ text: c.value || '-', fontSize: T.fs(8), color: T.ink })),
              ],
            },
            layout: T.hairline(),
            margin: [0, 0, 0, 1],
          }
        : null,
    ]);

    addSection('spec.duration', def.sectionTitles.duration, [
      {
        text: fillTemplate(def.sentences.duration, {
          contractor: contractorWord,
          owner: ownerWord,
          start: dateEN(quote.season_start),
          end: dateEN(quote.season_end),
          seasonSummary: season.valid ? ` — ${season.weeksLabel}, ${season.openDays} operating days.` : '.',
        }),
        fontSize: T.fs(8),
        color: T.ink,
        margin: [0, 0, 0, 3],
      },
      show('spec.schedule')
        ? {
            columns: [
              scheduleColumn(T, quote.schedules, 'normal', def.labels.normalSeason, null, def.labels),
              show('spec.scheduleSchool')
                ? scheduleColumn(T, quote.schedules, 'okul', def.labels.schoolSeason, def.labels.schoolSeasonNote, def.labels)
                : { width: '*', text: '' },
            ],
            columnGap: 18,
            margin: [0, 0, 0, 2],
          }
        : null,
      show('spec.personnel')
        ? {
            columns: [
              personnelRows(T, lifeguards, season, 'normal', def.labels, show),
              show('spec.scheduleSchool')
                ? personnelRows(T, lifeguards, season, 'okul', def.labels, show)
                : { width: '*', text: '' },
            ],
            columnGap: 18,
            margin: [0, 0, 0, 2],
          }
        : null,
      // Spelled out on the contract so the customer can see exactly which public
      // holidays are staffed — these are the days a normally-closed weekday opens.
      observedHolidays.length && show('spec.holidays')
        ? {
            text: [
              { text: def.labels.holidaysPrefix, bold: true },
              {
                text: observedHolidays
                  .map((h) => `${h.name} (${dateEN(h.date)}, ${h.weekday}) ${h.hours} hrs`)
                  .join(' · '),
              },
            ],
            fontSize: T.fs(7),
            color: T.muted,
            margin: [0, 3, 0, 0],
          }
        : null,
      quote.notes && show('spec.scheduleNote')
        ? {
            text: [
              { text: def.labels.schoolNotePrefix, bold: true },
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
      show('spec.compensationIntro')
        ? {
            text: fillTemplate(def.sentences.compensation, { owner: ownerWord, contractor: contractorWord }),
            fontSize: T.fs(8),
            color: T.muted,
            margin: [0, 0, 0, 3],
          }
        : null,
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
                      { text: `${def.labels.totalPrice}   `, color: T.muted, fontSize: T.fs(8) },
                      { text: money(total, cur), bold: true, fontSize: T.fs(11), color: T.primary },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  ...(showEarlyBird
                    ? [
                        {
                          text: [
                            { text: `${def.labels.earlyBirdPrice}   `, color: T.muted, fontSize: T.fs(8) },
                            { text: money(earlyBirdPrice, cur), bold: true, fontSize: T.fs(11), color: T.primary },
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
              showEarlyBird && show('spec.earlyBirdNote')
                ? {
                    width: '48%',
                    text: fillTemplate(def.sentences.earlyBirdNote, {
                      contractor: contractorWord,
                      owner: ownerWord,
                      deadline: earlyBirdDeadline,
                    }),
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
              text: def.labels.noInstallments,
              fontSize: T.fs(8),
              italics: true,
              color: T.muted,
              margin: [0, 0, 0, 4],
            }
        : null,
    ]);

    /**
     * The contractor half of the acceptance block is filled in before the
     * contract goes out: the company signs first, and the customer countersigns.
     * The owner half stays blank for them to complete.
     */
    const signatureImage = show('spec.contractorSignature') ? signatureAsset : null;
    // Never wider than the column it sits in, however the setting is typed.
    const signatureFitWidth = Math.min(def.branding.signatureWidth, T.sigWidth);
    /**
     * The size the signature actually prints at, measured rather than assumed.
     *
     * `fit` scales an upload to whichever of width or height binds first, so a
     * wide signature comes out well short of the height it was given. Reserving
     * the full height regardless left a band of blank paper above the ink — the
     * signature hung in mid-air, and the specification paid for space nothing
     * was drawn in. The box is the ink, so it rests on its rule at any aspect
     * ratio. An unreadable file falls back to the configured box.
     */
    const signatureInk = (() => {
      if (!signatureImage) return null;
      const maxHeight = def.branding.signatureHeight;
      const px = imagePixelSize(signatureImage);
      if (!px?.width || !px?.height) return { width: signatureFitWidth, height: maxHeight };
      const scale = Math.min(signatureFitWidth / px.width, maxHeight / px.height);
      return { width: Math.round(px.width * scale), height: Math.max(8, Math.round(px.height * scale)) };
    })();
    const signatureBox = signatureInk ? signatureInk.height : 0;
    /**
     * How far the ink crosses the rule. Just enough to read as a pen stroke over
     * the line rather than a stamp below it — the third of the box this used to
     * drop pushed the signature down across its own caption.
     */
    const signatureOverlap = signatureImage ? 4 : 0;
    // The date the contract was drawn up. A contract being previewed before its
    // first save has no created_at yet, so it shows today.
    const contractDate = dateEN(quote.created_at || new Date());
    const dateBox = T.fs(8) + 4;
    const signatoryName = (def.contractor.signatory || '').trim() || contractorName;
    /**
     * The signatory's name is printed above its rule, like the date, so "BY"
     * stays a caption under the line instead of running into the name — and the
     * title reads as the title, on its own line.
     */
    const byLabel = trimTrailingSeparators(def.labels.signatoryPrefix) || 'BY';

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
              /**
               * The owner signs without a title line, so the row the contractor
               * prints their name on is reserved here and left unruled. Every
               * row below then faces its opposite number at the same height:
               * company against title, date against date, signature against
               * signature.
               */
              T.sigLine('', { boxHeight: dateBox, rule: false }),
              T.sigLine('COMPANY', { boxHeight: dateBox }),
              T.sigLine('DATE', { boxHeight: dateBox }),
              T.sigLine('SIGNATURE', { boxHeight: signatureBox, overlap: signatureOverlap }),
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
              T.sigLine(byLabel, { boxHeight: dateBox, value: signatoryName.toUpperCase() }),
              T.sigLine('TITLE', { boxHeight: dateBox, value: def.labels.contractorTitle }),
              T.sigLine('DATE', { boxHeight: dateBox, value: contractDate }),
              /**
               * Last, because signing is the last thing anyone does — and
               * because a signature stranded above three empty lines read as a
               * stamp rather than as somebody having signed the page.
               */
              T.sigLine('SIGNATURE', {
                boxHeight: signatureBox,
                overlap: signatureOverlap,
                image: signatureImage ? 'contractorSignature' : null,
                imageFit: signatureInk ? [signatureInk.width, signatureInk.height] : null,
              }),
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
    ], { keepTogether: true });

    const specContent = specSections.flatMap((s, i) => {
      const head = T.sectionHead(i + 1, s.title, i === 0 ? T.gap(6) : T.gap(5));
      // A kept-together section becomes one stack so pdfmake moves the heading
      // with its body instead of breaking between them.
      return s.keepTogether
        ? [{ unbreakable: true, stack: [head, ...s.content] }]
        : [head, ...s.content];
    });

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
    const logo = show('cover.logo') ? asset('logo.png') : null;

    const cover = [
      logo
        ? {
            image: 'coverLogo',
            width: def.branding.logoWidth,
            alignment: 'center',
            margin: [0, 18, 0, show('cover.tagline') ? 10 : 24],
          }
        : null,
      show('cover.tagline')
        ? {
            text: `“${tagline}”`,
            italics: true,
            alignment: 'center',
            fontSize: T.fs(12.5),
            color: T.muted,
            margin: [0, logo ? 0 : 26, 0, 0],
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
      // The logo adds roughly 100pt to the top of the cover, so the spacer that
      // pushes the company block to the foot has to give that height back.
      { text: ' ', margin: [0, logo ? 130 : 235, 0, 0] },

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

    return { T, def, cover, specHeader, specContent, generalTerms, logo };
  }

  /**
   * Composed once up front, purely to answer "is there a specification at all?"
   * and to read scalars off the base theme. Its nodes are never rendered — see
   * buildDocument for why that matters.
   */
  const probe = composeParts(baseDef);
  const { T } = probe;
  const def = baseDef;

  /**
   * Page furniture, shared by every render below. The callback returns a fresh
   * object per page, so unlike content nodes it is safe to reuse.
   */
  const footer = (currentPage, pageCount) => ({
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
  });

  const pageMargins = [T.margin, T.margin - 6, T.margin, T.margin - 4];

  /** Every `style: 'th'` in the document is a specification table header. */
  const specTableHeader = (theme) => ({
    bold: true,
    color: theme.primary,
    fontSize: theme.fs(7.5),
    characterSpacing: 0.6,
    margin: [0, 1, 0, 1],
  });

  const watermark = show('page.background') && def.branding.backgroundOpacity > 0
    ? asset('background-watermark.png')
    : null;

  /** Streams a document definition to a Buffer. */
  function renderToBuffer(docDefinition) {
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

  /**
   * Page total, read back out of the finished PDF.
   *
   * The page-tree root carries the real count. Asking pdfmake instead — by
   * keeping the pageCount handed to the footer callback — reports the figure
   * from before the final pagination pass, and calls a two-page specification
   * one page.
   */
  function countPdfPages(buf) {
    const text = buf.toString('latin1');
    const counts = [...text.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    if (counts.length) return Math.max(...counts);
    return [...text.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
  }

  /**
   * A complete document definition built from nodes that have never been laid
   * out before.
   *
   * The freshness is the whole point. pdfmake annotates the content tree while
   * it measures — widths, heights, resolved margins — and laying the same node
   * objects out a second time gives a different, wrong answer. Reusing them is
   * what made the fit pass certify a specification as one page and then print it
   * as two, and what made each successive measurement of identical content come
   * back larger than the last.
   *
   * A null `specDef` leaves the specification out entirely, which is how the
   * baseline — how many pages the rest of the contract needs — gets measured.
   * The cover and the Terms and Conditions are always composed from the
   * customer's own settings, so only the specification ever changes scale.
   */
  function buildDocument(specDef) {
    const shell = composeParts(baseDef);
    const spec = specDef ? composeParts(specDef) : null;

    const content = [...shell.cover];
    if (spec && (spec.specContent.length || spec.specHeader.length)) {
      const specNodes = [...spec.specHeader, ...spec.specContent];
      // The break rides on the first real node rather than an empty text node of
      // its own, which printed a stray blank line at the top of the page.
      specNodes[0] = { ...specNodes[0], pageBreak: 'before' };
      content.push(...specNodes);
    }
    if (shell.generalTerms.length) {
      content.push({ text: '', pageBreak: 'before' }, ...shell.generalTerms);
    }

    return {
      pageSize: T.size,
      pageMargins,
      defaultStyle: { font: 'Roboto', fontSize: T.fs(9), color: T.ink, lineHeight: 1.06 },
      // Registered by name: returning the data URI straight from background()
      // made pdfmake embed the same picture once per page, which took a 6-page
      // contract from ~90 KB to ~2.9 MB.
      images: {
        ...(watermark ? { watermark } : {}),
        ...(shell.logo ? { coverLogo: shell.logo } : {}),
        ...(signatureAsset ? { contractorSignature: signatureAsset } : {}),
      },
      // Drawn under the content on every page, centred, at low opacity so the
      // contract stays the thing you read.
      background: watermark
        ? (currentPage, pageSize) => ({
            image: 'watermark',
            width: def.branding.backgroundWidth,
            opacity: def.branding.backgroundOpacity,
            absolutePosition: {
              x: (pageSize.width - def.branding.backgroundWidth) / 2,
              y: (pageSize.height - def.branding.backgroundWidth * (600 / 900)) / 2,
            },
          })
        : undefined,
      footer,
      content,
      styles: { th: specTableHeader((spec || shell).T) },
    };
  }

  const pagesOf = async (specDef) => countPdfPages(await renderToBuffer(buildDocument(specDef)));

  /** One fit step, layered over the customer's settings. */
  const stepDef = (step) => ({
    ...baseDef,
    page: {
      ...baseDef.page,
      // Deliberately past the 0.85 floor that mergeDefinitions enforces for
      // hand-picked values: this one is measured, not typed in.
      fontScale: baseDef.page.fontScale * step.scale,
      spacing: step.spacing,
      density: step.density || baseDef.page.density,
    },
  });

  /**
   * Find the loosest scale at which the specification still fits one page.
   *
   * The acceptance block and its signature lines used to spill onto a page of
   * their own, leaving most of it blank — the specification reads as one sheet
   * and it should print as one. Content varies per contract (schedules, staffing
   * rows, special clauses), so the scale is measured rather than guessed.
   *
   * "One page" is measured as a difference: the contract without a
   * specification against the same contract with one. Anything else would mean
   * modelling how the cover and the Terms and Conditions paginate, which is the
   * guesswork this exists to avoid.
   *
   * The first step is the customer's own settings, so a contract that already
   * fits is laid out exactly as before. If even the tightest step overflows, the
   * specification prints at that step rather than losing anything — a dense
   * second page beats a missing clause.
   */
  async function fitSpecification() {
    if (!probe.specContent.length && !probe.specHeader.length) return baseDef;

    let baseline;
    try {
      baseline = await pagesOf(null);
    } catch (err) {
      console.warn('[pdf] Could not measure the contract without its specification:', err.message);
      return baseDef;
    }

    let last = baseDef;
    for (const [index, step] of FIT_STEPS.entries()) {
      const candidate = index === 0 ? baseDef : stepDef(step);
      last = candidate;

      let specPages;
      try {
        specPages = (await pagesOf(candidate)) - baseline;
      } catch (err) {
        console.warn('[pdf] Could not measure the specification page:', err.message);
        return candidate;
      }
      if (process.env.PDF_FIT_DEBUG) {
        console.log(`[pdf] fit step ${index} (scale ${step.scale}) -> specification takes ${specPages} page(s)`);
      }
      if (specPages <= 1) {
        if (index > 0) {
          console.log(`[pdf] Specification scaled to ${Math.round(step.scale * 100)}% to fit one page.`);
        }
        return candidate;
      }
    }
    console.warn('[pdf] Specification still needs more than one page at the tightest scale.');
    return last;
  }

  const docDefinition = buildDocument(await fitSpecification());

  return renderToBuffer(docDefinition);
}
