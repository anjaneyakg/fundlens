// src/advisor/AdvisorDashboard.jsx
// PH3-S1 — Advisor Dashboard
// Route: /advisor  (ProtectedRoute requiredRole="advisor")

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useWindowWidth from '../hooks/useWindowWidth'
import { createSupabaseClient, supabase } from '../lib/supabaseClient'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const WIDGETS = [
  { id: 'my_assets',         label: 'My Assets' },
  { id: 'client_list',       label: 'Client List' },
  { id: 'health_snapshot',   label: 'Health Snapshot' },
  { id: 'alerts',            label: 'Alerts' },
  { id: 'market_indicators', label: 'Market Indicators' },
  { id: 'promote_shortcut',  label: 'Promote' },
]

const BSE_INDEX_NAMES = ['NIFTY 50', 'SENSEX', 'NIFTY MID 150']

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayDateStr() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function loadWidgetPrefs(uid) {
  try {
    const raw = localStorage.getItem(`advisor_widget_prefs_${uid}`)
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.error('[AdvisorDashboard] loadWidgetPrefs parse error:', err)
    return {}
  }
}

function saveWidgetPrefs(uid, prefs) {
  try {
    localStorage.setItem(`advisor_widget_prefs_${uid}`, JSON.stringify(prefs))
  } catch (err) {
    console.error('[AdvisorDashboard] saveWidgetPrefs error:', err)
  }
}

// default true if not explicitly set to false
function isVisible(prefs, id) {
  return prefs[id] !== false
}

// ── PRIMITIVE COMPONENTS ──────────────────────────────────────────────────────

function EyeOffIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ToggleSwitch({ on, onChange }) {
  return (
    <button
      onClick={onChange}
      aria-label={on ? 'Hide widget' : 'Show widget'}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 11,
        background: on ? 'var(--color-primary)' : '#cbd5e1',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

function WidgetCard({ title, onHide, children }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {title}
        </span>
        <button
          onClick={onHide}
          title="Hide widget"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: 'var(--color-text-muted)', borderRadius: 6,
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
        >
          <EyeOffIcon size={15} />
        </button>
      </div>
      {children}
    </div>
  )
}

function StatTile({ label, value, sub, note, onClick, highlight }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 14px', textAlign: 'center',
        background: highlight ? 'rgba(29,158,117,0.06)' : 'var(--color-surface)',
        border: `1px solid ${highlight ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: -0.5, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, fontWeight: 500 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>
      )}
      {note && (
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
          {note}
        </div>
      )}
    </div>
  )
}

// ── WIDGET 1: MY ASSETS ───────────────────────────────────────────────────────

function MyAssetsWidget({ clients, onHide, isMobile }) {
  return (
    <WidgetCard title="My Assets" onHide={onHide}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
        <StatTile
          label="Total AUM"
          value="₹0"
          sub="Across all active clients"
          note="Portfolio data populates once clients upload CAS"
        />
        <StatTile
          label="Total Clients"
          value={clients.length}
          sub="Unique active clients"
        />
        <StatTile
          label="Total Families"
          value={0}
          sub="Linked family groups"
          note="Family linking not yet built"
        />
      </div>
    </WidgetCard>
  )
}

// ── WIDGET 2: CLIENT LIST ─────────────────────────────────────────────────────

function ClientListWidget({ clients, healthFilter, onHide }) {
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState('az')

  const displayName = (c) => {
    if (c.client_label) return c.client_label
    if (c.client_profile?.email) return c.client_profile.email
    return `Client ${(c.client_id || '').slice(0, 8)}…`
  }

  let shown = [...clients]
  // Health filter — no-op for now (all health is "No data" until portfolio upload)
  // sort
  if (sortBy === 'az') {
    shown.sort((a, b) => displayName(a).localeCompare(displayName(b)))
  }
  // 'aum' and 'health' are placeholder sorts — order is unchanged (all equal)

  return (
    <WidgetCard title="Client List" onHide={onHide}>
      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
            No active clients yet.
          </div>
          <div style={{ fontSize: 12 }}>
            Share your advisor invite link to get started.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                fontSize: 12, padding: '4px 8px', cursor: 'pointer',
                border: '1px solid var(--color-border)', borderRadius: 6,
                background: 'var(--color-bg)', color: 'var(--color-text-primary)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <option value="az">A–Z</option>
              <option value="aum">AUM: high to low</option>
              <option value="health">Health: low to high</option>
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Client', 'AUM', 'XIRR', 'Health', 'Alerts', 'Last updated'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 10px',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(c => (
                  <tr
                    key={c.client_id}
                    onClick={() => navigate(`/advisor/client/${c.client_id}`)}
                    style={{
                      borderBottom: '1px solid var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '9px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {displayName(c)}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--color-text-secondary)' }}>₹0</td>
                    <td style={{ padding: '9px 10px', color: 'var(--color-text-secondary)' }}>—</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: '#f1f5f9', color: '#64748b', fontWeight: 500,
                      }}>No data</span>
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--color-text-secondary)' }}>0</td>
                    <td style={{ padding: '9px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDate(c.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </WidgetCard>
  )
}

// ── WIDGET 3: HEALTH SNAPSHOT ─────────────────────────────────────────────────

function HealthSnapshotWidget({ clients, healthFilter, onHealthFilter, onHide }) {
  // Health scores populate once clients complete portfolio upload
  const green = 0, amber = 0, red = 0

  const toggle = (tier) => onHealthFilter(healthFilter === tier ? null : tier)

  if (clients.length === 0) {
    return (
      <WidgetCard title="Health Snapshot" onHide={onHide}>
        <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Add clients to see health distribution
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Health Snapshot" onHide={onHide}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatTile
          label="Healthy"
          value={green}
          sub="Green"
          onClick={() => toggle('green')}
          highlight={healthFilter === 'green'}
        />
        <StatTile
          label="Needs attention"
          value={amber}
          sub="Amber"
          onClick={() => toggle('amber')}
          highlight={healthFilter === 'amber'}
        />
        <StatTile
          label="At risk"
          value={red}
          sub="Red"
          onClick={() => toggle('red')}
          highlight={healthFilter === 'red'}
        />
      </div>
      {healthFilter && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button
            onClick={() => onHealthFilter(null)}
            style={{
              fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}
    </WidgetCard>
  )
}

// ── WIDGET 4: ALERTS ──────────────────────────────────────────────────────────

function AlertsWidget({ onHide }) {
  // TODO PH4: query per-client alerts from alerts table
  return (
    <WidgetCard title="Alerts" onHide={onHide}>
      <div style={{ textAlign: 'center', padding: '28px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          No alerts at this time.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Alerts will appear here as client triggers fire.
        </div>
      </div>
    </WidgetCard>
  )
}

// ── WIDGET 5: MARKET INDICATORS ───────────────────────────────────────────────

function SentimentBadge({ score, label }) {
  let bg = '#f1f5f9', color = '#64748b'
  if (score !== null && score !== undefined) {
    if (score >= 1)  { bg = '#dcfce7'; color = '#16a34a' }
    if (score <= -1) { bg = '#fee2e2'; color = '#dc2626' }
  }
  const sign = score > 0 ? '+' : ''
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 0', borderBottom: '1px solid var(--color-surface)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 600, padding: '2px 10px',
        borderRadius: 20, background: bg, color,
      }}>
        {score !== null && score !== undefined ? `${sign}${score}` : '—'}
      </span>
    </div>
  )
}

function MarketIndicatorsWidget({ bseData, sentiment, onHide }) {
  return (
    <WidgetCard title="Market Indicators" onHide={onHide}>
      {/* BSE Indices */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>
          Indices
        </div>
        {BSE_INDEX_NAMES.map(name => {
          const row = bseData[name]
          if (!row) {
            return (
              <div key={name} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid var(--color-surface)', fontSize: 13,
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              </div>
            )
          }
          const changePos = (row.points_change ?? 0) >= 0
          return (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: '1px solid var(--color-surface)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {name}
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {row.close?.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: changePos ? '#16a34a' : '#dc2626' }}>
                  {changePos ? '+' : ''}{row.points_change?.toFixed(2)}&nbsp;
                  ({changePos ? '+' : ''}{row.change_pct?.toFixed(2)}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AIrrow Sentiment */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>
          AIrrow Sentiment
        </div>
        {sentiment ? (
          <>
            <SentimentBadge score={sentiment.large_cap_score} label="Large Cap" />
            <SentimentBadge score={sentiment.mid_cap_score}   label="Mid Cap" />
            <SentimentBadge score={sentiment.gold_score}      label="Gold" />
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 8 }}>
              AIrrow sentiment · {fmtDate(sentiment.archive_date)}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 0' }}>
            No sentiment data yet.
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

// ── WIDGET 6: PROMOTE SHORTCUT ────────────────────────────────────────────────

function PromoteShortcutWidget({ promoStats, onHide }) {
  const navigate = useNavigate()
  return (
    <WidgetCard title="Promote" onHide={onHide}>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        {promoStats.leaflets > 0 || promoStats.email > 0 || promoStats.whatsapp > 0 ? (
          <>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{promoStats.leaflets}</span> leaflet
            {promoStats.leaflets !== 1 ? 's' : ''}&nbsp;·&nbsp;
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{promoStats.email}</span> email draft
            {promoStats.email !== 1 ? 's' : ''}&nbsp;·&nbsp;
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{promoStats.whatsapp}</span> WhatsApp template
            {promoStats.whatsapp !== 1 ? 's' : ''}
          </>
        ) : (
          'Co-branded marketing materials for client acquisition.'
        )}
      </div>
      <button
        onClick={() => navigate('/advisor/promote')}
        style={{
          padding: '9px 20px',
          background: 'var(--color-primary)', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Open Promote module
      </button>
    </WidgetCard>
  )
}

// ── MANAGE WIDGETS DRAWER ─────────────────────────────────────────────────────

function ManageWidgetsDrawer({ prefs, onChange, onClose }) {
  const drawerRef = useRef(null)

  // Close on outside click (backdrop handles it) — also close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function handleReset() {
    const resetPrefs = Object.fromEntries(WIDGETS.map(w => [w.id, true]))
    onChange(resetPrefs)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 501,
          width: 'min(320px, 85vw)',
          background: 'var(--color-bg)',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Manage Widgets
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, border: '1px solid var(--color-border)',
              borderRadius: 8, background: 'var(--color-bg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--color-text-secondary)',
            }}
          >✕</button>
        </div>

        {/* Widget list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {WIDGETS.map(w => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 20px', borderBottom: '1px solid var(--color-surface)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{w.label}</span>
              <ToggleSwitch
                on={isVisible(prefs, w.id)}
                onChange={() => onChange({ ...prefs, [w.id]: !isVisible(prefs, w.id) })}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <button
            onClick={handleReset}
            style={{
              width: '100%', padding: '10px', cursor: 'pointer',
              border: '1.5px solid var(--color-border)', borderRadius: 8,
              background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function AdvisorDashboard() {
  const navigate = useNavigate()
  const { user, token, loading: authLoading } = useAuth()
  const { isAdvisor, isAdmin } = useRole()
  const width = useWindowWidth()
  const isMobile = width <= 768

  // Widget preferences — uid-scoped
  const [prefs, setPrefs]               = useState({})
  const prefsLoaded                     = useRef(false)

  // Dashboard data
  const [clients, setClients]           = useState([])
  const [bseData, setBseData]           = useState({})      // { [index_name]: row }
  const [sentiment, setSentiment]       = useState(null)
  const [loadingData, setLoadingData]   = useState(true)

  // Promote stats — count of active templates per category
  const [promoStats, setPromoStats]     = useState({ leaflets: 0, email: 0, whatsapp: 0 })

  // UI state
  const [healthFilter, setHealthFilter] = useState(null)    // null | 'green' | 'amber' | 'red'
  const [manageOpen, setManageOpen]     = useState(false)

  // ── Prefs: load once uid is known ────────────────────────────────────────────
  useEffect(() => {
    if (!user || prefsLoaded.current) return
    setPrefs(loadWidgetPrefs(user.uid))
    prefsLoaded.current = true
  }, [user])

  const handlePrefsChange = useCallback((newPrefs) => {
    setPrefs(newPrefs)
    if (user) saveWidgetPrefs(user.uid, newPrefs)
  }, [user])

  const hideWidget = useCallback((id) => {
    setPrefs(prev => {
      const next = { ...prev, [id]: false }
      if (user) saveWidgetPrefs(user.uid, next)
      return next
    })
  }, [user])

  // ── Supabase data fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token || (!isAdvisor && !isAdmin)) return

    const sb = createSupabaseClient(token)
    let cancelled = false

    async function fetchAll() {
      setLoadingData(true)

      // ── advisor_client_links with profiles embed ───────────────────────────
      try {
        const { data, error } = await sb
          .from('advisor_client_links')
          .select(`
            client_id,
            client_label,
            relationship_since,
            updated_at,
            client_profile:profiles!client_id(id, email)
          `)
          .eq('advisor_id', user.uid)
          .eq('status', 'active')

        if (error) {
          console.error('[AdvisorDashboard] advisor_client_links fetch error:', error)
        } else if (!cancelled) {
          setClients(data || [])
        }
      } catch (err) {
        console.error('[AdvisorDashboard] clients fetch failed:', err)
      }

      // ── bse_index_data (public table — anon client is fine) ───────────────
      try {
        const { data, error } = await supabase
          .from('bse_index_data')
          .select('index_name, date, close, points_change, change_pct')
          .in('index_name', BSE_INDEX_NAMES)
          .order('date', { ascending: false })
          .limit(15)

        if (error) {
          console.error('[AdvisorDashboard] bse_index_data fetch error:', error)
        } else if (!cancelled && data) {
          // Most-recent row per index name
          const latest = {}
          for (const row of data) {
            if (!latest[row.index_name]) latest[row.index_name] = row
          }
          setBseData(latest)
        }
      } catch (err) {
        console.error('[AdvisorDashboard] BSE data fetch failed:', err)
      }

      // ── airrow_sentiment_archive — latest row ─────────────────────────────
      try {
        const { data, error } = await supabase
          .from('airrow_sentiment_archive')
          .select('archive_date, large_cap_score, mid_cap_score, gold_score')
          .order('archive_date', { ascending: false })
          .limit(1)

        if (error) {
          console.error('[AdvisorDashboard] airrow_sentiment_archive fetch error:', error)
        } else if (!cancelled) {
          setSentiment(data && data.length > 0 ? data[0] : null)
        }
      } catch (err) {
        console.error('[AdvisorDashboard] sentiment fetch failed:', err)
      }

      // ── promo_messages — count active templates per category ──────────────
      try {
        const { data: promoData, error: promoErr } = await supabase
          .from('promo_messages')
          .select('category')
          .eq('is_active', true)

        if (promoErr) {
          console.error('[AdvisorDashboard] promo_messages fetch error:', promoErr)
        } else if (!cancelled && promoData) {
          const stats = { leaflets: 0, email: 0, whatsapp: 0 }
          for (const row of promoData) {
            if (row.category === 'leaflet')   stats.leaflets++
            if (row.category === 'email')     stats.email++
            if (row.category === 'whatsapp')  stats.whatsapp++
          }
          setPromoStats(stats)
        }
      } catch (err) {
        console.error('[AdvisorDashboard] promo_messages fetch failed:', err)
      }

      if (!cancelled) setLoadingData(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [user, token, isAdvisor, isAdmin])

  // ── Auth / role gates ─────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: "'DM Sans', sans-serif",
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isAdvisor && !isAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🔒</div>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)',
            margin: '0 0 12px',
          }}>
            You need an Advisor account to access this page.
          </h2>
          <p style={{
            fontSize: 14, color: 'var(--color-text-secondary)',
            marginBottom: 28, lineHeight: 1.6,
          }}>
            Upgrade to an Advisor plan to unlock multi-client analytics, health snapshots, and more.
          </p>
          <a
            href="/advisor/apply"
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '10px 24px',
              background: 'var(--color-primary)', color: '#fff',
              borderRadius: 10, textDecoration: 'none',
              fontWeight: 600, fontSize: 14,
            }}
          >
            Apply for Advisor Access
          </a>
        </div>
      </div>
    )
  }

  // ── Resolved values ───────────────────────────────────────────────────────────
  const firstName    = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Advisor'
  const todayDisplay = fmtDate(todayDateStr())

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '20px 16px 40px' : '32px 28px 48px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 28, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? 22 : 26, fontWeight: 700,
              color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2,
            }}>
              {getGreeting()}, {firstName}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {todayDisplay}
            </div>
          </div>

          <button
            onClick={() => setManageOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              border: '1.5px solid var(--color-border)', borderRadius: 10,
              background: 'var(--color-bg)', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'border-color 0.15s',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>⊞</span>
            Manage Widgets
          </button>
        </div>

        {/* ── Widget grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          {/* My Assets — full width */}
          {isVisible(prefs, 'my_assets') && (
            <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
              <MyAssetsWidget
                clients={clients}
                onHide={() => hideWidget('my_assets')}
                isMobile={isMobile}
              />
            </div>
          )}

          {/* Client List — full width (table needs horizontal space) */}
          {isVisible(prefs, 'client_list') && (
            <div style={{ gridColumn: isMobile ? undefined : '1 / -1' }}>
              <ClientListWidget
                clients={clients}
                healthFilter={healthFilter}
                onHide={() => hideWidget('client_list')}
              />
            </div>
          )}

          {/* Health Snapshot — half width on desktop */}
          {isVisible(prefs, 'health_snapshot') && (
            <HealthSnapshotWidget
              clients={clients}
              healthFilter={healthFilter}
              onHealthFilter={setHealthFilter}
              onHide={() => hideWidget('health_snapshot')}
            />
          )}

          {/* Alerts — half width on desktop */}
          {isVisible(prefs, 'alerts') && (
            <AlertsWidget onHide={() => hideWidget('alerts')} />
          )}

          {/* Market Indicators — half width on desktop */}
          {isVisible(prefs, 'market_indicators') && (
            <MarketIndicatorsWidget
              bseData={bseData}
              sentiment={sentiment}
              onHide={() => hideWidget('market_indicators')}
            />
          )}

          {/* Promote shortcut — half width on desktop */}
          {isVisible(prefs, 'promote_shortcut') && (
            <PromoteShortcutWidget
              promoStats={promoStats}
              onHide={() => hideWidget('promote_shortcut')}
            />
          )}
        </div>

        {/* Loading overlay during initial data fetch */}
        {loadingData && clients.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            fontSize: 13, color: 'var(--color-text-muted)',
          }}>
            Fetching dashboard data…
          </div>
        )}
      </div>

      {/* Manage Widgets Drawer */}
      {manageOpen && (
        <ManageWidgetsDrawer
          prefs={prefs}
          onChange={handlePrefsChange}
          onClose={() => setManageOpen(false)}
        />
      )}
    </>
  )
}
