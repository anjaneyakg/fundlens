// src/components/MarketGaugeHero.jsx
// Homepage hero widget — pure SVG, zero external dependencies

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const ZONE_CONFIG = [
  { label:'Deep Value', min:80, max:100, color:'#15803d', bg:'rgba(21,128,61,0.12)'  },
  { label:'Attractive', min:60, max:80,  color:'#65a30d', bg:'rgba(101,163,13,0.12)' },
  { label:'Fair Value', min:40, max:60,  color:'#d97706', bg:'rgba(217,119,6,0.12)'  },
  { label:'Expensive',  min:20, max:40,  color:'#ea580c', bg:'rgba(234,88,12,0.12)'  },
  { label:'Stretched',  min:0,  max:20,  color:'#dc2626', bg:'rgba(220,38,38,0.12)'  },
];

function getZone(score) {
  return ZONE_CONFIG.find(z => score >= z.min && score <= z.max) ?? ZONE_CONFIG[4];
}
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
};

// Build smooth SVG cubic bezier path from points array [{x,y}]
function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx  = (prev.x + curr.x) / 2;
    d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

// Arc gauge SVG
function ArcGauge({ score, zone }) {
  if (score == null || !zone) return null;
  const pct=score/100, r=52, cx=68, cy=68;
  function polar(deg,rad){const a=(deg*Math.PI)/180;return{x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)};}
  const start=polar(180,r), end=polar(180-pct*180,r), large=pct>0.5?1:0;
  return (
    <svg width={136} height={80} viewBox="0 0 136 80" style={{display:'block',margin:'0 auto'}}>
      <path d={`M ${68-r} 68 A ${r} ${r} 0 0 1 ${68+r} 68`}
        fill="none" stroke="#f1f5f9" strokeWidth={10} strokeLinecap="round"/>
      {ZONE_CONFIG.slice().reverse().map((z,i)=>{
        const s=polar(180-(i/5)*180,r), e=polar(180-((i+1)/5)*180,r);
        return <path key={z.label} d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
          fill="none" stroke={z.color} strokeWidth={8} strokeLinecap="butt" opacity={0.2}/>;
      })}
      {pct>0&&<path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`}
        fill="none" stroke={zone.color} strokeWidth={8} strokeLinecap="round"/>}
      <circle cx={end.x} cy={end.y} r={4} fill={zone.color}/>
      <text x={cx} y={56} textAnchor="middle" fontSize={19} fontWeight={800} fill={zone.color}>{score}</text>
      <text x={cx} y={70} textAnchor="middle" fontSize={8} fill="#94a3b8">/ 100</text>
    </svg>
  );
}

// Smooth sparkline for 5-year view using monthly series
function Sparkline({ series, zone }) {
  const [tip, setTip] = useState(null);
  if (!series?.length) return null;
  const W=340,H=110,PL=8,PR=8,PT=6,PB=18;
  const cW=W-PL-PR, cH=H-PT-PB;

  const minTs = new Date(series[0].date).getTime();
  const maxTs = new Date(series[series.length-1].date).getTime();
  const tsR   = maxTs-minTs||1;
  const xOf   = d => PL+((new Date(d).getTime()-minTs)/tsR)*cW;
  const yOf   = s => PT+cH-(s/100)*cH;

  // Build smooth path
  const pts   = series.map(p => ({ x: xOf(p.date), y: yOf(p.score) }));
  const pathD = smoothPath(pts);

  const sy = new Date(series[0].date).getFullYear();
  const ey = new Date(series[series.length-1].date).getFullYear();

  const onMove = e => {
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx   = (e.clientX-rect.left)*(W/rect.width);
    const ratio= Math.max(0,Math.min(1,(mx-PL)/cW));
    const idx  = Math.round(ratio*(series.length-1));
    const p    = series[Math.max(0,Math.min(series.length-1,idx))];
    if (p) setTip({x:xOf(p.date),y:yOf(p.score),d:p});
  };

  const last = series[series.length-1];
  const lz   = getZone(last.score);

  return (
    <svg viewBox={`0 0 ${W} ${H}`}
      style={{width:'100%',height:'auto',display:'block',cursor:'crosshair'}}
      onMouseMove={onMove} onMouseLeave={()=>setTip(null)}>

      {/* Zone bands */}
      {ZONE_CONFIG.map(z=>(
        <rect key={z.label} x={PL} y={PT+cH-(z.max/100)*cH}
          width={cW} height={((z.max-z.min)/100)*cH} fill={z.bg}/>
      ))}

      {/* Year labels */}
      <text x={PL}    y={H-4} fontSize={8} fill="#94a3b8">{sy}</text>
      <text x={PL+cW} y={H-4} textAnchor="end" fontSize={8} fill="#94a3b8">{ey}</text>

      {/* Smooth score line */}
      <path d={pathD} fill="none" stroke={zone?.color??'#2563eb'} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round"/>

      {/* Latest dot */}
      <circle cx={xOf(last.date)} cy={yOf(last.score)} r={4} fill={lz.color} stroke="#fff" strokeWidth={2}/>

      {/* Hover crosshair */}
      {tip && <>
        <line x1={tip.x} x2={tip.x} y1={PT} y2={PT+cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2,2"/>
        <rect x={Math.min(tip.x+4,W-72)} y={PT} width={68} height={38} fill="#fff" stroke="#e2e8f0" rx={5}/>
        <text x={Math.min(tip.x+4,W-72)+34} y={PT+12} textAnchor="middle" fontSize={8} fill="#374151">
          {tip.d.date?.slice(0,7)}
        </text>
        <text x={Math.min(tip.x+4,W-72)+34} y={PT+24} textAnchor="middle" fontSize={9}
          fill={getZone(tip.d.score).color} fontWeight="bold">
          {getZone(tip.d.score).label}
        </text>
        <text x={Math.min(tip.x+4,W-72)+34} y={PT+35} textAnchor="middle" fontSize={8} fill="#64748b">
          Score {tip.d.score}
        </text>
      </>}
    </svg>
  );
}

export default function MarketGaugeHero() {
  const navigate = useNavigate();
  const [data,setData]       = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(false);

  useEffect(()=>{
    fetch('/api/market-gauge')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  },[]);

  const broad = data?.broad_market;

  // Last 5 years of MONTHLY series for hero sparkline
  const series5Y = useMemo(()=>{
    if (!broad?.series_monthly) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear()-5);
    const cutStr = cutoff.toISOString().slice(0,10);
    return broad.series_monthly.filter(p => p.date >= cutStr);
  },[broad]);

  const score = broad?.current_score ?? null;
  const zone  = score != null ? getZone(score) : null;

  const container = {
    background:'#fff', border:'1px solid #e2e8f0', borderRadius:20,
    overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.06)',
    fontFamily:"'DM Sans','Segoe UI',sans-serif",
  };

  if (loading) return (
    <div style={{...container,padding:'40px 20px',textAlign:'center',color:'#94a3b8',fontSize:14}}>
      Loading market valuation…
    </div>
  );
  if (error || !data) return (
    <div style={{...container,padding:'30px 20px',textAlign:'center',color:'#dc2626',fontSize:13}}>
      Could not load market data.
    </div>
  );

  return (
    <div style={container}>
      {/* Header */}
      <div style={{
        background: zone ? `linear-gradient(135deg,${zone.color}12,${zone.color}04)` : '#f8fafc',
        borderBottom: `2px solid ${zone?.color??'#e2e8f0'}22`,
        padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:1,marginBottom:2}}>
            MARKET VALUATION GAUGE
          </div>
          <div style={{fontSize:13,color:'#64748b'}}>
            Broad Market · BSE 500 + Sensex · as of {fmtDate(broad?.latest_date)}
          </div>
        </div>
        {zone && (
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${zone.color}18`,border:`1.5px solid ${zone.color}`,borderRadius:20,padding:'5px 14px',fontSize:13,fontWeight:700,color:zone.color}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:zone.color,display:'inline-block'}}/>
            {zone.label}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{padding:'16px 20px',display:'flex',gap:20,flexWrap:'wrap',alignItems:'flex-start'}}>

        {/* Arc gauge + metrics */}
        <div style={{flex:'0 0 150px',textAlign:'center'}}>
          <ArcGauge score={score} zone={zone}/>
          <div style={{marginTop:8,display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>
            {[
              {label:'P/E', value:broad?.latest_pe},
              {label:'P/B', value:broad?.latest_pb},
              {label:'DY',  value:broad?.latest_dy},
            ].map(m=>(
              <div key={m.label} style={{background:'#f8fafc',borderRadius:8,padding:'5px 10px',textAlign:'center',minWidth:42}}>
                <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{m.value!=null?m.value.toFixed(1):'—'}</div>
                <div style={{fontSize:10,color:'#94a3b8'}}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5-year sparkline + commentary */}
        <div style={{flex:'1 1 200px',minWidth:180}}>
          <div style={{fontSize:11,color:'#94a3b8',marginBottom:6,fontWeight:600}}>
            Valuation Score — Last 5 Years
          </div>
          <Sparkline series={series5Y} zone={zone}/>
          {broad?.commentary && (
            <div style={{fontSize:11,color:'#64748b',lineHeight:1.5,marginTop:8,padding:'8px 10px',background:'#f8fafc',borderRadius:8,borderLeft:`3px solid ${zone?.color??'#e2e8f0'}`}}>
              {broad.commentary.slice(0,180)}{broad.commentary.length>180?'…':''}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop:'1px solid #f1f5f9',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fafafa'}}>
        <div style={{fontSize:11,color:'#94a3b8'}}>
          {broad?.history_from ? `Historical data since ${broad.history_from.slice(0,4)}` : 'BSE Index Data'}
        </div>
        <button onClick={()=>navigate('/tools/market-gauge')} style={{
          padding:'7px 16px',borderRadius:20,background:zone?.color??'#2563eb',
          color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:0.3,
        }}>
          Full Analysis →
        </button>
      </div>
    </div>
  );
}
