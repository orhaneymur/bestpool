import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/**
 * Minimal toast stack, added because long operations had no visible state at
 * all: an export that took two minutes, or failed outright, looked identical to
 * a button that did nothing.
 *
 * A toast is created with notify() and mutated in place with update(id, patch),
 * so one notification can carry a download from "Preparing…" through a progress
 * percentage to either "Downloaded" or an error the user can actually read.
 */
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  /** A toast with a `timeout` disappears on its own; one without it stays put. */
  const scheduleDismiss = useCallback(
    (id, timeout) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      if (!timeout) {
        timers.current.delete(id);
        return;
      }
      timers.current.set(id, setTimeout(() => dismiss(id), timeout));
    },
    [dismiss]
  );

  const notify = useCallback(
    ({ title, description = '', variant = 'info', progress = null, timeout = 5000 }) => {
      nextId += 1;
      const id = nextId;
      setToasts((list) => [...list, { id, title, description, variant, progress }]);
      scheduleDismiss(id, timeout);
      return id;
    },
    [scheduleDismiss]
  );

  const update = useCallback(
    (id, patch) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if ('timeout' in patch) scheduleDismiss(id, patch.timeout);
    },
    [scheduleDismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify, update, dismiss }), [notify, update, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
  info: Loader2,
  progress: Loader2,
  success: CheckCircle2,
  error: AlertTriangle,
};

const TONES = {
  info: 'border-border bg-card text-foreground',
  progress: 'border-accent/40 bg-card text-foreground',
  success: 'border-emerald-500/40 bg-card text-foreground',
  error: 'border-destructive/40 bg-card text-foreground',
};

function Toast({ toast, onDismiss }) {
  const Icon = ICONS[toast.variant] || ICONS.info;
  const spinning = toast.variant === 'info' || toast.variant === 'progress';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto overflow-hidden rounded-xl border px-3 py-2.5 shadow-soft',
        TONES[toast.variant] || TONES.info
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            spinning && 'animate-spin text-accent',
            toast.variant === 'success' && 'text-emerald-600',
            toast.variant === 'error' && 'text-destructive'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description && (
            <div className="mt-0.5 break-words text-xs text-muted-foreground">{toast.description}</div>
          )}
          {typeof toast.progress === 'number' && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.max(2, Math.min(100, toast.progress))}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
