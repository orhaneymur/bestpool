import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  FolderOpen,
  Settings,
  Waves,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/quotes', label: 'Proposals', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services', label: 'Services', icon: ClipboardList },
  { to: '/templates', label: 'Templates', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const roleLabel = { admin: 'Admin', sales: 'Sales', viewer: 'Viewer' };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const initials = (user?.name || 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-[72px] shrink-0 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground lg:w-[248px]">
      <div className="flex items-center gap-3 px-3 pb-5 pt-5 lg:px-5 lg:pb-6 lg:pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-inset ring-accent/30">
          <Waves className="h-5 w-5" />
        </div>
        <div className="hidden min-w-0 leading-tight lg:block">
          <div className="truncate text-sm font-semibold tracking-tight text-white">Four Seasons</div>
          <div className="truncate text-[11px] text-sidebar-muted">Pool Management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 lg:px-3">
        <div className="hidden px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/60 lg:block">
          Menu
        </div>
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink key={l.to} to={l.to} end={l.end} title={l.label}>
              {({ isActive }) => (
                <div
                  className={cn(
                    'group relative flex items-center justify-center gap-3 rounded-xl px-0 py-2.5 text-sm font-medium transition-all duration-200 lg:justify-start lg:px-3',
                    isActive
                      ? 'bg-white/[0.08] text-white'
                      : 'text-sidebar-foreground hover:bg-white/[0.04] hover:text-white'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      isActive ? 'text-accent' : 'text-sidebar-muted group-hover:text-white'
                    )}
                  />
                  <span className="hidden lg:inline">{l.label}</span>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="m-2 rounded-xl bg-white/[0.04] p-2 lg:m-3 lg:p-3">
        <div className="flex items-center justify-center gap-3 lg:justify-start">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow-soft">
            {initials}
          </div>
          <div className="hidden min-w-0 flex-1 leading-tight lg:block">
            <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
            <div className="text-[11px] text-sidebar-muted">{roleLabel[user?.role] || user?.role}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              nav('/login');
            }}
            title="Sign out"
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white lg:flex"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
