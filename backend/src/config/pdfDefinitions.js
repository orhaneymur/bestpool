/**
 * Single source of truth for what the contract PDF is allowed to contain and how
 * it is styled — the "Definitions" (Tanımlamalar) module.
 *
 * Two layers, deliberately kept separate:
 *   1. DEFINITIONS  — company-wide defaults, stored once in `settings.definitions`.
 *   2. hidden_fields — per contract, stored on the quote. A new contract copies
 *      `definitions.hidden` as its starting point and owns its list from then on,
 *      so changing the company default never silently rewrites signed paperwork.
 *
 * The frontend fetches PDF_BLOCKS from GET /api/definitions/schema instead of
 * keeping its own copy, so the two can never drift apart.
 */

/** Every block of the PDF that can be switched off, in print order. */
export const PDF_BLOCKS = [
  // --- Cover ---
  { key: 'cover.tagline', group: 'Cover', label: 'Tagline', hint: 'Italic motto at the very top' },
  { key: 'cover.title', group: 'Cover', label: 'Agreement title' },
  { key: 'cover.contractNo', group: 'Cover', label: 'Contract number' },
  { key: 'cover.customer', group: 'Cover', label: 'Customer name' },
  { key: 'cover.facility', group: 'Cover', label: 'Facility name' },
  { key: 'cover.facilityAddress', group: 'Cover', label: 'Facility address' },
  { key: 'cover.company', group: 'Cover', label: 'Company block', hint: 'Name, address, phone, website' },
  { key: 'cover.initials', group: 'Cover', label: 'Owner initials line' },

  // --- Specification page ---
  { key: 'spec.header', group: 'Specification', label: 'Page header', hint: 'Company name, title and contract no' },
  { key: 'spec.property', group: 'Specification', label: 'Property information', hint: 'The whole section' },
  {
    key: 'spec.propertyFacility',
    group: 'Specification',
    label: '— Facility name and address column',
    hint: 'Hide when it repeats the owner column',
  },
  {
    key: 'spec.propertyOwner',
    group: 'Specification',
    label: '— Facility owner / agent column',
    hint: 'Hide when it repeats the facility column',
  },
  { key: 'spec.duration', group: 'Specification', label: 'Contract duration sentence' },
  { key: 'spec.schedule', group: 'Specification', label: 'Operating hours tables' },
  { key: 'spec.scheduleSchool', group: 'Specification', label: 'School / off-season hours column' },
  { key: 'spec.personnel', group: 'Specification', label: 'Staffing hours' },
  { key: 'spec.holidays', group: 'Specification', label: 'Public holidays covered', hint: 'Lists the staffed US holidays' },
  { key: 'spec.scheduleNote', group: 'Specification', label: 'School calendar note' },
  { key: 'spec.comments', group: 'Specification', label: 'Additional comments' },
  { key: 'spec.compensation', group: 'Specification', label: 'Compensation schedule' },
  { key: 'spec.items', group: 'Specification', label: 'Services included table' },
  { key: 'spec.totals', group: 'Specification', label: 'Total contract price' },
  { key: 'spec.earlyBird', group: 'Specification', label: 'Early bird discount' },
  { key: 'spec.installments', group: 'Specification', label: 'Payment due dates' },
  { key: 'spec.acceptance', group: 'Specification', label: 'Acceptance & signatures' },
  { key: 'spec.signatureNote', group: 'Specification', label: 'Electronic signature note' },

  // --- Terms ---
  { key: 'terms', group: 'Terms', label: 'Terms and conditions pages' },

  // --- Footer ---
  { key: 'footer.initials', group: 'Footer', label: 'Owner initials' },
  { key: 'footer.rev', group: 'Footer', label: 'Revision label' },
  { key: 'footer.pageNo', group: 'Footer', label: 'Page numbers' },
];

export const PDF_BLOCK_KEYS = PDF_BLOCKS.map((b) => b.key);
const BLOCK_KEY_SET = new Set(PDF_BLOCK_KEYS);

/**
 * Drops unknown keys so a stale frontend or a hand-edited payload cannot poison
 * the PDF. Also accepts the raw JSON string some MySQL/driver combinations hand
 * back for a JSON column, and null for rows written before the column existed.
 */
export function sanitizeHiddenFields(list) {
  let arr = list;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter((k) => BLOCK_KEY_SET.has(k)))];
}

