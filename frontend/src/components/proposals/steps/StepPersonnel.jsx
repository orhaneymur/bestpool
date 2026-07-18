import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock3, Calculator, Zap, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { fmtMoney } from '@/api/utils.js';
import { emptyItem, round2 } from '../utils/quoteMath.js';

function SummaryTile({ icon: Icon, label, value, tone = 'accent' }) {
  const tones = {
    accent: 'from-sky-500/10 to-transparent text-accent',
    gold: 'from-amber-500/10 to-transparent text-amber-600',
    primary: 'from-slate-900/5 to-transparent text-primary',
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tones[tone]}`} />
      <div className="relative flex items-start justify-between">
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={String(value)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="relative mt-3"
        >
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function StepPersonnel({
  q, setQ, items, setItems, services, totals, contractAmount, totalHours, weeks,
}) {
  function updateItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function pickService(i, serviceId) {
    const s = services.find((x) => String(x.id) === String(serviceId));
    if (!s) return updateItem(i, { service_item_id: null });
    updateItem(i, {
      service_item_id: s.id,
      description: s.name,
      unit: s.unit,
      unit_price: Number(s.default_unit_price),
      vat_rate: Number(s.vat_rate),
    });
  }

  function addLifeguardLine() {
    const lg = services.find((s) => s.category === 'cankurtaran');
    const rate = lg ? Number(lg.default_unit_price) : 35;
    const hours = Number(q.lifeguard_count || 0) * Number(q.hours_per_week || 0) * weeks;
    setItems((arr) => [
      ...arr.filter((it) => it.description),
      {
        description: `Lifeguard service (${q.lifeguard_count} lifeguard(s) × ${q.hours_per_week} hrs/week × ${weeks} weeks)`,
        quantity: hours,
        unit: 'hour',
        unit_price: rate,
        vat_rate: 0,
        service_item_id: lg?.id || null,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={Users} label="Lifeguards" value={Number(q.lifeguard_count || 0)} tone="primary" />
        <SummaryTile icon={Clock3} label="Hours / lifeguard / week" value={Number(q.hours_per_week || 0)} tone="accent" />
        <SummaryTile icon={Calculator} label="Total staff hours / week" value={totalHours} tone="gold" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Staffing & operations</CardTitle>
          <CardDescription>Values update live — add a lifeguard line item in one click.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Number of lifeguards</Label>
              <Input
                type="number"
                min="0"
                value={q.lifeguard_count}
                onChange={(e) => setQ({ ...q, lifeguard_count: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hours per lifeguard / week</Label>
              <Input
                type="number"
                min="0"
                value={q.hours_per_week}
                onChange={(e) => setQ({ ...q, hours_per_week: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={addLifeguardLine}>
              <Zap className="h-4 w-4 text-accent" />
              Add lifeguard line item
            </Button>
            <span className="text-xs text-muted-foreground">
              Season: {weeks} weeks · Season total ~{round2(totalHours * weeks)} hours
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Service line items</CardTitle>
            <CardDescription>Pick from catalog or enter manually.</CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setItems((a) => [...a, emptyItem()])}>
            <Plus className="h-4 w-4" />
            Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-2 rounded-xl border border-border/80 bg-muted/20 p-3 sm:grid-cols-[160px_1fr_90px_100px_70px_auto]"
            >
              <select
                className="h-10 rounded-lg border border-input bg-card px-2 text-sm shadow-soft"
                value={it.service_item_id || ''}
                onChange={(e) => pickService(i, e.target.value)}
              >
                <option value="">Manual</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Input
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Description"
              />
              <Input
                type="number"
                step="0.01"
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              />
              <Input
                type="number"
                step="0.01"
                value={it.unit_price}
                onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
              />
              <Input
                type="number"
                step="0.01"
                value={it.vat_rate}
                onChange={(e) => updateItem(i, { vat_rate: Number(e.target.value) })}
                title="Tax %"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}

          <div className="ml-auto w-full max-w-sm space-y-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{fmtMoney(totals.subtotal, q.currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                Discount %
                <Input
                  type="number"
                  className="h-8 w-16"
                  value={q.discount_rate}
                  onChange={(e) => setQ({ ...q, discount_rate: Number(e.target.value), discount_amount: 0 })}
                />
              </span>
              <span className="font-medium">- {fmtMoney(totals.discount_amount, q.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{fmtMoney(totals.vat_amount, q.currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                Early bird
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  value={q.early_bird_discount}
                  onChange={(e) => setQ({ ...q, early_bird_discount: Number(e.target.value) })}
                />
              </span>
              <span className="font-medium">- {fmtMoney(q.early_bird_discount, q.currency)}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              <span>Contract price</span>
              <span>{fmtMoney(contractAmount, q.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
