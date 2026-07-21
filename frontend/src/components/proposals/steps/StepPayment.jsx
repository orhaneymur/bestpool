import { motion } from 'framer-motion';
import { CalendarPlus, Equal, Plus, Trash2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { fmtMoney } from '@/api/utils.js';
import { AYLAR, round2 } from '../utils/quoteMath.js';
import { STANDARD_CLAUSES, cloneStandardClauses } from '../utils/defaultClauses.js';
import { buildMarchAugustInstallments } from '../utils/bidPricing.js';
import { cn } from '@/lib/utils.js';

export default function StepPayment({
  q, setQ, installments, setInstallments, specialNotes, setSpecialNotes,
  contractAmount, installmentsSum, templates, setErr,
}) {
  const remaining = round2(contractAmount - installmentsSum);
  const progress = contractAmount > 0 ? Math.min(100, (installmentsSum / contractAmount) * 100) : 0;
  const matched = Math.abs(remaining) < 0.01;

  function splitInstallments(n) {
    if (!n || n < 1) return;
    const base = contractAmount;
    const each = round2(base / n);
    const rows = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(base - acc) : each;
      acc = round2(acc + amount);
      rows.push({ label: `Installment ${i + 1}`, due_date: '', amount });
    }
    setInstallments(rows);
  }

  function marchAugustSplit() {
    const y = q.season_start
      ? new Date(q.season_start).getFullYear()
      : new Date().getFullYear();
    setInstallments(buildMarchAugustInstallments(contractAmount, y));
  }

  function monthlyInstallments() {
    if (!q.season_start || !q.season_end) {
      setErr?.('Enter contract start and end dates to build a monthly schedule.');
      return;
    }
    setErr?.('');
    const start = new Date(q.season_start);
    const end = new Date(q.season_end);
    const rows = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      rows.push({
        label: `${AYLAR[m]} ${y}`,
        due_date: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        amount: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    const each = rows.length ? round2(contractAmount / rows.length) : 0;
    let acc = 0;
    const filled = rows.map((r, i) => {
      const amount = i === rows.length - 1 ? round2(contractAmount - acc) : each;
      acc = round2(acc + amount);
      return { ...r, amount };
    });
    setInstallments(filled);
  }

  function addNote() {
    const nextLabel = String.fromCharCode(65 + specialNotes.length);
    setSpecialNotes((a) => [...a, { label: nextLabel, body: '' }]);
  }

  function loadStandardClauses() {
    setSpecialNotes(cloneStandardClauses());
  }

  function addPreset(clause) {
    setSpecialNotes((a) => {
      if (a.some((n) => n.body === clause.body)) return a;
      const label = String.fromCharCode(65 + a.length);
      return [...a, { label: clause.label || label, body: clause.body }];
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Compensation schedule</CardTitle>
          <CardDescription>
            Default: six equal monthly payments March–August (per Specification). Total comes from Bid Summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Early bird discount ($ off total)</Label>
              <Input
                type="number"
                step="0.01"
                value={q.early_bird_discount || 0}
                onChange={(e) => setQ({ ...q, early_bird_discount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Early bird deadline (valid until)</Label>
              <Input
                type="date"
                value={q.valid_until || ''}
                onChange={(e) => setQ({ ...q, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Allocated</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {fmtMoney(installmentsSum, q.currency)}
                  <span className="mx-1.5 text-muted-foreground">/</span>
                  {fmtMoney(contractAmount, q.currency)}
                </div>
              </div>
              <div
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  matched ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                )}
              >
                {matched ? 'Matched' : `Remaining ${fmtMoney(remaining, q.currency)}`}
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" size="sm" className="gap-1" onClick={marchAugustSplit}>
              <Equal className="h-3.5 w-3.5" />
              March–August (6 equal)
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={monthlyInstallments}>
              <CalendarPlus className="h-3.5 w-3.5" />
              Season months
            </Button>
            {[2, 3, 4, 6, 12].map((n) => (
              <Button key={n} type="button" variant="secondary" size="sm" className="gap-1" onClick={() => splitInstallments(n)}>
                <Equal className="h-3.5 w-3.5" />
                {n} equal
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setInstallments((a) => [...a, { label: `Installment ${a.length + 1}`, due_date: '', amount: 0 }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Row
            </Button>
          </div>

          <div className="space-y-2">
            {installments.map((inst, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-2 rounded-xl border border-border/80 bg-card p-3 sm:grid-cols-[1fr_140px_120px_auto]"
              >
                <Input
                  value={inst.label}
                  onChange={(e) => setInstallments((a) => a.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Period"
                />
                <Input
                  type="date"
                  value={inst.due_date || ''}
                  onChange={(e) => setInstallments((a) => a.map((x, idx) => (idx === i ? { ...x, due_date: e.target.value } : x)))}
                />
                <Input
                  type="number"
                  step="0.01"
                  value={inst.amount}
                  onChange={(e) => setInstallments((a) => a.map((x, idx) => (idx === i ? { ...x, amount: Number(e.target.value) } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setInstallments((a) => a.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
            {installments.length === 0 && (
              <p className="text-sm text-muted-foreground">No installments yet. Use March–August for the standard schedule.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Additional comments</CardTitle>
            <CardDescription>Printed verbatim in PDF Section III (A, B, C…). Defaults match the Specification.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={loadStandardClauses}>
              <Sparkles className="h-3.5 w-3.5" />
              Load standard clauses
            </Button>
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={addNote}>
              <Plus className="h-3.5 w-3.5" />
              Clause
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_CLAUSES.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.body}
                onClick={() => addPreset(c)}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
              >
                + {c.label}
              </button>
            ))}
          </div>

          {specialNotes.map((n, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="w-14 shrink-0"
                value={n.label || ''}
                onChange={(e) => setSpecialNotes((a) => a.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                placeholder="A"
              />
              <textarea
                rows={2}
                value={n.body}
                onChange={(e) => setSpecialNotes((a) => a.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)))}
                placeholder="Clause text…"
                className="min-h-[2.5rem] flex-1 rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSpecialNotes((a) => a.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {specialNotes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tip: click <strong>Load standard clauses</strong> for the Specification default set, then edit freely.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Template & status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Contract template (Terms & Conditions)</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                value={q.contract_template_id || ''}
                onChange={(e) => setQ({ ...q, contract_template_id: e.target.value })}
              >
                <option value="">— None —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                value={q.currency}
                onChange={(e) => setQ({ ...q, currency: e.target.value })}
              >
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
                <option value="TRY">TRY ₺</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                value={q.status}
                onChange={(e) => setQ({ ...q, status: e.target.value })}
              >
                <option value="taslak">Draft</option>
                <option value="gonderildi">Sent</option>
                <option value="kabul">Accepted</option>
                <option value="red">Rejected</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
