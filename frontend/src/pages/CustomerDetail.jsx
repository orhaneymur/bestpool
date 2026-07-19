import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Plus, Sheet } from 'lucide-react';
import api, { downloadFile } from '@/api/client.js';
import { fmtMoney, fmtDate, statusLabel } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);

  useEffect(() => {
    api.get(`/customers/${id}`).then((r) => setC(r.data));
  }, [id]);

  if (!c) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const quotes = c.Quotes || [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to customers
      </Link>

      <PageHeader title={c.name} subtitle={c.code || 'Customer account'}>
        <Button asChild variant="accent" className="gap-2">
          <Link to={`/quotes/new?customer=${c.id}`}>
            <Plus className="h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Account code', c.code],
              ['Contact', c.contact_person],
              ['Phone', c.phone],
              ['Email', c.email],
              ['Tax office / ID', [c.tax_office, c.tax_no].filter(Boolean).join(' / ')],
              ['City', c.city],
              ['Address', c.address],
            ].map(([label, value]) => (
              <div key={label} className={label === 'Address' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Proposal history ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 md:p-0 md:pt-0">
          <div className="grid gap-3 md:hidden">
            {quotes.map((q) => (
              <div key={q.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/quotes/${q.id}`} className="font-semibold hover:text-accent">
                    {q.quote_no}
                  </Link>
                  <Badge variant={q.status}>{statusLabel[q.status]}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {q.facility_name || '—'} · {fmtDate(q.created_at)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums">{fmtMoney(q.total, q.currency)}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(`/quotes/${q.id}/excel`, `${q.quote_no}.xlsx`)}
                    >
                      <Sheet className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No proposals for this customer.</p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Proposal #</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/quotes/${q.id}`} className="font-semibold hover:text-accent">
                        {q.quote_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{q.facility_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(q.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={q.status}>{statusLabel[q.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {fmtMoney(q.total, q.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(`/quotes/${q.id}/pdf`, `${q.quote_no}.pdf`)}
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
