import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

const EMPTY = { code: '', name: '', contact_person: '', phone: '', email: '', city: '', address: '', tax_office: '', tax_no: '', notes: '' };

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);

  const load = () => api.get('/customers', { params: { q } }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [q]);

  async function save(e) {
    e.preventDefault();
    if (form.id) await api.put(`/customers/${form.id}`, form);
    else await api.post('/customers', form);
    setForm(null); load();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Müşteriler (Cari)</h1>
        <button onClick={() => setForm({ ...EMPTY })}>+ Yeni Müşteri</button>
      </div>

      <div className="toolbar">
        <input placeholder="Ara: ad, kod, telefon, vergi no…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340 }} />
        <span className="pill">{rows.length} kayıt</span>
      </div>

      {form && (
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{form.id ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h3>
          <div className="grid grid-3">
            <div><label>Cari Kodu</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Otomatik" /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Müşteri / Tesis Adı *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Yetkili Kişi</label><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><label>Telefon</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>E-posta</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Şehir</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><label>Vergi Dairesi</label><input value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} /></div>
            <div><label>Vergi / TC No</label><input value={form.tax_no} onChange={(e) => setForm({ ...form, tax_no: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 3' }}><label>Adres</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 3' }}><label>Notlar</label><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Kaydet</button>
            <button type="button" className="secondary" onClick={() => setForm(null)}>Vazgeç</button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Kod</th><th>Müşteri</th><th>Yetkili</th><th>Telefon</th><th>Şehir</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                <td>{c.contact_person || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.city || '-'}</td>
                <td className="right"><button className="ghost" onClick={() => setForm(c)}>Düzenle</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="muted">Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
