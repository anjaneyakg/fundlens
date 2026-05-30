// src/pages/AdminLayout.jsx
// Admin console shell. Route is already gated by ProtectedRoute requiredRole="admin".
// PH3-S4: Added notification bell to sidebar header. Polls every 60s for unread count.

import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createSupabaseClient } from '../lib/supabaseClient';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const NAV_ITEMS = [
  {
    group: 'Data Pipeline',
    items: [
      { to: '/admin/portfolio-upload', label: 'Portfolio Upload', icon: '⬆', live: true  },
      { to: '/admin/coverage',         label: 'Coverage',         icon: '◈', live: true  },
      { to: '/admin/scheme-mapping',   label: 'Scheme Mapping',   icon: '◈', live: true  },
      { to: '/admin/amfi-marketcap',   label: 'AMFI Market Cap',  icon: '◉', live: true  },
      { to: '/admin/amc-directory',    label: 'AMC Directory',    icon: '◎', live: false },
    ],
  },
  {
    group: 'Access Control',
    items: [
      { to: '/admin/users',        label: 'User Manager',       icon: '◈', live: true  },
      { to: '/admin/applications', label: 'Advisor Applications', icon: '◈', live: true },
      { to: '/admin/tool-access',  label: 'Tool Access Matrix', icon: '◈', live: true  },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/admin/security-master', label: 'Security Master', icon: '◆', live: false },
      { to: '/admin/settings',        label: 'Settings',        icon: '◇', live: false },
    ],
  },
];

const ROLE_COLOR = {
  admin:      '#7e22ce',
  advisor:    '#15803d',
  individual: '#1d4ed8',
};

const NOTIF_TYPE_ICON = {
  new_advisor_application:     '👤',
  new_investor_registration:   '🆕',
  advisor_approved:            '✅',
  advisor_rejected:            '❌',
  admin_registered_advisor:    '🔧',
};

