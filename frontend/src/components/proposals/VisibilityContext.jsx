import { createContext, useContext, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/**
 * Per-contract PDF block visibility.
 *
 * The keys match config/pdfDefinitions.js on the backend; the authoritative list
 * is fetched from /definitions/schema so nothing is hard-coded twice. Hiding a
 * block here affects this contract only — the company-wide starting point lives
 * on the Definitions page.
 */
const VisibilityContext = createContext({
  hidden: [],
  isHidden: () => false,
  toggle: () => {},
  blocks: [],
});

export function VisibilityProvider({ hidden, setHidden, blocks, children }) {
  const value = useMemo(() => {
    const set = new Set(hidden || []);
    return {
      hidden: hidden || [],
      blocks: blocks || [],
      isHidden: (key) => set.has(key),
      /**
       * Hands the finished list to the owner rather than an updater function,
       * so it can be written straight to the server. An updater would only be
       * run inside setState, which is no place to start a request from.
       */
      toggle: (key) => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setHidden([...next]);
      },
    };
  }, [hidden, setHidden, blocks]);

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
}

export function useVisibility() {
  return useContext(VisibilityContext);
}

/**
 * The "don't print this" button that sits next to a field or card in the wizard.
 * Deliberately shows the resulting state as words too — an eye icon alone is
 * ambiguous about whether it means "is shown" or "click to show".
 */
export function HideToggle({ k, className, compact = false, label }) {
  const { isHidden, toggle } = useVisibility();
  const off = isHidden(k);
  // With a label the button names the thing it controls, which matters when
  // several toggles sit side by side and "Hide from PDF" would be ambiguous.
  const text = label ? (off ? `${label} — hidden` : `Hide ${label}`) : off ? 'Hidden from PDF' : 'Hide from PDF';
  return (
    <button
      type="button"
      onClick={() => toggle(k)}
      title={off ? 'Currently hidden from the PDF — click to print it' : 'Printed on the PDF — click to hide it'}
      aria-pressed={off}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
        off
          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
          : 'border-border bg-muted/40 text-muted-foreground hover:border-accent/40 hover:text-accent',
        className
      )}
    >
      {off ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {!compact && text}
    </button>
  );
}

/** Dims a wizard card whose block will not be printed. */
export function HiddenWrap({ k, children }) {
  const { isHidden } = useVisibility();
  return <div className={cn(isHidden(k) && 'opacity-55')}>{children}</div>;
}
