/**
 * Fiyat hesaplama motoru.
 * Kalemlerden (quote_items) ara toplam, indirim, KDV ve genel toplamı hesaplar.
 * Otomatik hesaplama + manuel düzeltmeye izin verir:
 *  - Kalem satırları otomatik çarpılır (miktar × birim fiyat)
 *  - İndirim oranı veya sabit indirim tutarı uygulanabilir
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
    return { ...it, line_total, vat_rate: Number(it.vat_rate ?? 20) };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));

  let discount_amount = Number(opts.discount_amount || 0);
  const discount_rate = Number(opts.discount_rate || 0);
  if (discount_rate > 0) {
    discount_amount = round2((subtotal * discount_rate) / 100);
  }
  const netAfterDiscount = round2(subtotal - discount_amount);

  // KDV, indirim oranı kadar orantılı düşülerek her kalem için hesaplanır
  const discountFactor = subtotal > 0 ? netAfterDiscount / subtotal : 1;
  const vat_amount = round2(
    lines.reduce((s, l) => s + (l.line_total * discountFactor * (l.vat_rate / 100)), 0)
  );

  const total = round2(netAfterDiscount + vat_amount);

  return { lines, subtotal, discount_rate, discount_amount, vat_amount, total };
}

/**
 * Cankurtaran hizmeti için otomatik kalem üreticisi (yardımcı).
 * Toplam saat = cankurtaran sayısı × haftalık saat × hafta sayısı
 */
export function buildLifeguardLine({ lifeguardCount, hoursPerWeek, weeks, hourlyRate, vat_rate = 20 }) {
  const totalHours = Number(lifeguardCount || 0) * Number(hoursPerWeek || 0) * Number(weeks || 0);
  return {
    description: `Cankurtaran hizmeti (${lifeguardCount} kişi × ${hoursPerWeek} sa/hafta × ${weeks} hafta)`,
    quantity: totalHours,
    unit: 'saat',
    unit_price: Number(hourlyRate || 0),
    vat_rate,
    line_total: round2(totalHours * Number(hourlyRate || 0)),
  };
}

export function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}
