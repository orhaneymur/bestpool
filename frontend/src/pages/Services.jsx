import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { fmtMoney } from '../api/utils.js';

const EMPTY = { code: '', name: '', category: 'maintenance', unit: 'month', default_unit_price: 0, vat_rate: 0, is_active: true };
const CATS = ['maintenance', 'lifeguard', 'chemical', 'permit', 'winterization', 'equipment', 'other'];
const UNITS = ['unit', 'hour', 'week', 'month', 'season'];

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
        <h1>Service Catalog</h1>
        <button onClick={() => setForm({ ...EMPTY })}>+ New Service</button>
      </div>
      <p className="muted">Default unit prices populate when creating a proposal; they can be overridden per line.</p>

      {form && (
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit Service' : 'New Service'}</h3>
          <div className="grid grid-3">
            <div><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Service name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label>Unit</label><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div><label>Unit price</label><input type="number" step="0.01" value={form.default_unit_price} onChange={(e) => setForm({ ...form, default_unit_price: e.target.value })} /></div>
            <div><label>Tax %</label><input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Service</th>
              <th>Category</th>
              <th>Unit</th>
              <th className="right">Unit price</th>
              <th className="right">Tax</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.code}</td>
                <td>{s.name}</td>
                <td><span className="pill">{s.category}</span></td>
                <td>{s.unit}</td>
                <td className="right">{fmtMoney(s.default_unit_price)}</td>
                <td className="right">{s.vat_rate}%</td>
                <td className="right"><button className="ghost" onClick={() => setForm(s)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
