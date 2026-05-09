import { useNavigate, Link } from 'react-router-dom';

export default function Upgrade() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      fontFamily: 'DM Sans, sans-serif',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 28px',
          boxShadow: '0 4px 24px rgba(29,158,117,0.15)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="var(--color-primary)" opacity="0.3" />
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '40px 36px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            Upgrade your plan
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.65, margin: '0 0 32px' }}>
            This feature is not available on your current plan.
            Upgrade to unlock Research, Track, and Advisor tools.
          </p>

          {/* Pricing hint */}
          <div style={{
            background: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 28,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Available plans
            </div>
            {[
              { label: 'Individual',    price: '₹199/mo', desc: 'Plan + Research + Track' },
              { label: 'Advisor — MFD', price: '₹999/mo', desc: 'All features + Promote (up to 50 clients)' },
              { label: 'Advisor — RIA', price: '₹2,499/mo', desc: 'All features + unlimited clients' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.desc}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap', marginLeft: 16 }}>{p.price}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/pricing"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: 44, padding: '0 28px',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 2px 12px rgba(29,158,117,0.25)',
              }}
            >
              View plans
            </Link>
            <button
              onClick={() => navigate(-1)}
              style={{
                height: 44, padding: '0 28px',
                background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)', borderRadius: 10,
                fontSize: 15, fontWeight: 500,
                fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
              }}
            >
              Go back
            </button>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--color-text-muted)' }}>
          Questions?{' '}
          <a href="mailto:support@fundlens.in" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
