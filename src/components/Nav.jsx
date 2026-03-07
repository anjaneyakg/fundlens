import { NavLink } from 'react-router-dom'

const navStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Syne:wght@400;600&display=swap');

  .fl-nav {
    position: sticky; top: 0; z-index: 200;
    height: 60px;
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(99,91,255,0.1);
    box-shadow: 0 2px 16px rgba(99,91,255,0.06);
    display: flex; align-items: center;
    padding: 0 2rem; gap: 0;
  }

  .fl-nav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; margin-right: 2.5rem;
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

  .fl-nav-links {
    display: flex; align-items: center; gap: 0; flex: 1;
  }

  .fl-nav-link {
    padding: 0 16px; height: 60px;
    display: flex; align-items: center;
    font-family: 'DM Mono'; font-size: 11px;
    letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; text-decoration: none;
    border-bottom: 2px solid transparent;
    transition: all 0.15s; white-space: nowrap;
  }
  .fl-nav-link:hover { color: #0f0c2e; border-bottom-color: rgba(99,91,255,0.3); }
  .fl-nav-link.active { color: #635bff; border-bottom-color: #635bff; }

  .fl-nav-section {
    font-family: 'DM Mono'; font-size: 9px;
    letter-spacing: 2px; text-transform: uppercase;
    color: #6b72a0; padding: 0 12px 0 20px;
    border-left: 1px solid rgba(99,91,255,0.1);
  }

  .fl-nav-tag {
    margin-left: auto;
    font-family: 'DM Mono'; font-size: 9px;
    letter-spacing: 1px; text-transform: uppercase;
    color: #6b72a0; padding: 3px 8px;
    border: 1px solid rgba(99,91,255,0.15);
    border-radius: 4px;
    background: rgba(99,91,255,0.04);
  }

  @media (max-width: 768px) {
    .fl-nav { padding: 0 1rem; overflow-x: auto; }
    .fl-nav-section { display: none; }
    .fl-nav-tag { display: none; }
  }
`;

const TOOLS = [
  { path: "/loan-vs-sip",      label: "Loan vs SIP" },
  { path: "/sip-performance",  label: "SIP Performance" },
  { path: "/wealth-creator",   label: "Wealth Creator" },
  // { path: "/fd-calculator",   label: "FD Calculator" },
];

export default function Nav() {
  return (
    <>
      <style>{navStyle}</style>
      <nav className="fl-nav">
        {/* Logo */}
        <NavLink to="/" className="fl-nav-logo">
          <div className="fl-nav-mark">F</div>
          <div className="fl-nav-brand">FUND<span>LENS</span></div>
        </NavLink>

        <div className="fl-nav-links">
          {/* Core */}
          <NavLink to="/schemes" className={({isActive}) =>
            `fl-nav-link${isActive ? " active" : ""}`}>
            Scheme Explorer
          </NavLink>

          {/* Tools section */}
          {TOOLS.length > 0 && (
            <span className="fl-nav-section">Calculators</span>
          )}
          {TOOLS.map(t => (
            <NavLink key={t.path} to={t.path}
              className={({isActive}) => `fl-nav-link${isActive ? " active" : ""}`}>
              {t.label}
            </NavLink>
          ))}
        </div>

        <div className="fl-nav-tag">Advisor Terminal</div>
      </nav>
    </>
  )
}
