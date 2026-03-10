import { NavLink, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'

const navStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Syne:wght@400;600&display=swap');

  html, body { overflow-x: hidden; max-width: 100%; }

  /* ── BASE NAV ── */
  .fl-nav {
    position: sticky; top: 0; z-index: 200;
    height: 60px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(99,91,255,0.1);
    box-shadow: 0 2px 16px rgba(99,91,255,0.06);
    display: flex; align-items: center;
    padding: 0 1.5rem; gap: 0;
    width: 100%; box-sizing: border-box;
  }

  /* ── LINKS ROW ── */
  .fl-nav-links {
    display: flex; align-items: center; gap: 0; flex: 1; height: 60px;
    min-width: 0;
  }

  /* ── LOGO ── */
  .fl-nav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; margin-right: 2rem; flex-shrink: 0;
  }
  .fl-nav-mark {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #635bff, #f43f8e);
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue'; font-size: 16px; color: #fff;
    box-shadow: 0 3px 10px rgba(99,91,255,0.3);
  }
  .fl-nav-brand {
    font-family: 'Bebas Neue'; font-size: 20px;
    letter-spacing: 2px; color: #0f0c2e;
  }
  .fl-nav-brand span { color: #635bff; }

  /* ── LINKS ROW ── */

  /* ── PLAIN LINK ── */
  .fl-nav-link {
    padding: 0 14px; height: 60px;
    display: flex; align-items: center;
    font-family: 'DM Mono'; font-size: 11px;
    letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; text-decoration: none;
    border-bottom: 2px solid transparent;
    transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .fl-nav-link:hover { color: #0f0c2e; border-bottom-color: rgba(99,91,255,0.3); }
  .fl-nav-link.active { color: #635bff; border-bottom-color: #635bff; }

  /* ── GROUP TRIGGER ── */
  .fl-group {
    position: relative; height: 60px;
    display: flex; align-items: center;
  }
  .fl-group-btn {
    padding: 0 11px; height: 60px;
    display: flex; align-items: center; gap: 5px;
    font-family: 'DM Mono'; font-size: 11px;
    letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; background: none; border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    flex-shrink: 0;
  }
  .fl-group-btn:hover { color: #0f0c2e; border-bottom-color: rgba(99,91,255,0.3); }
  .fl-group-btn.group-active { color: #635bff; border-bottom-color: #635bff; }
  .fl-group-btn .chevron {
    font-size: 8px; opacity: 0.5; transition: transform 0.2s;
    display: inline-block; margin-left: 2px;
  }
  .fl-group-btn.open .chevron { transform: rotate(180deg); }

  .group-id-pill {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px;
    padding: 1px 5px; border-radius: 4px; margin-right: 3px;
    transition: all 0.15s;
  }

  /* ── DROPDOWN PANEL ── */
  .fl-dropdown {
    position: absolute; top: calc(100% + 1px); left: 0;
    min-width: 310px;
    background: #fff;
    border: 1px solid rgba(99,91,255,0.12);
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(99,91,255,0.13), 0 2px 8px rgba(0,0,0,0.06);
    padding: 6px 0 8px;
    opacity: 0; pointer-events: none;
    transform: translateY(8px);
    transition: opacity 0.18s ease, transform 0.18s ease;
    z-index: 300;
  }
  .fl-dropdown.visible {
    opacity: 1; pointer-events: all; transform: translateY(0);
  }

  /* group header inside dropdown */
  .dd-header {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 14px 6px;
    border-bottom: 1px solid rgba(99,91,255,0.08);
    margin-bottom: 4px;
  }
  .dd-header-id {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    background: rgba(99,91,255,0.08); color: #635bff;
    padding: 2px 7px; border-radius: 4px;
  }
  .dd-header-label {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: #9aa0c8;
  }

  /* individual item */
  .dd-item {
    display: flex; align-items: center; gap: 0;
    padding: 6px 14px; cursor: pointer;
    text-decoration: none;
    transition: background 0.1s;
    border-left: 2px solid transparent;
  }
  .dd-item:hover { background: rgba(99,91,255,0.04); border-left-color: rgba(99,91,255,0.25); }
  .dd-item.dd-active {
    background: rgba(99,91,255,0.06); border-left-color: #635bff;
  }
  .dd-item.dd-soon {
    cursor: default; opacity: 0.42;
  }
  .dd-item.dd-soon:hover { background: none; border-left-color: transparent; }

  .dd-code {
    font-family: 'DM Mono'; font-size: 9px; color: #b0b8d8;
    letter-spacing: 0.5px; min-width: 24px; flex-shrink: 0;
    margin-right: 10px;
  }
  .dd-item.dd-active .dd-code { color: #635bff; }

  .dd-item-text { flex: 1; min-width: 0; }
  .dd-name {
    font-family: 'DM Mono'; font-size: 11px; color: #2d2b4e;
    letter-spacing: 0.2px; white-space: nowrap;
  }
  .dd-item.dd-active .dd-name { color: #635bff; font-weight: 500; }
  .dd-tagline {
    font-family: 'Syne'; font-size: 10px; color: #9aa0c8;
    margin-top: 1px; font-style: italic;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .dd-badge {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 0.3px;
    padding: 2px 6px; border-radius: 8px; flex-shrink: 0;
    text-transform: uppercase; margin-left: 8px;
  }
  .dd-badge.live {
    background: rgba(34,197,94,0.1); color: #16a34a;
    border: 1px solid rgba(34,197,94,0.2);
  }
  .dd-badge.soon {
    background: rgba(107,114,176,0.07); color: #b0b8d8;
    border: 1px solid rgba(107,114,176,0.12);
  }

  /* ── RIGHT TAG ── */
  .fl-nav-tag {
    margin-left: auto; flex-shrink: 0;
    font-family: 'DM Mono'; font-size: 9px;
    letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; padding: 3px 10px;
    border: 1px solid rgba(99,91,255,0.15);
    border-radius: 4px;
    background: rgba(99,91,255,0.04);
  }

  /* ── MOBILE ── */
  @media (max-width: 900px) {
    .fl-nav { padding: 0 1rem; }
    .fl-nav-tag { display: none; }
    .fl-group-btn { padding: 0 8px; font-size: 10px; }
    .fl-nav-link { padding: 0 10px; font-size: 10px; }
    .fl-dropdown { min-width: 270px; }
    .group-id-pill { display: none; }
  }
`;

// ── FULL CALCULATOR REGISTRY ──────────────────────────────────────────────────
const GROUPS = [
  {
    id: "Z", label: "MF Explorer",
    items: [
      { code:"Z1", name:"Scheme Explorer",      tagline:"Check MF Scheme Snapshot",        path:"/schemes",  live:true  },
      { code:"Z2", name:"Compare Schemes",        tagline:"xxx",             path:"/wealth-creator",   live:false  },
      { code:"Z3", name:"Fund Screener - Features",       tagline:"xxx",      path:"/swp-performance",  live:false },
      { code:"Z4", name:"Fund Screener - Ratios",        tagline:"xxx",            path:"/stp-performance",  live:false },
      { code:"Z5", name:"Fund Manager Track",        tagline:"xxx",         path:"/swp-projection",   live:false },
      { code:"Z6", name:"Rolling Return Consistency",         tagline:"xxx",              path:"/scheme-basket",    live:false },
      { code:"Z7", name:"Market Cycle Overlay",         tagline:"xxx",              path:"/scheme-basket",    live:false },
      { code:"Z8", name:"Scheme Ranking",         tagline:"xxx",              path:"/scheme-basket",    live:false },
    ]
  },
{
    id: "X", label: "MF Portfolios",
    items: [
      { code:"X1", name:"Scheme Snapshot",              tagline:"What is my monthly payment?",           path:"/LoanCalc",         live:false },
      { code:"X2", name:"Portfolio Overlap",           tagline:"Should I prepay or invest?",            path:"/loan-vs-sip",      live:false  },
      { code:"X3", name:"Top Securities",    tagline:"What do I save by prepaying early?",    path:"/loan-prepayment",  live:false },
      { code:"X4", name:"Top Sectors",    tagline:"What do I save by prepaying early?",    path:"/loan-prepayment",  live:false },
      { code:"X5", name:"Change Tracker",    tagline:"What do I save by prepaying early?",    path:"/loan-prepayment",  live:false },
      { code:"X6", name:"Underlying MarketCap",    tagline:"What do I save by prepaying early?",    path:"/loan-prepayment",  live:false },
    ]
  },
  {
    id: "A", label: "MF Calculators",
    items: [
      { code:"A1", name:"SIP Performance",      tagline:"What did my SIP actually earn?",        path:"/sip-performance",  live:true  },
      { code:"A2", name:"Wealth Creator",        tagline:"What will my SIP grow to?",             path:"/wealth-creator",   live:true  },
      { code:"A3", name:"SWP Performance",       tagline:"What did my withdrawals cost me?",      path:"/swp-performance",  live:true },
      { code:"A4", name:"STP Performance",        tagline:"Was my STP decision right?",            path:"/stp-performance",  live:false },
      { code:"A5", name:"SWP Projection",        tagline:"How long will my corpus last?",         path:"/swp-projection",   live:false },
      { code:"A6", name:"Scheme Basket",         tagline:"How did my portfolio do?",              path:"/scheme-basket",    live:false },
    ]
  },
  {
    id: "B", label: "Loans",
    items: [
      { code:"B1", name:"Loan EMI",              tagline:"What is my monthly payment?",           path:"/LoanCalc",         live:true },
      { code:"B2", name:"Loan vs SIP",           tagline:"Should I prepay or invest?",            path:"/loan-vs-sip",      live:true  },
      { code:"B3", name:"Prepayment Benefit",    tagline:"What do I save by prepaying early?",    path:"/loan-prepayment",  live:true },
    ]
  },
  {
    id: "C", label: "Risk & Goals",
    items: [
      { code:"C1", name:"Risk Profiler",         tagline:"What kind of investor am I?",           path:"/risk-profiler",    live:false },
      { code:"C2", name:"Basket Builder",        tagline:"Build my portfolio",                    path:"/basket-builder",   live:false },
      { code:"C3", name:"Pre-Retirement",        tagline:"Am I on track to retire?",              path:"/pre-retirement",   live:false },
      { code:"C4", name:"Post-Retirement",       tagline:"Will my money outlast me?",             path:"/post-retirement",  live:false },
      { code:"C5", name:"Goal-Based SIP",        tagline:"How much do I need to invest?",         path:"/goal-sip",         live:true },
      { code:"C6", name:"Goal Calculator",       tagline:"One goal. One clear number.",           path:"/goal-calculator", live:true }
    ]
  },
  {
    id: "D", label: "Fixed Income",
    items: [
      { code:"D1", name:"FD Calculator",         tagline:"What will my FD earn?",                 path:"/fd-calculator",    live:true  },
      { code:"D2", name:"FD vs MF",              tagline:"Is FD better than debt fund?",          path:"/fd-vs-mf",         live:true },
      { code:"D3", name:"RD Calculator",         tagline:"Recurring deposit returns",             path:"/rd-calculator",    live:false },
    ]
  },
  {
    id: "E", label: "Tax & Returns",
    items: [
      { code:"E1", name:"Capital Gains",         tagline:"What is my tax liability?",             path:"/capital-gains",    live:false },
      { code:"E2", name:"Post-Tax Comparator",   tagline:"Which investment is better after tax?", path:"/post-tax",         live:false },
      { code:"E3", name:"Inflation-Adj. Return", tagline:"What is my real return?",               path:"/real-return",      live:false },
      { code:"E4", name:"XIRR Calculator",       tagline:"What is my actual return?",             path:"/xirr-calc",        live:false },
    ]
  },
  {
    id: "F", label: "Advisor Tools",
    items: [
      { code:"F1", name:"Portfolio Health",      tagline:"Is my portfolio well-constructed?",     path:"/portfolio-health", live:false },
      { code:"F2", name:"Rebalancing Calc",      tagline:"How do I rebalance?",                   path:"/rebalancing",      live:false },
      { code:"F3", name:"Cost of Delay",         tagline:"What did waiting cost me?",             path:"/cost-of-delay",    live:false },
      { code:"F4", name:"Step-Up SIP",           tagline:"What if I increase SIP yearly?",        path:"/stepup-sip",       live:false },
      { code:"F5", name:"Lumpsum vs SIP",        tagline:"When is lumpsum better than SIP?",      path:"/lumpsum-vs-sip",   live:false },
    ]
  },
];

// ── DROPDOWN COMPONENT ────────────────────────────────────────────────────────
function GroupDropdown({ group, currentPath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isGroupActive = group.items.some(i => i.live && i.path === currentPath);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpen(false); }, [currentPath]);

  return (
    <div className="fl-group" ref={ref}>
      <button
        className={`fl-group-btn${isGroupActive ? " group-active" : ""}${open ? " open" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="group-id-pill" style={{
          background: isGroupActive ? "rgba(99,91,255,0.1)" : "rgba(107,114,176,0.08)",
          color: isGroupActive ? "#635bff" : "#9aa0c8",
        }}>{group.id}</span>
        {group.label}
        <span className="chevron">▾</span>
      </button>

      <div className={`fl-dropdown${open ? " visible" : ""}`}>
        <div className="dd-header">
          <span className="dd-header-id">{group.id}</span>
          <span className="dd-header-label">{group.label}</span>
        </div>

        {group.items.map(item => {
          const isActive = item.path === currentPath;
          if (item.live) {
            return (
              <NavLink
                key={item.code}
                to={item.path}
                className={`dd-item${isActive ? " dd-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="dd-code">{item.code}</span>
                <span className="dd-item-text">
                  <div className="dd-name">{item.name}</div>
                  <div className="dd-tagline">"{item.tagline}"</div>
                </span>
                <span className="dd-badge live">Live</span>
              </NavLink>
            );
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
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN NAV ──────────────────────────────────────────────────────────────────
export default function Nav() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      <style>{navStyle}</style>
      <nav className="fl-nav">
        <NavLink to="/" className="fl-nav-logo">
          <div className="fl-nav-mark">F</div>
          <div className="fl-nav-brand">FUND<span>LENS</span></div>
        </NavLink>

        <div className="fl-nav-links">
          <NavLink to="/schemes"
            className={({isActive}) => `fl-nav-link${isActive ? " active" : ""}`}>
            Schemes
          </NavLink>

          {GROUPS.map(group => (
            <GroupDropdown key={group.id} group={group} currentPath={currentPath} />
          ))}
        </div>

        <div className="fl-nav-tag">Advisor Terminal</div>
      </nav>
    </>
  );
}
