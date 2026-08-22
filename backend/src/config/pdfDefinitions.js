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
  {
    key: 'cover.customer',
    group: 'Cover',
    label: 'Customer name',
    hint: 'Off by default — the cover names the facility, and the customer is named in Property Information',
  },
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
  {
    key: 'spec.personnel',
    group: 'Specification',
    label: 'Staffing figures',
    hint: 'The whole block — switch off single rows below instead',
  },
  { key: 'spec.staffLifeguards', group: 'Specification', label: '— Number of lifeguards' },
  { key: 'spec.staffOperatingDays', group: 'Specification', label: '— Operating days' },
  { key: 'spec.staffDailyHours', group: 'Specification', label: '— Daily hours per guard' },
  { key: 'spec.staffWeeklyHours', group: 'Specification', label: '— Weekly staffing hours' },
  { key: 'spec.staffSeasonHours', group: 'Specification', label: '— Seasonal staffing hours' },
  { key: 'spec.holidays', group: 'Specification', label: 'Public holidays covered', hint: 'Lists the staffed US holidays' },
  { key: 'spec.scheduleNote', group: 'Specification', label: 'School calendar note' },
  { key: 'spec.comments', group: 'Specification', label: 'Additional comments' },
  { key: 'spec.compensation', group: 'Specification', label: 'Compensation schedule' },
  { key: 'spec.compensationIntro', group: 'Specification', label: '— Payment sentence' },
  { key: 'spec.items', group: 'Specification', label: 'Services included table' },
  { key: 'spec.totals', group: 'Specification', label: 'Total contract price' },
  { key: 'spec.earlyBird', group: 'Specification', label: 'Early bird discount' },
  { key: 'spec.earlyBirdNote', group: 'Specification', label: '— Early bird deadline note' },
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
    size: 'A4',              // LETTER | A4
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
    signatoryPrefix: 'BY',
    // Printed above the contractor's title rule; the owner has no title line.
    contractorTitle: 'President',
    /**
     * The captions under the four acceptance rules.
     *
     * The owner's first rule used to be captioned COMPANY, which asked for one
     * particular thing. Most of the people who sign are signing for themselves,
     * so it asks for a name now — "BY", the same caption the contractor's own
     * name rule carries — and whoever signs writes a company or a person there
     * as they please. All four are editable, like every other word on the page.
     */
    ownerBy: 'BY',
    titleCaption: 'TITLE',
    dateCaption: 'DATE',
    signatureCaption: 'SIGNATURE',

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
    /**
     * The line that opens the Acceptance section, which says what the customer
     * is signing.
     *
     * It counts sections, not sheets of paper: the specification is one page
     * carrying sections {firstSection}–{lastSection}, and the cover and the
     * Terms and Conditions are the other pages of the same document. Both
     * versions are editable, and the numbers are substituted at render time so
     * hiding a section renumbers the sentence with it.
     *
     * {firstSection}, {lastSection}, {sectionCount}
     */
    acceptance:
      'This Contract consists of the Specification page (sections {firstSection}–{lastSection}) and the attached Terms and Conditions.',
    // The same sentence for a contract printed without the terms pages.
    acceptanceNoTerms: 'This Contract consists of the Specification page (sections {firstSection}–{lastSection}).',
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
    { label: 'A', body: 'Test kit restock included.', bold: true },
    { label: 'B', body: 'First aid kit restock included.', bold: true },
    {
      label: 'C',
      body: 'Cost for additional lifeguard hours (more than 48 hours notice): $35/hr.',
      bold: false,
    },
    {
      label: 'D',
      body: 'Cost for additional lifeguard hours (less than 48 hours notice): $55/hr.',
      bold: false,
    },
    {
      label: 'E',
      body: 'Upon contract execution, the CONTRACTOR will conduct two service visits per month during the off-season.',
      bold: false,
    },
    {
      label: 'F',
      body: 'The CONTRACTOR will schedule and attend all Health Department inspections.',
      bold: false,
    },
    {
      label: 'G',
      body: 'The CONTRACTOR will conduct random safety inspections and in-service training.',
      bold: false,
    },
    {
      label: 'H',
      body: 'Contract includes pool opening and closing. This contract will expire once the pool winterization has been completed.',
      bold: false,
    },
    { label: 'I', body: 'Chemicals included for disinfectant and pH compliance.', bold: false },
    {
      label: 'J',
      body: 'The CONTRACTOR will conduct a minimum of three (3) inspections per week during the regular pool season.',
      bold: false,
    },
    {
      label: 'K',
      body: 'All lifeguards have current certifications in Lifeguarding, First Aid, CPR and AED issued by Ellis & Associates or American Red Cross.',
      bold: false,
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
    signatureWidth: 210,
    signatureHeight: 54,
  },
  /**
   * Blocks a brand-new contract starts with switched off.
   *
   * The cover is a title page: it carries the company block and the website, so
   * repeating the email is noise, and nothing on it is signed — the signature
   * lines belong with the Acceptance section on the specification page. The
   * customer's own name is left off it too: the cover names the property the
   * contract is for, and who owns or acts for it is stated where it belongs, in
   * Property Information on the specification page.
   */
  hidden: ['cover.email', 'cover.initials', 'cover.customer'],

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
 * How the editable wording is laid out on the Definitions screen.
 *
 * The screen used to carry its own hand-written list of which key belongs under
 * which heading, so a word added here stayed invisible until somebody remembered
 * to add it there too — and a few never were. The order below is the order the
 * contract prints in, and describeDefinitionFields() guarantees that every key
 * in `labels`, `sentences` and `sectionTitles` reaches the screen whether or not
 * it is listed here.
 *
 * `group` is the definitions object the key lives in, `kind` is the input the
 * screen renders ('text' or 'multiline'), and `placeholders` are the `{name}`
 * slots that sentence understands.
 */
