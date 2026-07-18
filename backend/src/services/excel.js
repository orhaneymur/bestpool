import ExcelJS from 'exceljs';

const D = (d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '');

export async function buildQuoteExcel(quote, setting) {
  const wb = new ExcelJS.Workbook();
  wb.creator = setting.company_name || 'Havuz Teklif Sistemi';
  const ws = wb.addWorksheet('Teklif', { properties: { defaultColWidth: 16 } });

  const cur = quote.currency === 'TRY' ? '₺' : quote.currency;
  const money = '#,##0.00 "' + cur + '"';
  const BLUE = '0D47A1';

  ws.columns = [
    { width: 6 }, { width: 42 }, { width: 12 }, { width: 16 }, { width: 10 }, { width: 18 },
  ];

  // Başlık
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = setting.company_name || 'Şirket Adı';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: BLUE } };
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = [setting.company_address, setting.company_phone, setting.company_email].filter(Boolean).join('  •  ');
  ws.getCell('A2').font = { size: 9, color: { argb: '555555' } };

  ws.mergeCells('A4:F4');
  ws.getCell('A4').value = 'FİYAT TEKLİFİ';
  ws.getCell('A4').font = { bold: true, size: 13, color: { argb: BLUE } };

  ws.getCell('A5').value = 'Teklif No:'; ws.getCell('B5').value = quote.quote_no;
  ws.getCell('A6').value = 'Tarih:'; ws.getCell('B6').value = D(quote.created_at || new Date());
  ws.getCell('A7').value = 'Geçerlilik:'; ws.getCell('B7').value = D(quote.valid_until);
  ws.getCell('D5').value = 'Müşteri:'; ws.getCell('E5').value = quote.Customer?.name || '';
  ws.getCell('D6').value = 'Tesis:'; ws.getCell('E6').value = quote.facility_name || '';
  ws.getCell('D7').value = 'Sezon:'; ws.getCell('E7').value = `${D(quote.season_start)} - ${D(quote.season_end)}`;
  ['A5', 'A6', 'A7', 'D5', 'D6', 'D7'].forEach((c) => (ws.getCell(c).font = { bold: true }));

  // Kalem tablosu başlık
  const headRow = 9;
  const headers = ['#', 'Açıklama', 'Miktar', 'Birim Fiyat', 'KDV %', 'Tutar'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: i === 1 ? 'left' : 'center' };
  });

  let r = headRow + 1;
  (quote.items || []).forEach((it, i) => {
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = it.description;
    ws.getCell(r, 3).value = Number(it.quantity);
    ws.getCell(r, 4).value = Number(it.unit_price);
    ws.getCell(r, 4).numFmt = money;
    ws.getCell(r, 5).value = Number(it.vat_rate);
    ws.getCell(r, 6).value = Number(it.line_total);
    ws.getCell(r, 6).numFmt = money;
    r++;
  });

  // Toplamlar
  r += 1;
  const earlyBird = Number(quote.early_bird_discount || 0);
  const contractAmount = Number(quote.total || 0) - earlyBird;
  const totals = [
    ['Ara Toplam', quote.subtotal],
    ['İndirim', -Number(quote.discount_amount || 0)],
    ['KDV', quote.vat_amount],
    ['Genel Toplam', quote.total],
    ...(earlyBird > 0 ? [['Erken Rezervasyon İndirimi', -earlyBird]] : []),
    ['SÖZLEŞME BEDELİ', contractAmount],
  ];
  totals.forEach(([label, val], idx) => {
    ws.getCell(r, 5).value = label;
    ws.getCell(r, 6).value = Number(val);
    ws.getCell(r, 6).numFmt = money;
    if (idx === totals.length - 1) {
      ws.getCell(r, 5).font = { bold: true, color: { argb: 'FFFFFF' } };
      ws.getCell(r, 6).font = { bold: true, color: { argb: 'FFFFFF' } };
      ws.getCell(r, 5).fill = ws.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    } else {
      ws.getCell(r, 5).font = { bold: true };
    }
    r++;
  });

  // Ödeme planı
  if ((quote.installments || []).length) {
    r += 1;
    ws.getCell(r, 1).value = 'ÖDEME PLANI';
    ws.getCell(r, 1).font = { bold: true, color: { argb: BLUE } };
    r++;
    ['Taksit', 'Vade', 'Tutar'].forEach((h, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = h; c.font = { bold: true, color: { argb: 'FFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    });
    r++;
    (quote.installments || []).forEach((inst) => {
      ws.getCell(r, 1).value = inst.label;
      ws.getCell(r, 2).value = D(inst.due_date);
      ws.getCell(r, 3).value = Number(inst.amount);
      ws.getCell(r, 3).numFmt = money;
      r++;
    });
  }

  // Çalışma saatleri (haftalık program)
  const schedules = quote.schedules || [];
  if (schedules.length) {
    const DAY_TR = { pazartesi: 'Pazartesi', sali: 'Salı', carsamba: 'Çarşamba', persembe: 'Perşembe', cuma: 'Cuma', cumartesi: 'Cumartesi', pazar: 'Pazar', tatil: 'Resmi Tatil' };
    const DAY_ORDER = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar', 'tatil'];
    for (const [seasonKey, seasonLabel] of [['normal', 'Normal Sezon'], ['okul', 'Okul Dönemi / Sezon Dışı']]) {
      const rows = schedules.filter((s) => s.season_type === seasonKey)
        .sort((a, b) => DAY_ORDER.indexOf(a.day_label) - DAY_ORDER.indexOf(b.day_label));
      if (!rows.length) continue;
      r += 2;
      ws.getCell(r, 1).value = 'ÇALIŞMA SAATLERİ — ' + seasonLabel;
      ws.getCell(r, 1).font = { bold: true, color: { argb: BLUE } };
      r++;
      ['Gün', 'Açılış', 'Kapanış'].forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h; c.font = { bold: true, color: { argb: 'FFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
      });
      r++;
      rows.forEach((row) => {
        ws.getCell(r, 1).value = DAY_TR[row.day_label] || row.day_label;
        ws.getCell(r, 2).value = row.is_closed ? 'Kapalı' : (row.open_time || '-');
        ws.getCell(r, 3).value = row.is_closed ? '—' : (row.close_time || '-');
        r++;
      });
    }
  }

  // Özel şartlar / ek açıklamalar
  const notes = (quote.special_notes || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (notes.length) {
    r += 2;
    ws.getCell(r, 1).value = 'ÖZEL ŞARTLAR / EK AÇIKLAMALAR';
    ws.getCell(r, 1).font = { bold: true, color: { argb: BLUE } };
    r++;
    notes.forEach((n) => {
      ws.getCell(r, 1).value = [n.label ? n.label + '.' : '', n.body].filter(Boolean).join(' ');
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).alignment = { wrapText: true };
      r++;
    });
  }

  if (quote.notes) {
    r += 1;
    ws.getCell(r, 1).value = 'Dahili Not: ' + quote.notes;
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).alignment = { wrapText: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
