import { useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Command, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export default function Topbar() {
  const nav = useNavigate();
  const { user } = useAuth();
  const firstName = (user?.name || '').split(' ')[0] || 'User';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/80 bg-background/75 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-4 lg:gap-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waves className="h-4 w-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-foreground">Four Seasons</div>
          <div className="truncate text-[11px] text-muted-foreground">Hello, {firstName}</div>
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <div className="text-sm font-medium text-foreground">Hello, {firstName}</div>
        <div className="text-xs text-muted-foreground">Contracts & proposals</div>
      </div>

      <div className="relative ml-auto hidden w-full max-w-md sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search customers, proposal #, or facility…"
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-16 text-sm text-foreground shadow-soft transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft transition-all duration-200 hover:text-foreground sm:flex"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        </button>
        <Button onClick={() => nav('/quotes/new')} variant="accent" size="sm" className="gap-1.5 shadow-soft sm:h-10 sm:px-4">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>
    </header>
  );
}
