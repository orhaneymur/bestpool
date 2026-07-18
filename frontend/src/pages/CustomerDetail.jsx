import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { downloadFile } from '../api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '../api/utils.js';

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);

  useEffect(() => { api.get(`/customers/${id}`).then((r) => setC(r.data)); }, [id]);
  if (!c) return <div className="card">Loading…</div>;

  const quotes = c.Quotes || [];

  return (
    <div>
      <div className="topbar">
        <h1>{c.name}</h1>
        <Link to={`/quotes/new?customer=${c.id}`}><button>+ Proposal for this customer</button></Link>
      </div>

      <div className="card">
        <div className="grid grid-3">
          <div><label>Account code</label><div>{c.code}</div></div>
          <div><label>Contact</label><div>{c.contact_person || '-'}</div></div>
          <div><label>Phone</label><div>{c.phone || '-'}</div></div>
          <div><label>Email</label><div>{c.email || '-'}</div></div>
          <div><label>Tax office / ID</label><div>{[c.tax_office, c.tax_no].filter(Boolean).join(' / ') || '-'}</div></div>
          <div><label>City</label><div>{c.city || '-'}</div></div>
          <div style={{ gridColumn: 'span 3' }}><label>Address</label><div>{c.address || '-'}</div></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Proposal history ({quotes.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Proposal #</th>
              <th>Facility</th>
              <th>Date</th>
              <th>Status</th>
              <th className="right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td><Link to={`/quotes/${q.id}`}>{q.quote_no}</Link></td>
                <td>{q.facility_name || '-'}</td>
                <td>{fmtDate(q.created_at)}</td>
                <td><span className={`badge ${q.status}`}>{statusLabel[q.status]}</span></td>
                <td className="right">{fmtMoney(q.total, q.currency)}</td>
                <td className="right">
                  <button className="ghost" onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}>PDF</button>
                  <button className="ghost" onClick={() => downloadFile(`/quotes/${q.id}/excel`, `${q.quote_no}.xlsx`)}>Excel</button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && <tr><td colSpan="6" className="muted">No proposals for this customer.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
