/**
 * 2026 Bid Summary pricing engine.
 * County wages + fixed expenses + 5% overhead + 5% profit + 6% sales tax.
 */

export const COUNTY_WAGES = [
  { id: 'montgomery', label: 'Montgomery County', hourly: 20 },
  { id: 'frederick', label: 'Frederick County', hourly: 25 },
  { id: 'prince_georges', label: "Prince George's County", hourly: 20 },
  { id: 'howard', label: 'Howard County', hourly: 20 },
  { id: 'anne_arundel', label: 'Anne Arundel County', hourly: 20 },
  { id: 'baltimore', label: 'Baltimore County', hourly: 20 },
  { id: 'annapolis', label: 'Annapolis', hourly: 25 },
  { id: 'queen_annes', label: "Queen Anne's County", hourly: 27 },
];

export const BID_RATES = {
  overheadPct: 5,
  profitPct: 5,
  salesTaxPct: 6,
  management: 3000,
  commission: 1000,
  insurance: 2500,
  /** Drain/cleaning: flat $2,000, single-guard pool $1,000 */
  drainBase: 2000,
  drainSingleGuard: 1000,
  /** Winterization: flat $2,000, single-guard pool $1,000 */
  winterBase: 2000,
  winterSingleGuard: 1000,
};

/**
 * The catalogue entry behind each calculated expense.
 *
 * The bid used to price itself from the constants above and only label the
 * lines afterwards, which left two sources of truth for the same numbers: edit
 * a price on the Services page and the bid ignored you. The catalogue is the
 * source now, and BID_RATES is the fallback for a service that has been deleted.
 *
 * Matched on code first and on name second, so renaming a code — or clearing it
 * — does not quietly unlink every line and leave the wizard showing "Custom /
 * calculated" for the lot.
 */
export const BID_SERVICES = {
  wages: { code: 'LG-WAGE', name: 'Lifeguard wages' },
  management: { code: 'MGT-001', name: 'Management' },
  drainCleaning: { code: 'DRN-001', name: 'Drain and cleaning' },
  commission: { code: 'COM-001', name: 'Commission' },
  insurance: { code: 'INS-001', name: 'Insurance' },
  winterization: { code: 'WIN-001', name: 'Winterization' },
};

/** Chemicals are three catalogue rows; which one applies follows the guard count. */
export function chemicalServiceFor(lifeguardCount) {
  const n = Number(lifeguardCount || 0);
  if (n <= 1) return { code: 'CHM-1G', name: 'Chemicals (1-guard pool)' };
  if (n <= 3) return { code: 'CHM-23G', name: 'Chemicals (2–3 guard pool)' };
  return { code: 'CHM-4G', name: 'Chemicals (4+ guard pool)' };
}

const normalise = (v) => String(v || '').trim().toLowerCase();

export function findBidService(services, ref) {
  if (!ref || !Array.isArray(services)) return null;
  const wantedCode = normalise(ref.code);
  const wantedName = normalise(ref.name);

  const byCode = services.find((s) => wantedCode && normalise(s.code) === wantedCode);
  if (byCode) return byCode;

  const byName = services.find((s) => wantedName && normalise(s.name) === wantedName);
  if (byName) return byName;

  // "Chemicals (4+ guard pool)" should still answer to "Chemicals".
  const head = wantedName.split('(')[0].trim();
  return services.find((s) => head && normalise(s.name).startsWith(head)) || null;
}

