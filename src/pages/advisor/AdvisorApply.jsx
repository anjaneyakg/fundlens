// src/pages/advisor/AdvisorApply.jsx
// PH3-S1 stub — full application form coming in a later phase

export default function AdvisorApply() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 20, background: '#f8f9fa',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e8ecf0',
        borderRadius: 16,
        padding: '48px 36px',
        maxWidth: 420,
        textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A3C6E', margin: '0 0 12px' }}>
          Advisor Application
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
          Advisor application coming soon.
        </p>
      </div>
    </div>
  )
}
