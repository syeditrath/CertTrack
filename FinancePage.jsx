import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme, pctColor, live } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, FLink, FileLink, PageHeader, Empty, InvoiceMetricCard, InvoiceCard, InvoiceModal, MultiPdfInvoiceUpload, BulkInvoiceUpload, BulkWorkOrderUpload, WorkOrderModal } from "./UI.jsx";

function LoginPage({ onLogin }) {
  return (
    <FinanceLoginPage
      onLogin={onLogin}
      title="AUTHENTICATION"
      subtitle="Welcome back. Enter your password to access the portal."
      passwordLabel="PASSWORD"
      placeholder="Enter password…"
      buttonLabel="ENTER SCORPION"
    />
  );
}

function FinanceLoginPage({ onLogin, title="FINANCE ACCESS", subtitle="This section is restricted.\nEnter the finance password to continue.", passwordLabel="FINANCE PASSWORD", placeholder="Enter finance password…", buttonLabel="UNLOCK FINANCE" }) {
  const [pw,    setPw]    = useState("");
  const [error, setError] = useState("");
  const [show,  setShow]  = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (!onLogin(pw)) {
      setError("Incorrect password. Please try again.");
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:"60vh", padding:16,
    }}>
      <div
        className="slide-up"
        style={{
          background: T.card,
          border: `1px solid ${T.gold}55`,
          borderRadius: 20,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 420,
          boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px ${T.gold}22`,
          animation: shake ? "none" : undefined,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold glow top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${T.gold},transparent)`,borderRadius:"20px 20px 0 0"}}/>

        {/* Header */}
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:T.goldDim,border:`2px solid ${T.gold}55`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`0 0 24px ${T.gold}33`}}>
            🔒
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,letterSpacing:"2px",color:T.gold}}>
            {title}
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:6,lineHeight:1.5,whiteSpace:"pre-line"}}>
            {subtitle}
          </div>
        </div>

        {/* Password field */}
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8,letterSpacing:"1.5px"}}>{passwordLabel}</label>
          <div style={{position:"relative"}}>
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && attempt()}
              placeholder={placeholder}
              style={{
                width:"100%",
                background:T.inputBg,
                border:`1px solid ${error ? T.red : T.border}`,
                borderRadius:10,
                padding:"12px 44px 12px 14px",
                fontSize:14,
                color:T.text,
                outline:"none",
                transition:"border-color .2s",
                colorScheme:"light",
              }}
              onFocus={e => e.target.style.borderColor = T.gold}
              onBlur={e => e.target.style.borderColor = error ? T.red : T.border}
            />
            <button onClick={() => setShow(s => !s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textMuted,fontSize:16,cursor:"pointer",padding:2}}>
              {show ? "🙈" : "👁"}
            </button>
          </div>
          {error && <div style={{fontSize:12,color:T.red,marginTop:6,display:"flex",alignItems:"center",gap:5}}>⚠ {error}</div>}
        </div>

        <button
          onClick={attempt}
          style={{
            width:"100%",
            background:`linear-gradient(135deg,${T.gold},#d97706)`,
            border:"none", borderRadius:10,
            padding:"13px",
            fontFamily:"'Barlow Condensed',sans-serif",
            fontWeight:800, fontSize:16,
            color:"#080b10",
            letterSpacing:"1.5px",
            cursor:"pointer",
            boxShadow:`0 4px 20px ${T.gold}44`,
            transition:"transform .15s,box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=`0 6px 28px ${T.gold}66`; }}
          onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=`0 4px 20px ${T.gold}44`; }}
        >
          {buttonLabel}
        </button>

        <div style={{textAlign:"center",fontSize:11,color:T.textMuted,marginTop:16,letterSpacing:"1px"}}>
          Contact your administrator if you forgot the password
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FINANCE PAGE
   Full financial overview — invoice values, collections, receivables.
   Only accessible after finance authentication.
════════════════════════════════════════════════════════════════════════════ */
const FIN_TABS = [
  {id:"overview",    label:"Overview",                 icon:"$",  color:T.gold,   dim:T.goldDim},
  {id:"revenue",     label:"Revenue",                  icon:"📈", color:T.teal,   dim:T.teal+"22"},
  {id:"invoices",    label:"Invoices",                 icon:"🧾", color:T.green,  dim:T.greenDim},
  {id:"workorders",  label:"Work Orders / Agreements", icon:"📋", color:T.purple, dim:T.purpleDim},
];

const REV_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* Spreads each work order's contract value evenly across the months it spans
   (Date Signed → Expiry Date). If there's no expiry date, the full value is
   recognized in the month it was signed. Returns { "YYYY-MM": {total, entries[]} } */
function computeRevenueBuckets(woDocs) {
  const buckets = {};
  woDocs.forEach(doc => {
    const amount = parseFloat(doc.amount) || 0;
    if (amount <= 0 || !doc.date) return;
    const start = new Date(doc.date);
    if (Number.isNaN(start.getTime())) return;
    let end = doc.expiryDate ? new Date(doc.expiryDate) : null;
    if (!end || Number.isNaN(end.getTime()) || end < start) end = start;

    const keys = [];
    let y = start.getFullYear(), m = start.getMonth();
    const endY = end.getFullYear(), endM = end.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      m++; if (m > 11) { m = 0; y++; }
    }
    const perMonth = amount / keys.length;
    keys.forEach(key => {
      if (!buckets[key]) buckets[key] = { total: 0, entries: [] };
      buckets[key].total += perMonth;
      buckets[key].entries.push({ doc, allocated: perMonth, spanMonths: keys.length });
    });
  });
  return buckets;
}

