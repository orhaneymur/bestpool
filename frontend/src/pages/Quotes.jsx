import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { downloadFile } from '../api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '../api/utils.js';

export default function Quotes() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');

  const load = () => api.get('/quotes', { params: status ? { status } : {} }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [status]);

  async function changeStatus(id, newStatus) {
    await api.patch(`/quotes/${id}/status`, { status: newStatus });
    load();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Teklifler</h1>
        <Link to="/quotes/new"><button>+ Yeni Teklif</button></Link>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Tüm durumlar</option>
          <option value="taslak">Taslak</option>
          <option value="gonderildi">Gönderildi</option>
          <option value="kabul">Kabul</option>
          <option value="red">Red</option>
        </select>
        <span className="pill">{rows.length} teklif</span>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Teklif No</th><th>Müşteri</th><th>Tarih</th><th>Durum</th><th className="right">Tutar</th><th className="right">İşlemler</th></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td><Link to={`/quotes/${q.id}`}>{q.quote_no}</Link></td>
                <td>{q.Customer?.name || '-'}</td>
                <td>{fmtDate(q.created_at)}</td>
                <td>
                  <select value={q.status} onChange={(e) => changeStatus(q.id, e.target.value)} style={{ width: 130, padding: '4px 8px' }}>
                    {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="right">{fmtMoney(q.total, q.currency)}</td>
                <td className="right">
                  <button className="ghost" onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}>PDF</button>
                  <button className="ghost" onClick={() => downloadFile(`/quotes/${q.id}/excel`, `${q.quote_no}.xlsx`)}>Excel</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="muted">Teklif yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
