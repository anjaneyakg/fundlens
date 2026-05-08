import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC = '#1D9E75'
const NAV_H = 84  // fl-nav-row1 (44px) + fl-nav-row2 (40px)

const PL_MENU = [
  {
    section: 'E — Analysis',
    items: [
      { code: 'E1', name: 'Dashboard',          path: '/portfolio/e1', tagline: 'Summary metrics & health status'         },
      { code: 'E2', name: 'Visual Overview',    path: '/portfolio/e2', tagline: 'Allocation, exposure & journey charts'   },
      { code: 'E3', name: 'Holdings',           path: '/portfolio/e3', tagline: 'Tax lot drill-down & top securities'     },
      { code: 'E4', name: 'Overlap Analysis',   path: '/portfolio/e4', tagline: 'Jaccard similarity & redundancy flags'   },
      { code: 'E5', name: 'Performance Matrix', path: '/portfolio/e5', tagline: 'AMC & category returns vs TRI benchmark' },
      { code: 'E6', name: 'Cashflow & Returns', path: '/portfolio/e6', tagline: 'Year-wise flows, abs return & CAGR'      },
      { code: 'E7', name: 'Capital Gains',      path: '/portfolio/e7', tagline: 'Realised & unrealised · tax estimates'   },
      { code: 'E8', name: 'Transaction Report', path: '/portfolio/e8', tagline: 'P&L per transaction · holding period'   },
    ],
  },
  {
    section: 'F — Health',
    items: [
      { code: 'F1', name: 'Health Check',       path: '/portfolio/f1', tagline: '8-rule engine with confidence scoring'  },
      { code: 'F2', name: 'Alerts',             path: '/portfolio/f2', tagline: 'Trigger setup · fired / watching states' },
      { code: 'F3', name: 'Rebalance Planner',  path: '/portfolio/f3', tagline: 'Redemption + investment plan with tax'  },
      { code: 'F4', name: 'Model Portfolio',    path: '/portfolio/f4', tagline: 'Editable 3×3 risk × horizon grid'       },
      { code: 'F5', name: 'Send Report',        path: '/portfolio/f5', tagline: 'PDF export · email to client'           },
      { code: 'F6', name: 'Data Manager',       path: '/portfolio/f6', tagline: 'Upload · DPDP consent · delete all'     },
    ],
  },
]

