import { useEffect, useState } from 'react';
import api from '../api/client.js';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get('/settings').then((r) => setS(r.data)); }, []);
  if (!s) return <div className="card">Yükleniyor…</div>;

  async function save(e) {
    e.preventDefault();
    const { data } = await api.put('/settings', s);
    setS(data); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const f = (k) => ({ value: s[k] || '', onChange: (e) => setS({ ...s, [k]: e.target.value }) });

  return (
    <div>
      <div className="topbar"><h1>Ayarlar</h1></div>
      <form className="card" onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>Şirket Bilgileri (Teklif/sözleşme başlığında ve kapakta görünür)</h3>
        <div className="grid grid-2">
          <div style={{ gridColumn: 'span 2' }}><label>Şirket Adı</label><input {...f('company_name')} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>Kapak Sloganı (İngilizce, tırnaklı yazılır)</label><input {...f('company_tagline')} placeholder="Where Customer Service is a Policy, Not a Department" /></div>
          <div><label>Telefon</label><input {...f('company_phone')} /></div>
          <div><label>Faks</label><input {...f('company_fax')} /></div>
          <div><label>E-posta</label><input {...f('company_email')} /></div>
          <div><label>Web Sitesi</label><input {...f('company_website')} placeholder="www.ornek.com" /></div>
          <div><label>Vergi Dairesi</label><input {...f('tax_office')} /></div>
          <div><label>Vergi No</label><input {...f('tax_no')} /></div>
          <div style={{ gridColumn: 'span 2' }}><label>Adres</label><input {...f('company_address')} /></div>
          <div><label>Teklif No Öneki</label><input {...f('quote_prefix')} /></div>
          <div><label>Varsayılan KDV %</label><input type="number" value={s.default_vat_rate} onChange={(e) => setS({ ...s, default_vat_rate: e.target.value })} /></div>
          <div><label>PDF Revizyon Etiketi</label><input {...f('rev_label')} placeholder="Rev 06/2025" /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="submit">Kaydet</button>
          {saved && <span className="badge kabul">Kaydedildi ✓</span>}
        </div>
      </form>
    </div>
  );
}
