// src/pages/MarketGaugeEmbed.jsx
// Standalone embeddable iframe page — no Nav/Footer
// URL params: ?index=broad|BSE500  &theme=light|dark
// Pure SVG — zero external dependencies

import { useState, useEffect, useMemo, useRef } from 'react';

const ZONE_CONFIG = [
  { label:'Deep Value', min:80, max:100, color:'#15803d', bg:'rgba(21,128,61,0.12)'  },
  { label:'Attractive', min:60, max:80,  color:'#65a30d', bg:'rgba(101,163,13,0.12)' },
  { label:'Fair Value', min:40, max:60,  color:'#d97706', bg:'rgba(217,119,6,0.12)'  },
  { label:'Expensive',  min:20, max:40,  color:'#ea580c', bg:'rgba(234,88,12,0.12)'  },
  { label:'Stretched',  min:0,  max:20,  color:'#dc2626', bg:'rgba(220,38,38,0.12)'  },
];

function getZone(score) {
  return ZONE_CONFIG.find(z=>score>=z.min&&score<=z.max)??ZONE_CONFIG[4];
}
const fmtDate=(s)=>{
  if(!s) return '—';
  const d=new Date(s);
  return isNaN(d)?s:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
};

function MiniChart({ series, zone }) {
  const [tip,setTip]=useState(null);
  const svgRef=useRef(null);
  const W=560,H=180,PL=28,PR=8,PT=8,PB=20;
  const cW=W-PL-PR, cH=H-PT-PB;
  if(!series?.length) return null;

  const minTs=new Date(series[0].date).getTime();
  const maxTs=new Date(series[series.length-1].date).getTime();
  const tsR=maxTs-minTs||1;
  const xOf=d=>PL+((new Date(d).getTime()-minTs)/tsR)*cW;
  const yOf=s=>PT+cH-(s/100)*cH;
  const pts=series.map(p=>`${xOf(p.date).toFixed(1)},${yOf(p.score).toFixed(1)}`).join(' ');

  const sy=new Date(series[0].date).getFullYear();
  const ey=new Date(series[series.length-1].date).getFullYear();
  const step=Math.max(1,Math.floor((ey-sy)/8));
  const years=[];
  for(let y=sy;y<=ey;y+=step){
    const ts=new Date(`${y}-01-01`).getTime();
    if(ts>=minTs&&ts<=maxTs) years.push({year:y,x:xOf(`${y}-01-01`)});
  }

  const onMove=e=>{
    const svg=svgRef.current; if(!svg) return;
    const rect=svg.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width);
    const ratio=Math.max(0,Math.min(1,(mx-PL)/cW));
    const idx=Math.round(ratio*(series.length-1));
    const p=series[Math.max(0,Math.min(series.length-1,idx))];
    if(p) setTip({x:xOf(p.date),y:yOf(p.score),d:p});
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
      style={{width:'100%',height:'auto',display:'block',cursor:'crosshair'}}
      onMouseMove={onMove} onMouseLeave={()=>setTip(null)}>
      {ZONE_CONFIG.map(z=>(
        <rect key={z.label} x={PL} y={PT+cH-(z.max/100)*cH}
          width={cW} height={((z.max-z.min)/100)*cH} fill={z.bg}/>
      ))}
      {years.map(({year,x})=>(
        <g key={year}>
          <line x1={x} x2={x} y1={PT} y2={PT+cH} stroke="rgba(0,0,0,0.06)" strokeWidth={0.5}/>
          <text x={x} y={H-4} textAnchor="middle" fontSize={8} fill="#94a3b8">{year}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke={zone?.color??'#2563eb'} strokeWidth={2} strokeLinejoin="round"/>
      {(()=>{
        const last=series[series.length-1];
        const lz=getZone(last.score);
        return <circle cx={xOf(last.date)} cy={yOf(last.score)} r={4} fill={lz.color} stroke="#fff" strokeWidth={2}/>;
      })()}
      {tip&&(
        <>
          <line x1={tip.x} x2={tip.x} y1={PT} y2={PT+cH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2,2"/>
          <rect x={Math.min(tip.x+6,W-90)} y={PT+2} width={82} height={42} fill="#fff" stroke="#e2e8f0" rx={5}/>
          <text x={Math.min(tip.x+6,W-90)+41} y={PT+14} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="bold">{tip.d.date?.slice(0,7)}</text>
          <text x={Math.min(tip.x+6,W-90)+41} y={PT+26} textAnchor="middle" fontSize={9} fill={getZone(tip.d.score).color} fontWeight="bold">
            {getZone(tip.d.score).label}
          </text>
          <text x={Math.min(tip.x+6,W-90)+41} y={PT+38} textAnchor="middle" fontSize={9} fill="#64748b">
            Score {tip.d.score}
          </text>
        </>
      )}
    </svg>
  );
}

export default function MarketGaugeEmbed() {
  const containerRef=useRef(null);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);

  const params=new URLSearchParams(window.location.search);
  const indexParam=params.get('index')||'broad';
  const theme=params.get('theme')||'light';
  const isDark=theme==='dark';

  useEffect(()=>{
    fetch('/api/market-gauge')
      .then(r=>r.json())
      .then(d=>{setData(d);setLoading(false);})
      .catch(()=>{setError(true);setLoading(false);});
  },[]);

  // postMessage height for auto-resize
  useEffect(()=>{
    if(!containerRef.current) return;
    const obs=new ResizeObserver(()=>{
      const h=containerRef.current?.offsetHeight??520;
      window.parent?.postMessage({type:'fundlens-gauge-resize',height:h},'*');
    });
    obs.observe(containerRef.current);
    return ()=>obs.disconnect();
  },[data]);

  const target=useMemo(()=>{
    if(!data) return null;
    if(indexParam==='broad') return data.broad_market;
    const key=Object.keys(data.by_index??{}).find(
      k=>k.toLowerCase().replace(/\s+/g,'')===indexParam.toLowerCase().replace(/\s+/g,'')
    );
    return key?data.by_index[key]:data.broad_market;
  },[data,indexParam]);

  const displayName=indexParam==='broad'?'Broad Market (BSE 500 + Sensex)':indexParam.toUpperCase();
  const score=target?.current_score??null;
  const zone=score!=null?getZone(score):null;

  const bg=isDark?'#0f172a':'#ffffff';
  const border=isDark?'#1e293b':'#e2e8f0';
  const textPrimary=isDark?'#f8fafc':'#0f172a';
  const textSec=isDark?'#94a3b8':'#64748b';
  const metBg=isDark?'#1e293b':'#f8fafc';

  const wrap={background:bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",padding:16,minHeight:480,borderRadius:12,border:`1px solid ${border}`};

  if(loading) return <div ref={containerRef} style={{...wrap,display:'flex',alignItems:'center',justifyContent:'center',color:textSec}}>Loading…</div>;
  if(error||!data||!target) return <div ref={containerRef} style={{...wrap,display:'flex',alignItems:'center',justifyContent:'center',color:'#dc2626'}}>Data unavailable.</div>;

  return (
    <div ref={containerRef} style={wrap}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:textSec,letterSpacing:1}}>FUNDLENS · MARKET VALUATION GAUGE</div>
          <div style={{fontSize:15,fontWeight:800,color:textPrimary}}>{displayName}</div>
          <div style={{fontSize:11,color:textSec}}>as of {fmtDate(target.latest_date)}</div>
        </div>
        {zone&&(
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${zone.color}18`,border:`1.5px solid ${zone.color}`,borderRadius:20,padding:'5px 14px',fontSize:13,fontWeight:700,color:zone.color}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:zone.color,display:'inline-block'}}/>
            {zone.label} · {score}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {[
          {label:'P/E',   value:target.latest_pe?.toFixed(1)},
          {label:'P/B',   value:target.latest_pb?.toFixed(1)},
          {label:'Div Y', value:target.latest_dy!=null?`${target.latest_dy.toFixed(2)}%`:null},
          {label:'Score', value:score, color:zone?.color},
        ].map(m=>(
          <div key={m.label} style={{background:metBg,borderRadius:8,padding:'8px 14px',textAlign:'center',flex:'1 0 60px'}}>
            <div style={{fontSize:16,fontWeight:800,color:m.color??textPrimary}}>{m.value??'—'}</div>
            <div style={{fontSize:10,color:textSec}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Zone legend */}
      <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
        {ZONE_CONFIG.map(z=>(
          <div key={z.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:textSec}}>
            <div style={{width:8,height:8,borderRadius:2,background:z.color,opacity:0.7}}/>
            {z.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <MiniChart series={target.series} zone={zone}/>

      {/* Commentary */}
      {target.commentary&&(
        <div style={{marginTop:12,padding:'10px 12px',background:isDark?'#1e293b':'#f0f9ff',borderRadius:8,fontSize:11,color:isDark?'#94a3b8':'#0c4a6e',lineHeight:1.6,borderLeft:`3px solid ${zone?.color??'#2563eb'}`}}>
          {target.commentary}
        </div>
      )}

      {/* Footer */}
      <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10,color:textSec}}>
        <span>BSE India via FundLens · Not investment advice</span>
        <a href="https://fundlens.in/tools/market-gauge" target="_blank" rel="noopener noreferrer"
          style={{color:zone?.color??'#2563eb',fontWeight:600,textDecoration:'none'}}>
          Full Analysis ↗
        </a>
      </div>
    </div>
  );
}
