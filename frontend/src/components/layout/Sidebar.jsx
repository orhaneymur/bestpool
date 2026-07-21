import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  FileClock,
  FileCheck2,
  Users,
  ClipboardList,
  FolderOpen,
  Settings,
  UserRound,
  Waves,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';
import { APP_VERSION, APP_BUILD, APP_LABEL } from '@/version.js';

/** Spec dashboard navigation */
const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/quotes/new', label: 'New Contract', icon: FilePlus2 },
  { to: '/quotes', label: 'Existing Contracts', icon: FileText, end: true },
  { to: '/quotes?status=taslak', label: 'Saved Drafts', icon: FileClock },
  { to: '/quotes?status=kabul', label: 'Completed Contracts', icon: FileCheck2 },
  { to: '/customers', label: 'Customer Database', icon: Users },
  { to: '/services', label: 'Services', icon: ClipboardList },
  { to: '/templates', label: 'Templates', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'User Profile', icon: UserRound },
];

const roleLabel = { admin: 'Administrator', sales: 'Office Staff', viewer: 'Read Only' };

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
    <aside className="sticky top-0 z-40 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-inset ring-accent/30">
          <Waves className="h-5 w-5" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight text-white">Four Seasons</div>
          <div className="truncate text-[11px] text-sidebar-muted">Pool Management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/60">
          Menu
        </div>
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink key={l.to} to={l.to} end={l.end} title={l.label}>
              {({ isActive }) => (
                <div
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
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
                  <span className="truncate">{l.label}</span>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 px-3 pb-3 pt-2">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70">
            Version
          </div>
          <div className="mt-0.5 text-xs font-semibold text-white">
            v{APP_VERSION}
            <span className="ml-1.5 font-mono text-[10px] font-normal text-sidebar-muted">{APP_BUILD}</span>
          </div>
          <div className="truncate text-[10px] text-sidebar-muted">{APP_LABEL}</div>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow-soft">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
