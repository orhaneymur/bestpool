import { Check } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Progress } from '@/components/ui/progress.jsx';

export default function WizardStepper({ steps, current, onChange }) {
  const pct = ((current + 1) / steps.length) * 100;

  return (
    <div className="space-y-3">
      {/* Mobile progress */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">
            {steps[current]?.label}
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            Step {current + 1} of {steps.length}
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="mt-3 flex gap-1.5">
          {steps.map((step, i) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onChange?.(i)}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= current ? 'bg-accent' : 'bg-muted'
              )}
              aria-label={step.label}
            />
          ))}
        </div>
      </div>

      {/* Desktop / tablet pills */}
      <ol className="hidden flex-wrap items-center gap-2 sm:flex">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange?.(i)}
                className={cn(
                  'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200',
                  active && 'border-accent/40 bg-accent/10 text-accent shadow-soft',
                  done && !active && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  !active && !done && 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                    active && 'bg-accent text-accent-foreground',
                    done && !active && 'bg-emerald-500 text-white',
                    !active && !done && 'bg-muted text-muted-foreground'
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span>{step.label}</span>
              </button>
              {i < steps.length - 1 && <span className="h-px w-4 bg-border md:w-8" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
