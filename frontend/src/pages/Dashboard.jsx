import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileCheck2, Clock3, Wallet, Plus, Sparkles } from 'lucide-react';
import api from '@/api/client.js';
import { fmtMoney } from '@/api/utils.js';
import PageHeader from '@/components/layout/PageHeader.jsx';
import StatCard from '@/components/dashboard/StatCard.jsx';
import StatusPipeline from '@/components/dashboard/StatusPipeline.jsx';
import RecentQuotes from '@/components/dashboard/RecentQuotes.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/stats/summary')
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load summary.'));
  }, []);

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-72 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted lg:col-span-3" />
        </div>
      </div>
    );
  }

  const pending = Number(data.byStatus?.taslak || 0) + Number(data.byStatus?.gonderildi || 0);
  const activeContracts = Number(data.byStatus?.kabul || 0);

  const metrics = [
    {
      icon: Users,
      label: 'Total Customers',
      value: data.customerCount,
      hint: 'Customer accounts',
      tone: 'primary',
      delta: 8,
    },
    {
      icon: FileCheck2,
      label: 'Active Contracts',
      value: activeContracts,
      hint: 'Accepted proposals',
      tone: 'success',
      delta: 12,
    },
    {
      icon: Clock3,
      label: 'Pending Proposals',
      value: pending,
      hint: 'Draft + sent',
      tone: 'accent',
      delta: -3,
    },
    {
      icon: Wallet,
      label: 'Total Pipeline Value',
      value: fmtMoney(data.totalPotential ?? data.totalAccepted),
      hint: `Accepted: ${fmtMoney(data.totalAccepted)}`,
      tone: 'gold',
      delta: 18,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Four Seasons commercial contract studio — new contracts, drafts, and pipeline"
      >
        <Button asChild variant="outline" className="flex-1 gap-2 sm:flex-none">
          <Link to="/quotes">Existing Contracts</Link>
        </Button>
        <Button asChild variant="accent" className="flex-1 gap-2 sm:flex-none">
          <Link to="/quotes/new">
            <Plus className="h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </PageHeader>

      <Card className="overflow-hidden border-accent/20 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 text-white shadow-pop">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent ring-1 ring-inset ring-accent/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">Commercial Pool Management Agreement</div>
              <p className="mt-0.5 text-sm text-slate-300">
                Cover · property · schedule · staffing · comments · March–August payments · PDF
              </p>
            </div>
          </div>
          <Button asChild variant="accent" className="w-full shrink-0 sm:w-auto">
            <Link to="/quotes/new">Create contract</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { to: '/quotes/new', label: 'New Contract' },
          { to: '/quotes?status=taslak', label: 'Saved Drafts' },
          { to: '/quotes?status=kabul', label: 'Completed' },
          { to: '/customers', label: 'Customers' },
        ].map((x) => (
          <Link
            key={x.to}
            to={x.to}
            className="rounded-2xl border border-border bg-card px-3 py-3 text-center text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            {x.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <StatCard key={m.label} index={i} {...m} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <StatusPipeline byStatus={data.byStatus} />
        </div>
        <div className="lg:col-span-3">
          <RecentQuotes quotes={data.recent} />
        </div>
      </div>
    </div>
  );
}
