import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdvisorMode } from '../context/AdvisorModeContext'
import { supabase } from '../lib/supabaseClient'

// ── STATIC FALLBACK (used when Supabase fetch fails or returns empty) ─────────
const STATIC_PROMOS = [
  { id: '1', text: '30 years of NAV history — deeper fund analysis than anywhere else' },
  { id: '2', text: 'Monthly holdings from 50 AMCs — see what funds actually own' },
  { id: '3', text: 'Built for Indian investors and advisors — DPDP compliant by design' },
]

// ── THEME ─────────────────────────────────────────────────────────────────────
const css = `
  :root {
    --hp-accent:    #1D9E75;
    --hp-accent-dk: #0f7a5a;
    --hp-ria:       #1565C0;
    --hp-ria-lt:    #e8f0fe;
    --hp-text:      #0f172a;
    --hp-text-2:    #475569;
    --hp-text-3:    #94a3b8;
    --hp-border:    #e2e8f0;
    --hp-green-lt:  #f0fdf9;
    --hp-bg-strip:  #f8fafc;
    --hp-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .hp-wrap {
    font-family: var(--hp-font); color: var(--hp-text);
    background: #fff; min-height: 100vh;
  }

  /* ── CAROUSEL ── */
  .hp-carousel {
    background: var(--hp-green-lt);
    border-bottom: 1px solid rgba(29,158,117,0.15);
    padding: 13px 24px 11px;
    text-align: center; display: flex; flex-direction: column;
    align-items: center; gap: 9px;
  }
  .hp-carousel-text {
    font-size: 14px; color: var(--hp-accent-dk); font-weight: 500;
    margin: 0; max-width: 720px; line-height: 1.5; min-height: 21px;
  }
  .hp-dots { display: flex; gap: 6px; align-items: center; }
  .hp-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(29,158,117,0.3); border: none; cursor: pointer; padding: 0;
    transition: all 0.25s ease; flex-shrink: 0;
  }
  .hp-dot.hp-dot-active { background: var(--hp-accent); width: 18px; border-radius: 3px; }

  /* ── HERO ── */
  .hp-hero {
    padding: 96px 24px 88px;
    max-width: 860px; margin: 0 auto; text-align: center;
  }
  .hp-eyebrow {
    display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.09em;
    text-transform: uppercase; color: var(--hp-accent);
    background: var(--hp-green-lt); border: 1px solid rgba(29,158,117,0.22);
    border-radius: 20px; padding: 5px 16px; margin-bottom: 28px;
  }
  .hp-headline {
    font-size: clamp(2.1rem, 5.5vw, 3.5rem); font-weight: 700; line-height: 1.12;
    color: var(--hp-text); margin: 0 0 20px; letter-spacing: -0.025em;
  }
  .hp-sub {
    font-size: 18px; color: var(--hp-text-2); line-height: 1.67;
    max-width: 560px; margin: 0 auto 36px;
  }
  .hp-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .hp-btn-primary {
    padding: 14px 28px; background: var(--hp-accent); color: #fff;
    border: none; border-radius: 10px; font-size: 15px; font-weight: 600;
    font-family: var(--hp-font); cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    box-shadow: 0 2px 14px rgba(29,158,117,0.28);
  }
  .hp-btn-primary:hover { background: var(--hp-accent-dk); transform: translateY(-1px); }
  .hp-btn-secondary {
    padding: 14px 28px; background: #fff; color: var(--hp-accent);
    border: 1.5px solid var(--hp-accent); border-radius: 10px;
    font-size: 15px; font-weight: 600; font-family: var(--hp-font);
    cursor: pointer; transition: all 0.15s;
  }
  .hp-btn-secondary:hover { background: var(--hp-green-lt); }

  /* ── DATA STRIP ── */
  .hp-data-strip {
    background: var(--hp-bg-strip);
    border-top: 1px solid var(--hp-border);
    border-bottom: 1px solid var(--hp-border);
    padding: 26px 24px;
    display: flex; justify-content: center; align-items: center; flex-wrap: wrap;
  }
  .hp-data-item {
    padding: 8px 32px; font-size: 14px; color: var(--hp-text-2);
    font-weight: 500; text-align: center;
  }
  .hp-data-sep { width: 1px; height: 20px; background: var(--hp-border); flex-shrink: 0; }

  /* ── FEATURE SECTIONS ── */
  .hp-feat-outer { width: 100%; }
  .hp-feat-outer.hp-feat-alt {
    background: var(--hp-bg-strip);
    border-top: 1px solid var(--hp-border);
    border-bottom: 1px solid var(--hp-border);
  }
  .hp-section {
    max-width: 1100px; margin: 0 auto;
    padding: 80px 32px;
    display: flex; align-items: center; gap: 80px;
  }
  .hp-section.hp-flipped { flex-direction: row-reverse; }
  .hp-section-text { flex: 1; }
  .hp-section-visual { flex: 1; }
  .hp-feat-eyebrow {
    font-size: 11px; font-weight: 600; letter-spacing: 0.09em;
    text-transform: uppercase; color: var(--hp-accent); margin-bottom: 14px;
  }
  .hp-feat-headline {
    font-size: clamp(1.6rem, 3vw, 2.15rem); font-weight: 700; line-height: 1.2;
    color: var(--hp-text); margin: 0 0 16px; letter-spacing: -0.015em;
  }
  .hp-feat-body {
    font-size: 16px; color: var(--hp-text-2); line-height: 1.72; margin: 0 0 28px;
  }

  /* Plan visual */
  .hp-plan-visual {
    background: var(--hp-green-lt); border: 1px solid rgba(29,158,117,0.15);
    border-radius: 20px; padding: 28px;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    box-shadow: 0 6px 32px rgba(29,158,117,0.1);
  }
  .hp-mini-card {
    background: #fff; border: 1px solid var(--hp-border); border-radius: 12px;
    padding: 16px 10px; text-align: center;
    font-size: 12px; font-weight: 600; color: var(--hp-text-2);
  }
  .hp-mini-card-icon { font-size: 22px; margin-bottom: 7px; display: block; }

  /* Research visual */
  .hp-research-visual {
    background: #fff; border: 1px solid var(--hp-border);
    border-radius: 20px; padding: 28px;
    box-shadow: 0 4px 28px rgba(0,0,0,0.07);
  }
  .hp-chart-wrap {
    display: flex; align-items: flex-end; gap: 10px;
    height: 120px; margin-bottom: 18px;
  }
  .hp-bar-col {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;
  }
  .hp-bar {
    width: 100%; background: var(--hp-accent); border-radius: 5px 5px 0 0;
    opacity: 0.82; min-height: 4px;
  }
  .hp-bar-lbl { font-size: 10px; color: var(--hp-text-3); }
  .hp-research-card {
    background: var(--hp-green-lt); border-radius: 10px; padding: 12px 14px;
  }
  .hp-rc-name { font-size: 13px; font-weight: 600; color: var(--hp-text); margin-bottom: 4px; }
  .hp-rc-ret { font-size: 12px; color: var(--hp-accent); font-weight: 500; }

  /* Track visual */
  .hp-track-visual {
    background: var(--hp-green-lt); border: 1px solid rgba(29,158,117,0.15);
    border-radius: 20px; padding: 32px; text-align: center;
    box-shadow: 0 6px 32px rgba(29,158,117,0.08);
  }
  .hp-score-ring {
    width: 96px; height: 96px; border-radius: 50%; margin: 0 auto 14px;
    border: 8px solid rgba(29,158,117,0.18);
    border-top-color: var(--hp-accent);
    border-right-color: var(--hp-accent);
    border-bottom-color: var(--hp-accent);
    display: flex; align-items: center; justify-content: center;
  }
  .hp-score-val { font-size: 26px; font-weight: 700; color: var(--hp-accent); }
  .hp-score-label { font-size: 14px; font-weight: 600; color: var(--hp-text-2); margin-bottom: 20px; }
  .hp-checks { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .hp-check {
    display: flex; justify-content: space-between; align-items: center;
    background: #fff; border-radius: 8px; padding: 8px 12px;
    font-size: 12px; color: var(--hp-text-2);
  }
  .hp-check-ok  { color: var(--hp-accent); font-weight: 600; }
  .hp-check-warn { color: #d97706; font-weight: 600; }

  /* ── ADVISOR STRIP ── */
  .hp-advisor-outer {
    background: var(--hp-bg-strip);
    border-top: 1px solid var(--hp-border);
    border-bottom: 1px solid var(--hp-border);
    padding: 80px 32px;
  }
  .hp-advisor-inner {
    max-width: 900px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
  }
  .hp-advisor-card {
    background: #fff; border-radius: 20px; padding: 36px 32px;
    border: 2px solid; box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  }
  .hp-advisor-card.hp-mfd { border-color: rgba(29,158,117,0.25); }
  .hp-advisor-card.hp-ria { border-color: rgba(21,101,192,0.2); }
  .hp-advisor-tag {
    display: inline-block; font-size: 11px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    border-radius: 6px; padding: 4px 10px; margin-bottom: 16px;
  }
  .hp-advisor-card.hp-mfd .hp-advisor-tag { background: var(--hp-green-lt); color: var(--hp-accent); }
  .hp-advisor-card.hp-ria .hp-advisor-tag { background: var(--hp-ria-lt);   color: var(--hp-ria); }
  .hp-advisor-headline {
    font-size: 1.35rem; font-weight: 700; line-height: 1.3;
    color: var(--hp-text); margin: 0 0 12px;
  }
  .hp-advisor-body {
    font-size: 15px; color: var(--hp-text-2); line-height: 1.65; margin: 0 0 24px;
  }
  .hp-btn-mfd {
    padding: 11px 22px; background: var(--hp-accent); color: #fff;
    border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
    font-family: var(--hp-font); cursor: pointer; transition: background 0.15s;
  }
  .hp-btn-mfd:hover { background: var(--hp-accent-dk); }
  .hp-btn-ria {
    padding: 11px 22px; background: var(--hp-ria); color: #fff;
    border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
    font-family: var(--hp-font); cursor: pointer; transition: background 0.15s;
  }
  .hp-btn-ria:hover { background: #0d47a1; }

  /* ── COMING SOON ── */
  .hp-coming-wrap { text-align: center; padding: 80px 24px; }
  .hp-coming-badge {
    display: inline-block; font-size: 11px; font-weight: 600;
    letter-spacing: 0.09em; text-transform: uppercase;
    background: #f1f5f9; color: var(--hp-text-3);
    border: 1px solid var(--hp-border); border-radius: 20px;
    padding: 5px 14px; margin-bottom: 20px;
  }
  .hp-coming-headline {
    font-size: 1.8rem; font-weight: 700; color: var(--hp-text);
    margin: 0 auto 16px; letter-spacing: -0.015em; max-width: 480px;
  }
  .hp-coming-body {
    font-size: 16px; color: var(--hp-text-2); line-height: 1.65;
    max-width: 460px; margin: 0 auto;
  }

  /* ── FOOTER ── */
  .hp-footer {
    background: var(--hp-bg-strip); border-top: 1px solid var(--hp-border);
    padding: 40px 32px 32px;
  }
  .hp-footer-inner { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
  .hp-footer-top {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px;
  }
  .hp-footer-brand { font-size: 18px; font-weight: 700; color: var(--hp-text); letter-spacing: -0.01em; }
  .hp-footer-brand span { color: var(--hp-accent); }
  .hp-footer-links { display: flex; gap: 24px; flex-wrap: wrap; }
  .hp-footer-link {
    font-size: 13px; color: var(--hp-text-2); cursor: pointer;
    background: none; border: none; font-family: var(--hp-font); padding: 0;
    transition: color 0.1s;
  }
  .hp-footer-link:hover { color: var(--hp-text); }
  .hp-footer-disclaimer {
    font-size: 11px; color: var(--hp-text-3); line-height: 1.65;
    border-top: 1px solid var(--hp-border); padding-top: 20px; margin: 0;
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .hp-hero { padding: 56px 20px 48px; }
    .hp-sub  { font-size: 16px; }
    .hp-section, .hp-section.hp-flipped { flex-direction: column; padding: 48px 20px; gap: 36px; }
    .hp-advisor-outer { padding: 48px 20px; }
    .hp-advisor-inner { grid-template-columns: 1fr; }
    .hp-coming-wrap { padding: 48px 20px; }
    .hp-footer { padding: 32px 20px 24px; }
    .hp-data-sep { display: none; }
    .hp-data-item { padding: 6px 16px; font-size: 13px; }
  }
  @media (max-width: 480px) {
    .hp-plan-visual { grid-template-columns: repeat(2, 1fr); }
  }
`

