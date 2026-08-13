import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme, live } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, Btn, Chip, Tag, ABtn, Overlay, PageHeader, InvoiceMetricCard } from "./UI.jsx";
import { AlertRow } from "./FinancePage.jsx";

function Dashboard({ data, alerts, go, onDeepLink }) {
  /* ── tombstone-filtered source arrays ── */
  const scorpionDocs = live(data.scorpionDocs);
  const manpower      = live(data.manpower);
  const equipment     = live(data.equipment);
  const projectDocs   = live(data.projectDocs);

  /* ── computed stats ── */
  const scorpionExp = scorpionDocs.filter(d=>{ const x=daysUntil(d.expiryDate); return x!==null&&x<=90; }).length;
  const scorpionExp30 = scorpionDocs.filter(d=>{ const x=daysUntil(d.expiryDate); return x!==null&&x<=30; }).length;
  const mpPeople = manpower.length;
  const mpCats   = data.manpowerCats.length;
  const mpDocAlerts = manpower.reduce((n,p)=>{
    const ds=[p.passportExpiry,p.visaExpiry,p.iqamaExpiry,p.muqeemExpiry,...live(p.certs).map(c=>c.expiryDate)];
    return n + ds.filter(d=>{ const x=daysUntil(d); return x!==null&&x<=90; }).length;
  },0);
  const eqTotal  = equipment.length;
  const eqActive = equipment.filter(e=>e.status==="Active").length;
  const eqMaint  = equipment.filter(e=>e.status==="Under Maintenance").length;
  const eqExp    = equipment.reduce((n,e)=>{
    const ds=[...live(e.certifications).map(c=>c.expiryDate),...live(e.insurance).map(c=>c.expiryDate),...live(e.permits).map(c=>c.expiryDate)];
    return n + ds.filter(d=>{ const x=daysUntil(d); return x!==null&&x<=90; }).length;
  },0);
  const totalAlerts  = alerts.length;
  const overdueCount = alerts.filter(a=>a.days<0).length;
  const expiring30   = alerts.filter(a=>a.days>=0&&a.days<=30).length;
  const allTracked = [
    ...scorpionDocs.filter(d=>d.expiryDate).map(d=>daysUntil(d.expiryDate)),
    ...manpower.flatMap(p=>[p.passportExpiry,p.visaExpiry,p.iqamaExpiry,p.muqeemExpiry,...live(p.certs).map(c=>c.expiryDate)].filter(Boolean).map(daysUntil)),
    ...equipment.flatMap(e=>[...live(e.certifications),...live(e.insurance),...live(e.permits)].map(r=>daysUntil(r.expiryDate))),
  ];
  const validCount = allTracked.filter(d=>d!==null&&d>0).length;
  const pct = allTracked.length ? Math.round(validCount/allTracked.length*100) : 100;
  const expired  = alerts.filter(a=>a.days<0).sort((a,b)=>a.days-b.days);
  const expiring = alerts.filter(a=>a.days>=0).sort((a,b)=>a.days-b.days);
  const invoiceDocs = projectDocs.filter(d => d.subTab === "invoices");
  const [alertModal, setAlertModal] = useState(null);

  const handleAlertClick = (a) => {
    setAlertModal(null);
    if (onDeepLink) onDeepLink(a.page, a.id);
    else go(a.page);
  };

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>

      {/* ── Alert drill-down modal ── */}
      {alertModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setAlertModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${alertModal==="overdue"?T.red:T.gold}55`,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:560,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${alertModal==="overdue"?T.red:T.gold},transparent)`,borderRadius:"20px 20px 0 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:alertModal==="overdue"?T.red:T.gold}}>
                  {alertModal==="overdue"?"🔴 OVERDUE ITEMS":"🟡 DUE IN 30 DAYS"}
                </div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>
                  {alertModal==="overdue"
                    ? `${expired.length} item${expired.length!==1?"s":""} past expiry — click any to open directly`
                    : `${alerts.filter(a=>a.days>=0&&a.days<=30).length} item${alerts.filter(a=>a.days>=0&&a.days<=30).length!==1?"s":""} expiring within 30 days`}
                </div>
              </div>
              <button onClick={()=>setAlertModal(null)} style={{background:"none",border:"none",color:T.textMuted,fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"grid",gap:8}}>
              {(alertModal==="overdue"
                ? expired
                : alerts.filter(a=>a.days>=0&&a.days<=30).sort((a,b)=>a.days-b.days)
              ).map((a,i)=>(
                <button key={i} onClick={()=>handleAlertClick(a)}
                  style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,textAlign:"left",cursor:"pointer",width:"100%",transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=alertModal==="overdue"?T.red:T.gold}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{width:52,flexShrink:0,textAlign:"center"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:a.days<0?T.red:a.days<=7?T.red:T.gold,lineHeight:1}}>
                      {a.days<0?Math.abs(a.days):a.days}
                    </div>
                    <div style={{fontSize:9,fontWeight:700,color:a.days<0?T.red:T.gold,marginTop:2}}>{a.days<0?"OVERDUE":"DAYS LEFT"}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.label}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{a.src}</div>
                  </div>
                  <div style={{fontSize:11,color:T.blue,fontWeight:700,flexShrink:0}}>
                    {{scorpion:"Company Docs",manpower:"Manpower",equipment:"Equipment",projects:"Project Docs"}[a.page]||a.page} →
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Top KPI strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        {[
          {label:"Total Alerts",    v:totalAlerts,  color:totalAlerts>0?T.red:T.green,     icon:"▲", click:null},
          {label:"Overdue",         v:overdueCount, color:overdueCount>0?T.red:T.textMuted, icon:"✕", click:overdueCount>0?()=>setAlertModal("overdue"):null},
          {label:"Due in 30 Days",  v:expiring30,   color:expiring30>0?T.gold:T.textMuted,  icon:"⏱", click:expiring30>0?()=>setAlertModal("expiring30"):null},
          {label:"Compliance",      v:`${pct}%`,    color:pct>=80?T.green:pct>=60?T.gold:T.red, icon:"◎", click:null},
          {label:"People",          v:mpPeople,     color:T.green, icon:"◈", click:()=>go("manpower")},
          {label:"Equipment Assets",v:eqTotal,      color:T.gold,  icon:"◎", click:()=>go("equipment")},
        ].map((k,i)=>(
          <div key={k.label} className="fade-up"
            onClick={k.click||undefined}
            style={{background:T.card,border:`1px solid ${k.click?"transparent":T.border}`,borderRadius:12,boxShadow:"0 1px 6px rgba(26,10,0,0.06),0 0 0 1px rgba(232,213,183,0.4)",padding:"16px 18px",animationDelay:`${i*.05}s`,position:"relative",overflow:"hidden",cursor:k.click?"pointer":"default",transition:"border-color .15s, transform .15s",outline:"none"}}
            onMouseEnter={e=>{ if(k.click){ e.currentTarget.style.borderColor=k.color; e.currentTarget.style.transform="translateY(-2px)"; }}}
            onMouseLeave={e=>{ if(k.click){ e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.transform="none"; }}}>
            <div style={{position:"absolute",top:10,right:14,fontSize:26,color:k.color,opacity:.08,fontWeight:800}}>{k.icon}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(28px,3vw,42px)",fontWeight:800,color:k.color,lineHeight:1,animation:"countUp 0.6s ease both"}}>{k.v}</div>
            <div style={{fontSize:12,color:T.textSub,marginTop:5,fontWeight:500}}>{k.label}</div>
            {k.click&&<div style={{fontSize:10,color:k.color,marginTop:4,fontWeight:700,opacity:.7}}>Click to view →</div>}
          </div>
        ))}
      </div>

      {/* ── Compliance bar ── */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"16px 20px",marginBottom:18,animationDelay:".3s"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textSub,letterSpacing:".5px"}}>OVERALL COMPLIANCE</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(18px,2vw,26px)",color:pct>=80?T.green:pct>=60?T.gold:T.red}}>{pct}%</span>
        </div>
        <div style={{height:8,background:T.border,borderRadius:999}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:999,transition:"width 1.2s cubic-bezier(0.22,1,0.36,1)",background:pct>=80?`linear-gradient(90deg,${T.green},#059669,${T.green})`:pct>=60?`linear-gradient(90deg,${T.gold},#d97706,${T.gold})`:`linear-gradient(90deg,${T.red},#dc2626,${T.red})`,backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:T.textSub}}>
          <span>{validCount} valid of {allTracked.length} tracked items</span>
          <span>{overdueCount>0?`${overdueCount} overdue`:"No overdue items"}</span>
        </div>
      </div>

      {/* ── Section cards ── */}
      <div style={{display:"grid",gap:18,marginBottom:18}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
          <DashboardMiniCard title="SCORPION DOCUMENTS" sub="CR, insurance, licenses, contracts" icon="◉" color={T.blue}
            stats={[{label:"Total Docs",value:scorpionDocs.length},{label:"Expiring",value:scorpionExp},{label:"Due in 30d",value:scorpionExp30},{label:"Categories",value:(data.scorpionDocCats||[]).length}]}
            actionLabel="Open Documents →" onClick={()=>go("scorpion")}/>
          <DashboardMiniCard title="PROJECT DOCS" sub="Invoices, completion certs & work orders" icon="◆" color={T.teal}
            stats={[{label:"Total",value:projectDocs.length},{label:"Invoices",value:invoiceDocs.length},{label:"Projects",value:(data.projects||[]).length},{label:"Docs per project",value:(data.projects||[]).length>0?Math.round(projectDocs.length/(data.projects||[]).length):0}]}
            actionLabel="Open Project Docs →" onClick={()=>go("projects")}/>
          <DashboardMiniCard title="MANPOWER" sub="Staff, documents & certifications" icon="◈" color={T.green}
            stats={[{label:"People",value:mpPeople},{label:"Categories",value:mpCats},{label:"Doc Alerts",value:mpDocAlerts},{label:"Certs",value:manpower.reduce((n,p)=>n+live(p.certs).length,0)}]}
            footer={(data.manpowerCats||[]).slice(0,4).map(c=>`${c} (${manpower.filter(p=>p.category===c).length})`).join("   •   ")}
            actionLabel="Open Manpower →" onClick={()=>go("manpower")}/>
          <DashboardMiniCard title="EQUIPMENT" sub="Assets, certs, invoices & permits" icon="◎" color={T.gold}
            stats={[{label:"Total Assets",value:eqTotal},{label:"Active",value:eqActive},{label:"Maintenance",value:eqMaint},{label:"Exp. Alerts",value:eqExp}]}
            footer={`Certs: ${equipment.reduce((n,e)=>n+live(e.certifications).length,0)}   •   Invoices: ${equipment.reduce((n,e)=>n+live(e.invoices).length,0)}   •   Insurance: ${equipment.reduce((n,e)=>n+live(e.insurance).length,0)}   •   Permits: ${equipment.reduce((n,e)=>n+live(e.permits).length,0)}`}
            actionLabel="Open Equipment →" onClick={()=>go("equipment")}/>
          <div className="fade-up card-hover" onClick={()=>go("finance")}
            style={{background:`linear-gradient(135deg,${T.card},${T.card2})`,border:`1px solid ${T.gold}44`,borderRadius:18,boxShadow:T.shadow,padding:"18px 18px 16px",minHeight:230,display:"flex",flexDirection:"column",cursor:"pointer",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at top right,${T.goldDim},transparent 60%)`,pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,position:"relative",zIndex:1}}>
              <div style={{width:42,height:42,borderRadius:12,background:T.goldDim,color:T.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800}}>$</div>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text,lineHeight:1}}>FINANCE</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>Invoices, work orders, collections & receivables</div>
              </div>
            </div>
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,position:"relative",zIndex:1}}>
              <div style={{fontSize:38}}>🔒</div>
              <div style={{fontSize:13,color:T.textMuted,textAlign:"center"}}>Finance access required</div>
              <div style={{fontSize:12,color:T.gold,fontWeight:700}}>Click to unlock →</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts split into 2 columns ── */}
      {alerts.length>0 ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}}>
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"18px 20px",animationDelay:".55s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:18,borderRadius:2,background:T.red}}/>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.red,letterSpacing:".5px"}}>OVERDUE</span>
              <span style={{background:T.redDim,color:T.red,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{expired.length}</span>
            </div>
            {expired.length===0
              ?<div style={{textAlign:"center",padding:"20px",color:T.textMuted,fontSize:13}}>✓ Nothing overdue</div>
              :<div style={{display:"grid",gap:7}}>
                {expired.slice(0,8).map((a,i)=><AlertRow key={i} a={a} onClick={()=>{ onDeepLink(a.page, a.id); }}/>)}
                {expired.length>8&&<div style={{fontSize:12,color:T.textSub,textAlign:"center",paddingTop:4}}>+{expired.length-8} more — check Alerts page</div>}
              </div>
            }
          </div>
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"18px 20px",animationDelay:".62s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:18,borderRadius:2,background:T.gold}}/>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.gold,letterSpacing:".5px"}}>EXPIRING SOON</span>
              <span style={{background:T.goldDim,color:T.gold,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{expiring.length}</span>
            </div>
            {expiring.length===0
              ?<div style={{textAlign:"center",padding:"20px",color:T.textMuted,fontSize:13}}>✓ Nothing expiring soon</div>
              :<div style={{display:"grid",gap:7}}>
                {expiring.slice(0,8).map((a,i)=><AlertRow key={i} a={a} onClick={()=>{ onDeepLink(a.page, a.id); }}/>)}
                {expiring.length>8&&<div style={{fontSize:12,color:T.textSub,textAlign:"center",paddingTop:4}}>+{expiring.length-8} more</div>}
              </div>
            }
          </div>
        </div>
      ) : (
        <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"40px 20px",textAlign:"center",animationDelay:".55s"}}>
          <div style={{fontSize:44,marginBottom:12}}>✓</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.green,marginBottom:6}}>ALL CLEAR</div>
          <div style={{fontSize:13,color:T.textMuted}}>No expiring or overdue items — everything is up to date.</div>
        </div>
      )}
    </div>
  );
}

function DashboardMiniCard({ title, sub, icon, color, stats, actionLabel, onClick, footer }) {
  return (
    <div
      className="fade-up card-hover"
      onClick={onClick}
      style={{
        background:T.card,
        border:`1px solid ${T.border}`,
        borderRadius:18,
        boxShadow:T.shadow,
        padding:"18px 18px 16px",
        minHeight:230,
        display:"flex",
        flexDirection:"column",
        cursor:"pointer",
      }}
    >
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{width:42,height:42,borderRadius:12,background:`${color}22`,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800}}>
          {icon}
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text,lineHeight:1}}>{title}</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{sub}</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0,1fr))",gap:10,marginBottom:14}}>
        {stats.map((s) => (
          <div key={s.label} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 12px 10px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color}}>{s.value}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {footer && (
        <div style={{fontSize:11,color:T.textMuted,lineHeight:1.5,marginBottom:14}}>{footer}</div>
      )}

      <div style={{marginTop:"auto",display:"flex",justifyContent:"flex-end"}}>
        <button onClick={e=>{e.stopPropagation(); onClick?.();}} style={{background:"transparent",border:"none",color,fontSize:13,fontWeight:700,cursor:"pointer"}}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   NOTIFICATION SETTINGS MODAL
════════════════════════════════════════════════════════════════════════════ */
function NotificationSettingsModal({ settings, allExpiries, sending, testResult, onSave, onClose, onTest }) {
  const [form, setForm]         = useState({ ...settings, emails: settings.emails || (settings.email ? [settings.email] : []), maintEmails: settings.maintEmails || [] });
  const [newEmail,     setNewEmail]     = useState("");
  const [newMaintEmail,setNewMaintEmail] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    if (form.emails.includes(e)) { setNewEmail(""); return; }
    set("emails", [...form.emails, e]);
    setNewEmail("");
  };
  const removeEmail = e => set("emails", form.emails.filter(x => x !== e));

  const threshold     = Number(form.thresholdDays) || 90;
  const previewAlerts = allExpiries.filter(a => a.days <= threshold);
  const overdue       = previewAlerts.filter(a => a.days < 0);
  const expiring      = previewAlerts.filter(a => a.days >= 0);

  // Group by source category
  const grouped = {};
  previewAlerts.forEach(a => {
    const cat = a.src || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  const hasRecipients = form.emails.length > 0;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.gold}55`,borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:580,boxShadow:`0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px ${T.gold}22`,position:"relative",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${T.gold},transparent)`,borderRadius:"20px 20px 0 0"}}/>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,display:"flex",alignItems:"center",gap:10}}>🔔 EMAIL NOTIFICATIONS</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Daily alerts for expiring & overdue certifications</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textMuted,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>

        {/* Enable toggle */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:18}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:T.text}}>Enable Daily Alerts</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>One email per day, automatically sent on first login</div>
          </div>
          <button onClick={() => set("enabled", !form.enabled)}
            style={{width:48,height:26,borderRadius:999,border:"none",cursor:"pointer",background:form.enabled?T.gold:T.border,transition:"background .2s",position:"relative",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:form.enabled?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
          </button>
        </div>

        {/* Recipients */}
        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8,letterSpacing:"1px"}}>RECIPIENTS ({form.emails.length})</label>
          {/* Existing recipients */}
          {form.emails.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {form.emails.map(e => (
                <div key={e} style={{display:"flex",alignItems:"center",gap:6,background:T.goldDim,border:`1px solid ${T.gold}44`,borderRadius:8,padding:"5px 10px"}}>
                  <span style={{fontSize:13,color:T.text,fontWeight:500}}>✉ {e}</span>
                  <button onClick={() => removeEmail(e)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
          {/* Add new email */}
          <div style={{display:"flex",gap:8}}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addEmail()}
              placeholder="Add email address…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e => e.target.style.borderColor = T.gold}
              onBlur={e => e.target.style.borderColor = T.border}
            />
            <button onClick={addEmail}
              style={{background:T.goldDim,border:`1px solid ${T.gold}55`,borderRadius:10,padding:"10px 16px",color:T.gold,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              + Add
            </button>
          </div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>Press Enter or click Add · each recipient gets a separate email</div>
        </div>

        {/* ── Maintenance Ticket Recipients ── */}
        <div style={{marginBottom:18,background:`${T.gold}08`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:16}}>🛠</span>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:T.text}}>Maintenance Ticket Alerts</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>These recipients get an email immediately when a new maintenance ticket is raised</div>
            </div>
          </div>
          {form.maintEmails.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {form.maintEmails.map(e => (
                <div key={e} style={{display:"flex",alignItems:"center",gap:6,background:T.goldDim,border:`1px solid ${T.gold}44`,borderRadius:8,padding:"5px 10px"}}>
                  <span style={{fontSize:13,color:T.text,fontWeight:500}}>✉ {e}</span>
                  <button onClick={()=>set("maintEmails",form.maintEmails.filter(x=>x!==e))} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <input type="email" value={newMaintEmail} onChange={e=>setNewMaintEmail(e.target.value)}
              onKeyDown={e=>{ if(e.key!=="Enter") return; const v=newMaintEmail.trim().toLowerCase(); if(!v||!v.includes("@")||form.maintEmails.includes(v)) return; set("maintEmails",[...form.maintEmails,v]); setNewMaintEmail(""); }}
              placeholder="Add maintenance alert recipient…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.text,outline:"none"}}
              onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button onClick={()=>{ const v=newMaintEmail.trim().toLowerCase(); if(!v||!v.includes("@")||form.maintEmails.includes(v)) return; set("maintEmails",[...form.maintEmails,v]); setNewMaintEmail(""); }}
              style={{background:T.goldDim,border:`1px solid ${T.gold}55`,borderRadius:10,padding:"10px 16px",color:T.gold,fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add</button>
          </div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:5}}>Press Enter or click Add · separate from expiry alert recipients</div>
        </div>

        {/* Threshold */}
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:"1px"}}>ALERT THRESHOLD</label>
          <select value={form.thresholdDays} onChange={e => set("thresholdDays", e.target.value)}
            style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",fontSize:14,color:T.text,outline:"none",colorScheme:"light"}}>
            <option value={30}>30 days — critical only</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days (recommended)</option>
            <option value={180}>180 days</option>
          </select>
        </div>

        {/* Alert preview grouped by category */}
        <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:12}}>📋 Email Preview — {previewAlerts.length} item{previewAlerts.length!==1?"s":""}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:previewAlerts.length>0?14:0}}>
            {[{label:"OVERDUE",count:overdue.length,color:T.red,dim:T.redDim},{label:"EXPIRING",count:expiring.length,color:T.gold,dim:T.goldDim},{label:"TOTAL",count:previewAlerts.length,color:T.blue,dim:T.blueDim}].map(k=>(
              <div key={k.label} style={{textAlign:"center",background:k.dim,borderRadius:8,padding:"8px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:k.color}}>{k.count}</div>
                <div style={{fontSize:10,color:k.color,fontWeight:700}}>{k.label}</div>
              </div>
            ))}
          </div>
          {previewAlerts.length > 0 ? (
            <div style={{maxHeight:200,overflowY:"auto",display:"grid",gap:6}}>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{fontSize:10,fontWeight:800,color:T.textMuted,letterSpacing:"1px",marginBottom:4,marginTop:4}}>{cat.toUpperCase()} ({items.length})</div>
                  {items.map((a,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.textSub,paddingLeft:8,marginBottom:2}}>
                      <span style={{color:a.days<0?T.red:a.days<=30?T.gold:T.textMuted,fontWeight:700,minWidth:90,fontSize:11}}>
                        {a.days<0?`🔴 ${Math.abs(a.days)}d overdue`:`🟡 ${a.days}d left`}
                      </span>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.text}}>{a.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:12,color:T.green,fontWeight:600}}>✅ No alerts at this threshold — no email will be sent</div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{background:testResult.ok?T.greenDim:T.redDim,border:`1px solid ${testResult.ok?T.green:T.red}44`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:testResult.ok?T.green:T.red,fontWeight:600}}>
            {testResult.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={() => onTest(form)} disabled={!hasRecipients || sending}
            style={{flex:1,background:T.blueDim,border:`1px solid ${T.blue}55`,borderRadius:10,padding:"11px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.blue,cursor:hasRecipients&&!sending?"pointer":"not-allowed",opacity:hasRecipients&&!sending?1:0.5}}>
            {sending ? "Sending…" : `📧 Test (${form.emails.length} recipient${form.emails.length!==1?"s":""})`}
          </button>
          <button onClick={() => onSave(form)}
            style={{flex:1,background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",borderRadius:10,padding:"11px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:"#080b10",cursor:"pointer",letterSpacing:"1px"}}>
            SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}
/* ════════════════════════════════════════════════════════════════════════════
   RIGS PAGE
════════════════════════════════════════════════════════════════════════════ */
// ─── RigDetailsPage ───────────────────────────────────────────────────────────

export { Dashboard, NotificationSettingsModal };
