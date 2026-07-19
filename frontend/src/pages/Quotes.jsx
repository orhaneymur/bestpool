import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, FileDown, Plus, Search, Sheet } from 'lucide-react';
import api, { downloadFile } from '@/api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';

const STATUSES = [
  { key: '', label: 'All' },
  { key: 'taslak', label: 'Draft' },
  { key: 'gonderildi', label: 'Sent' },
  { key: 'kabul', label: 'Accepted' },
  { key: 'red', label: 'Rejected' },
];

export default function Quotes() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2].map(String);
  }, []);

  const load = () =>
    api
      .get('/quotes', {
        params: {
          ...(status ? { status } : {}),
          ...(year ? { year } : {}),
          ...(q.trim() ? { q: q.trim() } : {}),
        },
      })
      .then((r) => setRows(r.data));

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [status, year, q]);

  async function changeStatus(id, newStatus) {
    await api.patch(`/quotes/${id}/status`, { status: newStatus });
    load();
  }

  async function duplicate(id) {
    setBusyId(id);
    try {
      const { data } = await api.post(`/quotes/${id}/duplicate`);
      nav(`/quotes/${data.id}`);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { taslak: 0, gonderildi: 0, kabul: 0, red: 0 };
    rows.forEach((r) => {
      if (c[r.status] != null) c[r.status] += 1;
    });
    return c;
  }, [rows]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Proposals"
        subtitle="Build seasonal contracts, track status, and duplicate last year’s bids"
      >
        <Button asChild variant="accent" className="gap-2">
          <Link to="/quotes/new">
            <Plus className="h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUSES.filter((s) => s.key).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatus((cur) => (cur === s.key ? '' : s.key))}
            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
              status === s.key
                ? 'border-accent/40 bg-accent/10'
                : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{counts[s.key] || 0}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Search proposal #, facility, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-soft sm:w-36"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              Season {y}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm shadow-soft sm:w-40"
        >
          {STATUSES.map((s) => (
            <option key={s.key || 'all'} value={s.key}>
              {s.label === 'All' ? 'All statuses' : s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((quote) => (
          <Card key={quote.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/quotes/${quote.id}`} className="text-base font-semibold hover:text-accent">
                    {quote.quote_no}
                  </Link>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {quote.facility_name || quote.Customer?.name || '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtDate(quote.created_at)}</div>
                </div>
                <Badge variant={quote.status}>{statusLabel[quote.status] || quote.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                <div className="text-base font-semibold tabular-nums">
                  {fmtMoney(quote.total, quote.currency)}
                </div>
                <select
                  value={quote.status}
                  onChange={(e) => changeStatus(quote.id, e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  {Object.entries(statusLabel).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => duplicate(quote.id)} disabled={busyId === quote.id}>
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <Button asChild size="sm" variant="accent">
                  <Link to={`/quotes/${quote.id}`}>Open</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => downloadFile(`/quotes/${quote.id}/pdf`, `${quote.quote_no}.pdf`)}>
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => downloadFile(`/quotes/${quote.id}/excel`, `${quote.quote_no}.xlsx`)}>
                  <Sheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No proposals match these filters.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Proposal #</th>
                <th className="px-4 py-3">Facility / Customer</th>
                <th className="px-4 py-3">Season</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((quote) => (
                <tr key={quote.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/quotes/${quote.id}`} className="font-semibold hover:text-accent">
                      {quote.quote_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{quote.facility_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{quote.Customer?.name || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {quote.season_start ? fmtDate(quote.season_start) : '—'}
                    {quote.season_end ? ` → ${fmtDate(quote.season_end)}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={quote.status}
                      onChange={(e) => changeStatus(quote.id, e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    >
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {fmtMoney(quote.total, quote.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => duplicate(quote.id)} disabled={busyId === quote.id}>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Duplicate
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => downloadFile(`/quotes/${quote.id}/pdf`, `${quote.quote_no}.pdf`)}>
                        PDF
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => downloadFile(`/quotes/${quote.id}/excel`, `${quote.quote_no}.xlsx`)}>
                        Excel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No proposals match these filters.
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
