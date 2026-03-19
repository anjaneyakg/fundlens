import { NavLink, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── PLAN UNIVERSE ─────────────────────────────────────────────────────────────
export const PLAN_KEY = 'fundlens_plan_universe'
export const getStoredPlan = () => localStorage.getItem(PLAN_KEY) || 'Direct'
export const setStoredPlan = (plan) => {
  localStorage.setItem(PLAN_KEY, plan)
  window.dispatchEvent(new CustomEvent('fundlens_plan_change', { detail: plan }))
}

const navStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Syne:wght@400;600&display=swap');

  html, body { overflow-x: hidden; max-width: 100%; }

  .fl-nav-wrap {
    position: sticky; top: 0; z-index: 200;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(99,91,255,0.1);
    box-shadow: 0 2px 16px rgba(99,91,255,0.06);
    width: 100%; box-sizing: border-box;
  }

  .fl-nav-row1 {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 1.5rem; height: 44px;
    border-bottom: 1px solid rgba(99,91,255,0.06);
  }
  .fl-nav-row2 {
    display: flex; align-items: center;
    padding: 0 1.5rem; height: 40px; gap: 0;
  }

  .fl-nav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0;
  }
  .fl-nav-mark {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, #635bff, #f43f8e);
    border-radius: 7px; display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue'; font-size: 15px; color: #fff;
    box-shadow: 0 3px 10px rgba(99,91,255,0.3);
  }
  .fl-nav-brand { font-family: 'Bebas Neue'; font-size: 18px; letter-spacing: 2px; color: #0f0c2e; }
  .fl-nav-brand span { color: #635bff; }

  .fl-plan-toggle { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .fl-plan-label { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #9aa0c8; }
  .fl-plan-group { display: flex; background: rgba(255,255,255,0.9); border: 1px solid rgba(99,91,255,0.15); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 4px rgba(99,91,255,0.06); }
  .fl-plan-btn { padding: 4px 12px; border: none; cursor: pointer; font-family: 'DM Mono'; font-size: 10px; letter-spacing: 0.5px; background: transparent; color: #9aa0c8; transition: all 0.15s; white-space: nowrap; }
  .fl-plan-btn.active-direct  { background: linear-gradient(135deg,#635bff,#4f46e5); color:#fff; }
  .fl-plan-btn.active-regular { background: linear-gradient(135deg,#f43f8e,#e11d48); color:#fff; }
  .fl-plan-btn:not(.active-direct):not(.active-regular):hover { color:#635bff; background:rgba(99,91,255,0.06); }

  .fl-nav-link {
    padding: 0 12px; height: 40px; display: flex; align-items: center;
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; text-decoration: none; border-bottom: 2px solid transparent;
    transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .fl-nav-link:hover { color: #0f0c2e; border-bottom-color: rgba(99,91,255,0.3); }
  .fl-nav-link.active { color: #635bff; border-bottom-color: #635bff; }

  .fl-group { position: relative; height: 40px; display: flex; align-items: center; }
  .fl-group-btn {
    padding: 0 10px; height: 40px; display: flex; align-items: center; gap: 5px;
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .fl-group-btn:hover { color: #0f0c2e; border-bottom-color: rgba(99,91,255,0.3); }
  .fl-group-btn.group-active { color: #635bff; border-bottom-color: #635bff; }
  .fl-group-btn .chevron { font-size: 8px; opacity: 0.5; transition: transform 0.2s; display: inline-block; margin-left: 2px; }
  .fl-group-btn.open .chevron { transform: rotate(180deg); }
  .group-id-pill { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; padding: 1px 5px; border-radius: 4px; margin-right: 3px; transition: all 0.15s; }

  .fl-dropdown {
    position: absolute; top: calc(100% + 1px); left: 0; min-width: 310px;
    background: #fff; border: 1px solid rgba(99,91,255,0.12); border-radius: 12px;
    box-shadow: 0 8px 40px rgba(99,91,255,0.13), 0 2px 8px rgba(0,0,0,0.06);
    padding: 6px 0 8px; opacity: 0; pointer-events: none;
    transform: translateY(8px); transition: opacity 0.18s ease, transform 0.18s ease; z-index: 300;
  }
  .fl-dropdown.visible { opacity: 1; pointer-events: all; transform: translateY(0); }
  .dd-header { display: flex; align-items: center; gap: 8px; padding: 7px 14px 6px; border-bottom: 1px solid rgba(99,91,255,0.08); margin-bottom: 4px; }
  .dd-header-id { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; background: rgba(99,91,255,0.08); color: #635bff; padding: 2px 7px; border-radius: 4px; }
  .dd-header-label { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #9aa0c8; }
  .dd-item { display: flex; align-items: center; gap: 0; padding: 6px 14px; cursor: pointer; text-decoration: none; transition: background 0.1s; border-left: 2px solid transparent; }
  .dd-item:hover { background: rgba(99,91,255,0.04); border-left-color: rgba(99,91,255,0.25); }
  .dd-item.dd-active { background: rgba(99,91,255,0.06); border-left-color: #635bff; }
  .dd-item.dd-soon { cursor: default; opacity: 0.42; }
  .dd-item.dd-soon:hover { background: none; border-left-color: transparent; }
  .dd-code { font-family: 'DM Mono'; font-size: 9px; color: #b0b8d8; letter-spacing: 0.5px; min-width: 24px; flex-shrink: 0; margin-right: 10px; }
  .dd-item.dd-active .dd-code { color: #635bff; }
  .dd-item-text { flex: 1; min-width: 0; }
  .dd-name { font-family: 'DM Mono'; font-size: 11px; color: #2d2b4e; letter-spacing: 0.2px; white-space: nowrap; }
  .dd-item.dd-active .dd-name { color: #635bff; font-weight: 500; }
  .dd-tagline { font-family: 'Syne'; font-size: 10px; color: #9aa0c8; margin-top: 1px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dd-badge { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 0.3px; padding: 2px 6px; border-radius: 8px; flex-shrink: 0; text-transform: uppercase; margin-left: 8px; }
  .dd-badge.live { background: rgba(34,197,94,0.1); color: #16a34a; border: 1px solid rgba(34,197,94,0.2); }
  .dd-badge.soon { background: rgba(107,114,176,0.07); color: #b0b8d8; border: 1px solid rgba(107,114,176,0.12); }

  .fl-hamburger { display: none; }

  @media (max-width: 768px) {
    .fl-nav-row1 { padding: 0 1rem; height: 52px; border-bottom: none; }
    .fl-nav-row2 { display: none; }
    .fl-plan-label { display: none; }
    .fl-plan-btn { padding: 5px 10px; font-size: 10px; }
    .fl-hamburger {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      width: 36px; height: 36px; border-radius: 8px;
      border: 1px solid rgba(99,91,255,0.15); background: rgba(255,255,255,0.9);
      cursor: pointer; flex-shrink: 0; margin-left: 8px;
    }
    .fl-hamburger-line { width: 16px; height: 2px; background: #6b72a0; border-radius: 1px; transition: all 0.2s; }
  }

  .fl-sheet-backdrop {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(15,12,46,0.45); backdrop-filter: blur(3px);
  }
  .fl-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 401;
    background: #fff; border-radius: 20px 20px 0 0;
    max-height: 88vh; overflow-y: auto;
    padding-bottom: 20px;
  }
  .fl-sheet-handle-row { display: flex; justify-content: center; padding: 12px 0 6px; position: sticky; top: 0; background: #fff; z-index: 1; border-bottom: 1px solid rgba(99,91,255,0.06); }
  .fl-sheet-handle { width: 36px; height: 4px; background: rgba(99,91,255,0.2); border-radius: 2px; }
  .fl-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 12px; border-bottom: 1px solid rgba(99,91,255,0.08); }
  .fl-sheet-plan-row { display: flex; align-items: center; gap: 8px; }
  .fl-sheet-plan-label { font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #9aa0c8; }
  .fl-sheet-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(99,91,255,0.15); background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6b72a0; font-size: 15px; }
  .fl-sheet-schemes-link { display: block; padding: 12px 16px; font-family: 'DM Mono'; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; color: #635bff; border-bottom: 1px solid rgba(99,91,255,0.08); background: rgba(99,91,255,0.04); }
  .fl-sheet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px 14px 4px; }
  .fl-sheet-card { border: 1px solid rgba(99,91,255,0.12); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.8); }
  .fl-sheet-card.has-active { border-color: rgba(99,91,255,0.3); background: rgba(99,91,255,0.04); }
  .fl-sheet-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .fl-sheet-card-id { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; background: rgba(99,91,255,0.08); color: #635bff; }
  .fl-sheet-card-label { font-family: 'DM Mono'; font-size: 10px; color: #6b72a0; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fl-sheet-item { display: block; padding: 5px 0; font-family: 'DM Mono'; font-size: 11px; color: #0f0c2e; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid rgba(99,91,255,0.05); transition: color 0.1s; }
  .fl-sheet-item:last-child { border-bottom: none; }
  .fl-sheet-item.item-active { color: #635bff; font-weight: 500; }
  .fl-sheet-item.item-soon { color: #b0b8d8; }
  .fl-sheet-item-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
`;

const GROUPS = [
  {
    id: "Z", label: "MF Explorer",
    items: [
      { code:"Z1", name:"Scheme Explorer",            tagline:"Check MF Scheme Snapshot",                   path:"/schemes",              live:true  },
      { code:"Z2", name:"Compare Schemes",           tagline:"Side-by-side scheme comparison",     path:"/compare-schemes",       live:true  },
      { code:"Z3", name:"Fund Screener - Features",   tagline:"xxx",                                        path:"/swp-performance",      live:false },
      { code:"Z4", name:"Fund Screener - Ratios",     tagline:"xxx",                                        path:"/stp-performance",      live:false },
      { code:"Z5", name:"Fund Manager Track",         tagline:"xxx",                                        path:"/swp-projection",       live:false },
      { code:"Z6", name:"Rolling Return Consistency", tagline:"xxx",                                        path:"/scheme-basket",        live:false },
      { code:"Z7", name:"Market Cycle Overlay",       tagline:"xxx",                                        path:"/scheme-basket",        live:false },
      { code:"Z8", name:"Category Leaderboard",       tagline:"Top funds ranked by category · Growth only", path:"/category-leaderboard", live:true  },
    ]
  },
  {
    id: "X", label: "MF Portfolios",
    items: [
      { code:"X1", name:"Scheme Snapshot",      tagline:"What is my monthly payment?",        path:"/LoanCalc",        live:false },
      { code:"X2", name:"Portfolio Overlap",    tagline:"Should I prepay or invest?",         path:"/loan-vs-sip",     live:false },
      { code:"X3", name:"Top Securities",       tagline:"What do I save by prepaying early?", path:"/loan-prepayment", live:false },
      { code:"X4", name:"Top Sectors",          tagline:"What do I save by prepaying early?", path:"/loan-prepayment", live:false },
      { code:"X5", name:"Change Tracker",       tagline:"What do I save by prepaying early?", path:"/loan-prepayment", live:false },
      { code:"X6", name:"Underlying MarketCap", tagline:"What do I save by prepaying early?", path:"/loan-prepayment", live:false },
    ]
  },
  {
    id: "A", label: "MF Calculators",
    items: [
      { code:"A1", name:"SIP Performance", tagline:"What did my SIP actually earn?",           path:"/sip-performance", live:true  },
      { code:"A2", name:"Wealth Creator",  tagline:"What will my SIP grow to?",                path:"/wealth-creator",  live:true  },
      { code:"A3", name:"SWP Performance", tagline:"What did my withdrawals cost me?",         path:"/swp-performance", live:true  },
      { code:"A4", name:"STP Performance", tagline:"Model your debt-to-equity transfer plan.", path:"/stp-calculator",  live:true  },
      { code:"A5", name:"Actual STP Analyser", tagline:"Real NAV-based STP analysis.",         path:"/stp-actual",      live:true  },
      { code: 'A6', label: 'Scheme Basket', path: '/scheme-basket', live: true, tiers: ['advisor','alpha','investor'] }
      { code:"A6", name:"Scheme Basket",   tagline:"How did my portfolio do?",                 path:"/scheme-basket",   live:true  },
    ]
  },
  {
    id: "B", label: "Loans",
    items: [
      { code:"B1", name:"Loan EMI", tagline:"What is my monthly payment?", path:"/loan-calculator", live:true },
      { code:"B2", name:"Loan vs SIP",        tagline:"Should I prepay or invest?",         path:"/loan-vs-sip",     live:true },
      { code:"B3", name:"Prepayment Benefit", tagline:"What do I save by prepaying early?", path:"/prepay-vs-invest", live:true },
    ]
  },
  {
    id: "C", label: "Risk & Goals",
    items: [
      { code:"C1", name:"Risk Profiler",   tagline:"What kind of investor am I?",   path:"/risk-profiler",   live:false },
      { code:"C2", name:"Basket Builder",  tagline:"Build my portfolio",            path:"/basket-builder",  live:false },
      { code:"C3", name:"Pre-Retirement",  tagline:"Am I on track to retire?",      path:"/pre-retirement",  live:false },
      { code:"C4", name:"Post-Retirement", tagline:"Will my money outlast me?",     path:"/post-retirement", live:false },
      { code:"C5", name:"Goal-Based SIP",  tagline:"How much do I need to invest?", path:"/goal-sip",        live:true  },
      { code:"C6", name:"Goal Calculator", tagline:"One goal. One clear number.",   path:"/goal-calculator", live:true  },
    ]
  },
  {
    id: "D", label: "Fixed Income",
    items: [
      { code:"D1", name:"FD Calculator", tagline:"What will my FD earn?",         path:"/fd-calculator", live:true  },
      { code:"D2", name:"FD vs MF",      tagline:"Is FD better than debt fund?",  path:"/fd-vs-mf",      live:true  },
      { code:"D3", name:"RD Calculator", tagline:"Recurring deposit returns",     path:"/rd-calculator", live:false },
    ]
  },
  {
    id: "E", label: "Tax & Returns",
    items: [
      { code:"E1", name:"Capital Gains",         tagline:"What is my tax liability?",             path:"/capital-gains", live:false },
      { code:"E2", name:"Post-Tax Comparator",   tagline:"Which investment is better after tax?", path:"/post-tax",      live:false },
      { code:"E3", name:"Inflation-Adj. Return", tagline:"What is my real return?",               path:"/real-return",   live:false },
      { code:"E4", name:"XIRR Calculator",       tagline:"What is my actual return?",             path:"/xirr-calc",     live:false },
    ]
  },
  {
    id: "F", label: "Advisor Tools",
    items: [
      { code:"F1", name:"Portfolio Health", tagline:"Is my portfolio well-constructed?",     path:"/portfolio-health", live:false },
      { code:"F2", name:"Rebalancing Calc", tagline:"How do I rebalance?",                   path:"/rebalancing",      live:false },
      { code:"F3", name:"Cost of Delay",    tagline:"What did waiting cost me?",             path:"/cost-of-delay",    live:false },
      { code:"F4", name:"Step-Up SIP",      tagline:"What if I increase SIP yearly?",        path:"/stepup-sip",       live:false },
      { code:"F5", name:"Lumpsum vs SIP",   tagline:"When is lumpsum better than SIP?",      path:"/lumpsum-vs-sip",   live:false },
    ]
  },
]

function GroupDropdown({ group, currentPath }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isGroupActive = group.items.some(i => i.live && i.path === currentPath)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setOpen(false) }, [currentPath])

  return (
    <div className="fl-group" ref={ref}>
      <button
        className={`fl-group-btn${isGroupActive ? ' group-active' : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="group-id-pill" style={{
          background: isGroupActive ? 'rgba(99,91,255,0.1)' : 'rgba(107,114,176,0.08)',
          color: isGroupActive ? '#635bff' : '#9aa0c8',
        }}>{group.id}</span>
        {group.label}
        <span className="chevron">▾</span>
      </button>
      <div className={`fl-dropdown${open ? ' visible' : ''}`}>
        <div className="dd-header">
          <span className="dd-header-id">{group.id}</span>
          <span className="dd-header-label">{group.label}</span>
        </div>
        {group.items.map(item => {
          const isActive = item.path === currentPath
          if (item.live) {
            return (
              <NavLink key={item.code} to={item.path}
                className={`dd-item${isActive ? ' dd-active' : ''}`}
                onClick={() => setOpen(false)}>
                <span className="dd-code">{item.code}</span>
                <span className="dd-item-text">
                  <div className="dd-name">{item.name}</div>
                  <div className="dd-tagline">"{item.tagline}"</div>
                </span>
                <span className="dd-badge live">Live</span>
              </NavLink>
            )
          }
          return (
            <div key={item.code} className="dd-item dd-soon">
              <span className="dd-code">{item.code}</span>
              <span className="dd-item-text">
                <div className="dd-name">{item.name}</div>
                <div className="dd-tagline">"{item.tagline}"</div>
              </span>
              <span className="dd-badge soon">Soon</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BottomSheet({ open, onClose, currentPath, plan, onPlanChange }) {
  const startY = useRef(null)

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY }
  const onTouchEnd = (e) => {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 60) onClose()
    startY.current = null
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => { onClose() }, [currentPath])

  if (!open) return null

  return (
    <>
      <div className="fl-sheet-backdrop" onClick={onClose} />
      <div className="fl-sheet" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="fl-sheet-handle-row">
          <div className="fl-sheet-handle" />
        </div>
        <div className="fl-sheet-header">
          <div className="fl-sheet-plan-row">
            <span className="fl-sheet-plan-label">Universe</span>
            <div className="fl-plan-group">
              <button className={`fl-plan-btn${plan === 'Direct' ? ' active-direct' : ''}`}
                onClick={() => onPlanChange('Direct')}>Direct</button>
              <button className={`fl-plan-btn${plan === 'Regular' ? ' active-regular' : ''}`}
                onClick={() => onPlanChange('Regular')}>Regular</button>
            </div>
          </div>
          <button className="fl-sheet-close" onClick={onClose}>✕</button>
        </div>
        <NavLink to="/schemes"
          className={`fl-sheet-schemes-link${currentPath === '/schemes' ? ' active-link' : ''}`}
          onClick={onClose}>
          ◈ Scheme Explorer
        </NavLink>
        <div className="fl-sheet-grid">
          {GROUPS.map(group => {
            const isGroupActive = group.items.some(i => i.live && i.path === currentPath)
            const liveItems = group.items.filter(i => i.live)
            const soonItems = group.items.filter(i => !i.live)
            return (
              <div key={group.id} className={`fl-sheet-card${isGroupActive ? ' has-active' : ''}`}>
                <div className="fl-sheet-card-header">
                  <span className="fl-sheet-card-id">{group.id}</span>
                  <span className="fl-sheet-card-label">{group.label}</span>
                </div>
                {liveItems.map(item => (
                  <NavLink key={item.code} to={item.path} onClick={onClose}
                    className={`fl-sheet-item${item.path === currentPath ? ' item-active' : ''}`}>
                    <span className="fl-sheet-item-dot"
                      style={{background: item.path === currentPath ? '#635bff' : '#16a34a'}} />
                    {item.name}
                  </NavLink>
                ))}
                {soonItems.slice(0, 2).map(item => (
                  <div key={item.code} className="fl-sheet-item item-soon">
                    <span className="fl-sheet-item-dot" style={{background:'#d1d5db'}} />
                    {item.name}
                  </div>
                ))}
                {soonItems.length > 2 && (
                  <div className="fl-sheet-item item-soon">
                    +{soonItems.length - 2} more soon
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default function Nav() {
  const location = useLocation()
  const currentPath = location.pathname
  const [plan, setPlan] = useState(getStoredPlan)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handlePlanChange = useCallback((newPlan) => {
    setPlan(newPlan)
    setStoredPlan(newPlan)
  }, [])

  return (
    <>
      <style>{navStyle}</style>
      <div className="fl-nav-wrap">

        <div className="fl-nav-row1">
          <NavLink to="/" className="fl-nav-logo">
            <div className="fl-nav-mark">F</div>
            <div className="fl-nav-brand">FUND<span>LENS</span></div>
          </NavLink>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div className="fl-plan-toggle">
              <span className="fl-plan-label">Universe</span>
              <div className="fl-plan-group">
                <button className={`fl-plan-btn${plan === 'Direct' ? ' active-direct' : ''}`}
                  onClick={() => handlePlanChange('Direct')}>Direct</button>
                <button className={`fl-plan-btn${plan === 'Regular' ? ' active-regular' : ''}`}
                  onClick={() => handlePlanChange('Regular')}>Regular</button>
              </div>
            </div>
            <button className="fl-hamburger" onClick={() => setSheetOpen(true)}
              aria-label="Open navigation">
              <div className="fl-hamburger-line" />
              <div className="fl-hamburger-line" />
              <div className="fl-hamburger-line" />
            </button>
          </div>
        </div>

        <div className="fl-nav-row2">
          <NavLink to="/schemes"
            className={({isActive}) => `fl-nav-link${isActive ? ' active' : ''}`}>
            Schemes
          </NavLink>
          {GROUPS.map(group => (
            <GroupDropdown key={group.id} group={group} currentPath={currentPath} />
          ))}
        </div>

      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentPath={currentPath}
        plan={plan}
        onPlanChange={handlePlanChange}
      />
    </>
  )
}
