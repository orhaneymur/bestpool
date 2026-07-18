import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './layout/Sidebar.jsx';
import Topbar from './layout/Topbar.jsx';

/** Pages still using the legacy CSS compatibility layer */
function isLegacyPath(pathname) {
  if (pathname === '/quotes') return true; // list page still legacy-styled
  if (pathname.startsWith('/quotes/')) return false; // wizard is new UI
  return ['/customers', '/services', '/templates', '/settings'].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const isLegacy = isLegacyPath(location.pathname);

  return (
    <div className="flex min-h-screen bg-background bg-grid">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`mx-auto w-full max-w-[1280px] ${isLegacy ? 'legacy' : ''}`}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
