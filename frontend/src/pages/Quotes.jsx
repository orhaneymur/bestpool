import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, FileDown, Loader2, Plus, Search, Sheet } from 'lucide-react';
import api from '@/api/client.js';
import { useDownload } from '@/hooks/useDownload.js';
import { fmtMoney, fmtDate, statusLabel } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';

const PAGE_SIZE = 50;

/**
 * The one place contracts are listed.
 *
 * Saved drafts, sent and completed each used to have their own entry in the
 * sidebar, all three opening this same screen with a different query string —
 * three names for one page. They are the tabs below instead: one Contracts
 * entry, and the status is picked from inside it.
 */
const STATUSES = [
  { key: '', label: 'All' },
  { key: 'taslak', label: 'Saved' },
  { key: 'gonderildi', label: 'Sent' },
  { key: 'kabul', label: 'Completed' },
  { key: 'red', label: 'Rejected' },
];

export default function Quotes() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ taslak: 0, gonderildi: 0, kabul: 0, red: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  // Bumped after a mutation so the list effect re-runs without a second loader.
  const [reloadKey, setReloadKey] = useState(0);
  const { busyKey, download } = useDownload();

  useEffect(() => {
    const s = searchParams.get('status') || '';
    setStatus(s);
  }, [searchParams]);

  /**
   * Tabs, not toggles: clicking the tab you are already on keeps you there
   * rather than dumping you back into the unfiltered list. The status also
   * lives in the URL, so a filtered list can be bookmarked and shared.
   */
  function selectStatus(key) {
    setStatus(key);
    if (key) setSearchParams({ status: key });
    else setSearchParams({});
  }

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2].map(String);
  }, []);

  /**
   * The list is paged and every request is abortable.
   *
   * The debounce alone was not enough: two overlapping requests could still
   * resolve out of order and leave the table showing results for a filter the
   * user had already changed.
   */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get('/quotes', {
          params: {
            ...(status ? { status } : {}),
            ...(year ? { year } : {}),
            ...(q.trim() ? { q: q.trim() } : {}),
            page,
            limit: PAGE_SIZE,
          },
          signal: controller.signal,
        })
        .then((r) => {
          setRows(r.data.rows || []);
          setTotal(r.data.count || 0);
          setCounts(r.data.counts || { taslak: 0, gonderildi: 0, kabul: 0, red: 0 });
          setErr('');
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setErr(e.response?.data?.error || e.message || 'Could not load contracts.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, year, q, page, reloadKey]);

  // Any change to the filters starts again at page one.
  useEffect(() => {
    setPage(1);
  }, [status, year, q]);

  const reload = () => setReloadKey((n) => n + 1);

  async function changeStatus(id, newStatus) {
    setErr('');
    try {
      await api.patch(`/quotes/${id}/status`, { status: newStatus });
      reload();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Could not change the status.');
    }
  }

  async function duplicate(id) {
    setBusyId(id);
    setErr('');
    try {
      const { data } = await api.post(`/quotes/${id}/duplicate`);
      nav(`/quotes/${data.id}`);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Could not duplicate this contract.');
    } finally {
      setBusyId(null);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // The counts are for the whole filter minus the status, so "All" is their sum
  // rather than the number of rows the current tab happens to be showing.
  const allCount = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Contracts"
        subtitle="Every proposal — switch between saved, sent, completed and rejected below"
      >
        <Button asChild variant="accent" className="gap-2">
          <Link to="/quotes/new">
            <Plus className="h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </PageHeader>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((s) => {
          const count = s.key ? counts[s.key] || 0 : allCount;
          const active = status === s.key;
          return (
            <button
              key={s.key || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => selectStatus(s.key)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                active ? 'border-accent/40 bg-accent/10' : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{count}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 pr-9"
            placeholder="Search proposal #, facility, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading && (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyKey !== null}
                  onClick={() => download(`pdf-${quote.id}`, `/quotes/${quote.id}/pdf`, `${quote.quote_no}.pdf`)}
                >
                  {busyKey === `pdf-${quote.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyKey !== null}
                  onClick={() => download(`excel-${quote.id}`, `/quotes/${quote.id}/excel`, `${quote.quote_no}.xlsx`)}
                >
                  {busyKey === `excel-${quote.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sheet className="h-3.5 w-3.5" />
                  )}
                  Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading…' : 'No proposals match these filters.'}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() => download(`pdf-${quote.id}`, `/quotes/${quote.id}/pdf`, `${quote.quote_no}.pdf`)}
                      >
                        {busyKey === `pdf-${quote.id}` && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        PDF
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() => download(`excel-${quote.id}`, `/quotes/${quote.id}/excel`, `${quote.quote_no}.xlsx`)}
                      >
                        {busyKey === `excel-${quote.id}` && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        Excel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {loading ? 'Loading…' : 'No proposals match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            {`Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{`Page ${page} / ${lastPage}`}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
