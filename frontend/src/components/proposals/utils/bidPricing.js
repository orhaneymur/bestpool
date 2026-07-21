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
  /** Drain/cleaning: $2,000 base, or $1,000 per guard */
  drainPerGuard: 1000,
  drainBase: 2000,
  /** Winterization: $2,000 base, or $1,000 per guard */
  winterPerGuard: 1000,
  winterBase: 2000,
};

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

export function drainCleaningForGuards(lifeguardCount) {
  const n = Math.max(1, Number(lifeguardCount || 0));
  return Math.max(BID_RATES.drainBase, n * BID_RATES.drainPerGuard);
}

export function winterizationForGuards(lifeguardCount) {
  const n = Math.max(1, Number(lifeguardCount || 0));
  return Math.max(BID_RATES.winterBase, n * BID_RATES.winterPerGuard);
}

/**
 * @param {{ county, lifeguardCount, hoursPerWeek, peakWeeks }} input
 */
export function computeBidSummary({
  county,
  lifeguardCount = 0,
  hoursPerWeek = 0,
  peakWeeks = 0,
} = {}) {
  const countyRow = getCountyWage(county);
  const hourlyWage = countyRow?.hourly || 0;
  const guards = Number(lifeguardCount || 0);
  const weeklyPeakStaffHours = round2(guards * Number(hoursPerWeek || 0));
  const totalLifeguardHours = round2(weeklyPeakStaffHours * Number(peakWeeks || 0));
  const totalWages = round2(totalLifeguardHours * hourlyWage);

  const management = BID_RATES.management;
  const drainCleaning = drainCleaningForGuards(guards);
  const chemicals = chemicalsForGuards(guards);
  const commission = BID_RATES.commission;
  const insurance = BID_RATES.insurance;
  const winterization = winterizationForGuards(guards);

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
    hourlyWage,
    weeklyPeakStaffHours,
    totalLifeguardHours,
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
  };
}

/** Build quote line items from bid summary (for PDF / totals). */
export function buildBidLineItems(bid) {
  if (!bid || !bid.hourlyWage) return [];
  const lines = [];
  if (bid.totalLifeguardHours > 0) {
    lines.push({
      description: `Lifeguard wages — ${bid.countyLabel} ($${bid.hourlyWage}/hr × ${bid.totalLifeguardHours} hrs)`,
      quantity: bid.totalLifeguardHours,
      unit: 'hour',
      unit_price: bid.hourlyWage,
      vat_rate: 0,
      service_item_id: null,
    });
  }
  const fixed = [
    ['Management', bid.expenses.management],
    ['Drain and cleaning', bid.expenses.drainCleaning],
    ['Chemicals', bid.expenses.chemicals],
    ['Commission', bid.expenses.commission],
    ['Insurance', bid.expenses.insurance],
    ['Winterization', bid.expenses.winterization],
    [`Overhead (${BID_RATES.overheadPct}%)`, bid.overhead],
    [`Profit (${BID_RATES.profitPct}%)`, bid.profit],
    [`Sales tax (${BID_RATES.salesTaxPct}%)`, bid.salesTax],
  ];
  for (const [description, amount] of fixed) {
    if (!amount) continue;
    lines.push({
      description,
      quantity: 1,
      unit: 'season',
      unit_price: amount,
      vat_rate: 0,
      service_item_id: null,
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
