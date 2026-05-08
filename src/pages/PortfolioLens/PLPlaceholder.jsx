const ACC = '#1D9E75'

export default function PLPlaceholder({ code, name, tagline }) {
  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.codePill}>{code}</div>
        <h2 style={s.title}>{name}</h2>
        {tagline && <p style={s.tagline}>{tagline}</p>}
        <div style={s.badge}>Coming in a future session</div>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: '2rem',
  },
  card: {
    textAlign: 'center',
    padding: '3rem 4rem',
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    border: `1px solid ${ACC}22`,
    boxShadow: '0 4px 32px rgba(29,158,117,0.08)',
    maxWidth: 440,
  },
  codePill: {
    display: 'inline-block',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '4px 14px',
    borderRadius: 20,
    background: `${ACC}15`,
    color: ACC,
    border: `1px solid ${ACC}30`,
    marginBottom: '1.25rem',
  },
  title: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 24,
    fontWeight: 700,
    color: '#0d3d2b',
    margin: '0 0 0.5rem',
  },
  tagline: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14,
    color: '#6b9e8d',
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  badge: {
    display: 'inline-block',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: '#a0c8bc',
    background: '#f0fdf9',
    border: '1px solid #b2e0d4',
    borderRadius: 20,
    padding: '4px 14px',
    letterSpacing: '0.03em',
  },
}
