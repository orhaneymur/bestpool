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
  { key: 'cover.logo', group: 'Cover', label: 'Company logo' },
  { key: 'cover.tagline', group: 'Cover', label: 'Tagline', hint: 'Italic motto at the very top' },
  { key: 'cover.title', group: 'Cover', label: 'Agreement title' },
  { key: 'cover.contractNo', group: 'Cover', label: 'Contract number' },
  { key: 'cover.customer', group: 'Cover', label: 'Customer name' },
  { key: 'cover.facility', group: 'Cover', label: 'Facility name' },
  { key: 'cover.facilityAddress', group: 'Cover', label: 'Facility address' },
  { key: 'cover.company', group: 'Cover', label: 'Company block', hint: 'Name, address, phone, website' },
  {
    key: 'cover.email',
    group: 'Cover',
    label: '— Email address',
    hint: 'Part of the company block. Off by default; the website line already carries the address.',
  },
  { key: 'cover.initials', group: 'Cover', label: 'Owner initials line', hint: 'Off by default — the cover is not signed' },

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
  {
    key: 'spec.contractorSignature',
    group: 'Specification',
    label: '— Printed contractor signature',
    hint: 'The signature image uploaded on the Settings page',
  },
  { key: 'spec.signatureNote', group: 'Specification', label: 'Electronic signature note' },

  // --- Terms ---
  { key: 'terms', group: 'Terms', label: 'Terms and conditions pages' },

  // --- Page furniture ---
  {
    key: 'page.background',
    group: 'Page',
    label: 'Background watermark',
    hint: 'Faint emblem behind every page',
  },

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

    // --- Schedule table ---
    scheduleDay: 'DAY',
    scheduleOpen: 'OPEN',
    scheduleClose: 'CLOSE',
    scheduleClosed: 'Closed',

    // --- Staffing rows ---
    staffLifeguards: 'Number of Lifeguards',
    staffOperatingDays: 'Operating Days',
    staffDailyHours: 'Daily Hours (per guard, open days)',
    staffWeeklyHours: 'Weekly Staffing Hours',
    staffSeasonHours: 'Total Seasonal Staffing Hours',

    // --- Services table ---
    itemsDescription: 'DESCRIPTION',
    itemsQty: 'QTY',
    itemsUnit: 'UNIT',
    itemsUnitPrice: 'UNIT PRICE',
    itemsAmount: 'AMOUNT',

    // --- Money and payment ---
    totalPrice: 'Total Contract Price',
    earlyBirdPrice: '“Early Bird Discount” Price',
    dueLabel: 'Due',
    noInstallments: 'No payment schedule defined.',

    // --- Signatures ---
    signatoryPrefix: 'BY —',

    // --- Inline prefixes ---
    holidaysPrefix: 'PUBLIC HOLIDAYS COVERED: ',
    schoolNotePrefix: 'NOTE (school / off-season calendar): ',
    noComments: 'None.',
  },

  /**
   * Full sentences, kept apart from the short labels above because they are the
   * ones most likely to need rewording, and because they carry placeholders.
   *
   * `{name}` is substituted at render time — see fillTemplate(). An unknown
   * placeholder renders as empty rather than printing braces at the customer.
   * Available everywhere: {contractor}, {owner}. Per-sentence extras are noted
   * on each line.
   */
  sentences: {
    // {start}, {end}, {seasonSummary} — e.g. "15 weeks, 96 operating days"
    duration: '{contractor} will maintain the aforementioned swimming pool between {start} and {end}{seasonSummary}',
    compensation: 'Payment from the {owner} is to be received by {contractor} by the dates listed below.',
    // {deadline}
    earlyBirdNote:
      'Note: In order for the “Early Bird Discount” to be honored the executed contract must be received by {contractor} no later than {deadline}. If applicable, the discount will be applied to the last Installment payment.',
  },

  /**
   * The Additional Comments a brand-new contract starts with.
   *
   * These used to live in the frontend bundle, which meant changing a rate or a
   * clause needed a release. A contract copies them once, at creation, and owns
   * its copy from then on — editing this list never rewrites paperwork that has
   * already gone out.
   */
  defaultClauses: [
    { label: 'A', body: 'Test kit restock included.' },
    { label: 'B', body: 'First aid kit restock included.' },
    { label: 'C', body: 'Cost for additional lifeguard hours (more than 48 hours notice): $35/hr.' },
    { label: 'D', body: 'Cost for additional lifeguard hours (less than 48 hours notice): $55/hr.' },
    {
      label: 'E',
      body: 'Upon contract execution, the CONTRACTOR will conduct two service visits per month during the off-season.',
    },
    { label: 'F', body: 'The CONTRACTOR will schedule and attend all Health Department inspections.' },
    { label: 'G', body: 'The CONTRACTOR will conduct random safety inspections and in-service training.' },
    {
      label: 'H',
      body: 'Contract includes pool opening and closing. This contract will expire once the pool winterization has been completed.',
    },
    { label: 'I', body: 'Chemicals included for disinfectant and pH compliance.' },
    {
      label: 'J',
      body: 'The CONTRACTOR will conduct a minimum of three (3) inspections per week during the regular pool season.',
    },
    {
      label: 'K',
      body: 'All lifeguards have current certifications in Lifeguarding, First Aid, CPR and AED issued by Ellis & Associates or American Red Cross.',
    },
  ],
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
    /**
     * Who actually signs, printed under the contractor signature line. Blank
     * falls back to the company name, which is what the contract said before
     * there was anyone to name.
     */
    signatory: '',
  },
  numbering: {
    padding: 3,              // FSPM-2026-001
    yearlyReset: true,
  },
  branding: {
    // Cover logo width in points. The artwork keeps its aspect ratio.
    logoWidth: 190,
    // Watermark width in points and how strongly it prints. Kept low on purpose:
    // the whole point is that it must never compete with the contract text.
    backgroundWidth: 330,
    backgroundOpacity: 0.05,
    /**
     * The box the uploaded signature is fitted into, in points. The image keeps
     * its aspect ratio inside it, and the box is reserved in both signature
     * columns whether or not there is an image, so the two sets of rules stay
     * level with each other.
     */
    signatureWidth: 150,
    signatureHeight: 38,
  },
  /**
   * Blocks a brand-new contract starts with switched off.
   *
   * The cover is a title page: it carries the company block and the website, so
   * repeating the email is noise, and nothing on it is signed — the signature
   * lines belong with the Acceptance section on the specification page.
   */
  hidden: ['cover.email', 'cover.initials'],

  /**
   * One-time adjustments already applied to this settings row.
   *
   * `hidden` is a user's own choice, so new defaults must not silently overwrite
   * it on every boot. Each entry here records that a change has been offered
   * once and should not be offered again — see applyDefinitionMigrations().
   */
  migrations: [],
};

