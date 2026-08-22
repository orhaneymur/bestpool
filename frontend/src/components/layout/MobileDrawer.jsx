import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Users,
  ClipboardList,
  FolderOpen,
  Settings,
  SlidersHorizontal,
  UserRound,
  Waves,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { cn } from '@/lib/utils.js';
import { APP_VERSION, APP_BUILD, APP_LABEL } from '@/version.js';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/quotes/new', label: 'New Contract', icon: FilePlus2 },
  /**
   * One entry, not three. Existing / Saved / Completed were three names for the
   * same screen with a different query string, so the sidebar listed one page
   * three times and none of them looked like the others. The statuses are tabs
   * inside the page now.
   */
  { to: '/quotes', label: 'Contracts', icon: FileText, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services', label: 'Services', icon: ClipboardList },
  { to: '/templates', label: 'Templates', icon: FolderOpen },
  { to: '/definitions', label: 'Definitions', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'User Profile', icon: UserRound },
];

const roleLabel = { admin: 'Administrator', sales: 'Office Staff', viewer: 'Read Only' };

export default function MobileDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,300px)] flex-col bg-sidebar text-sidebar-foreground shadow-paper lg:hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-inset ring-accent/30">
                  <Waves className="h-5 w-5" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold text-white">Four Seasons</div>
                  <div className="truncate text-[11px] text-sidebar-muted">Pool Management</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
              {links.map((l) => {
                const Icon = l.icon;
                return (
                  <NavLink key={l.to} to={l.to} end={l.end} onClick={onClose}>
                    {({ isActive }) => (
                      <div
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-white/[0.1] text-white'
                            : 'text-sidebar-foreground hover:bg-white/[0.05] hover:text-white'
                        )}
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-accent' : 'text-sidebar-muted')} />
                        <span className="truncate">{l.label}</span>
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="mb-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70">
                  Version
                </div>
                <div className="mt-0.5 text-xs font-semibold text-white">
                  v{APP_VERSION}
                  <span className="ml-1.5 font-mono text-[10px] font-normal text-sidebar-muted">{APP_BUILD}</span>
                </div>
                <div className="truncate text-[10px] text-sidebar-muted">{APP_LABEL}</div>
              </div>
              <div className="mb-2 px-2 text-xs text-sidebar-muted">
                {user?.name}
                {user?.role ? ` · ${roleLabel[user.role] || user.role}` : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                  nav('/login');
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-rose-300 hover:bg-white/[0.05]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
