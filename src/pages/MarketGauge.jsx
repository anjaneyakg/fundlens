// src/pages/MarketGauge.jsx — G1 Market Valuation Gauge
// Pure SVG charts — zero external dependencies beyond React + react-router-dom

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const ZONE_CONFIG = [
  { label:'Deep Value', min:80, max:100, color:'#15803d', bg:'rgba(21,128,61,0.10)'   },
  { label:'Attractive', min:60, max:80,  color:'#65a30d', bg:'rgba(101,163,13,0.10)'  },
  { label:'Fair Value', min:40, max:60,  color:'#d97706', bg:'rgba(217,119,6,0.10)'   },
  { label:'Expensive',  min:20, max:40,  color:'#ea580c', bg:'rgba(234,88,12,0.10)'   },
  { label:'Stretched',  min:0,  max:20,  color:'#dc2626', bg:'rgba(220,38,38,0.10)'   },
];
const RETURN_PERIODS = ['1M','3M','6M','1Y','2Y','3Y'];

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

// ── Live Formula Card ────────────────────────────────────────────────────────

function FormulaCard({ weights }) {
  const fmt = v => `${v}%`;
  const terms = [
    { label: 'PE Percentile', key: 'pe',  color: '#0891b2', note: 'inverted — high PE = expensive' },
    { label: 'PB Percentile', key: 'pb',  color: '#7c3aed', note: 'inverted — high PB = expensive' },
    { label: 'DY Percentile', key: 'dy',  color: '#0d9488', note: 'direct — high yield = cheap'    },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg,#f0f9ff,#eff6ff)',
      border: '1px solid #bfdbfe',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
        <span style={{background:'#2563eb',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>∑</span>
        <span style={{fontSize:13,fontWeight:700,color:'#1e3a8a'}}>Scoring Formula — updates live with weight sliders</span>
      </div>

      {/* Formula equation */}
      <div style={{
        background:'#fff',
        border:'1px solid #dbeafe',
        borderRadius:12,
        padding:'16px 20px',
        fontFamily:"'DM Mono',monospace",
        fontSize:'clamp(11px,1.8vw,14px)',
        color:'#0f172a',
        overflowX:'auto',
        whiteSpace:'nowrap',
        marginBottom:16,
      }}>
        <span style={{color:'#64748b',fontStyle:'italic'}}>Score</span>
        <span style={{color:'#94a3b8'}}> = </span>
        {terms.map((t, i) => (
          <span key={t.key}>
            <span style={{
              background:`${t.color}15`,
              border:`1px solid ${t.color}40`,
              borderRadius:6,
              padding:'2px 8px',
              color: t.color,
              fontWeight:700,
            }}>
              {t.label}
            </span>
            <span style={{color:'#94a3b8'}}> × </span>
            <span style={{
              background:'#1d4ed815',
              border:'1px solid #1d4ed840',
              borderRadius:6,
              padding:'2px 8px',
              color:'#1d4ed8',
              fontWeight:800,
              transition:'all 0.2s',
            }}>
              {fmt(weights[t.key])}
            </span>
            {i < terms.length - 1 && <span style={{color:'#94a3b8'}}> + </span>}
          </span>
        ))}
      </div>

      {/* Explanation rows */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
        {terms.map(t => (
          <div key={t.key} style={{
            display:'flex',alignItems:'flex-start',gap:8,
            background:'#fff',borderRadius:10,padding:'10px 14px',
            border:`1px solid ${t.color}25`,
          }}>
            <div style={{width:10,height:10,borderRadius:'50%',background:t.color,marginTop:3,flexShrink:0}}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:t.color}}>{t.label}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{t.note}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Plain English explanation */}
      <div style={{marginTop:14,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #e0e7ff',fontSize:12,color:'#475569',lineHeight:1.65}}>
        <b style={{color:'#1e3a8a'}}>How to read the score: </b>
        Percentile rank = where today's value sits within the full historical range.
        Score <b>100</b> = cheapest ever recorded. Score <b>0</b> = most expensive ever.
        P/E and P/B are inverted (higher ratio → more expensive → lower score).
        Dividend Yield is direct (higher yield → cheaper market → higher score).
        Weights above control how much each metric influences the final score.
      </div>
    </div>
  );
}

// ── SVG Oscillator Chart (smooth bezier, zone labels on right axis) ──────────

function OscillatorChart({ series }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const W=860,H=280,PL=36,PR=80,PT=12,PB=28;
  const cW=W-PL-PR, cH=H-PT-PB;
  console.log('Series length:', series?.length);
  console.log('First date:', series?.[0]?.date);
  console.log('Last date:', series?.[series.length-1]?.date);

  if (!series?.length) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>No data yet.</div>;

  const minTs = new Date(series[0].date).getTime();
  const maxTs = new Date(series[series.length-1].date).getTime();
  const tsRange = maxTs-minTs||1;
  const xOf = d => PL+((new Date(d).getTime()-minTs)/tsRange)*cW;
  const yOf = s => PT+cH-(s/100)*cH;

  // Build smooth path points
  const pts = series.map(p => ({ x: xOf(p.date), y: yOf(p.score) }));
  const pathD = smoothPath(pts);

  // Determine line color per segment (use zone color of current point)
  // For performance, draw one path per zone color group
  const sy = new Date(series[0].date).getFullYear();
  const ey = new Date(series[series.length-1].date).getFullYear();
  const step = Math.max(1, Math.floor((ey-sy)/10));
  const years = [];
  for (let y=sy; y<=ey; y+=step) {
    const ts = new Date(`${y}-01-01`).getTime();
    if (ts>=minTs && ts<=maxTs) years.push({ year:y, x:xOf(`${y}-01-01`) });
  }

  const onMove = useCallback(e => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX-rect.left)*(W/rect.width);
    const ratio = Math.max(0, Math.min(1,(mx-PL)/cW));
    const idx = Math.round(ratio*(series.length-1));
    const p = series[Math.max(0,Math.min(series.length-1,idx))];
    if (p) setTooltip({ x:xOf(p.date), y:yOf(p.score), d:p });
  },[series]);

  const tz = tooltip ? getZone(tooltip.d.score) : null;
  const last = series[series.length-1];
  const lz = getZone(last.score);

  return (
    <div style={{position:'relative'}}>
      {/* Legend */}
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:10}}>
        {ZONE_CONFIG.map(z=>(
          <div key={z.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#64748b'}}>
            <div style={{width:10,height:10,borderRadius:2,background:z.color,opacity:0.8}}/>
            {z.label}
          </div>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{width:'100%',height:'auto',display:'block',cursor:'crosshair'}}
        onMouseMove={onMove} onMouseLeave={()=>setTooltip(null)}>

        {/* Zone bands */}
        {ZONE_CONFIG.map(z=>(
          <rect key={z.label} x={PL} y={PT+cH-(z.max/100)*cH}
            width={cW} height={((z.max-z.min)/100)*cH} fill={z.bg}/>
        ))}

        {/* Zone labels on right axis */}
        {ZONE_CONFIG.map(z=>{
          const midY = PT+cH-((z.min+z.max)/200)*cH;
          return (
            <text key={z.label} x={PL+cW+6} y={midY+4}
              fontSize={9} fill={z.color} fontWeight={600}>{z.label}</text>
          );
        })}

        {/* Horizontal grid lines + left Y axis labels */}
        {[0,20,40,60,80,100].map(v=>(
          <g key={v}>
            <line x1={PL} x2={PL+cW} y1={yOf(v)} y2={yOf(v)} stroke="#e2e8f0" strokeWidth={v===0||v===100?0.8:0.5} strokeDasharray={v===0||v===100?'none':'4,4'}/>
            <text x={PL-4} y={yOf(v)+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
          </g>
        ))}

        {/* Vertical year markers */}
        {years.map(({year,x})=>(
          <g key={year}>
            <line x1={x} x2={x} y1={PT} y2={PT+cH} stroke="#f1f5f9" strokeWidth={0.6}/>
            <text x={x} y={H-6} textAnchor="middle" fontSize={9} fill="#94a3b8">{year}</text>
          </g>
        ))}

        {/* Smooth score line */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={1.8}
          strokeLinejoin="round" strokeLinecap="round" opacity={0.9}/>

        {/* Latest dot */}
        <circle cx={xOf(last.date)} cy={yOf(last.score)} r={5} fill={lz.color} stroke="#fff" strokeWidth={2}/>

        {/* Hover crosshair */}
        {tooltip && <>
          <line x1={tooltip.x} x2={tooltip.x} y1={PT} y2={PT+cH}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3"/>
          <circle cx={tooltip.x} cy={tooltip.y} r={4} fill={tz?.color??'#2563eb'} stroke="#fff" strokeWidth={2}/>
        </>}
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div style={{
          position:'absolute',top:40,left:16,
          background:'#fff',border:'1px solid #e2e8f0',
          borderRadius:10,padding:'10px 14px',fontSize:12,
          boxShadow:'0 4px 16px rgba(0,0,0,.12)',pointerEvents:'none',zIndex:10,
          borderLeft:`3px solid ${tz?.color??'#2563eb'}`,
        }}>
          <div style={{fontWeight:700,color:'#0f172a',marginBottom:4}}>{fmtDate(tooltip.d.date)}</div>
          {tz && <div style={{color:tz.color,fontWeight:700,fontSize:13,marginBottom:4}}>{tz.label}</div>}
          <div style={{color:'#64748b'}}>Score: <b style={{color:tz?.color}}>{tooltip.d.score}</b></div>
          {tooltip.d.pe  != null && <div style={{color:'#64748b'}}>P/E: <b>{tooltip.d.pe?.toFixed(1)}</b></div>}
          {tooltip.d.pb  != null && <div style={{color:'#64748b'}}>P/B: <b>{tooltip.d.pb?.toFixed(1)}</b></div>}
          {tooltip.d.dy  != null && <div style={{color:'#64748b'}}>Div Yield: <b>{tooltip.d.dy?.toFixed(2)}%</b></div>}
        </div>
      )}
    </div>
  );
}

// ── SVG Bar Chart ────────────────────────────────────────────────────────────

function ReturnsBarChart({ data, type }) {
  const [tip, setTip] = useState(null);
  if (!data || data.count === 0) return (
    <div style={{textAlign:'center',padding:30,color:'#94a3b8',fontSize:13}}>
      No {type==='bottom'?'Deep Value':'Stretched'} events detected yet.
    </div>
  );
  const barData = RETURN_PERIODS.map(p => ({ period:p, value:data.median_returns?.[p]??null })).filter(d => d.value != null);
  if (!barData.length) return null;

  const W=500,H=180,PL=48,PR=12,PT=16,PB=28;
  const cW=W-PL-PR, cH=H-PT-PB;
  const allV=barData.map(d=>d.value);
  const minV=Math.min(0,...allV), maxV=Math.max(0,...allV);
  const range=(maxV-minV)||1;
  const gap=cW/barData.length, bW=gap*0.6;
  const yOf=v=>PT+cH-((v-minV)/range)*cH;
  const zY=yOf(0);

  return (
    <div>
      <div style={{fontSize:12,color:'#64748b',marginBottom:8,fontWeight:600}}>
        Median Forward Returns ({data.count} events)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:500,height:'auto',display:'block'}}
        onMouseLeave={()=>setTip(null)}>
        <line x1={PL} x2={PL+cW} y1={zY} y2={zY} stroke="#e2e8f0" strokeWidth={1}/>
        {[-20,-10,0,10,20,30,40].filter(v=>v>=minV-5&&v<=maxV+5).map(v=>(
          <g key={v}>
            <line x1={PL} x2={PL+cW} y1={yOf(v)} y2={yOf(v)} stroke="#f1f5f9" strokeWidth={0.5}/>
            <text x={PL-4} y={yOf(v)+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}%</text>
          </g>
        ))}
        {barData.map((d,i)=>{
          const cx=PL+gap*i+gap/2, x=cx-bW/2;
          const color=d.value>=0?'#16a34a':'#dc2626';
          const bH=Math.abs(yOf(d.value)-zY);
          const bY=d.value>=0?yOf(d.value):zY;
          return (
            <g key={d.period} onMouseEnter={()=>setTip({cx,period:d.period,value:d.value})}>
              <rect x={x} y={bY} width={bW} height={Math.max(2,bH)} fill={color} rx={3} opacity={0.85}/>
              <text x={cx} y={H-6} textAnchor="middle" fontSize={10} fill="#64748b">{d.period}</text>
            </g>
          );
        })}
        {tip&&(
          <g>
            <rect x={Math.min(tip.cx-30,W-80)} y={PT} width={72} height={36} fill="#fff" stroke="#e2e8f0" rx={6}/>
            <text x={Math.min(tip.cx-30,W-80)+36} y={PT+14} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0f172a">{tip.period}</text>
            <text x={Math.min(tip.cx-30,W-80)+36} y={PT+28} textAnchor="middle" fontSize={11} fontWeight="bold"
              fill={tip.value>=0?'#16a34a':'#dc2626'}>
              {tip.value>0?'+':''}{tip.value?.toFixed(1)}%
            </text>
          </g>
        )}
      </svg>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
        {RETURN_PERIODS.map(p=>{
          const val=data.median_returns?.[p];
          return (
            <div key={p} style={{
              background:val==null?'#f1f5f9':val>=0?'#f0fdf4':'#fef2f2',
              border:`1px solid ${val==null?'#e2e8f0':val>=0?'#bbf7d0':'#fecaca'}`,
              borderRadius:8,padding:'8px 10px',textAlign:'center',
            }}>
              <div style={{fontSize:15,fontWeight:700,color:val==null?'#94a3b8':val>=0?'#16a34a':'#dc2626'}}>
                {val!=null?`${val>0?'+':''}${val}%`:'—'}
              </div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{p} median</div>
            </div>
          );
        })}
      </div>
      {data.events?.length > 0 && (
        <div style={{marginTop:16,overflowX:'auto'}}>
          <div style={{fontSize:12,color:'#64748b',marginBottom:6,fontWeight:600}}>Historical Events (most recent first)</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr>{['Date','Score','PE','PB','1Y Ret','3Y Ret'].map(h=>(
              <th key={h} style={{padding:'4px 8px',borderBottom:'1px solid #f1f5f9',color:'#94a3b8',fontWeight:600,textAlign:'left'}}>{h}</th>
            ))}</tr></thead>
            <tbody>{[...data.events].reverse().slice(0,8).map((ev,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #f8fafc'}}>
                <td style={{padding:'5px 8px',color:'#374151'}}>{ev.date?.slice(0,7)}</td>
                <td style={{padding:'5px 8px',color:getZone(ev.score).color,fontWeight:700}}>{ev.score}</td>
                <td style={{padding:'5px 8px',color:'#374151'}}>{ev.pe?.toFixed(1)??'—'}</td>
                <td style={{padding:'5px 8px',color:'#374151'}}>{ev.pb?.toFixed(1)??'—'}</td>
                <td style={{padding:'5px 8px',fontWeight:600,color:ev.returns?.['1Y']>=0?'#16a34a':'#dc2626'}}>
                  {ev.returns?.['1Y']!=null?`${ev.returns['1Y']>0?'+':''}${ev.returns['1Y']}%`:'—'}
                </td>
                <td style={{padding:'5px 8px',fontWeight:600,color:ev.returns?.['3Y']>=0?'#16a34a':'#dc2626'}}>
                  {ev.returns?.['3Y']!=null?`${ev.returns['3Y']>0?'+':''}${ev.returns['3Y']}%`:'—'}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Weight Sliders ───────────────────────────────────────────────────────────

function WeightSlider({ weights, onChange }) {
  const keys=['pe','pb','dy'], labels={pe:'PE',pb:'PB',dy:'DY'};
  const handle=(key,val)=>{
    const rem=100-val, others=keys.filter(k=>k!==key);
    const sum=others.reduce((s,k)=>s+weights[k],0);
    const nw={...weights,[key]:val};
    if(sum===0){nw[others[0]]=Math.floor(rem/2);nw[others[1]]=rem-Math.floor(rem/2);}
    else others.forEach(k=>{nw[k]=Math.round((weights[k]/sum)*rem);});
    const total=Object.values(nw).reduce((a,b)=>a+b,0);
    if(total!==100) nw[keys[2]]+=100-total;
    onChange(nw);
  };
  return (
    <div>
      {keys.map(k=>(
        <div key={k} style={{display:'flex',alignItems:'center',gap:10,marginTop:10}}>
          <span style={{fontSize:12,fontWeight:600,color:'#374151',width:28}}>{labels[k]}</span>
          <input type="range" min={10} max={80} value={weights[k]} style={{flex:1,accentColor:'#2563eb'}}
            onChange={e=>handle(k,Number(e.target.value))}/>
          <span style={{fontSize:12,fontWeight:700,color:'#2563eb',width:32,textAlign:'right'}}>{weights[k]}%</span>
        </div>
      ))}
      <button onClick={()=>onChange({pe:30,pb:40,dy:30})}
        style={{marginTop:10,padding:'4px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:11,cursor:'pointer',color:'#64748b'}}>
        ↩ Reset (PE 30 / PB 40 / DY 30)
      </button>
    </div>
  );
}

// ── Recompute scores on weight change ────────────────────────────────────────

function recompute(series, weights) {
  if (!series?.length) return [];
  const hPE=series.map(r=>r.pe).filter(v=>v>0);
  const hPB=series.map(r=>r.pb).filter(v=>v>0);
  const hDY=series.map(r=>r.dy).filter(v=>v>0);
  function pct(val,arr,inv){
    if(!arr.length||val==null) return 50;
    const s=[...arr].sort((a,b)=>a-b);
    let c=0; for(const v of s){if(v<val)c++;else break;}
    const r=(c/s.length)*100; return inv?100-r:r;
  }
  return series.map(p=>{
    const score=Math.round(
      pct(p.pe,hPE,true)*(weights.pe/100)+
      pct(p.pb,hPB,true)*(weights.pb/100)+
      pct(p.dy,hDY,false)*(weights.dy/100)
    );
    return{...p,score,zone:getZone(score).label};
  });
}

// ── Arc Score Meter ──────────────────────────────────────────────────────────

function ScoreMeter({ score, zone }) {
  if (score==null||!zone) return null;
  const pct=score/100, r=56, cx=72, cy=72;
  function polar(deg,rad){const a=(deg*Math.PI)/180;return{x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)};}
  const start=polar(180,r), end=polar(180-pct*180,r), large=pct>0.5?1:0;
  return (
    <svg width={144} height={84} viewBox="0 0 144 84" style={{display:'block',margin:'0 auto'}}>
      <path d={`M ${72-r} 72 A ${r} ${r} 0 0 1 ${72+r} 72`} fill="none" stroke="#f1f5f9" strokeWidth={11} strokeLinecap="round"/>
      {ZONE_CONFIG.slice().reverse().map((z,i)=>{
        const s=polar(180-(i/5)*180,r), e=polar(180-((i+1)/5)*180,r);
        return <path key={z.label} d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
          fill="none" stroke={z.color} strokeWidth={9} strokeLinecap="butt" opacity={0.2}/>;
      })}
      {pct>0&&<path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`}
        fill="none" stroke={zone.color} strokeWidth={9} strokeLinecap="round"/>}
      <circle cx={end.x} cy={end.y} r={5} fill={zone.color}/>
      <text x={cx} y={60} textAnchor="middle" fontSize={20} fontWeight={800} fill={zone.color}>{score}</text>
      <text x={cx} y={74} textAnchor="middle" fontSize={8} fill="#94a3b8">OUT OF 100</text>
    </svg>
  );
}

// ── Embed Generator ──────────────────────────────────────────────────────────

function EmbedGenerator({ selected }) {
  const [copied,setCopied]=useState(false);
  const param=selected==='__broad__'?'broad':encodeURIComponent(selected);
  const src=`${window.location.origin}/embed/market-gauge?index=${param}&theme=light`;
  const code=`<iframe\n  src="${src}"\n  width="100%" height="520"\n  frameborder="0"\n  style="border-radius:12px;"\n  title="FundLens Market Valuation Gauge"\n></iframe>`;
  return (
    <div>
      <div style={{fontSize:13,color:'#64748b',marginBottom:6}}>Paste into any website or blog:</div>
      <div style={{background:'#0f172a',borderRadius:10,padding:'14px 16px',fontFamily:'monospace',fontSize:12,color:'#94a3b8',wordBreak:'break-all',lineHeight:1.6}}>{code}</div>
      <button onClick={()=>{navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
        style={{marginTop:8,padding:'6px 16px',borderRadius:8,border:'none',background:'#2563eb',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
        {copied?'✓ Copied!':'⧉ Copy Embed Code'}
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MarketGauge() {
  const navigate = useNavigate();
  const [apiData,setApiData]   = useState(null);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState(null);
  const [selected,setSelected] = useState('__broad__');
  const [weights,setWeights]   = useState({pe:30,pb:40,dy:30});
  const [showEmbed,setShowEmbed] = useState(false);

  useEffect(()=>{
    fetch('/api/market-gauge')
      .then(r=>r.json())
      .then(d=>{setApiData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const rawData = useMemo(()=>{
    if (!apiData) return null;
    return selected==='__broad__' ? apiData.broad_market : (apiData.by_index?.[selected]??null);
  },[apiData,selected]);

  const series       = useMemo(()=>recompute(rawData?.series, weights),[rawData,weights]);
  const currentScore = series.length ? series[series.length-1]?.score : rawData?.current_score;
  const currentZone  = currentScore!=null ? getZone(currentScore) : null;
  const available    = apiData?.meta?.indices_available ?? [];
  const displayName  = selected==='__broad__' ? 'Broad Market (BSE 500 + Sensex)' : selected;

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontFamily:'sans-serif'}}>
      ⏳ Loading market data…
    </div>
  );
  if (error||!apiData) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#dc2626',fontFamily:'sans-serif'}}>
      Failed to load. {error}
    </div>
  );

  const card    = {background:'#fff',borderRadius:16,border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:24,overflow:'hidden'};
  const cardHdr = {padding:'18px 24px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10};
  const cardBody= {padding:'20px 24px'};

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:'24px 16px 48px'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>

        {/* Page Header */}
        <div style={{marginBottom:28}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:20,padding:'3px 12px',fontSize:12,fontWeight:600,color:'#1d4ed8',marginBottom:10}}>
            📊 G1 · Market Intelligence
          </div>
          <h1 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,color:'#0f172a',margin:'0 0 8px'}}>
            Market Valuation Gauge
          </h1>
          <p style={{color:'#64748b',fontSize:15,margin:0}}>
            Percentile-based valuation score across full BSE history (1990–present).
            Score 100 = cheapest ever · Score 0 = most expensive ever.
          </p>
        </div>

        {/* Controls */}
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start',marginBottom:20}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',flex:'1 1 300px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#374151'}}>Select Index</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
              {[{key:'__broad__',label:'🌏 Broad Market'},...available.map(n=>({key:n,label:n}))].map(({key,label})=>(
                <button key={key} onClick={()=>setSelected(key)} style={{
                  padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                  border:selected===key?'2px solid #2563eb':'1.5px solid #e2e8f0',
                  background:selected===key?'#eff6ff':'#f8fafc',
                  color:selected===key?'#2563eb':'#64748b',
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',flex:'1 1 280px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#374151'}}>Valuation Weights</div>
            <WeightSlider weights={weights} onChange={setWeights}/>
          </div>
        </div>

        {/* Live Formula Card */}
        <FormulaCard weights={weights}/>

        {/* Summary Card */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#0f172a'}}>{displayName}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
                As of {fmtDate(rawData?.latest_date)} · Data since {rawData?.history_from?.slice(0,4)??'1990'}
              </div>
            </div>
            {currentZone&&(
              <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${currentZone.color}18`,border:`1.5px solid ${currentZone.color}`,borderRadius:20,padding:'4px 14px',fontSize:13,fontWeight:700,color:currentZone.color}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:currentZone.color,display:'inline-block'}}/>
                {currentZone.label} · Score {currentScore}
              </div>
            )}
          </div>
          <div style={cardBody}>
            <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
              <ScoreMeter score={currentScore} zone={currentZone}/>
              <div style={{flex:1}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
                  {[
                    {label:'Valuation Score',     value:currentScore??'—',                                               color:'#2563eb'},
                    {label:'Price / Earnings',    value:rawData?.latest_pe!=null?`${rawData.latest_pe.toFixed(1)}x`:'—', color:'#0891b2'},
                    {label:'Price / Book',        value:rawData?.latest_pb!=null?`${rawData.latest_pb.toFixed(1)}x`:'—', color:'#7c3aed'},
                    {label:'Dividend Yield',      value:rawData?.latest_dy!=null?`${rawData.latest_dy.toFixed(2)}%`:'—', color:'#0d9488'},
                    {label:'Avg Score (All-Time)',value:rawData?.score_avg??'—',                                          color:'#64748b'},
                    {label:'Weekly Data Points',  value:rawData?.data_points??'—',                                        color:'#64748b'},
                  ].map(m=>(
                    <div key={m.label} style={{background:'#f8fafc',border:`1.5px solid ${m.color}30`,borderRadius:12,padding:'12px 16px',textAlign:'center'}}>
                      <div style={{fontSize:22,fontWeight:800,color:m.color}}>{m.value}</div>
                      <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{m.label}</div>
                    </div>
                  ))}
                </div>
                {rawData?.commentary&&(
                  <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:12,padding:'14px 18px',fontSize:14,color:'#0c4a6e',lineHeight:1.6}}>
                    {rawData.commentary}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel A — Oscillator */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#2563eb',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>A</span>
                Valuation Regime Oscillator
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
                Weekly composite score · 1990–present · Coloured bands = valuation zones
              </div>
            </div>
          </div>
          <div style={cardBody}><OscillatorChart series={series}/></div>
        </div>

        {/* Panel B — Deep Value entries */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#16a34a',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>B</span>
                Returns from Deep Value Entries
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
                Every time score entered Deep Value zone (≥80) — forward returns at 1M to 3Y
              </div>
            </div>
          </div>
          <div style={cardBody}><ReturnsBarChart data={rawData?.returns_from_bottoms} type="bottom"/></div>
        </div>

        {/* Panel C — Stretched peaks */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#dc2626',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>C</span>
                Returns from Stretched Peaks
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
                Every time score entered Stretched zone (≤20) — forward returns at 1M to 3Y
              </div>
            </div>
          </div>
          <div style={cardBody}><ReturnsBarChart data={rawData?.returns_from_peaks} type="peak"/></div>
        </div>

        {/* Embed */}
        <div style={card}>
          <div style={cardHdr}>
            <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
              <span style={{background:'#64748b',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>⊞</span>
              Embed on Your Website
            </div>
            <button onClick={()=>setShowEmbed(v=>!v)}
              style={{padding:'6px 16px',borderRadius:8,cursor:'pointer',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:600,color:'#374151'}}>
              {showEmbed?'▲ Hide':'▼ Show Embed Code'}
            </button>
          </div>
          {showEmbed&&<div style={cardBody}><EmbedGenerator selected={selected}/></div>}
        </div>

        {/* Methodology footer */}
        <div style={{background:'#fafafa',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',fontSize:12,color:'#94a3b8',lineHeight:1.7}}>
          <b style={{color:'#64748b'}}>Methodology:</b> Valuation score = weighted percentile rank across full BSE history.
          P/E and P/B are inverted (high ratio = expensive = low score).
          Dividend Yield is direct (high yield = cheap market = high score).
          Score 100 = cheapest ever recorded; 0 = most expensive.
          Weights adjustable above — formula card updates live.
          Data source: BSE India. Not investment advice.
        </div>

      </div>
    </div>
  );
}
