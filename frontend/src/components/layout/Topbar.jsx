import { useNavigate } from 'react-router-dom';
import { Menu, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export default function Topbar({ onMenuClick }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const firstName = (user?.name || '').split(' ')[0] || 'User';

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-soft lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground lg:font-medium">
            <span className="lg:hidden">Four Seasons</span>
            <span className="hidden lg:inline">Hello, {firstName}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
            <span className="lg:hidden">Hello, {firstName}</span>
            <span className="hidden lg:inline">Contracts & proposals</span>
          </div>
        </div>

        <div className="relative hidden min-w-0 max-w-sm flex-1 md:block lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground shadow-soft placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        <Button
          onClick={() => nav('/quotes/new')}
          variant="accent"
          size="sm"
          className="shrink-0 gap-1.5 shadow-soft sm:h-10 sm:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Contract</span>
        </Button>
      </div>
    </header>
  );
}
