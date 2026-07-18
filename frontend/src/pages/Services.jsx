import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { fmtMoney } from '../api/utils.js';

const EMPTY = { code: '', name: '', category: 'bakim', unit: 'ay', default_unit_price: 0, vat_rate: 20, is_active: true };
const CATS = ['bakim', 'cankurtaran', 'kimyasal', 'ruhsat', 'kis_bakim', 'ekipman', 'diger'];
const UNITS = ['adet', 'saat', 'hafta', 'ay', 'sezon'];

export default function Services() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => api.get('/services').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (form.id) await api.put(`/services/${form.id}`, form);
    else await api.post('/services', form);
    setForm(null); load();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Hizmet Kataloğu</h1>
        <button onClick={() => setForm({ ...EMPTY })}>+ Yeni Hizmet</button>
      </div>
      <p className="muted">Buradaki birim fiyatlar teklif oluştururken varsayılan olarak gelir; teklifte tekil olarak değiştirilebilir.</p>

      {form && (
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{form.id ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</h3>
          <div className="grid grid-3">
            <div><label>Kod</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Hizmet Adı *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Kategori</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label>Birim</label><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div><label>Birim Fiyat (₺)</label><input type="number" step="0.01" value={form.default_unit_price} onChange={(e) => setForm({ ...form, default_unit_price: e.target.value })} /></div>
            <div><label>KDV %</label><input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Kaydet</button>
            <button type="button" className="secondary" onClick={() => setForm(null)}>Vazgeç</button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Kod</th><th>Hizmet</th><th>Kategori</th><th>Birim</th><th className="right">Birim Fiyat</th><th className="right">KDV</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.code}</td><td>{s.name}</td><td><span className="pill">{s.category}</span></td><td>{s.unit}</td>
                <td className="right">{fmtMoney(s.default_unit_price)}</td><td className="right">%{s.vat_rate}</td>
                <td className="right"><button className="ghost" onClick={() => setForm(s)}>Düzenle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
