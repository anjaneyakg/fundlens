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

const INDEX_GROUPS = [
  { label:'Broad Market', indices:['BSE 500','BSE SENSEX','BSE LARGECAP','BSE MID CAP','BSE SMALL CAP','BSE MIDCAP 150'] },
  { label:'Sectors',      indices:['BSE IT','BSE BANKEX','BSE HEALTHCARE','BSE AUTO','BSE FMCG','BSE METAL','BSE REALTY','BSE ENERGY','BSE CONSUMER DURABLES'] },
];

function getZone(score) {
  return ZONE_CONFIG.find(z => score >= z.min && score <= z.max) ?? ZONE_CONFIG[4];
}
const fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
};

// Smooth cubic bezier path
function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i-1], curr = pts[i], cpx = (prev.x+curr.x)/2;
    d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

// ── Loader ───────────────────────────────────────────────────────────────────
function Loader() {
  const [step, setStep] = useState(0);
  const steps = ['Connecting to BSE data…','Loading index history…','Computing percentile scores…','Detecting valuation zones…','Building charts…'];
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s+1) % steps.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{position:'relative',width:120,height:120,marginBottom:32}}>
        <svg width={120} height={120} viewBox="0 0 120 120" style={{position:'absolute',inset:0}}>
          {[48,36,24].map((r,i) => (
            <circle key={r} cx={60} cy={60} r={r} fill="none"
              stroke={['#2563eb','#7c3aed','#0891b2'][i]} strokeWidth={4}
              strokeDasharray={`${2*Math.PI*r*0.6} ${2*Math.PI*r*0.4}`}
              strokeLinecap="round" opacity={0.7}
              style={{transformOrigin:'60px 60px', animation:`spin${i} ${1.2+i*0.3}s linear infinite`}}
            />
          ))}
        </svg>
        <style>{`
          @keyframes spin0{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes spin1{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
          @keyframes spin2{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        `}</style>
      </div>
      <div style={{fontSize:16,fontWeight:700,color:'#0f172a',marginBottom:8}}>Market Valuation Gauge</div>
      <div style={{fontSize:13,color:'#64748b',height:20}}>{steps[step]}</div>
      <div style={{marginTop:24,display:'flex',gap:6}}>
        {steps.map((_,i) => (
          <div key={i} style={{width:6,height:6,borderRadius:'50%',background:i===step?'#2563eb':'#e2e8f0',transition:'all 0.3s'}}/>
        ))}
      </div>
    </div>
  );
}

