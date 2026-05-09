import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import useWindowWidth from '../hooks/useWindowWidth'

// ── PLAN UNIVERSE (kept for tool backward-compat) ─────────────────────────────
export const PLAN_KEY = 'fundlens_plan_universe'
export const getStoredPlan = () => localStorage.getItem(PLAN_KEY) || 'Direct'
export const setStoredPlan = (plan) => {
  localStorage.setItem(PLAN_KEY, plan)
  window.dispatchEvent(new CustomEvent('fundlens_plan_change', { detail: plan }))
}

// ── TOOL GROUPS ───────────────────────────────────────────────────────────────
export const GROUPS = [
  {
    id: 'Z', label: 'MF Explorer',
    items: [
      { code: 'Z1', name: 'Scheme Explorer',        tagline: 'Check MF scheme snapshot',                    path: '/schemes',             live: true  },
      { code: 'Z2', name: 'Compare Schemes',         tagline: 'Side-by-side scheme comparison',              path: '/compare-schemes',     live: true  },
      { code: 'Z8', name: 'Category Leaderboard',    tagline: 'Top funds ranked by category',                path: '/category-leaderboard',live: true  },
      { code: 'Z3', name: 'Fund Screener — Features',tagline: 'Screen funds by features',                   path: '/fund-screener',       live: false },
      { code: 'Z4', name: 'Fund Screener — Ratios',  tagline: 'Screen funds by risk/return ratios',          path: '/fund-screener-ratios',live: false },
      { code: 'Z5', name: 'Fund Manager Track',      tagline: 'Track fund manager history',                  path: '/fund-manager',        live: false },
      { code: 'Z6', name: 'Rolling Return Consistency', tagline: 'Consistency of rolling returns',           path: '/rolling-returns',     live: false },
      { code: 'Z7', name: 'Market Cycle Overlay',    tagline: 'Fund performance over market cycles',         path: '/market-cycles',       live: false },
    ],
  },
  {
    id: 'X', label: 'MF Portfolios',
    items: [
      { code: 'X1', name: 'Scheme Snapshot',      tagline: 'Full portfolio snapshot',        path: '/scheme-snapshot',   live: false },
      { code: 'X2', name: 'Portfolio Overlap',    tagline: 'Overlap across your holdings',   path: '/portfolio-overlap', live: false },
      { code: 'X3', name: 'Top Securities',       tagline: 'Most-held securities across MFs',path: '/top-securities',    live: false },
      { code: 'X4', name: 'Top Sectors',          tagline: 'Sector concentration across MFs',path: '/top-sectors',       live: false },
      { code: 'X5', name: 'Change Tracker',       tagline: 'Month-on-month portfolio changes',path: '/change-tracker',   live: false },
      { code: 'X6', name: 'Underlying Market Cap',tagline: 'Effective market-cap mix',       path: '/underlying-mktcap', live: false },
    ],
  },
  {
    id: 'A', label: 'MF Calculators',
    items: [
      { code: 'A1', name: 'SIP Performance',       tagline: 'What did my SIP actually earn?',           path: '/sip-performance', live: true  },
      { code: 'A2', name: 'Wealth Creator',         tagline: 'What will my SIP grow to?',                path: '/wealth-creator',  live: true  },
      { code: 'A3', name: 'SWP Performance',        tagline: 'What did my withdrawals cost me?',         path: '/swp-performance', live: true  },
      { code: 'A4', name: 'STP Calculator',         tagline: 'Model your debt-to-equity transfer plan',  path: '/stp-calculator',  live: true  },
      { code: 'A5', name: 'Actual STP Analyser',    tagline: 'Real NAV-based STP analysis',              path: '/stp-actual',      live: true  },
      { code: 'A6', name: 'Scheme Basket',          tagline: 'How did my portfolio do?',                  path: '/scheme-basket',   live: true  },
    ],
  },
  {
    id: 'B', label: 'Loans',
    items: [
      { code: 'B1', name: 'Loan EMI',          tagline: 'What is my monthly payment?',        path: '/loan-calculator',  live: true },
      { code: 'B2', name: 'Loan vs SIP',       tagline: 'Should I prepay or invest?',         path: '/loan-vs-sip',      live: true },
      { code: 'B3', name: 'Prepayment Benefit',tagline: 'What do I save by prepaying early?', path: '/prepay-vs-invest', live: true },
    ],
  },
  {
    id: 'C', label: 'Risk & Goals',
    items: [
      { code: 'C1', name: 'Risk Profiler',   tagline: 'What kind of investor am I?',   path: '/risk-profiler',          live: true  },
      { code: 'C2', name: 'Basket Builder',  tagline: 'Build my portfolio',            path: '/basket-builder',         live: false },
      { code: 'C3', name: 'Pre-Retirement',  tagline: 'Am I on track to retire?',      path: '/pre-retirement-planner', live: true  },
      { code: 'C4', name: 'Post-Retirement', tagline: 'Will my money outlast me?',     path: '/post-retirement',        live: false },
      { code: 'C5', name: 'Goal-Based SIP',  tagline: 'How much do I need to invest?', path: '/goal-sip',               live: true  },
      { code: 'C6', name: 'Goal Calculator', tagline: 'One goal. One clear number.',   path: '/goal-calculator',        live: true  },
    ],
  },
  {
    id: 'D', label: 'Fixed Income',
    items: [
      { code: 'D1', name: 'FD Calculator', tagline: 'What will my FD earn?',        path: '/fd-calculator', live: true  },
      { code: 'D2', name: 'FD vs MF',      tagline: 'Is FD better than debt fund?', path: '/fd-vs-mf',      live: true  },
      { code: 'D3', name: 'RD Calculator', tagline: 'Recurring deposit returns',    path: '/rd-calculator', live: true  },
    ],
  },
  {
    id: 'E', label: 'Tax & Returns',
    items: [
      { code: 'E1', name: 'Capital Gains',          tagline: 'What is my tax liability?',             path: '/capital-gains', live: true },
      { code: 'E2', name: 'Post-Tax Comparator',    tagline: 'Which investment is better after tax?', path: '/post-tax',      live: true },
      { code: 'E3', name: 'Inflation-Adj. Return',  tagline: 'What is my real return?',               path: '/real-return',   live: true },
      { code: 'E4', name: 'XIRR Calculator',        tagline: 'What is my actual return?',             path: '/xirr-calc',     live: true },
    ],
  },
]

