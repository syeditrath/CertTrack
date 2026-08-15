import { useState, useMemo } from "react";
import { T } from "../theme.js";
import { fmtDate, formatSarCompact, printPage, getInvoiceCollectedAmount, getInvoiceRemainingAmount } from "../utils.js";
import { deriveProjectStats } from "./UI.jsx";

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT ANALYSIS — PRO SUITE
   Drop-in add-on for ProjectAnalysisPage: Risk Alerts, Analytics (charts),
   Timeline (Gantt), Budget vs Actual, and polished PDF reports.

   Depends only on things ProjectAnalysis.jsx already imports/derives:
   T (theme), fmtDate, formatSarCompact, printPage,
   getInvoiceCollectedAmount, getInvoiceRemainingAmount.

   Consumes `enriched` — the array ProjectAnalysisPage already builds:
     analysis.map(p => ({ ...p, poValue, ...deriveProjectStats(p.project, projectDocs) }))
   i.e. each item has: project, status, poValue, clientName, poNumber,
   startDate, estEndDate, actualEndDate, invs, jobs, totalInvoiced,
   totalCollected, totalDue, dailyReports (maybe).

   Budget vs Actual is additive: it does NOT touch your existing project
   records. It stores { budgetedCost, actualCost } per project id under a
   new top-level key `data.projectBudgets` so nothing else can clobber it.
════════════════════════════════════════════════════════════════════════════ */

