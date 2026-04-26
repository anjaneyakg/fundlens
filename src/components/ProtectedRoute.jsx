import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const TIER_ORDER = { public: 0, investor: 1, advisor: 2, alpha: 3 };
const TIER_LABELS = { investor: 'Investor', advisor: 'Advisor', alpha: 'Alpha' };
const TIER_COLORS = {
  investor: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  advisor:  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  alpha:    { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
};

export default function ProtectedRoute({ children, tier = 'investor' }) {
  const { isAuthenticated, tier: userTier, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ color: '#64748b', fontSize: 15 }}>Loading…</div>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  const hasAccess = (TIER_ORDER[userTier] || 0) >= (TIER_ORDER[tier] || 0);
  if (!hasAccess) {
    const c = TIER_COLORS[tier] || TIER_COLORS.investor;
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 16, padding: '2.5rem 2rem' }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>
            {TIER_LABELS[tier] || tier} Access Required
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: '0 0 12px' }}>This tool is not available on your plan</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
            You are on the <strong>{userTier}</strong> tier. This tool requires <strong>{TIER_LABELS[tier] || tier}</strong> access.
          </p>
          <a href="mailto:support@fundlens.in" style={{ display: 'inline-block', padding: '10px 24px', background: '#4338ca', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Contact us to upgrade
          </a>
        </div>
      </div>
    );
  }
  return children;
}
