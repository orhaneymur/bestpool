import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const roleLabel = { admin: 'Yönetici', sales: 'Satış', viewer: 'Görüntüleyici' };

  const links = [
    { to: '/', label: 'Panel', icon: '📊', end: true },
    { to: '/quotes', label: 'Teklifler', icon: '📄' },
    { to: '/customers', label: 'Müşteriler (Cari)', icon: '👥' },
    { to: '/services', label: 'Hizmet Kataloğu', icon: '🧾' },
    { to: '/templates', label: 'Sözleşme Şablonları', icon: '📁' },
    { to: '/settings', label: 'Ayarlar', icon: '⚙️' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🏊 Havuz Teklif<br />& Cari Sistemi</div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span style={{ fontSize: 16 }}>{l.icon}</span> <span>{l.label}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="userbox">
          <div style={{ fontWeight: 700, color: '#fff' }}>{user?.name}</div>
          <div>{roleLabel[user?.role] || user?.role}</div>
          <button className="ghost" style={{ color: '#ffd', paddingLeft: 0, marginTop: 6 }}
            onClick={() => { logout(); nav('/login'); }}>Çıkış Yap →</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
