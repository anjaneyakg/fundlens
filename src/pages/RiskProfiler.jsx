/**
 * C1 — Risk Profiler
 * FundLens · Group C: Risk & Goals
 *
 * Section 1: Quick Profile (5–6 adaptive parameters)
 * Section 2: Deep Profile (6 remaining parameters)
 * Section 3: Weight Studio (advisor parameter weighting)
 *
 * Output: Score (0–100) + Spectrum label + 2D Capacity×Attitude matrix
 *         + 3-axis allocation + personalised commentary + lifestyle guidance
 *
 * No auth dependency. localStorage for session persistence only.
 * Saving to profile is a later phase (G-group).
 */

import { useState, useEffect, useCallback } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
`;

// ─── Scoring constants ────────────────────────────────────────────────────────
// Default weights (sum = 100)
const DEFAULT_WEIGHTS = {
  age: 8,
  dependents: 7,
  expenseShare: 6,
  experience: 8,
  savingsPct: 9,
  portfolioVsLiabilities: 9,
  timeToGoal: 10,
  goalPriority: 8,
  goalAmountVsPortfolio: 9,
  riskAttitude: 10,
  earningStage: 8,
  objective: 8,
};

// Which parameters feed which sub-score
const CAPACITY_PARAMS = ["age", "dependents", "expenseShare", "savingsPct", "portfolioVsLiabilities", "timeToGoal", "goalAmountVsPortfolio", "earningStage"];
const ATTITUDE_PARAMS = ["experience", "goalPriority", "riskAttitude", "objective"];

// Score mappings for each parameter (1–5, where 5 = highest risk capacity/appetite)
function scoreParam(key, value) {
  if (value === null || value === undefined) return null;
  const maps = {
    age: v => v <= 25 ? 5 : v <= 35 ? 4 : v <= 45 ? 3 : v <= 55 ? 2 : 1,
    dependents: v => v === 0 ? 5 : v === 1 ? 4 : v === 2 ? 3 : v === 3 ? 2 : 1,
    expenseShare: v => v <= 20 ? 5 : v <= 35 ? 4 : v <= 50 ? 3 : v <= 70 ? 2 : 1,
    experience: v => ({ none: 1, less2: 2, two5: 3, five10: 4, above10: 5 }[v] ?? 3),
    savingsPct: v => v >= 40 ? 5 : v >= 25 ? 4 : v >= 15 ? 3 : v >= 8 ? 2 : 1,
    portfolioVsLiabilities: v => v >= 300 ? 5 : v >= 150 ? 4 : v >= 80 ? 3 : v >= 40 ? 2 : 1,
    timeToGoal: v => v >= 15 ? 5 : v >= 10 ? 4 : v >= 7 ? 3 : v >= 3 ? 2 : 1,
    goalPriority: v => ({ soft: 5, deferred: 4, stretch: 3, hard: 2 }[v] ?? 3),
    goalAmountVsPortfolio: v => v <= 20 ? 5 : v <= 40 ? 4 : v <= 70 ? 3 : v <= 120 ? 2 : 1,
    riskAttitude: v => Math.round(v / 20) + 1, // slider 0–80 → 1–5
    earningStage: v => ({ salaried: 3, business: 4, retired: 1, other: 2 }[v] ?? 3),
    objective: v => ({ preservation: 1, income: 2, balanced: 3, growth: 4, aggressive: 5 }[v] ?? 3),
  };
  return maps[key] ? maps[key](value) : null;
}

// ─── Profile zones ────────────────────────────────────────────────────────────
const ZONES = [
  { min: 0,  max: 20, label: "Very Conservative", color: "#2d6a4f", bg: "#d8f3dc", desc: "Capital protection is paramount. Minimal volatility tolerance." },
  { min: 20, max: 40, label: "Conservative",      color: "#40916c", bg: "#b7e4c7", desc: "Steady income focus. Low equity exposure preferred." },
  { min: 40, max: 60, label: "Moderate",           color: "#e9c46a", bg: "#fef9e7", desc: "Balanced growth and stability. Diversified portfolio." },
  { min: 60, max: 80, label: "Growth Oriented",    color: "#f4a261", bg: "#fdf0e8", desc: "Growth focus with manageable volatility. Medium-long horizon." },
  { min: 80, max: 101,"label": "Aggressive",        color: "#e76f51", bg: "#fde8e4", desc: "Maximum growth orientation. High volatility tolerance." },
];

function getZone(score) {
  return ZONES.find(z => score >= z.min && score < z.max) || ZONES[2];
}

// ─── Allocation model ─────────────────────────────────────────────────────────
function getAllocation(score, timeToGoal) {
  const horizon = timeToGoal || 7;
  const base = score / 100;
  const equity = Math.round(25 + base * 55);
  const hybrid = Math.round(15 + base * 15);
  const safe = 100 - equity - hybrid;
  const coreEq = Math.round(equity * 0.75);
  const satEq = equity - coreEq;
  const coreHy = Math.round(hybrid * 0.7);
  const satHy = hybrid - coreHy;
  const coreSf = Math.round(safe * 0.85);
  const satSf = safe - coreSf;
  const st = horizon <= 3 ? Math.round(safe * 0.6) : Math.round(safe * 0.3);
  const mt = horizon <= 7 ? Math.round(hybrid + safe * 0.4) : Math.round(hybrid * 0.6 + safe * 0.3);
  const lt = 100 - st - mt;
  return {
    equity, hybrid, safe,
    core: { equity: coreEq, hybrid: coreHy, safe: coreSf },
    satellite: { equity: satEq, hybrid: satHy, safe: satSf },
    horizon: { short: st, medium: mt, long: lt },
  };
}

// ─── Fund category suggestions ────────────────────────────────────────────────
function getSuggestedCategories(score) {
  if (score < 20) return ["Liquid Funds", "Overnight Funds", "Ultra Short Duration", "Arbitrage Funds"];
  if (score < 40) return ["Short Duration", "Banking & PSU Debt", "Conservative Hybrid", "Equity Savings"];
  if (score < 60) return ["Balanced Advantage", "Aggressive Hybrid", "Large Cap", "Multi Asset"];
  if (score < 80) return ["Flexi Cap", "Large & Mid Cap", "Mid Cap", "ELSS", "Balanced Advantage"];
  return ["Small Cap", "Mid Cap", "Sectoral/Thematic", "International Equity", "Multi Cap"];
}

// ─── Personalised commentary ──────────────────────────────────────────────────
function generateCommentary(answers, score, zone) {
  const { age, earningStage, dependents, timeToGoal, objective, savingsPct } = answers;
  const lines = [];
  const stageLbl = { salaried: "salaried professional", business: "business owner", retired: "retiree", other: "professional" };
  if (age && earningStage) lines.push(`As a ${stageLbl[earningStage] || "investor"} at ${age}, your risk-bearing capacity reflects both the runway ahead and the financial responsibilities you carry.`);
  if (dependents > 0) lines.push(`With ${dependents} dependent${dependents > 1 ? "s" : ""}, ensuring adequate downside protection is important before stretching for higher returns.`);
  if (savingsPct >= 25) lines.push(`Your strong savings discipline (${savingsPct}% of income) is a genuine asset — it gives you the buffer to absorb short-term market volatility.`);
  else if (savingsPct < 15) lines.push(`Strengthening your savings rate would meaningfully expand your risk capacity over time.`);
  if (timeToGoal && timeToGoal >= 10) lines.push(`A ${timeToGoal}-year horizon is your greatest advantage — time allows compounding to work and recoveries to materialise.`);
  else if (timeToGoal && timeToGoal < 5) lines.push(`With your key goal ${timeToGoal} years away, capital preservation in that tranche takes priority over growth.`);
  lines.push(`Overall, a ${zone.label} profile suits your current financial circumstances. Review annually or when life circumstances change significantly.`);
  return lines;
}

// ─── Lifestyle guidance ───────────────────────────────────────────────────────
function getLifestyleGuidance(score, answers) {
  const all = [
    { icon: "🛡️", title: "Emergency Buffer First", text: "Maintain 6–12 months of expenses in liquid instruments before committing to equity." },
    { icon: "📋", title: "Term Insurance Check", text: "Ensure life cover is 10–15× your annual income. This is non-negotiable before aggressive investing." },
    { icon: "📈", title: "SIP Discipline", text: "Automate your SIPs — behavioral consistency matters more than timing." },
    { icon: "⚖️", title: "Annual Rebalancing", text: "Review and rebalance your portfolio once a year to maintain your target allocation." },
    { icon: "🏥", title: "Health Cover Gap", text: "Ensure adequate health insurance — medical costs are the #1 portfolio disruptor." },
    { icon: "🎯", title: "Goal Ringfencing", text: "Keep short-term goal funds separate from long-term investments to avoid premature redemption." },
    { icon: "📊", title: "Avoid Recency Bias", text: "Don't chase last year's top-performing category. Stick to your asset allocation." },
    { icon: "💡", title: "Tax Efficiency", text: "Maximise ELSS and NPS contributions before investing in taxable instruments." },
  ];
  const selected = score < 40
    ? [all[0], all[1], all[4]]
    : score < 70
    ? [all[2], all[3], all[5]]
    : [all[3], all[6], all[7]];
  return selected;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

const fmt = n => n === null || n === undefined ? "—" : n;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ section, step, totalSteps }) {
  const pct = Math.round((step / totalSteps) * 100);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#8b7355", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Section {section} · Step {step} of {totalSteps}
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6b4c9a", fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "#e8e0d0", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #6b4c9a, #c9a84c)", borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function QuestionCard({ question, children, hint }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", borderRadius: 20, padding: "28px 32px", border: "1px solid rgba(107,76,154,0.12)", boxShadow: "0 4px 24px rgba(107,76,154,0.07)", marginBottom: 24 }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#2c1a4a", marginBottom: hint ? 6 : 20, lineHeight: 1.4, fontWeight: 600 }}>{question}</div>
      {hint && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9b8c7a", marginBottom: 20, fontStyle: "italic" }}>{hint}</div>}
      {children}
    </div>
  );
}

function CardGrid({ options, value, onChange, cols = 2 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${selected ? "#6b4c9a" : "rgba(107,76,154,0.15)"}`, background: selected ? "linear-gradient(135deg, #f3eeff, #ede3ff)" : "rgba(255,255,255,0.8)", cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", transform: selected ? "scale(1.02)" : "scale(1)", boxShadow: selected ? "0 4px 16px rgba(107,76,154,0.2)" : "none" }}>
            {opt.icon && <div style={{ fontSize: 24, marginBottom: 6 }}>{opt.icon}</div>}
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: selected ? 600 : 400, color: selected ? "#4a2d7a" : "#4a3f35", lineHeight: 1.3 }}>{opt.label}</div>
            {opt.sub && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a", marginTop: 3 }}>{opt.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 100, step = 5, label, leftLabel, rightLabel }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9b8c7a" }}>{leftLabel}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#6b4c9a", fontWeight: 600 }}>{label ? label(value) : value}</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9b8c7a" }}>{rightLabel}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#6b4c9a", height: 6, cursor: "pointer" }} />
    </div>
  );
}

