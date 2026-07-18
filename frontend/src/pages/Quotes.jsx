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
        <h1>Proposals</h1>
        <Link to="/quotes/new"><button>+ New Proposal</button></Link>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All statuses</option>
          <option value="taslak">Draft</option>
          <option value="gonderildi">Sent</option>
          <option value="kabul">Accepted</option>
          <option value="red">Rejected</option>
        </select>
        <span className="pill">{rows.length} proposal{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Proposal #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Status</th>
              <th className="right">Amount</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
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
            {rows.length === 0 && <tr><td colSpan="6" className="muted">No proposals.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
