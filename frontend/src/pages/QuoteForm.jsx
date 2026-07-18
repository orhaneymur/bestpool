import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import api, { downloadFile } from '../api/client.js';
import { fmtMoney } from '../api/utils.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function computeTotals(items, discount_rate, discount_amount) {
  const lines = items.map((it) => ({ ...it, line_total: round2((it.quantity || 0) * (it.unit_price || 0)) }));
  const subtotal = round2(lines.reduce((s, l) => s + l.line_total, 0));
  let disc = Number(discount_amount || 0);
  if (Number(discount_rate) > 0) disc = round2((subtotal * Number(discount_rate)) / 100);
  const net = round2(subtotal - disc);
  const factor = subtotal > 0 ? net / subtotal : 1;
  const vat = round2(lines.reduce((s, l) => s + l.line_total * factor * (Number(l.vat_rate || 0) / 100), 0));
  return { subtotal, discount_amount: disc, vat_amount: vat, total: round2(net + vat) };
}

const emptyItem = () => ({ description: '', quantity: 1, unit: 'adet', unit_price: 0, vat_rate: 20, service_item_id: null });

export default function QuoteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const editing = !!id;

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [quoteNo, setQuoteNo] = useState('');
  const [err, setErr] = useState('');

  const [q, setQ] = useState({
    customer_id: sp.get('customer') || '',
    contract_template_id: '',
    facility_name: '', facility_address: '',
    season_start: '', season_end: '',
    lifeguard_count: 0, hours_per_week: 0,
    discount_rate: 0, discount_amount: 0,
    currency: 'TRY', status: 'taslak', valid_until: '', notes: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [installments, setInstallments] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/customers'), api.get('/services'), api.get('/templates'),
    ]).then(([c, s, t]) => {
      setCustomers(c.data); setServices(s.data); setTemplates(t.data);
      const def = t.data.find((x) => x.is_default);
      if (def && !editing) setQ((prev) => ({ ...prev, contract_template_id: def.id }));
    });
  }, []);

  useEffect(() => {
    if (!editing) return;
    api.get(`/quotes/${id}`).then((r) => {
      const d = r.data;
      setQuoteNo(d.quote_no);
      setQ({
        customer_id: d.customer_id, contract_template_id: d.contract_template_id || '',
        facility_name: d.facility_name || '', facility_address: d.facility_address || '',
        season_start: d.season_start || '', season_end: d.season_end || '',
        lifeguard_count: d.lifeguard_count || 0, hours_per_week: d.hours_per_week || 0,
        discount_rate: d.discount_rate || 0, discount_amount: d.discount_amount || 0,
        currency: d.currency || 'TRY', status: d.status, valid_until: d.valid_until || '', notes: d.notes || '',
      });
      setItems(d.items?.length ? d.items.map((it) => ({ ...it })) : [emptyItem()]);
      setInstallments(d.installments || []);
    });
  }, [id]);

  const totals = useMemo(() => computeTotals(items, q.discount_rate, q.discount_amount), [items, q.discount_rate, q.discount_amount]);

  function updateItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function pickService(i, serviceId) {
    const s = services.find((x) => String(x.id) === String(serviceId));
    if (!s) return updateItem(i, { service_item_id: null });
    updateItem(i, { service_item_id: s.id, description: s.name, unit: s.unit, unit_price: Number(s.default_unit_price), vat_rate: Number(s.vat_rate) });
  }

  function addLifeguardLine() {
    const weeks = weeksBetween(q.season_start, q.season_end);
    const lg = services.find((s) => s.category === 'cankurtaran');
    const rate = lg ? Number(lg.default_unit_price) : 350;
    const totalHours = Number(q.lifeguard_count || 0) * Number(q.hours_per_week || 0) * weeks;
    setItems((arr) => [...arr.filter((it) => it.description), {
      description: `Cankurtaran hizmeti (${q.lifeguard_count} kişi × ${q.hours_per_week} sa/hafta × ${weeks} hafta)`,
      quantity: totalHours, unit: 'saat', unit_price: rate, vat_rate: 20, service_item_id: lg?.id || null,
    }]);
  }

  function splitInstallments(n) {
    if (!n || n < 1) return;
    const each = round2(totals.total / n);
    const rows = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(totals.total - acc) : each;
      acc = round2(acc + amount);
      rows.push({ label: `${i + 1}. Taksit`, due_date: '', amount });
    }
    setInstallments(rows);
  }

  async function save(goBack = false) {
    setErr('');
    if (!q.customer_id) { setErr('Lütfen müşteri seçin.'); return; }
    setSaving(true);
    const payload = { ...q, items: items.filter((it) => it.description), installments };
    try {
      let res;
      if (editing) res = await api.put(`/quotes/${id}`, payload);
      else res = await api.post('/quotes', payload);
      setSavedId(res.data.id); setQuoteNo(res.data.quote_no);
      if (goBack) nav('/quotes');
      else if (!editing) nav(`/quotes/${res.data.id}`, { replace: true });
    } catch (e) {
      setErr(e.response?.data?.error || 'Kaydetme hatası.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="topbar">
        <h1>{editing ? `Teklif ${quoteNo}` : 'Yeni Teklif'}</h1>
        <div className="row">
          <Link to="/quotes"><button className="secondary">← Listeye Dön</button></Link>
          <button onClick={() => save(false)} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Müşteri & Tesis */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Müşteri & Tesis Bilgileri</h3>
        <div className="grid grid-3">
          <div>
            <label>Müşteri (Cari) *</label>
            <select value={q.customer_id} onChange={(e) => setQ({ ...q, customer_id: e.target.value })}>
              <option value="">— Seçin —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label>Tesis Adı</label><input value={q.facility_name} onChange={(e) => setQ({ ...q, facility_name: e.target.value })} /></div>
          <div><label>Tesis Adresi</label><input value={q.facility_address} onChange={(e) => setQ({ ...q, facility_address: e.target.value })} /></div>
          <div><label>Sezon Başlangıç</label><input type="date" value={q.season_start || ''} onChange={(e) => setQ({ ...q, season_start: e.target.value })} /></div>
          <div><label>Sezon Bitiş</label><input type="date" value={q.season_end || ''} onChange={(e) => setQ({ ...q, season_end: e.target.value })} /></div>
          <div><label>Teklif Geçerlilik</label><input type="date" value={q.valid_until || ''} onChange={(e) => setQ({ ...q, valid_until: e.target.value })} /></div>
          <div><label>Cankurtaran Sayısı</label><input type="number" value={q.lifeguard_count} onChange={(e) => setQ({ ...q, lifeguard_count: e.target.value })} /></div>
          <div><label>Haftalık Saat (kişi başı)</label><input type="number" value={q.hours_per_week} onChange={(e) => setQ({ ...q, hours_per_week: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="secondary" onClick={addLifeguardLine}>⚡ Cankurtaran kalemini otomatik ekle</button>
          </div>
        </div>
      </div>

      {/* Kalemler */}
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Hizmet Kalemleri</h3>
          <button type="button" className="secondary" onClick={() => setItems((a) => [...a, emptyItem()])}>+ Kalem Ekle</button>
        </div>
        <table>
          <thead><tr>
            <th style={{ width: 190 }}>Katalogdan</th><th>Açıklama</th><th style={{ width: 90 }}>Miktar</th>
            <th style={{ width: 80 }}>Birim</th><th style={{ width: 110 }}>Birim Fiyat</th><th style={{ width: 70 }}>KDV %</th>
            <th style={{ width: 120 }} className="right">Tutar</th><th></th>
          </tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="item-row">
                <td><select value={it.service_item_id || ''} onChange={(e) => pickService(i, e.target.value)}>
                  <option value="">— Manuel —</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></td>
                <td><input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Kalem açıklaması" /></td>
                <td><input type="number" step="0.01" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} /></td>
                <td><input value={it.unit} onChange={(e) => updateItem(i, { unit: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} /></td>
                <td><input type="number" step="0.01" value={it.vat_rate} onChange={(e) => updateItem(i, { vat_rate: Number(e.target.value) })} /></td>
                <td className="right">{fmtMoney(round2((it.quantity || 0) * (it.unit_price || 0)), q.currency)}</td>
                <td><button type="button" className="ghost danger" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals" style={{ marginTop: 14 }}>
          <div className="line"><span>Ara Toplam</span><b>{fmtMoney(totals.subtotal, q.currency)}</b></div>
          <div className="line">
            <span>İndirim %<input type="number" style={{ width: 60, display: 'inline-block', marginLeft: 6, padding: '3px 6px' }} value={q.discount_rate} onChange={(e) => setQ({ ...q, discount_rate: Number(e.target.value), discount_amount: 0 })} /></span>
            <b>- {fmtMoney(totals.discount_amount, q.currency)}</b>
          </div>
          <div className="line"><span>KDV</span><b>{fmtMoney(totals.vat_amount, q.currency)}</b></div>
          <div className="line grand"><span>GENEL TOPLAM</span><span>{fmtMoney(totals.total, q.currency)}</span></div>
        </div>
      </div>

      {/* Ödeme planı */}
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Ödeme Planı (Taksitler)</h3>
          <div className="row">
            {[2, 3, 4, 6, 12].map((n) => <button key={n} type="button" className="secondary" onClick={() => splitInstallments(n)}>{n} eşit taksit</button>)}
            <button type="button" className="secondary" onClick={() => setInstallments((a) => [...a, { label: `${a.length + 1}. Taksit`, due_date: '', amount: 0 }])}>+ Satır</button>
          </div>
        </div>
        {installments.length > 0 && (
          <table>
            <thead><tr><th>Taksit</th><th style={{ width: 160 }}>Vade</th><th style={{ width: 160 }}>Tutar</th><th></th></tr></thead>
            <tbody>
              {installments.map((inst, i) => (
                <tr key={i}>
                  <td><input value={inst.label} onChange={(e) => setInstallments((a) => a.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} /></td>
                  <td><input type="date" value={inst.due_date || ''} onChange={(e) => setInstallments((a) => a.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))} /></td>
                  <td><input type="number" step="0.01" value={inst.amount} onChange={(e) => setInstallments((a) => a.map((x, idx) => idx === i ? { ...x, amount: Number(e.target.value) } : x))} /></td>
                  <td><button type="button" className="ghost danger" onClick={() => setInstallments((a) => a.filter((_, idx) => idx !== i))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {installments.length > 0 && (
          <div className="muted" style={{ marginTop: 6 }}>Taksit toplamı: {fmtMoney(installments.reduce((s, x) => s + Number(x.amount || 0), 0), q.currency)} / Genel toplam: {fmtMoney(totals.total, q.currency)}</div>
        )}
      </div>

      {/* Sözleşme & durum */}
      <div className="card">
        <div className="grid grid-3">
          <div>
            <label>Sözleşme Şablonu</label>
            <select value={q.contract_template_id || ''} onChange={(e) => setQ({ ...q, contract_template_id: e.target.value })}>
              <option value="">— Yok —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label>Durum</label>
            <select value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })}>
              <option value="taslak">Taslak</option><option value="gonderildi">Gönderildi</option>
              <option value="kabul">Kabul</option><option value="red">Red</option>
            </select>
          </div>
          <div>
            <label>Para Birimi</label>
            <select value={q.currency} onChange={(e) => setQ({ ...q, currency: e.target.value })}>
              <option value="TRY">TRY (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div style={{ gridColumn: 'span 3' }}><label>Notlar</label><textarea rows="2" value={q.notes} onChange={(e) => setQ({ ...q, notes: e.target.value })} /></div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button onClick={() => save(false)} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
          <button className="secondary" onClick={() => save(true)} disabled={saving}>Kaydet & Kapat</button>
        </div>
        <div className="row">
          <button className="secondary" disabled={!savedId} onClick={() => downloadFile(`/quotes/${savedId}/pdf`, `${quoteNo}.pdf`)}>⬇ PDF İndir</button>
          <button className="secondary" disabled={!savedId} onClick={() => downloadFile(`/quotes/${savedId}/excel`, `${quoteNo}.xlsx`)}>⬇ Excel İndir</button>
        </div>
      </div>
      {!savedId && <p className="muted right">PDF/Excel indirmek için önce teklifi kaydedin.</p>}
    </div>
  );
}

function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}