// ── Bell SVG ─────────────────────────────────────────────────────────────────
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ token }) {
  const [unread,       setUnread]       = useState(0)
  const [notifs,       setNotifs]       = useState([])
  const [dropOpen,     setDropOpen]     = useState(false)
  const [loadingNotifs,setLoadingNotifs]= useState(false)
  const dropRef = useRef(null)

  async function fetchCount() {
    if (!token) return
    try {
      const sb = createSupabaseClient(token)
      const { count, error } = await sb
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
      if (!error && count !== null) setUnread(count)
    } catch (err) {
      console.error('[AdminLayout] fetchCount error:', err)
    }
  }

  async function fetchNotifs() {
    if (!token) return
    setLoadingNotifs(true)
    try {
      const sb = createSupabaseClient(token)
      const { data, error } = await sb
        .from('admin_notifications')
        .select('id,type,message,read,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (!error) setNotifs(data || [])
    } catch (err) {
      console.error('[AdminLayout] fetchNotifs error:', err)
    } finally {
      setLoadingNotifs(false)
    }
  }

  async function markRead(id) {
    if (!token) return
    try {
      const sb = createSupabaseClient(token)
      await sb.from('admin_notifications').update({ read: true }).eq('id', id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('[AdminLayout] markRead error:', err)
    }
  }

  async function markAllRead() {
    if (!token) return
    try {
      const sb = createSupabaseClient(token)
      await sb.from('admin_notifications').update({ read: true }).eq('read', false)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch (err) {
      console.error('[AdminLayout] markAllRead error:', err)
    }
  }

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 60000)
    return () => clearInterval(id)
  }, [token])

  // Close dropdown on outside click
  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleBellClick() {
    const next = !dropOpen
    setDropOpen(next)
    if (next) fetchNotifs()
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} ref={dropRef}>
      <button
        onClick={handleBellClick}
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: '1px solid rgba(99,102,241,0.2)',
          background: 'rgba(99,102,241,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#6366f1',
          position: 'relative',
        }}
        title="Admin notifications"
        aria-label="Admin notifications"
      >
        <BellIcon />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px #fff',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {dropOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 500,
          width: 320, background: '#fff',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          {/* Dropdown header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid #f1f5f9',
            background: '#faf5ff',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#6366f1',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loadingNotifs && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Loading…
              </div>
            )}
            {!loadingNotifs && notifs.length === 0 && (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No notifications
              </div>
            )}
            {!loadingNotifs && notifs.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '11px 14px',
                  borderBottom: '1px solid #f8fafc',
                  background: n.read ? '#fff' : '#faf5ff',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {NOTIF_TYPE_ICON[n.type] || '🔔'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.45, marginBottom: 3 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(n.created_at)}</div>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    style={{
                      fontSize: 10, fontWeight: 600, color: '#6366f1',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 4px', flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminLayout ───────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, role, token, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div style={s.shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .al-link { text-decoration: none; display: block; }
        .al-link .al-inner {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; border-radius: 10px;
          font-size: 13.5px; font-weight: 500; color: #6b7280;
          transition: all 0.15s; cursor: pointer;
        }
        .al-link:hover .al-inner { background: rgba(99,102,241,0.07); color: #4f46e5; }
        .al-link.active .al-inner {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          color: #4f46e5;
          box-shadow: 0 1px 6px rgba(99,102,241,0.15);
        }
        .al-link.active .al-icon { color: #7c3aed; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        {/* Logo + bell */}
        <div style={s.logoWrap}>
          <div style={s.logoBox}><span style={s.logoText}>FL</span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.logoName}>FundLens</div>
            <div style={s.logoTag}>Admin Console</div>
          </div>
          <NotificationBell token={token} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 0.75rem' }}>
          {NAV_ITEMS.map((group) => (
            <div key={group.group} style={s.group}>
              <span style={s.groupLabel}>{group.group}</span>
              {group.items.map((item) =>
                item.live ? (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => isActive ? 'al-link active' : 'al-link'}
                  >
                    <div className="al-inner">
                      <span className="al-icon" style={s.icon}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={s.liveDot} />
                    </div>
                  </NavLink>
                ) : (
                  <div key={item.to} style={s.disabledItem}>
                    <span style={s.icon}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={s.soonPill}>soon</span>
                  </div>
                )
              )}
            </div>
          ))}
        </nav>

        {/* Footer — user info + sign-out */}
        <div style={s.footerWrap}>
          <div style={s.userCard}>
            <div style={s.avatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userEmail} title={user?.email || ''}>
                {user?.email || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  ...s.roleBadge,
                  color:      ROLE_COLOR[role] || '#475569',
                  background: ROLE_COLOR[role] ? ROLE_COLOR[role] + '18' : '#f1f5f9',
                }}>
                  {role || 'loading…'}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              style={s.signOutBtn}
              title="Sign out"
              aria-label="Sign out"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell: {
    display: 'flex', minHeight: '100vh',
    background: 'linear-gradient(140deg, #f8f7ff 0%, #f0f9ff 50%, #f0fdf4 100%)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  sidebar: {
    width: 252, minHeight: '100vh', flexShrink: 0,
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(16px)',
    borderRight: '1px solid rgba(99,102,241,0.1)',
    boxShadow: '2px 0 20px rgba(99,102,241,0.07)',
    display: 'flex', flexDirection: 'column',
    padding: '1.5rem 0',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 1.25rem 1.5rem',
    borderBottom: '1px solid rgba(99,102,241,0.08)',
    marginBottom: '1.25rem',
  },
  logoBox: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  },
  logoText: { fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },
  logoName: { fontSize: 15, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2 },
  logoTag:  { fontSize: 11, fontWeight: 600, color: '#8b5cf6', letterSpacing: '0.04em' },
  group:    { marginBottom: '1.5rem' },
  groupLabel: {
    display: 'block', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#c4b5fd', padding: '0 12px', marginBottom: '0.35rem',
  },
  icon:      { fontSize: 12, width: 16, textAlign: 'center', flexShrink: 0 },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#10b981', boxShadow: '0 0 0 2px #d1fae5',
    display: 'inline-block', flexShrink: 0,
  },
  disabledItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 12px', borderRadius: 10,
    fontSize: 13.5, fontWeight: 500, color: '#d1d5db', cursor: 'default',
  },
  soonPill: {
    fontSize: 10, fontWeight: 600, color: '#c4b5fd',
    background: '#f5f3ff', border: '1px solid #e9d5ff',
    borderRadius: 20, padding: '2px 8px',
  },
  footerWrap: { padding: '0 0.75rem', marginTop: 'auto', paddingTop: '0.75rem' },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
    border: '1px solid #ddd6fe', borderRadius: 12, padding: '10px 12px',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.02em',
  },
  userEmail: {
    fontSize: 11, fontWeight: 600, color: '#3730a3',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    maxWidth: 110,
  },
  roleBadge: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', padding: '2px 7px',
    borderRadius: 20, display: 'inline-block',
  },
  signOutBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: '#94a3b8', padding: '2px 4px',
    borderRadius: 6, transition: 'color 0.15s',
    flexShrink: 0,
  },
  main: { flex: 1, padding: '2.5rem 3rem', overflowY: 'auto' },
};
