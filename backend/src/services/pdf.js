import PdfPrinter from 'pdfmake';

/**
 * pdfmake ile Türkçe karakter destekli teklif PDF'i üretir.
 * Roboto fontu pdfmake ile birlikte gelir ve Türkçe karakterleri (ş, ğ, İ, ı, ö, ü, ç) destekler.
 */
// pdfmake standart fontlarını gömülü vfs üzerinden yükle
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function getPrinter() {
  // vfs_fonts, Roboto ttf'lerini base64 olarak içerir (pdfmake ile birlikte gelir).
  const vfs = require('pdfmake/build/vfs_fonts.js');
  const vfsData = vfs?.pdfMake?.vfs || vfs?.vfs || vfs?.default?.pdfMake?.vfs || vfs;
  if (!vfsData || !vfsData['Roboto-Regular.ttf']) {
    throw new Error('pdfmake font (vfs_fonts) yüklenemedi. "npm install pdfmake" kurulu olmalı.');
  }
  const printer = new PdfPrinter({
    Roboto: {
      normal: Buffer.from(vfsData['Roboto-Regular.ttf'], 'base64'),
      bold: Buffer.from(vfsData['Roboto-Medium.ttf'], 'base64'),
      italics: Buffer.from(vfsData['Roboto-Italic.ttf'], 'base64'),
      bolditalics: Buffer.from(vfsData['Roboto-MediumItalic.ttf'], 'base64'),
    },
  });
  return printer;
}

const TRY = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const D = (d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '-');

