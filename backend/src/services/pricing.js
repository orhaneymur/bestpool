/**
 * Shared bid / totals helpers (backend).
 * Mirrors frontend bidPricing.js for server-side validation when needed.
 */

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {Array} items  [{quantity, unit_price, vat_rate}]
 * @param {Object} opts  { discount_rate, discount_amount }
 */
export function computeTotals(items = [], opts = {}) {
  const lines = items.map((it) => {
    const qty = Number(it.quantity || 0);
    const price = Number(it.unit_price || 0);
    const line_total = round2(qty * price);
    return { ...it, line_total, vat_rate: Number(it.vat_rate ?? 0) };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));

  let discount_amount = Number(opts.discount_amount || 0);
  const discount_rate = Number(opts.discount_rate || 0);
  if (discount_rate > 0) {
    discount_amount = round2((subtotal * discount_rate) / 100);
  }
  const netAfterDiscount = round2(subtotal - discount_amount);

  const discountFactor = subtotal > 0 ? netAfterDiscount / subtotal : 1;
  const vat_amount = round2(
    lines.reduce((s, l) => s + (l.line_total * discountFactor * (l.vat_rate / 100)), 0)
  );

  const total = round2(netAfterDiscount + vat_amount);

  return { lines, subtotal, discount_rate, discount_amount, vat_amount, total };
}

export const COUNTY_WAGES = {
  montgomery: 20,
  frederick: 25,
  prince_georges: 20,
  howard: 20,
  anne_arundel: 20,
  baltimore: 20,
  annapolis: 25,
  queen_annes: 27,
};

export function chemicalsForGuards(n) {
  const g = Number(n || 0);
  if (g <= 1) return 5000;
  if (g <= 3) return 7500;
  return 10500;
}

/** Bid Summary: "$2,000 (1guard1000)" — flat $2,000, single-guard pool $1,000. */
export function drainCleaningForGuards(n) {
  return Math.max(1, Number(n || 0)) <= 1 ? 1000 : 2000;
}

export function winterizationForGuards(n) {
  return Math.max(1, Number(n || 0)) <= 1 ? 1000 : 2000;
}

export function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}