function Sidebar({ currentPath, onClose, mobile }) {
  return (
    <aside style={{ ...s.sidebar, ...(mobile ? s.sidebarMobile : {}) }}>
      {/* Header */}
      <div style={s.sidebarHeader}>
        <div style={s.plMark}>PL</div>
        <div>
          <div style={s.plTitle}>PortfolioLens</div>
          <div style={s.plSub}>Analysis & Health</div>
        </div>
        {mobile && (
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        )}
      </div>

      {/* Nav */}
      <nav style={s.nav}>
        {PL_MENU.map(({ section, items }) => (
          <div key={section} style={s.section}>
            <div style={s.sectionLabel}>{section}</div>
            {items.map(item => {
              const active = currentPath === item.path
              return (
                <NavLink
                  key={item.code}
                  to={item.path}
                  end
                  onClick={onClose}
                  style={{
                    ...s.navItem,
                    ...(active ? s.navItemActive : {}),
                  }}
                >
                  <span style={{
                    ...s.codeChip,
                    ...(active ? s.codeChipActive : {}),
                  }}>
                    {item.code}
                  </span>
                  <span style={s.itemName}>{item.name}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* DPDP footer */}
      <div style={s.dpdpFooter}>
        <span style={s.dpdpDot} />
        Data stored locally · DPDP compliant
      </div>
    </aside>
  )
}

export default function PortfolioLensLayout() {
  const width = useWindowWidth()
  const mobile = width < 768
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  return (
    <div style={s.shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Mobile overlay drawer */}
      {mobile && drawerOpen && (
        <div style={s.overlay} onClick={() => setDrawerOpen(false)}>
          <div onClick={e => e.stopPropagation()}>
            <Sidebar
              currentPath={location.pathname}
              onClose={() => setDrawerOpen(false)}
              mobile
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {!mobile && (
        <Sidebar
          currentPath={location.pathname}
          onClose={() => {}}
          mobile={false}
        />
      )}

      {/* Main area */}
      <div style={s.body}>
        {mobile && (
          <div style={s.mobileBar}>
            <button style={s.hamburger} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <span style={s.hamLine} />
              <span style={s.hamLine} />
              <span style={s.hamLine} />
            </button>
            <span style={s.mobileBarTitle}>PortfolioLens</span>
          </div>
        )}
        <main style={s.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const s = {
  shell: {
    display: 'flex',
    minHeight: `calc(100vh - ${NAV_H}px)`,
    background: 'linear-gradient(140deg, #f0fdf9 0%, #f0f9ff 60%, #f8f7ff 100%)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(16px)',
    borderRight: `1px solid ${ACC}1a`,
    boxShadow: `2px 0 20px ${ACC}0d`,
    display: 'flex',
    flexDirection: 'column',
    padding: '1.25rem 0 0',
    position: 'sticky',
    top: NAV_H,
    height: `calc(100vh - ${NAV_H}px)`,
    overflowY: 'auto',
  },
  sidebarMobile: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    height: '100vh',
    zIndex: 600,
    width: 260,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 1rem 1rem',
    borderBottom: `1px solid ${ACC}14`,
    marginBottom: '0.5rem',
    flexShrink: 0,
  },
  plMark: {
    width: 34, height: 34,
    borderRadius: 9, flexShrink: 0,
    background: `linear-gradient(135deg, ${ACC}, #0f7a5a)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 1,
    boxShadow: `0 3px 10px ${ACC}40`,
  },
  plTitle: { fontSize: 13, fontWeight: 700, color: '#0d3d2b', lineHeight: 1.2, flex: 1 },
  plSub:   { fontSize: 9,  fontWeight: 600, color: ACC, letterSpacing: '0.05em' },
  closeBtn: {
    marginLeft: 'auto',
    background: 'none', border: 'none',
    fontSize: 16, color: '#9ca3af', cursor: 'pointer',
    lineHeight: 1, padding: '2px 4px',
  },
  nav: { flex: 1, overflowY: 'auto', padding: '0.25rem 0' },
  section: { marginBottom: '0.75rem' },
  sectionLabel: {
    display: 'block',
    fontSize: 9, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#a7d9ca',
    padding: '0 1rem',
    marginBottom: '0.15rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 1rem 6px 0.75rem',
    textDecoration: 'none',
    color: '#4b7a6b',
    fontSize: 12.5,
    fontWeight: 500,
    borderLeft: '2px solid transparent',
    transition: 'background 0.12s, color 0.12s',
  },
  navItemActive: {
    background: `${ACC}0f`,
    color: ACC,
    borderLeftColor: ACC,
  },
  codeChip: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9, fontWeight: 700,
    padding: '1px 5px', borderRadius: 4,
    background: `${ACC}12`,
    color: `${ACC}cc`,
    letterSpacing: '0.05em',
    flexShrink: 0,
    minWidth: 26,
    textAlign: 'center',
  },
  codeChipActive: {
    background: `${ACC}22`,
    color: ACC,
  },
  itemName: { flex: 1, lineHeight: 1.3 },
  dpdpFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.75rem 1rem',
    borderTop: `1px solid ${ACC}12`,
    marginTop: 'auto',
    fontSize: 9.5,
    color: '#a7d9ca',
    fontWeight: 500,
    flexShrink: 0,
    letterSpacing: '0.02em',
  },
  dpdpDot: {
    display: 'inline-block',
    width: 6, height: 6, borderRadius: '50%',
    background: ACC, flexShrink: 0,
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(15,61,43,0.35)',
    backdropFilter: 'blur(3px)',
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  mobileBar: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '0.6rem 1rem',
    borderBottom: `1px solid ${ACC}14`,
    background: 'rgba(255,255,255,0.9)',
    flexShrink: 0,
  },
  hamburger: {
    display: 'flex', flexDirection: 'column', gap: 4,
    alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34,
    background: 'none',
    border: `1px solid ${ACC}30`,
    borderRadius: 8,
    cursor: 'pointer', padding: 0,
  },
  hamLine: {
    display: 'block',
    width: 14, height: 2,
    background: ACC,
    borderRadius: 1,
  },
  mobileBarTitle: {
    fontSize: 14, fontWeight: 700, color: '#0d3d2b',
  },
  main: {
    flex: 1,
    padding: '2rem 2.5rem',
    overflowY: 'auto',
  },
}
