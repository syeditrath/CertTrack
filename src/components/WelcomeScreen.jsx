import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, excelDateToStr, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { GLOBAL_CSS } from "../utils.js";

function WelcomeScreen({onEnter}) {
  const [leaving, setLeaving] = useState(false);

  const handleEnter = () => {
    setLeaving(true);
    setTimeout(onEnter, 600);
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"linear-gradient(135deg,#080b10 0%,#0e1520 50%,#080b10 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      opacity: leaving ? 0 : 1,
      transition: leaving ? "opacity 0.6s ease" : "none",
    }}>

      {/* Animated background rings */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {[300,450,600,750].map((s,i)=>(
          <div key={i} style={{
            position:"absolute",top:"50%",left:"50%",
            width:s,height:s,
            transform:`translate(-50%,-50%)`,
            border:`1px solid rgba(251,191,36,${0.06-i*0.01})`,
            borderRadius:"50%",
            animation:`spinSlow ${12+i*4}s linear infinite ${i%2===0?"":"reverse"}`,
          }}/>
        ))}
      </div>

      {/* Logo container */}
      <div style={{position:"relative",marginBottom:40}}>

        {/* Outer glow ring */}
        <div className="glow-ring" style={{
          width:180, height:180, borderRadius:"50%",
          border:"2px solid rgba(251,191,36,0.4)",
          position:"absolute", top:-14, left:-14,
          zIndex:0,
        }}/>

        {/* Spinning accent ring */}
        <div className="spin-slow" style={{
          position:"absolute", top:-8, left:-8,
          width:168, height:168, borderRadius:"50%",
          border:"2px dashed rgba(56,189,248,0.3)",
          zIndex:0,
        }}/>

        {/* Logo */}
        <div className="pulse-logo" style={{
          width:152, height:152, borderRadius:"50%",
          overflow:"hidden", position:"relative", zIndex:1,
          boxShadow:"0 0 40px rgba(251,191,36,0.3), 0 0 80px rgba(251,191,36,0.1)",
          border:"3px solid rgba(251,191,36,0.6)",
        }}>
          <img src="logo.png" alt="Scorpion Arabia"
            style={{width:"100%",height:"100%",objectFit:"cover",mixBlendMode:"lighten"}}/>
        </div>
      </div>

      {/* Welcome text */}
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:800,
          fontSize:"clamp(18px,3vw,28px)",
          color:"#fbbf24",
          letterSpacing:"4px",
          animation:"textReveal 1.2s cubic-bezier(0.16,1,0.3,1) 0.3s both",
          textTransform:"uppercase",
          marginBottom:12,
        }}>
          WELCOME TO
        </div>
        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:800,
          fontSize:"clamp(26px,5vw,48px)",
          letterSpacing:"5px",
          animation:"textReveal 1.4s cubic-bezier(0.16,1,0.3,1) 0.5s both, shimmer 4s linear infinite",
          textTransform:"uppercase",
          lineHeight:1.1,
          marginBottom:8,
          background:"linear-gradient(90deg,#92400e,#fbbf24,#fef3c7,#fbbf24,#f59e0b,#92400e)",
          backgroundSize:"300% auto",
          WebkitBackgroundClip:"text",
          WebkitTextFillColor:"transparent",
          backgroundClip:"text",
          filter:"drop-shadow(0 0 18px rgba(251,191,36,0.8))",
        }}>
          SCORPION ARABIA
        </div>
        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:600,
          fontSize:"clamp(14px,2.5vw,20px)",
          color:"#38bdf8",
          letterSpacing:"6px",
          animation:"textReveal 1.4s cubic-bezier(0.16,1,0.3,1) 0.7s both",
          textTransform:"uppercase",
        }}>
          PORTAL
        </div>
        <div style={{
          width:80, height:2,
          background:"linear-gradient(90deg,transparent,#fbbf24,transparent)",
          margin:"18px auto 0",
          animation:"subReveal 1s ease 1.2s both",
        }}/>
      </div>

      {/* Enter button */}
      <button onClick={handleEnter} style={{
        background:"linear-gradient(135deg,#fbbf24,#f59e0b)",
        border:"none", borderRadius:999,
        padding:"14px 48px",
        fontFamily:"'Barlow Condensed',sans-serif",
        fontWeight:800, fontSize:16,
        color:"#080b10",
        letterSpacing:"2px",
        textTransform:"uppercase",
        cursor:"pointer",
        boxShadow:"0 4px 24px rgba(251,191,36,0.4)",
        animation:"subReveal 1s ease 1.5s both",
        transition:"transform 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.boxShadow="0 6px 32px rgba(251,191,36,0.6)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 24px rgba(251,191,36,0.4)";}}
      >
        ENTER PORTAL
      </button>

      {/* Bottom tagline */}
      <div style={{
        position:"absolute", bottom:32,
        fontSize:11, color:"rgba(255,255,255,0.3)",
        letterSpacing:"2px", textTransform:"uppercase",
        fontFamily:"'Barlow Condensed',sans-serif",
        animation:"subReveal 1s ease 2s both",
      }}>
        Document & Asset Management System
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT ANALYSIS PAGE
   ─ Progress = totalInvoiced / poValue  (live from projectDocs invoices)
   ─ Each "Job" = a group of invoices sharing the same jobNo under a project
   ─ Daily reports are stored per project analysis record
════════════════════════════════════════════════════════════════════════════ */

/* ── pure helpers ── */
function pctColor(p) {
  if (p >= 80) return T.green;
  if (p >= 40) return T.blue;
  if (p >= 20) return T.gold;
  return T.red;
}
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

/* Derive live stats for one project from projectDocs invoices */
function deriveProjectStats(projectName, projectDocs) {
  const invs  = (projectDocs || []).filter(d => d.subTab === "invoices"     && d.project === projectName);
  const certs = (projectDocs || []).filter(d => d.subTab === "certificates" && d.project === projectName);

  const totalInvoiced  = invs.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const totalCollected = invs.reduce((s, d) => s + getInvoiceCollectedAmount(d), 0);
  const totalDue       = invs.reduce((s, d) => s + getInvoiceRemainingAmount(d), 0);

  // Group ONLY invoices/certs that have a jobNo into named job phases
  const jobMap = {};
  invs.forEach(d => {
    const key = d.jobNo ? String(d.jobNo).trim() : null;
    if (!key) return;
    if (!jobMap[key]) jobMap[key] = { jobNo: key, invoices: [], certs: [] };
    jobMap[key].invoices.push(d);
  });
  certs.forEach(d => {
    const key = d.jobNo ? String(d.jobNo).trim() : null;
    if (!key) return;
    if (!jobMap[key]) jobMap[key] = { jobNo: key, invoices: [], certs: [] };
    jobMap[key].certs.push(d);
  });

  const jobs = Object.values(jobMap).map(j => ({
    ...j,
    totalInvoiced:  j.invoices.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0),
    totalCollected: j.invoices.reduce((s, d) => s + getInvoiceCollectedAmount(d), 0),
    totalDue:       j.invoices.reduce((s, d) => s + getInvoiceRemainingAmount(d), 0),
  })).sort((a, b) => a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true }));

  // Invoices & certs with no jobNo shown as a flat list
  const ungroupedInvs  = invs.filter(d => !d.jobNo);
  const ungroupedCerts = certs.filter(d => !d.jobNo);

  return { invs, certs, totalInvoiced, totalCollected, totalDue, jobs, ungroupedInvs, ungroupedCerts };
}

