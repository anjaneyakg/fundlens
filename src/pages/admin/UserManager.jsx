// src/pages/admin/UserManager.jsx
// Admin page: /admin/users
// Lists all users, shows their tier, allows changing tier and toggling active status.
// Reads from public.users + user_roles. Writes via service-role API.

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const TIERS = ['public', 'investor', 'advisor', 'alpha'];

const TIER_STYLE = {
  public:   { bg: '#f1f5f9', text: '#475569' },
  investor: { bg: '#eef2ff', text: '#4338ca' },
  advisor:  { bg: '#f0fdf4', text: '#15803d' },
  alpha:    { bg: '#fdf4ff', text: '#7e22ce' },
};

const TIER_IDS = {
  public:   '00000000-0000-0000-0000-000000000001',
  investor: '00000000-0000-0000-0000-000000000002',
  advisor:  '00000000-0000-0000-0000-000000000003',
  alpha:    '00000000-0000-0000-0000-000000000004',
};

async function api(path, opts = {}) {
  const token = import.meta.env.VITE_GITHUB_PAT; // admin uses service-role via serverless
  const res = await fetch(`/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    ...opts,
  });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function sbFetch(path, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token || SUPABASE_ANON}` },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

export default function UserManager() {
  const { accessToken } = useAuth();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterTier, setFilter] = useState('all');
  const [saving, setSaving]     = useState(null); // userId being saved
  const [toast, setToast]       = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      // Fetch users with their tier via join
      const rows = await sbFetch(
        'users?select=id,email,full_name,created_at,last_login,user_roles(tier_id,tiers(name))',
        accessToken
      );
      const mapped = (rows || []).map(u => ({
        id:         u.id,
        email:      u.email || '—',
        full_name:  u.full_name || '—',
        created_at: u.created_at,
        last_login: u.last_login,
        tier:       u.user_roles?.[0]?.tiers?.name || 'investor',
        role_id:    u.user_roles?.[0]?.id || null,
      }));
      setUsers(mapped);
    } catch (err) {
      console.error('loadUsers error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function changeTier(userId, newTier) {
    setSaving(userId);
    try {
      const res = await fetch('/api/admin/set-user-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });
      if (!res.ok) throw new Error('Failed');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u));
      showToast(`Tier updated to ${newTier}`);
    } catch (err) {
      console.error('changeTier error:', err);
      showToast('Error updating tier');
    } finally {
      setSaving(null);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchTier = filterTier === 'all' || u.tier === filterTier;
    return matchSearch && matchTier;
  });

  // Tier counts for summary
  const counts = TIERS.reduce((acc, t) => {
    acc[t] = users.filter(u => u.tier === t).length;
    return acc;
  }, {});

  const S = {
    page: { fontFamily: 'DM Sans, sans-serif', padding: '0 0 40px' },
    header: { marginBottom: 28 },
    title: { fontSize: 22, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' },
    sub: { fontSize: 14, color: '#64748b', margin: 0 },
    statsRow: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
    stat: { background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', minWidth: 110 },
    statNum: { fontSize: 24, fontWeight: 600, color: '#0f172a' },
    statLbl: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    toolbar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    searchInput: {
      height: 38, padding: '0 14px', border: '0.5px solid #e2e8f0',
      borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif',
      outline: 'none', background: '#fff', color: '#0f172a', flex: '1 1 220px',
    },
    select: {
      height: 38, padding: '0 12px', border: '0.5px solid #e2e8f0',
      borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif',
      background: '#fff', color: '#374151', outline: 'none',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      textAlign: 'left', padding: '10px 14px', fontWeight: 500,
      color: '#94a3b8', fontSize: 11, textTransform: 'uppercase',
      letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9',
      background: '#fafaf8',
    },
    td: { padding: '12px 14px', borderBottom: '0.5px solid #f1f5f9', color: '#0f172a', verticalAlign: 'middle' },
    tierBadge: (t) => ({
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: TIER_STYLE[t]?.bg || '#f1f5f9',
      color: TIER_STYLE[t]?.text || '#475569',
    }),
    tierSelect: {
      height: 30, padding: '0 8px', border: '0.5px solid #e2e8f0',
      borderRadius: 6, fontSize: 12, fontFamily: 'DM Sans, sans-serif',
      background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer',
    },
    empty: { textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 },
    toast: {
      position: 'fixed', bottom: 24, right: 24,
      background: '#0f172a', color: '#fff', padding: '10px 20px',
      borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif',
      zIndex: 9999, opacity: toast ? 1 : 0, transition: 'opacity 0.2s',
      pointerEvents: 'none',
    },
  };

  return (
    <div style={S.page}>

      <div style={S.header}>
        <h1 style={S.title}>User Manager</h1>
        <p style={S.sub}>{users.length} registered users</p>
      </div>

      {/* Summary stats */}
      <div style={S.statsRow}>
        {TIERS.map(t => (
          <div key={t} style={S.stat}>
            <div style={{ ...S.statNum, color: TIER_STYLE[t]?.text || '#0f172a' }}>{counts[t] || 0}</div>
            <div style={S.statLbl}>{t}</div>
          </div>
        ))}
        <div style={S.stat}>
          <div style={S.statNum}>{users.length}</div>
          <div style={S.statLbl}>total</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={S.searchInput}
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={filterTier} onChange={e => setFilter(e.target.value)}>
          <option value="all">All tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={loadUsers}
          style={{
            height: 38, padding: '0 16px', background: '#fff',
            border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
            fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', color: '#374151',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={S.empty}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>No users found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Current tier</th>
                  <th style={S.th}>Change tier</th>
                  <th style={S.th}>Joined</th>
                  <th style={S.th}>Last login</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={S.td}>
                      <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                        {u.id.slice(0, 8)}…
                      </div>
                    </td>
                    <td style={{ ...S.td, color: '#4338ca' }}>{u.email}</td>
                    <td style={S.td}>
                      <span style={S.tierBadge(u.tier)}>{u.tier}</span>
                    </td>
                    <td style={S.td}>
                      {saving === u.id ? (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Saving…</span>
                      ) : (
                        <select
                          style={S.tierSelect}
                          value={u.tier}
                          onChange={e => changeTier(u.id, e.target.value)}
                        >
                          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ ...S.td, color: '#64748b' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ ...S.td, color: '#64748b' }}>{fmtDate(u.last_login)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      <div style={S.toast}>{toast}</div>

    </div>
  );
}
