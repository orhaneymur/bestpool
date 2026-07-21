import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import Services from './pages/Services.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';
import Quotes from './pages/Quotes.jsx';
import QuoteForm from './pages/QuoteForm.jsx';
import Profile from './pages/Profile.jsx';

function Private({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
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
      <Route path="/profile" element={<Private><Profile /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
