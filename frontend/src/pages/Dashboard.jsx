import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '../api/utils.js';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/stats/summary').then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="card">Yükleniyor…</div>;

  return (
    <div>
      <div className="topbar">
        <h1>Panel</h1>
        <Link to="/quotes/new"><button>+ Yeni Teklif</button></Link>
      </div>

      <div className="grid grid-4">
        <div className="stat"><div className="num">{data.customerCount}</div><div className="lbl">Toplam Müşteri</div></div>
        <div className="stat"><div className="num">{data.quoteCount}</div><div className="lbl">Toplam Teklif</div></div>
        <div className="stat"><div className="num">{data.byStatus.kabul}</div><div className="lbl">Kabul Edilen</div></div>
        <div className="stat"><div className="num">{fmtMoney(data.totalAccepted)}</div><div className="lbl">Kabul Edilen Tutar</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Teklif Durumları</h3>
        <div className="row" style={{ gap: 20 }}>
          {Object.entries(data.byStatus).map(([k, v]) => (
            <div key={k}><span className={`badge ${k}`}>{statusLabel[k]}</span> <b>{v}</b></div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Son Teklifler</h3>
        <table>
          <thead><tr><th>Teklif No</th><th>Müşteri</th><th>Tarih</th><th>Durum</th><th className="right">Tutar</th></tr></thead>
          <tbody>
            {data.recent.map((q) => (
              <tr key={q.id}>
                <td><Link to={`/quotes/${q.id}`}>{q.quote_no}</Link></td>
                <td>{q.Customer?.name || '-'}</td>
                <td>{fmtDate(q.created_at)}</td>
                <td><span className={`badge ${q.status}`}>{statusLabel[q.status]}</span></td>
                <td className="right">{fmtMoney(q.total, q.currency)}</td>
              </tr>
            ))}
            {data.recent.length === 0 && <tr><td colSpan="5" className="muted">Henüz teklif yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
