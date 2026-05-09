// src/pages/admin/UserManager.jsx
// Admin page: /admin/users
// Lists all users from public.users via /api/get-users (service_role, admin-verified).
// Role changes call /api/set-role.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';

const ROLES = ['individual', 'advisor', 'admin'];

const ROLE_STYLE = {
  individual: { bg: '#eef2ff', text: '#4338ca' },
  advisor:    { bg: '#f0fdf4', text: '#15803d' },
  admin:      { bg: '#fdf4ff', text: '#7e22ce' },
};

const PLAN_STYLE = {
  free:         { bg: '#f1f5f9', text: '#475569' },
  individual:   { bg: '#eff6ff', text: '#1d4ed8' },
  advisor_mfd:  { bg: '#f0fdf4', text: '#15803d' },
  advisor_ria:  { bg: '#fefce8', text: '#854d0e' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function UserManager() {
  const { token, loading: authLoading } = useAuth();

  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [filterRole, setFilter] = useState('all');
  const [saving, setSaving]   = useState(null);
  const [toast, setToast]     = useState('');

  const LIMIT = 20;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const loadUsers = useCallback(async (pageNum = 0) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/get-users?page=${pageNum}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('get-users error:', data);
        setError(data.error || 'Failed to load users');
        return;
      }
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('loadUsers fetch error:', err);
      setError('Network error — could not load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) loadUsers(0);
  }, [authLoading, token, loadUsers]);

  async function changeRole(userId, newRole) {
    if (!token) return;
    setSaving(userId);
    try {
      const res = await fetch('/api/set-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId: userId, newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('set-role error:', data);
        showToast(data.error || 'Error updating role');
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast(`Role updated → ${newRole}`);
    } catch (err) {
      console.error('changeRole fetch error:', err);
      showToast('Network error — role not updated');
    } finally {
      setSaving(null);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  const totalPages = Math.ceil(total / LIMIT);

  const S = {
    page:    { fontFamily: 'DM Sans, sans-serif', padding: '0 0 40px' },
    title:   { fontSize: 22, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' },
    sub:     { fontSize: 14, color: '#64748b', margin: '0 0 24px' },
    statsRow: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
    stat:    { background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', minWidth: 110 },
    statNum: { fontSize: 24, fontWeight: 600, color: '#0f172a' },
    statLbl: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    toolbar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
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
    btn: {
      height: 38, padding: '0 16px', background: '#fff',
      border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', color: '#374151',
    },
    table:  { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      textAlign: 'left', padding: '10px 14px', fontWeight: 500,
      color: '#94a3b8', fontSize: 11, textTransform: 'uppercase',
      letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9',
      background: '#fafaf8',
    },
    td:     { padding: '12px 14px', borderBottom: '0.5px solid #f1f5f9', color: '#0f172a', verticalAlign: 'middle' },
    badge:  (style) => ({
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      background: style?.bg || '#f1f5f9', color: style?.text || '#475569',
    }),
    roleSelect: {
      height: 30, padding: '0 8px', border: '0.5px solid #e2e8f0',
      borderRadius: 6, fontSize: 12, fontFamily: 'DM Sans, sans-serif',
      background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer',
    },
    empty:  { textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 },
    errBox: { background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#dc2626', marginBottom: 16 },
    pagination: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
    pageBtn: (active) => ({
      height: 34, padding: '0 14px', background: active ? '#1D9E75' : '#fff',
      color: active ? '#fff' : '#374151', border: '0.5px solid ' + (active ? '#1D9E75' : '#e2e8f0'),
      borderRadius: 6, fontSize: 13, fontFamily: 'DM Sans, sans-serif',
      cursor: active ? 'default' : 'pointer',
    }),
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
      <h1 style={S.title}>User Manager</h1>
      <p style={S.sub}>{total} registered users</p>

      {/* Summary stats */}
      <div style={S.statsRow}>
        {ROLES.map(r => (
          <div key={r} style={S.stat}>
            <div style={{ ...S.statNum, color: ROLE_STYLE[r]?.text || '#0f172a' }}>{roleCounts[r] || 0}</div>
            <div style={S.statLbl}>{r}</div>
          </div>
        ))}
        <div style={S.stat}>
          <div style={S.statNum}>{total}</div>
          <div style={S.statLbl}>total</div>
        </div>
      </div>

      {/* Error */}
      {error && <div style={S.errBox}>{error}</div>}

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={S.searchInput}
          placeholder="Search by email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={filterRole} onChange={e => setFilter(e.target.value)}>
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button style={S.btn} onClick={() => loadUsers(page)}>Refresh</button>
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
                  <th style={S.th}>UID</th>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Role</th>
                  <th style={S.th}>Plan tier</th>
                  <th style={S.th}>Change role</th>
                  <th style={S.th}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr
                    key={u.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    style={{ transition: 'background 0.1s' }}
                  >
                    <td style={S.td}>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                        {u.id.slice(0, 8)}…
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#4338ca' }}>{u.email || '—'}</td>
                    <td style={S.td}>
                      <span style={S.badge(ROLE_STYLE[u.role])}>{u.role || '—'}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(PLAN_STYLE[u.plan_tier])}>{u.plan_tier || '—'}</span>
                    </td>
                    <td style={S.td}>
                      {saving === u.id ? (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Saving…</span>
                      ) : (
                        <select
                          style={S.roleSelect}
                          value={u.role || 'individual'}
                          onChange={e => changeRole(u.id, e.target.value)}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ ...S.td, color: '#64748b' }}>{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={S.pagination}>
          <button
            style={S.pageBtn(false)}
            disabled={page === 0}
            onClick={() => loadUsers(page - 1)}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            style={S.pageBtn(false)}
            disabled={page >= totalPages - 1}
            onClick={() => loadUsers(page + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Toast */}
      <div style={S.toast}>{toast}</div>
    </div>
  );
}
