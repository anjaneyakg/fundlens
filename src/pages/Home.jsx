import { useNavigate } from 'react-router-dom'
import MarketGaugeHero from '../components/MarketGaugeHero'

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

  .home {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 70% 60% at 0% 0%, rgba(99,91,255,0.1) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 100% 0%, rgba(244,63,142,0.08) 0%, transparent 50%),
      radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,107,53,0.07) 0%, transparent 55%),
      linear-gradient(160deg, #eef2ff 0%, #fdf2f8 40%, #fff7ed 100%);
    font-family: 'Syne', sans-serif;
  }

  /* HERO */
  .home-hero {
    max-width: 900px; margin: 0 auto;
    padding: 5rem 2rem 4rem;
    text-align: center;
  }
  .home-eyebrow {
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 3px;
    text-transform: uppercase; color: #635bff; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .home-eyebrow::before, .home-eyebrow::after {
    content: ''; flex: 1; max-width: 60px;
    height: 1px; background: rgba(99,91,255,0.3);
  }
  .home-title {
    font-family: 'Bebas Neue'; font-size: clamp(3rem, 8vw, 6rem);
    line-height: 0.95; letter-spacing: 3px;
    background: linear-gradient(135deg, #0f0c2e 0%, #635bff 50%, #f43f8e 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 1.5rem;
  }
  .home-subtitle {
    font-size: 17px; color: #6b72a0; max-width: 520px;
    margin: 0 auto 2.5rem; line-height: 1.7;
  }
  .home-cta-row {
    display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
  }
  .btn-primary {
    padding: 13px 28px; border-radius: 10px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #635bff, #f43f8e);
    color: white; font-family: 'DM Mono'; font-size: 12px;
    letter-spacing: 1px; text-transform: uppercase;
    box-shadow: 0 4px 16px rgba(99,91,255,0.3);
    transition: all 0.2s;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,91,255,0.4); }
  .btn-secondary {
    padding: 13px 28px; border-radius: 10px; cursor: pointer;
    background: rgba(255,255,255,0.8); border: 1px solid rgba(99,91,255,0.2);
    color: #635bff; font-family: 'DM Mono'; font-size: 12px;
    letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.2s;
  }
  .btn-secondary:hover { background: white; border-color: #635bff; }

  /* STATS */
  .home-stats {
    display: flex; justify-content: center; gap: 3rem;
    padding: 2rem; border-top: 1px solid rgba(99,91,255,0.1);
    border-bottom: 1px solid rgba(99,91,255,0.1);
    flex-wrap: wrap;
  }
  .home-stat { text-align: center; }
  .home-stat-val {
    font-family: 'Bebas Neue'; font-size: 2rem; letter-spacing: 1px;
    color: #ff6b35;
  }
  .home-stat-label {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px;
    text-transform: uppercase; color: #6b72a0; margin-top: 2px;
  }

  /* MARKET GAUGE SECTION */
  .home-gauge-section {
    max-width: 1100px; margin: 0 auto;
    padding: 3rem 2rem 0;
  }
  .home-gauge-label {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; color: #6b72a0; margin-bottom: 1rem;
    display: flex; align-items: center; gap: 12px;
  }
  .home-gauge-label::after {
    content: ''; flex: 1; height: 1px; background: rgba(99,91,255,0.12);
  }

  /* TOOLS SECTION */
  .home-section {
    max-width: 1100px; margin: 0 auto;
    padding: 3rem 2rem;
  }
  .section-heading {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; color: #6b72a0; margin-bottom: 1.5rem;
    display: flex; align-items: center; gap: 12px;
  }
  .section-heading::after {
    content: ''; flex: 1; height: 1px; background: rgba(99,91,255,0.12);
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .tool-card {
    background: rgba(255,255,255,0.75); border: 1px solid rgba(99,91,255,0.1);
    border-radius: 14px; padding: 1.5rem;
    cursor: pointer; transition: all 0.2s;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 12px rgba(99,91,255,0.05);
    display: flex; flex-direction: column; gap: 10px;
  }
  .tool-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 32px rgba(99,91,255,0.12);
    border-color: rgba(99,91,255,0.25);
    background: rgba(255,255,255,0.95);
  }
  .tool-card.live { border-left: 3px solid #635bff; }
  .tool-card.coming { opacity: 0.6; cursor: default; }
  .tool-card.coming:hover { transform: none; box-shadow: 0 2px 12px rgba(99,91,255,0.05); }

  .tool-icon {
    font-size: 1.75rem; width: 48px; height: 48px;
    background: rgba(99,91,255,0.06); border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .tool-name {
    font-family: 'Syne'; font-size: 15px; font-weight: 700; color: #0f0c2e;
  }
  .tool-desc { font-size: 13px; color: #6b72a0; line-height: 1.5; }
  .tool-tag {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; padding: 3px 8px; border-radius: 20px;
    display: inline-block; width: fit-content;
    margin-top: auto;
  }
  .tag-live { background: rgba(99,91,255,0.1); color: #635bff; }
  .tag-soon { background: rgba(107,114,160,0.1); color: #6b72a0; }

  /* FOOTER */
  .home-footer {
    text-align: center; padding: 2rem;
    font-family: 'DM Mono'; font-size: 10px;
    color: #6b72a0; letter-spacing: 1px;
    border-top: 1px solid rgba(99,91,255,0.08);
  }
`;

const TOOLS = [
  {
    icon: "📊",
    name: "Market Valuation Gauge",
    desc: "Is the market cheap or expensive? Percentile-based valuation score across 35 years of BSE history — PE, PB and Dividend Yield composite.",
    tag: "live",
    path: "/tools/market-gauge",
  },
  {
    icon: "📊",
    name: "Scheme Explorer",
    desc: "Search, filter and analyse the full Indian MF universe. Trailing returns, risk metrics, peer comparison.",
    tag: "live",
    path: "/schemes",
  },
  {
    icon: "🏦",
    name: "Loan vs SIP",
    desc: "Three-way decision tool — prepay your home loan, reduce EMI, or invest in MF. See the exact rupee difference.",
    tag: "live",
    path: "/loan-vs-sip",
  },
  {
    icon: "📈",
    name: "SIP Performance",
    desc: "Calculate actual historical returns of a SIP in any scheme over any period. Real NAV data, true XIRR.",
    tag: "live",
    path: "/sip-performance",
  },
  {
    icon: "💰",
    name: "Wealth Creator",
    desc: "Project your SIP into a future corpus. Forward and reverse calculator side by side — with inflation adjustment.",
    tag: "live",
    path: "/wealth-creator",
  },
  {
    icon: "🔄",
    name: "Rolling Returns",
    desc: "Analyse consistency of fund returns across all rolling periods — not just trailing snapshots.",
    tag: "soon",
    path: null,
  },
  {
    icon: "🏦",
    name: "FD Calculator",
    desc: "Full matrix — dual tenure comparison, all compounding frequencies, payout options, senior citizen rates, real returns after inflation.",
    tag: "live",
    path: "/fd-calculator",
  },
  {
    icon: "🔃",
    name: "SWP Planner",
    desc: "Plan systematic withdrawals from your corpus. How long will your money last?",
    tag: "soon",
    path: null,
  },
  {
    icon: "🎯",
    name: "Risk Profiler",
    desc: "8-parameter risk assessment → personalised scheme basket recommendation.",
    tag: "soon",
    path: null,
  },
];

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <style>{style}</style>

      {/* Hero */}
      <div className="home-hero">
        <div className="home-eyebrow">◈ Institutional Grade Investment Analytics Tools</div>
        <div className="home-title">INVESTMENT<br/>INTELLIGENCE<br/>TERMINAL (IIT)</div>
        <div className="home-subtitle">
          Professional-grade tools for financial advisors and serious investors.
          Analyse, compare and decide — with real data, not assumptions.
        </div>
        <div className="home-cta-row">
          <button className="btn-primary" onClick={() => navigate('/schemes')}>
            Explore Schemes →
          </button>
          <button className="btn-secondary" onClick={() => navigate('/loan-vs-sip')}>
            Try Loan vs SIP
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="home-stats">
        <div className="home-stat">
          <div className="home-stat-val">1,200+</div>
          <div className="home-stat-label">Active Schemes</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-val">51</div>
          <div className="home-stat-label">Fund Houses</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-val">7</div>
          <div className="home-stat-label">Return Periods</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-val">Free</div>
          <div className="home-stat-label">Always</div>
        </div>
      </div>

      {/* Market Valuation Gauge — hero widget */}
      <div className="home-gauge-section">
        <div className="home-gauge-label">◈ Live Market Pulse</div>
        <MarketGaugeHero />
      </div>

      {/* Tools */}
      <div className="home-section">
        <div className="section-heading">◈ All Tools</div>
        <div className="tools-grid">
          {TOOLS.map(tool => (
            <div
              key={tool.name}
              className={`tool-card ${tool.tag === "live" ? "live" : "coming"}`}
              onClick={() => tool.path && navigate(tool.path)}
            >
              <div className="tool-icon">{tool.icon}</div>
              <div className="tool-name">{tool.name}</div>
              <div className="tool-desc">{tool.desc}</div>
              <div className={`tool-tag ${tool.tag === "live" ? "tag-live" : "tag-soon"}`}>
                {tool.tag === "live" ? "● Live" : "Coming Soon"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="home-footer">
        FUNDLENS · DATA FROM AMFIINDIA.COM · BSE INDIA · FOR INFORMATIONAL PURPOSES ONLY
      </div>
    </div>
  )
}
