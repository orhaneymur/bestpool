import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get('/settings').then((r) => setS(r.data)); }, []);
  if (!s) return <div className="card">Loading…</div>;

  async function save(e) {
    e.preventDefault();
    const { data } = await api.put('/settings', s);
    setS(data); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const f = (k) => ({ value: s[k] || '', onChange: (e) => setS({ ...s, [k]: e.target.value }) });

  return (
    <div>
      <div className="topbar"><h1>Settings</h1></div>
      <form className="card" onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>Company profile (shown on proposal cover & header)</h3>
        <div className="grid grid-2">
          <div style={{ gridColumn: 'span 2' }}><label>Company name</label><input {...f('company_name')} /></div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>Cover tagline</label>
            <input {...f('company_tagline')} placeholder="Where Customer Service is a Policy, Not a Department" />
          </div>
          <div><label>Phone</label><input {...f('company_phone')} /></div>
          <div><label>Fax</label><input {...f('company_fax')} /></div>
          <div><label>Email</label><input {...f('company_email')} /></div>
          <div><label>Website</label><input {...f('company_website')} placeholder="www.example.com" /></div>
          <div><label>Tax office</label><input {...f('tax_office')} /></div>
          <div><label>Tax ID</label><input {...f('tax_no')} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>Address</label><input {...f('company_address')} /></div>
          <div><label>Proposal # prefix</label><input {...f('quote_prefix')} /></div>
          <div>
            <label>Default tax %</label>
            <input type="number" value={s.default_vat_rate} onChange={(e) => setS({ ...s, default_vat_rate: e.target.value })} />
          </div>
          <div><label>PDF revision label</label><input {...f('rev_label')} placeholder="Rev 06/2025" /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="submit">Save</button>
          {saved && <span className="badge kabul">Saved ✓</span>}
        </div>
      </form>
    </div>
  );
}
