import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Plus, Sheet } from 'lucide-react';
import api, { downloadFile } from '@/api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

export default function Quotes() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');

  const load = () =>
    api.get('/quotes', { params: status ? { status } : {} }).then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, [status]);

  async function changeStatus(id, newStatus) {
    await api.patch(`/quotes/${id}/status`, { status: newStatus });
    load();
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Proposals" subtitle="Draft, send, and track commercial pool contracts">
        <Button asChild variant="accent" className="gap-2">
          <Link to="/quotes/new">
            <Plus className="h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm shadow-soft sm:max-w-[220px]"
        >
          <option value="">All statuses</option>
          <option value="taslak">Draft</option>
          <option value="gonderildi">Sent</option>
          <option value="kabul">Accepted</option>
          <option value="red">Rejected</option>
        </select>
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">
          {rows.length} proposal{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((q) => (
          <Card key={q.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/quotes/${q.id}`} className="text-base font-semibold text-foreground hover:text-accent">
                    {q.quote_no}
                  </Link>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {q.Customer?.name || '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtDate(q.created_at)}</div>
                </div>
                <Badge variant={q.status}>{statusLabel[q.status] || q.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                <div className="text-base font-semibold tabular-nums">{fmtMoney(q.total, q.currency)}</div>
                <select
                  value={q.status}
                  onChange={(e) => changeStatus(q.id, e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  {Object.entries(statusLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => downloadFile(`/quotes/${q.id}/excel`, `${q.quote_no}.xlsx`)}
                >
                  <Sheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button asChild size="sm" variant="accent" className="flex-1">
                  <Link to={`/quotes/${q.id}`}>Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">No proposals.</CardContent>
          </Card>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Proposal #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((q) => (
                <tr key={q.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/quotes/${q.id}`} className="font-semibold hover:text-accent">
                      {q.quote_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{q.Customer?.name || '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmtDate(q.created_at)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={q.status}
                      onChange={(e) => changeStatus(q.id, e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    >
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {fmtMoney(q.total, q.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}
                      >
                        PDF
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(`/quotes/${q.id}/excel`, `${q.quote_no}.xlsx`)}
                      >
                        Excel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No proposals.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
