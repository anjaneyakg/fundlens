// src/pages/admin/ToolAccessMatrix.jsx
// Admin page: /admin/tool-access
// Visual grid: 52 tools × 4 tiers. Each cell is a toggle.
// Reads from feature_flags. Writes via serverless /api/admin/set-flag.

import { useState, useEffect } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const TIERS = ['public', 'investor', 'advisor', 'alpha'];

const TIER_COLOR = {
  public:   '#64748b',
  investor: '#4338ca',
  advisor:  '#15803d',
  alpha:    '#7e22ce',
};

// Full 52-tool catalogue — single source of truth for display
const TOOLS = [
  // Group Z
  { code: 'Z1', name: 'Scheme Explorer',           group: 'Z', status: 'live' },
  { code: 'Z2', name: 'Compare Schemes',           group: 'Z', status: 'live' },
  { code: 'Z3', name: 'Fund Screener — Features',  group: 'Z', status: 'planned' },
  { code: 'Z4', name: 'Fund Screener — Ratios',    group: 'Z', status: 'planned' },
  { code: 'Z5', name: 'Rolling Return Consistency', group: 'Z', status: 'planned' },
  { code: 'Z6', name: 'Market Cycle Overlay',      group: 'Z', status: 'planned' },
  { code: 'Z7', name: 'Scheme Peer Ranking',        group: 'Z', status: 'planned' },
  { code: 'Z8', name: 'Category Leaderboard',      group: 'Z', status: 'live' },
  { code: 'Z9', name: 'NFO Tracker',               group: 'Z', status: 'planned' },
  // Group A
  { code: 'A1', name: 'SIP Performance',           group: 'A', status: 'live' },
  { code: 'A2', name: 'Wealth Creator',            group: 'A', status: 'live' },
  { code: 'A3', name: 'SWP Performance',           group: 'A', status: 'live' },
  { code: 'A4', name: 'STP Performance',           group: 'A', status: 'live' },
  { code: 'A5', name: 'Actual STP Analyser',       group: 'A', status: 'live' },
  { code: 'A6', name: 'Scheme Basket Performance', group: 'A', status: 'planned' },
  // Group B
  { code: 'B1', name: 'Loan EMI Calculator',       group: 'B', status: 'live' },
  { code: 'B2', name: 'Loan vs SIP',               group: 'B', status: 'live' },
  { code: 'B3', name: 'Prepay vs Invest',          group: 'B', status: 'live' },
  // Group C
  { code: 'C1', name: 'Risk Profiler',             group: 'C', status: 'live' },
  { code: 'C2', name: 'Basket Builder',            group: 'C', status: 'planned' },
  { code: 'C3', name: 'Pre-Retirement Planner',    group: 'C', status: 'planned' },
  { code: 'C4', name: 'Post-Retirement Planner',   group: 'C', status: 'planned' },
  { code: 'C5', name: 'Goal-Based SIP',            group: 'C', status: 'live' },
  { code: 'C6', name: 'Goal Calculator',           group: 'C', status: 'live' },
  // Group D
  { code: 'D1', name: 'FD Calculator',             group: 'D', status: 'live' },
  { code: 'D2', name: 'FD vs MF',                  group: 'D', status: 'live' },
  { code: 'D3', name: 'RD Calculator',             group: 'D', status: 'planned' },
  // Group E
  { code: 'E1', name: 'LTCG / STCG Calculator',   group: 'E', status: 'planned' },
  { code: 'E2', name: 'SIP Tax Impact',            group: 'E', status: 'planned' },
  { code: 'E3', name: 'SWP Tax Efficiency',        group: 'E', status: 'planned' },
  { code: 'E4', name: 'Indexation Benefit',        group: 'E', status: 'planned' },
  // Group F
  { code: 'F1', name: 'Client SIP Dashboard',     group: 'F', status: 'planned' },
  { code: 'F2', name: 'Portfolio Health Check',   group: 'F', status: 'planned' },
  { code: 'F3', name: 'Rebalancing Advisor',       group: 'F', status: 'planned' },
  { code: 'F4', name: 'Asset Allocation Modeller', group: 'F', status: 'planned' },
  { code: 'F5', name: 'Goal Gap Analysis',         group: 'F', status: 'planned' },
  { code: 'F6', name: 'Drawdown Stress Test',      group: 'F', status: 'planned' },
  // Group G
  { code: 'G1', name: 'Portfolio Import (CAS)',    group: 'G', status: 'planned' },
  { code: 'G2', name: 'Portfolio Dashboard',       group: 'G', status: 'planned' },
  { code: 'G3', name: 'Scheme-wise P&L',           group: 'G', status: 'planned' },
  { code: 'G4', name: 'SIP Tracker',               group: 'G', status: 'planned' },
  { code: 'G5', name: 'Portfolio vs Benchmark',    group: 'G', status: 'planned' },
  // Group X
  { code: 'X1', name: 'Scheme Snapshot',           group: 'X', status: 'planned' },
  { code: 'X2', name: 'Holdings Overlap',          group: 'X', status: 'planned' },
  { code: 'X3', name: 'Top Securities',            group: 'X', status: 'planned' },
  { code: 'X4', name: 'Top Sectors',               group: 'X', status: 'planned' },
  { code: 'X5', name: 'Change Tracker',            group: 'X', status: 'planned' },
  { code: 'X6', name: 'Underlying Market Cap',     group: 'X', status: 'planned' },
];

