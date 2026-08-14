import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

/**
 * Every page except the login screen loads on demand.
 *
 * The whole app used to ship as one bundle, so opening the login page also
 * downloaded and parsed the contract wizard, the live PDF preview and the
 * settings screens before anything could render. Login stays eager because it is
 * the first thing an unauthenticated visitor sees.
 */
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const Services = lazy(() => import('./pages/Services.jsx'));
const Templates = lazy(() => import('./pages/Templates.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Definitions = lazy(() => import('./pages/Definitions.jsx'));
const Quotes = lazy(() => import('./pages/Quotes.jsx'));
const QuoteForm = lazy(() => import('./pages/QuoteForm.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Private({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/quotes" element={<Private><Quotes /></Private>} />
      <Route path="/quotes/new" element={<Private><QuoteForm /></Private>} />
      <Route path="/quotes/:id" element={<Private><QuoteForm /></Private>} />
      <Route path="/customers" element={<Private><Customers /></Private>} />
      <Route path="/customers/:id" element={<Private><CustomerDetail /></Private>} />
      <Route path="/services" element={<Private><Services /></Private>} />
      <Route path="/templates" element={<Private><Templates /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/definitions" element={<Private><Definitions /></Private>} />
      <Route path="/profile" element={<Private><Profile /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
