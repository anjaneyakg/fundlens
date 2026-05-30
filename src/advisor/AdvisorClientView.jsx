// src/advisor/AdvisorClientView.jsx
// PH3-S1 stub — full PortfolioLens client view comes in PH3-S5
// Route: /advisor/client/:id

import { useParams, useNavigate } from 'react-router-dom'

export default function AdvisorClientView() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto',
      padding: '48px 24px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <button
        onClick={() => navigate('/advisor')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 32, padding: '8px 16px',
          border: '1.5px solid var(--color-border)', borderRadius: 9,
          background: 'var(--color-bg)', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        ← Back to Advisor Dashboard
      </button>

      <h1 style={{
        fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)',
        margin: '0 0 12px',
      }}>
        Client Portfolio View
      </h1>

      <p style={{
        fontSize: 15, color: 'var(--color-text-secondary)',
        lineHeight: 1.6, marginBottom: 32,
      }}>
        Full client PortfolioLens view coming in PH3-S5.
      </p>

      <div style={{
        display: 'inline-block',
        padding: '8px 16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontFamily: 'monospace', fontSize: 12,
        color: 'var(--color-text-muted)',
      }}>
        client_id: {id}
      </div>
    </div>
  )
}