// ── Index Selector ───────────────────────────────────────────────────────────
function IndexSelector({ available, selected, onSelect }) {
  return (
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'20px 24px',marginBottom:20}}>
      <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
        <span style={{background:'#eff6ff',color:'#2563eb',borderRadius:6,padding:'2px 8px',fontSize:11}}>INDEX</span>
        Select Market Index to Analyse
      </div>
      {/* Broad Market — prominent */}
      <div style={{marginBottom:14}}>
        <button onClick={()=>onSelect('__broad__')} style={{
          width:'100%',padding:'12px 18px',borderRadius:12,
          border: selected==='__broad__' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
          background: selected==='__broad__' ? '#eff6ff' : '#f8fafc',
          color: selected==='__broad__' ? '#1d4ed8' : '#64748b',
          fontSize:14,fontWeight:700,cursor:'pointer',textAlign:'left',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <span>🌏 Broad Market <span style={{fontSize:11,fontWeight:400,opacity:0.7}}>(BSE 500 + Sensex composite)</span></span>
          {selected==='__broad__' && <span style={{fontSize:11,background:'#2563eb',color:'#fff',borderRadius:20,padding:'2px 10px'}}>Selected</span>}
        </button>
      </div>
      {/* Grouped index buttons */}
      {INDEX_GROUPS.map(group => {
        const groupIndices = group.indices.filter(n => available.includes(n));
        if (!groupIndices.length) return null;
        return (
          <div key={group.label} style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:0.8,marginBottom:8,textTransform:'uppercase'}}>{group.label}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {groupIndices.map(name => (
                <button key={name} onClick={()=>onSelect(name)} style={{
                  padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                  border: selected===name ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: selected===name ? '#eff6ff' : '#f8fafc',
                  color: selected===name ? '#1d4ed8' : '#64748b',
                  transition:'all 0.15s',
                }}>
                  {name.replace('BSE ','')}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Live Formula Card ────────────────────────────────────────────────────────
function FormulaCard({ weights }) {
  const terms = [
    { label:'PE Percentile', key:'pe',  color:'#0891b2', note:'inverted — high PE = expensive' },
    { label:'PB Percentile', key:'pb',  color:'#7c3aed', note:'inverted — high PB = expensive' },
    { label:'DY Percentile', key:'dy',  color:'#0d9488', note:'direct — high yield = cheap'    },
  ];
  return (
    <div style={{background:'linear-gradient(135deg,#f0f9ff,#eff6ff)',border:'1px solid #bfdbfe',borderRadius:16,padding:'20px 24px',marginBottom:24}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <span style={{background:'#2563eb',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>∑</span>
        <span style={{fontSize:13,fontWeight:700,color:'#1e3a8a'}}>Scoring Formula — updates live with weight sliders</span>
      </div>
      <div style={{background:'#fff',border:'1px solid #dbeafe',borderRadius:12,padding:'14px 18px',fontFamily:"'DM Mono',monospace",fontSize:'clamp(11px,1.8vw,13px)',color:'#0f172a',overflowX:'auto',whiteSpace:'nowrap',marginBottom:14}}>
        <span style={{color:'#64748b',fontStyle:'italic'}}>Score</span>
        <span style={{color:'#94a3b8'}}> = </span>
        {terms.map((t,i) => (
          <span key={t.key}>
            <span style={{background:`${t.color}15`,border:`1px solid ${t.color}40`,borderRadius:6,padding:'2px 8px',color:t.color,fontWeight:700}}>{t.label}</span>
            <span style={{color:'#94a3b8'}}> × </span>
            <span style={{background:'#1d4ed815',border:'1px solid #1d4ed840',borderRadius:6,padding:'2px 8px',color:'#1d4ed8',fontWeight:800,transition:'all 0.2s'}}>{weights[t.key]}%</span>
            {i < terms.length-1 && <span style={{color:'#94a3b8'}}> + </span>}
          </span>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:12}}>
        {terms.map(t => (
          <div key={t.key} style={{display:'flex',alignItems:'flex-start',gap:8,background:'#fff',borderRadius:10,padding:'10px 14px',border:`1px solid ${t.color}25`}}>
            <div style={{width:9,height:9,borderRadius:'50%',background:t.color,marginTop:3,flexShrink:0}}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:t.color}}>{t.label}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:1}}>{t.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #e0e7ff',fontSize:12,color:'#475569',lineHeight:1.65}}>
        <b style={{color:'#1e3a8a'}}>How to read: </b>
        Score <b>100</b> = cheapest ever recorded · Score <b>0</b> = most expensive ever.
        P/E &amp; P/B are inverted (higher ratio → more expensive → lower score).
        Dividend Yield is direct (higher yield → cheaper → higher score).
      </div>
    </div>
  );
}

// ── Weight Sliders (compact inline) ─────────────────────────────────────────
function WeightSlider({ weights, onChange }) {
  const keys=['pe','pb','dy'], labels={pe:'PE Weight',pb:'PB Weight',dy:'DY Weight'};
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
    <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
      {keys.map(k=>(
        <div key={k} style={{display:'flex',alignItems:'center',gap:8,flex:'1 1 180px'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#374151',whiteSpace:'nowrap',minWidth:70}}>{labels[k]}</span>
          <input type="range" min={10} max={80} value={weights[k]} style={{flex:1,accentColor:'#2563eb'}}
            onChange={e=>handle(k,Number(e.target.value))}/>
          <span style={{fontSize:12,fontWeight:700,color:'#2563eb',width:36,textAlign:'right'}}>{weights[k]}%</span>
        </div>
      ))}
      <button onClick={()=>onChange({pe:30,pb:40,dy:30})}
        style={{padding:'5px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:11,cursor:'pointer',color:'#64748b',whiteSpace:'nowrap'}}>
        ↩ Reset
      </button>
    </div>
  );
}

// ── Oscillator Chart ─────────────────────────────────────────────────────────
// Zone orientation: Score 100 (Deep Value / cheapest) = TOP of chart
//                  Score 0   (Stretched / expensive)  = BOTTOM of chart
// This is intuitive: market going UP on chart = getting CHEAPER (better entry)
function OscillatorChart({ series, weights, onWeightsChange }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const W=860, H=300, PL=36, PR=90, PT=12, PB=28;
  const cW=W-PL-PR, cH=H-PT-PB;

  if (!series?.length) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>No data.</div>;

  const minTs = new Date(series[0].date).getTime();
  const maxTs = new Date(series[series.length-1].date).getTime();
  const tsRange = maxTs-minTs||1;
  const xOf = d  => PL+((new Date(d).getTime()-minTs)/tsRange)*cW;

  // Score 100 = TOP (PT), Score 0 = BOTTOM (PT+cH)
  // yOf maps score → y coordinate: high score = low y = near top
  const yOf = sc => PT + cH - (sc/100)*cH;

  const pts   = series.map(p=>({x:xOf(p.date), y:yOf(p.score)}));
  const pathD = smoothPath(pts);

  const sy=new Date(series[0].date).getFullYear(), ey=new Date(series[series.length-1].date).getFullYear();
  const step=Math.max(1,Math.floor((ey-sy)/10));
  const years=[];
  for(let y=sy;y<=ey;y+=step){
    const ts=new Date(`${y}-01-01`).getTime();
    if(ts>=minTs&&ts<=maxTs) years.push({year:y,x:xOf(`${y}-01-01`)});
  }

  const onMove = useCallback(e=>{
    const svg=svgRef.current; if(!svg) return;
    const rect=svg.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width);
    const ratio=Math.max(0,Math.min(1,(mx-PL)/cW));
    const idx=Math.round(ratio*(series.length-1));
    const p=series[Math.max(0,Math.min(series.length-1,idx))];
    if(p) setTooltip({x:xOf(p.date),y:yOf(p.score),d:p});
  },[series]);

  const tz   = tooltip ? getZone(tooltip.d.score) : null;
  const last  = series[series.length-1];
  const lz    = getZone(last.score);

  return (
    <div>
      {/* Inline weight sliders — directly above chart */}
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:10,letterSpacing:0.5}}>VALUATION WEIGHTS — drag to recompute score</div>
        <WeightSlider weights={weights} onChange={onWeightsChange}/>
      </div>

      {/* Zone legend */}
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:10,alignItems:'center'}}>
        <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>Zones (top→bottom):</span>
        {ZONE_CONFIG.map(z=>(
          <div key={z.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#64748b'}}>
            <div style={{width:10,height:10,borderRadius:2,background:z.color,opacity:0.8}}/>{z.label}
          </div>
        ))}
      </div>

      <div style={{position:'relative'}}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          style={{width:'100%',height:'auto',display:'block',cursor:'crosshair'}}
          onMouseMove={onMove} onMouseLeave={()=>setTooltip(null)}>

          {/* Zone bands — Deep Value (80-100) at TOP, Stretched (0-20) at BOTTOM */}
          {ZONE_CONFIG.map(z=>(
            <rect key={z.label}
              x={PL}
              y={PT + cH - (z.max/100)*cH}
              width={cW}
              height={((z.max-z.min)/100)*cH}
              fill={z.bg}
            />
          ))}

          {/* Zone labels on right axis — positioned at band midpoints */}
          {ZONE_CONFIG.map(z=>{
            const midY = PT + cH - ((z.min+z.max)/200)*cH;
            return (
              <text key={z.label} x={PL+cW+6} y={midY+4}
                fontSize={9} fill={z.color} fontWeight={600}>{z.label}</text>
            );
          })}

          {/* Score axis labels — 0 at bottom, 100 at top */}
          {[0,20,40,60,80,100].map(v=>(
            <g key={v}>
              <line x1={PL} x2={PL+cW} y1={yOf(v)} y2={yOf(v)}
                stroke="#e2e8f0" strokeWidth={v===0||v===100?0.8:0.5}
                strokeDasharray={v===0||v===100?'none':'4,4'}/>
              <text x={PL-4} y={yOf(v)+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
            </g>
          ))}

          {/* Year markers */}
          {years.map(({year,x})=>(
            <g key={year}>
              <line x1={x} x2={x} y1={PT} y2={PT+cH} stroke="#f1f5f9" strokeWidth={0.6}/>
              <text x={x} y={H-6} textAnchor="middle" fontSize={9} fill="#94a3b8">{year}</text>
            </g>
          ))}

          {/* Score line */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={1.8}
            strokeLinejoin="round" strokeLinecap="round" opacity={0.9}/>

          {/* Latest dot */}
          <circle cx={xOf(last.date)} cy={yOf(last.score)} r={5} fill={lz.color} stroke="#fff" strokeWidth={2}/>

          {/* Crosshair */}
          {tooltip && <>
            <line x1={tooltip.x} x2={tooltip.x} y1={PT} y2={PT+cH}
              stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3"/>
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill={tz?.color??'#2563eb'} stroke="#fff" strokeWidth={2}/>
          </>}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{position:'absolute',top:50,left:16,background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 14px',fontSize:12,boxShadow:'0 4px 16px rgba(0,0,0,.12)',pointerEvents:'none',zIndex:10,borderLeft:`3px solid ${tz?.color??'#2563eb'}`}}>
            <div style={{fontWeight:700,color:'#0f172a',marginBottom:4}}>{fmtDate(tooltip.d.date)}</div>
            {tz && <div style={{color:tz.color,fontWeight:700,fontSize:13,marginBottom:4}}>{tz.label}</div>}
            <div style={{color:'#64748b'}}>Score: <b style={{color:tz?.color}}>{tooltip.d.score}</b></div>
            {tooltip.d.pe!=null && <div style={{color:'#64748b'}}>P/E: <b>{tooltip.d.pe?.toFixed(1)}</b></div>}
            {tooltip.d.pb!=null && <div style={{color:'#64748b'}}>P/B: <b>{tooltip.d.pb?.toFixed(1)}</b></div>}
            {tooltip.d.dy!=null && <div style={{color:'#64748b'}}>Div Yield: <b>{tooltip.d.dy?.toFixed(2)}%</b></div>}
          </div>
        )}
      </div>

      {/* Chart footnote */}
      <div style={{fontSize:11,color:'#94a3b8',marginTop:8,textAlign:'right'}}>
        ↑ High score = cheaper (Deep Value) &nbsp;·&nbsp; ↓ Low score = expensive (Stretched)
      </div>
    </div>
  );
}

// ── Returns Bar Chart ────────────────────────────────────────────────────────
function ReturnsBarChart({ data, type }) {
  const [tip,setTip]=useState(null);
  if (!data||data.count===0) return <div style={{textAlign:'center',padding:30,color:'#94a3b8',fontSize:13}}>No {type==='bottom'?'Deep Value':'Stretched'} events detected.</div>;
  const barData=RETURN_PERIODS.map(p=>({period:p,value:data.median_returns?.[p]??null})).filter(d=>d.value!=null);
  if(!barData.length) return null;
  const W=500,H=180,PL=48,PR=12,PT=16,PB=28;
  const cW=W-PL-PR,cH=H-PT-PB;
  const allV=barData.map(d=>d.value);
  const minV=Math.min(0,...allV),maxV=Math.max(0,...allV),range=(maxV-minV)||1;
  const gap=cW/barData.length,bW=gap*0.6;
  const yOf=v=>PT+cH-((v-minV)/range)*cH,zY=yOf(0);
  return (
    <div>
      <div style={{fontSize:12,color:'#64748b',marginBottom:8,fontWeight:600}}>Median Forward Returns ({data.count} events)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:500,height:'auto',display:'block'}} onMouseLeave={()=>setTip(null)}>
        <line x1={PL} x2={PL+cW} y1={zY} y2={zY} stroke="#e2e8f0" strokeWidth={1}/>
        {[-20,-10,0,10,20,30,40].filter(v=>v>=minV-5&&v<=maxV+5).map(v=>(
          <g key={v}>
            <line x1={PL} x2={PL+cW} y1={yOf(v)} y2={yOf(v)} stroke="#f1f5f9" strokeWidth={0.5}/>
            <text x={PL-4} y={yOf(v)+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}%</text>
          </g>
        ))}
        {barData.map((d,i)=>{
          const cx=PL+gap*i+gap/2,x=cx-bW/2,color=d.value>=0?'#16a34a':'#dc2626';
          const bH=Math.abs(yOf(d.value)-zY),bY=d.value>=0?yOf(d.value):zY;
          return (
            <g key={d.period} onMouseEnter={()=>setTip({cx,period:d.period,value:d.value})}>
              <rect x={x} y={bY} width={bW} height={Math.max(2,bH)} fill={color} rx={3} opacity={0.85}/>
              <text x={cx} y={H-6} textAnchor="middle" fontSize={10} fill="#64748b">{d.period}</text>
            </g>
          );
        })}
        {tip && <g>
          <rect x={Math.min(tip.cx-30,W-80)} y={PT} width={72} height={36} fill="#fff" stroke="#e2e8f0" rx={6}/>
          <text x={Math.min(tip.cx-30,W-80)+36} y={PT+14} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0f172a">{tip.period}</text>
          <text x={Math.min(tip.cx-30,W-80)+36} y={PT+28} textAnchor="middle" fontSize={11} fontWeight="bold" fill={tip.value>=0?'#16a34a':'#dc2626'}>{tip.value>0?'+':''}{tip.value?.toFixed(1)}%</text>
        </g>}
      </svg>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
        {RETURN_PERIODS.map(p=>{
          const val=data.median_returns?.[p];
          return (
            <div key={p} style={{background:val==null?'#f1f5f9':val>=0?'#f0fdf4':'#fef2f2',border:`1px solid ${val==null?'#e2e8f0':val>=0?'#bbf7d0':'#fecaca'}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:15,fontWeight:700,color:val==null?'#94a3b8':val>=0?'#16a34a':'#dc2626'}}>{val!=null?`${val>0?'+':''}${val}%`:'—'}</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{p} median</div>
            </div>
          );
        })}
      </div>
      {data.events?.length>0&&(
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
                <td style={{padding:'5px 8px',fontWeight:600,color:ev.returns?.['1Y']>=0?'#16a34a':'#dc2626'}}>{ev.returns?.['1Y']!=null?`${ev.returns['1Y']>0?'+':''}${ev.returns['1Y']}%`:'—'}</td>
                <td style={{padding:'5px 8px',fontWeight:600,color:ev.returns?.['3Y']>=0?'#16a34a':'#dc2626'}}>{ev.returns?.['3Y']!=null?`${ev.returns['3Y']>0?'+':''}${ev.returns['3Y']}%`:'—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Recompute on weight change ───────────────────────────────────────────────
function recompute(series, weights) {
  if (!series?.length) return [];
  const hPE=series.map(r=>r.pe).filter(v=>v>0);
  const hPB=series.map(r=>r.pb).filter(v=>v>0);
  const hDY=series.map(r=>r.dy).filter(v=>v>0);
  function pct(val,arr,inv){
    if(!arr.length||val==null) return 50;
    const s=[...arr].sort((a,b)=>a-b); let c=0;
    for(const v of s){if(v<val)c++;else break;}
    const r=(c/s.length)*100; return inv?100-r:r;
  }
  return series.map(p=>{
    const score=Math.round(pct(p.pe,hPE,true)*(weights.pe/100)+pct(p.pb,hPB,true)*(weights.pb/100)+pct(p.dy,hDY,false)*(weights.dy/100));
    return{...p,score,zone:getZone(score).label};
  });
}

// ── Arc Score Meter (fixed height) ───────────────────────────────────────────
function ScoreMeter({ score, zone }) {
  if (score==null||!zone) return null;
  const pct=score/100, r=52, cx=68, cy=64;
  function polar(deg,rad){const a=(deg*Math.PI)/180;return{x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)};}
  const start=polar(180,r), end=polar(180-pct*180,r), large=pct>0.5?1:0;
  return (
    // viewBox height 80 → 78, extra bottom space so text isn't clipped
    <svg width={136} height={82} viewBox="0 0 136 82" style={{display:'block',margin:'0 auto'}}>
      {/* Background track */}
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
        fill="none" stroke="#f1f5f9" strokeWidth={10} strokeLinecap="round"/>
      {/* Zone colour segments */}
      {ZONE_CONFIG.slice().reverse().map((z,i)=>{
        const s=polar(180-(i/5)*180,r), e=polar(180-((i+1)/5)*180,r);
        return <path key={z.label} d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
          fill="none" stroke={z.color} strokeWidth={8} strokeLinecap="butt" opacity={0.2}/>;
      })}
      {/* Active arc */}
      {pct>0&&<path d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`}
        fill="none" stroke={zone.color} strokeWidth={8} strokeLinecap="round"/>}
      {/* Needle dot */}
      <circle cx={end.x} cy={end.y} r={5} fill={zone.color}/>
      {/* Score text */}
      <text x={cx} y={cx-2} textAnchor="middle" fontSize={20} fontWeight={800} fill={zone.color}>{score}</text>
      <text x={cx} y={cx+14} textAnchor="middle" fontSize={8} fill="#94a3b8">OUT OF 100</text>
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function MarketGauge() {
  const navigate=useNavigate();
  const [apiData,setApiData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [selected,setSelected]=useState('__broad__');
  const [weights,setWeights]=useState({pe:30,pb:40,dy:30});
  const [showEmbed,setShowEmbed]=useState(false);

  useEffect(()=>{
    fetch('/api/market-gauge')
      .then(r=>r.json())
      .then(d=>{setApiData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const rawData=useMemo(()=>{
    if(!apiData) return null;
    return selected==='__broad__'?apiData.broad_market:(apiData.by_index?.[selected]??null);
  },[apiData,selected]);

  const series=useMemo(()=>recompute(rawData?.series,weights),[rawData,weights]);
  const currentScore=series.length?series[series.length-1]?.score:rawData?.current_score;
  const currentZone=currentScore!=null?getZone(currentScore):null;
  const available=apiData?.meta?.indices_available??[];
  const displayName=selected==='__broad__'?'Broad Market (BSE 500 + Sensex)':selected;

  if (loading) return <Loader/>;
  if (error||!apiData) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#dc2626',fontFamily:'sans-serif'}}>
      Failed to load market data. {error}
    </div>
  );

  const card    ={background:'#fff',borderRadius:16,border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:24,overflow:'hidden'};
  const cardHdr ={padding:'18px 24px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10};
  const cardBody={padding:'20px 24px'};

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:'24px 16px 48px'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>

        {/* Page header */}
        <div style={{marginBottom:24}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:20,padding:'3px 12px',fontSize:12,fontWeight:600,color:'#1d4ed8',marginBottom:10}}>
            📊 G1 · Market Intelligence
          </div>
          <h1 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,color:'#0f172a',margin:'0 0 8px'}}>Market Valuation Gauge</h1>
          <p style={{color:'#64748b',fontSize:15,margin:0}}>
            Percentile-based valuation score across full BSE history (1990–present). Score 100 = cheapest ever · Score 0 = most expensive ever.
          </p>
        </div>

        {/* Index Selector */}
        <IndexSelector available={available} selected={selected} onSelect={setSelected}/>

        {/* Formula Card */}
        <FormulaCard weights={weights}/>

        {/* Summary Card */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#0f172a'}}>{displayName}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>As of {fmtDate(rawData?.latest_date)} · Data since {rawData?.history_from?.slice(0,4)??'1990'}</div>
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
                    {label:'Valuation Score',    value:currentScore??'—',                                               color:'#2563eb'},
                    {label:'Price / Earnings',   value:rawData?.latest_pe!=null?`${rawData.latest_pe.toFixed(1)}x`:'—', color:'#0891b2'},
                    {label:'Price / Book',       value:rawData?.latest_pb!=null?`${rawData.latest_pb.toFixed(1)}x`:'—', color:'#7c3aed'},
                    {label:'Dividend Yield',     value:rawData?.latest_dy!=null?`${rawData.latest_dy.toFixed(2)}%`:'—', color:'#0d9488'},
                    {label:'Avg Score (History)',value:rawData?.score_avg??'—',                                          color:'#64748b'},
                    {label:'Weekly Data Points', value:rawData?.data_points??'—',                                        color:'#64748b'},
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

        {/* Panel A — Oscillator with embedded weight sliders */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#2563eb',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>A</span>
                Valuation Regime Oscillator
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
                Weekly score · 1990–present · ↑ Cheap (Deep Value) · ↓ Expensive (Stretched) · Hover to explore
              </div>
            </div>
          </div>
          <div style={cardBody}>
            <OscillatorChart series={series} weights={weights} onWeightsChange={setWeights}/>
          </div>
        </div>

        {/* Panel B */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#16a34a',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>B</span>
                Returns from Deep Value Entries
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Every time score entered Deep Value (≥80) — forward returns at 1M to 3Y</div>
            </div>
          </div>
          <div style={cardBody}><ReturnsBarChart data={rawData?.returns_from_bottoms} type="bottom"/></div>
        </div>

        {/* Panel C */}
        <div style={card}>
          <div style={cardHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:'#374151'}}>
                <span style={{background:'#dc2626',color:'#fff',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>C</span>
                Returns from Stretched Peaks
              </div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Every time score entered Stretched (≤20) — forward returns at 1M to 3Y</div>
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
            <button onClick={()=>setShowEmbed(v=>!v)} style={{padding:'6px 16px',borderRadius:8,cursor:'pointer',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:600,color:'#374151'}}>
              {showEmbed?'▲ Hide':'▼ Show Embed Code'}
            </button>
          </div>
          {showEmbed&&<div style={cardBody}><EmbedGenerator selected={selected}/></div>}
        </div>

        {/* Methodology */}
        <div style={{background:'#fafafa',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',fontSize:12,color:'#94a3b8',lineHeight:1.7}}>
          <b style={{color:'#64748b'}}>Methodology:</b> Valuation score = weighted percentile rank across full BSE history.
          P/E and P/B are inverted (high ratio = expensive = low score). Dividend Yield is direct (high yield = cheap = high score).
          Score 100 = cheapest ever; 0 = most expensive. Chart reads top = cheap, bottom = expensive.
          Weights adjustable inline above the chart — formula card updates live. Data: BSE India. Not investment advice.
        </div>

      </div>
    </div>
  );
}