export const DEFINITION_SECTIONS = [
  {
    id: 'cover',
    title: 'Cover page',
    description: 'The title sheet, before the specification starts.',
    fields: [
      { group: 'labels', key: 'titleLine1', label: 'Agreement title — first line' },
      { group: 'labels', key: 'titleLine2', label: 'Agreement title — second line' },
      {
        group: 'labels',
        key: 'contractPrefix',
        label: 'Contract number caption',
        hint: 'Printed before the contract number, e.g. “Contract :”',
      },
    ],
  },
  {
    id: 'specHeader',
    title: 'Specification header',
    description: 'The band at the top of the specification page.',
    fields: [{ group: 'labels', key: 'specTitle', label: 'Specification page title' }],
  },
  {
    id: 'property',
    title: 'Section — Property Information',
    description: 'Section numbers are assigned automatically: hide a section and the rest renumber.',
    fields: [
      { group: 'sectionTitles', key: 'property', label: 'Section title' },
      { group: 'labels', key: 'facilityHeading', label: 'Column heading — facility name and address' },
      { group: 'labels', key: 'ownerHeading', label: 'Column heading — facility owner / agent' },
    ],
  },
  {
    id: 'duration',
    title: 'Section — Duration and Operating Schedule',
    description: 'The opening sentence and the two hours-of-operation tables.',
    fields: [
      { group: 'sectionTitles', key: 'duration', label: 'Section title' },
      {
        group: 'sentences',
        key: 'duration',
        label: 'Contract duration sentence',
        kind: 'multiline',
        placeholders: ['contractor', 'owner', 'start', 'end', 'seasonSummary'],
      },
      { group: 'labels', key: 'normalSeason', label: 'Normal / season hours heading' },
      { group: 'labels', key: 'schoolSeason', label: 'School / off-season hours heading' },
      { group: 'labels', key: 'schoolSeasonNote', label: 'School / off-season note', kind: 'multiline' },
      { group: 'labels', key: 'scheduleDay', label: 'Table column — day' },
      { group: 'labels', key: 'scheduleOpen', label: 'Table column — open' },
      { group: 'labels', key: 'scheduleClose', label: 'Table column — close' },
      { group: 'labels', key: 'scheduleClosed', label: 'Wording for a closed day' },
      { group: 'labels', key: 'holidaysPrefix', label: 'Public holidays line prefix' },
      { group: 'labels', key: 'schoolNotePrefix', label: 'School calendar note prefix' },
    ],
  },
  {
    id: 'personnel',
    title: 'Staffing figures',
    description:
      'The row captions under the operating schedule. Each row can also be switched off on the PDF blocks tab.',
    fields: [
      { group: 'labels', key: 'staffLifeguards', label: 'Number of lifeguards' },
      { group: 'labels', key: 'staffOperatingDays', label: 'Operating days' },
      { group: 'labels', key: 'staffDailyHours', label: 'Daily hours per guard' },
      { group: 'labels', key: 'staffWeeklyHours', label: 'Weekly staffing hours' },
      { group: 'labels', key: 'staffSeasonHours', label: 'Seasonal staffing hours' },
    ],
  },
  {
    id: 'comments',
    title: 'Section — Additional Comments',
    description: 'The clauses themselves live on the Standard clauses tab.',
    fields: [
      { group: 'sectionTitles', key: 'comments', label: 'Section title' },
      { group: 'labels', key: 'noComments', label: 'Wording when there are no comments' },
    ],
  },
  {
    id: 'compensation',
    title: 'Section — Compensation Schedule',
    description: 'The services table, the totals and the payment dates.',
    fields: [
      { group: 'sectionTitles', key: 'compensation', label: 'Section title' },
      {
        group: 'sentences',
        key: 'compensation',
        label: 'Payment sentence',
        kind: 'multiline',
        placeholders: ['contractor', 'owner'],
      },
      { group: 'labels', key: 'servicesIncluded', label: 'Services table heading' },
      { group: 'labels', key: 'itemsDescription', label: 'Table column — description' },
      { group: 'labels', key: 'itemsQty', label: 'Table column — quantity' },
      { group: 'labels', key: 'itemsUnit', label: 'Table column — unit' },
      { group: 'labels', key: 'itemsUnitPrice', label: 'Table column — unit price' },
      { group: 'labels', key: 'itemsAmount', label: 'Table column — amount' },
      { group: 'labels', key: 'totalPrice', label: 'Total contract price caption' },
      { group: 'labels', key: 'earlyBirdPrice', label: 'Early bird price caption' },
      {
        group: 'sentences',
        key: 'earlyBirdNote',
        label: 'Early bird deadline note',
        kind: 'multiline',
        placeholders: ['contractor', 'owner', 'deadline'],
      },
      { group: 'labels', key: 'dueLabel', label: 'Payment due prefix' },
      { group: 'labels', key: 'noInstallments', label: 'Wording for an empty payment schedule' },
    ],
  },
  {
    id: 'acceptance',
    title: 'Section — Acceptance of Proposal',
    description:
      'The signature block. The opening sentence counts sections, not sheets of paper: the specification is the one page carrying them, and the cover and the terms are the rest of the document.',
    fields: [
      { group: 'sectionTitles', key: 'acceptance', label: 'Section title' },
      {
        group: 'sentences',
        key: 'acceptance',
        label: 'Opening sentence — with terms and conditions',
        kind: 'multiline',
        placeholders: ['firstSection', 'lastSection', 'sectionCount'],
      },
      {
        group: 'sentences',
        key: 'acceptanceNoTerms',
        label: 'Opening sentence — when the terms pages are switched off',
        kind: 'multiline',
        placeholders: ['firstSection', 'lastSection', 'sectionCount'],
      },
      { group: 'labels', key: 'ownerColumn', label: 'Left column heading — the customer' },
      { group: 'labels', key: 'contractorColumn', label: 'Right column heading — the company' },
      {
        group: 'labels',
        key: 'ownerBy',
        label: 'Customer caption — name rule',
        hint: 'Under the customer’s first rule. “BY” leaves them free to write a company or their own name.',
      },
      { group: 'labels', key: 'signatoryPrefix', label: 'Company caption — name rule' },
      { group: 'labels', key: 'titleCaption', label: 'Caption — title rule' },
      { group: 'labels', key: 'dateCaption', label: 'Caption — date rule' },
      { group: 'labels', key: 'signatureCaption', label: 'Caption — signature rule' },
      {
        group: 'labels',
        key: 'contractorTitle',
        label: 'Company signatory’s title',
        hint: 'Used unless the Parties tab already carries a title after the name.',
      },
      { group: 'labels', key: 'signatureNote', label: 'Electronic signature note', kind: 'multiline' },
    ],
  },
  {
    id: 'furniture',
    title: 'Parties and page furniture',
    description: 'Words that appear throughout the contract rather than in one section.',
    fields: [
      {
        group: 'labels',
        key: 'ownerParty',
        label: 'Owner party word',
        hint: 'Substituted for {owner} in the sentences above',
      },
      { group: 'labels', key: 'initials', label: 'Initials line', hint: 'Printed in the page footer' },
    ],
  },
];

