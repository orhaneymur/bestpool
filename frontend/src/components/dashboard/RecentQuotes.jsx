import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { fmtMoney, fmtDate, statusLabel } from '@/api/utils.js';

export default function RecentQuotes({ quotes = [] }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Recent proposals</CardTitle>
          <CardDescription>Latest contract drafts</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Link to="/quotes">
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">No proposals yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create your first contract to get started.</p>
            <Button asChild variant="accent" size="sm" className="mt-4">
              <Link to="/quotes/new">New Proposal</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/70 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Proposal</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quotes.map((q) => (
                  <tr key={q.id} className="group transition-colors duration-200 hover:bg-muted/40">
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/quotes/${q.id}`}
                        className="font-semibold text-foreground transition-colors group-hover:text-accent"
                      >
                        {q.quote_no}
                      </Link>
                      {q.facility_name && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {q.facility_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {q.Customer?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-muted-foreground">
                      {fmtDate(q.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={q.status}>{statusLabel[q.status] || q.status}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-foreground">
                      {fmtMoney(q.total, q.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