/* ── small local helpers (self-contained, don't rely on file's undefined globals) ── */
function getDaysLeft(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function progressColor(pct) {
  if (pct >= 80) return T.green;
  if (pct >= 50) return T.gold;
  return T.red;
}
function getInvDate(inv) {
  return inv?.date || inv?.invoiceDate || inv?.issueDate || inv?.docDate || inv?.createdAt || "";
}
function monthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(key) {
  const [y,m] = key.split("-");
  return new Date(Number(y), Number(m)-1, 1).toLocaleDateString(undefined,{month:"short",year:"2-digit"});
}
const STATUS_COLOR = (T) => ({
  "Not Started": T.textMuted, "Active": T.blue, "In Progress": T.blue,
  "On Hold": T.gold, "Completed": T.green, "Cancelled": T.red,
});

/* ════════════════════════════════════════════════════════════════════════════
   RISK INSIGHTS
════════════════════════════════════════════════════════════════════════════ */
export function costSheetsByProject(costSheets) {
  const map = {};
  (costSheets||[]).forEach(s => {
    if (!map[s.project]) map[s.project] = { estimated:0, actual:0 };
    map[s.project].estimated += parseFloat(s.estimatedCost) || 0;
    map[s.project].actual    += parseFloat(s.actualCost) || 0;
  });
  return map;
}

export function computeRiskInsights(enriched, budgetsByProjectName) {
  const overdue = [], dueSoon = [], overBudget = [], highAR = [];
  enriched.forEach(p => {
    const status = p.status || "";
    const isOpen = !["Completed","Cancelled"].includes(status);
    const dl = getDaysLeft(p.estEndDate);
    if (isOpen && dl !== null) {
      if (dl < 0) overdue.push({ ...p, daysOver: Math.abs(dl) });
      else if (dl <= 14) dueSoon.push({ ...p, daysLeft: dl });
    }
    const b = budgetsByProjectName?.[p.project];
    if (b && b.estimated > 0) {
      const ratio = b.actual / b.estimated;
      if (ratio >= 1) overBudget.push({ ...p, budget:b.estimated, actual:b.actual, ratio });
      else if (ratio >= 0.9) overBudget.push({ ...p, budget:b.estimated, actual:b.actual, ratio, nearing: true });
    }
    const poValue = parseFloat(p.poValue) || 0;
    if (poValue > 0 && p.totalDue > 0 && (p.totalDue / poValue) >= 0.3) {
      highAR.push({ ...p, dueRatio: p.totalDue / poValue });
    }
  });
  overdue.sort((a,b)=>b.daysOver-a.daysOver);
  dueSoon.sort((a,b)=>a.daysLeft-b.daysLeft);
  overBudget.sort((a,b)=>b.ratio-a.ratio);
  highAR.sort((a,b)=>b.dueRatio-a.dueRatio);
  return { overdue, dueSoon, overBudget, highAR, total: overdue.length+dueSoon.length+overBudget.length+highAR.length };
}

export function RiskAlertsBar({ enriched, data, onOpenProject }) {
  const budgets = useMemo(()=>costSheetsByProject(data?.costSheets), [data?.costSheets]);
  const risk = useMemo(()=>computeRiskInsights(enriched, budgets), [enriched, budgets]);
  const [expanded, setExpanded] = useState(false);
  if (risk.total === 0) {
    return (
      <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.green,fontWeight:700}}>
        ✓ No active risk flags — all projects on track
      </div>
    );
  }
  const sections = [
    { key:"overdue",    label:"OVERDUE",           icon:"⏰", color:T.red,  items:risk.overdue,    render:p=>`${p.project} — ${p.daysOver}d past due date` },
    { key:"dueSoon",    label:"DUE WITHIN 14 DAYS", icon:"⚠",  color:T.gold, items:risk.dueSoon,    render:p=>`${p.project} — ${p.daysLeft}d remaining` },
    { key:"overBudget", label:"BUDGET RISK",        icon:"💸", color:T.red,  items:risk.overBudget, render:p=>`${p.project} — ${Math.round(p.ratio*100)}% of budget${p.nearing?" (nearing)":" (over)"}` },
    { key:"highAR",     label:"HIGH OUTSTANDING AR",icon:"🧾", color:T.orange||T.gold, items:risk.highAR, render:p=>`${p.project} — ${formatSarCompact(p.totalDue)} uncollected` },
  ].filter(s=>s.items.length>0);

  return (
    <div style={{background:T.redDim,border:`1px solid ${T.red}33`,borderRadius:12,marginBottom:16,overflow:"hidden"}}>
      <button onClick={()=>setExpanded(e=>!e)} style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <span style={{fontSize:13,fontWeight:800,color:T.red,display:"flex",alignItems:"center",gap:8}}>
          ▲ {risk.total} risk flag{risk.total!==1?"s":""} need attention
        </span>
        <span style={{fontSize:12,color:T.red,fontWeight:600}}>{expanded?"Hide ▲":"Show ▼"}</span>
      </button>
      {expanded && (
        <div style={{padding:"0 16px 14px",display:"flex",flexDirection:"column",gap:10}}>
          {sections.map(s=>(
            <div key={s.key}>
              <div style={{fontSize:11,fontWeight:800,color:s.color,letterSpacing:.5,marginBottom:5}}>{s.icon} {s.label} ({s.items.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {s.items.slice(0,6).map((p,i)=>(
                  <div key={p.id||i} onClick={()=>onOpenProject && onOpenProject(p.id)}
                    style={{fontSize:12,color:T.text,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 10px",cursor:onOpenProject?"pointer":"default"}}>
                    {s.render(p)}
                  </div>
                ))}
                {s.items.length>6 && <div style={{fontSize:11,color:T.textMuted}}>+{s.items.length-6} more</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CHART PRIMITIVES — pure inline SVG, no external chart library required
════════════════════════════════════════════════════════════════════════════ */
export function DonutChart({ data, size=170, thickness=26 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  const r = (size - thickness) / 2;
  const cx = size/2, cy = size/2;
  const circumference = 2*Math.PI*r;
  let offset = 0;
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={thickness}/>
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill={T.textMuted}>No data</text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.filter(d=>d.value>0).map((d,i)=>{
          const frac = d.value/total;
          const len = frac*circumference;
          const dasharray = `${len} ${circumference-len}`;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={dasharray} strokeDashoffset={-offset} strokeLinecap="butt">
              <title>{d.label}: {d.value}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </g>
      <text x={cx} y={cy-6} textAnchor="middle" fontSize="20" fontWeight="800" fill={T.text} fontFamily="'Barlow Condensed',sans-serif">{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="10" fill={T.textMuted} fontWeight="600">PROJECTS</text>
    </svg>
  );
}

export function BarChart({ data, height=180, formatValue=v=>v, maxBars=8 }) {
  const items = data.slice(0, maxBars);
  const max = Math.max(1, ...items.map(d=>d.value));
  const barW = 100/items.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" style={{overflow:"visible"}}>
      {items.map((d,i)=>{
        const h = (d.value/max) * (height-42);
        const x = i*(300/items.length);
        const w = (300/items.length) * 0.62;
        const cx = x + (300/items.length - w)/2;
        return (
          <g key={i}>
            <rect x={cx} y={height-30-h} width={w} height={h} rx={3} fill={d.color||T.blue}>
              <title>{d.label}: {formatValue(d.value)}</title>
            </rect>
            <text x={cx+w/2} y={height-30-h-6} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>
              {formatValue(d.value)}
            </text>
            <text x={cx+w/2} y={height-14} textAnchor="middle" fontSize="8.5" fill={T.textMuted}>
              {String(d.label).length>10 ? String(d.label).slice(0,9)+"…" : d.label}
            </text>
          </g>
        );
      })}
      <line x1="0" y1={height-30} x2="300" y2={height-30} stroke={T.border} strokeWidth="1"/>
    </svg>
  );
}

export function TrendChart({ series, height=200 }) {
  // series: [{ key: "Month label", invoiced, collected }]
  if (!series.length) {
    return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:T.textMuted,fontSize:12}}>No invoice history yet</div>;
  }
  const W = 600;
  const padL = 44, padB = 26, padT = 14;
  const max = Math.max(1, ...series.map(s=>Math.max(s.invoiced,s.collected)));
  const stepX = (W - padL - 10) / Math.max(1, series.length-1);
  const yFor = v => (height-padB) - (v/max)*(height-padB-padT);
  const xFor = i => padL + i*stepX;
  const pathFor = key => series.map((s,i)=>`${i===0?"M":"L"} ${xFor(i)} ${yFor(s[key])}`).join(" ");
  const areaFor = key => `${pathFor(key)} L ${xFor(series.length-1)} ${height-padB} L ${xFor(0)} ${height-padB} Z`;
  const ticks = 4;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      {Array.from({length:ticks+1}).map((_,i)=>{
        const v = (max/ticks)*i;
        const y = yFor(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W-6} y2={y} stroke={T.border} strokeWidth="1" opacity="0.5"/>
            <text x={padL-6} y={y+3} textAnchor="end" fontSize="8" fill={T.textMuted}>{formatSarCompact(v)}</text>
          </g>
        );
      })}
      <path d={areaFor("invoiced")} fill={T.blue} opacity="0.12"/>
      <path d={pathFor("invoiced")} fill="none" stroke={T.blue} strokeWidth="2.2"/>
      <path d={pathFor("collected")} fill="none" stroke={T.green} strokeWidth="2.2" strokeDasharray="0"/>
      {series.map((s,i)=>(
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(s.invoiced)} r="3" fill={T.blue}><title>Invoiced {s.key}: {formatSarCompact(s.invoiced)}</title></circle>
          <circle cx={xFor(i)} cy={yFor(s.collected)} r="3" fill={T.green}><title>Collected {s.key}: {formatSarCompact(s.collected)}</title></circle>
          {(i%Math.ceil(series.length/8||1)===0) &&
            <text x={xFor(i)} y={height-8} textAnchor="middle" fontSize="8" fill={T.textMuted}>{s.key}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ANALYTICS TAB
════════════════════════════════════════════════════════════════════════════ */
export function AnalyticsTab({ enriched }) {
  const statusData = useMemo(() => {
    const colors = STATUS_COLOR(T);
    const counts = {};
    enriched.forEach(p => { const s = p.status || "Not Started"; counts[s] = (counts[s]||0)+1; });
    return Object.entries(counts).map(([label,value]) => ({ label, value, color: colors[label] || T.textMuted }));
  }, [enriched]);

  const topByValue = useMemo(() =>
    [...enriched].sort((a,b)=>(parseFloat(b.poValue)||0)-(parseFloat(a.poValue)||0))
      .slice(0,8).map(p=>({ label:p.project, value: parseFloat(p.poValue)||0, color:T.gold })),
  [enriched]);

  const collectionByProject = useMemo(() =>
    [...enriched].filter(p=>p.totalInvoiced>0)
      .sort((a,b)=>b.totalDue-a.totalDue).slice(0,8)
      .map(p=>({ label:p.project, value: p.totalDue, color: p.totalDue>0?T.red:T.green })),
  [enriched]);

  const trendSeries = useMemo(() => {
    const buckets = {};
    enriched.forEach(p => (p.invs||[]).forEach(inv => {
      const mk = monthKey(getInvDate(inv));
      if (!mk) return;
      const collected = getInvoiceCollectedAmount(inv) || 0;
      const remaining = getInvoiceRemainingAmount(inv) || 0;
      if (!buckets[mk]) buckets[mk] = { invoiced:0, collected:0 };
      buckets[mk].invoiced += collected+remaining;
      buckets[mk].collected += collected;
    }));
    const keys = Object.keys(buckets).sort();
    let cumInv=0, cumCol=0;
    return keys.map(k => {
      cumInv += buckets[k].invoiced;
      cumCol += buckets[k].collected;
      return { key: monthLabel(k), invoiced: cumInv, collected: cumCol };
    });
  }, [enriched]);

  const totalPO = enriched.reduce((s,x)=>s+(parseFloat(x.poValue)||0),0);
  const totalInvoiced = enriched.reduce((s,x)=>s+x.totalInvoiced,0);
  const avgProgress = enriched.length ? Math.round(enriched.reduce((s,x)=>{
    const pv = parseFloat(x.poValue)||0;
    return s + (pv>0 ? Math.min(100,(x.totalInvoiced/pv)*100) : 0);
  },0)/enriched.length) : 0;

  const CardShell = ({ title, children, span }) => (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px",boxShadow:T.shadow,gridColumn:span?"1 / -1":"auto"}}>
      <div style={{fontSize:12,fontWeight:800,color:T.textMuted,letterSpacing:.5,marginBottom:12}}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        {[
          {label:"Total PO Value", v:formatSarCompact(totalPO), color:T.gold},
          {label:"Total Invoiced", v:formatSarCompact(totalInvoiced), color:T.blue},
          {label:"Avg. Portfolio Progress", v:`${avgProgress}%`, color:progressColor(avgProgress)},
          {label:"Active Projects", v:enriched.filter(p=>!["Completed","Cancelled"].includes(p.status)).length, color:T.blue},
        ].map(k=>(
          <div key={k.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:T.shadow}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(16px,2.5vw,24px)",fontWeight:800,color:k.color}}>{k.v}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16}}>
        <CardShell title="📈 CUMULATIVE INVOICED vs COLLECTED (BY MONTH)" span>
          <TrendChart series={trendSeries} />
          <div style={{display:"flex",gap:16,marginTop:8,fontSize:11,fontWeight:700}}>
            <span style={{color:T.blue}}>● Invoiced</span>
            <span style={{color:T.green}}>● Collected</span>
          </div>
        </CardShell>

        <CardShell title="🥧 PROJECTS BY STATUS">
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <DonutChart data={statusData} />
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {statusData.map(d=>(
                <div key={d.label} style={{fontSize:12,display:"flex",alignItems:"center",gap:6,color:T.text}}>
                  <span style={{width:9,height:9,borderRadius:3,background:d.color,display:"inline-block"}}/>
                  {d.label} <span style={{color:T.textMuted}}>({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </CardShell>

        <CardShell title="💰 TOP PROJECTS BY PO VALUE">
          <BarChart data={topByValue} formatValue={formatSarCompact} />
        </CardShell>

        <CardShell title="⏳ HIGHEST OUTSTANDING RECEIVABLES">
          <BarChart data={collectionByProject} formatValue={formatSarCompact} />
        </CardShell>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TIMELINE / GANTT TAB
════════════════════════════════════════════════════════════════════════════ */
export function TimelineTab({ enriched, onOpenProject }) {
  const rows = useMemo(() =>
    enriched.filter(p=>p.startDate && (p.estEndDate||p.actualEndDate))
      .map(p=>({ ...p, s:new Date(p.startDate), e:new Date(p.actualEndDate||p.estEndDate) }))
      .filter(p=>!isNaN(p.s)&&!isNaN(p.e))
      .sort((a,b)=>a.s-b.s)
  , [enriched]);

  if (!rows.length) {
    return (
      <div style={{textAlign:"center",padding:"60px 20px",background:T.card,border:`1px solid ${T.border}`,borderRadius:18}}>
        <div style={{fontSize:48,marginBottom:16}}>🗓</div>
        <div style={{fontSize:15,color:T.textMuted,fontWeight:600}}>No projects with both a start and end date yet — add dates to see the timeline.</div>
      </div>
    );
  }

  const minDate = new Date(Math.min(...rows.map(r=>r.s)));
  const maxDate = new Date(Math.max(...rows.map(r=>r.e)));
  minDate.setDate(1);
  maxDate.setMonth(maxDate.getMonth()+1, 0);
  const totalDays = Math.max(1, (maxDate-minDate)/86400000);
  const today = new Date();
  const todayPct = ((today-minDate)/86400000/totalDays)*100;
  const colors = STATUS_COLOR(T);

  // month gridlines
  const months = [];
  let cursor = new Date(minDate);
  while (cursor <= maxDate) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth()+1);
  }

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",boxShadow:T.shadow,overflowX:"auto"}}>
      <div style={{minWidth:640}}>
        {/* month header */}
        <div style={{display:"flex",position:"relative",height:22,marginBottom:6,borderBottom:`1px solid ${T.border}`}}>
          {months.map((m,i)=>{
            const left = ((m-minDate)/86400000/totalDays)*100;
            return <div key={i} style={{position:"absolute",left:`${left}%`,fontSize:10,color:T.textMuted,fontWeight:700}}>
              {m.toLocaleDateString(undefined,{month:"short",year:"2-digit"})}
            </div>;
          })}
        </div>
        {/* rows */}
        <div style={{display:"flex",flexDirection:"column",gap:8,position:"relative",paddingTop:4}}>
          {todayPct>=0 && todayPct<=100 && (
            <div style={{position:"absolute",left:`${todayPct}%`,top:0,bottom:0,width:1,background:T.red,zIndex:2}} title="Today"/>
          )}
          {rows.map(p=>{
            const left = ((p.s-minDate)/86400000/totalDays)*100;
            const width = Math.max(0.6, ((p.e-p.s)/86400000/totalDays)*100);
            const overdue = !["Completed","Cancelled"].includes(p.status) && p.e < today;
            const color = overdue ? T.red : (colors[p.status] || T.blue);
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:150,flexShrink:0,fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.project}>
                  {p.project}
                </div>
                <div style={{flex:1,position:"relative",height:22,background:T.bg,borderRadius:6}}>
                  <div onClick={()=>onOpenProject && onOpenProject(p.id)}
                    style={{position:"absolute",left:`${left}%`,width:`${width}%`,top:2,bottom:2,background:color,borderRadius:5,cursor:onOpenProject?"pointer":"default",minWidth:4,boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}
                    title={`${p.project}: ${fmtDate(p.startDate)} → ${fmtDate(p.actualEndDate||p.estEndDate)}${overdue?" (overdue)":""}`}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:14,marginTop:14,flexWrap:"wrap",fontSize:11,fontWeight:700}}>
          {Object.entries(colors).map(([label,color])=>(
            <span key={label} style={{color}}>■ {label}</span>
          ))}
          <span style={{color:T.red}}>| Today</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BUDGET vs ACTUAL TAB
   Aggregates your existing data.costSheets records ({ id, project,
   description, estimatedCost, actualCost, date, notes }) per project — the
   same store already used by the Cost Sheet tab in Project Detail, so this
   is a live rollup, not a separate data source. Nothing new to maintain.
════════════════════════════════════════════════════════════════════════════ */
export function BudgetTab({ enriched, data, setData, showToast, isAdmin, onOpenProject }) {
  const costSheets = data.costSheets || [];
  const byProject = useMemo(() => {
    const map = {};
    costSheets.forEach(s => {
      if (!map[s.project]) map[s.project] = { estimated:0, actual:0, count:0 };
      map[s.project].estimated += parseFloat(s.estimatedCost) || 0;
      map[s.project].actual    += parseFloat(s.actualCost) || 0;
      map[s.project].count     += 1;
    });
    return map;
  }, [costSheets]);

  const rows = enriched.map(p => ({ ...p, budget: byProject[p.project] || null }));
  const totalBudget = rows.reduce((s,p)=>s+(p.budget?.estimated||0),0);
  const totalActual = rows.reduce((s,p)=>s+(p.budget?.actual||0),0);
  const withSheets = rows.filter(p=>p.budget);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:T.shadow}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:T.text}}>{formatSarCompact(totalBudget)}</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>TOTAL ESTIMATED COST</div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:T.shadow}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:totalActual>totalBudget&&totalBudget>0?T.red:T.text}}>{formatSarCompact(totalActual)}</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>TOTAL ACTUAL COST</div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:T.shadow}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:(totalBudget-totalActual)<0?T.red:T.green}}>{formatSarCompact(totalBudget-totalActual)}</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>REMAINING BUDGET</div>
        </div>
      </div>

      {withSheets.length===0 && (
        <div style={{textAlign:"center",padding:"40px 20px",background:T.card,border:`1px dashed ${T.border}`,borderRadius:14}}>
          <div style={{fontSize:32,marginBottom:10}}>💰</div>
          <div style={{fontSize:13,color:T.textMuted,fontWeight:600}}>No cost sheet entries yet. Open a project → <strong>Cost Sheet</strong> tab to add estimated vs actual cost line items — they'll roll up here automatically.</div>
        </div>
      )}

      {withSheets.length>0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:T.card2||T.bg,borderBottom:`1px solid ${T.border}`}}>
                {["Project","PO Value","Est. Cost","Actual Cost","Variance","Used",""].map(h=>(
                  <th key={h} style={{textAlign:h==="Project"?"left":"right",padding:"10px 14px",fontSize:11,color:T.textMuted,fontWeight:800,letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.filter(p=>p.budget).map(p=>{
                const est = p.budget.estimated, act = p.budget.actual;
                const variance = est - act;
                const pct = est>0 ? Math.round((act/est)*100) : null;
                return (
                  <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <td style={{padding:"10px 14px",fontWeight:600,color:T.text}}>{p.project}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:T.textMuted}}>{formatSarCompact(parseFloat(p.poValue)||0)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:T.text}}>{formatSarCompact(est)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:T.text}}>{act?formatSarCompact(act):"—"}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:variance<0?T.red:T.green,fontWeight:700}}>{formatSarCompact(variance)}</td>
                    <td style={{padding:"10px 14px",textAlign:"right"}}>
                      {pct!==null && (
                        <span style={{background:`${pct>=100?T.red:pct>=90?T.gold:T.green}18`,color:pct>=100?T.red:pct>=90?T.gold:T.green,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{pct}%</span>
                      )}
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"right"}}>
                      <button onClick={()=>onOpenProject && onOpenProject(p.id)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Open →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   REPORTS TAB — polished, printable PDF reports (via existing printPage util)
════════════════════════════════════════════════════════════════════════════ */
function svgToInlineHtml(svgEl) {
  // React SVG elements can't be serialized directly here; charts for print
  // are rebuilt as lightweight HTML/CSS bars instead (keeps printPage's own
  // stylesheet in control and avoids a live-DOM dependency).
  return "";
}

function buildHtmlBars(data, formatValue) {
  const max = Math.max(1, ...data.map(d=>d.value));
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
    ${data.map(d=>`
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:150px;font-size:11px;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</div>
        <div style="flex:1;background:#eee;border-radius:4px;height:14px;position:relative">
          <div style="width:${Math.max(2,(d.value/max)*100)}%;background:${d.color||"#2563eb"};height:100%;border-radius:4px"></div>
        </div>
        <div style="width:80px;text-align:right;font-size:11px;font-weight:700">${formatValue(d.value)}</div>
      </div>`).join("")}
  </div>`;
}

export function buildPortfolioReportHTML(enriched, { fStat, search, risk } = {}) {
  const totalPO = enriched.reduce((s,x)=>s+(parseFloat(x.poValue)||0),0);
  const totalInvoiced = enriched.reduce((s,x)=>s+x.totalInvoiced,0);
  const totalCollected = enriched.reduce((s,x)=>s+x.totalCollected,0);
  const totalDue = enriched.reduce((s,x)=>s+x.totalDue,0);
  const topByValue = [...enriched].sort((a,b)=>(parseFloat(b.poValue)||0)-(parseFloat(a.poValue)||0)).slice(0,8)
    .map(p=>({label:p.project, value:parseFloat(p.poValue)||0, color:"#d4a017"}));

  const rows = enriched.map(p=>{
    const poValue = parseFloat(p.poValue)||0;
    const pct = poValue>0?Math.min(100,Math.round((p.totalInvoiced/poValue)*100)):0;
    return `<tr>
      <td><strong>${p.project||"—"}</strong>${p.clientName?`<br/><span style="color:#666;font-size:10px">${p.clientName}</span>`:""}</td>
      <td>${p.poNumber||"—"}</td>
      <td><span class="badge">${p.status||"—"}</span></td>
      <td style="text-align:right">${poValue>0?formatSarCompact(poValue):"—"}</td>
      <td style="text-align:right">${formatSarCompact(p.totalInvoiced)}</td>
      <td style="text-align:right">${formatSarCompact(p.totalCollected)}</td>
      <td style="text-align:right;color:${p.totalDue>0?"#dc2626":"#16a34a"}">${formatSarCompact(p.totalDue)}</td>
      <td>${poValue>0?`<div>${pct}%</div><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${pct>=80?"#16a34a":pct>=50?"#d97706":"#dc2626"}"></div></div>`:"—"}</td>
      <td>${p.startDate||"—"}</td>
      <td>${p.estEndDate||"—"}</td>
    </tr>`;
  }).join("");

  const riskHtml = risk && risk.total>0 ? `
    <h2>⚠ Risk Summary</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">
      ${[
        ["Overdue Projects", risk.overdue.length, "#dc2626"],
        ["Due Within 14 Days", risk.dueSoon.length, "#d97706"],
        ["Budget Risk", risk.overBudget.length, "#dc2626"],
        ["High Outstanding AR", risk.highAR.length, "#d97706"],
      ].map(([label,val,color])=>`
        <div style="border:1px solid #ddd;border-radius:8px;padding:10px 14px">
          <div style="font-size:20px;font-weight:800;color:${color}">${val}</div>
          <div style="font-size:11px;color:#666;font-weight:600">${label}</div>
        </div>`).join("")}
    </div>` : "";

  return `
    <h1>📊 PROJECT ANALYSIS — PORTFOLIO REPORT</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString()} · ${enriched.length} project${enriched.length!==1?"s":""}${fStat&&fStat!=="All"?` · Filter: ${fStat}`:""}${search?` · Search: "${search}"`:""}</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${formatSarCompact(totalPO)}</div><div class="kpi-lbl">Total PO Value</div></div>
      <div class="kpi"><div class="kpi-val">${formatSarCompact(totalInvoiced)}</div><div class="kpi-lbl">Total Invoiced</div></div>
      <div class="kpi"><div class="kpi-val">${formatSarCompact(totalCollected)}</div><div class="kpi-lbl">Total Collected</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Total Due</div></div>
      <div class="kpi"><div class="kpi-val">${enriched.filter(x=>x.status==="In Progress"||x.status==="Active").length}</div><div class="kpi-lbl">In Progress</div></div>
      <div class="kpi"><div class="kpi-val">${enriched.filter(x=>x.status==="Completed").length}</div><div class="kpi-lbl">Completed</div></div>
    </div>
    ${riskHtml}
    <h2>Top Projects by PO Value</h2>
    ${buildHtmlBars(topByValue, formatSarCompact)}
    <h2>Project Details</h2>
    <table>
      <thead><tr><th>Project</th><th>PO Number</th><th>Status</th><th>PO Value</th><th>Invoiced</th><th>Collected</th><th>Due</th><th>Progress</th><th>Start</th><th>End</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildProjectReportHTML(p) {
  const poValue = parseFloat(p.poValue)||0;
  const pct = poValue>0?Math.min(100,Math.round((p.totalInvoiced/poValue)*100)):0;
  const dl = getDaysLeft(p.estEndDate);
  const invRows = (p.invs||[]).map(inv=>{
    const collected = getInvoiceCollectedAmount(inv)||0;
    const remaining = getInvoiceRemainingAmount(inv)||0;
    return `<tr>
      <td>${getInvDate(inv)||"—"}</td>
      <td style="text-align:right">${formatSarCompact(collected+remaining)}</td>
      <td style="text-align:right">${formatSarCompact(collected)}</td>
      <td style="text-align:right;color:${remaining>0?"#dc2626":"#16a34a"}">${formatSarCompact(remaining)}</td>
    </tr>`;
  }).join("");

  return `
    <h1>📁 ${p.project || "Project"} — PROJECT REPORT</h1>
    <div class="meta">
      Generated ${new Date().toLocaleDateString()}${p.clientName?` · Client: ${p.clientName}`:""}${p.poNumber?` · PO: ${p.poNumber}`:""}
      · Status: ${p.status||"—"}${dl!==null?` · ${dl>=0?`${dl} days remaining`:`${Math.abs(dl)} days overdue`}`:""}
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${poValue?formatSarCompact(poValue):"—"}</div><div class="kpi-lbl">PO Value</div></div>
      <div class="kpi"><div class="kpi-val">${formatSarCompact(p.totalInvoiced)}</div><div class="kpi-lbl">Invoiced</div></div>
      <div class="kpi"><div class="kpi-val">${formatSarCompact(p.totalCollected)}</div><div class="kpi-lbl">Collected</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${p.totalDue>0?"#dc2626":"#16a34a"}">${formatSarCompact(p.totalDue)}</div><div class="kpi-lbl">Outstanding</div></div>
    </div>
    <h2>Invoiced Progress</h2>
    <div>${pct}%</div>
    <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${pct>=80?"#16a34a":pct>=50?"#d97706":"#dc2626"}"></div></div>
    <h2>Timeline</h2>
    <div class="meta">${p.startDate?fmtDate(p.startDate):"No start date"} → ${p.actualEndDate?fmtDate(p.actualEndDate)+" (actual)":p.estEndDate?fmtDate(p.estEndDate)+" (estimated)":"No end date"}</div>
    ${p.description ? `<h2>Description</h2><p>${p.description}</p>` : ""}
    <h2>Invoices (${(p.invs||[]).length})</h2>
    ${(p.invs||[]).length ? `<table>
      <thead><tr><th>Date</th><th style="text-align:right">Amount</th><th style="text-align:right">Collected</th><th style="text-align:right">Due</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>` : `<div class="meta">No invoices recorded yet.</div>`}
  `;
}

export function ReportsTab({ enriched, fStat, search, risk }) {
  const [selected, setSelected] = useState("");
  const selectedProj = enriched.find(p=>p.id===selected);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",boxShadow:T.shadow}}>
        <div style={{fontSize:14,fontWeight:800,color:T.text,marginBottom:6}}>📊 Portfolio Report</div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>Full portfolio summary with KPIs, risk flags, top projects, and detailed table — opens print dialog (Save as PDF).</div>
        <button onClick={()=>printPage("Project Analysis — Portfolio Report", buildPortfolioReportHTML(enriched, { fStat, search, risk }))}
          style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",color:"#000",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
          🖨 Generate Portfolio PDF
        </button>
      </div>

      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",boxShadow:T.shadow}}>
        <div style={{fontSize:14,fontWeight:800,color:T.text,marginBottom:6}}>📁 Single Project Report</div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>A focused report for one project — financials, timeline, invoices — ideal for sharing with a client or management.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <select value={selected} onChange={e=>setSelected(e.target.value)}
            style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 13px",fontSize:13,color:T.text,minWidth:220}}>
            <option value="">Select a project…</option>
            {enriched.map(p=><option key={p.id} value={p.id}>{p.project}</option>)}
          </select>
          <button disabled={!selectedProj} onClick={()=>selectedProj && printPage(`${selectedProj.project} — Project Report`, buildProjectReportHTML(selectedProj))}
            style={{background:selectedProj?`linear-gradient(135deg,${T.blue},#2563eb)`:T.border,border:"none",color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:800,cursor:selectedProj?"pointer":"not-allowed",opacity:selectedProj?1:0.6}}>
            🖨 Generate Project PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN WRAPPER — tab bar. Drop this around your existing Portfolio content.
════════════════════════════════════════════════════════════════════════════ */
export function ProjectAnalysisProNav({ tab, setTab, riskCount }) {
  const TABS = [
    { key:"portfolio", label:"📋 Portfolio" },
    { key:"analytics", label:"📈 Analytics" },
    { key:"timeline",  label:"🗓 Timeline" },
    { key:"budget",    label:"💰 Budget" },
    { key:"reports",   label:"🖨 Reports" },
  ];
  return (
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",borderBottom:`1px solid ${T.border}`,paddingBottom:10}}>
      {TABS.map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)}
          style={{
            background: tab===t.key ? T.blue : "transparent",
            color: tab===t.key ? "#fff" : T.textMuted,
            border: `1px solid ${tab===t.key ? T.blue : T.border}`,
            borderRadius:9, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
          }}>
          {t.label}
          {t.key==="portfolio" && riskCount>0 && (
            <span style={{background:T.red,color:"#fff",borderRadius:999,fontSize:10,fontWeight:800,padding:"1px 6px"}}>{riskCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
