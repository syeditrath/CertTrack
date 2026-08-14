import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme, live } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, PageHeader, Empty } from "./UI.jsx";

/* ─── Cost categories used throughout this page (breakdown bars, entry form,
   filter dropdown, chart colors). Edit this list to add/rename/re-color categories. ── */
const COST_CATS = [
  { id:"Labour",                icon:"👷", color:T.blue },
  { id:"Equipment",              icon:"🔧", color:T.purple },
  { id:"Materials",              icon:"📦", color:T.gold },
  { id:"Fuel",                   icon:"⛽", color:T.red },
  { id:"Transportation",         icon:"🚚", color:T.teal },
  { id:"Permits & Fees",         icon:"📄", color:T.green },
  { id:"Subcontractor",          icon:"🤝", color:T.blue },
  { id:"Maintenance & Repairs",  icon:"🛠️", color:T.purple },
  { id:"Other",                  icon:"◎",  color:T.textMuted },
];
const COST_CAT_MAP = COST_CATS.reduce((m,c)=>{ m[c.id]=c; return m; }, {});

function CostControlPage({data, setData, showToast, go, isAdmin}) {
  const [selProj, setSelProj] = useState(null);
  const [modal,   setModal]   = useState(null);
  const [filterCat, setFilterCat] = useState("All");

  const projects  = data.projects       || [];
  const analysis  = data.projectAnalysis|| [];
  const allCosts  = live(data.costControl);
  const invoiceDocs = live(data.projectDocs).filter(d=>d.subTab==="invoices");

  const saveEntry = (entry, mode) => {
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...(prev.costControl||[])];
        if (mode==="add") list.push({...entry, id:uid()});
        else { const i=list.findIndex(d=>d.id===entry.id); if(i>=0) list[i]=entry; }
        return {...prev, costControl:list};
      });
      showToast(mode==="add"?"Cost entry added":"Entry updated");
    },0);
  };

  const delEntry = id => {
    setData(prev=>({...prev, costControl:(prev.costControl||[]).map(e=>e.id===id?{...e,_deleted:true}:e)}));
    showToast("Deleted","del");
  };

  // ── Per-project P&L helper ──
  const getProjFinancials = (proj) => {
    const pa        = analysis.find(a=>a.project===proj);
    // Contract value: pull from work orders first (Finance > Work Orders / Agreements)
    const woDocs    = live(data.projectDocs).filter(d=>d.subTab==="workorders" && d.project===proj);
    const woValue   = woDocs.length ? Math.max(...woDocs.map(d=>parseFloat(d.amount)||0)) : 0;
    const poValue   = woValue || parseFloat(pa?.poValue) || 0;
    const invs        = invoiceDocs.filter(d=>d.project===proj);
    const advanceInvs = invs.filter(d=>getInvoiceStream(d)==="advance");
    const incomeInvs  = invs.filter(d=>getInvoiceStream(d)==="income");
    const advance     = advanceInvs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    const income      = incomeInvs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    const revenue     = advance + income;
    const advanceCollected = advanceInvs.reduce((s,d)=>s+getInvoiceCollectedAmount(d),0);
    const incomeCollected  = incomeInvs.reduce((s,d)=>s+getInvoiceCollectedAmount(d),0);
    const collected   = advanceCollected + incomeCollected;
    const costs       = allCosts.filter(c=>c.project===proj);
    const totalCost   = costs.reduce((s,c)=>s+(parseFloat(c.amount)||0),0);
    const margin      = revenue - totalCost;
    const marginPct   = revenue>0 ? Math.round((margin/revenue)*100) : null;
    return {poValue, revenue, advance, income, advanceCollected, incomeCollected, collected, costs, totalCost, margin, marginPct, pa};
  };

  // ── Project overview cards ──
  if (!selProj) {
    const allFinancials = projects.map(p=>getProjFinancials(pName(p)));
    const allMargin    = allFinancials.reduce((s,f)=>s+f.margin,0);
    const allRevenue   = allFinancials.reduce((s,f)=>s+f.revenue,0);
    const allAdvance   = allFinancials.reduce((s,f)=>s+f.advance,0);
    const allIncome    = allFinancials.reduce((s,f)=>s+f.income,0);
    const allCostTotal = allFinancials.reduce((s,f)=>s+f.totalCost,0);
    const overallPct   = allRevenue>0 ? Math.round((allMargin/allRevenue)*100) : null;

    return (
      <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
        {/* Header */}
        <div className="fade-up" style={{marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:32,color:T.text,display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:T.teal}}>⊕</span> COST CONTROL
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Budget vs actual · Gross margin · Cost breakdown per project</div>
        </div>

        {/* Portfolio summary strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:20}}>
          {[
            {label:"Total Advance",  v:formatSarCompact(allAdvance),   color:T.gold},
            {label:"Total Income",   v:formatSarCompact(allIncome),    color:T.green},
            {label:"Total Costs",    v:formatSarCompact(allCostTotal), color:T.red},
            {label:"Gross Margin",   v:formatSarCompact(allMargin),    color:allMargin>=0?T.green:T.red},
            {label:"Margin %",       v:overallPct!==null?`${overallPct}%`:"—", color:overallPct===null?T.textMuted:overallPct>=20?T.green:overallPct>=10?T.gold:T.red},
            {label:"Cost Entries",   v:allCosts.length,                color:T.purple},
          ].map((k,i)=>(
            <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",boxShadow:T.shadow,animationDelay:`${i*.04}s`}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(20px,2.5vw,34px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:500}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Project cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
          {projects.map((proj,i)=>{ proj=pName(proj);
            const {poValue,revenue,advance,income,collected,totalCost,margin,marginPct,costs} = getProjFinancials(proj);
            const costByCat = COST_CATS.map(c=>({
              ...c,
              total: costs.filter(e=>e.category===c.id).reduce((s,e)=>s+(parseFloat(e.amount)||0),0)
            })).filter(c=>c.total>0);
            const maxCat = Math.max(...costByCat.map(c=>c.total),1);
            return (
              <div key={proj} className="fade-up card-hover" onClick={()=>setSelProj(proj)}
                style={{background:T.card,border:`1px solid ${margin<0?T.red:T.border}`,borderRadius:18,padding:"20px",cursor:"pointer",animationDelay:`${i*.04}s`,boxShadow:T.shadow}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{costs.length} cost entr{costs.length===1?"y":"ies"}</div>
                  </div>
                  {marginPct!==null && (
                    <div style={{background:marginPct>=20?T.greenDim:marginPct>=0?T.goldDim:T.redDim,border:`1px solid ${marginPct>=20?T.green:marginPct>=0?T.gold:T.red}44`,borderRadius:10,padding:"6px 12px",textAlign:"center",flexShrink:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:marginPct>=20?T.green:marginPct>=0?T.gold:T.red,lineHeight:1}}>{marginPct}%</div>
                      <div style={{fontSize:9,fontWeight:700,color:marginPct>=20?T.green:marginPct>=0?T.gold:T.red,marginTop:2}}>MARGIN</div>
                    </div>
                  )}
                </div>

                {/* P&L mini table */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                  <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:9,padding:"8px 10px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:T.gold,lineHeight:1}}>{formatSarCompact(advance)}</div>
                    <div style={{fontSize:9,color:T.gold,marginTop:3,fontWeight:700}}>ADVANCE</div>
                  </div>
                  <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:9,padding:"8px 10px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(income)}</div>
                    <div style={{fontSize:9,color:T.green,marginTop:3,fontWeight:700}}>INCOME</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                  <div style={{background:T.redDim,border:`1px solid ${T.red}22`,borderRadius:9,padding:"8px 10px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:T.red,lineHeight:1}}>{formatSarCompact(totalCost)}</div>
                    <div style={{fontSize:9,color:T.red,marginTop:3,fontWeight:700}}>TOTAL COST</div>
                  </div>
                  <div style={{background:margin>=0?T.greenDim:T.redDim,border:`1px solid ${margin>=0?T.green:T.red}22`,borderRadius:9,padding:"8px 10px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,color:margin>=0?T.green:T.red,lineHeight:1}}>{formatSarCompact(Math.abs(margin))}</div>
                    <div style={{fontSize:9,color:margin>=0?T.green:T.red,marginTop:3,fontWeight:700}}>{margin>=0?"MARGIN":"LOSS"}</div>
                  </div>
                </div>

                {/* Mini cost bars by category */}
                {costByCat.length>0 && (
                  <div style={{display:"grid",gap:5}}>
                    {costByCat.slice(0,4).map(c=>(
                      <div key={c.id} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:10,color:T.textMuted,width:88,flexShrink:0,fontWeight:600}}>{c.id}</div>
                        <div style={{flex:1,height:5,background:T.border,borderRadius:999,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.round((c.total/maxCat)*100)}%`,background:c.color,borderRadius:999}}/>
                        </div>
                        <div style={{fontSize:10,color:T.textSub,minWidth:52,textAlign:"right"}}>{formatSarCompact(c.total)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{fontSize:12,color:T.teal,fontWeight:700,textAlign:"right",marginTop:12}}>Open Cost Detail →</div>
              </div>
            );
          })}
        </div>

        {projects.length===0 && (
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>⊕</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.textSub,marginBottom:8}}>NO PROJECTS</div>
            <div style={{fontSize:13,color:T.textMuted}}>Add projects via Manage Projects in the sidebar, then enter cost data here.</div>
          </div>
        )}
      </div>
    );
  }

  // ── Project detail view ──
  const {poValue, revenue, advance, income, advanceCollected, incomeCollected, collected, totalCost, margin, marginPct, costs, pa} = getProjFinancials(selProj);
  const filteredCosts = filterCat==="All" ? costs : costs.filter(c=>c.category===filterCat);

  // Cost by category
  const catBreakdown = COST_CATS.map(c=>({
    ...c, total: costs.filter(e=>e.category===c.id).reduce((s,e)=>s+(parseFloat(e.amount)||0),0),
    count: costs.filter(e=>e.category===c.id).length
  }));
  const maxCatTotal = Math.max(...catBreakdown.map(c=>c.total),1);

  // Budget vs actual: compare poValue budget allocation (user can set budget per category on project analysis)
  const budgetedTotal = costs.reduce((s,c)=>s+(parseFloat(c.budgeted)||0),0);

  // Monthly cost trend
  const monthlyMap = {};
  costs.forEach(c=>{
    if(!c.date) return;
    const ym = c.date.slice(0,7);
    monthlyMap[ym]=(monthlyMap[ym]||0)+(parseFloat(c.amount)||0);
  });
  const monthlyTrend = Object.entries(monthlyMap).sort(([a],[b])=>a.localeCompare(b));
  const maxMonthly = Math.max(...monthlyTrend.map(([,v])=>v),1);

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={()=>setSelProj(null)} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← All Projects</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selProj}</div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>
            {pa?.clientName&&<span>Client: {pa.clientName} · </span>}
            {pa?.poNumber&&<span>PO: {pa.poNumber} · </span>}
            {costs.length} cost {costs.length===1?"entry":"entries"}
          </div>
        </div>
        <button onClick={()=>setModal({mode:"add",entry:{project:selProj}})}
          style={{background:`linear-gradient(135deg,${T.teal},#0d9488)`,border:"none",color:"#fff",borderRadius:10,padding:"10px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:"1px"}}>
          + ADD COST ENTRY
        </button>
      </div>

      {/* P&L hero */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"24px 28px",marginBottom:16,boxShadow:T.shadow}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.textSub,marginBottom:16,letterSpacing:"1px"}}>PROFIT & LOSS SUMMARY</div>

        {/* Estimation Cost + Unbilled Progress editable row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:".5px",marginBottom:6}}>ESTIMATION COST (SAR)</div>
            <input
              type="number"
              defaultValue={pa?.estimationCost||""}
              placeholder="Enter total estimated project cost…"
              onBlur={e=>{
                const v=e.target.value;
                setData(prev=>({...prev,projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.project===selProj?{...x,estimationCost:v}:x)}));
                showToast("Estimation cost saved");
              }}
              style={{width:"100%",background:"transparent",border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(18px,2.2vw,26px)",color:T.gold,padding:0}}
            />
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:".5px",marginBottom:6}}>UNBILLED PROGRESS (% WORK DONE, NOT YET INVOICED)</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input
                type="number"
                min="0" max="100"
                defaultValue={pa?.unbilledProgress||""}
                placeholder="0"
                onBlur={e=>{
                  const v=Math.min(100,Math.max(0,parseFloat(e.target.value)||0));
                  e.target.value=v;
                  setData(prev=>({...prev,projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.project===selProj?{...x,unbilledProgress:v}:x)}));
                  showToast("Unbilled progress saved");
                }}
                style={{width:80,background:"transparent",border:"none",outline:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(18px,2.2vw,26px)",color:T.teal,padding:0}}
              />
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.teal}}>%</span>
              <div style={{flex:1,height:8,background:T.border,borderRadius:999,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pa?.unbilledProgress||0}%`,background:`linear-gradient(90deg,${T.teal},#0d9488)`,borderRadius:999,transition:"width .5s"}}/>
              </div>
            </div>
            {(pa?.unbilledProgress>0)&&<div style={{fontSize:11,color:T.textMuted,marginTop:6}}>
              {pa.unbilledProgress}% of work completed but not yet invoiced
              {revenue>0&&poValue>0&&<span style={{color:T.teal,fontWeight:700}}> · Est. unbilled value: {formatSarCompact((pa.unbilledProgress/100)*poValue)}</span>}
            </div>}
          </div>
        </div>

        {/* Revenue split: Advance + Income */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div className="fade-up" style={{background:T.bg,border:`1px solid ${T.gold}44`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:".5px",marginBottom:6}}>ADVANCE INVOICED</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(18px,2.2vw,28px)",fontWeight:800,color:T.gold,lineHeight:1}}>{formatSarCompact(advance)}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>Collected: <span style={{color:T.gold,fontWeight:700}}>{formatSarCompact(advanceCollected)}</span>
              {advance-advanceCollected>0&&<span style={{color:T.red}}> · Due: {formatSarCompact(advance-advanceCollected)}</span>}
            </div>
          </div>
          <div className="fade-up" style={{background:T.bg,border:`1px solid ${T.green}44`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:".5px",marginBottom:6}}>INCOME INVOICED</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(18px,2.2vw,28px)",fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(income)}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>Collected: <span style={{color:T.green,fontWeight:700}}>{formatSarCompact(incomeCollected)}</span>
              {income-incomeCollected>0&&<span style={{color:T.red}}> · Due: {formatSarCompact(income-incomeCollected)}</span>}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
          {[
            {label:"CONTRACT VALUE (PO)", v:poValue?formatSarCompact(poValue):"Set in Project Analysis", color:poValue?T.gold:T.textMuted},
            {label:"TOTAL REVENUE",       v:formatSarCompact(revenue),                                   color:T.green},
            {label:"TOTAL COLLECTED",     v:formatSarCompact(collected),                                 color:T.blue},
            {label:"TOTAL COSTS",         v:formatSarCompact(totalCost),                                 color:T.red},
            {label:"GROSS MARGIN",        v:formatSarCompact(Math.abs(margin)),                          color:margin>=0?T.green:T.red},
            {label:"MARGIN %",            v:marginPct!==null?`${marginPct}%`:"—",                       color:marginPct===null?T.textMuted:marginPct>=20?T.green:marginPct>=10?T.gold:T.red},
          ].map((k,i)=>(
            <div key={k.label} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",animationDelay:`${i*.04}s`}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(16px,2vw,24px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
              <div style={{fontSize:10,color:T.textMuted,marginTop:5,fontWeight:700,letterSpacing:".5px"}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue vs Cost bar */}
        {(revenue>0||totalCost>0) && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginBottom:6}}>
              <span>Cost as % of Revenue</span>
              <span style={{fontWeight:700,color:totalCost/Math.max(revenue,1)>1?T.red:T.green}}>
                {revenue>0?Math.round((totalCost/revenue)*100):0}%
              </span>
            </div>
            <div style={{height:10,background:T.border,borderRadius:999,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",height:"100%",width:`${Math.min(100,revenue>0?Math.round((totalCost/revenue)*100):0)}%`,background:totalCost>revenue?`linear-gradient(90deg,${T.red},${T.red}bb)`:`linear-gradient(90deg,${T.teal},${T.teal}bb)`,borderRadius:999,transition:"width 1s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginTop:4}}>
              <span style={{color:T.green}}>Revenue: {formatSarCompact(revenue)}</span>
              <span style={{color:margin>=0?T.green:T.red}}>{margin>=0?"Profit":"Loss"}: {formatSarCompact(Math.abs(margin))}</span>
              <span style={{color:T.red}}>Costs: {formatSarCompact(totalCost)}</span>
            </div>
          </div>
        )}
      </div>


      {/* ── Estimated vs Actual Cost Chart ─────────────────────────── */}
      {(() => {
        const estimationCost = parseFloat(pa?.estimationCost) || 0;
        const chartCats = catBreakdown.map(c => ({
          ...c,
          budgeted: costs.filter(e=>e.category===c.id).reduce((s,e)=>s+(parseFloat(e.budgeted)||0),0),
        }));
        const hasAny = estimationCost > 0 || totalCost > 0;
        if (!hasAny) return null;

        // Bar chart: estimated vs actual per category + totals
        const maxVal = Math.max(estimationCost, totalCost, ...chartCats.map(c=>Math.max(c.budgeted,c.total)), 1);
        const barH = 28;
        const labelW = 110;
        const chartW = 420;
        const allRows = [
          { id:"TOTAL", label:"Total Project", estimated: estimationCost, actual: totalCost, color: T.teal, isTotal: true },
          ...chartCats.filter(c=>c.budgeted>0||c.total>0).map(c=>({ id:c.id, label:c.id, estimated:c.budgeted, actual:c.total, color:c.color, isTotal:false })),
        ];
        const rowH = barH * 2 + 14;
        const svgH = allRows.length * rowH + 48;

        return (
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 24px",marginBottom:14,boxShadow:T.shadow}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:4}}>ESTIMATED vs ACTUAL COST</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:18}}>
              Estimated from the project estimation cost &amp; per-entry budgeted amounts · Actual from recorded cost entries
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:20,marginBottom:16,fontSize:12}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:14,height:14,borderRadius:3,background:T.teal,opacity:.5}}/><span style={{color:T.textSub,fontWeight:600}}>Estimated</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:14,height:14,borderRadius:3,background:T.red}}/><span style={{color:T.textSub,fontWeight:600}}>Actual</span></div>
              {estimationCost > 0 && totalCost > estimationCost && (
                <div style={{display:"flex",alignItems:"center",gap:6,color:T.red,fontWeight:700}}>⚠ Over budget by {formatSarCompact(totalCost - estimationCost)}</div>
              )}
              {estimationCost > 0 && totalCost <= estimationCost && totalCost > 0 && (
                <div style={{display:"flex",alignItems:"center",gap:6,color:T.green,fontWeight:700}}>✓ Under budget by {formatSarCompact(estimationCost - totalCost)}</div>
              )}
            </div>

            {/* SVG Chart */}
            <div style={{overflowX:"auto"}}>
              <svg width="100%" viewBox={`0 0 ${labelW + chartW + 130} ${svgH}`} style={{fontFamily:"'Barlow Condensed',sans-serif",minWidth:520}}>
                {/* Grid lines */}
                {[0,.25,.5,.75,1].map(pct=>(
                  <g key={pct}>
                    <line x1={labelW + chartW*pct} y1={0} x2={labelW + chartW*pct} y2={svgH-30}
                      stroke={T.border} strokeWidth="1" strokeDasharray={pct===0?"none":"4 3"}/>
                    <text x={labelW + chartW*pct} y={svgH-14} textAnchor="middle" fontSize="9" fill={T.textMuted}>
                      {formatSarCompact(maxVal*pct)}
                    </text>
                  </g>
                ))}

                {allRows.map((row, ri) => {
                  const y = ri * rowH + 10;
                  const estPct  = Math.min(row.estimated / maxVal, 1);
                  const actPct  = Math.min(row.actual    / maxVal, 1);
                  const over    = row.actual > row.estimated && row.estimated > 0;
                  const actColor = over ? T.red : (row.actual > 0 && row.estimated > 0 && row.actual <= row.estimated) ? T.green : T.red;
                  return (
                    <g key={row.id}>
                      {/* Row label */}
                      <text x={labelW-8} y={y + barH - 4} textAnchor="end" fontSize={row.isTotal?"12":"11"}
                        fill={row.isTotal ? T.text : T.textSub} fontWeight={row.isTotal?"800":"600"}>
                        {row.label}
                      </text>

                      {/* Separator for total row */}
                      {row.isTotal && ri > 0 && (
                        <line x1={0} y1={y-6} x2={labelW+chartW+120} y2={y-6} stroke={T.border} strokeWidth="1"/>
                      )}

                      {/* Estimated bar */}
                      <rect x={labelW} y={y} width={Math.max(estPct * chartW, row.estimated>0?2:0)} height={barH-2}
                        rx="4" fill={row.color} opacity="0.35"/>
                      {row.estimated > 0 && (
                        <text x={labelW + Math.max(estPct*chartW,2) + 6} y={y + barH/2 + 4}
                          fontSize="10" fill={T.textMuted}>
                          {formatSarCompact(row.estimated)}
                        </text>
                      )}

                      {/* Actual bar */}
                      <rect x={labelW} y={y + barH} width={Math.max(actPct * chartW, row.actual>0?2:0)} height={barH-2}
                        rx="4" fill={actColor} opacity="0.85"/>
                      {row.actual > 0 && (
                        <text x={labelW + Math.max(actPct*chartW,2) + 6} y={y + barH*2 - 2}
                          fontSize="10" fontWeight="700" fill={actColor}>
                          {formatSarCompact(row.actual)}
                        </text>
                      )}
                      {row.actual === 0 && (
                        <text x={labelW + 6} y={y + barH*2 - 2} fontSize="10" fill={T.textMuted}>No actual cost yet</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Summary callout */}
            {estimationCost > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:16}}>
                {[
                  {label:"ESTIMATED",  v:formatSarCompact(estimationCost), color:T.teal},
                  {label:"ACTUAL",     v:formatSarCompact(totalCost),      color:totalCost>estimationCost?T.red:T.green},
                  {label:"VARIANCE",   v:(totalCost>estimationCost?"+":"-")+formatSarCompact(Math.abs(totalCost-estimationCost)), color:totalCost>estimationCost?T.red:T.green},
                  {label:"USED %",     v:estimationCost>0?`${Math.round((totalCost/estimationCost)*100)}%`:"—", color:totalCost>estimationCost?T.red:T.gold},
                ].map(k=>(
                  <div key={k.label} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:k.color}}>{k.v}</div>
                    <div style={{fontSize:10,color:T.textMuted,marginTop:3,fontWeight:700,letterSpacing:".5px"}}>{k.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Cost breakdown by category */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginBottom:14}}>
        <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 22px",boxShadow:T.shadow}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:16}}>COST BY CATEGORY</div>
          {catBreakdown.filter(c=>c.total>0).length===0
            ?<div style={{fontSize:13,color:T.textMuted,textAlign:"center",padding:"20px"}}>No costs recorded yet</div>
            :<div style={{display:"grid",gap:10}}>
              {catBreakdown.filter(c=>c.total>0).map(c=>(
                <div key={c.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:c.color,fontSize:14}}>{c.icon}</span>
                      <span style={{fontSize:13,color:T.text,fontWeight:600}}>{c.id}</span>
                      <span style={{fontSize:11,color:T.textMuted}}>({c.count})</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,color:T.textMuted}}>{revenue>0?Math.round((c.total/revenue)*100):0}% of rev</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:c.color}}>{formatSarCompact(c.total)}</span>
                    </div>
                  </div>
                  <div style={{height:6,background:T.border,borderRadius:999,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.round((c.total/maxCatTotal)*100)}%`,background:c.color,borderRadius:999,transition:"width 1s"}}/>
                  </div>
                </div>
              ))}
              <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:700,color:T.textSub}}>TOTAL</span>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.red}}>{formatSarCompact(totalCost)}</span>
              </div>
            </div>
          }
        </div>

        {/* Monthly spend trend */}
        {monthlyTrend.length>0 && (
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 22px",boxShadow:T.shadow}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:16}}>MONTHLY SPEND</div>
            <div style={{display:"grid",gap:6}}>
              {monthlyTrend.map(([ym,v])=>{
                const [yr,mo]=ym.split("-");
                const label=new Date(parseInt(yr),parseInt(mo)-1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"});
                return (
                  <div key={ym} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:11,color:T.textMuted,width:48,flexShrink:0}}>{label}</div>
                    <div style={{flex:1,height:18,background:T.border,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.round((v/maxMonthly)*100)}%`,background:`linear-gradient(90deg,${T.teal},${T.teal}bb)`,borderRadius:4,display:"flex",alignItems:"center"}}>
                        {v/maxMonthly>0.35&&<span style={{fontSize:10,color:"#fff",fontWeight:700,paddingLeft:6}}>{formatSarCompact(v)}</span>}
                      </div>
                    </div>
                    {v/maxMonthly<=0.35&&<span style={{fontSize:11,color:T.textMuted,minWidth:54,textAlign:"right"}}>{formatSarCompact(v)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cost entries list */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 22px",boxShadow:T.shadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>COST ENTRIES</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{filteredCosts.length} {filterCat!=="All"?filterCat+" ":""}entr{filteredCosts.length===1?"y":"ies"}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
              style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
              <option value="All">All Categories</option>
              {COST_CATS.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
            <button onClick={()=>setModal({mode:"add",entry:{project:selProj}})}
              style={{background:T.tealDim,border:`1px solid ${T.teal}44`,color:T.teal,borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Entry</button>
          </div>
        </div>

        {filteredCosts.length===0
          ?<div style={{textAlign:"center",padding:"30px",background:T.bg,borderRadius:12,border:`1px dashed ${T.border}`}}>
            <div style={{fontSize:32,marginBottom:10}}>⊕</div>
            <div style={{fontSize:14,color:T.textMuted,fontWeight:600}}>No cost entries yet</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>Click "+ Add Cost Entry" to record Labour, Equipment, Materials and more</div>
          </div>
          :<div style={{display:"grid",gap:8}}>
            {filteredCosts.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map((entry,i)=>{
              const cat = COST_CAT_MAP[entry.category]||COST_CAT_MAP["Other"];
              return (
                <div key={entry.id} className="fade-up"
                  style={{background:T.bg,border:`1px solid ${T.border}`,borderLeft:`4px solid ${cat.color}`,borderRadius:12,padding:"14px 16px",animationDelay:`${i*.02}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{entry.description||"—"}</span>
                      <span style={{background:`${cat.color}22`,color:cat.color,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{cat.icon} {cat.id}</span>
                      {entry.date&&<span style={{fontSize:11,color:T.textMuted}}>{fmtDate(entry.date)}</span>}
                      {entry.refNo&&<span style={{fontSize:11,color:T.textMuted}}>Ref: {entry.refNo}</span>}
                    </div>
                    {entry.notes&&<div style={{fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{entry.notes}</div>}
                    {entry.budgeted&&<div style={{fontSize:11,color:T.textMuted,marginTop:3}}>Budgeted: {formatSarCompact(parseFloat(entry.budgeted)||0)} · Variance: <span style={{color:parseFloat(entry.amount)>parseFloat(entry.budgeted)?T.red:T.green,fontWeight:700}}>{formatSarCompact(Math.abs((parseFloat(entry.amount)||0)-(parseFloat(entry.budgeted)||0)))}</span></div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.red}}>
                      {formatSarCompact(parseFloat(entry.amount)||0)}
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",entry})}>✎</ABtn>
                      {isAdmin && <ABtn color={T.red}  onClick={()=>delEntry(entry.id)}>✕</ABtn>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      {modal && <CostEntryModal mode={modal.mode} entry={modal.entry} projects={projects} onClose={()=>setModal(null)} onSave={saveEntry}/>}
    </div>
  );
}

function CostEntryModal({mode, entry, projects, onClose, onSave}) {
  const [f, setF] = useState(entry||{});
  const set = k => v => setF(p=>({...p,[k]:v}));
  const budgeted = parseFloat(f.budgeted)||0;
  const actual   = parseFloat(f.amount)||0;
  const variance = actual - budgeted;
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} COST ENTRY`} color={T.teal} onClose={onClose}
      onSave={()=>{ if(!f.description){alert("Description required");return;} if(!f.amount){alert("Amount required");return;} onSave(f,mode); }}>
      <FieldRow label="Description *"><FInput value={f.description||""} onChange={set("description")} color={T.teal}/></FieldRow>
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.teal}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Category *">
        <FSelect value={f.category||""} onChange={set("category")} color={T.teal}>
          <option value="">Select category…</option>
          {COST_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Actual Amount (SAR) *"><FInput type="number" value={f.amount||""} onChange={set("amount")} color={T.teal}/></FieldRow>
      <FieldRow label="Budgeted Amount (SAR)">
        <div>
          <FInput type="number" value={f.budgeted||""} onChange={set("budgeted")} color={T.gold}/>
          {budgeted>0&&actual>0&&<div style={{fontSize:11,marginTop:4,color:variance>0?T.red:T.green,fontWeight:600}}>
            {variance>0?`▲ ${formatSarCompact(variance)} over budget`:`▼ ${formatSarCompact(Math.abs(variance))} under budget`}
          </div>}
        </div>
      </FieldRow>
      <FieldRow label="Date"><FInput type="date" value={f.date||""} onChange={set("date")} color={T.teal}/></FieldRow>
      <FieldRow label="Reference No."><FInput value={f.refNo||""} onChange={set("refNo")} color={T.teal}/></FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.teal}/></FieldRow>
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FINANCE LOGIN PAGE
   Shown when user navigates to Finance but hasn't authenticated yet.
════════════════════════════════════════════════════════════════════════════ */

export { CostControlPage };
