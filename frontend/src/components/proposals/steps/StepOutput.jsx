import { useMemo } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import { useVisibility } from '../VisibilityContext.jsx';

/**
 * Final wizard step: every block of the PDF for this one contract.
 * The inline eye buttons on the earlier steps cover the fields you edit there;
 * this page is the complete picture, including cover and footer blocks that have
 * no field of their own.
 */
export default function StepOutput({ companyDefault = [] }) {
  const { blocks, hidden, isHidden, toggle } = useVisibility();

  const groups = useMemo(() => {
    const map = new Map();
    for (const b of blocks) {
      if (!map.has(b.group)) map.set(b.group, []);
      map.get(b.group).push(b);
    }
    return [...map.entries()];
  }, [blocks]);

  const differsFromDefault =
    [...hidden].sort().join('|') !== [...companyDefault].sort().join('|');

  if (!blocks.length) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          Loading the PDF block list…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>PDF output</CardTitle>
          <CardDescription>
            Switch off anything this customer should not see. {hidden.length} of {blocks.length} blocks hidden.
          </CardDescription>
        </div>
        {differsFromDefault && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            // Restores the company default for this contract without touching
            // the Definitions page.
            onClick={() => {
              const target = new Set(companyDefault);
              blocks.forEach((b) => {
                if (target.has(b.key) !== isHidden(b.key)) toggle(b.key);
              });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to company default
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map(([group, list]) => (
          <div key={group}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((b) => {
                const off = isHidden(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => toggle(b.key)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      off
                        ? 'border-amber-300/70 bg-amber-50/60 text-amber-800'
                        : 'border-accent/30 bg-accent/5 text-foreground'
                    )}
                  >
                    {off ? (
                      <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{b.label}</span>
                      {b.hint && <span className="block text-xs text-muted-foreground">{b.hint}</span>}
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide">
                        {off ? 'Hidden' : 'Printed'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
