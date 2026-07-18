export const DAYS = [
  ['pazartesi', 'Monday'],
  ['sali', 'Tuesday'],
  ['carsamba', 'Wednesday'],
  ['persembe', 'Thursday'],
  ['cuma', 'Friday'],
  ['cumartesi', 'Saturday'],
  ['pazar', 'Sunday'],
  ['tatil', 'Holiday'],
];

export const SEASONS = [
  ['normal', 'Normal Season'],
  ['okul', 'School / Off Season'],
];

export const AYLAR = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function buildDefaultSchedules() {
  const rows = [];
  for (const [season] of SEASONS) {
    DAYS.forEach(([day], i) => {
      rows.push({
        season_type: season,
        day_label: day,
        open_time: day === 'tatil' ? '' : '09:00',
        close_time: day === 'tatil' ? '' : '19:00',
        is_closed: day === 'tatil',
        sort_order: i,
      });
    });
  }
  return rows;
}

export function computeTotals(items, discount_rate, discount_amount) {
  const lines = (items || []).map((it) => ({
    ...it,
    line_total: round2((it.quantity || 0) * (it.unit_price || 0)),
  }));
  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));
  let disc = Number(discount_amount || 0);
  if (Number(discount_rate) > 0) disc = round2((subtotal * Number(discount_rate)) / 100);
  const net = round2(subtotal - disc);
  const factor = subtotal > 0 ? net / subtotal : 1;
  const vat = round2(
    lines.reduce((s, l) => s + l.line_total * factor * (Number(l.vat_rate || 0) / 100), 0)
  );
  return { lines, subtotal, discount_amount: disc, vat_amount: vat, total: round2(net + vat) };
}

export function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}

export function emptyItem() {
  return {
    description: '',
    quantity: 1,
    unit: 'unit',
    unit_price: 0,
    vat_rate: 0,
    service_item_id: null,
  };
}

export function customerInitials(name = '') {
  return name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export function formatTime12(t) {
  if (!t) return '—';
  const [hh, mm] = String(t).split(':').map(Number);
  if (Number.isNaN(hh)) return t;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${String(h12).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')} ${ampm}`;
}