const GROUP_MAP = Object.fromEntries(GROUPS.map(g => [g.id, g]))

const PLAN_GROUP_IDS     = ['A', 'B', 'C', 'D', 'E']
const RESEARCH_GROUP_IDS = ['Z', 'X']

// ── STYLES ────────────────────────────────────────────────────────────────────
const navStyle = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  html, body { overflow-x: hidden; max-width: 100%; }

  .fl-nav-wrap {
    position: sticky; top: 0; z-index: 200;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid #e8f5f0;
    box-shadow: 0 2px 16px rgba(29,158,117,0.06);
    width: 100%; box-sizing: border-box;
  }

  .fl-main-row {
    display: flex; align-items: center;
    padding: 0 1.5rem; height: 56px; gap: 0;
  }

  .fl-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0; margin-right: 32px;
  }
  .fl-logo-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, #1D9E75, #0f7a5a);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(29,158,117,0.3);
    font-family: 'DM Sans'; font-size: 15px; font-weight: 700; color: #fff;
  }
  .fl-logo-text {
    font-family: 'DM Sans'; font-size: 17px; font-weight: 700;
    color: #0f172a; letter-spacing: -0.3px;
  }
  .fl-logo-text span { color: #1D9E75; }

  .fl-tabs {
    display: flex; align-items: center; flex: 1; gap: 2px;
  }

  .fl-tab {
    position: relative; height: 56px; display: flex; align-items: center;
  }

  .fl-tab-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 0 14px; height: 56px;
    font-family: 'DM Sans'; font-size: 14px; font-weight: 500;
    color: #475569; background: none; border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    text-decoration: none;
  }
  .fl-tab-btn:hover { color: #1D9E75; border-bottom-color: rgba(29,158,117,0.3); }
  .fl-tab-btn.tab-active { color: #1D9E75; border-bottom-color: #1D9E75; font-weight: 600; }
  .fl-tab-btn.tab-disabled {
    color: #94a3b8; cursor: default; pointer-events: none;
  }

  .fl-chevron {
    font-size: 9px; opacity: 0.5; transition: transform 0.2s;
    display: inline-block;
  }
  .fl-chevron.open { transform: rotate(180deg); }

  .fl-lock { opacity: 0.45; display: inline-flex; align-items: center; }

  .fl-soon-pill {
    font-family: 'DM Sans'; font-size: 9px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    background: #f1f5f9; color: #94a3b8;
    border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 2px 7px; margin-left: 6px;
  }

  .fl-dropdown {
    position: absolute; top: calc(100% + 2px); left: 0; z-index: 300;
    background: #fff;
    border: 1px solid rgba(29,158,117,0.12); border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(29,158,117,0.08);
    padding: 12px 0 10px;
    opacity: 0; pointer-events: none;
    transform: translateY(6px); transition: opacity 0.17s ease, transform 0.17s ease;
    min-width: 520px;
  }
  .fl-dropdown.dd-research { min-width: 300px; }
  .fl-dropdown.visible { opacity: 1; pointer-events: all; transform: translateY(0); }

  .dd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; padding: 0 10px; }
  .dd-grid-single { grid-template-columns: 1fr; }

  .dd-group { padding: 4px 6px 10px; }
  .dd-group-hdr {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 4px 8px; margin-bottom: 2px;
    border-bottom: 1px solid #f1f5f9;
  }
  .dd-group-id {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px;
    background: rgba(29,158,117,0.08); color: #1D9E75;
    padding: 2px 7px; border-radius: 4px;
  }
  .dd-group-label {
    font-family: 'DM Sans'; font-size: 11px; font-weight: 600;
    color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;
  }

  .dd-item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 6px; border-radius: 8px; text-decoration: none;
    transition: background 0.1s; cursor: pointer;
  }
  .dd-item:hover { background: rgba(29,158,117,0.05); }
  .dd-item.dd-active { background: rgba(29,158,117,0.08); }
  .dd-item.dd-soon { opacity: 0.38; cursor: default; pointer-events: none; }

  .dd-item-code {
    font-family: 'DM Mono'; font-size: 9px; color: #94a3b8;
    min-width: 20px; flex-shrink: 0;
  }
  .dd-item.dd-active .dd-item-code { color: #1D9E75; }
  .dd-item-name {
    font-family: 'DM Sans'; font-size: 13px; color: #1e293b; flex: 1;
  }
  .dd-item.dd-active .dd-item-name { color: #1D9E75; font-weight: 600; }

  .dd-more { font-family: 'DM Sans'; font-size: 11px; color: #94a3b8; padding: 4px 10px; }

  .fl-right {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: 16px;
  }

  .fl-universe-pill, .fl-ia-pill {
    display: flex; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 8px; overflow: hidden;
  }
  .fl-pill-btn {
    padding: 5px 11px; border: none; cursor: pointer;
    font-family: 'DM Sans'; font-size: 11px; font-weight: 500;
    background: transparent; color: #94a3b8; transition: all 0.15s;
    white-space: nowrap;
  }
  .fl-pill-btn.active-direct  { background: #1D9E75; color: #fff; }
  .fl-pill-btn.active-regular { background: #1D9E75; color: #fff; }
  .fl-pill-btn.active-investor { background: #1D9E75; color: #fff; }
  .fl-pill-btn.active-advisor  { background: #0f7a5a; color: #fff; }

  .fl-signin-btn {
    padding: 7px 16px; border: 1.5px solid #1D9E75; border-radius: 8px;
    background: transparent; color: #1D9E75;
    font-family: 'DM Sans'; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    text-decoration: none; display: inline-flex; align-items: center;
  }
  .fl-signin-btn:hover { background: rgba(29,158,117,0.06); }

  .fl-getstarted-btn {
    padding: 7px 16px; border: none; border-radius: 8px;
    background: #1D9E75; color: #fff;
    font-family: 'DM Sans'; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    text-decoration: none; display: inline-flex; align-items: center;
    box-shadow: 0 2px 8px rgba(29,158,117,0.25);
  }
  .fl-getstarted-btn:hover { background: #0f7a5a; }

  .fl-user-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 12px 5px 5px;
    border: 1px solid #e2e8f0; border-radius: 10px;
    background: #fff; cursor: pointer; transition: all 0.15s;
    font-family: 'DM Sans'; font-size: 13px; color: #374151;
  }
  .fl-user-btn:hover { border-color: #1D9E75; }
  .fl-avatar {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, #d1fae5, #1D9E75);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff;
    flex-shrink: 0;
  }
  .fl-user-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1); padding: 6px;
    min-width: 200px; z-index: 300;
  }
  .fl-user-email {
    font-family: 'DM Sans'; font-size: 11px; color: #94a3b8;
    padding: 6px 10px 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 4px;
  }
  .fl-signout-btn {
    width: 100%; text-align: left; padding: 8px 10px;
    background: none; border: none; border-radius: 8px;
    font-family: 'DM Sans'; font-size: 13px; color: #dc2626;
    cursor: pointer; transition: background 0.1s;
  }
  .fl-signout-btn:hover { background: #fff5f5; }

  .fl-hamburger {
    display: none; flex-direction: column; align-items: center;
    justify-content: center; gap: 5px;
    width: 38px; height: 38px; border-radius: 9px;
    border: 1px solid #e2e8f0; background: #fff;
    cursor: pointer; flex-shrink: 0;
  }
  .fl-hamburger-line { width: 16px; height: 2px; background: #64748b; border-radius: 1px; }

  @media (max-width: 768px) {
    .fl-main-row { padding: 0 1rem; height: 52px; }
    .fl-tabs { display: none; }
    .fl-right > *:not(.fl-hamburger) { display: none; }
    .fl-hamburger { display: flex; }
    .fl-logo { margin-right: 0; }
  }

  .fl-backdrop {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(15,23,42,0.4); backdrop-filter: blur(2px);
  }

  .fl-drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 401;
    width: min(320px, 85vw);
    background: #fff;
    box-shadow: -4px 0 32px rgba(0,0,0,0.12);
    display: flex; flex-direction: column;
    overflow: hidden;
    transition: transform 0.25s ease;
  }

  .fl-drawer-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
  }
  .fl-drawer-logo { font-family: 'DM Sans'; font-size: 17px; font-weight: 700; color: #0f172a; }
  .fl-drawer-logo span { color: #1D9E75; }
  .fl-drawer-close {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid #e2e8f0; background: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #64748b; font-size: 14px;
  }

  .fl-drawer-body { flex: 1; overflow-y: auto; padding: 8px 0; }

  .fl-drawer-section { border-bottom: 1px solid #f8fafc; }
  .fl-drawer-tab {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 13px 16px;
    background: none; border: none; cursor: pointer;
    font-family: 'DM Sans'; font-size: 14px; font-weight: 600; color: #0f172a;
    text-align: left;
  }
  .fl-drawer-tab:active { background: #f8fafc; }
  .fl-drawer-tab.locked-tab { color: #64748b; }
  .fl-drawer-tab-right { display: flex; align-items: center; gap: 6px; }

  .fl-drawer-item {
    display: block; padding: 9px 16px 9px 32px;
    font-family: 'DM Sans'; font-size: 13px; color: #374151;
    text-decoration: none; border-left: 2px solid transparent;
    transition: all 0.1s;
  }
  .fl-drawer-item:hover { color: #1D9E75; background: rgba(29,158,117,0.04); border-left-color: rgba(29,158,117,0.3); }
  .fl-drawer-item.drawer-active { color: #1D9E75; font-weight: 600; border-left-color: #1D9E75; }
  .fl-drawer-item-soon { color: #94a3b8; font-size: 12px; }

  .fl-drawer-footer {
    padding: 12px 16px; border-top: 1px solid #f1f5f9; flex-shrink: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .fl-drawer-universe { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .fl-drawer-universe-label { font-family: 'DM Sans'; font-size: 11px; color: #94a3b8; flex: 1; }
`

// ── HELPER COMPONENTS ─────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <span className="fl-lock">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function GroupSection({ group, currentPath, onClose }) {
  const liveItems = group.items.filter(i => i.live)
  const soonCount = group.items.filter(i => !i.live).length
  return (
    <div className="dd-group">
      <div className="dd-group-hdr">
        <span className="dd-group-id">{group.id}</span>
        <span className="dd-group-label">{group.label}</span>
      </div>
      {liveItems.map(item => (
        <NavLink
          key={item.code}
          to={item.path}
          onClick={onClose}
          className={({ isActive }) => `dd-item${isActive ? ' dd-active' : ''}`}
        >
          <span className="dd-item-code">{item.code}</span>
          <span className="dd-item-name">{item.name}</span>
        </NavLink>
      ))}
      {soonCount > 0 && (
        <div className="dd-more">+{soonCount} coming soon</div>
      )}
    </div>
  )
}

function PlanDropdown({ currentPath, onClose }) {
  const groups = PLAN_GROUP_IDS.map(id => GROUP_MAP[id]).filter(Boolean)
  return (
    <div className="dd-grid">
      {groups.map(g => (
        <GroupSection key={g.id} group={g} currentPath={currentPath} onClose={onClose} />
      ))}
    </div>
  )
}

function ResearchDropdown({ currentPath, onClose }) {
  const groups = RESEARCH_GROUP_IDS.map(id => GROUP_MAP[id]).filter(Boolean)
  return (
    <div className="dd-grid dd-grid-single">
      {groups.map(g => (
        <GroupSection key={g.id} group={g} currentPath={currentPath} onClose={onClose} />
      ))}
    </div>
  )
}

function NavTab({ label, type, isGuest, currentPath, children, isActive: propActive }) {
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)
  const navigate          = useNavigate()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { setOpen(false) }, [currentPath])

  const isLocked   = isGuest && (type === 'research' || type === 'track')
  const isDropdown = type === 'plan' || type === 'research'

  function handleClick() {
    if (type === 'disabled') return
    if (isLocked) {
      navigate('/login', { state: { from: currentPath, message: 'Register to access this feature' } })
      return
    }
    if (type === 'track') { navigate('/portfolio'); return }
    if (isDropdown) setOpen(o => !o)
  }

  const btnClass = [
    'fl-tab-btn',
    propActive ? 'tab-active' : '',
    type === 'disabled' ? 'tab-disabled' : '',
  ].filter(Boolean).join(' ')

  if (type === 'disabled') {
    return (
      <div className="fl-tab">
        <span className="fl-tab-btn tab-disabled" style={{ cursor: 'default' }}>
          {label}
          <span className="fl-soon-pill">Soon</span>
        </span>
      </div>
    )
  }

  return (
    <div className="fl-tab" ref={ref}>
      <button className={btnClass} onClick={handleClick}>
        {label}
        {isLocked && <LockIcon />}
        {isDropdown && <span className={`fl-chevron${open ? ' open' : ''}`}>▾</span>}
      </button>
      {isDropdown && (
        <div className={`fl-dropdown${type === 'research' ? ' dd-research' : ''} ${open ? 'visible' : ''}`}>
          {children}
        </div>
      )}
    </div>
  )
}

function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const initials    = (user.displayName || user.email || '?').charAt(0).toUpperCase()
  const displayName = user.displayName || user.email?.split('@')[0] || 'User'

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="fl-user-btn" onClick={() => setOpen(o => !o)}>
        <span className="fl-avatar">{initials}</span>
        <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div className="fl-user-dropdown">
          <div className="fl-user-email">{user.email}</div>
          <button className="fl-signout-btn" onClick={async () => { setOpen(false); await onSignOut() }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function DrawerSection({ label, type, isGuest, groupIds, path, currentPath, onClose }) {
  const [open, setOpen] = useState(false)
  const navigate        = useNavigate()

  const isLocked   = isGuest && (type === 'research' || type === 'track')
  const isDropdown = type === 'plan' || type === 'research'

  const groups     = isDropdown
    ? (groupIds || []).map(id => GROUP_MAP[id]).filter(Boolean)
    : []
  const liveItems  = groups.flatMap(g => g.items.filter(i => i.live)).slice(0, 12)

  function handleTap() {
    if (type === 'disabled') return
    if (isLocked) {
      navigate('/login', { state: { message: 'Register to access this feature' } })
      onClose()
      return
    }
    if (type === 'track') { navigate('/portfolio'); onClose(); return }
    setOpen(o => !o)
  }

  return (
    <div className="fl-drawer-section">
      <button
        className={`fl-drawer-tab${isLocked ? ' locked-tab' : ''}`}
        onClick={handleTap}
        disabled={type === 'disabled'}
        style={type === 'disabled' ? { color: '#94a3b8', cursor: 'default' } : {}}
      >
        <span>{label}</span>
        <span className="fl-drawer-tab-right">
          {isLocked && <LockIcon />}
          {type === 'disabled' && <span className="fl-soon-pill">Soon</span>}
          {isDropdown && !isLocked && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
          )}
        </span>
      </button>
      {isDropdown && !isLocked && open && liveItems.map(item => (
        <NavLink
          key={item.code}
          to={item.path}
          onClick={onClose}
          className={({ isActive }) => `fl-drawer-item${isActive ? ' drawer-active' : ''}`}
        >
          {item.name}
        </NavLink>
      ))}
    </div>
  )
}

function MobileDrawer({
  open, onClose, currentPath,
  plan, onPlanChange,
  isGuest, isAdvisor, advisorMode, onAdvisorModeChange,
  user, onSignOut,
}) {
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => { onClose() }, [currentPath])

  if (!open) return null

  return (
    <>
      <div className="fl-backdrop" onClick={onClose} />
      <div className="fl-drawer">
        <div className="fl-drawer-header">
          <span className="fl-drawer-logo">Fund<span>Lens</span></span>
          <button className="fl-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="fl-drawer-body">
          <DrawerSection label="Plan"           type="plan"     isGuest={false}    groupIds={PLAN_GROUP_IDS}     currentPath={currentPath} onClose={onClose} />
          <DrawerSection label="Research"       type="research" isGuest={isGuest}  groupIds={RESEARCH_GROUP_IDS} currentPath={currentPath} onClose={onClose} />
          <DrawerSection label="Track"          type="track"    isGuest={isGuest}  path="/portfolio"             currentPath={currentPath} onClose={onClose} />
          <DrawerSection label="Save & Invest"  type="disabled" isGuest={false}    currentPath={currentPath} onClose={onClose} />
          {advisorMode && isAdvisor && (
            <DrawerSection label="Promote" type="promote" isGuest={false} currentPath={currentPath} onClose={onClose} />
          )}
        </div>

        <div className="fl-drawer-footer">
          <div className="fl-drawer-universe">
            <span className="fl-drawer-universe-label">Universe</span>
            <div className="fl-universe-pill">
              <button
                className={`fl-pill-btn${plan === 'Direct' ? ' active-direct' : ''}`}
                onClick={() => onPlanChange('Direct')}
              >Direct</button>
              <button
                className={`fl-pill-btn${plan === 'Regular' ? ' active-regular' : ''}`}
                onClick={() => onPlanChange('Regular')}
              >Regular</button>
            </div>
          </div>

          {isAdvisor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="fl-drawer-universe-label">Mode</span>
              <div className="fl-ia-pill">
                <button
                  className={`fl-pill-btn${!advisorMode ? ' active-investor' : ''}`}
                  onClick={() => onAdvisorModeChange(false)}
                >Investor</button>
                <button
                  className={`fl-pill-btn${advisorMode ? ' active-advisor' : ''}`}
                  onClick={() => onAdvisorModeChange(true)}
                >Advisor</button>
              </div>
            </div>
          )}

          {user ? (
            <button
              className="fl-signout-btn"
              style={{ padding: '10px 0', fontSize: 14 }}
              onClick={async () => { onClose(); await onSignOut() }}
            >
              Sign out ({user.email})
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="fl-signin-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { navigate('/login'); onClose() }}
              >
                Sign in
              </button>
              <button
                className="fl-getstarted-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { navigate('/login'); onClose() }}
              >
                Get started
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── MAIN NAV ──────────────────────────────────────────────────────────────────
export default function Nav() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { user, signOut } = useAuth()
  const { isGuest, isAdvisor } = useRole()
  const width      = useWindowWidth()

  const [plan, setPlan]               = useState(getStoredPlan)
  const [advisorMode, setAdvisorMode] = useState(false)
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const isMobile   = width <= 768
  const currentPath = location.pathname

  // Determine which top-level tab is active
  const isPlanActive     = PLAN_GROUP_IDS.some(id =>
    GROUP_MAP[id]?.items.some(i => i.live && i.path === currentPath)
  )
  const isResearchActive = RESEARCH_GROUP_IDS.some(id =>
    GROUP_MAP[id]?.items.some(i => i.live && i.path === currentPath)
  )
  const isTrackActive    = currentPath.startsWith('/portfolio')

  const showPromote = advisorMode && isAdvisor

  const handlePlanChange    = useCallback(p => { setPlan(p); setStoredPlan(p) }, [])
  const handleAdvisorMode   = useCallback(v => setAdvisorMode(v), [])
  const handleSignOut       = useCallback(async () => {
    try { await signOut(); navigate('/') }
    catch (err) { console.error('Nav sign-out error:', err) }
  }, [signOut, navigate])

  return (
    <>
      <style>{navStyle}</style>
      <nav className="fl-nav-wrap">
        <div className="fl-main-row">

          {/* Logo */}
          <NavLink to="/" className="fl-logo">
            <div className="fl-logo-mark">F</div>
            <div className="fl-logo-text">Fund<span>Lens</span></div>
          </NavLink>

          {/* Centre tabs — hidden on mobile via CSS */}
          <div className="fl-tabs">
            <NavTab
              label="Plan"
              type="plan"
              isGuest={isGuest}
              currentPath={currentPath}
              isActive={isPlanActive}
            >
              <PlanDropdown currentPath={currentPath} onClose={() => {}} />
            </NavTab>

            <NavTab
              label="Research"
              type="research"
              isGuest={isGuest}
              currentPath={currentPath}
              isActive={isResearchActive}
            >
              <ResearchDropdown currentPath={currentPath} onClose={() => {}} />
            </NavTab>

            <NavTab
              label="Track"
              type="track"
              isGuest={isGuest}
              currentPath={currentPath}
              isActive={isTrackActive}
            />

            <NavTab
              label="Save & Invest"
              type="disabled"
              isGuest={isGuest}
              currentPath={currentPath}
            />

            {showPromote && (
              <NavTab
                label="Promote"
                type="track"
                isGuest={false}
                currentPath={currentPath}
                isActive={currentPath.startsWith('/promote')}
              />
            )}
          </div>

          {/* Right section */}
          <div className="fl-right">
            {/* Universe (Direct/Regular) toggle */}
            <div className="fl-universe-pill">
              <button
                className={`fl-pill-btn${plan === 'Direct' ? ' active-direct' : ''}`}
                onClick={() => handlePlanChange('Direct')}
              >Direct</button>
              <button
                className={`fl-pill-btn${plan === 'Regular' ? ' active-regular' : ''}`}
                onClick={() => handlePlanChange('Regular')}
              >Regular</button>
            </div>

            {/* Investor/Advisor mode toggle — only for advisors */}
            {isAdvisor && (
              <div className="fl-ia-pill">
                <button
                  className={`fl-pill-btn${!advisorMode ? ' active-investor' : ''}`}
                  onClick={() => handleAdvisorMode(false)}
                >Investor</button>
                <button
                  className={`fl-pill-btn${advisorMode ? ' active-advisor' : ''}`}
                  onClick={() => handleAdvisorMode(true)}
                >Advisor</button>
              </div>
            )}

            {/* Auth: sign in buttons OR user menu */}
            {user ? (
              <UserMenu user={user} onSignOut={handleSignOut} />
            ) : (
              <>
                <NavLink to="/login" className="fl-signin-btn">Sign in</NavLink>
                <NavLink to="/login" className="fl-getstarted-btn">Get started</NavLink>
              </>
            )}

            {/* Hamburger — mobile only (shown via CSS) */}
            <button
              className="fl-hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <div className="fl-hamburger-line" />
              <div className="fl-hamburger-line" />
              <div className="fl-hamburger-line" />
            </button>
          </div>

        </div>
      </nav>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentPath={currentPath}
        plan={plan}
        onPlanChange={handlePlanChange}
        isGuest={isGuest}
        isAdvisor={isAdvisor}
        advisorMode={advisorMode}
        onAdvisorModeChange={handleAdvisorMode}
        user={user}
        onSignOut={handleSignOut}
      />
    </>
  )
}
