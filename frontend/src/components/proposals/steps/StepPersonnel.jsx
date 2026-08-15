import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock3, Calculator, Zap, Plus, Trash2, MapPinned, CalendarDays, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { HideToggle } from '../VisibilityContext.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { fmtMoney } from '@/api/utils.js';
import { emptyItem, round2 } from '../utils/quoteMath.js';
import {
  COUNTY_WAGES,
  computeBidSummary,
  buildBidLineItems,
  BID_RATES,
} from '../utils/bidPricing.js';

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

/**
 * The calendar behind the invoice: how the season was counted, and which public
 * holidays are staffed. It sits here because these are the exact numbers the
 * wage line is built from — the customer is billed for what this lists.
 */
function SeasonBreakdown({ season, holidayPolicy, onToggle }) {
  if (!season || !season.valid) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Enter the contract start and end dates on the Customer step to work out the season calendar.
        </CardContent>
      </Card>
    );
  }

  const fmt = (d) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

  const stat = (label, value) => (
    <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-accent" />
          Season calendar
        </CardTitle>
        <CardDescription>
          Counted one day at a time across {season.days} calendar days — never rounded to whole weeks. These hours
          are what the wage line below is priced on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {stat('Calendar days', `${season.days} (${season.weeksLabel})`)}
          {stat('Open / closed days', `${season.openDays} / ${season.closedDays}`)}
          {stat('Pool open hours', season.openHours)}
          {stat('Normal / school days', `${season.normalDays} / ${season.schoolDays}`)}
        </div>

        {season.warnings?.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>{season.warnings.join(' ')}</div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">US public holidays in this season</div>
            {season.holidayExtraStaffHours !== 0 && (
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                {season.holidayExtraStaffHours > 0 ? '+' : ''}
                {season.holidayExtraStaffHours} hrs vs the weekly schedule
              </span>
            )}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            A holiday uses the <strong>Holiday</strong> row of the operating schedule, so the pool still opens on a
            day the weekly schedule marks closed. Untick one to keep it shut that day.
          </p>
          <div className="divide-y divide-border/70 rounded-xl border border-border">
            {season.holidays.map((h) => {
              const on = holidayPolicy?.[h.key] !== false;
              return (
                <label key={h.key} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(h.key)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{h.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {fmt(h.date)} · {h.weekday}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {on ? `${h.hours} hrs` : 'closed'}
                    {on && h.replacesHours !== h.hours && (
                      <span className="ml-1 font-semibold text-accent">
                        (weekly schedule: {h.replacesHours})
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            {season.holidays.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No US public holiday falls inside these dates.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function StepPersonnel({
  q, setQ, items, setItems, services, totals, contractAmount, totalHours, weeks, bid,
  season, holidayPolicy = {}, setHolidayPolicy,
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

  function applyBidPricing() {
    const summary = computeBidSummary({
      county: q.county,
      lifeguardCount: q.lifeguard_count,
      totalLifeguardHours: season?.staffHours || 0,
      weeklyStaffHours: season?.weeklyStaffHours || 0,
      services,
    });
    if (!summary.hourlyWage || !summary.totalLifeguardHours) return;
    // Keep the stored figures in step with the calendar so the saved contract,
    // the invoice and the PDF all quote the same hours.
    setQ((prev) => ({
      ...prev,
      peak_weeks: Math.round(season?.weeks || 0),
      hours_per_week: Math.round(season?.weeklyStaffHours || 0),
    }));
    setItems(buildBidLineItems(summary));
  }

  function toggleHoliday(key) {
    setHolidayPolicy?.((prev) => ({ ...prev, [key]: prev?.[key] === false }));
  }

  const countyWage = COUNTY_WAGES.find((c) => c.id === q.county);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={Users} label="Lifeguards on duty" value={Number(q.lifeguard_count || 0)} tone="primary" />
        <SummaryTile icon={CalendarDays} label="Contract duration" value={season?.weeksLabel || '—'} tone="accent" />
        <SummaryTile
          icon={Calculator}
          label="Total staffed hours (season)"
          value={season ? season.staffHours : '—'}
          tone="gold"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={CalendarDays}
          label="Operating days"
          value={season ? `${season.openDays} / ${season.days}` : '—'}
          tone="primary"
        />
        <SummaryTile
          icon={Clock3}
          label="Daily hrs / guard (open days)"
          value={season ? season.avgDailyHoursPerGuard : '—'}
          tone="accent"
        />
        <SummaryTile
          icon={Clock3}
          label="Weekly staff hrs (schedule)"
          value={season ? season.weeklyStaffHours : '—'}
          tone="gold"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Staffing figures on the PDF</CardTitle>
            <CardDescription>
              Each line prints on its own. Switch off the ones this customer should not see — the rest stay.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <HideToggle k="spec.staffLifeguards" label="number of lifeguards" />
          <HideToggle k="spec.staffOperatingDays" label="operating days" />
          <HideToggle k="spec.staffDailyHours" label="daily hours" />
          <HideToggle k="spec.staffWeeklyHours" label="weekly hours" />
          <HideToggle k="spec.staffSeasonHours" label="seasonal hours" />
        </CardContent>
      </Card>

      <SeasonBreakdown season={season} holidayPolicy={holidayPolicy} onToggle={toggleHoliday} />

      <Card>
        <CardHeader className="flex flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
          <CardTitle>Bid Summary inputs</CardTitle>
          <CardDescription>
            County wage × hours, then fixed expenses, {BID_RATES.overheadPct}% overhead,{' '}
            {BID_RATES.profitPct}% profit, and {BID_RATES.salesTaxPct}% sales tax — calculated automatically.
          </CardDescription>
          </div>
          <HideToggle k="spec.personnel" label="staffing block" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <MapPinned className="h-3.5 w-3.5" />
                County (lifeguard hourly wage)
              </Label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft"
                value={q.county || ''}
                onChange={(e) => setQ({ ...q, county: e.target.value })}
              >
                <option value="">— Select county —</option>
                {COUNTY_WAGES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — ${c.hourly}/hr
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Number of peak-season lifeguards</Label>
              <Input
                type="number"
                min="0"
                value={q.lifeguard_count}
                onChange={(e) => setQ({ ...q, lifeguard_count: e.target.value })}
              />
            </div>
            {/* Read-only on purpose. These used to be typed by hand and then
                multiplied together, which is what made the quoted hours drift
                from the operating schedule. They now report what the season
                calendar counted. Change the dates or the schedule to move them. */}
            <div className="space-y-2">
              <Label>Staffed hours / week</Label>
              <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium tabular-nums">
                {season ? `${season.weeklyStaffHours} hrs` : '\u2014'}
              </div>
              <p className="text-xs text-muted-foreground">
                Straight from the operating schedule. The season itself averaged{' '}
                {season ? season.avgWeeklyStaffHours : '—'} hrs/week, because it is not a whole
                number of weeks.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Total staffed hours (season)</Label>
              <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium tabular-nums">
                {season ? `${season.staffHours} hrs` : '\u2014'}
              </div>
              <p className="text-xs text-muted-foreground">
                From the season calendar above — {season ? season.weeksLabel : 'no dates yet'}. Edit the operating
                schedule or the contract dates to change it.
              </p>
            </div>
            <div className="space-y-2">
              <Label>County wage</Label>
              <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium">
                {countyWage ? `$${countyWage.hourly}/hour` : '—'}
              </div>
            </div>
          </div>

          {bid && bid.hourlyWage > 0 && (
            <div className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Total wages</span>
                <span className="font-medium tabular-nums">{fmtMoney(bid.totalWages, q.currency)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Other expenses</span>
                <span className="font-medium tabular-nums">{fmtMoney(bid.expenses.total, q.currency)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Overhead {BID_RATES.overheadPct}%</span>
                <span className="font-medium tabular-nums">{fmtMoney(bid.overhead, q.currency)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Profit {BID_RATES.profitPct}%</span>
                <span className="font-medium tabular-nums">{fmtMoney(bid.profit, q.currency)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Sales tax {BID_RATES.salesTaxPct}%</span>
                <span className="font-medium tabular-nums">{fmtMoney(bid.salesTax, q.currency)}</span>
              </div>
              <div className="flex justify-between gap-2 font-semibold">
                <span>Bid total</span>
                <span className="tabular-nums">{fmtMoney(bid.contractTotal, q.currency)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="accent" className="gap-2" onClick={applyBidPricing} disabled={!q.county}>
              <Zap className="h-4 w-4" />
              Calculate bid & fill line items
            </Button>
            <span className="text-xs text-muted-foreground">
              Chemicals / drain / winterization scale with guard count automatically.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Service line items</CardTitle>
            <CardDescription>Auto-filled from Bid Summary — editable if needed.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <HideToggle k="spec.items" />
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setItems((a) => [...a, emptyItem()])}>
              <Plus className="h-4 w-4" />
              Line
            </Button>
          </div>
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
                <option value="">Custom / calculated</option>
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