export function buildQuotePdf(quote, setting) {
  const printer = getPrinter();
  const cur = quote.currency === 'TRY' ? '₺' : quote.currency;

  const itemRows = (quote.items || []).map((it, i) => ([
    { text: String(i + 1), alignment: 'center' },
    { text: it.description },
    { text: TRY(it.quantity) + ' ' + (it.unit || ''), alignment: 'right' },
    { text: TRY(it.unit_price) + ' ' + cur, alignment: 'right' },
    { text: '%' + TRY(it.vat_rate), alignment: 'right' },
    { text: TRY(it.line_total) + ' ' + cur, alignment: 'right' },
  ]));

  const installmentRows = (quote.installments || []).map((inst) => ([
    { text: inst.label || '-' },
    { text: D(inst.due_date), alignment: 'center' },
    { text: TRY(inst.amount) + ' ' + cur, alignment: 'right' },
  ]));

  const templateBody = quote.template?.body
    ? quote.template.body.split('\n').filter((l) => l.trim()).map((l) => ({ text: l, margin: [0, 0, 0, 3], fontSize: 8, color: '#444' }))
    : [];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    footer: (currentPage, pageCount) => ({
      text: `${setting.company_name || ''}  •  Sayfa ${currentPage}/${pageCount}`,
      alignment: 'center', fontSize: 7, color: '#999', margin: [0, 10, 0, 0],
    }),
    content: [
      // Başlık
      {
        columns: [
          [
            { text: setting.company_name || 'Şirket Adı', bold: true, fontSize: 13, color: '#0d47a1' },
            { text: setting.company_address || '', fontSize: 8, color: '#555' },
            { text: [setting.company_phone, setting.company_email].filter(Boolean).join('  •  '), fontSize: 8, color: '#555' },
          ],
          [
            { text: 'FİYAT TEKLİFİ', bold: true, fontSize: 15, alignment: 'right', color: '#0d47a1' },
            { text: 'Teklif No: ' + (quote.quote_no || '-'), alignment: 'right', fontSize: 9 },
            { text: 'Tarih: ' + D(quote.created_at || new Date()), alignment: 'right', fontSize: 9 },
            { text: 'Geçerlilik: ' + D(quote.valid_until), alignment: 'right', fontSize: 9 },
          ],
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1, lineColor: '#0d47a1' }], margin: [0, 4, 0, 10] },

      // Müşteri & tesis bilgisi
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'MÜŞTERİ', bold: true, fontSize: 8, color: '#0d47a1', margin: [0, 0, 0, 2] },
              { text: quote.Customer?.name || '-', bold: true },
              { text: quote.Customer?.address || '', fontSize: 8, color: '#555' },
              { text: [quote.Customer?.phone, quote.Customer?.email].filter(Boolean).join('  •  '), fontSize: 8, color: '#555' },
              quote.Customer?.tax_no ? { text: 'VKN/TCKN: ' + quote.Customer.tax_no, fontSize: 8, color: '#555' } : {},
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'TESİS / SEZON', bold: true, fontSize: 8, color: '#0d47a1', margin: [0, 0, 0, 2] },
              { text: quote.facility_name || '-', bold: true },
              { text: quote.facility_address || '', fontSize: 8, color: '#555' },
              { text: `Sezon: ${D(quote.season_start)} - ${D(quote.season_end)}`, fontSize: 8, color: '#555' },
              (quote.lifeguard_count ? { text: `Cankurtaran: ${quote.lifeguard_count} kişi • ${quote.hours_per_week} sa/hafta`, fontSize: 8, color: '#555' } : {}),
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // Kalemler tablosu
      {
        table: {
          headerRows: 1,
          widths: [18, '*', 55, 65, 35, 70],
          body: [
            [
              { text: '#', style: 'th', alignment: 'center' },
              { text: 'Açıklama', style: 'th' },
              { text: 'Miktar', style: 'th', alignment: 'right' },
              { text: 'Birim Fiyat', style: 'th', alignment: 'right' },
              { text: 'KDV', style: 'th', alignment: 'right' },
              { text: 'Tutar', style: 'th', alignment: 'right' },
            ],
            ...(itemRows.length ? itemRows : [[{ text: 'Kalem yok', colSpan: 6, alignment: 'center', color: '#999' }, {}, {}, {}, {}, {}]]),
          ],
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#0d47a1' : rowIndex % 2 === 0 ? '#f4f7fb' : null),
          hLineColor: '#dde3ec', vLineColor: '#dde3ec',
        },
      },

      // Toplamlar
      {
        columns: [
          { width: '*', text: quote.notes ? [{ text: 'Notlar:\n', bold: true, fontSize: 8 }, { text: quote.notes, fontSize: 8, color: '#555' }] : '' },
          {
            width: 220,
            table: {
              widths: ['*', 90],
              body: [
                [{ text: 'Ara Toplam', alignment: 'right' }, { text: TRY(quote.subtotal) + ' ' + cur, alignment: 'right' }],
                [{ text: `İndirim ${Number(quote.discount_rate) > 0 ? '(%' + TRY(quote.discount_rate) + ')' : ''}`, alignment: 'right' }, { text: '-' + TRY(quote.discount_amount) + ' ' + cur, alignment: 'right' }],
                [{ text: 'KDV', alignment: 'right' }, { text: TRY(quote.vat_amount) + ' ' + cur, alignment: 'right' }],
                [{ text: 'GENEL TOPLAM', bold: true, alignment: 'right', fillColor: '#0d47a1', color: 'white' }, { text: TRY(quote.total) + ' ' + cur, bold: true, alignment: 'right', fillColor: '#0d47a1', color: 'white' }],
              ],
            },
            layout: { hLineColor: '#dde3ec', vLineColor: '#dde3ec' },
          },
        ],
        margin: [0, 10, 0, 10],
      },

      // Ödeme planı
      ...(installmentRows.length ? [
        { text: 'ÖDEME PLANI', bold: true, fontSize: 9, color: '#0d47a1', margin: [0, 6, 0, 4] },
        {
          table: {
            headerRows: 1, widths: ['*', 90, 100],
            body: [
              [{ text: 'Taksit', style: 'th' }, { text: 'Vade', style: 'th', alignment: 'center' }, { text: 'Tutar', style: 'th', alignment: 'right' }],
              ...installmentRows,
            ],
          },
          layout: { fillColor: (r) => (r === 0 ? '#0d47a1' : null), hLineColor: '#dde3ec', vLineColor: '#dde3ec' },
        },
      ] : []),

      // Sözleşme metni
      ...(templateBody.length ? [
        { text: '', pageBreak: 'before' },
        { text: quote.template?.name || 'SÖZLEŞME ŞARTLARI', bold: true, fontSize: 11, color: '#0d47a1', margin: [0, 0, 0, 8] },
        ...templateBody,
      ] : []),

      // İmza
      {
        columns: [
          { width: '50%', stack: [{ text: '\n\nYÜKLENİCİ', bold: true, fontSize: 8 }, { text: setting.company_name || '', fontSize: 8 }, { text: '\nİmza / Kaşe: ______________________', fontSize: 8 }] },
          { width: '50%', stack: [{ text: '\n\nMÜŞTERİ', bold: true, fontSize: 8 }, { text: quote.Customer?.name || '', fontSize: 8 }, { text: '\nİmza / Kaşe: ______________________', fontSize: 8 }] },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      th: { bold: true, color: 'white', fontSize: 8, margin: [0, 3, 0, 3] },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) { reject(e); }
  });
}