function FinancePage({ data, setData, showToast, selectedInvoiceYear, setSelectedInvoiceYear, isAdmin }) {
  const [finTab, setFinTab] = useState("overview");
  const [invoiceDetailView, setInvoiceDetailView] = useState(null);
  const [modal, setModal] = useState(null);
  const [bulkWoModal, setBulkWoModal] = useState(false);
  const [bulkInvModal, setBulkInvModal] = useState(false);
  const [multiPdfInvModal, setMultiPdfInvModal] = useState(null); // {project?:string}
  const [fProj, setFProj] = useState("");
  const [selProj, setSelProj] = useState(null);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState("All");
  const [selectedRevenueYear, setSelectedRevenueYear] = useState("All");
  const [revenueProj, setRevenueProj] = useState("");
  const [revenueMonthModal, setRevenueMonthModal] = useState(null); // {key, label}

  const projects  = data.projects    || [];
  const allDocs   = live(data.projectDocs);
  const invoiceDocs = allDocs.filter(d => d.subTab === "invoices");
  const woDocs      = allDocs.filter(d => d.subTab === "workorders");

  const finCounts = {
    overview:   "",
    invoices:   invoiceDocs.length,
    workorders: woDocs.length,
  };

  // ── Save / delete helpers (write back to shared projectDocs) ──
  const saveDoc = (doc, mode) => {
    const st = finTab === "invoices" ? "invoices" : "workorders";
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...prev.projectDocs];
        if (mode === "add") list.push({...doc, id:uid(), subTab:st});
        else { const i = list.findIndex(d => d.id === doc.id); if (i >= 0) list[i] = {...doc, subTab:st}; }
        return {...prev, projectDocs:list};
      });
      showToast(mode === "add" ? "Document added" : "Updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev => ({...prev, projectDocs:prev.projectDocs.map(d => d.id === id ? {...d, _deleted:true} : d)}));
    showToast("Deleted","del");
  };

  // ── Overview calculations ──
  const availableInvoiceYears = Array.from(new Set(
    invoiceDocs.map(doc => {
      if (!doc.dueDate) return null;
      const dt = new Date(doc.dueDate);
      return Number.isNaN(dt.getTime()) ? null : String(dt.getFullYear());
    }).filter(Boolean)
  )).sort((a,b) => Number(b) - Number(a));

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Available months depend on selected year
  const availableInvoiceMonths = selectedInvoiceYear === "All" ? [] : Array.from(new Set(
    invoiceDocs.map(doc => {
      if (!doc.dueDate) return null;
      const dt = new Date(doc.dueDate);
      if (Number.isNaN(dt.getTime())) return null;
      if (String(dt.getFullYear()) !== selectedInvoiceYear) return null;
      return dt.getMonth(); // 0-11
    }).filter(v => v !== null)
  )).sort((a,b) => a - b);

  // Reset month when year changes (handled inline via derived value)
  const effectiveMonth = selectedInvoiceYear === "All" ? "All" : selectedInvoiceMonth;

  const filteredInvoiceDocs = invoiceDocs.filter(doc => {
    if (!doc.dueDate) return selectedInvoiceYear === "All";
    const dt = new Date(doc.dueDate);
    if (Number.isNaN(dt.getTime())) return selectedInvoiceYear === "All";
    if (selectedInvoiceYear !== "All" && String(dt.getFullYear()) !== selectedInvoiceYear) return false;
    if (effectiveMonth !== "All" && dt.getMonth() !== Number(effectiveMonth)) return false;
    return true;
  });

  const totalInvoiceValue = filteredInvoiceDocs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const totalReceived     = filteredInvoiceDocs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const totalDue          = filteredInvoiceDocs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const incomeInvs        = filteredInvoiceDocs.filter(d => getInvoiceStream(d) === "income");
  const advanceInvs       = filteredInvoiceDocs.filter(d => getInvoiceStream(d) === "advance");
  const incomeInvoiced    = incomeInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const advanceInvoiced   = advanceInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const receivedFromIncome  = incomeInvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const receivedFromAdvance = advanceInvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const dueFromIncome   = incomeInvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const dueFromAdvance  = advanceInvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const collectionRate  = totalInvoiceValue > 0 ? Math.round((totalReceived / totalInvoiceValue) * 100) : 0;

  const projectBreakdown = projects.map(proj => { proj = pName(proj);
    const pinvs     = filteredInvoiceDocs.filter(d => d.project === proj);
    const invoiced  = pinvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
    const collected = pinvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
    const due       = pinvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
    const pct       = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;
    return {proj, invoiced, collected, due, pct, count:pinvs.length};
  }).filter(p => p.invoiced > 0 || p.count > 0).sort((a,b) => b.invoiced - a.invoiced);

  // ── Revenue (recognized from Work Order / Agreement values) ──
  const revWoDocs = revenueProj ? woDocs.filter(d => d.project === revenueProj) : woDocs;
  const revenueBuckets = useMemo(() => computeRevenueBuckets(revWoDocs), [revWoDocs]);
  const revenueYears = Array.from(new Set(Object.keys(revenueBuckets).map(k => k.split("-")[0]))).sort((a,b) => Number(b) - Number(a));
  const yearlyRevenueTotals = revenueYears.map(y => ({
    year: y,
    total: Object.entries(revenueBuckets).filter(([k]) => k.startsWith(y + "-")).reduce((s,[,b]) => s + b.total, 0),
  })).sort((a,b) => Number(a.year) - Number(b.year));
  const monthlyRevenueForYear = selectedRevenueYear === "All" ? [] : REV_MONTH_NAMES.map((name, idx) => {
    const key = `${selectedRevenueYear}-${String(idx + 1).padStart(2, "0")}`;
    return { key, name, idx, total: revenueBuckets[key]?.total || 0, entries: revenueBuckets[key]?.entries || [] };
  });
  const totalRecognizedRevenue = selectedRevenueYear === "All"
    ? yearlyRevenueTotals.reduce((s,y) => s + y.total, 0)
    : (monthlyRevenueForYear.reduce((s,m) => s + m.total, 0));
  const totalContractValue = revWoDocs.reduce((s,d) => s + (parseFloat(d.amount) || 0), 0);
  const nowForRevenue = new Date();
  const activeAgreements = revWoDocs.filter(d => {
    if (!d.date) return false;
    const start = new Date(d.date);
    if (Number.isNaN(start.getTime()) || start > nowForRevenue) return false;
    if (!d.expiryDate) return true;
    const end = new Date(d.expiryDate);
    return Number.isNaN(end.getTime()) || end >= nowForRevenue;
  }).length;
  const activeMonthCount = selectedRevenueYear === "All"
    ? Object.values(revenueBuckets).filter(b => b.total > 0).length
    : monthlyRevenueForYear.filter(m => m.total > 0).length;
  const avgMonthlyRevenue = activeMonthCount > 0 ? totalRecognizedRevenue / activeMonthCount : 0;
  const maxYearlyRevenue = Math.max(1, ...yearlyRevenueTotals.map(y => y.total));
  const maxMonthlyRevenue = Math.max(1, ...monthlyRevenueForYear.map(m => m.total));

  // ── Filtered work orders ──
  const filteredWoDocs = fProj ? woDocs.filter(d => d.project === fProj) : woDocs;
  // ── Filtered invoices (for the Invoices tab) ──
  const [projInvMonth, setProjInvMonth] = useState("All");
  const projInvsAll  = selProj ? invoiceDocs.filter(d => d.project === selProj) : [];
  const projInvs = projInvMonth === "All" ? projInvsAll : projInvsAll.filter(d => {
    if (!d.dueDate) return false;
    const dt = new Date(d.dueDate);
    return !Number.isNaN(dt.getTime()) && dt.getMonth() === Number(projInvMonth);
  });
  const projInvsMonths = Array.from(new Set(projInvsAll.map(d => {
    if (!d.dueDate) return null;
    const dt = new Date(d.dueDate);
    return Number.isNaN(dt.getTime()) ? null : dt.getMonth();
  }).filter(v => v !== null))).sort((a,b) => a - b);
  const projInvTotal = projInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>

      {/* ── Page header ── */}
      <div className="fade-up" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:32,color:T.text,display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:T.gold}}>$</span> FINANCE
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Invoices, work orders & financial overview · Restricted access</div>
        </div>
        <button onClick={()=>{
          const projRows = projectBreakdown.map(p=>`<tr>
            <td><strong>${p.proj}</strong></td>
            <td style="text-align:right">${formatSarCompact(p.invoiced)}</td>
            <td style="text-align:right">${formatSarCompact(p.collected)}</td>
            <td style="text-align:right;color:${p.due>0?"#dc2626":"#16a34a"}">${formatSarCompact(p.due)}</td>
            <td>${p.count} invoice${p.count!==1?"s":""}</td>
            <td><div>${p.pct}%</div><div class="bar-wrap"><div class="bar-fill" style="width:${p.pct}%;background:${p.pct>=80?"#16a34a":p.pct>=50?"#d97706":"#dc2626"}"></div></div></td>
          </tr>`).join("");
          const invRows = filteredInvoiceDocs.map(d=>`<tr>
            <td>${d.project||"—"}</td>
            <td>${d.docNo||d.name||"—"}</td>
            <td>${d.dueDate||"—"}</td>
            <td style="text-align:right">${formatSarCompact(parseFloat(d.amount)||0)}</td>
            <td style="text-align:right">${formatSarCompact(getInvoiceCollectedAmount(d))}</td>
            <td style="text-align:right;color:${getInvoiceRemainingAmount(d)>0?"#dc2626":"#16a34a"}">${formatSarCompact(getInvoiceRemainingAmount(d))}</td>
            <td>${d.invoiceType||"—"}</td>
          </tr>`).join("");
          printPage("Finance Report", `
            <h1>💰 FINANCE REPORT</h1>
            <div class="meta">Generated ${new Date().toLocaleDateString()} · ${selectedInvoiceYear === "All" ? "All Years" : selectedInvoiceYear + (effectiveMonth !== "All" ? " · " + MONTH_NAMES[Number(effectiveMonth)] : "")}</div>
            <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
              <div class="kpi"><div class="kpi-val">${formatSarCompact(totalInvoiceValue)}</div><div class="kpi-lbl">Total Invoiced</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#16a34a">${formatSarCompact(totalReceived)}</div><div class="kpi-lbl">Total Received</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Total Due</div></div>
              <div class="kpi"><div class="kpi-val">${collectionRate}%</div><div class="kpi-lbl">Collection Rate</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#2563eb">${formatSarCompact(incomeInvoiced)}</div><div class="kpi-lbl">Income Invoiced</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#d97706">${formatSarCompact(advanceInvoiced)}</div><div class="kpi-lbl">Advance Invoiced</div></div>
            </div>
            <h2>Project Breakdown</h2>
            <table>
              <thead><tr><th>Project</th><th>Invoiced</th><th>Collected</th><th>Due</th><th>Invoices</th><th>Collection %</th></tr></thead>
              <tbody>${projRows}</tbody>
            </table>
            <h2>Invoice List</h2>
            <table>
              <thead><tr><th>Project</th><th>Invoice No</th><th>Due Date</th><th>Amount</th><th>Received</th><th>Due</th><th>Type</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          `);
        }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:11,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          🖨 Print
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {FIN_TABS.map(t => {
          const active = finTab === t.id;
          return (
            <button key={t.id} onClick={() => { setFinTab(t.id); setSelProj(null); setFProj(""); setModal(null); }}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:10,border:`1px solid ${active?t.color:T.border}`,background:active?t.dim:"transparent",color:active?t.color:T.textSub,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .15s"}}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {finCounts[t.id] !== "" && (
                <span style={{background:active?t.color:T.border,color:active?"#0d1117":T.textMuted,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:800}}>{finCounts[t.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
      {finTab === "overview" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>YEAR</label>
            <select value={selectedInvoiceYear} onChange={e => { setSelectedInvoiceYear(e.target.value); setSelectedInvoiceMonth("All"); }}
              style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
              <option value="All">All Years</option>
              {availableInvoiceYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {selectedInvoiceYear !== "All" && availableInvoiceMonths.length > 0 && (
              <>
                <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>MONTH</label>
                <select value={selectedInvoiceMonth} onChange={e => setSelectedInvoiceMonth(e.target.value)}
                  style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
                  <option value="All">All Months</option>
                  {availableInvoiceMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                </select>
              </>
            )}
          </div>

          {/* KPI strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
            {[
              {label:"Total Invoiced",    v:formatSarCompact(totalInvoiceValue), color:T.green,  icon:"📋"},
              {label:"Total Collected",   v:formatSarCompact(totalReceived),     color:T.blue,   icon:"✓"},
              {label:"Total Outstanding", v:formatSarCompact(totalDue),          color:T.red,    icon:"⏳"},
              {label:"Collection Rate",   v:`${collectionRate}%`,                color:collectionRate>=80?T.green:collectionRate>=50?T.gold:T.red, icon:"◎"},
              {label:"Total Invoices",    v:filteredInvoiceDocs.length,          color:T.purple, icon:"◆"},
              {label:"Work Orders",       v:woDocs.length,                       color:T.purple, icon:"📋"},
            ].map((k,i) => (
              <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.05}s`,position:"relative",overflow:"hidden",boxShadow:T.shadow}}>
                <div style={{position:"absolute",top:10,right:14,fontSize:22,opacity:.1}}>{k.icon}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(22px,2.5vw,36px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
                <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:500}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Collection rate bar */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",marginBottom:20,boxShadow:T.shadow}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textSub,letterSpacing:".5px"}}>COLLECTION RATE</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(18px,2vw,26px)",color:collectionRate>=80?T.green:collectionRate>=50?T.gold:T.red}}>{collectionRate}%</span>
            </div>
            <div style={{height:8,background:T.border,borderRadius:999}}>
              <div style={{height:"100%",width:`${collectionRate}%`,borderRadius:999,transition:"width 1.2s cubic-bezier(0.22,1,0.36,1)",background:collectionRate>=80?`linear-gradient(90deg,${T.green},#059669)`:collectionRate>=50?`linear-gradient(90deg,${T.gold},#d97706)`:`linear-gradient(90deg,${T.red},#dc2626)`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:T.textSub}}>
              <span>{formatSarCompact(totalReceived)} collected of {formatSarCompact(totalInvoiceValue)} invoiced</span>
              <span style={{color:T.red}}>{formatSarCompact(totalDue)} outstanding</span>
            </div>
          </div>

          {/* Invoice metric cards */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>
              INVOICE VALUE {selectedInvoiceYear !== "All" ? `— ${selectedInvoiceYear}${effectiveMonth !== "All" ? ` · ${MONTH_NAMES[Number(effectiveMonth)]}` : ""}` : "— ALL YEARS"}
            </div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>
              {selectedInvoiceYear === "All" ? `Across all ${filteredInvoiceDocs.length} invoices` : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear} · ${filteredInvoiceDocs.length} invoices` : `For ${selectedInvoiceYear} · ${filteredInvoiceDocs.length} invoices`}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
              <InvoiceMetricCard title="TOTAL INVOICE VALUE" amount={formatSarCompact(totalInvoiceValue)} sub={`${filteredInvoiceDocs.length} invoices · ${selectedInvoiceYear === "All" ? "all years" : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : selectedInvoiceYear}`} color={T.green} onClick={() => setInvoiceDetailView({mode:"all",stream:"all"})} miniCards={[{title:"INCOME INVOICED",amount:formatSarCompact(incomeInvoiced),color:T.green,onClick:()=>setInvoiceDetailView({mode:"all",stream:"income"})},{title:"ADVANCE INVOICED",amount:formatSarCompact(advanceInvoiced),color:T.gold,onClick:()=>setInvoiceDetailView({mode:"all",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT RECEIVED" amount={formatSarCompact(totalReceived)} sub={selectedInvoiceYear === "All" ? "Collected across all invoices" : effectiveMonth !== "All" ? `Collected for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : `Collected for ${selectedInvoiceYear}`} color={T.blue} onClick={() => setInvoiceDetailView({mode:"received",stream:"all"})} miniCards={[{title:"RECEIVED FROM INCOME",amount:formatSarCompact(receivedFromIncome),color:T.blue,onClick:()=>setInvoiceDetailView({mode:"received",stream:"income"})},{title:"RECEIVED FROM ADVANCE",amount:formatSarCompact(receivedFromAdvance),color:T.teal,onClick:()=>setInvoiceDetailView({mode:"received",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT DUE" amount={formatSarCompact(totalDue)} sub={selectedInvoiceYear === "All" ? "Pending and partial balances" : effectiveMonth !== "All" ? `Outstanding for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : `Outstanding for ${selectedInvoiceYear}`} color={T.red} onClick={() => setInvoiceDetailView({mode:"due",stream:"all"})} miniCards={[{title:"DUE FROM INCOME",amount:formatSarCompact(dueFromIncome),color:T.red,onClick:()=>setInvoiceDetailView({mode:"due",stream:"income"})},{title:"DUE FROM ADVANCE",amount:formatSarCompact(dueFromAdvance),color:T.orange,onClick:()=>setInvoiceDetailView({mode:"due",stream:"advance"})}]}/>
            </div>
          </div>

          {/* Per-project breakdown */}
          {projectBreakdown.length > 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>PER-PROJECT BREAKDOWN</div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Invoice collection status by project {selectedInvoiceYear !== "All" ? `for ${effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ` : ""}${selectedInvoiceYear}` : ""}</div>
              <div style={{display:"grid",gap:12}}>
                {projectBreakdown.map((p,i) => (
                  <div key={p.proj} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",animationDelay:`${i*.04}s`,display:"flex",alignItems:"center",gap:14}}>
                    {/* Project name + count */}
                    <div style={{minWidth:180,maxWidth:220}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.proj}</div>
                      <div style={{fontSize:11,color:T.textMuted}}>{p.count} invoice{p.count!==1?"s":""}</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:6,background:T.border,borderRadius:999,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${p.pct}%`,borderRadius:999,background:`linear-gradient(90deg,${pctColor(p.pct)},${pctColor(p.pct)}bb)`,transition:"width 1s"}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:pctColor(p.pct),minWidth:32,textAlign:"right"}}>{p.pct}%</div>
                    </div>
                    {/* Amounts */}
                    <div style={{display:"flex",gap:16,flexShrink:0}}>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.green}}>{formatSarCompact(p.invoiced)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>INVOICED</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.blue}}>{formatSarCompact(p.collected)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>COLLECTED</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:p.due>0?T.red:T.green}}>{formatSarCompact(p.due)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>DUE</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoiceDetailView && <InvoiceYearDetailsModal view={invoiceDetailView} invoices={filteredInvoiceDocs} yearLabel={selectedInvoiceYear === "All" ? "All" : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : selectedInvoiceYear} onClose={() => setInvoiceDetailView(null)}/>}

          {filteredInvoiceDocs.length === 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center",boxShadow:T.shadow}}>
              <div style={{fontSize:44,marginBottom:12}}>📋</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.textSub,marginBottom:8}}>NO INVOICES</div>
              <div style={{fontSize:13,color:T.textMuted}}>{selectedInvoiceYear === "All" ? "No invoices found. Add invoices via the Invoices tab above." : effectiveMonth !== "All" ? `No invoices found for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}. Try a different month or year.` : `No invoices found for ${selectedInvoiceYear}. Try selecting a different year.`}</div>
            </div>
          )}
        </div>
      )}

      {/* ══ REVENUE TAB ════════════════════════════════════════════════════ */}
      {finTab === "revenue" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>PROJECT</label>
            <select value={revenueProj} onChange={e => setRevenueProj(e.target.value)}
              style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
              <option value="">All Projects</option>
              {renderProjectOptions(projects)}
            </select>
            <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>YEAR</label>
            <select value={selectedRevenueYear} onChange={e => setSelectedRevenueYear(e.target.value)}
              style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
              <option value="All">All Years</option>
              {revenueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* KPI strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
            {[
              {label:"Recognized Revenue", v:formatSarCompact(totalRecognizedRevenue), color:T.teal,   icon:"📈"},
              {label:"Total Contract Value", v:formatSarCompact(totalContractValue),   color:T.purple, icon:"📋"},
              {label:"Active Agreements",  v:activeAgreements,                         color:T.green,  icon:"✓"},
              {label:"Avg Monthly Revenue",v:formatSarCompact(avgMonthlyRevenue),      color:T.gold,   icon:"◎"},
            ].map((k,i) => (
              <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.05}s`,position:"relative",overflow:"hidden",boxShadow:T.shadow}}>
                <div style={{position:"absolute",top:10,right:14,fontSize:22,opacity:.1}}>{k.icon}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(22px,2.5vw,36px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
                <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:500}}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:12,color:T.textMuted,marginBottom:20,fontStyle:"italic"}}>
            Revenue is recognized by spreading each work order / agreement's contract value evenly across the months between its Date Signed and Expiry Date. Agreements without an expiry date are recognized in full in their signed month.
          </div>

          {/* ── Chart: years (All) or months (specific year) ── */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>
              {selectedRevenueYear === "All" ? "REVENUE BY YEAR" : `REVENUE BY MONTH — ${selectedRevenueYear}`}
            </div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:22}}>
              {selectedRevenueYear === "All" ? "Click a year to see its monthly breakdown" : "Click a month to see contributing agreements"}
            </div>

            {selectedRevenueYear === "All" ? (
              yearlyRevenueTotals.length === 0 ? (
                <div style={{textAlign:"center",padding:"30px 10px",color:T.textMuted,fontSize:13}}>No work orders with a value and signed date yet.</div>
              ) : (
                <div style={{display:"flex",alignItems:"flex-end",gap:14,height:220,padding:"0 4px"}}>
                  {yearlyRevenueTotals.map(y => (
                    <div key={y.year} onClick={() => setSelectedRevenueYear(y.year)}
                      style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%",cursor:"pointer"}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.teal,marginBottom:6}}>{formatSarCompact(y.total)}</div>
                      <div style={{width:"100%",maxWidth:64,height:`${Math.max(4,(y.total/maxYearlyRevenue)*160)}px`,borderRadius:"8px 8px 0 0",background:`linear-gradient(180deg,${T.teal},${T.teal}88)`,transition:"height .8s cubic-bezier(0.22,1,0.36,1)"}}/>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text,marginTop:8}}>{y.year}</div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{display:"flex",alignItems:"flex-end",gap:8,height:220,padding:"0 4px",overflowX:"auto"}}>
                {monthlyRevenueForYear.map(m => (
                  <div key={m.key} onClick={() => m.total > 0 && setRevenueMonthModal(m)}
                    style={{flex:1,minWidth:38,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%",cursor:m.total>0?"pointer":"default"}}>
                    {m.total > 0 && <div style={{fontSize:10,fontWeight:700,color:T.teal,marginBottom:6,whiteSpace:"nowrap"}}>{formatSarCompact(m.total)}</div>}
                    <div style={{width:"100%",maxWidth:36,height:`${Math.max(3,(m.total/maxMonthlyRevenue)*150)}px`,borderRadius:"6px 6px 0 0",background:m.total>0?`linear-gradient(180deg,${T.teal},${T.teal}88)`:T.border,transition:"height .8s cubic-bezier(0.22,1,0.36,1)"}}/>
                    <div style={{fontSize:10,color:T.textMuted,fontWeight:600,marginTop:6}}>{m.name.slice(0,3)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── List view (same data, easier to scan) ── */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:14}}>
              {selectedRevenueYear === "All" ? "YEARLY BREAKDOWN" : "MONTHLY BREAKDOWN"}
            </div>
            {selectedRevenueYear === "All" ? (
              yearlyRevenueTotals.length === 0
                ? <div style={{fontSize:13,color:T.textMuted}}>No data yet.</div>
                : <div style={{display:"grid",gap:8}}>
                    {[...yearlyRevenueTotals].sort((a,b)=>Number(b.year)-Number(a.year)).map(y => (
                      <div key={y.year} onClick={() => setSelectedRevenueYear(y.year)}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",cursor:"pointer"}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{y.year}</span>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.teal}}>{formatSarCompact(y.total)}</span>
                      </div>
                    ))}
                  </div>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {monthlyRevenueForYear.map(m => (
                  <div key={m.key} onClick={() => m.total > 0 && setRevenueMonthModal(m)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",cursor:m.total>0?"pointer":"default",opacity:m.total>0?1:.6}}>
                    <span style={{fontSize:14,fontWeight:600,color:T.text}}>{m.name}</span>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {m.entries.length > 0 && <Chip>{m.entries.length} agreement{m.entries.length!==1?"s":""}</Chip>}
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:m.total>0?T.teal:T.textMuted}}>{formatSarCompact(m.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {revenueMonthModal && (
            <RevenueMonthDetailsModal
              monthLabel={`${revenueMonthModal.name} ${selectedRevenueYear}`}
              entries={revenueMonthModal.entries}
              total={revenueMonthModal.total}
              onClose={() => setRevenueMonthModal(null)}
            />
          )}
        </div>
      )}

      {/* ══ INVOICES TAB ══════════════════════════════════════════════════ */}
      {finTab === "invoices" && (
        selProj ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
              <button onClick={() => { setSelProj(null); setProjInvMonth("All"); }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selProj}</div>
                <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>{projInvs.length}{projInvMonth !== "All" ? ` of ${projInvsAll.length}` : ""} invoice{projInvs.length!==1?"s":""} · Total: <span style={{color:T.green,fontWeight:700}}>SAR {projInvTotal.toLocaleString()}</span></div>
              </div>
              {projInvsMonths.length > 1 && (
                <select value={projInvMonth} onChange={e => setProjInvMonth(e.target.value)}
                  style={{background:T.inputBg,color:T.text,border:`1px solid ${projInvMonth !== "All" ? T.gold : T.border}`,borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
                  <option value="All">All Months</option>
                  {projInvsMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                </select>
              )}
              <Btn color={T.teal} onClick={() => setMultiPdfInvModal({project:selProj})}>📄 Bulk PDF Upload</Btn>
              <Btn color={T.green} solid onClick={() => setModal({mode:"add",doc:{project:selProj}})}>+ Add Invoice</Btn>
            </div>
            {projInvs.length === 0
              ? <Empty icon="🧾" label="No invoices yet" sub="Add the first invoice for this project" color={T.green} onAdd={() => setModal({mode:"add",doc:{project:selProj}})}/>
              : <div style={{display:"grid",gap:10}}>{projInvs.map((doc,i) => <InvoiceCard key={doc.id} doc={doc} delay={i*.03} isAdmin={isAdmin} onEdit={() => setModal({mode:"edit",doc})} onDel={() => delDoc(doc.id)}/>)}</div>
            }
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>INVOICES</div>
                <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Select a project to view and manage invoices</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn color={T.green} onClick={() => setBulkInvModal(true)}>⬆ Bulk Import</Btn>
                <Btn color={T.teal} onClick={() => setMultiPdfInvModal({})}>📄 Bulk PDF Upload</Btn>
                <Btn color={T.green} solid onClick={() => setModal({mode:"add"})}>+ Add Invoice</Btn>
              </div>
            </div>
            {projects.length === 0
              ? <Empty icon="🧾" label="No projects yet" sub="Add projects via Manage Projects in the sidebar" color={T.green} onAdd={() => onManageProjects && onManageProjects()}/>
              : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                  {projects.map((p,i) => { p=pName(p);
                    const pinvs = invoiceDocs.filter(d => d.project === p);
                    const total = pinvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
                    const collected = pinvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
                    const due = pinvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
                    return (
                      <div key={p} className="fade-up card-hover" onClick={() => setSelProj(p)}
                        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",cursor:"pointer",animationDelay:`${i*.04}s`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                          <div style={{width:38,height:38,background:T.greenDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧾</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p}</div>
                            <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{pinvs.length} invoice{pinvs.length!==1?"s":""}</div>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div style={{background:T.bg,borderRadius:8,padding:"8px 10px"}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(total)}</div>
                            <div style={{fontSize:10,color:T.textMuted,marginTop:4,fontWeight:700}}>INVOICED</div>
                          </div>
                          <div style={{background:T.greenDim,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.green}33`}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(collected)}</div>
                            <div style={{fontSize:10,color:T.green,marginTop:4,fontWeight:700}}>COLLECTED</div>
                          </div>
                          <div style={{background:T.redDim,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.red}33`}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.red,lineHeight:1}}>{formatSarCompact(due)}</div>
                            <div style={{fontSize:10,color:T.red,marginTop:4,fontWeight:700}}>DUE</div>
                          </div>
                        </div>
                        <div style={{fontSize:12,color:T.green,fontWeight:700,textAlign:"right",marginTop:12}}>View Invoices →</div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )
      )}

      {/* ══ WORK ORDERS TAB ═══════════════════════════════════════════════ */}
      {finTab === "workorders" && (
        <div>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>WORK ORDERS / AGREEMENTS</div>
              <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Contracts and work orders with clients</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={fProj} onChange={e => setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
                <option value="">All Projects</option>
                {renderProjectOptions(projects)}
              </select>
              <Btn color={T.blue} onClick={() => setBulkWoModal(true)}>⬆ Bulk Upload</Btn>
              <Btn color={T.purple} solid onClick={() => setModal({mode:"add"})}>+ Add Work Order</Btn>
            </div>
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{filteredWoDocs.length} record{filteredWoDocs.length!==1?"s":""}</div>
          {filteredWoDocs.length === 0
            ? <Empty icon="📋" label="No work orders yet" sub="Add your first work order or agreement" color={T.purple} onAdd={() => setModal({mode:"add"})}/>
            : <div style={{display:"grid",gap:10}}>
                {filteredWoDocs.map((doc,i) => {
                  const hasExp = !!doc.expiryDate;
                  const s = getStatus(daysUntil(doc.expiryDate));
                  return (
                    <div key={doc.id} className="fade-up"
                      style={{background:T.card,border:`1px solid ${hasExp&&daysUntil(doc.expiryDate)<=90?s.color+"44":T.border}`,borderLeft:"4px solid "+T.purple,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.1vw,17px)",color:T.text}}>{doc.name}</span>
                          {doc.project && <Tag color={T.teal}>{doc.project}</Tag>}
                          {hasExp && <Tag color={s.color}>{s.label}</Tag>}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {doc.refNo    && <Chip>Ref: {doc.refNo}</Chip>}
                          {doc.supplier && <Chip>Client: {doc.supplier}</Chip>}
                          {doc.amount   && <Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
                          {doc.date     && <Chip>Signed: {fmtDate(doc.date)}</Chip>}
                          {hasExp       && <Chip color={s.color}>Expires: {fmtDate(doc.expiryDate)}</Chip>}
                          {hasExp && daysUntil(doc.expiryDate)!==null && daysUntil(doc.expiryDate)<=90 && <Chip color={s.color}>{daysUntil(doc.expiryDate)>=0?`${daysUntil(doc.expiryDate)}d left`:`${Math.abs(daysUntil(doc.expiryDate))}d overdue`}</Chip>}
                          {(doc.fileLinks?.length ? doc.fileLinks : doc.fileLink ? [{url:doc.fileLink,label:""}] : []).map((l,i)=><FileLink key={i} href={l.url} label={l.label}/>)}
                        </div>
                        {doc.notes && <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <ABtn color={T.blue} onClick={() => setModal({mode:"edit",doc})}>✎</ABtn>
                        {isAdmin && <ABtn color={T.red}  onClick={() => delDoc(doc.id)}>✕</ABtn>}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* ── Modals ── */}
      {modal && finTab === "invoices"   && <InvoiceModal   mode={modal.mode} doc={modal.doc} projects={data.projects||[]} defaultProject={selProj} onClose={() => setModal(null)} onSave={saveDoc}/>}
      {modal && finTab === "workorders" && <WorkOrderModal mode={modal.mode} doc={modal.doc} projects={data.projects||[]}                          onClose={() => setModal(null)} onSave={saveDoc}/>}
      {bulkWoModal && <BulkWorkOrderUpload projects={projects} onClose={()=>setBulkWoModal(false)} onImport={docs=>{ setData(prev=>({...prev,projectDocs:[...(prev.projectDocs||[]),...docs.map(d=>({...d,id:uid(),subTab:"workorders"}))]})); setBulkWoModal(false); showToast(`✓ ${docs.length} work order${docs.length!==1?"s":""} uploaded`); }}/>}
      {bulkInvModal && <BulkInvoiceUpload projects={projects} onClose={()=>setBulkInvModal(false)} onImport={rows=>{ setData(prev=>({...prev,projectDocs:[...(prev.projectDocs||[]),...rows.map(r=>({...r,id:uid(),subTab:"invoices"}))]})); setBulkInvModal(false); showToast(`✓ ${rows.length} invoice${rows.length!==1?"s":""} imported`); }}/>}
      {multiPdfInvModal && (
        <MultiPdfInvoiceUpload
          project={multiPdfInvModal.project}
          projects={projects}
          onClose={() => setMultiPdfInvModal(null)}
          onImport={records => {
            setData(prev => ({
              ...prev,
              projectDocs: [...prev.projectDocs, ...records.map(r => ({...r, id:uid(), subTab:"invoices"}))]
            }));
            setMultiPdfInvModal(null);
            showToast(`✓ ${records.length} invoice${records.length!==1?"s":""} uploaded`);
          }}
        />
      )}
    </div>
  );
}

function InvoiceYearDetailsModal({ view, invoices, yearLabel, onClose }) {
  const rawMode = typeof view === "string" ? view : view?.mode;
  const rawStream = typeof view === "object" && view?.stream ? view.stream : "all";
  const normalizedView = rawMode === "received" ? "received" : rawMode === "due" ? "due" : "all";
  const normalizedStream = rawStream === "income" ? "income" : rawStream === "advance" ? "advance" : "all";

  const streamLabel = normalizedStream === "income"
    ? "Income"
    : normalizedStream === "advance"
    ? "Advance"
    : "All";

  const title = normalizedView === "received"
    ? normalizedStream === "all" ? "Amount Received Details" : `Received from ${streamLabel} Details`
    : normalizedView === "due"
    ? normalizedStream === "all" ? "Amount Due Details" : `Due from ${streamLabel} Details`
    : normalizedStream === "all"
    ? "Invoice Details"
    : `${streamLabel} Invoice Details`;

  const rows = invoices.filter((doc) => {
    const matchesStream = normalizedStream === "all" ? true : getInvoiceStream(doc) === normalizedStream;
    if (!matchesStream) return false;
    if (normalizedView === "received") return getInvoiceCollectedAmount(doc) > 0;
    if (normalizedView === "due") return getInvoiceRemainingAmount(doc) > 0;
    return true;
  });

  const totalAmount = rows.reduce((sum, doc) => sum + (parseFloat(doc.amount) || 0), 0);
  const totalReceived = rows.reduce((sum, doc) => sum + getInvoiceCollectedAmount(doc), 0);
  const totalDue = rows.reduce((sum, doc) => sum + getInvoiceRemainingAmount(doc), 0);

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"min(1100px, calc(100vw - 24px))",maxWidth:"calc(100vw - 24px)",maxHeight:"calc(100vh - 24px)",display:"flex",flexDirection:"column",boxShadow:T.shadow}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{title}</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>{yearLabel === "All" ? "All years" : yearLabel} • {rows.length} invoice{rows.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={() => {
              const periodLabel = yearLabel === "All" ? "All Years" : yearLabel;
              const tableRows = rows.map(doc => {
                const total    = parseFloat(doc.amount) || 0;
                const received = getInvoiceCollectedAmount(doc);
                const due      = getInvoiceRemainingAmount(doc);
                const stream   = getInvoiceStream(doc);
                const status   = doc.paymentStatus || doc.status || "Pending";
                return `<tr>
                  <td>${doc.name || "—"}</td>
                  <td>${doc.refNo || "—"}</td>
                  <td>${doc.project || "—"}</td>
                  <td><span style="background:${stream==="advance"?"#fef3c7":"#d1fae5"};color:${stream==="advance"?"#92400e":"#065f46"};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${stream === "advance" ? "Advance" : "Income"}</span></td>
                  <td>${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : "—"}</td>
                  <td style="text-align:right">${formatSarCompact(total)}</td>
                  <td style="text-align:right;color:#16a34a">${formatSarCompact(received)}</td>
                  <td style="text-align:right;color:${due > 0 ? "#dc2626" : "#16a34a"}">${formatSarCompact(due)}</td>
                  <td>${status}</td>
                </tr>`;
              }).join("");
              printPage(title, `
                <h1>${title}</h1>
                <div class="meta">${periodLabel} · ${rows.length} invoice${rows.length !== 1 ? "s" : ""}</div>
                <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
                  <div class="kpi"><div class="kpi-val">${formatSarCompact(totalAmount)}</div><div class="kpi-lbl">Total Value</div></div>
                  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${formatSarCompact(totalReceived)}</div><div class="kpi-lbl">Received</div></div>
                  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Due</div></div>
                </div>
                <h2>Invoice List</h2>
                <table>
                  <thead><tr><th>Invoice</th><th>Ref No</th><th>Project</th><th>Type</th><th>Due Date</th><th>Amount</th><th>Received</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>${tableRows}</tbody>
                </table>
              `);
            }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              🖨 Print
            </button>
            <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,width:38,height:38,fontSize:20,cursor:"pointer"}}>×</button>
          </div>
        </div>

        <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,flexShrink:0}}>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>TOTAL VALUE</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.green,marginTop:6}}>{formatSarCompact(totalAmount)}</div>
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>RECEIVED</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.blue,marginTop:6}}>{formatSarCompact(totalReceived)}</div>
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>DUE</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.red,marginTop:6}}>{formatSarCompact(totalDue)}</div>
          </div>
        </div>

        <div style={{padding:"14px 22px 22px",overflowY:"auto"}}>
          {rows.length === 0 ? (
            <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>No invoices found for this section.</div>
          ) : (
            <div style={{display:"grid",gap:10}}>
              {rows.map((doc) => {
                const total = parseFloat(doc.amount) || 0;
                const received = getInvoiceCollectedAmount(doc);
                const due = getInvoiceRemainingAmount(doc);
                const status = String(doc.paymentStatus || doc.status || "Pending");
                const statusColor = /paid|received/i.test(status) ? T.green : /partial/i.test(status) ? T.gold : T.red;
                const stream = getInvoiceStream(doc);
                return (
                  <div key={doc.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>{doc.name || "Invoice"}</div>
                          {doc.refNo && <Tag color={T.green}>#{doc.refNo}</Tag>}
                          {doc.project && <Tag color={T.blue}>{doc.project}</Tag>}
                          <Tag color={stream === "advance" ? T.gold : T.teal}>{stream === "advance" ? "Advance" : "Income"}</Tag>
                          <Tag color={statusColor}>{status}</Tag>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                          {doc.dueDate && <Chip color={T.gold}>Due: {fmtDate(doc.dueDate)}</Chip>}
                          <Chip color={T.green}>Total: {formatSarCompact(total)}</Chip>
                          <Chip color={T.blue}>Received: {formatSarCompact(received)}</Chip>
                          <Chip color={T.red}>Due: {formatSarCompact(due)}</Chip>
                          {doc.fileLink && <FileLink href={doc.fileLink} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function RevenueMonthDetailsModal({ monthLabel, entries, total, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"min(800px, calc(100vw - 24px))",maxHeight:"calc(100vh - 24px)",display:"flex",flexDirection:"column",boxShadow:T.shadow}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{monthLabel} Revenue</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>{entries.length} contributing agreement{entries.length!==1?"s":""} · {formatSarCompact(total)} recognized</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,width:38,height:38,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"18px 22px 22px",overflowY:"auto"}}>
          {entries.length === 0 ? (
            <div style={{textAlign:"center",padding:"30px 10px",color:T.textMuted}}>No agreements contributed to this month.</div>
          ) : (
            <div style={{display:"grid",gap:10}}>
              {entries.map((e,i) => (
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{e.doc.name}</span>
                        {e.doc.project && <Tag color={T.teal}>{e.doc.project}</Tag>}
                        {e.doc.refNo && <Tag color={T.purple}>#{e.doc.refNo}</Tag>}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {e.doc.supplier && <Chip>Client: {e.doc.supplier}</Chip>}
                        <Chip color={T.purple}>Total Value: {formatSarCompact(parseFloat(e.doc.amount)||0)}</Chip>
                        {e.doc.date && <Chip>Signed: {fmtDate(e.doc.date)}</Chip>}
                        {e.doc.expiryDate && <Chip>Expires: {fmtDate(e.doc.expiryDate)}</Chip>}
                        <Chip>{e.spanMonths} month{e.spanMonths!==1?"s":""} spread</Chip>
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.teal}}>{formatSarCompact(e.allocated)}</div>
                      <div style={{fontSize:10,color:T.textMuted,fontWeight:600}}>THIS MONTH</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function AlertRow({a, onClick}) {
  const s = getStatus(a.days);
  const SRC_COLOR = {"Company Doc":T.blue,"Passport":T.purple,"Visa":T.teal,"Iqama":T.green,"Muqeem":T.orange,"Cert":T.green,"Eq Cert":T.blue,"Insurance":T.purple,"Permit":T.gold};
  const sc = SRC_COLOR[a.src]||T.blue;
  return (
    <div
      onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg,borderRadius:9,border:`1px solid ${T.border}`,cursor:onClick?"pointer":"default",transition:"border-color .15s"}}
      onMouseEnter={e=>{ if(onClick) e.currentTarget.style.borderColor=s.color; }}
      onMouseLeave={e=>{ if(onClick) e.currentTarget.style.borderColor=T.border; }}
    >
      <div style={{width:3,height:32,borderRadius:2,background:s.color,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.label}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
          <span style={{background:`${sc}18`,color:sc,borderRadius:4,padding:"0px 6px",fontSize:9,fontWeight:700}}>{a.src}</span>
          {a.project&&<span style={{fontSize:10,color:T.textMuted}}>{a.project}</span>}
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:s.color,lineHeight:1}}>{Math.abs(a.days)}</div>
        <div style={{fontSize:8,color:T.textMuted,fontWeight:600,letterSpacing:".3px"}}>{a.days<0?"OVERDUE":"DAYS LEFT"}</div>
      </div>
    </div>
  );
}


export { LoginPage, FinanceLoginPage, FinancePage, AlertRow };
