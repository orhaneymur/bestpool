import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';

const tones = {
  primary: {
    icon: 'bg-primary/8 text-primary ring-1 ring-inset ring-primary/10',
    spark: 'text-primary/25',
    wash: 'from-primary/[0.04]',
  },
  accent: {
    icon: 'bg-accent/10 text-accent ring-1 ring-inset ring-accent/15',
    spark: 'text-accent/30',
    wash: 'from-accent/[0.05]',
  },
  gold: {
    icon: 'bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/15',
    spark: 'text-amber-400/40',
    wash: 'from-amber-500/[0.05]',
  },
  success: {
    icon: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/15',
    spark: 'text-emerald-400/40',
    wash: 'from-emerald-500/[0.05]',
  },
};

function Sparkline({ className }) {
  return (
    <svg viewBox="0 0 120 40" preserveAspectRatio="none" className={cn('h-9 w-24', className)} fill="none">
      <path
        d="M0 30 L20 26 L40 30 L60 18 L80 22 L100 10 L120 14"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 30 L20 26 L40 30 L60 18 L80 22 L100 10 L120 14 L120 40 L0 40 Z"
        fill="currentColor"
        opacity="0.08"
      />
    </svg>
  );
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  tone = 'accent',
  index = 0,
}) {
  const t = tones[tone] || tones.accent;
  const positive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: 'easeOut' }}
    >
      <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pop">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent',
            t.wash
          )}
        />
        <div className="relative flex items-start justify-between">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', t.icon)}>
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>

        <div className="relative mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
              {value}
            </div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">{label}</div>
            {hint && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</div>}
          </div>
          <Sparkline className={cn('hidden sm:block', t.spark)} />
        </div>
      </Card>
    </motion.div>
  );
}