const GROUPS = {
  Z: 'MF Explorer',
  A: 'MF Calculators',
  B: 'Loans',
  C: 'Goals',
  D: 'Fixed Income',
  E: 'Tax & Returns',
  F: 'Advisor Tools',
  G: 'Investor Portfolio',
  X: 'Scheme Intelligence',
};

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export default function ToolAccessMatrix() {
  // flags: { 'Z1:public': { id, enabled }, ... }
  const [flags, setFlags]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null); // 'Z3:alpha'
  const [toast, setToast]       = useState('');
  const [filterGroup, setGroup] = useState('all');
  const [filterStatus, setStatus] = useState('all');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function loadFlags() {
    setLoading(true);
    try {
      const rows = await sbFetch("feature_flags?key=like.tool:%25&select=id,key,enabled");
      const map = {};
      (rows || []).forEach(r => {
        // key = 'tool:Z1:public' → slot = 'Z1:public'
        const parts = r.key.split(':');
        if (parts.length === 3) {
          map[`${parts[1]}:${parts[2]}`] = { id: r.id, enabled: r.enabled };
        }
      });
      setFlags(map);
    } catch (err) {
      console.error('loadFlags error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFlags(); }, []);

  async function toggle(code, tier) {
    const slot = `${code}:${tier}`;
    const current = flags[slot];
    if (!current) return;

    const newVal = !current.enabled;
    setSaving(slot);

    // Optimistic update
    setFlags(prev => ({ ...prev, [slot]: { ...current, enabled: newVal } }));

    try {
      const res = await fetch('/api/admin/set-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId: current.id, enabled: newVal }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(`${code} · ${tier} → ${newVal ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('toggle error:', err);
      // Rollback
      setFlags(prev => ({ ...prev, [slot]: current }));
      showToast('Error — change rolled back');
    } finally {
      setSaving(null);
    }
  }

  const groups = [...new Set(TOOLS.map(t => t.group))];
  const filtered = TOOLS.filter(t =>
    (filterGroup === 'all' || t.group === filterGroup) &&
    (filterStatus === 'all' || t.status === filterStatus)
  );

  // Count enabled tools per tier
  const tierEnabledCounts = TIERS.reduce((acc, tier) => {
    acc[tier] = Object.entries(flags).filter(([k, v]) => k.endsWith(`:${tier}`) && v.enabled).length;
    return acc;
  }, {});

  const S = {
    page: { fontFamily: 'DM Sans, sans-serif', padding: '0 0 60px' },
    title: { fontSize: 22, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' },
    sub: { fontSize: 14, color: '#64748b', margin: '0 0 24px' },
    toolbar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
    select: {
      height: 36, padding: '0 12px', border: '0.5px solid #e2e8f0',
      borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif',
      background: '#fff', color: '#374151', outline: 'none',
    },
    tableWrap: {
      background: '#fff', border: '0.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'auto',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      padding: '11px 16px', fontWeight: 500, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: '#94a3b8', background: '#fafaf8',
      borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
    },
    thTier: (tier) => ({
      padding: '11px 20px', fontWeight: 600, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: TIER_COLOR[tier], background: '#fafaf8',
      borderBottom: '1px solid #f1f5f9', textAlign: 'center', whiteSpace: 'nowrap',
    }),
    groupRow: {
      background: '#f8fafc', borderBottom: '0.5px solid #e2e8f0',
    },
    groupCell: {
      padding: '8px 16px', fontSize: 11, fontWeight: 600,
      color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em',
      colSpan: 6,
    },
    td: { padding: '10px 16px', borderBottom: '0.5px solid #f8fafc', verticalAlign: 'middle' },
    tdCenter: { padding: '10px 20px', borderBottom: '0.5px solid #f8fafc', textAlign: 'center', verticalAlign: 'middle' },
    codeBadge: { fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#94a3b8' },
    statusDot: (s) => ({
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: s === 'live' ? '#22c55e' : '#d1d5db',
      marginRight: 6, verticalAlign: 'middle',
    }),
    toast: {
      position: 'fixed', bottom: 24, right: 24,
      background: '#0f172a', color: '#fff', padding: '10px 20px',
      borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif',
      zIndex: 9999, opacity: toast ? 1 : 0, transition: 'opacity 0.2s',
      pointerEvents: 'none',
    },
  };

  // Toggle switch component
  function ToggleSwitch({ code, tier }) {
    const slot = `${code}:${tier}`;
    const flag = flags[slot];
    const on = flag?.enabled ?? false;
    const isSaving = saving === slot;

    return (
      <div
        onClick={() => !isSaving && toggle(code, tier)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: on ? TIER_COLOR[tier] : '#e2e8f0',
          position: 'relative', cursor: isSaving ? 'wait' : 'pointer',
          transition: 'background 0.2s', display: 'inline-block',
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        <div style={{
          position: 'absolute', top: 2,
          left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 0.2s',
        }} />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <h1 style={S.title}>Tool Access Matrix</h1>
      <p style={S.sub}>
        Toggle which tiers can access each tool. Changes take effect immediately.
      </p>

      {/* Tier enabled counts */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {TIERS.map(t => (
          <div key={t} style={{
            background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10,
            padding: '10px 16px', minWidth: 100,
          }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: TIER_COLOR[t] }}>
              {tierEnabledCounts[t] ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t} tools on</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <select style={S.select} value={filterGroup} onChange={e => setGroup(e.target.value)}>
          <option value="all">All groups</option>
          {groups.map(g => <option key={g} value={g}>Group {g} — {GROUPS[g]}</option>)}
        </select>
        <select style={S.select} value={filterStatus} onChange={e => setStatus(e.target.value)}>
          <option value="all">All tools</option>
          <option value="live">Live only</option>
          <option value="planned">Planned only</option>
        </select>
        <button
          onClick={loadFlags}
          style={{
            height: 36, padding: '0 14px', background: '#fff',
            border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
            fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', color: '#374151',
          }}
        >
          Refresh
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
          {filtered.length} tools shown
        </span>
      </div>

      {/* Matrix table */}
      <div style={S.tableWrap}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            Loading access matrix…
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 60 }}>Code</th>
                <th style={{ ...S.th, minWidth: 200 }}>Tool name</th>
                <th style={{ ...S.th, width: 60 }}>Status</th>
                {TIERS.map(t => (
                  <th key={t} style={S.thTier(t)}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                filtered.reduce((acc, t) => {
                  if (!acc[t.group]) acc[t.group] = [];
                  acc[t.group].push(t);
                  return acc;
                }, {})
              ).map(([grp, tools]) => (
                <>
                  {/* Group header row */}
                  <tr key={`grp-${grp}`} style={S.groupRow}>
                    <td colSpan={7} style={S.groupCell}>
                      Group {grp} — {GROUPS[grp]}
                    </td>
                  </tr>
                  {tools.map((tool, idx) => (
                    <tr
                      key={tool.code}
                      style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                    >
                      <td style={S.td}>
                        <span style={S.codeBadge}>{tool.code}</span>
                      </td>
                      <td style={S.td}>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>{tool.name}</span>
                      </td>
                      <td style={S.td}>
                        <span>
                          <span style={S.statusDot(tool.status)} />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            {tool.status}
                          </span>
                        </span>
                      </td>
                      {TIERS.map(tier => (
                        <td key={tier} style={S.tdCenter}>
                          <ToggleSwitch code={tool.code} tier={tier} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast */}
      <div style={S.toast}>{toast}</div>
    </div>
  );
}
