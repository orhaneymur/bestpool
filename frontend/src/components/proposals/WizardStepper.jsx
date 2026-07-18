import { Check } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export default function WizardStepper({ steps, current, onChange }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
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
                !active && !done && 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                  active && 'bg-accent text-accent-foreground',
                  done && !active && 'bg-emerald-500 text-white',
                  !active && !done && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="hidden h-px w-4 bg-border sm:block md:w-8" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
