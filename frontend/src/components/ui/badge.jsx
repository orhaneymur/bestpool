import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        accent: 'border-transparent bg-accent/10 text-accent',
        gold: 'border-transparent bg-gold/15 text-amber-700',
        success: 'border-transparent bg-success/12 text-emerald-700',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'text-foreground',
        // Proposal status keys (API enums)
        taslak: 'border-transparent bg-slate-100 text-slate-600',
        gonderildi: 'border-transparent bg-sky-100 text-sky-700',
        kabul: 'border-transparent bg-emerald-100 text-emerald-700',
        red: 'border-transparent bg-rose-100 text-rose-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