/* ── Daily Report Modal ── */
/* ── Bulk Daily Report Import (multiple rows from one Excel) ── */
function BulkDailyReportImport({ projectName, onImport }) {
  const [status, setStatus] = useState(null); // null | "parsing" | {count,skipped}  | "error"
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setStatus("parsing");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseDailyReportExcel(e.target.result);
        if (!rows.length) { setStatus("error"); return; }
        onImport(rows);
        setStatus({ count: rows.length });
        setTimeout(() => setStatus(null), 3000);
      } catch(err) {
        console.error(err);
        setStatus("error");
        setTimeout(() => setStatus(null), 3000);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <button onClick={()=>fileRef.current.click()} disabled={status==="parsing"}
        style={{background:T.goldDim,border:`1px solid ${T.gold}44`,color:T.gold,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:status==="parsing"?"wait":"pointer",display:"flex",alignItems:"center",gap:6}}>
        {status==="parsing"?"⏳ Importing…":"📊 Bulk Import Excel"}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}}
        onChange={e=>{if(e.target.files[0]){handleFile(e.target.files[0]);e.target.value="";}}}/>
      {status&&status!=="parsing"&&status!=="error"&&(
        <span style={{fontSize:12,color:T.green,fontWeight:700}}>✓ {status.count} row{status.count!==1?"s":""} imported</span>
      )}
      {status==="error"&&<span style={{fontSize:12,color:T.red,fontWeight:700}}>✕ Parse failed</span>}
    </div>
  );
}

/* ── Excel column map for daily report import ───────────────────────────── */
const DR_COL_MAP = {
  "DATE":"date","REPORT DATE":"date","DAY":"date",
  "WEATHER":"weather","WEATHER CONDITIONS":"weather","CONDITIONS":"weather",
  "ACTIVITIES":"activities","WORK DONE":"activities","WORK":"activities","ACTIVITY":"activities","DESCRIPTION":"activities","WORK DESCRIPTION":"activities",
  "MANPOWER":"manpower","MANPOWER COUNT":"manpower","WORKERS":"manpower","NO. OF WORKERS":"manpower","HEADCOUNT":"manpower","NO OF WORKERS":"manpower",
  "EQUIPMENT":"equipment","EQUIPMENT USED":"equipment","PLANT":"equipment","PLANT & EQUIPMENT":"equipment","MACHINERY":"equipment",
  "ISSUES":"issues","DELAYS":"issues","ISSUES / DELAYS":"issues","PROBLEMS":"issues","REMARKS":"issues",
  "NOTES":"notes","ADDITIONAL NOTES":"notes","COMMENTS":"notes","SUPERVISOR NOTES":"notes",
};

/* ── Scorpion DPR template cell reader ───────────────────────────────────── */
function dprReadCell(ws, ref) {
  if (!ws[ref]) return "";
  const c = ws[ref];
  if (c.t === "d" || c.v instanceof Date) return excelDateToStr(c.v) || c.w || "";
  if (c.v !== undefined && c.v !== null) return String(c.v).trim();
  return c.w ? String(c.w).trim() : "";
}

/* ── Project helpers ─────────────────────────────────────────────────────── */

export { WelcomeScreen };
