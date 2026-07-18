import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function Templates() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => api.get('/templates').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (form.id) await api.put(`/templates/${form.id}`, form);
    else await api.post('/templates', form);
    setForm(null); load();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Sözleşme Şablonları</h1>
        <button onClick={() => setForm({ name: '', body: '', is_default: false })}>+ Yeni Şablon</button>
      </div>
      <p className="muted">Sabit sözleşme/teklif metni. Teklife eklenince PDF'in sonuna sözleşme şartları olarak basılır.</p>

      {form && (
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{form.id ? 'Şablon Düzenle' : 'Yeni Şablon'}</h3>
          <div className="field"><label>Şablon Adı *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Metin (maddeler)</label><textarea rows="16" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 13 }} /></div>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Varsayılan şablon</label>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Kaydet</button>
            <button type="button" className="secondary" onClick={() => setForm(null)}>Vazgeç</button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Şablon</th><th>Varsayılan</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.is_default ? <span className="badge kabul">Varsayılan</span> : ''}</td>
                <td className="right"><button className="ghost" onClick={() => setForm(t)}>Düzenle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