/** The catalogue price for one expense, or the shipped rate if it is not listed. */
function catalogued(services, ref, fallback) {
  const svc = findBidService(services, ref);
  const price = Number(svc?.default_unit_price);
  return {
    service: svc,
    price: Number.isFinite(price) && price > 0 ? round2(price) : fallback,
  };
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function getCountyWage(countyId) {
  return COUNTY_WAGES.find((c) => c.id === countyId) || null;
}

export function chemicalsForGuards(lifeguardCount) {
  const n = Number(lifeguardCount || 0);
  if (n <= 1) return 5000;
  if (n <= 3) return 7500;
  return 10500;
}

/** Bid Summary: "$2,000 (1guard1000)" — flat $2,000, single-guard pool $1,000. */
export function drainCleaningForGuards(lifeguardCount) {
  const n = Math.max(1, Number(lifeguardCount || 0));
  return n <= 1 ? BID_RATES.drainSingleGuard : BID_RATES.drainBase;
}

export function winterizationForGuards(lifeguardCount) {
  const n = Math.max(1, Number(lifeguardCount || 0));
  return n <= 1 ? BID_RATES.winterSingleGuard : BID_RATES.winterBase;
}

/**
 * @param {object} input
 * @param {string} input.county
 * @param {number} input.lifeguardCount
 * @param {number} input.totalLifeguardHours  staffed hours for the whole season,
 *   taken from the season calendar (POST /api/season/preview). This is the only
 *   input that decides the wage bill — there is deliberately no weeks x hours
 *   fallback, because rounding the season to whole weeks is exactly the bug this
 *   replaced.
 * @param {number} [input.weeklyStaffHours]   average, shown for reference only
 */
export function computeBidSummary({
  county,
  lifeguardCount = 0,
  totalLifeguardHours = 0,
  weeklyStaffHours = 0,
  /** The service catalogue. Prices come from here; BID_RATES is the fallback. */
  services = [],
} = {}) {
  const countyRow = getCountyWage(county);
  const hourlyWage = countyRow?.hourly || 0;
  const guards = Number(lifeguardCount || 0);
  const weeklyPeakStaffHours = round2(Number(weeklyStaffHours || 0));
  const totalHours = round2(Number(totalLifeguardHours || 0));
  const totalWages = round2(totalHours * hourlyWage);

  const mgmt = catalogued(services, BID_SERVICES.management, BID_RATES.management);
  const chem = catalogued(services, chemicalServiceFor(guards), chemicalsForGuards(guards));
  const comm = catalogued(services, BID_SERVICES.commission, BID_RATES.commission);
  const ins = catalogued(services, BID_SERVICES.insurance, BID_RATES.insurance);

  /**
   * Drain/cleaning and winterization are flat, except that a single-guard pool
   * pays half. The catalogue holds the flat price; the halving is a rule, not a
   * second price, so it is applied here rather than expected of the catalogue.
   */
  const drain = catalogued(services, BID_SERVICES.drainCleaning, BID_RATES.drainBase);
  const winter = catalogued(services, BID_SERVICES.winterization, BID_RATES.winterBase);
  const halveForSingleGuard = (value) => (guards <= 1 ? round2(value / 2) : value);

  const management = mgmt.price;
  const drainCleaning = halveForSingleGuard(drain.price);
  const chemicals = chem.price;
  const commission = comm.price;
  const insurance = ins.price;
  const winterization = halveForSingleGuard(winter.price);

  // Which catalogue row priced each line, so the wizard can name them.
  const sources = {
    wages: findBidService(services, BID_SERVICES.wages),
    management: mgmt.service,
    drainCleaning: drain.service,
    chemicals: chem.service,
    commission: comm.service,
    insurance: ins.service,
    winterization: winter.service,
  };

  const expenses = round2(
    management + drainCleaning + chemicals + commission + insurance + winterization
  );
  const costBase = round2(totalWages + expenses);
  const overhead = round2((costBase * BID_RATES.overheadPct) / 100);
  const profit = round2((costBase * BID_RATES.profitPct) / 100);
  const projectCost = round2(costBase + overhead + profit);
  const salesTax = round2((projectCost * BID_RATES.salesTaxPct) / 100);
  const contractTotal = round2(projectCost + salesTax);

  return {
    countyLabel: countyRow?.label || '',
    // Carried through so the generated lines can pick the right chemicals tier.
    lifeguardCount: Number(lifeguardCount || 0),
    hourlyWage,
    weeklyPeakStaffHours,
    totalLifeguardHours: totalHours,
    totalWages,
    expenses: {
      management,
      drainCleaning,
      chemicals,
      commission,
      insurance,
      winterization,
      total: expenses,
    },
    costBase,
    overhead,
    profit,
    projectCost,
    salesTax,
    contractTotal,
    sources,
  };
}

/** Build quote line items from bid summary (for PDF / totals). */
/**
 * Turn a bid summary into contract line items.
 *
 * Each line carries the catalogue row that priced it, so the wizard names the
 * service instead of showing every row as unlinked. Overhead, profit and sales
 * tax stay unlinked because they are percentages of the rest rather than
 * anything the catalogue sells.
 */
export function buildBidLineItems(bid) {
  if (!bid || !bid.hourlyWage) return [];
  const src = bid.sources || {};
  const link = (svc) => ({ service_item_id: svc?.id ?? null });

  const lines = [];
  if (bid.totalLifeguardHours > 0) {
    lines.push({
      description: `Lifeguard wages — ${bid.countyLabel} ($${bid.hourlyWage}/hr × ${bid.totalLifeguardHours} hrs)`,
      quantity: bid.totalLifeguardHours,
      unit: 'hour',
      unit_price: bid.hourlyWage,
      vat_rate: 0,
      ...link(src.wages),
    });
  }

  const fixed = [
    ['Management', bid.expenses.management, src.management],
    ['Drain and cleaning', bid.expenses.drainCleaning, src.drainCleaning],
    ['Chemicals', bid.expenses.chemicals, src.chemicals],
    ['Commission', bid.expenses.commission, src.commission],
    ['Insurance', bid.expenses.insurance, src.insurance],
    ['Winterization', bid.expenses.winterization, src.winterization],
    [`Overhead (${BID_RATES.overheadPct}%)`, bid.overhead, null],
    [`Profit (${BID_RATES.profitPct}%)`, bid.profit, null],
    [`Sales tax (${BID_RATES.salesTaxPct}%)`, bid.salesTax, null],
  ];
  for (const [description, amount, service] of fixed) {
    if (!amount) continue;
    lines.push({
      // The catalogue's own wording when it priced the line, so the description
      // and the named service cannot disagree.
      description: service?.name || description,
      quantity: 1,
      unit: service?.unit || 'season',
      unit_price: amount,
      vat_rate: 0,
      ...link(service),
    });
  }
  return lines;
}

/** Six equal payments March–August (Specification payment schedule). */
export function buildMarchAugustInstallments(contractAmount, year) {
  const y = Number(year) || new Date().getFullYear();
  const months = [
    ['March', 3],
    ['April', 4],
    ['May', 5],
    ['June', 6],
    ['July', 7],
    ['August', 8],
  ];
  const base = round2(Number(contractAmount) || 0);
  const each = round2(base / months.length);
  let acc = 0;
  return months.map(([label, m], i) => {
    const amount = i === months.length - 1 ? round2(base - acc) : each;
    acc = round2(acc + amount);
    return {
      label: `${label} ${y}`,
      due_date: `${y}-${String(m).padStart(2, '0')}-01`,
      amount,
    };
  });
}
