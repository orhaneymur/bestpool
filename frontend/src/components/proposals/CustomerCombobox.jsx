import { useState } from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command.jsx';
import { cn } from '@/lib/utils.js';
import { customerInitials } from './utils/quoteMath.js';

export default function CustomerCombobox({ customers = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => String(c.id) === String(value));

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
        <Command>
          <CommandInput placeholder="Search name, city, or contact…" />
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup heading="Customers">
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.city || ''} ${c.contact_person || ''}`}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