export const DEFAULT_DEFINITIONS = {
  page: {
    size: 'LETTER',          // LETTER | A4
    margin: 40,              // pt, left/right
    density: 'compact',      // compact | comfortable — drives paddings and leading
    fontScale: 1,            // 0.85 – 1.25
  },
  theme: {
    primary: '#0d47a1',      // headings, rules
    numeral: '#93aed6',      // oversized section numerals
    ink: '#1f2733',          // body text
    muted: '#5a6672',        // secondary text
    rule: '#c9d3de',         // hairlines
  },
  labels: {
    contractPrefix: 'Contract :',
    titleLine1: 'COMMERCIAL POOL MANAGEMENT',
    titleLine2: 'AGREEMENT',
    specTitle: 'SWIMMING POOL MANAGEMENT AGREEMENT',
    ownerColumn: 'OWNER / CLIENT',
    contractorColumn: 'CONTRACTOR',
    ownerParty: 'OWNER',
    initials: 'Owner’s Initial(s)',
    facilityHeading: 'FACILITY NAME AND ADDRESS',
    ownerHeading: 'FACILITY OWNER / AGENT',
    normalSeason: 'Normal / Season Hours of Operation',
    schoolSeason: 'School / Off Season Hours of Operation',
    schoolSeasonNote: 'Note: Operating hours while county public schools are in session.',
    servicesIncluded: 'SERVICES INCLUDED',
    signatureNote:
      'Electronic, touch, mouse, and uploaded signatures are accepted and have the same force as handwritten signatures. Please initial each page of this contract where indicated.',
  },
  sectionTitles: {
    property: 'Property Information',
    duration: 'Contract Duration, Operating Schedule and Personnel',
    comments: 'Additional Comments',
    compensation: 'Compensation Schedule',
    acceptance: 'Acceptance of Proposal',
  },
  contractor: {
    // Print the company name where the paperwork would otherwise say "the CONTRACTOR".
    replaceWord: true,
    scope: 'all',            // all | spec  (spec = specification page only, terms untouched)
    label: '',               // blank = fall back to settings.company_name
  },
  numbering: {
    padding: 3,              // FSPM-2026-001
    yearlyReset: true,
  },
  /** Blocks a brand-new contract starts with switched off. */
  hidden: [],
};

/** Deep-merges stored definitions onto the defaults so missing keys never crash the PDF. */
export function mergeDefinitions(stored) {
  let parsed = stored;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  const src = parsed && typeof parsed === 'object' ? parsed : {};
  const out = {};
  for (const [key, base] of Object.entries(DEFAULT_DEFINITIONS)) {
    const val = src[key];
    if (Array.isArray(base)) {
      out[key] = Array.isArray(val) ? val : base;
    } else if (base && typeof base === 'object') {
      out[key] = { ...base, ...(val && typeof val === 'object' ? val : {}) };
    } else {
      out[key] = val === undefined || val === null || val === '' ? base : val;
    }
  }
  out.hidden = sanitizeHiddenFields(out.hidden);
  return out;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Clamps anything a user can type into a range the renderer can survive.
 * pdfmake throws on a bad colour or a negative margin, and that would surface as
 * "PDF export failed" with no clue why — so it is fixed here, once.
 */
export function validateDefinitions(input) {
  const d = mergeDefinitions(input);
  const errors = [];

  if (!['LETTER', 'A4'].includes(d.page.size)) d.page.size = 'LETTER';
  if (!['compact', 'comfortable'].includes(d.page.density)) d.page.density = 'compact';
  d.page.margin = clamp(Number(d.page.margin), 18, 90, 40);
  d.page.fontScale = clamp(Number(d.page.fontScale), 0.85, 1.25, 1);

  for (const [k, v] of Object.entries(d.theme)) {
    if (!HEX.test(String(v))) {
      errors.push(`theme.${k} must be a #rrggbb colour`);
      d.theme[k] = DEFAULT_DEFINITIONS.theme[k];
    }
  }

  for (const group of ['labels', 'sectionTitles']) {
    for (const [k, v] of Object.entries(d[group])) {
      d[group][k] = String(v ?? '').slice(0, 400);
      if (!d[group][k]) d[group][k] = DEFAULT_DEFINITIONS[group][k];
    }
  }

  if (!['all', 'spec'].includes(d.contractor.scope)) d.contractor.scope = 'all';
  d.contractor.replaceWord = !!d.contractor.replaceWord;
  d.contractor.label = String(d.contractor.label ?? '').slice(0, 200);

  d.numbering.padding = clamp(Number(d.numbering.padding), 1, 6, 3);
  d.numbering.yearlyReset = !!d.numbering.yearlyReset;

  return { definitions: d, errors };
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
