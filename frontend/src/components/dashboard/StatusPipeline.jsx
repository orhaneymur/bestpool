import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { statusLabel } from '@/api/utils.js';
import { cn } from '@/lib/utils.js';

const order = ['taslak', 'gonderildi', 'kabul', 'red'];
const colors = {
  taslak: 'bg-slate-400',
  gonderildi: 'bg-sky-500',
  kabul: 'bg-emerald-500',
  red: 'bg-rose-500',
};

export default function StatusPipeline({ byStatus = {} }) {
  const total = order.reduce((s, k) => s + Number(byStatus[k] || 0), 0) || 1;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle>Proposal pipeline</CardTitle>
        <CardDescription>Distribution by status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          {order.map((k) => {
            const pct = (Number(byStatus[k] || 0) / total) * 100;
            if (pct <= 0) return null;
            return (
              <motion.div
                key={k}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', colors[k])}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {order.map((k) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', colors[k])} />
                <span className="text-sm text-muted-foreground">{statusLabel[k]}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {byStatus[k] || 0}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
