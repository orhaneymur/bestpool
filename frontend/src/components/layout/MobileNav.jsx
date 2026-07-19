import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  MoreHorizontal,
  LogOut,
  ClipboardList,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

const primary = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/quotes', label: 'Proposals', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
];

const moreLinks = [
  { to: '/services', label: 'Services', icon: ClipboardList },
  { to: '/templates', label: 'Templates', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function MobileNav() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-paper lg:hidden">
          <div className="grid gap-0.5 p-2">
            {moreLinks.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {l.label}
                </NavLink>
              );
            })}
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
                nav('/login');
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {primary.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors',
                    isActive ? 'text-accent' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-5 w-5', isActive && 'text-accent')} />
                    <span className="truncate">{l.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors',
              open ? 'text-accent' : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