function GoalPriorityMatrix({ value, onChange }) {
  const quadrants = [
    { id: "soft",     label: "Soft Goal",     desc: "Time & amount both flexible", row: 0, col: 0, icon: "🌱" },
    { id: "deferred", label: "Deferred Goal",  desc: "Flexible timing, fixed amount", row: 0, col: 1, icon: "📦" },
    { id: "stretch",  label: "Stretch Goal",   desc: "Fixed timing, flexible amount", row: 1, col: 0, icon: "🎯" },
    { id: "hard",     label: "Hard Goal",      desc: "Fixed timing & fixed amount", row: 1, col: 1, icon: "🔒" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gridTemplateRows: "32px 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", textAlign: "center", alignSelf: "center", letterSpacing: "0.05em" }}>AMOUNT FLEXIBLE</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", textAlign: "center", alignSelf: "center", letterSpacing: "0.05em" }}>AMOUNT FIXED</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", textAlign: "right", alignSelf: "center", paddingRight: 8, letterSpacing: "0.05em", writingMode: "horizontal-tb" }}>TIME FLEX</div>
        {quadrants.filter(q => q.row === 0).map(q => (
          <button key={q.id} onClick={() => onChange(q.id)}
            style={{ padding: "16px 12px", borderRadius: 14, border: `2px solid ${value === q.id ? "#6b4c9a" : "rgba(107,76,154,0.15)"}`, background: value === q.id ? "linear-gradient(135deg, #f3eeff, #ede3ff)" : "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", boxShadow: value === q.id ? "0 4px 16px rgba(107,76,154,0.2)" : "none" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{q.icon}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: value === q.id ? "#4a2d7a" : "#4a3f35" }}>{q.label}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a", marginTop: 2 }}>{q.desc}</div>
          </button>
        ))}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", textAlign: "right", alignSelf: "center", paddingRight: 8, letterSpacing: "0.05em" }}>TIME FIXED</div>
        {quadrants.filter(q => q.row === 1).map(q => (
          <button key={q.id} onClick={() => onChange(q.id)}
            style={{ padding: "16px 12px", borderRadius: 14, border: `2px solid ${value === q.id ? "#6b4c9a" : "rgba(107,76,154,0.15)"}`, background: value === q.id ? "linear-gradient(135deg, #f3eeff, #ede3ff)" : "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "center", transition: "all 0.2s", boxShadow: value === q.id ? "0 4px 16px rgba(107,76,154,0.2)" : "none" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{q.icon}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: value === q.id ? "#4a2d7a" : "#4a3f35" }}>{q.label}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a", marginTop: 2 }}>{q.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Score computation ────────────────────────────────────────────────────────
function computeScores(answers, weights) {
  let capacityWeighted = 0, capacityTotal = 0;
  let attitudeWeighted = 0, attitudeTotal = 0;
  let totalWeighted = 0, totalW = 0;

  Object.keys(weights).forEach(key => {
    const raw = answers[key];
    const s = scoreParam(key, raw);
    if (s === null) return;
    const w = weights[key];
    const normalized = (s - 1) / 4 * 100; // 1–5 → 0–100
    totalWeighted += normalized * w;
    totalW += w;
    if (CAPACITY_PARAMS.includes(key)) { capacityWeighted += normalized * w; capacityTotal += w; }
    if (ATTITUDE_PARAMS.includes(key)) { attitudeWeighted += normalized * w; attitudeTotal += w; }
  });

  const composite = totalW > 0 ? Math.round(totalWeighted / totalW) : 50;
  const capacity = capacityTotal > 0 ? Math.round(capacityWeighted / capacityTotal) : 50;
  const attitude = attitudeTotal > 0 ? Math.round(attitudeWeighted / attitudeTotal) : 50;
  return { composite, capacity, attitude };
}

// ─── Result Panel ─────────────────────────────────────────────────────────────
function ResultPanel({ answers, weights, isMobile }) {
  const { composite, capacity, attitude } = computeScores(answers, weights);
  const zone = getZone(composite);
  const alloc = getAllocation(composite, answers.timeToGoal);
  const categories = getSuggestedCategories(composite);
  const commentary = generateCommentary(answers, composite, zone);
  const guidance = getLifestyleGuidance(composite, answers);

  const matrixX = (attitude / 100) * 240;
  const matrixY = 240 - (capacity / 100) * 240;

  return (
    <div style={{ animation: "fadeInUp 0.5s ease" }}>
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(20px);} to { opacity:1; transform:translateY(0);} }`}</style>

      {/* Score strip */}
      <div style={{ background: `linear-gradient(135deg, ${zone.bg}, #fdf8f0)`, borderRadius: 20, padding: "28px 32px", border: `1.5px solid ${zone.color}30`, marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9b8c7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Risk Profile Score</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: zone.color, fontWeight: 700, lineHeight: 1 }}>{composite}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", marginTop: 4 }}>out of 100</div>
          </div>
          <div style={{ textAlign: isMobile ? "left" : "right" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#2c1a4a", fontWeight: 600 }}>{zone.label}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6b5c4c", marginTop: 4, maxWidth: 240, lineHeight: 1.5 }}>{zone.desc}</div>
          </div>
        </div>

        {/* Spectrum bar */}
        <div style={{ marginTop: 24 }}>
          <div style={{ height: 12, borderRadius: 6, background: "linear-gradient(90deg, #2d6a4f, #40916c, #e9c46a, #f4a261, #e76f51)", position: "relative", marginBottom: 8 }}>
            <div style={{ position: "absolute", top: -4, left: `${composite}%`, transform: "translateX(-50%)", width: 20, height: 20, borderRadius: "50%", background: zone.color, border: "3px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", transition: "left 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {ZONES.map(z => <span key={z.label} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#9b8c7a", letterSpacing: "0.05em" }}>{z.label.split(" ")[0].toUpperCase()}</span>)}
          </div>
        </div>
      </div>

      {/* 2D Matrix + Sub-scores */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 24, border: "1px solid rgba(107,76,154,0.12)" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#4a3f35", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Capacity × Attitude Matrix</div>
          <svg viewBox="0 0 280 280" width="100%" style={{ maxWidth: 260 }}>
            {/* Grid */}
            <rect x="20" y="20" width="240" height="240" fill="#faf7f2" rx="8" />
            <line x1="140" y1="20" x2="140" y2="260" stroke="#e8e0d0" strokeWidth="1" strokeDasharray="4,3" />
            <line x1="20" y1="140" x2="260" y2="140" stroke="#e8e0d0" strokeWidth="1" strokeDasharray="4,3" />
            {/* Quadrant fills */}
            <rect x="20" y="20" width="120" height="120" fill="#d8f3dc" fillOpacity="0.4" rx="4" />
            <rect x="140" y="20" width="120" height="120" fill="#e9c46a" fillOpacity="0.2" rx="4" />
            <rect x="20" y="140" width="120" height="120" fill="#fde8e4" fillOpacity="0.4" rx="4" />
            <rect x="140" y="140" width="120" height="120" fill="#e76f51" fillOpacity="0.2" rx="4" />
            {/* Quadrant labels */}
            <text x="80" y="80" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#40916c" opacity="0.7">HIGH CAP</text>
            <text x="80" y="92" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#40916c" opacity="0.7">LOW ATT</text>
            <text x="200" y="80" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#c9a84c" opacity="0.8">HIGH CAP</text>
            <text x="200" y="92" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#c9a84c" opacity="0.8">HIGH ATT</text>
            <text x="80" y="200" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#e76f51" opacity="0.7">LOW CAP</text>
            <text x="80" y="212" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#e76f51" opacity="0.7">LOW ATT</text>
            <text x="200" y="200" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#e76f51" opacity="0.8">LOW CAP</text>
            <text x="200" y="212" textAnchor="middle" fontFamily="DM Mono" fontSize="9" fill="#e76f51" opacity="0.8">HIGH ATT</text>
            {/* Axis labels */}
            <text x="150" y="275" textAnchor="middle" fontFamily="DM Mono" fontSize="10" fill="#9b8c7a">RISK ATTITUDE →</text>
            <text x="10" y="140" textAnchor="middle" fontFamily="DM Mono" fontSize="10" fill="#9b8c7a" transform="rotate(-90,10,140)">RISK CAPACITY →</text>
            {/* Investor dot */}
            <circle cx={20 + matrixX} cy={matrixY + 20} r="10" fill={zone.color} fillOpacity="0.25" />
            <circle cx={20 + matrixX} cy={matrixY + 20} r="6" fill={zone.color} />
            <circle cx={20 + matrixX} cy={matrixY + 20} r="3" fill="white" />
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#6b4c9a", fontWeight: 600 }}>{capacity}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a" }}>Risk Capacity</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#c9a84c", fontWeight: 600 }}>{attitude}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a" }}>Risk Attitude</div>
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 24, border: "1px solid rgba(107,76,154,0.12)" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#4a3f35", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggested Allocation</div>

          {/* Core vs Satellite */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9b8c7a", marginBottom: 8, letterSpacing: "0.06em" }}>CORE vs SATELLITE</div>
            {[
              { label: "Equity", core: alloc.core.equity, sat: alloc.satellite.equity, color: "#e76f51" },
              { label: "Hybrid", core: alloc.core.hybrid, sat: alloc.satellite.hybrid, color: "#e9c46a" },
              { label: "Safe", core: alloc.core.safe, sat: alloc.satellite.safe, color: "#40916c" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#6b5c4c", width: 40 }}>{row.label}</div>
                <div style={{ flex: 1, height: 8, background: "#f0ece4", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${row.core}%`, background: row.color, opacity: 0.85 }} title={`Core: ${row.core}%`} />
                  <div style={{ width: `${row.sat}%`, background: row.color, opacity: 0.4 }} title={`Satellite: ${row.sat}%`} />
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4a3f35", width: 36, textAlign: "right" }}>{row.core + row.sat}%</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, background: "#6b4c9a", borderRadius: 2 }} /><span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a" }}>Core</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, background: "#6b4c9a", opacity: 0.35, borderRadius: 2 }} /><span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a" }}>Satellite</span></div>
            </div>
          </div>

          {/* Horizon split */}
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9b8c7a", marginBottom: 8, letterSpacing: "0.06em" }}>TIME HORIZON SPLIT</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Short\n<3yr", val: alloc.horizon.short, color: "#6b4c9a" },
                { label: "Medium\n3–7yr", val: alloc.horizon.medium, color: "#c9a84c" },
                { label: "Long\n>7yr", val: alloc.horizon.long, color: "#2d6a4f" },
              ].map(h => (
                <div key={h.label} style={{ flex: h.val, textAlign: "center", background: h.color + "18", borderRadius: 10, padding: "8px 4px", border: `1px solid ${h.color}30` }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: h.color, fontWeight: 600 }}>{h.val}%</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#9b8c7a", whiteSpace: "pre-line", lineHeight: 1.3, marginTop: 2 }}>{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Suggested fund categories */}
      <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", borderRadius: 20, padding: 24, border: "1px solid rgba(107,76,154,0.12)", marginBottom: 20 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#4a3f35", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggested Fund Categories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.map(cat => (
            <span key={cat} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#4a2d7a", background: "#f3eeff", borderRadius: 20, padding: "6px 14px", border: "1px solid rgba(107,76,154,0.2)" }}>{cat}</span>
          ))}
        </div>
      </div>

      {/* Commentary */}
      <div style={{ background: "linear-gradient(135deg, #fdf8f0, #f8f0ff)", borderRadius: 20, padding: 24, border: "1px solid rgba(107,76,154,0.1)", marginBottom: 20 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#4a3f35", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Personalised Commentary</div>
        {commentary.map((line, i) => (
          <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#4a3f35", lineHeight: 1.7, margin: "0 0 10px 0" }}>{line}</p>
        ))}
      </div>

      {/* Lifestyle guidance */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#4a3f35", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Lifestyle Guidance</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
          {guidance.map((g, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.72)", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(107,76,154,0.1)" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{g.icon}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#2c1a4a", marginBottom: 6 }}>{g.title}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6b5c4c", lineHeight: 1.6 }}>{g.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Weight Studio ────────────────────────────────────────────────────────────
function WeightStudio({ weights, onChange, answers }) {
  const { composite, capacity, attitude } = computeScores(answers, weights);
  const zone = getZone(composite);
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);

  const labels = {
    age: "Age", dependents: "Dependents", expenseShare: "Own Expense Share",
    experience: "Investment Experience", savingsPct: "Savings %", portfolioVsLiabilities: "Portfolio vs Liabilities",
    timeToGoal: "Time to Next Goal", goalPriority: "Goal Priority Type", goalAmountVsPortfolio: "Goal Amount vs Portfolio",
    riskAttitude: "Risk Attitude", earningStage: "Earning Stage", objective: "Investment Objective",
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", borderRadius: 20, padding: "28px 32px", border: "1px solid rgba(107,76,154,0.12)", boxShadow: "0 4px 24px rgba(107,76,154,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#2c1a4a", fontWeight: 600, marginBottom: 4 }}>Parameter Weight Studio</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9b8c7a" }}>Adjust how much each factor contributes to the risk score</div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, color: zone.color, fontWeight: 700 }}>{composite}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9b8c7a" }}>Live Score</div>
          </div>
          <button onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#6b4c9a", background: "#f3eeff", border: "1px solid rgba(107,76,154,0.2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: totalW === 100 ? "#40916c" : "#e76f51", background: totalW === 100 ? "#d8f3dc" : "#fde8e4", borderRadius: 6, padding: "4px 10px" }}>
          Total: {totalW} / 100 {totalW !== 100 ? "⚠️ normalised" : "✓"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
        {Object.entries(weights).map(([key, w]) => (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#4a3f35" }}>{labels[key]}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6b4c9a", fontWeight: 600 }}>{w}</span>
            </div>
            <input type="range" min={1} max={20} step={1} value={w}
              onChange={e => onChange({ ...weights, [key]: Number(e.target.value) })}
              style={{ width: "100%", accentColor: CAPACITY_PARAMS.includes(key) ? "#6b4c9a" : "#c9a84c", cursor: "pointer" }} />
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9b8c7a", marginTop: 2 }}>
              {CAPACITY_PARAMS.includes(key) ? "CAPACITY" : "ATTITUDE"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RiskProfiler() {
  const isMobile = useWindowWidth() <= 768;
  const [activeSection, setActiveSection] = useState(1);
  const [s1Step, setS1Step] = useState(0);
  const [s2Step, setS2Step] = useState(0);
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [showResult, setShowResult] = useState(false);

  const [answers, setAnswers] = useState({
    // Section 1
    age: 32,
    earningStage: null,
    dependents: null,
    savingsPct: 20,
    objective: null,
    riskAttitude: 40,
    // Section 2
    expenseShare: 50,
    portfolioVsLiabilities: 80,
    experience: null,
    timeToGoal: 7,
    goalPriority: null,
    goalAmountVsPortfolio: 60,
  });

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fundlens_risk_profiler");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(a => ({ ...a, ...parsed.answers }));
        if (parsed.weights) setWeights(w => ({ ...w, ...parsed.weights }));
      }
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fundlens_risk_profiler", JSON.stringify({ answers, weights }));
    } catch {}
  }, [answers, weights]);

  const set = useCallback((key, val) => setAnswers(a => ({ ...a, [key]: val })), []);

  // ── Section 1 questions ──
  const s1Questions = [
    {
      key: "age",
      q: "How old are you?",
      hint: "Your age directly shapes your investment horizon and risk capacity.",
      render: () => (
        <Slider value={answers.age} onChange={v => set("age", v)} min={18} max={75} step={1}
          label={v => `${v} years`} leftLabel="18" rightLabel="75" />
      ),
    },
    {
      key: "earningStage",
      q: "What best describes your earning situation?",
      hint: "Income stability is a key determinant of your risk capacity.",
      render: () => (
        <CardGrid cols={2} value={answers.earningStage} onChange={v => set("earningStage", v)} options={[
          { value: "salaried", icon: "💼", label: "Salaried", sub: "Fixed monthly income" },
          { value: "business", icon: "🏢", label: "Business / Self-employed", sub: "Variable income" },
          { value: "retired", icon: "🌅", label: "Retired", sub: "Corpus / pension income" },
          { value: "other", icon: "🎓", label: "Other", sub: "Freelance / gig / studying" },
        ]} />
      ),
    },
    {
      key: "dependents",
      q: "How many family members depend on you financially?",
      hint: "Dependents reduce your capacity to absorb investment losses.",
      render: () => (
        <CardGrid cols={3} value={answers.dependents} onChange={v => set("dependents", v)} options={[
          { value: 0, icon: "👤", label: "None" },
          { value: 1, icon: "👥", label: "1" },
          { value: 2, icon: "👨‍👩‍👦", label: "2" },
          { value: 3, icon: "👨‍👩‍👧‍👦", label: "3" },
          { value: 4, icon: "🏠", label: "4" },
          { value: 5, icon: "🏘️", label: "5+" },
        ]} />
      ),
    },
    {
      key: "savingsPct",
      q: "What % of your monthly income do you save or invest?",
      hint: "Higher savings rate = greater capacity to sustain long-term equity exposure.",
      render: () => (
        <Slider value={answers.savingsPct} onChange={v => set("savingsPct", v)} min={0} max={70} step={5}
          label={v => `${v}%`} leftLabel="0%" rightLabel="70%+" />
      ),
    },
    {
      key: "objective",
      q: "What is your primary investment objective?",
      render: () => (
        <CardGrid cols={1} value={answers.objective} onChange={v => set("objective", v)} options={[
          { value: "preservation", icon: "🛡️", label: "Capital Preservation", sub: "Protect what I have, even if returns are low" },
          { value: "income", icon: "💰", label: "Regular Income", sub: "Steady cash flows; moderate growth acceptable" },
          { value: "balanced", icon: "⚖️", label: "Balanced Growth", sub: "Equal priority on growth and stability" },
          { value: "growth", icon: "📈", label: "Long-term Growth", sub: "Willing to endure volatility for higher returns" },
          { value: "aggressive", icon: "🚀", label: "Maximum Wealth Creation", sub: "Comfortable with significant short-term swings" },
        ]} />
      ),
    },
    {
      key: "riskAttitude",
      q: "If your portfolio dropped 20% in 3 months, what would you do?",
      hint: "This reveals your behavioural response to market volatility.",
      render: () => (
        <>
          <CardGrid cols={2} value={
            answers.riskAttitude <= 15 ? "panic" :
            answers.riskAttitude <= 35 ? "reduce" :
            answers.riskAttitude <= 55 ? "hold" :
            answers.riskAttitude <= 75 ? "buy" : "buymore"
          } onChange={v => set("riskAttitude", { panic: 10, reduce: 25, hold: 45, buy: 65, buymore: 85 }[v])} options={[
            { value: "panic", icon: "😰", label: "Sell everything", sub: "Can't bear to see more losses" },
            { value: "reduce", icon: "😟", label: "Reduce exposure", sub: "Move some to safer assets" },
            { value: "hold", icon: "😐", label: "Stay invested", sub: "Wait for recovery" },
            { value: "buy", icon: "😊", label: "Buy more", sub: "Opportunity to average down" },
            { value: "buymore", icon: "🤩", label: "Invest heavily", sub: "Significant dip = significant opportunity" },
          ]} />
        </>
      ),
    },
  ];

  // Adaptive: skip expenseShare if dependents === 0
  const s2Questions = [
    ...(answers.dependents > 0 ? [{
      key: "expenseShare",
      q: "What share of your family's total monthly expenses do you personally bear?",
      hint: "A higher share means less financial buffer and lower risk capacity.",
      render: () => (
        <Slider value={answers.expenseShare} onChange={v => set("expenseShare", v)} min={10} max={100} step={5}
          label={v => `${v}%`} leftLabel="10% (shared)" rightLabel="100% (sole earner)" />
      ),
    }] : []),
    {
      key: "portfolioVsLiabilities",
      q: "What is your approximate portfolio value as a % of your total liabilities?",
      hint: "e.g. If portfolio = ₹20L and loans = ₹25L, enter ~80%",
      render: () => (
        <Slider value={answers.portfolioVsLiabilities} onChange={v => set("portfolioVsLiabilities", v)} min={0} max={500} step={10}
          label={v => `${v}%`} leftLabel="0% (debt heavy)" rightLabel="500%+" />
      ),
    },
    {
      key: "experience",
      q: "How long have you been actively investing in equities or mutual funds?",
      render: () => (
        <CardGrid cols={2} value={answers.experience} onChange={v => set("experience", v)} options={[
          { value: "none", icon: "🌱", label: "Just starting", sub: "< 6 months" },
          { value: "less2", icon: "📖", label: "Learning", sub: "6 months – 2 years" },
          { value: "two5", icon: "🧭", label: "Experienced", sub: "2 – 5 years" },
          { value: "five10", icon: "📊", label: "Seasoned", sub: "5 – 10 years" },
          { value: "above10", icon: "🏅", label: "Veteran", sub: "10+ years" },
        ]} />
      ),
    },
    {
      key: "timeToGoal",
      q: "How many years until your next significant financial goal?",
      hint: "e.g. home purchase, child's education, retirement",
      render: () => (
        <Slider value={answers.timeToGoal} onChange={v => set("timeToGoal", v)} min={1} max={30} step={1}
          label={v => `${v} yr${v > 1 ? "s" : ""}`} leftLabel="1 yr" rightLabel="30 yrs" />
      ),
    },
    // Show goal priority matrix only if goal is within 15 years
    ...(answers.timeToGoal <= 15 ? [{
      key: "goalPriority",
      q: "How would you characterise your next big financial goal?",
      hint: "This helps determine how much risk the goal itself can tolerate.",
      render: () => <GoalPriorityMatrix value={answers.goalPriority} onChange={v => set("goalPriority", v)} />,
    }] : []),
    {
      key: "goalAmountVsPortfolio",
      q: "The amount needed for your next big goal is approximately what % of your current portfolio?",
      hint: "e.g. Goal = ₹30L, Portfolio = ₹50L → 60%",
      render: () => (
        <Slider value={answers.goalAmountVsPortfolio} onChange={v => set("goalAmountVsPortfolio", v)} min={0} max={300} step={10}
          label={v => `${v}%`} leftLabel="0% (small goal)" rightLabel="300%+" />
      ),
    },
  ];

  const s1Total = s1Questions.length;
  const s2Total = s2Questions.length;

  const currentS1Q = s1Questions[s1Step];
  const currentS2Q = s2Questions[s2Step];

  const s1Complete = s1Step >= s1Total;
  const s2Complete = s2Step >= s2Total;

  function nextS1() {
    if (s1Step < s1Total - 1) setS1Step(s => s + 1);
    else { setS1Step(s1Total); setShowResult(true); }
  }
  function nextS2() {
    if (s2Step < s2Total - 1) setS2Step(s => s + 1);
    else { setS2Step(s2Total); }
  }
  function canNextS1() {
    const key = s1Questions[s1Step]?.key;
    if (!key) return true;
    if (key === "age" || key === "savingsPct" || key === "riskAttitude") return true;
    return answers[key] !== null && answers[key] !== undefined;
  }
  function canNextS2() {
    const key = s2Questions[s2Step]?.key;
    if (!key) return true;
    if (key === "expenseShare" || key === "portfolioVsLiabilities" || key === "timeToGoal" || key === "goalAmountVsPortfolio") return true;
    return answers[key] !== null && answers[key] !== undefined;
  }

  const btnStyle = (disabled) => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
    color: disabled ? "#c4b8a8" : "white",
    background: disabled ? "#e8e0d0" : "linear-gradient(135deg, #6b4c9a, #8b6cc4)",
    border: "none", borderRadius: 12, padding: "14px 32px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 16px rgba(107,76,154,0.3)",
    transition: "all 0.2s ease",
  });

  const tabStyle = (active) => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? "#6b4c9a" : "#9b8c7a",
    background: active ? "#f3eeff" : "transparent",
    border: `1px solid ${active ? "rgba(107,76,154,0.3)" : "transparent"}`,
    borderRadius: 10, padding: "8px 18px", cursor: "pointer", transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f4f1eb 0%, #ede3ff 50%, #fdf8f0 100%)", padding: isMobile ? "16px" : "32px 24px", overflowX: "hidden" }}>
      <style>{FONTS}</style>
      <style>{`
        input[type=range] { -webkit-appearance: none; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #6b4c9a, #c9a84c); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: white; border: 2.5px solid #6b4c9a; box-shadow: 0 2px 8px rgba(107,76,154,0.25); cursor: pointer; }
        button:hover { opacity: 0.92; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .q-animate { animation: fadeInUp 0.3s ease; }
      `}</style>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9b8c7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>C1 · Risk & Goals</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 32 : 44, color: "#2c1a4a", margin: 0, fontWeight: 700, lineHeight: 1.15 }}>
            Risk <em style={{ color: "#6b4c9a", fontStyle: "italic" }}>Profiler</em>
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#6b5c4c", marginTop: 10, lineHeight: 1.6, maxWidth: 540 }}>
            A comprehensive diagnostic — not just a label. Understand your true risk capacity, attitude, and ideal portfolio structure.
          </p>
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          <button style={tabStyle(activeSection === 1)} onClick={() => setActiveSection(1)}>1 · Quick Profile</button>
          <button style={tabStyle(activeSection === 2)} onClick={() => { if (s1Complete) setActiveSection(2); }}>
            2 · Deep Profile {!s1Complete && <span style={{ fontSize: 10, color: "#c4b8a8" }}>(complete §1 first)</span>}
          </button>
          <button style={tabStyle(activeSection === 3)} onClick={() => setActiveSection(3)}>3 · Weight Studio</button>
          {showResult && <button style={tabStyle(activeSection === 4)} onClick={() => setActiveSection(4)}>📊 Results</button>}
        </div>

        {/* ── Section 1 ── */}
        {activeSection === 1 && (
          <div>
            {!s1Complete ? (
              <div className="q-animate" key={s1Step}>
                <ProgressBar section={1} step={s1Step + 1} totalSteps={s1Total} />
                <QuestionCard question={currentS1Q.q} hint={currentS1Q.hint}>
                  {currentS1Q.render()}
                </QuestionCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {s1Step > 0
                    ? <button onClick={() => setS1Step(s => s - 1)} style={{ ...btnStyle(false), background: "#f0ece4", color: "#6b5c4c", boxShadow: "none" }}>← Back</button>
                    : <div />
                  }
                  <button onClick={nextS1} disabled={!canNextS1()} style={btnStyle(!canNextS1())}>
                    {s1Step === s1Total - 1 ? "See Results →" : "Next →"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2c1a4a", marginBottom: 8 }}>Quick Profile Complete</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#6b5c4c", marginBottom: 24 }}>
                  Your initial risk profile is ready. Go deeper in Section 2, or view your results now.
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { setActiveSection(2); setS2Step(0); }} style={btnStyle(false)}>Continue to Deep Profile →</button>
                  <button onClick={() => setActiveSection(4)} style={{ ...btnStyle(false), background: "#f3eeff", color: "#6b4c9a", boxShadow: "none", border: "1px solid rgba(107,76,154,0.3)" }}>View Results</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section 2 ── */}
        {activeSection === 2 && (
          <div>
            {!s1Complete ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#9b8c7a", fontFamily: "'DM Sans', sans-serif" }}>
                Please complete Section 1 first.
                <br /><button onClick={() => setActiveSection(1)} style={{ ...btnStyle(false), marginTop: 16, display: "inline-block" }}>Go to Section 1</button>
              </div>
            ) : !s2Complete ? (
              <div className="q-animate" key={s2Step}>
                <ProgressBar section={2} step={s2Step + 1} totalSteps={s2Total} />
                <QuestionCard question={currentS2Q.q} hint={currentS2Q.hint}>
                  {currentS2Q.render()}
                </QuestionCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {s2Step > 0
                    ? <button onClick={() => setS2Step(s => s - 1)} style={{ ...btnStyle(false), background: "#f0ece4", color: "#6b5c4c", boxShadow: "none" }}>← Back</button>
                    : <div />
                  }
                  <button onClick={nextS2} disabled={!canNextS2()} style={btnStyle(!canNextS2())}>
                    {s2Step === s2Total - 1 ? "Complete Profile →" : "Next →"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2c1a4a", marginBottom: 8 }}>Deep Profile Complete</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#6b5c4c", marginBottom: 24 }}>All 12 parameters captured. Your full risk profile is now available.</div>
                <button onClick={() => setActiveSection(4)} style={btnStyle(false)}>View Full Results →</button>
              </div>
            )}
          </div>
        )}

        {/* ── Section 3 — Weight Studio ── */}
        {activeSection === 3 && (
          <WeightStudio weights={weights} onChange={setWeights} answers={answers} />
        )}

        {/* ── Results ── */}
        {activeSection === 4 && showResult && (
          <ResultPanel answers={answers} weights={weights} isMobile={isMobile} />
        )}

        {/* Footer note */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: "rgba(255,255,255,0.4)", borderRadius: 12, border: "1px solid rgba(107,76,154,0.08)" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9b8c7a", margin: 0, lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> This risk profiler is an educational tool and does not constitute investment advice. Asset allocation suggestions are indicative only. Please consult a SEBI-registered investment advisor before making investment decisions. Your profile is saved locally on this device only.
          </p>
        </div>
      </div>
    </div>
  );
}
