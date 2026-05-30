import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ROLE_ORDER = { guest: 0, individual: 1, advisor: 2, admin: 3 };

export default function ProtectedRoute({ children, requiredRole = 'individual' }) {
  const { user, role, loading, profileExists } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ color: '#64748b', fontSize: 15 }}>Loading…</div>
    </div>
  );

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authenticated but no profiles row — send to registration wizard.
  // Skip if already on /register to avoid loops.
  if (profileExists === false && location.pathname !== '/register') {
    return <Navigate to="/register" replace />;
  }

  const effectiveRole = role || 'individual';
  const hasAccess =
    (ROLE_ORDER[effectiveRole] ?? 0) >= (ROLE_ORDER[requiredRole] ?? 0);

  if (!hasAccess) {
    return <Navigate to="/upgrade" replace />;
  }

  return children;
}
