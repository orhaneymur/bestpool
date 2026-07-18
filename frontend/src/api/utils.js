export const fmtMoney = (n, cur = 'USD') => {
  const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
  const symbol = cur === 'TRY' ? '₺' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : `${cur} `;
  if (cur === 'USD' || cur === 'EUR' || cur === 'TRY') return `${symbol}${s}`;
  return `${s} ${cur}`;
};

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

export const statusLabel = {
  taslak: 'Draft',
  gonderildi: 'Sent',
  kabul: 'Accepted',
  red: 'Rejected',
};