// ── CAROUSEL ──────────────────────────────────────────────────────────────────
function Carousel({ promos }) {
  const [active, setActive] = useState(0)
  const intervalRef = useRef(null)
  const countRef    = useRef(promos.length)
  countRef.current  = promos.length

  useEffect(() => {
    intervalRef.current = setInterval(
      () => setActive(s => (s + 1) % countRef.current),
      4000
    )
    return () => clearInterval(intervalRef.current)
  }, [])

  function goTo(i) {
    clearInterval(intervalRef.current)
    setActive(i)
    intervalRef.current = setInterval(
      () => setActive(s => (s + 1) % countRef.current),
      4000
    )
  }

  return (
    <div className="hp-carousel">
      <p className="hp-carousel-text">{promos[active]?.text}</p>
      <div className="hp-dots">
        {promos.map((_, i) => (
          <button
            key={i}
            className={`hp-dot${i === active ? ' hp-dot-active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── FEATURE SECTION VISUALS ───────────────────────────────────────────────────
function PlanVisual() {
  const tools = [
    { icon: '📈', label: 'SIP' },
    { icon: '🎯', label: 'Goals' },
    { icon: '🏦', label: 'Loans' },
    { icon: '💰', label: 'FD' },
    { icon: '🔄', label: 'SWP' },
    { icon: '📊', label: 'Tax' },
  ]
  return (
    <div className="hp-plan-visual">
      {tools.map(t => (
        <div key={t.label} className="hp-mini-card">
          <span className="hp-mini-card-icon">{t.icon}</span>
          {t.label}
        </div>
      ))}
    </div>
  )
}

function ResearchVisual() {
  const bars = [
    { pct: 55, label: '1Y' },
    { pct: 78, label: '3Y' },
    { pct: 62, label: '5Y' },
    { pct: 91, label: '10Y' },
    { pct: 70, label: '30Y' },
  ]
  return (
    <div className="hp-research-visual">
      <div className="hp-chart-wrap">
        {bars.map(b => (
          <div key={b.label} className="hp-bar-col">
            <div className="hp-bar" style={{ height: `${b.pct}%` }} />
            <span className="hp-bar-lbl">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="hp-research-card">
        <div className="hp-rc-name">Nifty 50 Index Fund — Direct</div>
        <div className="hp-rc-ret">+18.4% · 5Y XIRR · Low overlap</div>
      </div>
    </div>
  )
}

function TrackVisual() {
  const checks = [
    { label: 'Diversification',  ok: true  },
    { label: 'Overlap score',    ok: true  },
    { label: 'Liquidity ratio',  ok: false },
    { label: 'Tax efficiency',   ok: true  },
  ]
  return (
    <div className="hp-track-visual">
      <div className="hp-score-ring">
        <span className="hp-score-val">8</span>
      </div>
      <div className="hp-score-label">Portfolio Health Score</div>
      <div className="hp-checks">
        {checks.map(c => (
          <div key={c.label} className="hp-check">
            <span>{c.label}</span>
            {c.ok
              ? <span className="hp-check-ok">✓ Good</span>
              : <span className="hp-check-warn">⚠ Review</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const { advisorMode } = useAdvisorMode()

  const [promos, setPromos] = useState(STATIC_PROMOS)

  useEffect(() => {
    async function loadPromos() {
      try {
        const { data, error } = await supabase
          .from('promo_messages')
          .select('id, text')
          .eq('is_active', true)
          .order('display_order')
        if (error) throw error
        if (data && data.length > 0) setPromos(data)
      } catch (err) {
        console.error('Home: promo_messages fetch failed, using static fallback', err)
      }
    }
    loadPromos()
  }, [])

  return (
    <div className="hp-wrap">
      <style>{css}</style>

      {/* A — CAROUSEL */}
      <Carousel promos={promos} />

      {/* B — HERO */}
      <div className="hp-hero">
        <div className="hp-eyebrow">
          {advisorMode ? 'For IFDs, MFDs and SEBI RIAs' : 'For Indian investors'}
        </div>
        {advisorMode ? (
          <>
            <h1 className="hp-headline">Give your clients the analysis they deserve.</h1>
            <p className="hp-sub">
              White-label portfolio reports, multi-client dashboard and co-branded campaigns
              — built for IFDs, MFDs and RIAs.
            </p>
            <div className="hp-cta-row">
              <button className="hp-btn-primary"    onClick={() => navigate('/promote')}>See advisor features</button>
              <button className="hp-btn-secondary"  onClick={() => navigate('/login')}>Get started</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="hp-headline">Know your mutual funds.<br />Really know them.</h1>
            <p className="hp-sub">
              Portfolio health, overlap, capital gains and 30-year NAV history
              — all in one place.
            </p>
            <div className="hp-cta-row">
              <button className="hp-btn-primary"    onClick={() => navigate('/portfolio')}>Analyse my portfolio</button>
              <button className="hp-btn-secondary"  onClick={() => navigate('/schemes')}>Explore funds</button>
            </div>
          </>
        )}
      </div>

      {/* C — DATA INDICATORS STRIP */}
      <div className="hp-data-strip">
        <div className="hp-data-item">Rich NAV history</div>
        <div className="hp-data-sep" />
        <div className="hp-data-item">Updated monthly scheme portfolios</div>
        <div className="hp-data-sep" />
        <div className="hp-data-item">Latest market index values</div>
      </div>

      {/* D — FEATURE SECTIONS */}

      {/* Plan — text left, visual right */}
      <div className="hp-feat-outer">
        <div className="hp-section">
          <div className="hp-section-text">
            <div className="hp-feat-eyebrow">Plan</div>
            <h2 className="hp-feat-headline">Plan with confidence</h2>
            <p className="hp-feat-body">
              SIP projections, SWP planning, goal calculators and loan tools —
              everything a retail investor needs to plan their financial journey.
            </p>
            <button className="hp-btn-primary" onClick={() => navigate('/sip-performance')}>
              Start planning
            </button>
          </div>
          <div className="hp-section-visual">
            <PlanVisual />
          </div>
        </div>
      </div>

      {/* Research — text right, visual left (flipped) */}
      <div className="hp-feat-outer hp-feat-alt">
        <div className="hp-section hp-flipped">
          <div className="hp-section-text">
            <div className="hp-feat-eyebrow">Research</div>
            <h2 className="hp-feat-headline">Research like a professional</h2>
            <p className="hp-feat-body">
              Fund explorer, overlap analysis, risk ratios and 30-year NAV charts.
              No third-party data — direct from AMFI.
            </p>
            <button className="hp-btn-primary" onClick={() => navigate('/schemes')}>
              Explore funds
            </button>
          </div>
          <div className="hp-section-visual">
            <ResearchVisual />
          </div>
        </div>
      </div>

      {/* Track — text left, visual right */}
      <div className="hp-feat-outer">
        <div className="hp-section">
          <div className="hp-section-text">
            <div className="hp-feat-eyebrow">Track</div>
            <h2 className="hp-feat-headline">Track everything that matters</h2>
            <p className="hp-feat-body">
              Upload your CAMS or KFin statement and get instant portfolio health,
              capital gains, overlap and rebalancing suggestions.
            </p>
            <button className="hp-btn-primary" onClick={() => navigate('/portfolio')}>
              Analyse my portfolio
            </button>
          </div>
          <div className="hp-section-visual">
            <TrackVisual />
          </div>
        </div>
      </div>

      {/* E — ADVISOR STRIP */}
      <div className="hp-advisor-outer">
        <div className="hp-advisor-inner">
          <div className="hp-advisor-card hp-mfd">
            <div className="hp-advisor-tag">For MFDs and IFDs</div>
            <h3 className="hp-advisor-headline">Built for fund distributors</h3>
            <p className="hp-advisor-body">
              Multi-client dashboard, white-label PDF reports and co-branded WhatsApp
              campaigns. Grow your practice with better tools.
            </p>
            <button className="hp-btn-mfd" onClick={() => navigate('/promote')}>
              See MFD features
            </button>
          </div>
          <div className="hp-advisor-card hp-ria">
            <div className="hp-advisor-tag">For SEBI RIAs</div>
            <h3 className="hp-advisor-headline">Built for fee-based advisors</h3>
            <p className="hp-advisor-body">
              SEBI TRI benchmarking, unlimited clients and full audit trail. Everything
              you need for fee-based advisory compliance.
            </p>
            <button className="hp-btn-ria" onClick={() => navigate('/promote')}>
              See RIA features
            </button>
          </div>
        </div>
      </div>

      {/* F — SAVE & INVEST TEASER */}
      <div className="hp-coming-wrap">
        <div className="hp-coming-badge">Coming soon</div>
        <h2 className="hp-coming-headline">Save &amp; Invest</h2>
        <p className="hp-coming-body">
          Direct mutual fund transactions, SIP management and goal-based investing
          — in one place.
        </p>
      </div>

      {/* G — FOOTER */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-top">
            <div className="hp-footer-brand">Fund<span>Lens</span></div>
            <div className="hp-footer-links">
              <button className="hp-footer-link">Privacy Policy</button>
              <button className="hp-footer-link">Terms</button>
              <button className="hp-footer-link">Contact</button>
            </div>
          </div>
          <p className="hp-footer-disclaimer">
            NAV data sourced from AMFI. Index data from BSE. Holdings data from AMC monthly disclosures.
            FundLens is a financial analysis platform — not a distributor or investment advisor.
            All analysis is for informational purposes only.
          </p>
        </div>
      </footer>
    </div>
  )
}