/**
 * Substitutes `{name}` placeholders in an editable sentence.
 *
 * Anything unknown becomes empty rather than printing braces into a contract,
 * because these strings are typed by a user and a typo must not reach the
 * customer as `{contracter}`.
 *
 * The frontend preview has a copy of this — see utils/template.js.
 */
export function fillTemplate(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (_match, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
  );
}

/**
 * Defaults that should reach installs created before they existed.
 *
 * Returns the definitions to save, or null when there is nothing to do. Applied
 * once each: a user who deliberately switches the cover email back on keeps it.
 */
const DEFINITION_MIGRATIONS = [
  {
    id: 'hide-cover-email-and-initials',
    apply(d) {
      d.hidden = [...new Set([...d.hidden, 'cover.email', 'cover.initials'])];
    },
  },
  {
    // The authorised signatory, previously the company name. Editable on the
    // Definitions page afterwards, like everything else here.
    id: 'set-contractor-signatory',
    apply(d) {
      if (!d.contractor.signatory) d.contractor.signatory = 'Mustafa INAN';
    },
  },
];

export function applyDefinitionMigrations(stored) {
  const d = mergeDefinitions(stored);
  const done = new Set(Array.isArray(d.migrations) ? d.migrations : []);
  const applied = [];

  for (const migration of DEFINITION_MIGRATIONS) {
    if (done.has(migration.id)) continue;
    migration.apply(d);
    done.add(migration.id);
    applied.push(migration.id);
  }

  if (!applied.length) return null;
  d.migrations = [...done];
  return { definitions: d, applied };
}

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

  // A blank field means "I did not mean to change this", so it falls back to the
  // shipped wording rather than printing a gap in the contract.
  for (const [group, limit] of [['labels', 400], ['sectionTitles', 400], ['sentences', 1200]]) {
    for (const [k, v] of Object.entries(d[group])) {
      d[group][k] = String(v ?? '').trim().slice(0, limit);
      if (!d[group][k]) d[group][k] = DEFAULT_DEFINITIONS[group][k];
    }
  }

  /**
   * The starting Additional Comments. Rows without body text are dropped rather
   * than rejected — an empty row is how a half-finished edit looks, not an error
   * worth refusing the whole save for.
   */
  d.defaultClauses = (Array.isArray(d.defaultClauses) ? d.defaultClauses : [])
    .map((c) => ({
      label: String(c?.label ?? '').trim().slice(0, 10),
      body: String(c?.body ?? '').trim().slice(0, 1000),
    }))
    .filter((c) => c.body)
    .slice(0, 40);

  d.migrations = (Array.isArray(d.migrations) ? d.migrations : [])
    .filter((m) => typeof m === 'string')
    .slice(0, 50);

  if (!['all', 'spec'].includes(d.contractor.scope)) d.contractor.scope = 'all';
  d.contractor.replaceWord = !!d.contractor.replaceWord;
  d.contractor.label = String(d.contractor.label ?? '').slice(0, 200);
  d.contractor.signatory = String(d.contractor.signatory ?? '').trim().slice(0, 200);

  d.numbering.padding = clamp(Number(d.numbering.padding), 1, 6, 3);
  d.numbering.yearlyReset = !!d.numbering.yearlyReset;

  d.branding.logoWidth = clamp(Number(d.branding.logoWidth), 40, 420, 190);
  d.branding.backgroundWidth = clamp(Number(d.branding.backgroundWidth), 80, 600, 330);
  // Hard ceiling rather than a warning: above roughly 0.18 the watermark starts
  // fighting the body text, and an unreadable contract is not a preference.
  d.branding.backgroundOpacity = clamp(Number(d.branding.backgroundOpacity), 0, 0.18, 0.05);
  // Bounded so an over-large signature cannot push the acceptance block onto a
  // page of its own, which is exactly what the one-page fit works to avoid.
  d.branding.signatureWidth = clamp(Number(d.branding.signatureWidth), 40, 260, 150);
  d.branding.signatureHeight = clamp(Number(d.branding.signatureHeight), 14, 90, 38);

  return { definitions: d, errors };
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