/** 'staffLifeguards' → 'Staff lifeguards' — a readable last resort for a key nobody has described. */
function humaniseKey(key) {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The definitions objects that hold editable text. */
const TEXT_GROUPS = ['sectionTitles', 'sentences', 'labels'];

/**
 * The sections above, plus anything in the definitions none of them mention.
 *
 * This is the guarantee the screen is built on: add a key to DEFAULT_DEFINITIONS
 * and it becomes editable from the panel on the next reload, described or not.
 * Give it a home in a section when it deserves one; leave it out and it lands
 * under "Other wording" rather than going missing.
 */
export function describeDefinitionFields() {
  const claimed = new Set(
    DEFINITION_SECTIONS.flatMap((s) => s.fields.map((f) => `${f.group}.${f.key}`))
  );

  const extras = [];
  for (const group of TEXT_GROUPS) {
    for (const key of Object.keys(DEFAULT_DEFINITIONS[group] || {})) {
      if (claimed.has(`${group}.${key}`)) continue;
      extras.push({
        group,
        key,
        label: humaniseKey(key),
        kind: group === 'sentences' ? 'multiline' : 'text',
      });
    }
  }

  if (!extras.length) return DEFINITION_SECTIONS;
  return [
    ...DEFINITION_SECTIONS,
    {
      id: 'other',
      title: 'Other wording',
      description:
        'Text the contract prints that has not been filed under a section yet. Editable here all the same.',
      fields: extras,
    },
  ];
}

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
  {
    /**
     * Nothing changes in the company defaults here — hide-cover-email-and-initials
     * already did that, and on installs where it has run this entry is the only
     * way to trigger the matching change on contracts created beforehand. The
     * backfill itself lives in the seed, which is where the contracts are; this
     * only records that it has happened, so a redeploy does not repeat it.
     */
    id: 'apply-cover-defaults-to-existing-contracts',
    apply() {},
  },
  {
    /**
     * The contract prints on A4.
     *
     * The shipped default was US Letter, which is both wider and shorter, so
     * pages laid out for A4 paper came out stretched across the line and the
     * specification lost the height it needs to keep the acceptance block with
     * the sections it belongs to. Switchable back on the Definitions page.
     */
    id: 'page-size-a4',
    apply(d) {
      d.page.size = 'A4';
    },
  },
  {
    /**
     * The signatory line prints the name above the rule, "BY" beneath it, so a
     * prefix saved for the old run-in form loses its trailing dash.
     */
    id: 'signatory-prefix-caption',
    apply(d) {
      d.labels.signatoryPrefix = 'BY';
    },
  },
  {
    /**
     * The cover names the facility, not the customer.
     *
     * The title page carried the customer's name in the largest type on the
     * page, above the property the contract is actually for. Who owns or acts
     * for that property is stated in Property Information on the specification
     * page, which is where a reader looks for it — so the cover stops repeating
     * it and leads with the facility. Switchable back on the Definitions page.
     */
    id: 'hide-cover-customer-name',
    apply(d) {
      d.hidden = [...new Set([...d.hidden, 'cover.customer'])];
    },
  },
  {
    /**
     * The first two standard clauses print bold.
     *
     * mergeDefinitions keeps a stored array in preference to the shipped one, so
     * an install whose clause list was written before `bold` existed carried no
     * weight at all and every clause came out plain — the shipped default never
     * reached it. Only applied when nothing is bold yet, so a list where the
     * emphasis has already been chosen is left exactly as it is.
     */
    id: 'bold-first-two-standard-clauses',
    apply(d) {
      if (!Array.isArray(d.defaultClauses) || d.defaultClauses.some((c) => c?.bold)) return;
      d.defaultClauses = d.defaultClauses.map((c, i) => ({ ...c, bold: i < 2 }));
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

  if (!['LETTER', 'A4'].includes(d.page.size)) d.page.size = 'A4';
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
      bold: !!c?.bold,
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
  d.branding.signatureWidth = clamp(Number(d.branding.signatureWidth), 40, 260, 210);
  d.branding.signatureHeight = clamp(Number(d.branding.signatureHeight), 14, 90, 54);

  return { definitions: d, errors };
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
