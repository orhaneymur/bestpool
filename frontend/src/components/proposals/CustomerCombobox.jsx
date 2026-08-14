import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Building2, Loader2 } from 'lucide-react';
import api from '@/api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command.jsx';
import { cn } from '@/lib/utils.js';
import { customerInitials } from './utils/quoteMath.js';

const PAGE_SIZE = 25;

/**
 * Searches on the server instead of filtering a full copy of the customer table
 * in the browser.
 *
 * The wizard used to pull every customer up front purely to populate this
 * dropdown, which is a large payload on the slowest screen in the app. Now it
 * asks for a page at a time and lets MySQL do the matching.
 *
 * `selected` is passed in separately because the chosen customer is very often
 * not in the page currently loaded — the trigger has to be able to render a name
 * the list does not contain.
 */
export default function CustomerCombobox({ value, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get('/customers', {
          params: { q: term.trim() || undefined, limit: PAGE_SIZE },
          signal: controller.signal,
        })
        .then((r) => {
          setRows(r.data.rows || []);
          setTotal(r.data.count || 0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setRows([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  const hidden = Math.max(0, total - rows.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-12 w-full justify-between rounded-xl px-3 font-normal shadow-soft"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {customerInitials(selected.name)}
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">{selected.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[selected.city, selected.contact_person].filter(Boolean).join(' · ') || 'Customer account'}
                </span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Select a customer…
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* shouldFilter=false: the matching happens in SQL, so cmdk must not
            filter the results a second time and hide legitimate rows. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search name, code, phone…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}
            {!loading && rows.length === 0 && <CommandEmpty>No customer found.</CommandEmpty>}
            {!loading && rows.length > 0 && (
              <CommandGroup heading="Customers">
                {rows.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={String(c.id)}
                    onSelect={() => {
                      onChange?.(c);
                      setOpen(false);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                      {customerInitials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.city, c.phone].filter(Boolean).join(' · ') || c.code || '—'}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-accent',
                        String(value) === String(c.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!loading && hidden > 0 && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {`${hidden} more match — keep typing to narrow the list.`}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
