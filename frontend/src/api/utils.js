export const fmtMoney = (n, cur = 'TRY') => {
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
  return s + ' ' + (cur === 'TRY' ? '₺' : cur);
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '-');
export const statusLabel = { taslak: 'Taslak', gonderildi: 'Gönderildi', kabul: 'Kabul', red: 'Red' };
