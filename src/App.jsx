import { useState, useEffect, useRef, Fragment } from "react";
import * as XLSX from "xlsx";

/* ─── Global CSS ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: 'Barlow', sans-serif; background: #f0e6d3; color: #1a0a00; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #f0e6d3; }
  ::-webkit-scrollbar-thumb { background: #e8d5b7; border-radius: 3px; }
  input, select, textarea, button { font-family: 'Barlow', sans-serif; }
  button { cursor: pointer; }
  /* Responsive font scaling */
  html { font-size: 16px; }
  @media (min-width: 1400px) { html { font-size: 17px; } }
  @media (min-width: 1800px) { html { font-size: 19px; } }
  @media (max-width: 768px)  { html { font-size: 14px; } }
  

  /* Responsive layout helpers */
  .resp-grid-2 { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr)); gap:clamp(10px,1.5vw,20px); }
  .resp-grid-3 { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr)); gap:clamp(10px,1.5vw,18px); }
  .resp-grid-4 { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr)); gap:clamp(8px,1.2vw,16px); }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
  @keyframes fadeDown  { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(32px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);} }
  @keyframes fadeIn    { from{opacity:0;}to{opacity:1;} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(24px);}to{opacity:1;transform:translateX(0);} }
  @keyframes popIn     { 0%{opacity:0;transform:scale(0.88);}70%{transform:scale(1.03);}100%{opacity:1;transform:scale(1);} }
  @keyframes shimmer   { 0%{background-position:-300% center;}100%{background-position:300% center;} }
  @keyframes floatUp   { 0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);} }
  @keyframes goldGlow  { 0%,100%{filter:drop-shadow(0 0 6px rgba(251,191,36,0.4));}50%{filter:drop-shadow(0 0 16px rgba(251,191,36,0.9));} }
  @keyframes logoSpin  { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
  @keyframes logoPulse { 0%,100%{transform:scale(1);}25%{transform:scale(1.04);}75%{transform:scale(0.97);} }
  @keyframes gradShift { 0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;} }
  @keyframes countUp   { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
  @keyframes spinSlow   { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
  @keyframes pulse      { 0%,100%{transform:scale(1);}50%{transform:scale(1.06);} }
  @keyframes glowRing   { 0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,0);}50%{box-shadow:0 0 0 18px rgba(251,191,36,0.18);} }
  @keyframes textReveal { from{opacity:0;letter-spacing:12px;}to{opacity:1;letter-spacing:4px;} }
  @keyframes subReveal  { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
  @keyframes fadeOut    { from{opacity:1;}to{opacity:0;} }
  @keyframes modalFloatIn {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

  .fade-up   { animation: fadeUp   0.35s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-down { animation: fadeDown 0.3s ease both; }
  .slide-up  { animation: slideUp  0.42s cubic-bezier(0.34,1.3,0.64,1) both; }
  .fade-in   { animation: fadeIn   0.22s ease both; }
  .slide-in  { animation: slideIn  0.32s cubic-bezier(0.22,1,0.36,1) both; }
  .pop-in    { animation: popIn    0.4s  cubic-bezier(0.34,1.3,0.64,1) both; }
  .spin-slow  { animation: spinSlow 8s linear infinite; }
  .pulse-logo { animation: pulse 3s ease-in-out infinite; }
  .glow-ring  { animation: glowRing 2.5s ease-in-out infinite; }

  /* Logo animations */
  .logo-animate      { animation: logoPulse 5s ease-in-out infinite; }
  .logo-ring-spin    { animation: logoSpin 12s linear infinite; }
  .logo-ring-spin-rev{ animation: logoSpin 18s linear infinite reverse; }

  /* Card hover lift */
  .card-hover { transition: transform 0.22s ease, box-shadow 0.22s ease; }
  .card-hover:hover { transform: translateY(-4px) !important; box-shadow: 0 10px 32px rgba(26,10,0,0.16) !important; }

  /* Nav item hover indent */
  .nav-item { transition: background 0.15s, padding-left 0.18s; }
  .nav-item:hover { padding-left: 18px !important; }

  /* Gold shimmer text */
  .gold-text {
    background: linear-gradient(90deg,#d97706,#fbbf24,#fde68a,#fbbf24,#d97706);
    background-size: 200% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; animation: shimmer 10s ease-in-out infinite;
  }
  /* App card base */
  .app-card {
    background: #fdf8f0; border: 1px solid #e8d5b7; border-radius: 14px;
    box-shadow: 0 2px 8px rgba(26,10,0,0.06), 0 0 0 1px rgba(232,213,183,0.4);
  }

  /* Dark mode */
  body.dark-mode { background: #0d1117 !important; color: #e8edf5 !important; }
  body.dark-mode ::-webkit-scrollbar-track { background: #0d1117; }
  body.dark-mode ::-webkit-scrollbar-thumb { background: #1e293b; }

  /* Search highlight */
  .search-match { background: rgba(251,191,36,0.3); border-radius:3px; }

  /* Mobile responsive */
  @media (max-width:1200px) {
  .hide-mobile { display:none !important; }
  .mobile-full { width:100% !important; }
}
@media (min-width:1201px) {
  .show-mobile-only { display:none !important; }
}

  /* Export button pulse */
  @keyframes exportPulse { 0%,100%{opacity:1;}50%{opacity:0.6;} }
`;

/* ─── Theme ──────────────────────────────────────────────────────────────── */
const LIGHT = {
  bg:"#f0e6d3",
  sidebar:"#080b10",
  card:"#fdf8f0",
  card2:"#f7f0e6",
  cardHover:"#f0e6d3",
  border:"#e8d5b7",
  borderLight:"#dcc9a0",
  text:"#1a0a00",
  textSub:"#5c3d1e",
  textMuted:"#a07850",
  blue:"#38bdf8",
  green:"#34d399",
  gold:"#fbbf24",
  red:"#f87171",
  purple:"#a78bfa",
  teal:"#2dd4bf",
  orange:"#fb923c",
  blueDim:"rgba(56,189,248,0.12)",
  greenDim:"rgba(52,211,153,0.12)",
  goldDim:"rgba(251,191,36,0.12)",
  redDim:"rgba(248,113,113,0.12)",
  purpleDim:"rgba(167,139,250,0.12)",
  tealDim:"rgba(45,212,191,0.12)",
  orangeDim:"rgba(251,146,60,0.12)",
  inputBg:"#fdf8f0",
  shadow:"0 2px 12px rgba(26,10,0,0.08), 0 0 0 1px rgba(232,213,183,0.6)",
};

/* ─── Dark theme ─────────────────────────────────────────────────────────── */
const DARK = {
  bg:"#0d1117", sidebar:"#0a0e14", card:"#161b22", card2:"#1c2333", cardHover:"#21262d",
  border:"#30363d", borderLight:"#3d444d",
  text:"#ffffff", textSub:"#e6edf3", textMuted:"#b1bac4",
  blue:"#38bdf8", green:"#34d399", gold:"#fbbf24", red:"#f87171",
  purple:"#a78bfa", teal:"#2dd4bf", orange:"#fb923c",
  blueDim:"rgba(56,189,248,0.12)", greenDim:"rgba(52,211,153,0.12)",
  goldDim:"rgba(251,191,36,0.12)", redDim:"rgba(248,113,113,0.12)",
  purpleDim:"rgba(167,139,250,0.12)", tealDim:"rgba(45,212,191,0.12)",
  orangeDim:"rgba(251,146,60,0.12)",
  inputBg:"#0d1117", shadow:"0 4px 16px rgba(0,0,0,0.4)",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const uid       = () => Math.random().toString(36).slice(2,9);
const daysUntil = d  => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const fmtDate = d => {
  if (!d) return "No Date";

  let dateObj;

  if (d instanceof Date) {
    dateObj = d;
  } else if (typeof d === "number") {
    dateObj = new Date(Math.round((d - 25569) * 86400 * 1000));
  } else {
    dateObj = new Date(d);
  }

  if (isNaN(dateObj.getTime())) return "No Date";

  return dateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
function formatSarCompact(value) {
  const num = Number(value || 0);
  if (!num) return "—";

  if (num >= 1_000_000_000) {
    return `SAR ${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (num >= 1_000_000) {
    return `SAR ${(num / 1_000_000).toFixed(2)}M`;
  }

  if (num >= 1_000) {
    return `SAR ${(num / 1_000).toFixed(0)}K`;
  }

  return `SAR ${num.toLocaleString()}`;
}

function getInvoiceRemainingAmount(doc) {
  const total = parseFloat(doc?.amount) || 0;
  const status = String(doc?.paymentStatus || doc?.status || "").toLowerCase();

  if (status === "paid" || status === "received") return 0;
  if (status === "partial") {
    const remaining = parseFloat(doc?.remainingAmount);
    if (Number.isFinite(remaining)) {
      return Math.max(0, Math.min(total, remaining));
    }
    return total;
  }
  return total;
}

function getInvoiceCollectedAmount(doc) {
  const total = parseFloat(doc?.amount) || 0;
  return Math.max(0, total - getInvoiceRemainingAmount(doc));
}

function getInvoiceStream(doc) {
  const explicit = String(doc?.invoiceType || "").trim().toLowerCase();
  if (explicit === "advance") return "advance";
  if (explicit === "income") return "income";

  const raw = [doc?.type, doc?.category, doc?.kind, doc?.notes, doc?.name, doc?.refNo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /advance|mobilization|mobilisation/.test(raw) ? 'advance' : 'income';
}


function getMetricTypeTheme(type) {
  const isAdvance = String(type || "").toLowerCase() === "advance";
  const accent = isAdvance ? T.gold : T.blue;
  const dim = isAdvance ? T.goldDim : T.blueDim;
  const glow = isAdvance ? 'rgba(251,191,36,0.22)' : 'rgba(56,189,248,0.22)';
  return { accent, dim, glow };
}
/* ─── Active theme (module-level, updated by App) ───────────────────────── */
let T = LIGHT; // default to light, App.setTheme() updates this
function setTheme(dark) { T = dark ? DARK : LIGHT; }

function useViewport() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return viewport;
}

/* ─── Export utilities ───────────────────────────────────────────────────── */
function exportToExcel(rows, filename) {
  if(!rows||!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename + ".xlsx");
}

function ExportBtn({data, filename, label}) {
  return (
    <button onClick={()=>exportToExcel(data, filename)}
      style={{background:"rgba(52,211,153,0.12)",border:"1px solid rgba(52,211,153,0.3)",color:"#34d399",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6,cursor:"pointer",transition:"all .15s"}}
      onMouseEnter={e=>{e.currentTarget.style.background="rgba(52,211,153,0.22)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="rgba(52,211,153,0.12)";}}>
      ⬇ {label||"Export Excel"}
    </button>
  );
}

function getStatus(days) {
  if (days === null) return { label:"Unknown",       color:T.textMuted, bg:"rgba(61,80,104,.15)" };
  if (days < 0)      return { label:"Expired",       color:T.red,       bg:T.redDim };
  if (days <= 90)    return { label:"Expiring Soon", color:T.gold,      bg:T.goldDim };
  return               { label:"Valid",            color:T.green,     bg:T.greenDim };
}

/* ─── Default data ───────────────────────────────────────────────────────── */
const DEFAULT_SCORPION_CATS = [
  "Company Registration / CR",
  "Insurance Policies",
  "Trade Licenses",
  "Contracts & Agreements",
  "IBAN",
  "Other",
];

const DEFAULT_MANPOWER_CATS = [
  "Drillers / Operators",
  "Safety Officers (HSE)",
  "Supervisors",
  "Laborers / General Workers",
];


/* ─── Excel column maps ──────────────────────────────────────────────────── */
// Manpower certifications Excel map
// Expected columns: NAME, EMPLOYEE ID, CERTIFICATE, CERT NO, ISSUE DATE, EXPIRY DATE
// (flexible - tries multiple common header names)
const MP_CERT_MAP = {
  // Exact headers from TUV_Manpower_Tracker.xlsx (headers on row 4)
  "NAME":"name","EMPLOYEE NAME":"name","EMPLOYEE":"name",
  "ID":"idNo","EMPLOYEE ID":"idNo","EMPLOYEE NO":"idNo","EMP ID":"idNo","EMP NO":"idNo","ID NO":"idNo","ID NUMBER":"idNo","STAFF ID":"idNo",
  "CERTIFICATE":"certName","CERTIFICATE TYPE":"certName","CERT TYPE":"certName","CERTIFICATION":"certName",
  "ISSUED BY":"issuedBy","ISSUING BODY":"issuedBy","ISSUING AUTHORITY":"issuedBy",
  "CERT NO":"certNo","CERTIFICATE NO":"certNo","CERT NO.":"certNo","CERTIFICATE NO.":"certNo","CERTIFICATE NUMBER":"certNo",
  "ISSUE DATE":"issueDate","ISSUED DATE":"issueDate","DATE ISSUED":"issueDate","START DATE":"issueDate",
  "EXPIRY DATE":"expiryDate","EXPIRY":"expiryDate","EXPIRE DATE":"expiryDate","EXPIRATION DATE":"expiryDate",
  "REMARKS":"remarks","NOTES":"remarks",
};
// Manpower file has headers on row 4 — handled by skipToHeaderRow below
const MP_HEADER_ROW = 1;

// Equipment certifications Excel map
// Expected columns: EQUIPMENT, SERIAL NO, CERT NO, ISSUED BY, INSPECTION DATE, EXPIRY DATE
const EQ_CERT_MAP = {
  // TUV MASTERSHEET headers: Item Type, EQUIPMENT, Serial No, Issued By, Inspection Date, Expiry Date
  // Sheet3 headers:          Item Type, Item Name/ID, Reg/Serial No, TUV Provider, Start Date, Expiry Date
  "ITEM TYPE":"itemType",
  "EQUIPMENT ":"eqName","EQUIPMENT":"eqName","ITEM NAME/ID":"eqName","EQUIPMENT NAME":"eqName","UNIT":"eqName",
  "SERIAL NO":"serialNo","SERIAL NO.":"serialNo","REG/SERIAL NO":"serialNo","SERIAL NUMBER":"serialNo","S/N":"serialNo",
  "ISSUED BY":"issuedBy","TUV PROVIDER":"issuedBy","PROVIDER":"issuedBy","ISSUING AUTHORITY":"issuedBy",
  "INSPECTION DATE":"issueDate","START DATE":"issueDate","ISSUE DATE":"issueDate","ISSUED DATE":"issueDate",
  "EXPIRY DATE":"expiryDate","EXPIRY":"expiryDate","EXPIRE DATE":"expiryDate","EXPIRATION DATE":"expiryDate",
  "CERT NO":"certNo","CERTIFICATE NO":"certNo","CERT NO.":"certNo","CERTIFICATE NUMBER":"certNo",
  "REMARKS":"remarks","NOTES":"remarks",
};
const EQ_HEADER_ROW = 1;

function excelDateToStr(val) {
  if (!val) return "";
  // JS Date object (from cellDates:true)
  if (val instanceof Date) { if(!isNaN(val)) return val.toISOString().slice(0,10); }
  if (typeof val==="number") { const d=new Date(Math.round((val-25569)*86400*1000)); return d.toISOString().slice(0,10); }
  if (typeof val==="string") {
    if(val.startsWith("=")) return ""; // skip formulas
    const d=new Date(val); if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  return "";
}

function parseExcelRows(rows, map) {
  const DATE_KEYS=["expiryDate","issueDate","inspectionDate","startDate"];
  return rows
    .filter(row=>Object.values(row).some(v=>v!==null&&v!==""))
    .map(row=>{
      const rec={id:uid()};
      // Uppercase all keys for case-insensitive matching
      const upper={};
      Object.entries(row).forEach(([k,v])=>{ upper[String(k).toUpperCase().trim()]=v; });
      Object.entries(map).forEach(([col,key])=>{
        // Strip map key too (handles "EQUIPMENT " trailing space etc.)
        const val=upper[col.toUpperCase().trim()];
        if(val===undefined||val===null||val==="") return;
        const strVal=String(val);
        // Skip Excel formula cells
        if(strVal.startsWith("=")) return;
        rec[key]=DATE_KEYS.includes(key)?excelDateToStr(val):strVal.trim();
      });
      return rec;
    })
    // Filter out rows where only id was set (no real data mapped)
    .filter(rec=>Object.keys(rec).filter(k=>k!=="id").length>0);
}

// Parse Excel with a specific header row (1-based)
function parseExcelWithHeaderRow(arrayBuffer, map, headerRow) {
  const wb = XLSX.read(arrayBuffer, {type:"array", cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  // range: headerRow-1 makes XLSX use that row as the header
  const rawRows = XLSX.utils.sheet_to_json(ws, {defval:"", range: headerRow - 1});
  // Normalize: uppercase all keys so map lookup always works
  const rows = rawRows.map(row => {
    const norm = {};
    Object.entries(row).forEach(([k,v]) => { norm[k.toUpperCase().trim()] = v; });
    return norm;
  });
  return parseExcelRows(rows, map);
}

/* ─── EmailJS Config ──────────────────────────────────────────────────────── */
const EMAILJS_SERVICE_ID        = "service_628rnep";
const EMAILJS_TEMPLATE_ID       = "template_uro8tbd";
const EMAILJS_MAINT_TEMPLATE_ID = "template_j1n2tbr"; // Maintenance ticket notification
const EMAILJS_PUBLIC_KEY        = "ZmHZyJMawS8ZflAZJ";
const NOTIFY_STORAGE_KEY  = "cta_notify_settings";
const NOTIFY_LAST_SENT_KEY = "cta_notify_last_sent";

function loadNotifySettings() {
  try {
    const s = localStorage.getItem(NOTIFY_STORAGE_KEY);
    if (!s) return { enabled: false, emails: [], thresholdDays: 90, maintEmails: [] };
    const p = JSON.parse(s);
    // migrate old single-email field
    if (!p.emails) p.emails = p.email ? [p.email] : [];
    return p;
  } catch { return { enabled: false, emails: [], thresholdDays: 90 }; }
}

function saveNotifySettings(s) {
  try { localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function buildEmailPayload(alertsToSend, recipientEmail, isTest = false) {
  const overdue  = alertsToSend.filter(a => a.days < 0).sort((a,b) => a.days - b.days);
  const expiring = alertsToSend.filter(a => a.days >= 0).sort((a,b) => a.days - b.days);
  const today    = new Date().toLocaleDateString("en-GB", {weekday:"long",year:"numeric",month:"long",day:"numeric"});

  // Group by category
  const grouped = {};
  alertsToSend.forEach(a => {
    const cat = a.src || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  // Rich plain-text message (used in template as {{alert_list}})
  const lines = [];
  lines.push(`Scorpion Arabia — Document & Asset Manager`);
  lines.push(`Alert Report: ${today}`);
  lines.push(`${"─".repeat(50)}`);
  lines.push(`SUMMARY: ${alertsToSend.length} alert(s) — ${overdue.length} overdue, ${expiring.length} expiring soon`);
  lines.push(``);

  if (overdue.length > 0) {
    lines.push(`🔴 OVERDUE ITEMS (${overdue.length})`);
    lines.push(`${"─".repeat(40)}`);
    overdue.forEach(a => {
      lines.push(`  ✕ ${a.label}`);
      lines.push(`    Category : ${a.src}`);
      lines.push(`    Status   : OVERDUE by ${Math.abs(a.days)} day${Math.abs(a.days)!==1?"s":""}`);
      lines.push(``);
    });
  }

  if (expiring.length > 0) {
    lines.push(`🟡 EXPIRING SOON (${expiring.length})`);
    lines.push(`${"─".repeat(40)}`);
    expiring.forEach(a => {
      lines.push(`  ⚠ ${a.label}`);
      lines.push(`    Category : ${a.src}`);
      lines.push(`    Expires  : in ${a.days} day${a.days!==1?"s":""}`);
      lines.push(``);
    });
  }

  // Grouped summary
  lines.push(`${"─".repeat(50)}`);
  lines.push(`BY CATEGORY:`);
  Object.entries(grouped).forEach(([cat, items]) => {
    const od = items.filter(i => i.days < 0).length;
    const ex = items.filter(i => i.days >= 0).length;
    lines.push(`  ${cat}: ${items.length} total (${od} overdue, ${ex} expiring)`);
  });

  lines.push(``);
  lines.push(`This is an ${isTest?"TEST ":""}automated alert from Scorpion Arabia Portal.`);
  lines.push(`Please log in to review and action these items.`);

  return {
    to_email:       recipientEmail,
    subject:        `${isTest?"[TEST] ":""}Scorpion Arabia Alerts — ${alertsToSend.length} item${alertsToSend.length!==1?"s":""} require attention (${new Date().toLocaleDateString("en-GB")})`,
    total_alerts:   alertsToSend.length,
    overdue_count:  overdue.length,
    expiring_count: expiring.length,
    alert_list:     lines.join("\n"),
    sent_date:      today,
  };
}
function buildMaintenanceEmailPayload(ticket, eqName, recipientEmail) {
  const today = new Date().toLocaleDateString("en-GB", {weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const lines = [];
  lines.push(`Scorpion Arabia — Maintenance Ticket Raised`);
  lines.push(`${"─".repeat(50)}`);
  lines.push(`A new maintenance ticket has been raised on ${today}.`);
  lines.push(``);
  lines.push(`TICKET DETAILS`);
  lines.push(`${"─".repeat(40)}`);
  lines.push(`  Equipment     : ${eqName || "—"}`);
  lines.push(`  Project       : ${ticket.project || "—"}`);
  lines.push(`  Raised By     : ${ticket.raisedBy || "—"}`);
  lines.push(`  Date          : ${ticket.raisedAt || today}`);
  lines.push(`  Status        : Open`);
  lines.push(``);
  lines.push(`  Description   : ${ticket.description || "—"}`);
  if (ticket.reason)          lines.push(`  Reason        : ${ticket.reason}`);
  if (ticket.serviceProvider) lines.push(`  Service Prov. : ${ticket.serviceProvider}`);
  if (ticket.cost)            lines.push(`  Est. Cost     : SAR ${Number(ticket.cost).toLocaleString()}`);
  lines.push(``);
  lines.push(`${"─".repeat(50)}`);
  lines.push(`Please log in to the Scorpion Arabia Portal to review and action this ticket.`);

  return {
    to_email:         recipientEmail,
    subject:          `🛠 Maintenance Ticket Raised — ${eqName}${ticket.project ? " / " + ticket.project : ""} (${ticket.raisedBy || "Unknown"})`,
    ticket_equipment: eqName || "—",
    ticket_project:   ticket.project || "—",
    ticket_raised_by: ticket.raisedBy || "—",
    ticket_date:      ticket.raisedAt || today,
    ticket_desc:      ticket.description || "—",
    ticket_reason:    ticket.reason || "—",
    ticket_provider:  ticket.serviceProvider || "—",
    ticket_cost:      ticket.cost ? `SAR ${Number(ticket.cost).toLocaleString()}` : "—",
    ticket_status:    "Open",
    alert_list:       lines.join("\n"),
    sent_date:        today,
  };
}

function sendMaintenanceEmail(ticket, eqName, maintEmails) {
  if (!maintEmails || !maintEmails.length) return;
  if (!window.emailjs) return;
  maintEmails.forEach(email => {
    const payload = buildMaintenanceEmailPayload(ticket, eqName, email);
    window.emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_MAINT_TEMPLATE_ID, payload)
      .then(() => console.log(`Maintenance email sent to ${email}`))
      .catch(err => console.warn("Maintenance email failed:", err));
  });
}

const COMPANY_PASSWORD  = "scorpion2025"; // Change this to your desired password
const AUTH_KEY          = "cta_auth";
const FINANCE_PASSWORD  = "finance2025"; // Change this to your desired finance password
const ANALYSIS_PASSWORD = "analysis2025";
const COST_PASSWORD     = "cost2025"; // Change this to your desired cost control password

/* ─── Supabase config — paste your values here after setup ──────────────── */
const SUPABASE_URL    = "https://rgjyvbcqstkteprfrgnu.supabase.co";
const SUPABASE_ANON   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnanl2YmNxc3RrdGVwcmZyZ251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NzI5MDEsImV4cCI6MjA5MTA0ODkwMX0.kzVvgeuCx001S-POe-pQANmz84ddUGuNzKEt8gpv1R8";
const STORAGE_BUCKET  = "portal-files";
async function fetchAppData() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=data`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });

  if (!res.ok) throw new Error("Failed to load app data");

  const rows = await res.json();
  if (!rows.length || !rows[0].data) return EMPTY_DATA;

  return { ...EMPTY_DATA, ...rows[0].data };
}
async function uploadToSupabase(file, folder) {
  const ext   = file.name.split(".").pop();
  const path  = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const res   = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method:"POST",
    headers:{"Authorization":`Bearer ${SUPABASE_ANON}`,"Content-Type":file.type,"x-upsert":"true"},
    body: file,
  });
  if (!res.ok) { const e=await res.json(); throw new Error(e.message||"Upload failed"); }
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
async function saveAppData(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      data,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) throw new Error("Failed to save app data");
}
function isSupabaseConfigured() {
  return SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON !== "YOUR_SUPABASE_ANON_KEY";
}

function getPreviewUrl(url) {
  if (!url) return null;
  // OneDrive: convert share link to embed
  if (url.includes("1drv.ms") || url.includes("onedrive.live.com")) {
    const encoded = encodeURIComponent(url);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
  }
  // SharePoint
  if (url.includes("sharepoint.com")) {
    return url.includes("?") ? url + "&action=embedview" : url + "?action=embedview";
  }
  // Google Drive: convert to embed
  if (url.includes("drive.google.com")) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  // Supabase public URL (PDF/image — direct embed)
  if (url.includes("supabase.co/storage")) return url;
  return url;
}

function isAuthenticated() {
  try { return localStorage.getItem(AUTH_KEY) === "true"; } catch { return false; }
}

const EMPTY_DATA = {
  scorpionDocs: [],
  manpowerCats: DEFAULT_MANPOWER_CATS,
  manpower: [],
  equipment: [],
  scorpionDocCats: DEFAULT_SCORPION_CATS,
  projects: [{name:"NEOM Phase 1",client:"NEOM"},{name:"NEOM Phase 2",client:"NEOM"},{name:"Riyadh Metro",client:"Saudi Rail"}],
  projectDocs: [],
  projectAnalysis: [],
  rigs: [],          // { id, project, name }
  costControl: [],  // { id, project, category, description, amount, date, refNo, notes, budgeted }
                    // category: "Labour"|"Equipment"|"Materials"|"Subcontractor"|"Overhead"|"Other"
};


/* ════════════════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════════
   LOGIN PAGE
════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
   WELCOME SCREEN
════════════════════════════════════════════════════════════════════════════ */
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
const pName = p => typeof p === "string" ? p : (p?.name ?? "");

function renderProjectOptions(projects) {
  const byClient = {};
  const noClient = [];
  (projects || []).forEach(p => {
    const n = pName(p);
    const c = typeof p === "object" ? p.client : "";
    if (c) { if (!byClient[c]) byClient[c] = []; byClient[c].push(n); }
    else noClient.push(n);
  });
  const clients = Object.keys(byClient).sort();
  return (
    <>
      {clients.map(c => (
        <optgroup key={c} label={"▸ " + c}>
          {byClient[c].map(n => <option key={n} value={n}>{n}</option>)}
        </optgroup>
      ))}
      {noClient.length > 0 && clients.length > 0
        ? <optgroup label="▸ Other">{noClient.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
        : noClient.map(n => <option key={n} value={n}>{n}</option>)
      }
    </>
  );
}

function dprReadRange(ws, rangeStr) {
  try {
    const range = XLSX.utils.decode_range(rangeStr);
    const parts = new Set();
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c2 = range.s.c; c2 <= range.e.c; c2++) {
        const ref = XLSX.utils.encode_cell({r, c:c2});
        if (ws[ref]?.v != null && String(ws[ref].v).trim()) parts.add(String(ws[ref].v).trim());
      }
    }
    return [...parts].join(" ");
  } catch { return ""; }
}

/* Detect if workbook is the Scorpion DPR template.
   The template always has a sheet named "Daily DPR Form". */
function isScorpionDprTemplate(wb) {
  return wb.SheetNames.includes("Daily DPR Form");
}

/* Read a cell value cleanly — handles dates, numbers (including 0), strings.
   Falls back to the merge anchor map if the cell itself is empty. */
function dprReadExact(ws, ref, mergeMap) {
  const c = ws[ref];
  if (c !== undefined) {
    // Date type
    if (c.t === "d" || c.v instanceof Date) return excelDateToStr(c.v) || c.w || "";
    // Any value including numeric 0
    if (c.v !== undefined && c.v !== null) return String(c.v).trim();
    if (c.w) return String(c.w).trim();
  }
  // Merged cell — value lives in the anchor cell, not here
  return (mergeMap && mergeMap[ref]) ? mergeMap[ref] : "";
}

/* Parse the Scorpion DPR template.
   PRIMARY: reads the ERP field table in columns L/M (most reliable, no merge issues).
   FALLBACK: reads the exact named cells directly. */
function parseScorpionDprSheet(wb) {
  const ws = wb.Sheets["Daily DPR Form"] || wb.Sheets[wb.SheetNames[0]];

  // Build merge map so any cell in a merged region resolves to the anchor value
  const mergeMap = {};
  if (ws["!merges"]) {
    ws["!merges"].forEach(m => {
      const anchorRef = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      const ac = ws[anchorRef];
      let v = "";
      if (ac) {
        if (ac.t === "d" || ac.v instanceof Date) v = excelDateToStr(ac.v) || ac.w || "";
        else if (ac.v !== undefined && ac.v !== null) v = String(ac.v).trim();
        else if (ac.w) v = String(ac.w).trim();
      }
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c2 = m.s.c; c2 <= m.e.c; c2++) {
          mergeMap[XLSX.utils.encode_cell({ r, c: c2 })] = v;
        }
      }
    });
  }

  const rd = (ref) => dprReadExact(ws, ref, mergeMap);

  // Read ERP key-value table from columns L & M (rows 1 onward)
  const erp = {};
  for (let row = 1; row <= 40; row++) {
    const key = rd(XLSX.utils.encode_cell({ r: row - 1, c: 11 }));   // col L
    const val = rd(XLSX.utils.encode_cell({ r: row - 1, c: 12 }));   // col M
    if (key) erp[key.trim()] = val;
  }

  // Helper: prefer ERP table value, fall back to direct cell read
  const get = (erpKey, cellRef) => {
    const erpVal = erp[erpKey];
    // ERP value of "0" is valid — only skip if truly missing
    if (erpVal !== undefined && erpVal !== null && erpVal !== "") return erpVal;
    return rd(cellRef);
  };

  // Date: ERP stores as Excel serial (number), direct cell is a Date object
  const rawDate = erp["report_date"] || rd("H8");
  const date = excelDateToStr(
    typeof rawDate === "string" && /^\d+$/.test(rawDate.trim())
      ? Number(rawDate)
      : rawDate
  ) || rawDate;

  return {
    id: uid(),
    dprSource: "scorpion_template",
    project:        get("project_name",  "C8"),
    date:           date,
    profile:        get("profile",       "C13"),
    activity:       get("activity",      "H13"),
    permitReceived: rd("C14"),
    permitHours:    rd("H14"),
    standbyReason:  rd("C15"),
    progressToday:  get("progress_today_m",   "E18"),
    accumulated:    get("accumulated_progress_m", "G18"),
    activities:     get("today_summary",  "A27") || dprReadRange(ws, "A27:I29"),
  };
}
function parseDailyReportExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type:"array", cellDates:true });

  // ── Scorpion DPR Template path — always try this first ──
  if (isScorpionDprTemplate(wb)) {
    const rec = parseScorpionDprSheet(wb);
    // Always return the record so the user can see what was parsed
    return [rec];
  }

  // ── Generic column-mapped path (legacy / other formats) ──
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval:"" });
  return rawRows
    .filter(row => Object.values(row).some(v => v !== null && v !== ""))
    .map(row => {
      const rec = { id: uid() };
      const upper = {};
      Object.entries(row).forEach(([k,v]) => { upper[String(k).toUpperCase().trim()] = v; });
      Object.entries(DR_COL_MAP).forEach(([col, key]) => {
        const val = upper[col];
        if (val === undefined || val === null || val === "") return;
        if (key === "date") {
          rec[key] = excelDateToStr(val) || String(val);
        } else {
          rec[key] = String(val).trim();
        }
      });
      return rec;
    })
    .filter(rec => Object.keys(rec).filter(k => k !== "id").length > 0);
}

function DailyReportModal({ report, projectName, onSave, onClose }) {
  const blank = { id: uid(), date: new Date().toISOString().slice(0,10), weather:"", activities:"", manpower:"", equipment:"", issues:"", notes:"", fileLink:"", fileName:"" };
  const [f, setF]         = useState(report ? { ...blank, ...report } : blank);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [parsing,   setParsing]   = useState(false);
  const [parseMsg,  setParseMsg]  = useState("");
  const fileRef = useRef();
  const excelRef = useRef();
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const IS = { width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:T.text, outline:"none" };
  const LS = { display:"block", fontSize:11, fontWeight:700, color:"#fff", marginBottom:5, letterSpacing:.5 };

  /* Upload daily report file (PDF/image/doc) to Supabase */
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true); setUploadErr("");
    try {
      const folder = `daily-reports/${(projectName||"general").replace(/[^a-zA-Z0-9]/g,"_")}`;
      const url = await uploadToSupabase(file, folder);
      upd("fileLink", url);
      upd("fileName", file.name);
    } catch(err) {
      setUploadErr("Upload failed: " + (err.message || "check Supabase config"));
    } finally {
      setUploading(false);
    }
  };

  /* Import from Excel — handles Scorpion DPR template + generic formats */
  const handleExcelImport = (file) => {
    if (!file) return;
    setParsing(true); setParseMsg("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseDailyReportExcel(e.target.result);
        if (!rows.length) { setParseMsg("⚠ No data rows found — check column headers."); setParsing(false); return; }
        const first = rows[0];
        setF(prev => ({ ...prev, ...first, id: prev.id }));
        const isScorpion = first.dprSource === "scorpion_template";
        setParseMsg(isScorpion
          ? "✓ Scorpion DPR template detected — all sections extracted. Review and save."
          : rows.length === 1
            ? "✓ Fields filled from Excel. Review and save."
            : `✓ ${rows.length} rows found — filled from first row. Use bulk import for all rows.`
        );
      } catch(err) {
        setParseMsg("✕ Could not parse Excel: " + err.message);
      }
      setParsing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:600,maxHeight:"93vh",overflowY:"auto",boxShadow:T.shadow,animation:"modalFloatIn .3s ease both"}}>

        {/* Header */}
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:T.card,zIndex:1,borderRadius:"18px 18px 0 0"}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{report?"✎ Edit Daily Report":"+ New Daily Report"}</div>
            {projectName&&<div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{projectName}</div>}
          </div>
          <button onClick={onClose} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>✕</button>
        </div>

        <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:16}}>

          {/* ── Excel import strip ── */}
          <div style={{background:`${T.gold}0f`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:T.gold,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
              <span>⬆</span> IMPORT FROM EXCEL SHEET
            </div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:10,lineHeight:1.5}}>
              Upload the supervisor's Excel daily report sheet to auto-fill the fields below.
              Expected columns: <span style={{color:T.text,fontWeight:600}}>Date, Weather, Activities, Manpower, Equipment, Issues, Notes</span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <button onClick={()=>excelRef.current.click()} disabled={parsing}
                style={{background:T.goldDim,border:`1px solid ${T.gold}44`,color:T.gold,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:parsing?"wait":"pointer",display:"flex",alignItems:"center",gap:6}}>
                {parsing?"⏳ Parsing…":"📊 Choose Excel File"}
              </button>
              <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}}
                onChange={e=>{if(e.target.files[0]){handleExcelImport(e.target.files[0]);e.target.value="";}}}/>
              {parseMsg&&<div style={{fontSize:12,color:parseMsg.startsWith("✓")?T.green:T.red,fontWeight:600,flex:1}}>{parseMsg}</div>}
            </div>
          </div>

          {/* ── Manual fields ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>DATE</label><input type="date" value={f.date} onChange={e=>upd("date",e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
            <div><label style={LS}>WEATHER</label><input value={f.weather} onChange={e=>upd("weather",e.target.value)} placeholder="e.g. Sunny, 38°C" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          </div>
          <div><label style={LS}>ACTIVITIES / WORK DONE</label><textarea value={f.activities} onChange={e=>upd("activities",e.target.value)} rows={3} placeholder="Describe the work carried out today…" style={{...IS,resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>MANPOWER COUNT</label><input type="number" min="0" value={f.manpower} onChange={e=>upd("manpower",e.target.value)} placeholder="e.g. 12" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
            <div><label style={LS}>EQUIPMENT USED</label><input value={f.equipment} onChange={e=>upd("equipment",e.target.value)} placeholder="e.g. Excavator, 2× Trucks" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          </div>
          <div><label style={LS}>ISSUES / DELAYS</label><textarea value={f.issues} onChange={e=>upd("issues",e.target.value)} rows={2} placeholder="Problems, delays, safety incidents…" style={{...IS,resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          <div><label style={LS}>ADDITIONAL NOTES</label><textarea value={f.notes} onChange={e=>upd("notes",e.target.value)} rows={2} placeholder="Inspector remarks, client feedback, etc." style={{...IS,resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>

          {/* ── Scorpion DPR extra fields (shown when template parsed) ── */}
          {f.dprSource==="scorpion_template" && (
            <div style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",background:T.goldDim,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:700,color:T.gold}}>📊 SCORPION DPR — EXTRACTED FIELDS</span>
              </div>
              <div style={{padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
                {/* Work profile / activity */}
                {(f.profile||f.activity) && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {f.profile&&<div><label style={LS}>WORK PROFILE</label><div style={{fontSize:13,color:T.text,padding:"8px 10px",background:T.card2,borderRadius:7,border:`1px solid ${T.border}`}}>{f.profile}</div></div>}
                    {f.activity&&<div><label style={LS}>ACTIVITY</label><div style={{fontSize:13,color:T.text,padding:"8px 10px",background:T.card2,borderRadius:7,border:`1px solid ${T.border}`}}>{f.activity}</div></div>}
                  </div>
                )}
                {/* Progress summary */}
                {(f.totalQty||f.progressToday||f.accumulated) && (
                  <div>
                    <label style={LS}>PROGRESS SUMMARY (m)</label>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                      {[["Total Qty",f.totalQty,T.textMuted],["Previous",f.prevProgress,T.textMuted],["Today",f.progressToday,T.blue],["Accumulated",f.accumulated,T.green]].map(([l,v,c])=>v?(
                        <div key={l} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:c}}>{v}</div>
                          <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{l}</div>
                        </div>
                      ):null)}
                    </div>
                  </div>
                )}
                {/* Permits & Standby */}
                {(f.permitReceived||f.permitHours||f.standbyReason) && (
                  <div>
                    <label style={LS}>PERMITS & STANDBY</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {f.permitReceived&&(
                        <div style={{background:f.permitReceived.toLowerCase()==="yes"?T.greenDim:T.redDim,border:`1px solid ${f.permitReceived.toLowerCase()==="yes"?T.green:T.red}44`,borderRadius:8,padding:"6px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{color:T.textMuted}}>Permit: </span>
                          <span style={{fontWeight:800,color:f.permitReceived.toLowerCase()==="yes"?T.green:T.red}}>{f.permitReceived}</span>
                        </div>
                      )}
                      {f.permitHours&&(
                        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 14px",fontSize:12}}>
                          <span style={{color:T.textMuted}}>Permit Hours: </span>
                          <span style={{fontWeight:700,color:T.text}}>{f.permitHours}</span>
                        </div>
                      )}
                    </div>
                    {f.standbyReason&&(
                      <div style={{marginTop:8,fontSize:12,color:T.textSub,padding:"8px 10px",background:T.card2,borderRadius:7,border:`1px solid ${T.border}`,lineHeight:1.6}}>
                        <span style={{color:T.textMuted,fontWeight:700}}>Standby Reason: </span>{f.standbyReason}
                      </div>
                    )}
                  </div>
                )}
                {/* Drilling parameters */}
                {(f.force||f.torque||f.mudPressure||f.pumpRate) && (
                  <div>
                    <label style={LS}>DRILLING PARAMETERS</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {[["Force (Ton)",f.force],["Torque (Ton/m)",f.torque],["Mud Press (PSI)",f.mudPressure],["Pump Rate (gal/min)",f.pumpRate]].map(([l,v])=>v?(
                        <div key={l} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 12px",fontSize:12}}>
                          <span style={{color:T.textMuted}}>{l}: </span><span style={{fontWeight:700,color:T.text}}>{v}</span>
                        </div>
                      ):null)}
                    </div>
                  </div>
                )}




              </div>
            </div>
          )}

          {/* ── File attachment (PDF / Excel / image) ── */}
          <div>
            <label style={LS}>ATTACH DAILY REPORT FILE (PDF / EXCEL / IMAGE)</label>
            <div style={{border:`2px dashed ${T.border}`,borderRadius:10,padding:"16px",textAlign:"center",background:T.card2}}>
              {f.fileLink ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22}}>{/\.pdf$/i.test(f.fileName||f.fileLink)?"📄":/\.(xlsx?|csv)$/i.test(f.fileName||f.fileLink)?"📊":/\.(png|jpe?g|webp)$/i.test(f.fileName||f.fileLink)?"🖼️":"📎"}</span>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text,wordBreak:"break-all"}}>{f.fileName||"Uploaded file"}</div>
                      <a href={f.fileLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,fontWeight:600,textDecoration:"none"}}>↗ View / Download</a>
                    </div>
                  </div>
                  <button onClick={()=>{upd("fileLink","");upd("fileName","");}}
                    style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <>
                  <div style={{fontSize:28,marginBottom:8}}>📎</div>
                  <div style={{fontSize:13,color:T.textMuted,marginBottom:10}}>
                    {uploading ? "Uploading…" : "Drop the supervisor's daily report sheet here"}
                  </div>
                  <button onClick={()=>fileRef.current.click()} disabled={uploading}
                    style={{background:T.blueDim,border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:uploading?"wait":"pointer"}}>
                    {uploading?"⏳ Uploading…":"⬆ Choose File"}
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.doc,.docx" style={{display:"none"}}
                    onChange={e=>{if(e.target.files[0]){handleFileUpload(e.target.files[0]);e.target.value="";}}}/>
                  {uploadErr&&<div style={{marginTop:8,fontSize:12,color:T.red,fontWeight:600}}>{uploadErr}</div>}
                </>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{padding:"12px 24px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,justifyContent:"flex-end",position:"sticky",bottom:0,background:T.card,borderRadius:"0 0 18px 18px"}}>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{ if(uploading){return;} onSave(f); }} disabled={uploading}
            style={{background:`linear-gradient(135deg,${T.blue},#2563eb)`,border:"none",color:"#fff",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:uploading?"not-allowed":"pointer",opacity:uploading?0.7:1}}>
            {uploading?"Uploading…":"Save Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DPR CONSOLIDATION MODAL
   Collates daily reports from ALL projects into one master Excel export.
   Also lets the user drop multiple DPR Excel files directly to parse them
   without first manually adding a report.
════════════════════════════════════════════════════════════════════════════ */
function DprConsolidateModal({ projectAnalysis, onClose }) {
  const [dropping, setDropping]         = useState(false);
  const [ingestStatus, setIngestStatus] = useState([]); // [{name, ok, rec}]
  const [ingesting, setIngesting]       = useState(false);
  const fileRef = useRef();

  // All existing saved daily reports across projects, enriched with project name
  const savedRows = (projectAnalysis || []).flatMap(pa =>
    (pa.dailyReports || []).map(r => ({ ...r, _project: pa.project }))
  );

  // Ingested-from-drop rows (not yet saved to app state)
  const droppedRows = ingestStatus.filter(s => s.ok && s.rec).map(s => ({ ...s.rec, _project: s.rec.project || "Unassigned", _fromFile: s.name }));

  const allRows = [...savedRows, ...droppedRows];

  const handleFiles = async (files) => {
    const xlsxFiles = [...files].filter(f => /\.xlsx?$/i.test(f.name));
    if (!xlsxFiles.length) return;
    setIngesting(true);
    const results = [];
    for (const file of xlsxFiles) {
      const result = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const rows = parseDailyReportExcel(e.target.result);
            if (!rows.length) { resolve({ name: file.name, ok: false }); return; }
            resolve({ name: file.name, ok: true, rec: { ...rows[0], _fileName: file.name } });
          } catch { resolve({ name: file.name, ok: false }); }
        };
        reader.readAsArrayBuffer(file);
      });
      results.push(result);
    }
    setIngestStatus(prev => {
      const existing = prev.map(p => p.name);
      return [...prev, ...results.filter(r => !existing.includes(r.name))];
    });
    setIngesting(false);
  };

  const exportMaster = () => {
    if (!allRows.length) return;
    const headers = [
      "Project Name",
      "Date",
      "Profile",
      "Activity",
      "Permit Received",
      "Permit Hours",
      "Standby Reason",
      "Progress Today (m)",
      "Accumulated Progress (m)",
      "Activity Summary",
    ];
    const toRow = r => [
      r._project || r.project || "",
      r.date || "",
      r.profile || "",
      r.activity || "",
      r.permitReceived || "",
      (r.permitHours  !== undefined && r.permitHours  !== null) ? String(r.permitHours)  : "",
      r.standbyReason || "",
      (r.progressToday !== undefined && r.progressToday !== null) ? String(r.progressToday) : "",
      (r.accumulated   !== undefined && r.accumulated   !== null) ? String(r.accumulated)   : "",
      r.activities || "",
    ];
    const rows = allRows.map(toRow);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const colWidths = [28, 14, 20, 24, 16, 14, 32, 18, 22, 50];
    ws["!cols"] = colWidths.map(w => ({ wch: w }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DPR Master");

    // Per-project sheets
    const byProject = {};
    allRows.forEach(r => {
      const p = r._project || r.project || "Unassigned";
      if (!byProject[p]) byProject[p] = [];
      byProject[p].push(r);
    });
    Object.entries(byProject).forEach(([proj, pRows]) => {
      const safeName = proj.replace(/[\\/\?\*\[\]:]/g,"").slice(0,28);
      const pWs = XLSX.utils.aoa_to_sheet([headers, ...pRows.map(toRow)]);
      pWs["!cols"] = colWidths.map(w => ({ wch: w }));
      pWs["!freeze"] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, pWs, safeName);
    });

    const today = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `DPR_Master_Consolidation_${today}.xlsx`);
  };

  const IS = { width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:T.text, outline:"none" };

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:820,maxHeight:"93vh",display:"flex",flexDirection:"column",boxShadow:T.shadow,animation:"modalFloatIn .3s ease both"}}>

        {/* Header */}
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,borderRadius:"18px 18px 0 0",background:T.card}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>📊 DPR CONSOLIDATION</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>
              {savedRows.length} saved report{savedRows.length!==1?"s":""} across {(projectAnalysis||[]).length} project{(projectAnalysis||[]).length!==1?"s":""}
              {droppedRows.length>0&&<span style={{color:T.blue,marginLeft:8}}>+ {droppedRows.length} from dropped files</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Drop zone for additional DPR files */}
          <div
            onDragOver={e=>{e.preventDefault();setDropping(true);}}
            onDragLeave={()=>setDropping(false)}
            onDrop={e=>{e.preventDefault();setDropping(false);handleFiles(e.dataTransfer.files);}}
            onClick={()=>fileRef.current.click()}
            style={{border:`2px dashed ${dropping?T.blue:T.border}`,borderRadius:14,padding:"24px 16px",textAlign:"center",cursor:"pointer",background:dropping?T.blueDim:T.card2,transition:"all .2s"}}>
            <div style={{fontSize:32,marginBottom:8}}>📂</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:T.text,marginBottom:4}}>
              {ingesting?"⏳ Parsing files…":"Drop Supervisor DPR Excel Files Here"}
            </div>
            <div style={{fontSize:12,color:T.textMuted}}>
              Drag & drop multiple filled DPR Excel files — data is extracted automatically and included in the export
            </div>
            <input ref={fileRef} type="file" multiple accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
          </div>

          {/* Ingested file status */}
          {ingestStatus.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:.5}}>DROPPED FILES</div>
              {ingestStatus.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:9}}>
                  <span style={{fontSize:16}}>📊</span>
                  <span style={{flex:1,fontSize:13,fontWeight:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                  {s.ok
                    ? <span style={{background:T.greenDim,border:`1px solid ${T.green}33`,color:T.green,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700}}>✓ Parsed{s.rec?.date?" — "+fmtDate(s.rec.date):""}</span>
                    : <span style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700}}>✕ Failed</span>
                  }
                  <button onClick={e=>{e.stopPropagation();setIngestStatus(p=>p.filter((_,j)=>j!==i));}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer",flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Preview table of all reports */}
          {allRows.length>0 ? (
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>{allRows.length} TOTAL REPORT{allRows.length!==1?"S":""} READY</div>
                <div style={{fontSize:12,color:T.textMuted}}>Scroll to see all</div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:T.card2}}>
                      {["Project","Date","Work Profile","Activity","Permit Received","Permit Hours","Standby Reason","Total Qty (m)","Progress Today (m)","Accumulated (m)","Issues / Delays","Source"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,fontSize:11,color:T.textMuted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((r,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.card2}}>
                        <td style={{padding:"8px 12px",fontWeight:600,color:T.text,whiteSpace:"nowrap"}}>{r._project||r.project||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,whiteSpace:"nowrap"}}>{r.date?fmtDate(r.date):"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,whiteSpace:"nowrap"}}>{r.profile||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.activity||"—"}</td>
                        <td style={{padding:"8px 12px",textAlign:"center"}}>
                          {r.permitReceived
                            ? <span style={{background:r.permitReceived.toLowerCase()==="yes"?T.greenDim:T.redDim,color:r.permitReceived.toLowerCase()==="yes"?T.green:T.red,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>{r.permitReceived}</span>
                            : <span style={{color:T.textMuted}}>—</span>}
                        </td>
                        <td style={{padding:"8px 12px",color:T.textSub,textAlign:"center"}}>{r.permitHours||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.standbyReason||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,textAlign:"center"}}>{r.totalQty||"—"}</td>
                        <td style={{padding:"8px 12px",textAlign:"center"}}>
                          {r.progressToday
                            ? <span style={{background:T.blueDim,color:T.blue,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>{r.progressToday}m</span>
                            : <span style={{color:T.textMuted}}>—</span>}
                        </td>
                        <td style={{padding:"8px 12px",color:T.textSub,textAlign:"center"}}>{r.accumulated||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textSub,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.issues||"—"}</td>
                        <td style={{padding:"8px 12px",color:T.textMuted,fontSize:11}}>
                          {r._fromFile
                            ? <span style={{background:T.goldDim,color:T.gold,borderRadius:5,padding:"2px 8px",fontWeight:600}}>📂 File</span>
                            : <span style={{background:T.greenDim,color:T.green,borderRadius:5,padding:"2px 8px",fontWeight:600}}>✓ Saved</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>
              <div style={{fontSize:48,marginBottom:12}}>📋</div>
              <div style={{fontSize:14}}>No daily reports yet. Add reports from each project's detail page, or drop DPR Excel files above.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 24px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",flexShrink:0,borderRadius:"0 0 18px 18px",background:T.card}}>
          <div style={{flex:1,fontSize:12,color:T.textMuted}}>
            {allRows.length} report{allRows.length!==1?"s":""} → 1 master Excel (all projects) + {Object.keys(Object.fromEntries(allRows.map(r=>[r._project||r.project||"Unassigned",1]))).length} per-project sheet{Object.keys(Object.fromEntries(allRows.map(r=>[r._project||r.project||"Unassigned",1]))).length!==1?"s":""}
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={exportMaster} disabled={allRows.length===0}
            style={{background:allRows.length>0?`linear-gradient(135deg,${T.green},#059669)`:"transparent",border:`1px solid ${T.border}`,color:allRows.length>0?"#000":T.textMuted,borderRadius:10,padding:"10px 28px",fontSize:14,fontWeight:800,cursor:allRows.length>0?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:8}}>
            ⬇ Export Master Excel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Project Analysis Form Modal (PO details, dates, etc.) ── */
function ProjectAnalysisModal({ proj, projectNames, onSave, onClose }) {
  const blank = { id: uid(), project:"", poValue:"", poNumber:"", quotationRef:"", clientName:"", startDate:"", estEndDate:"", status:"In Progress", description:"", dailyReports:[] };
  const [f, setF] = useState(proj ? { dailyReports:[], ...proj } : blank);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const IS = { width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:T.text, outline:"none" };
  const LS = { display:"block", fontSize:11, fontWeight:700, color:"#fff", marginBottom:5, letterSpacing:.5 };
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:600,maxHeight:"92vh",overflowY:"auto",boxShadow:T.shadow,animation:"modalFloatIn .3s ease both"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:T.card,zIndex:1,borderRadius:"18px 18px 0 0"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{proj?"✎ Edit Project":"+ New Project Analysis"}</div>
          <button onClick={onClose} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:`${T.blue}10`,border:`1px solid ${T.blue}30`,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.blue}}>
            ℹ Progress is calculated automatically from invoices in Project Docs. Just enter the contract PO value here.
          </div>
          <div>
            <label style={LS}>PROJECT *</label>
            <select value={f.project} onChange={e=>upd("project",e.target.value)} style={{...IS,colorScheme:"light"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
              <option value="">— Select project —</option>
              {projectNames.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>PO NUMBER</label><input value={f.poNumber} onChange={e=>upd("poNumber",e.target.value)} placeholder="e.g. PO-2025-001" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
            <div><label style={LS}>PO VALUE (SAR) — Total Contract</label><input type="number" value={f.poValue} onChange={e=>upd("poValue",e.target.value)} placeholder="e.g. 2700000" style={IS} onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>QUOTATION REF</label><input value={f.quotationRef} onChange={e=>upd("quotationRef",e.target.value)} placeholder="e.g. QT-2024-089" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
            <div><label style={LS}>CLIENT NAME</label><input value={f.clientName} onChange={e=>upd("clientName",e.target.value)} placeholder="e.g. NEOM Company" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>START DATE</label><input type="date" value={f.startDate} onChange={e=>upd("startDate",e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
            <div><label style={LS}>ESTIMATED END DATE</label><input type="date" value={f.estEndDate} onChange={e=>upd("estEndDate",e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={LS}>ACTUAL END DATE <span style={{color:T.textMuted,fontWeight:400}}>(if completed)</span></label>
              <input type="date" value={f.actualEndDate||""} onChange={e=>upd("actualEndDate",e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div>
              <label style={LS}>STATUS</label>
              <select value={f.status} onChange={e=>upd("status",e.target.value)} style={{...IS,colorScheme:"light"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
                {["Not Started","In Progress","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label style={LS}>DESCRIPTION / SCOPE OF WORK</label><textarea value={f.description} onChange={e=>upd("description",e.target.value)} rows={3} placeholder="Brief scope of work…" style={{...IS,resize:"vertical"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
        </div>
        <div style={{padding:"12px 24px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{if(!f.project)return; onSave(f);}} style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",color:"#000",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:"pointer"}}>Save Project</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT DURATION CHART
   Visual timeline comparing estimated vs actual days with daily report activity
════════════════════════════════════════════════════════════════════════════ */
function ProjectDurationChart({ proj, reports }) {
  const start    = proj.startDate    ? new Date(proj.startDate)    : null;
  const estEnd   = proj.estEndDate   ? new Date(proj.estEndDate)   : null;
  const actEnd   = proj.actualEndDate? new Date(proj.actualEndDate): null;
  const today    = new Date(); today.setHours(0,0,0,0);
  const isCompleted = proj.status === "Completed";

  if (!start) return null;

  // ── Core calculations ──
  const estDays    = estEnd  ? Math.ceil((estEnd  - start) / 86400000) : null;
  const actDays    = actEnd  ? Math.ceil((actEnd  - start) / 86400000)
                   : isCompleted ? null
                   : Math.ceil((today - start) / 86400000);
  const elapsedDays = Math.max(0, Math.ceil((today - start) / 86400000));

  // Determine the furthest point for chart scaling
  const maxDays = Math.max(
    estDays || 0,
    actEnd ? Math.ceil((actEnd - start) / 86400000) : 0,
    elapsedDays,
    1
  ) * 1.08; // 8% breathing room on right

  // Variance
  const referenceEnd = actEnd || (isCompleted ? null : today);
  const referenceDays = referenceEnd ? Math.ceil((referenceEnd - start) / 86400000) : null;
  const variance = (estDays && referenceDays) ? referenceDays - estDays : null;
  const onTime   = variance !== null && variance <= 0;

  // Report dots — map each report date to a day offset
  const reportDots = reports
    .filter(r => r.date)
    .map(r => {
      const d = new Date(r.date);
      return Math.ceil((d - start) / 86400000);
    })
    .filter(d => d >= 0)
    .sort((a,b) => a - b);

  const toPercent = days => Math.min(100, Math.max(0, (days / maxDays) * 100));

  const BAR_H = 28;
  const stColor = { "Not Started":T.textMuted,"In Progress":T.blue,"On Hold":T.gold,"Completed":T.green,"Cancelled":T.red }[proj.status]||T.textMuted;

  // Month/quarter tick marks
  const ticks = [];
  if (start && maxDays > 0) {
    const tickCount = Math.min(6, Math.max(2, Math.floor(maxDays / 30)));
    for (let i = 1; i < tickCount; i++) {
      const d = Math.round((maxDays * i) / tickCount);
      const dt = new Date(start.getTime() + d * 86400000);
      ticks.push({ pct: toPercent(d), label: dt.toLocaleDateString("en-GB",{month:"short",day:"numeric"}) });
    }
  }

  return (
    <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"22px 24px",marginBottom:16,boxShadow:T.shadow}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>📆 DURATION ANALYSIS</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>Estimated vs actual timeline · {reports.length} daily report{reports.length!==1?"s":""} tracked</div>
        </div>
        {variance !== null && (
          <div style={{background:onTime?T.greenDim:T.redDim,border:`1px solid ${onTime?T.green:T.red}44`,borderRadius:12,padding:"8px 16px",textAlign:"center"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:onTime?T.green:T.red,lineHeight:1}}>
              {onTime ? `${Math.abs(variance)}d ahead` : `${variance}d over`}
            </div>
            <div style={{fontSize:11,color:onTime?T.green:T.red,fontWeight:600,marginTop:2}}>{onTime?"ON SCHEDULE":"OVER ESTIMATE"}</div>
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:22}}>
        {[
          { label:"START DATE",      value: start ? start.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—", color:T.blue },
          { label:"EST. END DATE",   value: estEnd ? estEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—", color:T.gold },
          { label:"ACTUAL END",      value: actEnd ? actEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : isCompleted ? "Not set" : "In progress", color:T.green },
          { label:"EST. DURATION",   value: estDays  ? `${estDays} days`  : "—", color:T.gold },
          { label:"ACTUAL DAYS",     value: actDays  ? `${actDays} days`  : isCompleted ? "—" : `${elapsedDays}d elapsed`, color: isCompleted ? T.green : T.blue },
          { label:"DAILY REPORTS",   value: reports.length, color:T.teal },
        ].map(k => (
          <div key={k.label} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(16px,2vw,22px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:10,color:T.textMuted,marginTop:5,fontWeight:700,letterSpacing:".5px"}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Gantt-style bar chart ── */}
      <div style={{position:"relative",userSelect:"none"}}>
        {/* Date axis labels */}
        <div style={{position:"relative",height:18,marginBottom:6,fontSize:10,color:T.textMuted}}>
          <span style={{position:"absolute",left:0}}>{start.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</span>
          {ticks.map((t,i) => (
            <span key={i} style={{position:"absolute",left:`${t.pct}%`,transform:"translateX(-50%)",whiteSpace:"nowrap"}}>{t.label}</span>
          ))}
          {estEnd && <span style={{position:"absolute",right:0,color:T.gold,fontWeight:700}}>{estEnd.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</span>}
        </div>

        {/* Track background */}
        <div style={{position:"relative",background:T.border,borderRadius:999,height:BAR_H,marginBottom:12,overflow:"visible"}}>
          {/* Estimated duration bar */}
          {estDays && (
            <div style={{
              position:"absolute",left:0,top:0,
              width:`${toPercent(estDays)}%`,height:"100%",
              background:`linear-gradient(90deg,${T.gold}88,${T.gold}44)`,
              borderRadius:999,
              borderRight:`2px dashed ${T.gold}`,
            }}/>
          )}

          {/* Actual / elapsed bar */}
          {(actDays || elapsedDays > 0) && (
            <div style={{
              position:"absolute",left:0,top:"25%",
              width:`${toPercent(actDays || elapsedDays)}%`,
              height:"50%",
              background: isCompleted
                ? (onTime ? `linear-gradient(90deg,${T.green},${T.green}bb)` : `linear-gradient(90deg,${T.red},${T.red}bb)`)
                : `linear-gradient(90deg,${T.blue},${T.blue}bb)`,
              borderRadius:999,
              transition:"width 1.2s ease",
            }}/>
          )}

          {/* Today marker */}
          {!isCompleted && elapsedDays > 0 && elapsedDays <= maxDays && (
            <div style={{position:"absolute",left:`${toPercent(elapsedDays)}%`,top:-6,bottom:-6,width:2,background:T.blue,zIndex:2,borderRadius:1}}>
              <div style={{position:"absolute",top:-20,left:"50%",transform:"translateX(-50%)",background:T.blue,color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,whiteSpace:"nowrap"}}>TODAY</div>
            </div>
          )}

          {/* Estimated end marker */}
          {estDays && (
            <div style={{position:"absolute",left:`${toPercent(estDays)}%`,top:-6,bottom:-6,width:2,background:T.gold,borderRadius:1,zIndex:2}}>
              <div style={{position:"absolute",bottom:-20,left:"50%",transform:"translateX(-50%)",background:T.gold,color:"#000",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:800,whiteSpace:"nowrap"}}>EST.</div>
            </div>
          )}

          {/* Actual end marker */}
          {actEnd && (
            <div style={{position:"absolute",left:`${toPercent(Math.ceil((actEnd-start)/86400000))}%`,top:-6,bottom:-6,width:2,background:onTime?T.green:T.red,borderRadius:1,zIndex:2}}>
              <div style={{position:"absolute",top:-20,left:"50%",transform:"translateX(-50%)",background:onTime?T.green:T.red,color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:800,whiteSpace:"nowrap"}}>ACTUAL</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16,fontSize:11,color:T.textSub}}>
          {estDays && <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:16,height:4,background:T.gold,opacity:.7,borderRadius:2,display:"inline-block"}}/>Estimated</span>}
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:16,height:4,background:isCompleted?(onTime?T.green:T.red):T.blue,borderRadius:2,display:"inline-block"}}/>{isCompleted?"Actual":"Elapsed"}</span>
          {!isCompleted && <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:2,height:12,background:T.blue,display:"inline-block"}}/> Today</span>}
        </div>

        {/* ── Daily report activity dots ── */}
        {reportDots.length > 0 && (
          <div>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,marginBottom:8,letterSpacing:".5px"}}>DAILY REPORT ACTIVITY</div>
            <div style={{position:"relative",height:36,background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
              {/* Density heatmap background */}
              {reportDots.map((d, i) => (
                <div key={i} title={`Report on day ${d}`} style={{
                  position:"absolute",
                  left:`${toPercent(d)}%`,
                  top:"50%",transform:"translate(-50%,-50%)",
                  width:10,height:10,
                  borderRadius:"50%",
                  background:T.teal,
                  opacity:.85,
                  boxShadow:`0 0 6px ${T.teal}`,
                }}/>
              ))}
              {/* Estimated end line */}
              {estDays && (
                <div style={{position:"absolute",left:`${toPercent(estDays)}%`,top:0,bottom:0,width:1,background:`${T.gold}88`}}/>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textMuted,marginTop:4}}>
              <span>{reports.length} reports · first: {fmtDate(reports[reports.length-1]?.date)}</span>
              <span>latest: {fmtDate(reports[0]?.date)}</span>
            </div>
          </div>
        )}

        {/* ── Comparison summary ── */}
        {estDays && (actDays || elapsedDays > 0) && (
          <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:T.gold}}>{estDays} days</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>ESTIMATED DURATION</div>
              {estEnd && <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{fmtDate(proj.startDate)} → {fmtDate(proj.estEndDate)}</div>}
            </div>
            <div style={{background:isCompleted?(onTime?T.greenDim:T.redDim):T.blueDim,border:`1px solid ${(isCompleted?(onTime?T.green:T.red):T.blue)}33`,borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:isCompleted?(onTime?T.green:T.red):T.blue}}>
                {actDays || elapsedDays} days
              </div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>{isCompleted?"ACTUAL DURATION":"ELAPSED SO FAR"}</div>
              {actEnd && <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{fmtDate(proj.startDate)} → {fmtDate(proj.actualEndDate)}</div>}
            </div>
            {variance !== null && (
              <div style={{background:onTime?T.greenDim:T.redDim,border:`1px solid ${onTime?T.green:T.red}33`,borderRadius:12,padding:"12px 16px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:onTime?T.green:T.red}}>
                  {onTime ? `-${Math.abs(variance)}` : `+${variance}`} days
                </div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>VARIANCE</div>
                <div style={{fontSize:11,color:onTime?T.green:T.red,marginTop:2,fontWeight:600}}>{onTime?"Finished ahead of schedule":"Behind estimate"}</div>
              </div>
            )}
            {!isCompleted && estDays && (
              <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 16px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:variance!==null&&variance>0?T.red:T.textMuted}}>
                  {estEnd ? Math.max(0, Math.ceil((estEnd - today) / 86400000)) : "—"} days
                </div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>DAYS REMAINING</div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Until estimated end date</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Project Detail view ── */
function ProjectAnalysisDetail({ proj, projectDocs, projectNames, onUpdate, onDelete, onBack, go }) {
  const [editProj, setEditProj]     = useState(false);
  const [drModal,  setDrModal]      = useState(null);
  const [expandDr, setExpandDr]     = useState(null);
  const [expandJob,          setExpandJob]          = useState(null);
  const [expandAllInvs,      setExpandAllInvs]      = useState(false);
  const [expandJobsSection,  setExpandJobsSection]  = useState(false);
  const [expandDailySection, setExpandDailySection] = useState(false);

  const { invs, totalInvoiced, totalCollected, totalDue, jobs, ungroupedInvs, ungroupedCerts } = deriveProjectStats(proj.project, projectDocs);
  const poValue = parseFloat(proj.poValue) || 0;
  const pct = poValue > 0 ? Math.min(100, Math.round((totalInvoiced / poValue) * 100)) : 0;
  const dl = daysLeft(proj.estEndDate);
  const duration = proj.startDate && proj.estEndDate
    ? Math.ceil((new Date(proj.estEndDate) - new Date(proj.startDate)) / 86400000)
    : null;
  const stColor = { "Not Started":T.textMuted,"In Progress":T.blue,"On Hold":T.gold,"Completed":T.green,"Cancelled":T.red }[proj.status]||T.textMuted;
  const reports = (proj.dailyReports||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));

  const saveReport = r => {
    const existing = (proj.dailyReports||[]).find(x=>x.id===r.id);
    const updated  = existing ? (proj.dailyReports||[]).map(x=>x.id===r.id?r:x) : [...(proj.dailyReports||[]),r];
    onUpdate({...proj,dailyReports:updated});
    setDrModal(null);
  };
  const delReport = id => onUpdate({...proj,dailyReports:(proj.dailyReports||[]).filter(r=>r.id!==id)});

  return (
    <div style={{maxWidth:"min(1200px,98vw)",margin:"0 auto"}}>
      {/* Back + title bar */}
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Back</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.project}</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:2,display:"flex",gap:12,flexWrap:"wrap"}}>
            {proj.clientName&&<span>Client: {proj.clientName}</span>}
            {proj.poNumber&&<span>PO: {proj.poNumber}</span>}
            {proj.quotationRef&&<span>QT: {proj.quotationRef}</span>}
          </div>
        </div>
        <button onClick={()=>setEditProj(true)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✎ Edit</button>
        <button onClick={()=>{if(window.confirm("Delete this project analysis?")) onDelete();}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Delete</button>
      </div>

      {/* Progress hero */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"24px 28px",marginBottom:16,boxShadow:T.shadow}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:20,alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{background:`${stColor}18`,border:`1px solid ${stColor}44`,color:stColor,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700}}>{proj.status||"—"}</span>
            </div>
            {proj.description&&<div style={{fontSize:13,color:T.textSub,lineHeight:1.6,maxWidth:520}}>{proj.description}</div>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:56,fontWeight:800,color:pctColor(pct),lineHeight:1}}>{pct}%</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:2,fontWeight:700}}>INVOICED / CONTRACT</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:14,background:T.border,borderRadius:999,overflow:"hidden",marginBottom:10}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:999,background:`linear-gradient(90deg,${pctColor(pct)},${pctColor(pct)}bb)`,transition:"width 1.2s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textMuted,flexWrap:"wrap",gap:8}}>
          <span>{formatSarCompact(totalInvoiced)} invoiced of {poValue>0?formatSarCompact(poValue):"? PO value"}</span>
          <span>
            {dl !== null
              ? dl >= 0 ? `${dl} days remaining` : `${Math.abs(dl)} days overdue`
              : proj.estEndDate ? fmtDate(proj.estEndDate) : "No end date set"}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        {[
          {icon:"💰",label:"PO VALUE",         v:poValue?formatSarCompact(poValue):"—",          color:T.gold},
          {icon:"🧾",label:"TOTAL INVOICED",   v:formatSarCompact(totalInvoiced),                color:T.green},
          {icon:"✓", label:"COLLECTED",        v:formatSarCompact(totalCollected),               color:T.blue},
          {icon:"⏳",label:"DUE / REMAINING",  v:formatSarCompact(totalDue),                     color:totalDue>0?T.red:T.textMuted},
          {icon:"📋",label:"JOBS (PHASES)",    v:jobs.length||invs.length,                       color:T.purple},
          {icon:"📅",label:"DURATION",         v:duration?`${duration} days`:"—",                color:T.teal},
        ].map((k,i)=>(
          <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"16px 18px",boxShadow:T.shadow,animationDelay:`${i*.05}s`}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(15px,2vw,22px)",fontWeight:800,color:k.color,lineHeight:1.1,wordBreak:"break-word"}}>{k.v}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600,letterSpacing:.5}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Timeline / Duration Visual ── */}
      {proj.startDate && (proj.estEndDate || proj.actualEndDate) && (
        <ProjectDurationChart proj={proj} reports={reports} />
      )}

      {/* ── Invoices / Jobs / Phases ── */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 22px",marginBottom:16,boxShadow:T.shadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>🧾 INVOICES & JOBS</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>
              {invs.length} invoice{invs.length!==1?"s":""} total
              {jobs.length>0 && ` · ${jobs.length} job phase${jobs.length!==1?"s":""}`}
              {" · "}Progress = Total Invoiced ÷ PO Value
            </div>
          </div>
          <button onClick={()=>go("finance")} style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:9,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ➕ Add Invoice in Finance →
          </button>
        </div>

        {invs.length === 0 ? (
          <div style={{textAlign:"center",padding:"30px 20px",background:T.card2,borderRadius:12,border:`1px dashed ${T.border}`}}>
            <div style={{fontSize:32,marginBottom:10}}>🧾</div>
            <div style={{fontSize:14,color:T.textMuted,fontWeight:600}}>No invoices found for this project.</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:6}}>Add invoices in <strong>Finance → Invoices</strong>. Optionally add a Job No. to group them into phases.</div>
            <button onClick={()=>go("finance")} style={{marginTop:14,background:`linear-gradient(135deg,${T.green},#059669)`,border:"none",color:"#fff",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Go to Finance →</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* ── Ungrouped invoices (no Job No.) ── */}
            {ungroupedInvs.length > 0 && (
              <div style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                <div onClick={()=>setExpandAllInvs(p=>!p)} style={{padding:"12px 16px",background:T.card2,borderBottom:expandAllInvs?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>
                      📋 All Invoices
                      <span style={{marginLeft:8,fontSize:12,color:T.textMuted,fontWeight:400}}>{ungroupedInvs.length} invoice{ungroupedInvs.length!==1?"s":""}{ungroupedCerts.length>0?` · ${ungroupedCerts.length} cert${ungroupedCerts.length!==1?"s":""}`:""}</span>
                    </div>
                    <div style={{fontSize:12,color:T.textMuted,display:"flex",gap:14,flexWrap:"wrap"}}>
                      <span style={{color:T.green,fontWeight:600}}>{formatSarCompact(ungroupedInvs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0))} invoiced</span>
                      <span style={{color:T.blue}}>{formatSarCompact(ungroupedInvs.reduce((s,d)=>s+getInvoiceCollectedAmount(d),0))} collected</span>
                      {ungroupedInvs.reduce((s,d)=>s+getInvoiceRemainingAmount(d),0)>0&&<span style={{color:T.red}}>{formatSarCompact(ungroupedInvs.reduce((s,d)=>s+getInvoiceRemainingAmount(d),0))} due</span>}
                    </div>
                  </div>
                  <span style={{color:T.textMuted,fontSize:14,flexShrink:0}}>{expandAllInvs?"▲":"▼"}</span>
                </div>
                {expandAllInvs && ungroupedInvs.map(inv=>{
                  const collected = getInvoiceCollectedAmount(inv);
                  const due       = getInvoiceRemainingAmount(inv);
                  const stC       = /paid|received/i.test(inv.paymentStatus||"") ? T.green : /partial/i.test(inv.paymentStatus||"") ? T.gold : T.red;
                  const stream    = getInvoiceStream(inv);
                  return (
                    <div key={inv.id} style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontWeight:700,fontSize:13,color:T.text}}>{inv.name||"Invoice"}</span>
                          {inv.refNo&&<span style={{background:T.greenDim,color:T.green,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>#{inv.refNo}</span>}
                          <span style={{background:stream==="advance"?T.goldDim:T.tealDim,color:stream==="advance"?T.gold:T.teal,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{stream==="advance"?"Advance":"Income"}</span>
                          <span style={{background:`${stC}18`,color:stC,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{inv.paymentStatus||"Pending"}</span>
                        </div>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12,color:T.textMuted}}>
                          <span style={{color:T.green,fontWeight:600}}>SAR {Number(inv.amount||0).toLocaleString()}</span>
                          {collected>0&&<span style={{color:T.blue}}>✓ {formatSarCompact(collected)}</span>}
                          {due>0&&<span style={{color:T.red}}>⏳ {formatSarCompact(due)}</span>}
                          {inv.dueDate&&<span>Due: {fmtDate(inv.dueDate)}</span>}
                          {inv.fileLink&&<a href={inv.fileLink} target="_blank" rel="noreferrer" style={{color:T.blue,textDecoration:"none",fontWeight:600}}>📎 View</a>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {expandAllInvs && ungroupedCerts.map(cert=>(
                  <div key={cert.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:`${T.teal}08`}}>
                    <span style={{fontSize:14}}>📜</span>
                    <span style={{fontWeight:600,fontSize:13,color:T.teal}}>{cert.name||"Certificate"}</span>
                    {cert.refNo&&<span style={{background:T.tealDim,color:T.teal,borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700}}>#{cert.refNo}</span>}
                    {cert.expiryDate&&<span style={{fontSize:11,color:T.textMuted}}>Exp: {fmtDate(cert.expiryDate)}</span>}
                    {cert.fileLink&&<a href={cert.fileLink} target="_blank" rel="noreferrer" style={{color:T.blue,textDecoration:"none",fontSize:12,fontWeight:600}}>📎 View</a>}
                  </div>
                ))}
              </div>
            )}

            {/* ── Named Job Phases ── */}
            {jobs.length > 0 && (
              <div style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                <div onClick={()=>setExpandJobsSection(p=>!p)} style={{padding:"12px 16px",background:T.card2,borderBottom:expandJobsSection?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>
                      🏗️ Job Phases
                      <span style={{marginLeft:8,fontSize:12,color:T.textMuted,fontWeight:400}}>{jobs.length} phase{jobs.length!==1?"s":""} · {jobs.reduce((s,j)=>s+j.invoices.length,0)} invoice{jobs.reduce((s,j)=>s+j.invoices.length,0)!==1?"s":""}</span>
                    </div>
                    <div style={{fontSize:12,color:T.textMuted,display:"flex",gap:14,flexWrap:"wrap"}}>
                      <span style={{color:T.green,fontWeight:600}}>{formatSarCompact(jobs.reduce((s,j)=>s+j.totalInvoiced,0))} invoiced</span>
                      <span style={{color:T.blue}}>{formatSarCompact(jobs.reduce((s,j)=>s+j.totalCollected,0))} collected</span>
                      {jobs.reduce((s,j)=>s+j.totalDue,0)>0&&<span style={{color:T.red}}>{formatSarCompact(jobs.reduce((s,j)=>s+j.totalDue,0))} due</span>}
                    </div>
                  </div>
                  <span style={{color:T.textMuted,fontSize:14,flexShrink:0}}>{expandJobsSection?"▲":"▼"}</span>
                </div>
                {expandJobsSection && jobs.map(job => {
                  const jobPct = poValue > 0 ? Math.min(100, Math.round((job.totalInvoiced / poValue) * 100)) : 0;
                  const isExp  = expandJob === job.jobNo;
                  const hasCerts = job.certs.length > 0;
                  return (
                    <div key={job.jobNo} style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                      {/* Job header */}
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:isExp?T.card2:T.card,cursor:"pointer"}} onClick={()=>setExpandJob(isExp?null:job.jobNo)}>
                        <div style={{width:38,height:38,borderRadius:9,background:T.goldDim,border:`1px solid ${T.gold}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,fontWeight:800,color:T.gold,fontFamily:"'Barlow Condensed',sans-serif"}}>
                          J
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:T.text}}>Job {job.jobNo}</div>
                          <div style={{fontSize:12,color:T.textMuted,marginTop:2,display:"flex",gap:14,flexWrap:"wrap"}}>
                            <span style={{color:T.green,fontWeight:600}}>{formatSarCompact(job.totalInvoiced)} invoiced</span>
                            <span style={{color:T.blue}}>{formatSarCompact(job.totalCollected)} collected</span>
                            {job.totalDue>0&&<span style={{color:T.red}}>{formatSarCompact(job.totalDue)} due</span>}
                            <span>{job.invoices.length} invoice{job.invoices.length!==1?"s":""}</span>
                            {hasCerts&&<span style={{color:T.teal}}>📜 {job.certs.length} cert{job.certs.length!==1?"s":""}</span>}
                          </div>
                        </div>
                        <div style={{width:100,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                          <span style={{fontSize:13,fontWeight:800,color:pctColor(jobPct)}}>{jobPct}%</span>
                          <div style={{width:"100%",height:5,background:T.border,borderRadius:999,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${jobPct}%`,borderRadius:999,background:pctColor(jobPct)}}/>
                          </div>
                          <span style={{fontSize:10,color:T.textMuted}}>of total PO</span>
                        </div>
                        <span style={{color:T.textMuted,fontSize:14}}>{isExp?"▲":"▼"}</span>
                      </div>
                      {/* Expanded invoice list */}
                      {isExp && (
                        <div style={{borderTop:`1px solid ${T.border}`,background:T.card2}}>
                          {job.invoices.map(inv=>{
                            const collected = getInvoiceCollectedAmount(inv);
                            const due       = getInvoiceRemainingAmount(inv);
                            const stC       = /paid|received/i.test(inv.paymentStatus||"") ? T.green : /partial/i.test(inv.paymentStatus||"") ? T.gold : T.red;
                            const stream    = getInvoiceStream(inv);
                            return (
                              <div key={inv.id} style={{padding:"12px 16px 12px 62px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                                <div style={{flex:1,minWidth:200}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                                    <span style={{fontWeight:700,fontSize:13,color:T.text}}>{inv.name||"Invoice"}</span>
                                    {inv.refNo&&<span style={{background:T.greenDim,color:T.green,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>#{inv.refNo}</span>}
                                    <span style={{background:stream==="advance"?T.goldDim:T.tealDim,color:stream==="advance"?T.gold:T.teal,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{stream==="advance"?"Advance":"Income"}</span>
                                    <span style={{background:`${stC}18`,color:stC,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{inv.paymentStatus||"Pending"}</span>
                                  </div>
                                  <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12,color:T.textMuted}}>
                                    <span style={{color:T.green,fontWeight:600}}>SAR {Number(inv.amount||0).toLocaleString()}</span>
                                    {collected>0&&<span style={{color:T.blue}}>✓ {formatSarCompact(collected)}</span>}
                                    {due>0&&<span style={{color:T.red}}>⏳ {formatSarCompact(due)}</span>}
                                    {inv.dueDate&&<span>Due: {fmtDate(inv.dueDate)}</span>}
                                    {inv.fileLink&&<a href={inv.fileLink} target="_blank" rel="noreferrer" style={{color:T.blue,textDecoration:"none",fontWeight:600}}>📎 View</a>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {job.certs.map(cert=>(
                            <div key={cert.id} style={{padding:"10px 16px 10px 62px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:`${T.teal}08`}}>
                              <span style={{fontSize:14}}>📜</span>
                              <span style={{fontWeight:600,fontSize:13,color:T.teal}}>{cert.name||"Certificate"}</span>
                              {cert.refNo&&<span style={{background:T.tealDim,color:T.teal,borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700}}>#{cert.refNo}</span>}
                              {cert.expiryDate&&<span style={{fontSize:11,color:T.textMuted}}>Exp: {fmtDate(cert.expiryDate)}</span>}
                              {cert.fileLink&&<a href={cert.fileLink} target="_blank" rel="noreferrer" style={{color:T.blue,textDecoration:"none",fontSize:12,fontWeight:600}}>📎 View</a>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

            {/* ── Daily Reports ── */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,overflow:"hidden",boxShadow:T.shadow}}>
        {/* Collapsible header */}
        <div onClick={()=>setExpandDailySection(p=>!p)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",cursor:"pointer",background:T.card,borderBottom:expandDailySection?`1px solid ${T.border}`:"none"}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>📝 DAILY REPORTS</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{reports.length} report{reports.length!==1?"s":""}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}} onClick={e=>e.stopPropagation()}>
            {/* Export all reports to Excel */}
            {reports.length>0&&(
              <button onClick={()=>exportToExcel(
                reports.map(r=>({
                  "Project":               proj.project,
                  "Date":                  r.date || "",
                  "Work Profile":          r.profile || "",
                  "Activity":              r.activity || "",
                  "Permit Received":       r.permitReceived || "",
                  "Permit Hours":          (r.permitHours !== undefined && r.permitHours !== null) ? String(r.permitHours) : "",
                  "Standby Reason":        r.standbyReason || "",
                  "Progress Today (m)":   (r.progressToday !== undefined && r.progressToday !== null) ? String(r.progressToday) : "",
                  "Accumulated (m)":      (r.accumulated !== undefined && r.accumulated !== null) ? String(r.accumulated) : "",
                  "Activity Summary":      r.activities || "",
                })),
                `Daily_Reports_${(proj.project||"Project").replace(/\s+/g,"_")}`
              )}
                style={{background:"rgba(52,211,153,0.12)",border:"1px solid rgba(52,211,153,0.3)",color:"#34d399",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                ⬇ Export Excel
              </button>
            )}
            {/* Bulk import multiple rows from Excel */}
            <BulkDailyReportImport projectName={proj.project} onImport={(rows)=>{
              const updated = [...(proj.dailyReports||[])];
              rows.forEach(r=>{
                const dup = updated.find(x=>x.date===r.date);
                if(!dup) updated.push(r);
              });
              onUpdate({...proj,dailyReports:updated});
            }}/>
            <button onClick={()=>setDrModal("new")} style={{background:`linear-gradient(135deg,${T.blue},#2563eb)`,border:"none",color:"#fff",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Report</button>
          </div>
          <span style={{color:T.textMuted,fontSize:14,marginLeft:8,flexShrink:0,pointerEvents:"none"}}>{expandDailySection?"▲":"▼"}</span>
        </div>
        {expandDailySection && (reports.length===0 ? (
          <div style={{textAlign:"center",padding:"30px 20px",color:T.textMuted,fontSize:14}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            No daily reports yet. Click <strong>+ Add Report</strong> to start tracking site progress.
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {reports.map(r=>{
              const isE = expandDr===r.id;
              return (
                <div key={r.id} style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:isE?T.card2:T.card,cursor:"pointer"}} onClick={()=>setExpandDr(isE?null:r.id)}>
                    <div style={{width:34,height:34,borderRadius:8,background:T.blueDim,border:`1px solid ${T.blue}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>📅</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{fmtDate(r.date)}</div>
                      <div style={{fontSize:11,color:T.textMuted,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                        {r.weather&&<span>🌤 {r.weather}</span>}
                        {r.manpower&&<span>👷 {r.manpower} workers</span>}
                        {r.equipment&&<span>🚧 {r.equipment}</span>}
                        {r.fileLink&&<span style={{color:T.blue,fontWeight:600}}>📎 {r.fileName||"File attached"}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <button onClick={e=>{e.stopPropagation();setDrModal(r);}} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✎</button>
                      <button onClick={e=>{e.stopPropagation();delReport(r.id);}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✕</button>
                      <span style={{color:T.textMuted,fontSize:13,marginLeft:2}}>{isE?"▲":"▼"}</span>
                    </div>
                  </div>
                  {isE&&(
                    <div style={{padding:"12px 14px 14px 60px",borderTop:`1px solid ${T.border}`,background:T.card2,display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
                        {r.activities&&<div><div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:4}}>ACTIVITIES</div><div style={{fontSize:13,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{r.activities}</div></div>}
                        {r.issues&&<div><div style={{fontSize:10,fontWeight:700,color:T.red,marginBottom:4}}>ISSUES / DELAYS</div><div style={{fontSize:13,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{r.issues}</div></div>}
                        {r.notes&&<div><div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:4}}>NOTES</div><div style={{fontSize:13,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{r.notes}</div></div>}
                      </div>
                      {r.fileLink&&(
                        <div style={{display:"flex",alignItems:"center",gap:10,background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 14px"}}>
                          <span style={{fontSize:18}}>{/\.pdf$/i.test(r.fileName||r.fileLink)?"📄":/\.(xlsx?|csv)$/i.test(r.fileName||r.fileLink)?"📊":/\.(png|jpe?g|webp)$/i.test(r.fileName||r.fileLink)?"🖼️":"📎"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.fileName||"Daily Report File"}</div>
                            <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>Attached report sheet</div>
                          </div>
                          <a href={r.fileLink} target="_blank" rel="noreferrer"
                            style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,textDecoration:"none",flexShrink:0}}>
                            ↗ Open
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null)}
      </div>

      {editProj&&<ProjectAnalysisModal proj={proj} projectNames={projectNames} onSave={p=>{onUpdate(p);setEditProj(false);}} onClose={()=>setEditProj(false)}/>}
      {drModal&&<DailyReportModal report={drModal==="new"?null:drModal} projectName={proj.project} onSave={saveReport} onClose={()=>setDrModal(null)}/>}
    </div>
  );
}

/* ── Project Analysis list page ── */
function ProjectAnalysisPage({ data, setData, showToast, go }) {
  const [modal,  setModal]  = useState(null);
  const [detail, setDetail] = useState(null);
  const [fStat,  setFStat]  = useState("All");
  const [search, setSearch] = useState("");
  const [showDprConsolidate, setShowDprConsolidate] = useState(false);

  const projects  = data.projects || [];
  const analysis  = data.projectAnalysis || [];
  const projectDocs = data.projectDocs || [];

  const save = p => {
    const exists = analysis.find(x=>x.id===p.id);
    const updated = exists ? analysis.map(x=>x.id===p.id?p:x) : [...analysis,p];
    setData(prev=>({...prev,projectAnalysis:updated}));
    showToast(exists?"Project updated":"Project added");
    setModal(null);
  };
  const del = id => {
    setData(prev=>({...prev,projectAnalysis:prev.projectAnalysis.filter(x=>x.id!==id)}));
    showToast("Project deleted","del");
    setDetail(null);
  };
  const update = p => {
    setData(prev=>({...prev,projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.id===p.id?p:x)}));
    showToast("Saved");
  };

  const detailRec = detail ? analysis.find(x=>x.id===detail) : null;
  if (detailRec) {
    return <ProjectAnalysisDetail
      proj={detailRec} projectDocs={projectDocs} projectNames={projects}
      onUpdate={p=>{update(p);setDetail(p.id);}} onDelete={()=>del(detailRec.id)}
      onBack={()=>setDetail(null)} go={go}/>;
  }

  // Enrich each record with live invoice stats
  const enriched = analysis.map(p => ({
    ...p,
    ...deriveProjectStats(p.project, projectDocs),
  }));

  let visible = enriched;
  if (fStat !== "All") visible = visible.filter(x=>x.status===fStat);
  if (search.trim()) visible = visible.filter(x=>
    [x.project,x.poNumber,x.clientName,x.quotationRef,x.status].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))
  );

  const totalPO        = enriched.reduce((s,x)=>s+(parseFloat(x.poValue)||0),0);
  const totalInvoiced  = enriched.reduce((s,x)=>s+x.totalInvoiced,0);
  const totalCollected = enriched.reduce((s,x)=>s+x.totalCollected,0);
  const totalDue       = enriched.reduce((s,x)=>s+x.totalDue,0);

  return (
    <div style={{maxWidth:"min(1300px,98vw)",margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(22px,3vw,32px)",color:T.text,letterSpacing:1}}>PROJECT ANALYSIS</div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>
            {analysis.length} project{analysis.length!==1?"s":""} · Progress auto-calculated from Project Docs invoices
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>setShowDprConsolidate(true)}
            style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:11,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            📊 DPR Consolidation
          </button>
          <button onClick={()=>setModal("new")} style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",color:"#000",borderRadius:11,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:`0 4px 14px ${T.gold}44`}}>+ New Project</button>
        </div>
      </div>

      {/* Portfolio KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:18}}>
        {[
          {label:"Total PO Value",   v:formatSarCompact(totalPO),        color:T.gold},
          {label:"Total Invoiced",   v:formatSarCompact(totalInvoiced),  color:T.green},
          {label:"Total Collected",  v:formatSarCompact(totalCollected), color:T.blue},
          {label:"Total Due",        v:formatSarCompact(totalDue),       color:totalDue>0?T.red:T.textMuted},
          {label:"In Progress",      v:enriched.filter(x=>x.status==="In Progress").length, color:T.blue},
          {label:"Completed",        v:enriched.filter(x=>x.status==="Completed").length,   color:T.green},
        ].map((k,i)=>(
          <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:T.shadow,animationDelay:`${i*.05}s`}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(16px,2.5vw,26px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:4,fontWeight:600}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects…"
          style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 13px",fontSize:13,color:T.text,outline:"none",width:200}}
          onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
        <select value={fStat} onChange={e=>setFStat(e.target.value)}
          style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 13px",fontSize:13,color:T.text,outline:"none"}}>
          <option value="All">All Statuses</option>
          {["Not Started","In Progress","On Hold","Completed","Cancelled"].map(s=><option key={s}>{s}</option>)}
        </select>
        {(fStat!=="All"||search)&&(
          <button onClick={()=>{setFStat("All");setSearch("");}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:9,padding:"8px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ Clear</button>
        )}
        <div style={{marginLeft:"auto",fontSize:12,color:T.textMuted}}>{visible.length} result{visible.length!==1?"s":""}</div>
      </div>

      {/* Project cards */}
      {visible.length===0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",background:T.card,border:`1px solid ${T.border}`,borderRadius:18}}>
          <div style={{fontSize:48,marginBottom:16}}>📊</div>
          <div style={{fontSize:16,color:T.textMuted,fontWeight:600}}>
            {analysis.length===0 ? "No projects yet — click + New Project to get started" : "No projects match the filters"}
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,380px),1fr))",gap:16}}>
          {visible.map((p,i)=>{
            const poValue = parseFloat(p.poValue)||0;
            const pct = poValue>0 ? Math.min(100,Math.round((p.totalInvoiced/poValue)*100)) : 0;
            const dl = daysLeft(p.estEndDate);
            const stColor = {"Not Started":T.textMuted,"In Progress":T.blue,"On Hold":T.gold,"Completed":T.green,"Cancelled":T.red}[p.status]||T.textMuted;
            return (
              <div key={p.id} className="fade-up card-hover" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",boxShadow:T.shadow,animationDelay:`${i*.04}s`,cursor:"pointer",display:"flex",flexDirection:"column",gap:14}}
                   onClick={()=>setDetail(p.id)}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.project||"Unnamed"}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                      {p.clientName&&<span>{p.clientName}</span>}
                      {p.poNumber&&<span>PO: {p.poNumber}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setModal(p)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer"}}>✎</button>
                    <button onClick={()=>del(p.id)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer"}}>✕</button>
                  </div>
                </div>
                {/* Status + PO value */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{background:`${stColor}18`,border:`1px solid ${stColor}44`,color:stColor,borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:700}}>{p.status||"—"}</span>
                  {poValue>0&&<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.gold}}>{formatSarCompact(poValue)}</span>}
                </div>
                {/* Progress bar — invoiced vs PO */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12}}>
                    <span style={{color:T.textMuted,fontWeight:600}}>INVOICED PROGRESS</span>
                    <span style={{fontWeight:800,color:pctColor(pct)}}>{pct}%</span>
                  </div>
                  <div style={{height:8,background:T.border,borderRadius:999,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,borderRadius:999,background:`linear-gradient(90deg,${pctColor(pct)},${pctColor(pct)}bb)`,transition:"width 1s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:T.textMuted}}>
                    <span>{formatSarCompact(p.totalInvoiced)} invoiced</span>
                    <span>{poValue>0?formatSarCompact(poValue)+" total":p.invs.length+" invoices"}</span>
                  </div>
                </div>
                {/* Collected / Due */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:9,padding:"8px 12px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.green}}>{formatSarCompact(p.totalCollected)}</div>
                    <div style={{fontSize:10,color:T.green,marginTop:2,fontWeight:700}}>✓ COLLECTED</div>
                  </div>
                  <div style={{background:p.totalDue>0?T.redDim:T.greenDim,border:`1px solid ${p.totalDue>0?T.red:T.green}33`,borderRadius:9,padding:"8px 12px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:p.totalDue>0?T.red:T.green}}>{formatSarCompact(p.totalDue)}</div>
                    <div style={{fontSize:10,color:p.totalDue>0?T.red:T.green,marginTop:2,fontWeight:700}}>⏳ DUE</div>
                  </div>
                </div>
                {/* Date row */}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted}}>
                  <span>{p.startDate?fmtDate(p.startDate):"No start date"}</span>
                  {dl!==null
                    ? <span style={{color:dl<0?T.red:dl<30?T.gold:T.green,fontWeight:600}}>{dl>=0?`${dl}d left`:`${Math.abs(dl)}d overdue`}</span>
                    : <span>{p.estEndDate?fmtDate(p.estEndDate):"No end date"}</span>
                  }
                </div>
                {/* Jobs count */}
                {p.jobs.length>0&&(
                  <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:8,padding:"6px 12px",fontSize:12,color:T.gold,fontWeight:600}}>
                    🏗 {p.jobs.length} Job{p.jobs.length!==1?"s":""} · {p.invs.length} Invoice{p.invs.length!==1?"s":""}
                    {(p.dailyReports?.length||0)>0&&<span style={{marginLeft:10,color:T.orange}}>📝 {p.dailyReports.length} report{p.dailyReports.length!==1?"s":""}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDprConsolidate&&<DprConsolidateModal projectAnalysis={analysis} onClose={()=>setShowDprConsolidate(false)}/>}
      {modal&&<ProjectAnalysisModal proj={modal==="new"?null:modal} projectNames={projects} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}


export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loadingData, setLoadingData] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [projMod, setProjMod] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [financeAuthed,  setFinanceAuthed]  = useState(false);
  const [analysisAuthed, setAnalysisAuthed] = useState(false);
  const [costAuthed,     setCostAuthed]     = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("cta_dark") === "true"; }
    catch { return false; }
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedInvoiceYear, setSelectedInvoiceYear] = useState("All");
  const { width: viewportWidth } = useViewport();

  useEffect(() => {
    if (!document.getElementById("ct-g")) {
      const s = document.createElement("style");
      s.id = "ct-g";
      s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=data`, {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const rows = await res.json();
          if (rows.length && rows[0].data) setData({ ...EMPTY_DATA, ...rows[0].data });
        }
      } catch (err) {
        console.error("Supabase load failed:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const [notifySettings, setNotifySettings] = useState(() => loadNotifySettings());
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyTestResult, setNotifyTestResult] = useState(null);

  // Load EmailJS SDK once
  useEffect(() => {
    if (window.emailjs) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.onload = () => { try { window.emailjs.init(EMAILJS_PUBLIC_KEY); } catch {} };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.body.style.background = darkMode ? DARK.bg : LIGHT.bg;
    try { localStorage.setItem("cta_dark", darkMode); } catch {}
  }, [darkMode]);

  useEffect(() => {
    if (loadingData) return;

    const t = setTimeout(() => {
      saveAppData(data).catch(err => { console.error("Save failed:", err); });
    }, 400);

    return () => clearTimeout(t);
  }, [data, loadingData]);

  // ── Daily email notification check (must be before any early returns) ──
  const allExpiriesRef = useRef([]);
  useEffect(() => {
    if (!notifySettings.enabled) return;
    const recipients = notifySettings.emails || [];
    if (recipients.length === 0) return;
    if (!window.emailjs) return;
    const lastSent = localStorage.getItem(NOTIFY_LAST_SENT_KEY);
    const today = new Date().toDateString();
    if (lastSent === today) return;
    const threshold = Number(notifySettings.thresholdDays) || 90;
    const alertsToSend = allExpiriesRef.current.filter(a => a.days <= threshold);
    if (alertsToSend.length === 0) return;
    // Send to each recipient
    Promise.all(
      recipients.map(email =>
        window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailPayload(alertsToSend, email, false))
      )
    ).then(() => {
      localStorage.setItem(NOTIFY_LAST_SENT_KEY, today);
    }).catch(err => console.warn("EmailJS daily send failed:", err));
  }, [notifySettings, data]);

  T = darkMode ? DARK : LIGHT;

  if (loadingData) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
        color: T.text,
        fontFamily: "'Barlow Condensed',sans-serif",
        fontSize: 24,
        fontWeight: 700
      }}>
        Loading shared data...
      </div>
    );
  }

  const logout = () => {
    try { localStorage.removeItem(AUTH_KEY); } catch {}
    setAuthed(false);
    setFinanceAuthed(false);
    setAnalysisAuthed(false);
    setCostAuthed(false);
  };

  // ...rest of your App code continues here

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(() => setToast(null), 3200); };

  const go = p => { setPage(p); setSideOpen(false); if (p !== "finance") setFinanceAuthed(false); if (p !== "analysis") setAnalysisAuthed(false); if (p !== "costs") setCostAuthed(false); };

  const saveProjects = projects => setData(prev=>({...prev,projects}));

  /* ── expiry alerts across everything ── */
  const allExpiries = [
    ...data.scorpionDocs.filter(d=>d.expiryDate).map(d=>({label:d.name,src:"Company Doc",days:daysUntil(d.expiryDate),page:"scorpion"})),
    ...(data.projectDocs||[]).filter(d=>d.expiryDate).map(d=>({label:d.name,src:"Project Doc",days:daysUntil(d.expiryDate),page:"projects"})),
    ...data.manpower.flatMap(p=>[
      p.passportExpiry && {label:p.name,src:"Passport",    days:daysUntil(p.passportExpiry),page:"manpower"},
      p.visaExpiry     && {label:p.name,src:"Visa",        days:daysUntil(p.visaExpiry),page:"manpower"},
      p.iqamaExpiry    && {label:p.name,src:"Iqama",       days:daysUntil(p.iqamaExpiry),page:"manpower"},
      p.muqeemExpiry   && {label:p.name,src:"Muqeem",      days:daysUntil(p.muqeemExpiry),page:"manpower"},
      ...(p.certs||[]).map(c=>({label:`${p.name} — ${c.name}`,src:"Cert",days:daysUntil(c.expiryDate),page:"manpower"})),
    ].filter(Boolean)),
    ...data.equipment.flatMap(e=>[
      ...(e.certifications||[]).map(c=>({label:`${e.name} — ${c.certNo||"Cert"}`,src:"Eq Cert",days:daysUntil(c.expiryDate),page:"equipment"})),
      ...(e.insurance||[]).map(c=>({label:`${e.name} — Insurance`,src:"Insurance",days:daysUntil(c.expiryDate),page:"equipment"})),
      ...(e.permits||[]).map(c=>({label:`${e.name} — ${c.type||"Permit"}`,src:"Permit",days:daysUntil(c.expiryDate),page:"equipment"})),
    ]),
  ].filter(x=>x.days!==null&&x.days<=90).sort((a,b)=>a.days-b.days);
  allExpiriesRef.current = allExpiries;

  // Global search results
  const searchResults = globalSearch.length > 1 ? (() => {
    const q = globalSearch.toLowerCase();
    const results = [];
    data.scorpionDocs.forEach(d=>{ if(Object.values(d).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Company Doc",label:d.name,sub:d.category,page:"scorpion"}); });
    (data.projectDocs||[]).forEach(d=>{ if(Object.values(d).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Project Doc",label:d.name,sub:d.project,page:"projects"}); });
    data.manpower.forEach(p=>{ if(Object.values(p).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Person",label:p.name,sub:p.designation,page:"manpower"}); });
    data.equipment.forEach(e=>{ if(Object.values(e).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Equipment",label:e.name,sub:e.serialNo,page:"equipment"}); });
    return results.slice(0,12);
  })() : [];

  if (!authed) {
    return <LoginPage onLogin={(pw) => {
      if (pw === COMPANY_PASSWORD) { try{localStorage.setItem(AUTH_KEY,"true");}catch{} setAuthed(true); return true; }
      return false;
    }} />;
  }

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:T.bg}}>
      {showWelcome && <WelcomeScreen onEnter={()=>setShowWelcome(false)}/>}
      {notifyModal && (
        <NotificationSettingsModal
          settings={notifySettings}
          allExpiries={allExpiries}
          sending={notifySending}
          testResult={notifyTestResult}
          onSave={s => { setNotifySettings(s); saveNotifySettings(s); setNotifyModal(false); setNotifyTestResult(null); }}
          onClose={() => { setNotifyModal(false); setNotifyTestResult(null); }}
          onTest={async (s) => {
            const recipients = s.emails || [];
            if (recipients.length === 0) return;
            setNotifySending(true); setNotifyTestResult(null);
            const threshold = Number(s.thresholdDays) || 90;
            const alertsToSend = allExpiries.filter(a => a.days <= threshold);
            try {
              await Promise.all(
                recipients.map(email =>
                  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailPayload(alertsToSend, email, true))
                )
              );
              setNotifyTestResult({ok:true, msg:`✅ Test email sent to ${recipients.length} recipient${recipients.length!==1?"s":""}: ${recipients.join(", ")}`});
            } catch (err) {
              setNotifyTestResult({ok:false, msg:`❌ Failed: ${err?.text || err?.message || "Unknown error"}`});
            }
            setNotifySending(false);
          }}
        />
      )}
      {sideOpen && <div className="fade-in" onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(13,31,53,0.45)",zIndex:49}}/>}

      <Sidebar page={page} go={go} sideOpen={sideOpen} alerts={allExpiries.length} data={data} viewportWidth={viewportWidth} onManageProjects={()=>{setSideOpen(false);setProjMod(true);}} darkMode={darkMode} onToggleDark={()=>setDarkMode(d=>!d)} onLogout={logout} financeAuthed={financeAuthed} analysisAuthed={analysisAuthed} costAuthed={costAuthed}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* ── Top bar ── */}
        <header style={{background:T.sidebar,borderBottom:"2px solid transparent",backgroundImage:`linear-gradient(${T.sidebar},${T.sidebar}), linear-gradient(90deg,#fbbf24,#38bdf8,#34d399,#fbbf24)`,backgroundOrigin:"border-box",backgroundClip:"padding-box, border-box",padding:"0 20px",flexShrink:0,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",height:56,position:"relative"}}>
            {viewportWidth < 1200 && (
  <button
    onClick={() => setSideOpen(true)}
    style={{
      background:"rgba(255,255,255,0.08)",
      border:"1px solid rgba(255,255,255,0.15)",
      color:"#ffffff",
      borderRadius:8,
      width:40,
      height:40,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      fontSize:18,
      flexShrink:0,
      zIndex:1
    }}
  >
    ☰
  </button>
)}
            <div style={{position:"absolute",left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,letterSpacing:"2px",color:"#f59e0b",textTransform:"uppercase"}}>SCORPION ARABIA</div>
              <div style={{fontSize:11,color:"#93c5fd",letterSpacing:"1.5px",marginTop:1}}>ENTERPRISE RESOURCE PLANNING</div>
            </div>
            <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",zIndex:1}}>
              {/* Global search */}
              <div style={{position:"relative"}}>
                {showSearch
                  ? <input autoFocus value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
                      onBlur={()=>{if(!globalSearch)setShowSearch(false);}}
                      placeholder="Search everything…"
                      style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,padding:"7px 12px",fontSize:13,color:"#fff",outline:"none",width:220}}/>
                  : <button onClick={()=>setShowSearch(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⌕</button>
                }
                {searchResults.length>0&&showSearch&&(
                  <div style={{position:"absolute",top:42,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,width:320,maxHeight:380,overflowY:"auto",boxShadow:T.shadow,zIndex:200}}>
                    {searchResults.map((r,i)=>(
                      <div key={i} onClick={()=>{go(r.page);setShowSearch(false);setGlobalSearch("");}}
                        style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${darkMode?DARK.border:T.border}`,transition:"background .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=darkMode?DARK.cardHover:T.cardHover}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{fontSize:13,fontWeight:600,color:T.text}}>{r.label}</div>
                        <div style={{fontSize:11,color:T.textMuted,marginTop:2,display:"flex",gap:6}}>
                          <span style={{background:T.blueDim,color:T.blue,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.type}</span>
                          <span>{r.sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {allExpiries.length>0 && (
                <div style={{background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.5)",color:"#fca5a5",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  ▲ <span style={{background:"#dc2626",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:11,fontWeight:700}}>{allExpiries.length}</span>
                </div>
              )}
              {/* Notification bell */}
              <button onClick={() => setNotifyModal(true)} title="Email Notification Settings"
                style={{background:notifySettings.enabled?"rgba(251,191,36,0.15)":"transparent",border:`1px solid ${notifySettings.enabled?T.gold:T.border}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:16,color:notifySettings.enabled?T.gold:T.textMuted,display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
                🔔{notifySettings.enabled && <span style={{fontSize:10,fontWeight:700,color:T.gold}}>ON</span>}
              </button>
            </div>
          </div>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:"clamp(14px,2vw,28px) clamp(14px,2.5vw,32px)"}}>
          {page==="dashboard" && <div className="fade-in" key="dashboard"><Dashboard data={data} alerts={allExpiries} go={go}/></div>}
          {page==="scorpion"  && <div className="fade-in" key="scorpion"><ScorpionDocs data={data} setData={setData} showToast={showToast}/></div>}
          {page==="projects"  && <div className="fade-in" key="projects"><ProjectDocs data={data} setData={setData} showToast={showToast}/></div>}
          {page==="analysis"  && (
            analysisAuthed
              ? <div className="fade-in" key="analysis"><ProjectAnalysisPage data={data} setData={setData} showToast={showToast} go={go}/></div>
              : <FinanceLoginPage title="PROJECT ANALYSIS ACCESS" subtitle="This section is restricted. Enter the analysis password to continue." passwordLabel="ANALYSIS PASSWORD" placeholder="Enter analysis password…" onLogin={(pw) => {
                  if (pw === ANALYSIS_PASSWORD) { setAnalysisAuthed(true); return true; }
                  return false;
                }}/>
          )}
          {page==="manpower"  && <div className="fade-in" key="manpower"><ManpowerPage data={data} setData={setData} showToast={showToast}/></div>}
          {page==="equipment" && <div className="fade-in" key="equipment"><EquipmentPage data={data} setData={setData} showToast={showToast}/></div>}
          {page==="maintenance" && <div className="fade-in" key="maintenance"><MaintenancePage data={data} setData={setData} showToast={showToast}/></div>}
          {page==="costs" && (
            costAuthed
              ? <div className="fade-in" key="costs"><CostControlPage data={data} setData={setData} showToast={showToast} go={go}/></div>
              : <FinanceLoginPage title="COST CONTROL ACCESS" subtitle="This section contains sensitive financial data.\nEnter the cost control password to continue." passwordLabel="COST CONTROL PASSWORD" placeholder="Enter password…" onLogin={(pw) => {
                  if (pw === COST_PASSWORD) { setCostAuthed(true); return true; }
                  return false;
                }}/>
          )}
          {page==="finance" && (
            financeAuthed
              ? <div className="fade-in" key="finance"><FinancePage data={data} setData={setData} showToast={showToast} selectedInvoiceYear={selectedInvoiceYear} setSelectedInvoiceYear={setSelectedInvoiceYear}/></div>
              : <FinanceLoginPage onLogin={(pw) => {
                  if (pw === FINANCE_PASSWORD) {
                    setFinanceAuthed(true);
                    return true;
                  }
                  return false;
                }}/>
          )}
        </main>
      </div>

      {projMod && <ProjectsModal projects={data.projects||[]} onSave={saveProjects} onClose={()=>setProjMod(false)}/>}

      {toast && (
        <div className="pop-in" style={{position:"fixed",bottom:24,right:24,zIndex:999,background:toast.type==="del"?"#fee2e2":"#d1fae5",border:`1px solid ${toast.type==="del"?T.red:T.green}`,color:toast.type==="del"?T.red:T.green,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10}}>
          {toast.type==="del"?"✕":"✓"} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════════════════════ */
function Sidebar({page,go,sideOpen,alerts,data,viewportWidth,onManageProjects,darkMode,onToggleDark,onLogout,financeAuthed,analysisAuthed,costAuthed}) {
  const isMobile = viewportWidth < 1200;
  const NAV = [
    {id:"dashboard", icon:"▦", label:"Dashboard",          desc:"Overview"},
    {id:"scorpion",  icon:"◉", label:"Scorpion Documents", desc:"Company docs & licenses"},
    {id:"projects",  icon:"◆", label:"Project Docs",       desc:"Certs & daily reports"},
    {id:"analysis",  icon:"◐", label:"Project Analysis",   desc:"PO value, progress & jobs", locked:!analysisAuthed},
    {id:"costs",     icon:"⊕", label:"Cost Control",       desc:"Budget vs actual, margin",  locked:!costAuthed},
    {id:"manpower",  icon:"◈", label:"Manpower",           desc:"Staff & certifications"},
    {id:"equipment", icon:"◎", label:"Equipment",          desc:"Assets & records"},
    {id:"maintenance", icon:"🛠", label:"Maintenance", desc:"Equipment maintenance requests",},
    {id:"finance",   icon:"$", label:"Finance",            desc:"Invoices & work orders",    locked:!financeAuthed},
  ];
  return (
    <aside style={{width:"clamp(220px,18vw,280px)",flexShrink:0,background:T.sidebar,borderRight:"none",display:"flex",flexDirection:"column",zIndex:50,position:isMobile?"fixed":"relative",top:0,left:0,height:"100%",transform:isMobile?(sideOpen?"translateX(0)":"translateX(-100%)"):"none",transition:"transform .28s ease",boxShadow:"2px 0 12px rgba(0,0,0,0.06)"}}>
      <div style={{padding:"22px 20px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{position:"relative",flexShrink:0,width:72,height:72}}>
          {/* Spinning rings — thin and tight */}
          <div className="logo-ring-spin" style={{position:"absolute",inset:-2,borderRadius:"50%",border:"1px solid rgba(251,191,36,0.4)",pointerEvents:"none"}}/>
          <div className="logo-ring-spin-rev" style={{position:"absolute",inset:-5,borderRadius:"50%",border:"1px dashed rgba(56,189,248,0.18)",pointerEvents:"none"}}/>
          {/* Logo — bigger, black border minimal */}
          <div className="logo-animate" style={{width:72,height:72,borderRadius:"50%",background:"#000",overflow:"hidden",boxShadow:"0 0 16px rgba(251,191,36,0.35)",border:"1.5px solid rgba(251,191,36,0.4)",position:"relative",zIndex:1}}>
            <img src="logo.png" alt="Scorpion Arabia" style={{width:"100%",height:"100%",objectFit:"cover",mixBlendMode:"lighten"}}/>
          </div>
        </div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(16px,1.4vw,22px)",letterSpacing:"1px",lineHeight:1.1,background:"linear-gradient(90deg,#92400e,#fbbf24,#fef3c7,#fbbf24,#f59e0b,#92400e)",backgroundSize:"300% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"shimmer 8s linear infinite",filter:"drop-shadow(0 0 8px rgba(251,191,36,0.6))"}}>SCORPION ARABIA</div>
            <div style={{fontSize:12,color:T.textSub,fontWeight:600,letterSpacing:"1.4px",marginTop:3,color:"#93c5fd"}}>PORTAL</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"14px 10px",flex:1,overflowY:"auto"}}>
          {NAV.map(n=>{
          const active=page===n.id;
          const badge=n.id==="dashboard"?alerts:0;
          return (
            <button key={n.id} onClick={()=>go(n.id)} className="nav-item" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:8,border:"none",marginBottom:3,textAlign:"left",background:active?"rgba(59,130,246,0.15)":"transparent",borderLeft:`2px solid ${active?"#93c5fd":"transparent"}`,transition:"all .15s",cursor:"pointer"}}>
              <span style={{fontSize:20,color:active?"#93c5fd":n.locked?"#64748b":"#94a3b8"}}>{n.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"clamp(12px,1vw,14px)",fontWeight:600,color:active?"#93c5fd":n.locked?"#64748b":"#e2e8f0"}}>{n.label}</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{n.locked?"🔒 Finance access required":n.desc}</div>
              </div>
              {badge>0&&<span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700}}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      {/* Manage Projects */}
      <div style={{padding:"6px 10px 0"}}>
        <button onClick={onManageProjects} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"1px solid #334155",background:"transparent",textAlign:"left",transition:"all .15s",marginBottom:4}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.borderColor="#93c5fd";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="#334155";}}>
          <span style={{fontSize:16,color:T.blue}}>⊕</span>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>Manage Projects</div>
            <div style={{fontSize:10,color:"#64748b"}}>Add, rename, delete</div>
          </div>
        </button>
      </div>
      <div style={{padding:"10px 10px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",gap:6}}>
        <button onClick={onToggleDark} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:darkMode?"rgba(251,191,36,0.12)":"transparent",cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}
          onMouseLeave={e=>e.currentTarget.style.background=darkMode?"rgba(251,191,36,0.12)":"transparent"}>
          <span style={{fontSize:16}}>{darkMode?"☀️":"🌙"}</span>
          <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0"}}>{darkMode?"Light Mode":"Dark Mode"}</span>
        </button>
        <button onClick={onLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"1px solid rgba(248,113,113,0.2)",background:"transparent",cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(248,113,113,0.1)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span style={{fontSize:14}}>🚪</span>
          <span style={{fontSize:12,fontWeight:600,color:"#f87171"}}>Log Out</span>
        </button>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",textAlign:"center",marginTop:2}}>Scorpion Arabia © 2025</div>
      </div>
    </aside>
  );
}

/* ── Projects Manager Modal ──────────────────────────────────────────────── */
function ProjectsModal({projects,onSave,onClose}) {
  const [list,    setList]    = useState(projects.map(p=>typeof p==="string"?{name:p,client:""}:{...p}));
  const [newName, setNewName] = useState("");
  const [newClient,setNewClient]=useState("");
  const [editing, setEditing] = useState(null); // {idx, field, val}

  const clients = [...new Set(list.map(p=>p.client).filter(Boolean))].sort();

  const add = () => {
    const n=newName.trim();
    if(!n||list.some(x=>x.name===n)) return;
    setList(l=>[...l,{name:n,client:newClient.trim()}]);
    setNewName("");
  };

  const del = idx => setList(l=>l.filter((_,i)=>i!==idx));

  const startEdit = (idx,field,val) => setEditing({idx,field,val});
  const commitEdit = () => {
    if(!editing) return;
    const v=editing.val.trim();
    if(editing.field==="name"){
      if(v&&!list.some((x,i)=>x.name===v&&i!==editing.idx))
        setList(l=>l.map((x,i)=>i===editing.idx?{...x,name:v}:x));
    } else {
      setList(l=>l.map((x,i)=>i===editing.idx?{...x,client:v}:x));
    }
    setEditing(null);
  };

  // Group by client for display
  const byClient = {};
  const noClient = [];
  list.forEach((p,i)=>{ if(p.client){if(!byClient[p.client])byClient[p.client]=[];byClient[p.client].push({...p,_idx:i});}else noClient.push({...p,_idx:i}); });
  const clientGroups = Object.keys(byClient).sort();

  const renderRow = (p,i) => (
    <div key={p._idx} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 12px",background:T.bg,borderRadius:9,marginBottom:6,border:`1px solid ${T.border}`}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        {editing&&editing.idx===p._idx&&editing.field==="name"
          ?<input autoFocus value={editing.val} onChange={e=>setEditing({...editing,val:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(null);}} onBlur={commitEdit}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.blue}`,borderRadius:6,padding:"4px 8px",fontSize:13,color:T.text,outline:"none"}}/>
          :<div style={{fontSize:13,fontWeight:600,color:T.text,cursor:"text"}} onDoubleClick={()=>startEdit(p._idx,"name",p.name)}>{p.name}</div>
        }
        {editing&&editing.idx===p._idx&&editing.field==="client"
          ?<input autoFocus value={editing.val} onChange={e=>setEditing({...editing,val:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(null);}} onBlur={commitEdit}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.gold}`,borderRadius:6,padding:"3px 7px",fontSize:11,color:T.text,outline:"none",marginTop:3}}/>
          :<div style={{fontSize:11,color:p.client?T.gold:T.textMuted,marginTop:2,cursor:"text"}} onDoubleClick={()=>startEdit(p._idx,"client",p.client||"")}>{p.client||"No client — double-click to assign"}</div>
        }
      </div>
      <button onClick={()=>startEdit(p._idx,"name",p.name)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,cursor:"pointer"}} title="Rename">✎</button>
      <button onClick={()=>del(p._idx)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,cursor:"pointer"}} title="Delete">✕</button>
    </div>
  );

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:500,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>MANAGE PROJECTS</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{list.length} project{list.length!==1?"s":""} across {clients.length} client{clients.length!==1?"s":""}</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>

        {/* Add new */}
        <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8,letterSpacing:".5px"}}>ADD NEW PROJECT</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="Project name…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newClient} onChange={e=>setNewClient(e.target.value)} list="existing-clients" onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="Client name (optional)…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=T.border}/>
            <datalist id="existing-clients">{clients.map(c=><option key={c} value={c}/>)}</datalist>
            <button onClick={add} style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,flexShrink:0,cursor:"pointer"}}>+ Add</button>
          </div>
        </div>

        {/* Grouped list */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 22px"}}>
          {list.length===0&&<div style={{textAlign:"center",padding:"30px",color:T.textMuted,fontSize:13}}>No projects yet.</div>}

          {/* Grouped by client */}
          {clientGroups.map(c=>(
            <div key={c} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:800,color:T.gold,letterSpacing:".8px",textTransform:"uppercase"}}>{c}</div>
                <div style={{flex:1,height:1,background:T.border}}/>
                <div style={{fontSize:10,color:T.textMuted}}>{byClient[c].length} project{byClient[c].length!==1?"s":""}</div>
              </div>
              {byClient[c].map(renderRow)}
            </div>
          ))}

          {/* Ungrouped */}
          {noClient.length>0&&(
            <div style={{marginBottom:16}}>
              {clientGroups.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:800,color:T.textMuted,letterSpacing:".8px"}}>NO CLIENT</div>
                  <div style={{flex:1,height:1,background:T.border}}/>
                </div>
              )}
              {noClient.map(renderRow)}
            </div>
          )}
        </div>

        <div style={{padding:"12px 22px 22px",flexShrink:0,borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{onSave(list);onClose();}} style={{flex:2,background:`linear-gradient(135deg,${T.blue},#2563eb)`,border:"none",color:"#fff",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Save Projects</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
function Dashboard({ data, alerts, go }) {
  /* ── computed stats ── */
  const scorpionExp = data.scorpionDocs.filter(d=>{ const x=daysUntil(d.expiryDate); return x!==null&&x<=90; }).length;
  const scorpionExp30 = data.scorpionDocs.filter(d=>{ const x=daysUntil(d.expiryDate); return x!==null&&x<=30; }).length;

  const mpPeople = data.manpower.length;
  const mpCats   = data.manpowerCats.length;
  const mpDocAlerts = data.manpower.reduce((n,p)=>{
    const ds=[p.passportExpiry,p.visaExpiry,p.iqamaExpiry,p.muqeemExpiry,...(p.certs||[]).map(c=>c.expiryDate)];
    return n + ds.filter(d=>{ const x=daysUntil(d); return x!==null&&x<=90; }).length;
  },0);

  const eqTotal  = data.equipment.length;
  const eqActive = data.equipment.filter(e=>e.status==="Active").length;
  const eqMaint  = data.equipment.filter(e=>e.status==="Under Maintenance").length;
  const eqExp    = data.equipment.reduce((n,e)=>{
    const ds=[...(e.certifications||[]).map(c=>c.expiryDate),...(e.insurance||[]).map(c=>c.expiryDate),...(e.permits||[]).map(c=>c.expiryDate)];
    return n + ds.filter(d=>{ const x=daysUntil(d); return x!==null&&x<=90; }).length;
  },0);

  const totalAlerts  = alerts.length;
  const overdueCount = alerts.filter(a=>a.days<0).length;
  const expiring30   = alerts.filter(a=>a.days>=0&&a.days<=30).length;

  /* ── compliance pct (items with expiry tracked) ── */
  const allTracked = [
    ...data.scorpionDocs.filter(d=>d.expiryDate).map(d=>daysUntil(d.expiryDate)),
    ...data.manpower.flatMap(p=>[p.passportExpiry,p.visaExpiry,p.iqamaExpiry,p.muqeemExpiry,...(p.certs||[]).map(c=>c.expiryDate)].filter(Boolean).map(daysUntil)),
    ...data.equipment.flatMap(e=>[...(e.certifications||[]),...(e.insurance||[]),...(e.permits||[])].map(r=>daysUntil(r.expiryDate))),
  ];
  const validCount = allTracked.filter(d=>d!==null&&d>0).length;
  const pct = allTracked.length ? Math.round(validCount/allTracked.length*100) : 100;

  const expired  = alerts.filter(a=>a.days<0).sort((a,b)=>a.days-b.days);
  const expiring = alerts.filter(a=>a.days>=0).sort((a,b)=>a.days-b.days);

  const invoiceDocs = (data.projectDocs || []).filter(d => d.subTab === "invoices");

  const [alertModal, setAlertModal] = useState(null); // "overdue" | "expiring30"

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
                    ? `${expired.length} item${expired.length!==1?"s":""} past expiry — click any to go to that section`
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
                <button key={i} onClick={()=>{ go(a.page); setAlertModal(null); }}
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
          {label:"Total Alerts",    v:totalAlerts,  color:totalAlerts>0?T.red:T.green,  icon:"▲", click:null},
          {label:"Overdue",         v:overdueCount, color:overdueCount>0?T.red:T.textMuted, icon:"✕", click:overdueCount>0?()=>setAlertModal("overdue"):null},
          {label:"Due in 30 Days",  v:expiring30,   color:expiring30>0?T.gold:T.textMuted,  icon:"⏱", click:expiring30>0?()=>setAlertModal("expiring30"):null},
          {label:"Compliance",      v:`${pct}%`,    color:pct>=80?T.green:pct>=60?T.gold:T.red, icon:"◎", click:null},
          {label:"People",          v:mpPeople,     color:T.green,  icon:"◈", click:()=>go("manpower")},
          {label:"Equipment Assets",v:eqTotal,      color:T.gold,   icon:"◎", click:()=>go("equipment")},
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
          <DashboardMiniCard
            title="SCORPION DOCUMENTS"
            sub="CR, insurance, licenses, contracts"
            icon="◉"
            color={T.blue}
            stats={[
              {label:"Total Docs", value:data.scorpionDocs.length},
              {label:"Expiring", value:scorpionExp},
              {label:"Due in 30d", value:scorpionExp30},
              {label:"Categories", value:(data.scorpionDocCats||[]).length},
            ]}
            actionLabel="Open Documents →"
            onClick={() => go("scorpion")}
          />

          <DashboardMiniCard
            title="PROJECT DOCS"
            sub="Invoices, completion certs & work orders"
            icon="◆"
            color={T.teal}
            stats={[
              {label:"Total", value:(data.projectDocs || []).length},
              {label:"Invoices", value:invoiceDocs.length},
              {label:"Projects", value:(data.projects||[]).length},
              {label:"Docs per project", value:(data.projects||[]).length > 0 ? Math.round((data.projectDocs||[]).length / (data.projects||[]).length) : 0},
            ]}
            actionLabel="Open Project Docs →"
            onClick={() => go("projects")}
          />

          <DashboardMiniCard
            title="MANPOWER"
            sub="Staff, documents & certifications"
            icon="◈"
            color={T.green}
            stats={[
              {label:"People", value:mpPeople},
              {label:"Categories", value:mpCats},
              {label:"Doc Alerts", value:mpDocAlerts},
              {label:"Certs", value:data.manpower.reduce((n,p)=>n+(p.certs||[]).length,0)},
            ]}
            footer={(data.manpowerCats||[]).slice(0,4).map(c => `${c} (${data.manpower.filter(p=>p.category===c).length})`).join("   •   ")}
            actionLabel="Open Manpower →"
            onClick={() => go("manpower")}
          />

          <DashboardMiniCard
            title="EQUIPMENT"
            sub="Assets, certs, invoices & permits"
            icon="◎"
            color={T.gold}
            stats={[
              {label:"Total Assets", value:eqTotal},
              {label:"Active", value:eqActive},
              {label:"Maintenance", value:eqMaint},
              {label:"Exp. Alerts", value:eqExp},
            ]}
            footer={`Certs: ${data.equipment.reduce((n,e)=>n+(e.certifications||[]).length,0)}   •   Invoices: ${data.equipment.reduce((n,e)=>n+(e.invoices||[]).length,0)}   •   Insurance: ${data.equipment.reduce((n,e)=>n+(e.insurance||[]).length,0)}   •   Permits: ${data.equipment.reduce((n,e)=>n+(e.permits||[]).length,0)}`}
            actionLabel="Open Equipment →"
            onClick={() => go("equipment")}
          />

          {/* Finance teaser card */}
          <div
            className="fade-up card-hover"
            onClick={() => go("finance")}
            style={{background:`linear-gradient(135deg,${T.card},${T.card2})`,border:`1px solid ${T.gold}44`,borderRadius:18,boxShadow:T.shadow,padding:"18px 18px 16px",minHeight:230,display:"flex",flexDirection:"column",cursor:"pointer",position:"relative",overflow:"hidden"}}
          >
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
                {expired.slice(0,8).map((a,i)=><AlertRow key={i} a={a}/>)}
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
                {expiring.slice(0,8).map((a,i)=><AlertRow key={i} a={a}/>)}
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

function InvoiceMetricCard({ title, amount, sub, color, onClick, miniCards = [] }) {
  const cardGlow = `0 10px 34px ${String(color || T.blue).replace(')', ',0.16)').replace('rgb', 'rgba')}`;
  return (
    <div
      className="card-hover"
      style={{
        background:`linear-gradient(180deg, ${T.card} 0%, ${T.bg} 100%)`,
        border:`1px solid ${T.border}`,
        borderRadius:18,
        padding:"18px 18px 16px",
        boxShadow:T.shadow,
        position:"relative",
        overflow:"hidden",
      }}
    >
      <div
        style={{
          position:"absolute",
          inset:0,
          pointerEvents:"none",
          background:`radial-gradient(circle at top right, ${String(color || T.blue).replace(')', ',0.14)').replace('rgb', 'rgba')} 0%, transparent 40%)`,
        }}
      />

      <button
        onClick={onClick}
        style={{
          background:"transparent",
          border:"none",
          padding:0,
          margin:0,
          width:"100%",
          textAlign:"left",
          cursor:"pointer",
          position:"relative",
          zIndex:1,
        }}
      >
        <div style={{fontSize:12,color:T.textMuted,fontWeight:700,letterSpacing:".08em",marginBottom:10}}>{title}</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,44px)",color,lineHeight:1,textShadow:darkenTextShadow(color)}}>{amount}</div>
        <div style={{fontSize:13,color:T.textMuted,marginTop:10}}>{sub}</div>
        <div style={{fontSize:12,color:color,marginTop:10,fontWeight:700}}>Click to view details →</div>
      </button>

      {miniCards.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:14,position:"relative",zIndex:1}}>
          {miniCards.map((card) => {
            const type = /advance/i.test(card.title) ? "advance" : "income";
            const theme = getMetricTypeTheme(type);
            return (
              <button
                key={card.title}
                onClick={card.onClick}
                style={{
                  background:`linear-gradient(180deg, ${theme.dim} 0%, ${T.card} 100%)`,
                  border:`1px solid ${theme.accent}55`,
                  borderRadius:14,
                  padding:"12px 12px 10px",
                  textAlign:"left",
                  cursor:"pointer",
                  boxShadow:`inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px ${theme.glow}`,
                  transition:"transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px ${theme.glow}`; e.currentTarget.style.borderColor=`${theme.accent}88`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=`inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px ${theme.glow}`; e.currentTarget.style.borderColor=`${theme.accent}55`;}}
              >
                <div style={{fontSize:10,color:theme.accent,fontWeight:800,letterSpacing:".09em",marginBottom:8}}>{card.title}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:theme.accent,lineHeight:1}}>{card.amount}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function darkenTextShadow(color) {
  if (color === T.gold) return '0 2px 16px rgba(251,191,36,0.16)';
  if (color === T.blue) return '0 2px 16px rgba(56,189,248,0.16)';
  if (color === T.red) return '0 2px 16px rgba(248,113,113,0.12)';
  if (color === T.green) return '0 2px 16px rgba(52,211,153,0.12)';
  return 'none';
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
   COST CONTROL PAGE
════════════════════════════════════════════════════════════════════════════ */
const COST_CATS = [
  {id:"Labour",        color:"#38bdf8", icon:"◈"},
  {id:"Equipment",     color:"#fbbf24", icon:"◎"},
  {id:"Materials",     color:"#34d399", icon:"▦"},
  {id:"Subcontractor", color:"#a78bfa", icon:"◆"},
  {id:"Overhead",      color:"#fb923c", icon:"⊕"},
  {id:"Other",         color:"#94a3b8", icon:"·"},
];
const COST_CAT_MAP = Object.fromEntries(COST_CATS.map(c=>[c.id,c]));

function CostControlPage({data, setData, showToast, go}) {
  const [selProj, setSelProj] = useState(null);
  const [modal,   setModal]   = useState(null);
  const [filterCat, setFilterCat] = useState("All");

  const projects  = data.projects       || [];
  const analysis  = data.projectAnalysis|| [];
  const allCosts  = data.costControl    || [];
  const invoiceDocs = (data.projectDocs || []).filter(d=>d.subTab==="invoices");

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
    setData(prev=>({...prev, costControl:(prev.costControl||[]).filter(e=>e.id!==id)}));
    showToast("Deleted","del");
  };

  // ── Per-project P&L helper ──
  const getProjFinancials = (proj) => {
    const pa        = analysis.find(a=>a.project===proj);
    const poValue   = parseFloat(pa?.poValue)||0;
    const invs      = invoiceDocs.filter(d=>d.project===proj);
    const revenue   = invs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    const collected = invs.reduce((s,d)=>s+getInvoiceCollectedAmount(d),0);
    const costs     = allCosts.filter(c=>c.project===proj);
    const totalCost = costs.reduce((s,c)=>s+(parseFloat(c.amount)||0),0);
    const margin    = revenue - totalCost;
    const marginPct = revenue>0 ? Math.round((margin/revenue)*100) : null;
    return {poValue, revenue, collected, costs, totalCost, margin, marginPct, pa};
  };

  // ── Project overview cards ──
  if (!selProj) {
    const allMargin    = projects.reduce((s,p)=>{ const f=getProjFinancials(p); return s+f.margin; },0);
    const allRevenue   = projects.reduce((s,p)=>{ const f=getProjFinancials(pName(p)); return s+f.revenue; },0);
    const allCostTotal = projects.reduce((s,p)=>{ const f=getProjFinancials(pName(p)); return s+f.totalCost; },0);
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
          {[
            {label:"Total Revenue",  v:formatSarCompact(allRevenue),   color:T.green},
            {label:"Total Costs",    v:formatSarCompact(allCostTotal), color:T.red},
            {label:"Gross Margin",   v:formatSarCompact(allMargin),    color:allMargin>=0?T.green:T.red},
            {label:"Margin %",       v:overallPct!==null?`${overallPct}%`:"—", color:overallPct===null?T.textMuted:overallPct>=20?T.green:overallPct>=10?T.gold:T.red},
            {label:"Projects",       v:projects.length,                color:T.blue},
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
            const {poValue,revenue,collected,totalCost,margin,marginPct,costs} = getProjFinancials(proj);
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
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  <div style={{background:T.bg,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(revenue)}</div>
                    <div style={{fontSize:10,color:T.textMuted,marginTop:4,fontWeight:700}}>REVENUE</div>
                  </div>
                  <div style={{background:T.redDim,border:`1px solid ${T.red}22`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.red,lineHeight:1}}>{formatSarCompact(totalCost)}</div>
                    <div style={{fontSize:10,color:T.red,marginTop:4,fontWeight:700}}>TOTAL COST</div>
                  </div>
                  <div style={{background:margin>=0?T.greenDim:T.redDim,border:`1px solid ${margin>=0?T.green:T.red}22`,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:margin>=0?T.green:T.red,lineHeight:1}}>{formatSarCompact(Math.abs(margin))}</div>
                    <div style={{fontSize:10,color:margin>=0?T.green:T.red,marginTop:4,fontWeight:700}}>{margin>=0?"MARGIN":"LOSS"}</div>
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
  const {poValue, revenue, collected, totalCost, margin, marginPct, costs, pa} = getProjFinancials(selProj);
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
          {[
            {label:"CONTRACT VALUE (PO)", v:poValue?formatSarCompact(poValue):"Not set",   color:T.gold},
            {label:"REVENUE INVOICED",    v:formatSarCompact(revenue),                      color:T.green},
            {label:"AMOUNT COLLECTED",    v:formatSarCompact(collected),                    color:T.blue},
            {label:"TOTAL COSTS",         v:formatSarCompact(totalCost),                    color:T.red},
            {label:"GROSS MARGIN",        v:formatSarCompact(Math.abs(margin)),              color:margin>=0?T.green:T.red},
            {label:"MARGIN %",            v:marginPct!==null?`${marginPct}%`:"—",           color:marginPct===null?T.textMuted:marginPct>=20?T.green:marginPct>=10?T.gold:T.red},
          ].map((k,i)=>(
            <div key={k.label} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",animationDelay:`${i*.04}s`}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(18px,2.2vw,28px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
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
                      <ABtn color={T.red}  onClick={()=>delEntry(entry.id)}>✕</ABtn>
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
function FinanceLoginPage({ onLogin, title="FINANCE ACCESS", subtitle="This section is restricted.\nEnter the finance password to continue.", passwordLabel="FINANCE PASSWORD", placeholder="Enter finance password…" }) {
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
          UNLOCK FINANCE
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
  {id:"invoices",    label:"Invoices",                 icon:"🧾", color:T.green,  dim:T.greenDim},
  {id:"workorders",  label:"Work Orders / Agreements", icon:"📋", color:T.purple, dim:T.purpleDim},
];

function FinancePage({ data, setData, showToast, selectedInvoiceYear, setSelectedInvoiceYear }) {
  const [finTab, setFinTab] = useState("overview");
  const [invoiceDetailView, setInvoiceDetailView] = useState(null);
  const [modal, setModal] = useState(null);
  const [fProj, setFProj] = useState("");
  const [selProj, setSelProj] = useState(null);

  const projects  = data.projects    || [];
  const allDocs   = data.projectDocs || [];
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
    setData(prev => ({...prev, projectDocs:prev.projectDocs.filter(d => d.id !== id)}));
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

  const filteredInvoiceDocs = selectedInvoiceYear === "All"
    ? invoiceDocs
    : invoiceDocs.filter(doc => {
        if (!doc.dueDate) return false;
        const dt = new Date(doc.dueDate);
        return !Number.isNaN(dt.getTime()) && String(dt.getFullYear()) === selectedInvoiceYear;
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

  // ── Filtered work orders ──
  const filteredWoDocs = fProj ? woDocs.filter(d => d.project === fProj) : woDocs;
  // ── Filtered invoices (for the Invoices tab) ──
  const projInvs = selProj ? invoiceDocs.filter(d => d.project === selProj) : [];
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
            <select value={selectedInvoiceYear} onChange={e => setSelectedInvoiceYear(e.target.value)}
              style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
              <option value="All">All Years</option>
              {availableInvoiceYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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
              INVOICE VALUE {selectedInvoiceYear !== "All" ? `— ${selectedInvoiceYear}` : "— ALL YEARS"}
            </div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>
              {selectedInvoiceYear === "All" ? `Across all ${filteredInvoiceDocs.length} invoices` : `For ${selectedInvoiceYear} · ${filteredInvoiceDocs.length} invoices`}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
              <InvoiceMetricCard title="TOTAL INVOICE VALUE" amount={formatSarCompact(totalInvoiceValue)} sub={`${filteredInvoiceDocs.length} invoices · ${selectedInvoiceYear === "All" ? "all years" : selectedInvoiceYear}`} color={T.green} onClick={() => setInvoiceDetailView({mode:"all",stream:"all"})} miniCards={[{title:"INCOME INVOICED",amount:formatSarCompact(incomeInvoiced),color:T.green,onClick:()=>setInvoiceDetailView({mode:"all",stream:"income"})},{title:"ADVANCE INVOICED",amount:formatSarCompact(advanceInvoiced),color:T.gold,onClick:()=>setInvoiceDetailView({mode:"all",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT RECEIVED" amount={formatSarCompact(totalReceived)} sub={selectedInvoiceYear === "All" ? "Collected across all invoices" : `Collected for ${selectedInvoiceYear}`} color={T.blue} onClick={() => setInvoiceDetailView({mode:"received",stream:"all"})} miniCards={[{title:"RECEIVED FROM INCOME",amount:formatSarCompact(receivedFromIncome),color:T.blue,onClick:()=>setInvoiceDetailView({mode:"received",stream:"income"})},{title:"RECEIVED FROM ADVANCE",amount:formatSarCompact(receivedFromAdvance),color:T.teal,onClick:()=>setInvoiceDetailView({mode:"received",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT DUE" amount={formatSarCompact(totalDue)} sub={selectedInvoiceYear === "All" ? "Pending and partial balances" : `Outstanding for ${selectedInvoiceYear}`} color={T.red} onClick={() => setInvoiceDetailView({mode:"due",stream:"all"})} miniCards={[{title:"DUE FROM INCOME",amount:formatSarCompact(dueFromIncome),color:T.red,onClick:()=>setInvoiceDetailView({mode:"due",stream:"income"})},{title:"DUE FROM ADVANCE",amount:formatSarCompact(dueFromAdvance),color:T.orange,onClick:()=>setInvoiceDetailView({mode:"due",stream:"advance"})}]}/>
            </div>
          </div>

          {/* Per-project breakdown */}
          {projectBreakdown.length > 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>PER-PROJECT BREAKDOWN</div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Invoice collection status by project {selectedInvoiceYear !== "All" ? `for ${selectedInvoiceYear}` : ""}</div>
              <div style={{display:"grid",gap:12}}>
                {projectBreakdown.map((p,i) => (
                  <div key={p.proj} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 18px",animationDelay:`${i*.04}s`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{p.proj}</div>
                        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{p.count} invoice{p.count!==1?"s":""}</div>
                      </div>
                      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                        <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.green}}>{formatSarCompact(p.invoiced)}</div><div style={{fontSize:10,color:T.textMuted,fontWeight:600}}>INVOICED</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.blue}}>{formatSarCompact(p.collected)}</div><div style={{fontSize:10,color:T.textMuted,fontWeight:600}}>COLLECTED</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:p.due>0?T.red:T.green}}>{formatSarCompact(p.due)}</div><div style={{fontSize:10,color:T.textMuted,fontWeight:600}}>DUE</div></div>
                      </div>
                    </div>
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textMuted,marginBottom:4}}><span>Collection progress</span><span style={{fontWeight:700,color:pctColor(p.pct)}}>{p.pct}%</span></div>
                      <div style={{height:6,background:T.border,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${p.pct}%`,borderRadius:999,background:`linear-gradient(90deg,${pctColor(p.pct)},${pctColor(p.pct)}bb)`,transition:"width 1s"}}/></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoiceDetailView && <InvoiceYearDetailsModal view={invoiceDetailView} invoices={filteredInvoiceDocs} yearLabel={selectedInvoiceYear} onClose={() => setInvoiceDetailView(null)}/>}

          {filteredInvoiceDocs.length === 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center",boxShadow:T.shadow}}>
              <div style={{fontSize:44,marginBottom:12}}>📋</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.textSub,marginBottom:8}}>NO INVOICES</div>
              <div style={{fontSize:13,color:T.textMuted}}>{selectedInvoiceYear === "All" ? "No invoices found. Add invoices via the Invoices tab above." : `No invoices found for ${selectedInvoiceYear}. Try selecting a different year.`}</div>
            </div>
          )}
        </div>
      )}

      {/* ══ INVOICES TAB ══════════════════════════════════════════════════ */}
      {finTab === "invoices" && (
        selProj ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={() => setSelProj(null)} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selProj}</div>
                <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>{projInvs.length} invoice{projInvs.length!==1?"s":""} · Total: <span style={{color:T.green,fontWeight:700}}>SAR {projInvTotal.toLocaleString()}</span></div>
              </div>
              <Btn color={T.green} solid onClick={() => setModal({mode:"add",doc:{project:selProj}})}>+ Add Invoice</Btn>
            </div>
            {projInvs.length === 0
              ? <Empty icon="🧾" label="No invoices yet" sub="Add the first invoice for this project" color={T.green} onAdd={() => setModal({mode:"add",doc:{project:selProj}})}/>
              : <div style={{display:"grid",gap:10}}>{projInvs.map((doc,i) => <InvoiceCard key={doc.id} doc={doc} delay={i*.03} onEdit={() => setModal({mode:"edit",doc})} onDel={() => delDoc(doc.id)}/>)}</div>
            }
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>INVOICES</div>
                <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Select a project to view and manage invoices</div>
              </div>
              <Btn color={T.green} solid onClick={() => setModal({mode:"add"})}>+ Add Invoice</Btn>
            </div>
            {projects.length === 0
              ? <Empty icon="🧾" label="No projects yet" sub="Add projects via Manage Projects in the sidebar" color={T.green} onAdd={() => {}}/>
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
                          {doc.fileLink && <FileLink href={doc.fileLink}/>}
                        </div>
                        {doc.notes && <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <ABtn color={T.blue} onClick={() => setModal({mode:"edit",doc})}>✎</ABtn>
                        <ABtn color={T.red}  onClick={() => delDoc(doc.id)}>✕</ABtn>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* ── Modals ── */}
      {modal && finTab === "invoices"   && <InvoiceModal   mode={modal.mode} doc={modal.doc} projects={projects} defaultProject={selProj} onClose={() => setModal(null)} onSave={saveDoc}/>}
      {modal && finTab === "workorders" && <WorkOrderModal mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={() => setModal(null)} onSave={saveDoc}/>}
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
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>{yearLabel === "All" ? "All years" : `Year ${yearLabel}`} • {rows.length} invoice{rows.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,width:38,height:38,fontSize:20,cursor:"pointer"}}>×</button>
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

function AlertRow({a}) {
  const s=getStatus(a.days);
  const SRC_COLOR={"Company Doc":T.blue,"Passport":T.purple,"Visa":T.teal,"Iqama":T.green,"Muqeem":T.orange,"Cert":T.green,"Eq Cert":T.blue,"Insurance":T.purple,"Permit":T.gold};
  const sc=SRC_COLOR[a.src]||T.blue;
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg,borderRadius:9,border:`1px solid ${T.border}`}}>
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


/* ════════════════════════════════════════════════════════════════════════════
   PROJECT DOCS
════════════════════════════════════════════════════════════════════════════ */
const PD_TABS = [
  {id:"certificates",  label:"Job Completion Certificates", icon:"📜", color:T.blue,   dim:T.blueDim},
  {id:"dailyreports",  label:"Daily Reports",               icon:"📅", color:T.gold,   dim:T.goldDim},
];

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT DOCS
════════════════════════════════════════════════════════════════════════════ */
function ProjectDocs({data,setData,showToast}) {
  // ALL hooks must be at the top — never after a conditional return
  const [selectedProject, setSelectedProject] = useState(null);
  const [subTab,  setSubTab]  = useState("certificates");
  const [selProj, setSelProj] = useState(null);
  const [modal,   setModal]   = useState(null);
  const [fProj,   setFProj]   = useState("");
  const [bulkModal, setBulkModal] = useState(false);
  const [multiPdfModal, setMultiPdfModal] = useState(null);
  const [rigInput, setRigInput] = useState("");
  const docs     = data.projectDocs || [];
  const projects = data.projects    || [];
  const cur      = PD_TABS.find(t=>t.id===subTab);
  const counts   = Object.fromEntries(PD_TABS.map(t=>[t.id,
    docs.filter(d => d.subTab===t.id && (!selectedProject || d.project===selectedProject)).length
  ]));

  const openProject = (project) => {
    setSelectedProject(project);
    setSelProj(project);
    setFProj(project);
  };

  const backToProjects = () => {
    setSelectedProject(null);
    setSelProj(null);
    setFProj("");
  };

  const changeTab = t => { setSubTab(t); if (selectedProject) { setSelProj(selectedProject); setFProj(selectedProject); } else { setSelProj(null); setFProj(""); } };

  const saveDoc = (doc, mode) => {
  const st = subTab;
  setModal(null);

  setTimeout(() => {
    setData(prev => {
      const list = [...prev.projectDocs];
      const savedDoc = mode === "add"
        ? {...doc, id: uid(), subTab: st}
        : {...doc, subTab: st};

      if (mode === "add") {
        list.push(savedDoc);
      } else {
        const i = list.findIndex(d => d.id === doc.id);
        if (i >= 0) list[i] = savedDoc;
      }

      let analysis = prev.projectAnalysis || [];

      if (st === "dailyreports") {
        const projectName = savedDoc.project;
        let projectRec = analysis.find(p => p.project === projectName);

        const analysisReport = {
          id:             savedDoc.id,
          date:           savedDoc.date,
          name:           savedDoc.name,
          fileName:       savedDoc.fileName,
          fileLink:       savedDoc.fileLink,
          extractedFields:savedDoc.extractedFields,
          profile:        savedDoc.profile,
          activity:       savedDoc.activity,
          permitReceived: savedDoc.permitReceived,
          permitHours:    savedDoc.permitHours,
          standbyReason:  savedDoc.standbyReason,
          progressToday:  savedDoc.progressToday,
          accumulated:    savedDoc.accumulated,
          activities:     savedDoc.activities,
          notes:          savedDoc.notes,
        };

        if (!projectRec) {
          projectRec = {
            id: uid(),
            project: projectName,
            status: "In Progress",
            dailyReports: [analysisReport],
          };
          analysis = [...analysis, projectRec];
        } else {
          const oldReports = projectRec.dailyReports || [];
          const exists = oldReports.find(r => r.id === analysisReport.id);
          const dailyReports = exists
            ? oldReports.map(r => r.id === analysisReport.id ? analysisReport : r)
            : [...oldReports, analysisReport];

          analysis = analysis.map(p =>
            p.id === projectRec.id ? {...p, dailyReports} : p
          );
        }
      }

      return {
        ...prev,
        projectDocs: list,
        projectAnalysis: analysis,
      };
    });

    showToast(mode === "add" ? "Daily report uploaded and synced" : "Updated");
  }, 0);
};

  const delDoc = id => {
    setData(prev=>({...prev,projectDocs:prev.projectDocs.filter(d=>d.id!==id)}));
    showToast("Deleted","del");
  };

  // ── Rig management ──────────────────────────────────────────────────
  const rigs = data.rigs || [];
  const projRigs = selectedProject ? rigs.filter(r=>r.project===selectedProject) : [];

  const addRig = () => {
    const name = rigInput.trim();
    if (!name) { showToast("Enter a rig name first","del"); return; }
    if (!selectedProject) { showToast("No project selected","del"); return; }
    if ((data.rigs||[]).some(r=>r.project===selectedProject && r.name===name)) { showToast("Rig already exists","del"); return; }
    setData(prev=>({...prev, rigs:[...(prev.rigs||[]), {id:uid(), project:selectedProject, name}]}));
    setRigInput("");
    showToast("Rig added ✓");
  };
  const delRig = id => {
    setData(prev=>({...prev, rigs:(prev.rigs||[]).filter(r=>r.id!==id)}));
    showToast("Rig removed","del");
  };

  // ── Derived data (no hooks below this line) ───────────────────────────
  const certAll   = docs.filter(d=>d.subTab==="certificates");
  const projCerts = selProj ? certAll.filter(d=>d.project===selProj) : [];

  const drAll     = docs.filter(d=>d.subTab==="dailyreports");
  const projDRs   = selProj ? drAll.filter(d=>d.project===selProj) : [];

  if (!selectedProject) {
    return (
      <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.text}}>PROJECTS</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Select a project to view certificates and daily reports</div>
          </div>
        </div>

        {projects.length===0
          ? <Empty icon="◆" label="No projects yet" sub="Add projects from Manage Projects in the sidebar" color={T.blue} onAdd={()=>{}}/>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
              {projects.map((project,i)=>{ project=pName(project);
                const projectDocs = docs.filter(d=>d.project===project);
                const projectCerts = projectDocs.filter(d=>d.subTab==="certificates");
                const projectDailyReports = projectDocs.filter(d=>d.subTab==="dailyreports");

                return (
                  <button
                    key={project}
                    type="button"
                    onClick={()=>openProject(project)}
                    className="fade-up card-hover"
                    style={{
                      background:T.card,
                      border:`1px solid ${T.border}`,
                      borderRadius:18,
                      boxShadow:T.shadow,
                      padding:"18px",
                      textAlign:"left",
                      cursor:"pointer",
                      animationDelay:`${i*.04}s`
                    }}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project}</div>
                        <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>{projectDocs.length} total document{projectDocs.length!==1?"s":""}</div>
                      </div>
                      <div style={{width:42,height:42,borderRadius:12,background:T.blueDim,display:"flex",alignItems:"center",justifyContent:"center",color:T.blue,fontSize:18,fontWeight:800,flexShrink:0}}>◆</div>
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                      <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:12,padding:"12px"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:T.blue,lineHeight:1}}>{projectCerts.length}</div>
                        <div style={{fontSize:11,color:T.blue,marginTop:6,fontWeight:700}}>📜 Certificates</div>
                      </div>
                      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px"}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:T.gold,lineHeight:1}}>{projectDailyReports.length}</div>
                        <div style={{fontSize:11,color:T.gold,marginTop:6,fontWeight:700}}>📅 Daily Reports</div>
                      </div>
                    </div>

                    {(()=>{const rc=(data.rigs||[]).filter(r=>r.project===project).length; return rc>0&&<div style={{marginTop:10,fontSize:11,color:T.textMuted}}>🔩 {rc} rig{rc!==1?"s":""}</div>;})()}
                    <div style={{marginTop:14,fontSize:12,color:T.blue,fontWeight:700,textAlign:"right"}}>Open Project →</div>
                  </button>
                );
              })}
            </div>
        }
      </div>
    );
  }

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div>
          <button onClick={backToProjects} style={{background:"transparent",border:"none",color:T.blue,fontWeight:700,cursor:"pointer",marginBottom:6,padding:0}}>← Back to Projects</button>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selectedProject}</div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:3}}>Project dashboard and document records</div>
        </div>
      </div>
      <SubTabBar tabs={PD_TABS} active={subTab} counts={counts} onChange={changeTab}/>

      {/* ── Rigs / Spreads panel ── */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text}}>
            🔩 RIGS / SPREADS
            <span style={{marginLeft:8,fontSize:12,color:T.textMuted,fontWeight:500,fontFamily:"inherit"}}>{projRigs.length} defined</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input
              value={rigInput}
              onChange={e=>setRigInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addRig()}
              placeholder="New rig name (e.g. Rig 1)…"
              style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.text,outline:"none",width:200}}
            />
            <button type="button" onClick={e=>{e.preventDefault();e.stopPropagation();addRig();}}
              style={{background:T.gold,border:"none",color:"#000",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              + Add Rig
            </button>
          </div>
        </div>
        {projRigs.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
            {projRigs.map(r=>{
              const eqCount = (data.equipment||[]).filter(e=>e.rig===r.name&&e.project===selectedProject).length;
              const maintCount = (data.equipment||[]).filter(e=>e.rig===r.name&&e.project===selectedProject)
                .flatMap(e=>(e.maintenance||[]).filter(t=>(t.status||"Open")!=="Closed")).length;
              return (
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,background:T.card2,border:`1px solid ${maintCount>0?"#f59e0b44":T.border}`,borderRadius:10,padding:"8px 14px"}}>
                  <span style={{fontWeight:700,fontSize:13,color:T.text}}>🔩 {r.name}</span>
                  <span style={{fontSize:11,color:T.textMuted}}>{eqCount} eq</span>
                  {maintCount>0&&<span style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>⚠ {maintCount} open</span>}
                  <button type="button" onClick={e=>{e.preventDefault();e.stopPropagation();delRig(r.id);}}
                    style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                </div>
              );
            })}
          </div>
        )}
        {projRigs.length===0&&<div style={{fontSize:12,color:T.textMuted,marginTop:10}}>No rigs defined yet — add one above, then assign equipment to it in the Equipment section.</div>}
      </div>

      {/* ══ INVOICES ════════════════════════════════════════════════════ */}
      {/* ══ CERTIFICATES ════════════════════════════════════════════════ */}
      {subTab==="certificates" && (
  selProj ? (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button
          onClick={backToProjects}
          style={{
            background:T.card,
            border:`1px solid ${T.border}`,
            color:T.textSub,
            borderRadius:8,
            padding:"8px 14px",
            fontSize:13,
            fontWeight:600
          }}
        >
          ← Back
        </button>

        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>
            {selectedProject}
          </div>
          <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>
            {projCerts.length} certificate{projCerts.length!==1?"s":""}
          </div>
        </div>

        <Btn color={T.blue} solid onClick={()=>setModal({mode:"add",doc:{project:selProj}})}>
          <div style={{display:"flex", gap:8}}>
  <Btn color={T.blue} onClick={()=>setMultiPdfModal({project:selProj})}>⬆ Upload PDFs</Btn>
  <Btn color={T.blue} solid onClick={()=>setModal({mode:"add",doc:{project:selProj}})}>+ Add Manually</Btn>
</div>
        </Btn>
      </div>

      {projCerts.length===0
        ? <Empty
            icon="📜"
            label="No certificates yet"
            sub="Add the first certificate for this project"
            color={T.blue}
            onAdd={()=>setModal({mode:"add",doc:{project:selProj}})}
          />
        : <div style={{display:"grid",gap:10}}>
            {projCerts.map((doc,i)=>(
              <div
                key={doc.id}
                className="fade-up"
                style={{
                  background:T.card,
                  border:`1px solid ${T.border}`,
                  borderLeft:`4px solid ${T.blue}`,
                  borderRadius:12,
                  padding:"16px 18px",
                  animationDelay:`${i*.03}s`,
                  display:"flex",
                  alignItems:"flex-start",
                  gap:14
                }}
              >
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{
  fontFamily:"'Barlow Condensed',sans-serif",
  fontWeight:800,
  fontSize:"clamp(14px,1.1vw,17px)",
  color:T.text
}}>
  {doc.jobNo ? `JOB ${doc.jobNo}` : "Job Completion Certificate"}
</span>
                    {doc.project && <Tag color={T.blue}>{doc.project}</Tag>}
                  </div>

                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {doc.refNo && <Chip>Ref: {doc.refNo}</Chip>}
                    {doc.client && <Chip>Client: {doc.client}</Chip>}
                    {doc.amount && <Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
                    {doc.date && <Chip>Date: {fmtDate(doc.date)}</Chip>}
                    {doc.fileLink && <FileLink href={doc.fileLink}/>}
                  </div>

                  {doc.notes && (
                    <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>
                      {doc.notes}
                    </div>
                  )}
                </div>

                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                  <ABtn color={T.red} onClick={()=>delDoc(doc.id)}>✕</ABtn>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  ) : (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>
            JOB COMPLETION CERTIFICATES
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>
            Select a project to view and manage its certificates
          </div>
        </div>
        <Btn color={T.blue} solid onClick={()=>setModal({mode:"add"})}>
          + Add Certificate
        </Btn>
      </div>

      {projects.length===0
        ? <Empty
            icon="📜"
            label="No projects yet"
            sub="Add projects via Manage Projects in the sidebar"
            color={T.blue}
            onAdd={()=>{}}
          />
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
            {projects.map((p,i)=>{ p=pName(p);
              const pcerts = certAll.filter(d=>d.project===p);

              return (
                <div
                  key={p}
                  className="fade-up"
                  onClick={()=>openProject(p)}
                  style={{
                    background:T.card,
                    border:`1px solid ${T.border}`,
                    borderRadius:14,
                    boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",
                    padding:"20px",
                    cursor:"pointer",
                    animationDelay:`${i*.05}s`,
                    transition:"border-color .2s,transform .2s"
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.borderColor=T.blue;
                    e.currentTarget.style.transform="translateY(-2px)";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.borderColor=T.border;
                    e.currentTarget.style.transform="none";
                  }}
                >
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:38,height:38,background:T.blueDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                      📜
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.1vw,17px)",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {p}
                      </div>
                      <div style={{fontSize:12,color:T.textSub,marginTop:2}}>
                        {pcerts.length} certificate{pcerts.length!==1?"s":""}
                      </div>
                    </div>
                  </div>

                  <div style={{background:T.bg,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:T.blue,lineHeight:1}}>
                      {pcerts.length}
                    </div>
                    <div style={{fontSize:12,color:T.textSub,marginTop:4,fontWeight:800}}>
                      Total Certificates
                    </div>
                  </div>

                  <div style={{fontSize:12,color:T.blue,fontWeight:600,textAlign:"right"}}>
                    View Certificates →
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  )
)}

      {/* ══ DAILY REPORTS ═══════════════════════════════════════════════ */}
      {subTab==="dailyreports" && (
        selProj ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={backToProjects} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selectedProject}</div>
                <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>{projDRs.length} daily report{projDRs.length!==1?"s":""}</div>
              </div>
              <Btn color={T.gold} solid onClick={()=>setModal({mode:"add",doc:{project:selProj}})}>+ Add Report</Btn>
            </div>
            {projDRs.length===0
              ?<Empty icon="📅" label="No daily reports yet" sub="Add the first daily report for this project" color={T.gold} onAdd={()=>setModal({mode:"add",doc:{project:selProj}})}/>
              :<div style={{display:"grid",gap:10}}>
                {projDRs.map((doc,i)=>(
                  <div key={doc.id} className="fade-up"
                    style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.gold}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.1vw,17px)",color:T.text}}>{doc.name}</span>
                        {doc.project&&<Tag color={T.teal}>{doc.project}</Tag>}
                        {doc.date&&<Tag color={T.gold}>{fmtDate(doc.date)}</Tag>}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {doc.refNo&&<Chip>Ref: {doc.refNo}</Chip>}
                        {doc.fileLink&&<FileLink href={doc.fileLink}/>}
                      </div>
                      {doc.notes&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                      <ABtn color={T.red}  onClick={()=>delDoc(doc.id)}>✕</ABtn>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>DAILY REPORTS</div>
                <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Site activity and progress reports by project</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
                  <option value="">All Projects</option>
                  {renderProjectOptions(projects)}
                </select>
                <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Add Report</Btn>
              </div>
            </div>
            {(() => {
              const drDocs = fProj ? drAll.filter(d=>d.project===fProj) : drAll;
              return drDocs.length===0
                ?<Empty icon="📅" label="No daily reports yet" sub="Add your first daily report" color={T.gold} onAdd={()=>setModal({mode:"add"})}/>
                :<div style={{display:"grid",gap:10}}>
                  {drDocs.map((doc,i)=>(
                    <div key={doc.id} className="fade-up"
                      style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.gold}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.1vw,17px)",color:T.text}}>{doc.name}</span>
                          {doc.project&&<Tag color={T.teal}>{doc.project}</Tag>}
                          {doc.date&&<Tag color={T.gold}>{fmtDate(doc.date)}</Tag>}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {doc.refNo&&<Chip>Ref: {doc.refNo}</Chip>}
                          {doc.fileLink&&<FileLink href={doc.fileLink}/>}
                        </div>
                        {doc.notes&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                        <ABtn color={T.red}  onClick={()=>delDoc(doc.id)}>✕</ABtn>
                      </div>
                    </div>
                  ))}
                </div>;
            })()}
          </div>
        )
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}
      {modal && subTab==="certificates"  && <CertificateModal  mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {modal && subTab==="dailyreports"  && <ProjectDocDailyReportModal mode={modal.mode} doc={modal.doc} projects={projects} defaultProject={selectedProject} onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {bulkModal && <BulkUploadModal subTab={subTab} projects={projects} onClose={()=>setBulkModal(false)} onImport={(rows)=>{ rows.forEach(r=>{ setData(prev=>({...prev,projectDocs:[...prev.projectDocs,{...r,id:uid(),subTab}]})); }); setBulkModal(false); showToast(`✓ ${rows.length} records imported`); }}/>}
      {multiPdfModal && (
  <MultiPdfCertUpload
    project={multiPdfModal.project}
    projects={projects}
    onClose={()=>setMultiPdfModal(null)}
    onImport={records => {
      setData(prev => ({
        ...prev,
        projectDocs: [...prev.projectDocs, ...records.map(r => ({...r, id:uid(), subTab:"certificates"}))]
      }));
      setMultiPdfModal(null);
      showToast(`✓ ${records.length} certificate${records.length!==1?"s":""} uploaded`);
    }}
  />
)}
    </div>
  );
}

function SubTabBar({tabs,active,counts,onChange}) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
      {tabs.map(t=>{
        const isActive=active===t.id;
        return (
          <button key={t.id} onClick={()=>onChange(t.id)} style={{flexShrink:0,padding:"9px 18px",borderRadius:999,border:`1px solid ${isActive?t.color:T.border}`,background:isActive?t.dim:"transparent",color:isActive?t.color:T.textSub,fontSize:13,fontWeight:isActive?700:500,display:"flex",alignItems:"center",gap:8,transition:"all .2s"}}>
            <span>{t.icon}</span>{t.label}
            <span style={{background:isActive?t.color:T.border,color:isActive?"#000":T.textMuted,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{counts[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Invoice card ────────────────────────────────────────────────────────── */
function InvoiceCard({ doc, delay, onEdit, onDel }) {
  const due = daysUntil(doc.dueDate);
  const paymentStatus = doc.paymentStatus || "Pending";
  const isPaid = paymentStatus === "Paid";
  const isPartial = paymentStatus === "Partial";

  // Only show overdue / due-soon logic for unpaid or partial invoices
  const showDueAlert = !isPaid && doc.dueDate && due !== null && due <= 30;
  const dueStatus = isPaid
    ? { color: T.green, bg: T.greenDim, label: "Paid" }
    : getStatus(due);

  return (
    <div
      className="fade-up"
      style={{
        background: T.card,
        border: `1px solid ${showDueAlert ? dueStatus.color + "44" : T.border}`,
        borderLeft: `4px solid ${isPaid ? T.green : isPartial ? T.gold : T.green}`,
        borderRadius: 12,
        padding: "16px 18px",
        animationDelay: `${delay}s`,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 800,
              fontSize: "clamp(14px,1.1vw,17px)",
              color: T.text,
            }}
          >
            {doc.name}
          </span>

          {doc.refNo && <Tag color={T.green}>#{doc.refNo}</Tag>}

          {showDueAlert && (
            <Tag color={dueStatus.color}>
              {due < 0 ? `${Math.abs(due)}d overdue` : `Due in ${due}d`}
            </Tag>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {doc.client && <Chip>Client: {doc.client}</Chip>}

          {doc.dueDate && (
            <Chip color={isPaid ? T.green : dueStatus.color}>
              Due: {fmtDate(doc.dueDate)}
            </Chip>
          )}

          {doc.amount && (
            <Chip color={T.green}>
              SAR {Number(doc.amount).toLocaleString()}
            </Chip>
          )}

          <Chip color={getInvoiceStream(doc) === "advance" ? T.purple : T.blue}>
            {getInvoiceStream(doc) === "advance" ? "Advance" : "Income"}
          </Chip>

          {(() => {
            const c =
              paymentStatus === "Paid"
                ? T.green
                : paymentStatus === "Partial"
                ? T.gold
                : T.red;

            return (
              <Tag color={c}>
                {paymentStatus === "Paid"
                  ? "✓ Paid"
                  : paymentStatus === "Partial"
                  ? "½ Partial"
                  : "⏳ Pending"}
              </Tag>
            );
          })()}

          {doc.fileLink && <FileLink href={doc.fileLink} />}
        </div>

        {doc.notes && (
          <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
            {doc.notes}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <ABtn color={T.blue} onClick={onEdit}>✎</ABtn>
        <ABtn color={T.red} onClick={onDel}>✕</ABtn>
      </div>
    </div>
  );
}

/* ── Invoice modal ───────────────────────────────────────────────────────── */
function InvoiceModal({mode,doc,projects,defaultProject,onClose,onSave}) {
  const [f,setF]=useState(doc||{project:defaultProject||"", invoiceType:"Income", paymentStatus:"Pending"});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} INVOICE`} color={T.green} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Invoice title required");return;}onSave({...f, invoiceType: f.invoiceType || "Income"},mode);}}>
      <FieldRow label="Invoice Title *"><FInput value={f.name||""} onChange={set("name")} color={T.green}/></FieldRow>
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.green}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Invoice No."><FInput value={f.refNo||""} onChange={set("refNo")} color={T.green}/></FieldRow>
      <FieldRow label="Job Number"><FInput value={f.jobNo||""} onChange={set("jobNo")} color={T.green} placeholder="e.g. 1, 2, 3A…"/></FieldRow>
      <FieldRow label="Due Date"><FInput type="date" value={f.dueDate||""} onChange={set("dueDate")} color={T.green}/></FieldRow>
      <FieldRow label="Invoice Value (SAR)"><FInput type="number" value={f.amount||""} onChange={set("amount")} color={T.green}/></FieldRow>
      <FieldRow label="Invoice Type">
        <div style={{display:"flex", gap:8}}>
          {["Income","Advance"].map(s => {
            const active = (f.invoiceType || "Income") === s;
            const tone = s === "Income" ? T.blue : T.purple;
            const bg = s === "Income" ? T.blueDim : T.purpleDim;
            return (
              <button
                key={s}
                type="button"
                onClick={() => set("invoiceType")(s)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: `1px solid ${active ? tone : T.border}`,
                  background: active ? bg : "transparent",
                  color: active ? tone : T.textMuted,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </FieldRow>
      <FieldRow label="Payment Status">
        <div style={{display:"flex", gap:8}}>
          {["Pending","Paid","Partial"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => set("paymentStatus")(s)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 8,
                border: `1px solid ${
                  f.paymentStatus === s
                    ? s === "Paid"    ? T.green
                    : s === "Partial" ? T.gold
                    :                  T.red
                    : T.border
                }`,
                background:
                  f.paymentStatus === s
                    ? s === "Paid"    ? T.greenDim
                    : s === "Partial" ? T.goldDim
                    :                  T.redDim
                    : "transparent",
                color:
                  f.paymentStatus === s
                    ? s === "Paid"    ? T.green
                    : s === "Partial" ? T.gold
                    :                  T.red
                    : T.textMuted,
                fontSize: 13,
                fontWeight: f.paymentStatus === s ? 700 : 500,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {s === "Paid" ? "✓ Paid" : s === "Partial" ? "½ Partial" : "⏳ Pending"}
            </button>
          ))}
        </div>
      </FieldRow>
      {f.paymentStatus === "Partial" && (
        <FieldRow label="Remaining Amount (SAR)">
          <div>
            <FInput type="number" value={f.remainingAmount || ""} onChange={set("remainingAmount")} color={T.gold}/>
            <div style={{fontSize:11,color:T.textMuted,marginTop:6}}>
              Enter the exact amount still remaining for this invoice.
            </div>
          </div>
        </FieldRow>
      )}
      <FieldRow label="File Link (Google Drive / SharePoint)"><FLink value={f.fileLink||""} onChange={set("fileLink")}/></FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.green}/></FieldRow>
    </FormModal>
  );
}

/* ── Job Completion Certificate modal ────────────────────────────────────── */
function CertificateModal({mode,doc,projects,onClose,onSave}) {
  const [f,setF]=useState(doc||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} JOB COMPLETION CERTIFICATE`} color={T.blue} onClose={onClose}
      onSave={()=>{onSave(f,mode);}}>
      
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.blue}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Job Number"><FInput value={f.jobNo||""} onChange={set("jobNo")} color={T.blue}/></FieldRow>
      <FieldRow label="Certificate No."><FInput value={f.refNo||""} onChange={set("refNo")} color={T.blue}/></FieldRow>
      <FieldRow label="Start Date"><FInput type="date" value={f.startDate||""} onChange={set("startDate")} color={T.blue}/></FieldRow>
      <FieldRow label="Completion Date"><FInput type="date" value={f.completionDate||""} onChange={set("completionDate")} color={T.blue}/></FieldRow>
      <FieldRow label="Invoice Value (SAR)"><FInput type="number" value={f.amount||""} onChange={set("amount")} color={T.blue}/></FieldRow>
      <FieldRow label="File Link (Google Drive / SharePoint)"><FLink value={f.fileLink||""} onChange={set("fileLink")}/></FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.blue}/></FieldRow>
    </FormModal>
  );
}

/* ── Work Order modal ────────────────────────────────────────────────────── */
function WorkOrderModal({mode,doc,projects,onClose,onSave}) {
  const [f,setF]=useState(doc||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} WORK ORDER / AGREEMENT`} color={T.purple} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Title required");return;}onSave(f,mode);}}>
      <FieldRow label="Title *"><FInput value={f.name||""} onChange={set("name")} color={T.purple}/></FieldRow>
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.purple}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Reference No."><FInput value={f.refNo||""} onChange={set("refNo")} color={T.purple}/></FieldRow>
      <FieldRow label="Client / Counterparty"><FInput value={f.supplier||""} onChange={set("supplier")} color={T.purple}/></FieldRow>
      <FieldRow label="Contract Value (SAR)"><FInput type="number" value={f.amount||""} onChange={set("amount")} color={T.purple}/></FieldRow>
      <FieldRow label="Date Signed"><FInput type="date" value={f.date||""} onChange={set("date")} color={T.purple}/></FieldRow>
      <FieldRow label="Expiry / End Date"><FInput type="date" value={f.expiryDate||""} onChange={set("expiryDate")} color={T.purple}/></FieldRow>
      <FieldRow label="File Link (Google Drive / SharePoint)"><FLink value={f.fileLink||""} onChange={set("fileLink")}/></FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.purple}/></FieldRow>
    </FormModal>
  );
}

function ProjectDocDailyReportModal({mode,doc,projects,defaultProject,onClose,onSave}) {
  const [f,setF] = useState({ project: defaultProject || "", ...(doc || {}) });
  const [parsing,setParsing] = useState(false);
  const [msg,setMsg] = useState("");
  const excelRef = useRef();

  const handleExcel = async (file) => {
    if (!file) return;
    setParsing(true);
    setMsg("");

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseDailyReportExcel(buffer);

      if (!rows.length) {
        setMsg("No readable data found in this Excel file.");
        setParsing(false);
        return;
      }

      const r = rows[0];

      let fileUrl = "";
      try {
        fileUrl = await uploadToSupabase(
          file,
          `daily-reports/${(f.project || defaultProject || "general").replace(/[^a-zA-Z0-9]/g, "_")}`
        );
      } catch {
        fileUrl = "";
      }

      const extracted = {
        project:        r.project        || f.project || defaultProject || "",
        date:           r.date           || "",
        profile:        r.profile        || "",
        activity:       r.activity       || "",
        permitReceived: r.permitReceived || "",
        permitHours:    (r.permitHours !== undefined && r.permitHours !== null) ? String(r.permitHours) : "",
        standbyReason:  r.standbyReason  || "",
        progressToday:  (r.progressToday !== undefined && r.progressToday !== null) ? String(r.progressToday) : "",
        accumulated:    (r.accumulated   !== undefined && r.accumulated   !== null) ? String(r.accumulated)   : "",
        activities:     r.activities     || "",
      };

      setF(prev => ({
        ...prev,
        ...r,
        project:         prev.project || r.project || defaultProject || "",
        name:            file.name.replace(/\.[^/.]+$/, ""),
        date:            r.date || "",
        fileName:        file.name,
        fileLink:        fileUrl,
        extractedFields: extracted,
      }));

      setMsg("✓ Excel uploaded successfully.");
    } catch (err) {
      console.error(err);
      setMsg("Could not read this Excel file.");
    }

    setParsing(false);
  };

  return (
    <FormModal
      title="UPLOAD DAILY REPORT"
      color={T.gold}
      onClose={onClose}
      onSave={() => {
        if (!f.project) {
          alert("Project is required");
          return;
        }
        if (!f.extractedFields) {
          alert("Please upload the Excel daily report first");
          return;
        }
        onSave(f, mode);
      }}
    >
      <FieldRow label="Project *">
        <FSelect value={f.project || ""} onChange={v => setF(p => ({...p, project:v}))} color={T.gold}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>

      <FieldRow label="Upload Daily Report Excel *">
        <div>
          <button
            type="button"
            onClick={() => excelRef.current.click()}
            disabled={parsing}
            style={{
              background:T.goldDim,
              border:`1px solid ${T.gold}55`,
              color:T.gold,
              borderRadius:10,
              padding:"10px 16px",
              fontWeight:800
            }}
          >
            {parsing ? "Reading Excel…" : "📊 Choose Excel File"}
          </button>

          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{display:"none"}}
            onChange={e => {
              if (e.target.files?.[0]) handleExcel(e.target.files[0]);
              e.target.value = "";
            }}
          />

          {f.fileName && (
  <div style={{
    fontSize:12,
    color:T.green,
    marginTop:8,
    fontWeight:600
  }}>
    ✓ Excel uploaded
  </div>
)}

          {msg && (
            <div style={{fontSize:12,color:msg.startsWith("✓") ? T.green : T.red,marginTop:8,fontWeight:700}}>
              {msg}
            </div>
          )}
        </div>
      </FieldRow>

      
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCORPION DOCUMENTS
════════════════════════════════════════════════════════════════════════════ */
function ScorpionDocs({data,setData,showToast}) {
  const [modal,    setModal]    = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [selCat,   setSelCat]   = useState("All");
  const [sortBy,   setSortBy]   = useState("name"); // "name" | "expiry" | "category"

  const docs = data.scorpionDocs || [];
  const cats = data.scorpionDocCats || DEFAULT_SCORPION_CATS;

  const filtered = selCat === "All" ? docs : docs.filter(d => d.category === selCat);
  const visible  = [...filtered].sort((a, b) => {
    if (sortBy === "expiry") {
      const da = daysUntil(a.expiryDate) ?? 99999;
      const db = daysUntil(b.expiryDate) ?? 99999;
      return da - db;
    }
    if (sortBy === "category") return (a.category||"").localeCompare(b.category||"");
    return (a.name||"").localeCompare(b.name||"");
  });

  const withExpiry = docs.filter(d => d.expiryDate);
  const expired    = withExpiry.filter(d => daysUntil(d.expiryDate) < 0);
  const exp30      = withExpiry.filter(d => { const x=daysUntil(d.expiryDate); return x>=0&&x<=30; });
  const exp90      = withExpiry.filter(d => { const x=daysUntil(d.expiryDate); return x>30&&x<=90; });

  const saveDoc = (doc, mode) => {
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...prev.scorpionDocs];
        if (mode === "add") list.push({...doc, id:uid()});
        else { const i = list.findIndex(d => d.id===doc.id); if(i>=0) list[i]=doc; }
        return {...prev, scorpionDocs:list};
      });
      showToast(mode==="add" ? "Document added" : "Document updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev=>({...prev, scorpionDocs:prev.scorpionDocs.filter(d=>d.id!==id)}));
    showToast("Document deleted","del");
  };

  const saveCats = cats => setData(prev=>({...prev, scorpionDocCats:cats}));

  return (
    <div style={{maxWidth:"min(1200px,95vw)",margin:"0 auto",width:"100%"}}>
      <PageHeader title="SCORPION DOCUMENTS" sub="Company licenses, insurance, contracts & registrations" color={T.blue}>
        <Btn color={T.blue} onClick={()=>setCatModal(true)}>⊕ Categories</Btn>
        <ExportBtn data={docs.map(d=>({Name:d.name,Category:d.category,"Ref No":d.docNo,"Issue Date":d.issueDate,"Expiry Date":d.expiryDate,"File Link":d.fileLink,Notes:d.notes}))} filename="Scorpion_Documents"/>
        <Btn color={T.blue} solid onClick={()=>setModal({mode:"add"})}>+ Add Document</Btn>
      </PageHeader>

      {/* ── Expiry Alert Banners ── */}
      {(expired.length > 0 || exp30.length > 0 || exp90.length > 0) && (
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {expired.length > 0 && (
            <div style={{background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>🚨</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.red,fontSize:14}}>{expired.length} document{expired.length!==1?"s":""} EXPIRED</div>
                <div style={{fontSize:12,color:T.red,opacity:.8,marginTop:3}}>
                  {expired.map(d=>`${d.name} (${Math.abs(daysUntil(d.expiryDate))}d ago)`).join("  ·  ")}
                </div>
              </div>
              <button onClick={()=>{setSortBy("expiry");setSelCat("All");}}
                style={{background:T.red,border:"none",color:"#fff",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                Show First ↑
              </button>
            </div>
          )}
          {exp30.length > 0 && (
            <div style={{background:T.goldDim,border:`1px solid ${T.gold}44`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>⚠️</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.gold,fontSize:14}}>{exp30.length} document{exp30.length!==1?"s":""} expiring within 30 days</div>
                <div style={{fontSize:12,color:T.gold,opacity:.85,marginTop:3}}>
                  {exp30.map(d=>`${d.name} (${daysUntil(d.expiryDate)}d left)`).join("  ·  ")}
                </div>
              </div>
              <button onClick={()=>{setSortBy("expiry");setSelCat("All");}}
                style={{background:T.gold,border:"none",color:"#000",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                Sort by Expiry
              </button>
            </div>
          )}
          {exp30.length === 0 && exp90.length > 0 && (
            <div style={{background:`${T.gold}11`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>📋</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.gold,fontSize:14}}>{exp90.length} document{exp90.length!==1?"s":""} expiring within 90 days</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>
                  {exp90.map(d=>`${d.name} (${daysUntil(d.expiryDate)}d left)`).join("  ·  ")}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stats strip ── */}
      {docs.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:18}}>
          {[
            {label:"Total Docs",   value:docs.length,                                                              color:T.blue},
            {label:"With Expiry",  value:withExpiry.length,                                                        color:T.textMuted},
            {label:"Valid",        value:withExpiry.filter(d=>(daysUntil(d.expiryDate)??-1)>=90).length,           color:T.green},
            {label:"Expiring ≤90", value:exp30.length + exp90.length,                                              color:T.gold},
            {label:"Expired",      value:expired.length,                                                           color:T.red},
          ].map(s=>(
            <div key={s.label} style={{background:T.card,border:`1px solid ${s.value>0&&(s.label==="Expired"||s.label==="Expiring ≤90")?s.color+"44":T.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Category pills + Sort ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["All",...cats].map(c=>(
            <button key={c} onClick={()=>setSelCat(c)}
              style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${selCat===c?T.blue:T.border}`,background:selCat===c?T.blueDim:"transparent",color:selCat===c?T.blue:T.textSub,fontSize:12,fontWeight:selCat===c?700:500,transition:"all .15s",cursor:"pointer"}}>
              {c}{c!=="All"&&<span style={{opacity:.6}}> ({docs.filter(d=>d.category===c).length})</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:12,color:T.textMuted}}>Sort:</span>
          {[["name","🔤 Name"],["expiry","⏳ Expiry"],["category","📁 Category"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSortBy(k)}
              style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${sortBy===k?T.blue:T.border}`,background:sortBy===k?T.blueDim:"transparent",color:sortBy===k?T.blue:T.textSub,fontSize:12,fontWeight:sortBy===k?700:500,cursor:"pointer",transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document list ── */}
      {visible.length === 0
        ? <Empty icon="◉" label="No documents yet" sub="Add your first company document" color={T.blue} onAdd={()=>setModal({mode:"add"})}/>
        : <div style={{display:"grid",gap:10}}>
            {visible.map((doc,i)=>{
              const days = daysUntil(doc.expiryDate);
              const s    = getStatus(days);
              const rowBg = days!==null&&days<0 ? `${T.red}08` : days!==null&&days<=30 ? `${T.gold}06` : T.card;
              return (
                <div key={doc.id} className="fade-up"
                  style={{background:rowBg,border:`1px solid ${doc.expiryDate&&days<=90?s.color+"55":T.border}`,borderLeft:`4px solid ${doc.expiryDate?s.color:T.blue}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    {/* Title row */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>{doc.name}</span>
                      <Tag color={T.blue}>{doc.category||"—"}</Tag>
                      {doc.expiryDate && <Tag color={s.color}>{s.label}</Tag>}
                    </div>
                    {/* Metadata chips */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {doc.docNo     && <Chip>Ref: {doc.docNo}</Chip>}
                      {doc.issueDate && <Chip>Issued: {fmtDate(doc.issueDate)}</Chip>}
                      {doc.expiryDate && (
                        <Chip color={s.color}>
                          Expires: {fmtDate(doc.expiryDate)}
                          {days!==null&&<span style={{marginLeft:5,fontWeight:800}}>({days<0?`${Math.abs(days)}d overdue`:`${days}d left`})</span>}
                        </Chip>
                      )}
                      {doc.fileLink  && <FileLink href={doc.fileLink}/>}
                    </div>
                    {doc.notes && <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                    <ABtn color={T.red}  onClick={()=>delDoc(doc.id)}>✕</ABtn>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {modal    && <DocModal mode={modal.mode} doc={modal.doc} cats={cats} onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {catModal && <CatManagerModal title="Document Categories" cats={cats} onSave={saveCats} onClose={()=>setCatModal(false)}/>}
    </div>
  );
}

function DocModal({mode,doc,cats,onClose,onSave}) {
  const [f,setF] = useState(doc || {});
  const set = k => v => setF(p=>({...p,[k]:v}));
  const days = f.expiryDate ? daysUntil(f.expiryDate) : null;
  const s    = getStatus(days);
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} DOCUMENT`} color={T.blue} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Document name is required");return;}onSave(f,mode);}}>

      <FieldRow label="Document Name">
        <FInput value={f.name||""} onChange={set("name")} color={T.blue} placeholder="e.g. Company Registration Certificate"/>
      </FieldRow>

      <FieldRow label="Category">
        <FSelect value={f.category||""} onChange={set("category")} color={T.blue}>
          <option value="">Select category…</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </FSelect>
      </FieldRow>

      <FieldRow label="Reference / Doc No.">
        <FInput value={f.docNo||""} onChange={set("docNo")} color={T.blue} placeholder="e.g. CR-2024-001"/>
      </FieldRow>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <FieldRow label="Issue Date">
          <FInput type="date" value={f.issueDate||""} onChange={set("issueDate")} color={T.blue}/>
        </FieldRow>
        <FieldRow label="Expiry Date">
          <FInput type="date" value={f.expiryDate||""} onChange={set("expiryDate")} color={days!==null&&days<=90?T.gold:T.blue}/>
        </FieldRow>
      </div>

      {/* Live expiry status preview */}
      {f.expiryDate && (
        <div style={{background:s.bg,border:`1px solid ${s.color}44`,borderRadius:8,padding:"10px 14px",fontSize:13,color:s.color,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>{days<0?"🚨":days<=30?"⚠️":days<=90?"📋":"✅"}</span>
          {days<0
            ? `Expired ${Math.abs(days)} day${Math.abs(days)!==1?"s":""} ago — renew immediately`
            : days<=30
              ? `Expiring in ${days} day${days!==1?"s":""} — urgent renewal needed`
              : days<=90
                ? `Expiring in ${days} day${days!==1?"s":""} — plan renewal soon`
                : `Valid — ${days} day${days!==1?"s":""} until expiry`
          }
        </div>
      )}

      <FieldRow label="File Link (Google Drive / SharePoint)">
        <FLink value={f.fileLink||""} onChange={set("fileLink")}/>
      </FieldRow>

      <FieldRow label="Notes">
        <FTextarea value={f.notes||""} onChange={set("notes")} color={T.blue} placeholder="Any remarks about this document…"/>
      </FieldRow>
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MANPOWER PAGE
════════════════════════════════════════════════════════════════════════════ */
function ManpowerPage({data,setData,showToast}) {
  const [selCat,      setSelCat]      = useState("All");
  const [catModal,    setCatModal]    = useState(false);
  const [addModal,    setAddModal]    = useState(false);
  const [person,      setPerson]      = useState(null);
  const [editingFrom, setEditingFrom] = useState(null); // person being edited from detail view
  const [impModal,    setImpModal]    = useState(false);
  const mpFileRef = useRef();

  const people  = data.manpower || [];
  const cats    = data.manpowerCats || DEFAULT_MANPOWER_CATS;
  const visible = selCat==="All" ? people : people.filter(p=>p.category===selCat);

  const savePerson = (p,mode) => {
    const ef = editingFrom;
    setAddModal(false);
    setTimeout(()=>{
      setData(prev=>{
        const list=[...prev.manpower];
        if(mode==="add"){
          list.push({...p,id:uid(),certs:[],docs:[]});
        } else {
          const i=list.findIndex(x=>x.id===p.id);
          if(i>=0) list[i]={...list[i],...p,certs:list[i].certs||[],docs:list[i].docs||[]};
        }
        return{...prev,manpower:list};
      });
      showToast(mode==="add"?"Person added":"Updated");
      if(ef){
        setPerson(prev=>{ const base=prev||ef; return{...base,...p,certs:base.certs||[],docs:base.docs||[]}; });
        setEditingFrom(null);
      }
    },0);
  };

  const delPerson = id => {
    setData(prev=>({...prev,manpower:prev.manpower.filter(p=>p.id!==id)}));
    showToast("Deleted","del"); setPerson(null);
  };

  const saveCats = cats => setData(prev=>({...prev,manpowerCats:cats}));

  const updatePerson = updated => {
    setData(prev=>{
      const list=[...prev.manpower];
      const i=list.findIndex(p=>p.id===updated.id);
      if(i>=0)list[i]=updated;
      return{...prev,manpower:list};
    });
    setPerson(updated);
  };

  // Import manpower certifications from Excel
  // Each row: NAME, EMPLOYEE ID, CERTIFICATE, CERT NO, ISSUE DATE, EXPIRY DATE
  // Finds matching person by name and appends certs; creates person if not found
  const importMpCerts = (file, defaultCat) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        // Headers are on row 4 in TUV_Manpower_Tracker.xlsx
        const parsed=parseExcelWithHeaderRow(e.target.result, MP_CERT_MAP, MP_HEADER_ROW);
        if(!parsed.length){showToast("No valid rows found","del");return;}

        setData(prev=>{
          const manpower=[...prev.manpower];
          let added=0, updated=0;
          parsed.forEach(row=>{
            const personName=(row.name||"").trim();
            if(!personName) return;
            const certName=row.certName||"Certification";
            const cert={id:uid(),name:certName,certNo:row.certNo||"",issueDate:row.issueDate||"",expiryDate:row.expiryDate||"",issuedBy:row.issuedBy||"",fileLink:""};
            const idx=manpower.findIndex(p=>p.name.toLowerCase()===personName.toLowerCase());
            if(idx>=0){
              if(row.idNo&&!manpower[idx].idNo) manpower[idx]={...manpower[idx],idNo:row.idNo};
              // Skip duplicate: same cert name + same expiry date already exists
              const alreadyExists=(manpower[idx].certs||[]).some(c=>
                c.name.toLowerCase()===certName.toLowerCase()&&c.expiryDate===cert.expiryDate
              );
              if(!alreadyExists){
                manpower[idx]={...manpower[idx],certs:[...(manpower[idx].certs||[]),cert]};
                updated++;
              }
            } else {
              manpower.push({id:uid(),name:personName,idNo:row.idNo||"",category:defaultCat||"",certs:[cert],docs:[]});
              added++;
            }
          });
          showToast(`✓ ${parsed.length} certs imported (${added} new people, ${updated} updated)`);
          return{...prev,manpower};
        });
        setImpModal(false);
      } catch(err){ showToast("Failed to read Excel file","del"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const personFresh = person ? (data.manpower.find(p=>p.id===person.id)||person) : null;

  return (
    <div style={{maxWidth:"min(1200px,95vw)",margin:"0 auto",width:"100%"}}>
      {/* Show PersonDetail when a person is selected */}
      {personFresh && (
        <PersonDetail person={personFresh} cats={cats}
          onBack={()=>setPerson(null)}
          onUpdate={updatePerson}
          onDelete={()=>delPerson(personFresh.id)}
          onEdit={()=>{setEditingFrom(personFresh);setPerson(null);setAddModal({mode:"edit",person:personFresh});}}
          showToast={showToast}/>
      )}
      {/* Show list when no person selected */}
      {!personFresh && <>
      <PageHeader title="MANPOWER" sub="Staff profiles, documents & certifications" color={T.green}>
        <Btn color={T.green} onClick={()=>setCatModal(true)}>⊕ Categories</Btn>
        <Btn color={T.gold}  onClick={()=>setImpModal(true)}>⬆ Import Excel</Btn>
        <ExportBtn data={people.map(p=>({Name:p.name,ID:p.idNo,Category:p.category,Designation:p.designation,Nationality:p.nationality,"Passport No":p.passportNo,"Passport Expiry":p.passportExpiry,"Visa No":p.visaNo,"Visa Expiry":p.visaExpiry,"Iqama No":p.iqamaNo,"Iqama Expiry":p.iqamaExpiry,"Muqeem No":p.muqeemNo,"Muqeem Expiry":p.muqeemExpiry}))} filename="Manpower_List"/>
        <Btn color={T.green} solid onClick={()=>setAddModal({mode:"add"})}>+ Add Person</Btn>
      </PageHeader>

      {/* Excel import banner */}
      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Manpower Certifications from Excel</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>NAME, ID, CERTIFICATE, ISSUED BY, ISSUE DATE, EXPIRY DATE</strong> (headers auto-detected from row 4) — matches people by name, creates new if not found</div>
        </div>
        <input ref={mpFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){setImpModal({file:e.target.files[0]});e.target.value="";}}}/>
        <button onClick={()=>mpFileRef.current.click()} style={{background:T.gold,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,flexShrink:0}}>⬆ Upload Excel</button>
      </div>

      {/* Category filter */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {["All",...cats].map(c=>(
          <button key={c} onClick={()=>setSelCat(c)} style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${selCat===c?T.green:T.border}`,background:selCat===c?T.greenDim:"transparent",color:selCat===c?T.green:T.textSub,fontSize:12,fontWeight:selCat===c?700:500,transition:"all .15s"}}>
            {c} {c!=="All"&&<span style={{opacity:.6}}>({people.filter(p=>p.category===c).length})</span>}
          </button>
        ))}
      </div>

      {visible.length===0
        ?<Empty icon="◈" label="No people in this category" sub="Add your first team member" color={T.green} onAdd={()=>setAddModal({mode:"add"})}/>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {visible.map((p,i)=>{
            const exps=[p.passportExpiry,p.visaExpiry,p.iqamaExpiry,p.muqeemExpiry,...(p.certs||[]).map(c=>c.expiryDate)].filter(Boolean);
            const critical=exps.filter(d=>{ const x=daysUntil(d); return x!==null&&x<=90; }).length;
            return (
              <div key={p.id} className="fade-up" onClick={()=>setPerson(p)}
                style={{background:T.card,border:`1px solid ${critical>0?T.gold:T.border}`,borderRadius:14,padding:"18px",cursor:"pointer",animationDelay:`${i*.04}s`,transition:"border-color .2s,transform .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=critical>0?T.gold:T.border;e.currentTarget.style.transform="none";}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{p.name}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{p.designation||"—"} · {p.nationality||""}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0,marginLeft:8}}>
                    {p.project && (
                      <span style={{background:T.blueDim,color:T.blue,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,border:`1px solid ${T.blue}33`,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}} title={p.project}>
                        ◆ {p.project}
                      </span>
                    )}
                    {critical>0&&<span style={{background:T.goldDim,color:T.gold,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:700}}>{critical} alerts</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                  {p.category&&<Tag color={T.green}>{p.category}</Tag>}
                  {p.idNo&&<Chip>ID: {p.idNo}</Chip>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["Passport",p.passportExpiry],["Visa",p.visaExpiry],["Iqama",p.iqamaExpiry],["Muqeem",p.muqeemExpiry]].map(([lbl,exp])=>{
                    const s=getStatus(daysUntil(exp));
                    return (
                      <div key={lbl} style={{background:T.bg,borderRadius:8,padding:"7px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,color:T.textSub}}>{lbl}</span>
                        {exp
                          ?<span style={{fontSize:11,color:s.color,fontWeight:600}}>{s.label==="Valid"?fmtDate(exp):s.label}</span>
                          :<span style={{fontSize:12,color:T.textSub}}>—</span>
                        }
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:8,fontSize:12,color:T.textMuted,display:"flex",gap:8}}>
                  <span>{(p.certs||[]).length} cert{(p.certs||[]).length!==1?"s":""}</span>
                  <span style={{color:T.border}}>·</span>
                  <span>click to view details →</span>
                </div>
              </div>
            );
          })}
        </div>
      }

      {addModal  && <PersonModal mode={addModal.mode} person={addModal.person} cats={cats} projects={data.projects||[]}
        onClose={()=>{
          setAddModal(false);
          if(editingFrom){setPerson(editingFrom);setEditingFrom(null);}
        }}
        onSave={savePerson}/>}
      {catModal  && <CatManagerModal title="Manpower Categories" cats={cats} onSave={saveCats} onClose={()=>setCatModal(false)}/>}
      {impModal  && impModal.file && <MpImportModal file={impModal.file} cats={cats} onClose={()=>setImpModal(false)} onImport={importMpCerts}/>}
      </>}
    </div>
  );
}

/* ─── Manpower Import Options Modal ─────────────────────────────────────── */
function MpImportModal({file,cats,onClose,onImport}) {
  const [selCat,setSelCat]=useState("");
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:420,padding:"24px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:6}}>IMPORT MANPOWER CERTS</div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:20}}>File: <span style={{color:T.textSub}}>{file.name}</span></div>
        <div style={{marginBottom:18}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:".5px"}}>ASSIGN TO CATEGORY (for new people)</label>
          <select value={selCat} onChange={e=>setSelCat(e.target.value)}
            style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:selCat?T.text:T.textMuted,outline:"none",colorScheme:"light"}}>
            <option value="">No category / assign manually later</option>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:12,color:T.blue}}>
          ℹ Existing people are matched by name. New certs are <strong>added</strong> to their profile — existing certs are not deleted.
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={()=>onImport(file,selCat)} style={{flex:2,background:T.gold,border:"none",color:"#000",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700}}>Import Certifications</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ─── Person Detail view ─────────────────────────────────────────────────── */
function PersonDetail({person,cats,onBack,onUpdate,onDelete,onEdit,showToast}) {
  const [certModal, setCertModal] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  const PTABS=[{id:"profile",label:"Profile"},{id:"certs",label:`Certifications (${(person.certs||[]).length})`}];

  const saveCert=(cert,mode)=>{
    setCertModal(null);
    setTimeout(()=>{
      const certs=[...(person.certs||[])];
      if(mode==="add")certs.push({...cert,id:uid()});
      else{const i=certs.findIndex(c=>c.id===cert.id);if(i>=0)certs[i]=cert;}
      onUpdate({...person,certs});
      showToast(mode==="add"?"Cert added":"Cert updated");
    },0);
  };

  const delCert=id=>{
    const certs=(person.certs||[]).filter(c=>c.id!==id);
    onUpdate({...person,certs});
    showToast("Cert deleted","del");
  };

  const PROFILE_ROWS=[
    ["Full Name",person.name],["ID No.",person.idNo],["Nationality",person.nationality],
    ["Designation",person.designation],["Category",person.category],
    ["Assigned Project",person.project],
    ["Passport No.",person.passportNo],["Passport Expiry",fmtDate(person.passportExpiry)],
    ["Visa No.",person.visaNo],["Visa Expiry",fmtDate(person.visaExpiry)],
    ["Iqama No.",person.iqamaNo],["Iqama Expiry",fmtDate(person.iqamaExpiry)],
    ["Muqeem No.",person.muqeemNo],["Muqeem Expiry",fmtDate(person.muqeemExpiry)],
  ].filter(([,v])=>v&&v!=="—");

  return (
    <div style={{maxWidth:"min(1100px,95vw)",margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <button onClick={onBack} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{person.name}</div>
          <div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span>{person.designation} · {person.category}</span>
            {person.project && <span style={{background:T.blueDim,color:T.blue,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>◆ {person.project}</span>}
          </div>
        </div>
        <Btn color={T.blue}  onClick={onEdit}>✎ Edit</Btn>
        <Btn color={T.red}   onClick={()=>{ if(window.confirm("Delete this person?")) onDelete(); }}>✕ Delete</Btn>
      </div>

      {/* Status cards row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:22}}>
        {[["Passport",person.passportExpiry],["Visa",person.visaExpiry],["Iqama",person.iqamaExpiry],["Muqeem",person.muqeemExpiry]].map(([lbl,exp])=>{
          const s=getStatus(daysUntil(exp));
          return (
            <div key={lbl} style={{background:T.card,border:`1px solid ${exp?s.color+"44":T.border}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:12,color:T.textSub,fontWeight:600,marginBottom:6}}>{lbl.toUpperCase()}</div>
              {exp
                ?<><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:s.color}}>{s.label}</div>
                   <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{fmtDate(exp)}</div>
                   {daysUntil(exp)!==null&&<div style={{fontSize:11,color:s.color,marginTop:2,fontWeight:600}}>{Math.abs(daysUntil(exp))} days {daysUntil(exp)<0?"overdue":"left"}</div>}
                </>
                :<div style={{fontSize:13,color:T.textMuted}}>Not recorded</div>
              }
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        {PTABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"8px 18px",borderRadius:999,border:`1px solid ${activeTab===t.id?T.green:T.border}`,background:activeTab===t.id?T.greenDim:"transparent",color:activeTab===t.id?T.green:T.textSub,fontSize:13,fontWeight:activeTab===t.id?700:500,transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab==="profile"&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"18px 22px"}}>
          {PROFILE_ROWS.map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,color:T.textMuted,fontWeight:500}}>{k}</span>
              <span style={{fontSize:13,color:T.textSub,fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab==="certs"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <Btn color={T.green} solid onClick={()=>setCertModal({mode:"add"})}>+ Add Certification</Btn>
          </div>
          {(person.certs||[]).length===0
            ?<Empty icon="◈" label="No certifications" sub="Add this person's certifications" color={T.green} onAdd={()=>setCertModal({mode:"add"})}/>
            :<div style={{display:"grid",gap:10}}>
              {(person.certs||[]).map((c,i)=>{
                const s=getStatus(daysUntil(c.expiryDate));
                return (
                  <div key={c.id} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${s.color}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,animationDelay:`${i*.04}s`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>{c.name}</span>
                        <Tag color={s.color}>{s.label}</Tag>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {c.certNo&&<Chip>No: {c.certNo}</Chip>}
                        {c.issuedBy&&<Chip>{c.issuedBy}</Chip>}
                        {c.issueDate&&<Chip>Issued: {fmtDate(c.issueDate)}</Chip>}
                        {c.expiryDate&&<Chip color={s.color}>Exp: {fmtDate(c.expiryDate)}</Chip>}
                        {c.fileLink&&<FileLink href={c.fileLink}/>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <ABtn color={T.blue} onClick={()=>setCertModal({mode:"edit",cert:c})}>✎</ABtn>
                      <ABtn color={T.red}  onClick={()=>delCert(c.id)}>✕</ABtn>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {certModal&&<CertModal mode={certModal.mode} cert={certModal.cert} onClose={()=>setCertModal(null)} onSave={saveCert}/>}
    </div>
  );
}

function PersonModal({mode,person,cats,projects,onClose,onSave}) {
  const [f,setF]=useState(person||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} PERSON`} color={T.green} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Name required");return;}onSave(f,mode);}}>
      <FieldRow label="Full Name *"><FInput value={f.name||""} onChange={set("name")} color={T.green}/></FieldRow>
      <FieldRow label="Category">
        <FSelect value={f.category||""} onChange={set("category")} color={T.green}>
          <option value="">Select…</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Assigned Project">
        <FSelect value={f.project||""} onChange={set("project")} color={T.green}>
          <option value="">No project assigned</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="ID No."><FInput value={f.idNo||""} onChange={set("idNo")} color={T.green}/></FieldRow>
      <FieldRow label="Nationality"><FInput value={f.nationality||""} onChange={set("nationality")} color={T.green}/></FieldRow>
      <FieldRow label="Designation"><FInput value={f.designation||""} onChange={set("designation")} color={T.green}/></FieldRow>
      <SectionDivider label="PASSPORT"/>
      <FieldRow label="Passport No."><FInput value={f.passportNo||""} onChange={set("passportNo")} color={T.green}/></FieldRow>
      <FieldRow label="Passport Expiry"><FInput type="date" value={f.passportExpiry||""} onChange={set("passportExpiry")} color={T.green}/></FieldRow>
      <SectionDivider label="VISA"/>
      <FieldRow label="Visa No."><FInput value={f.visaNo||""} onChange={set("visaNo")} color={T.green}/></FieldRow>
      <FieldRow label="Visa Expiry"><FInput type="date" value={f.visaExpiry||""} onChange={set("visaExpiry")} color={T.green}/></FieldRow>
      <SectionDivider label="IQAMA"/>
      <FieldRow label="Iqama No."><FInput value={f.iqamaNo||""} onChange={set("iqamaNo")} color={T.green}/></FieldRow>
      <FieldRow label="Iqama Expiry"><FInput type="date" value={f.iqamaExpiry||""} onChange={set("iqamaExpiry")} color={T.green}/></FieldRow>
      <SectionDivider label="MUQEEM"/>
      <FieldRow label="Muqeem No."><FInput value={f.muqeemNo||""} onChange={set("muqeemNo")} color={T.green}/></FieldRow>
      <FieldRow label="Muqeem Expiry"><FInput type="date" value={f.muqeemExpiry||""} onChange={set("muqeemExpiry")} color={T.green}/></FieldRow>
    </FormModal>
  );
}

function CertModal({mode,cert,onClose,onSave}) {
  const [f,setF]=useState(cert||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} CERTIFICATION`} color={T.green} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Cert name required");return;}onSave(f,mode);}}>
      <FieldRow label="Certification Name *"><FInput value={f.name||""} onChange={set("name")} color={T.green}/></FieldRow>
      <FieldRow label="Certificate No."><FInput value={f.certNo||""} onChange={set("certNo")} color={T.green}/></FieldRow>
      <FieldRow label="Issued By"><FInput value={f.issuedBy||""} onChange={set("issuedBy")} color={T.green}/></FieldRow>
      <FieldRow label="Issue Date"><FInput type="date" value={f.issueDate||""} onChange={set("issueDate")} color={T.green}/></FieldRow>
      <FieldRow label="Expiry Date"><FInput type="date" value={f.expiryDate||""} onChange={set("expiryDate")} color={T.green}/></FieldRow>
      <FieldRow label="File Link"><FLink value={f.fileLink||""} onChange={set("fileLink")}/></FieldRow>
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   EQUIPMENT PAGE
════════════════════════════════════════════════════════════════════════════ */
function EquipmentPage({data,setData,showToast}) {
  const rigs = data.rigs || [];
  const [modal,   setModal]   = useState(null);
  const [selEq,   setSelEq]   = useState(null); // selected equipment
  const [fProj,   setFProj]   = useState("");
  const [fStatus, setFStatus] = useState("");
  const eqBulkRef = useRef(); // must be here — hooks cannot be after early return

  const equipment = data.equipment || [];
  const projects  = data.projects  || [];

  const visible = equipment.filter(e=>{
    return (!fProj||e.project===fProj)&&(!fStatus||e.status===fStatus);
  });

  const saveEq=(eq,mode)=>{
    setModal(null);
    setTimeout(()=>{
      setData(prev=>{
        const list=[...prev.equipment];
        if(mode==="add")list.push({...eq,id:uid(),certifications:[],invoices:[],insurance:[],permits:[],maintenance:[]});
        else{const i=list.findIndex(e=>e.id===eq.id);if(i>=0)list[i]=eq;}
        return{...prev,equipment:list};
      });
      showToast(mode==="add"?"Equipment added":"Updated");
      if(selEq)setSelEq(eq);
    },0);
  };

  const delEq=id=>{
    setData(prev=>({...prev,equipment:prev.equipment.filter(e=>e.id!==id)}));
    showToast("Deleted","del");setSelEq(null);
  };

  const updateEq=updated=>{
    setData(prev=>{
      const list=[...prev.equipment];
      const i=list.findIndex(e=>e.id===updated.id);
      if(i>=0)list[i]=updated;
      return{...prev,equipment:list};
    });
    setSelEq(updated);
  };

  const eqFresh = selEq ? (data.equipment.find(e=>e.id===selEq.id)||selEq) : null;
  const STATUS_COLORS={"Active":T.green,"Under Maintenance":T.gold,"Inactive":T.red};

  const importBulkEqCerts = file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb=XLSX.read(e.target.result,{type:"array",cellDates:true});
        const sheetName=wb.SheetNames.includes("TUV MASTERSHEET")?"TUV MASTERSHEET":wb.SheetNames.includes("Sheet3")?"Sheet3":wb.SheetNames[0];
        const ws=wb.Sheets[sheetName];
        const rawRows=XLSX.utils.sheet_to_json(ws,{defval:""});
        // Normalize keys to uppercase for case-insensitive matching
        const rows=rawRows.map(row=>{const n={};Object.entries(row).forEach(([k,v])=>{n[k.toUpperCase().trim()]=v;});return n;});
        const parsed=parseExcelRows(rows,EQ_CERT_MAP);
        if(!parsed.length){showToast("No valid rows found","del");return;}

        setData(prev=>{
          const equipment=[...prev.equipment];
          let matched=0, unmatched=0;
          parsed.forEach(r=>{
            const cert={id:uid(),equipmentName:r.eqName||"",itemType:r.itemType||"",certNo:r.certNo||"",issuedBy:r.issuedBy||"",issueDate:r.issueDate||"",expiryDate:r.expiryDate||"",serialNo:r.serialNo||"",fileLink:""};
            // match by name or serial number
            const idx=equipment.findIndex(eq=>{
              const nameMatch=eq.name&&r.eqName&&(eq.name.toLowerCase().includes(r.eqName.toLowerCase())||r.eqName.toLowerCase().includes(eq.name.toLowerCase()));
              const serialMatch=eq.serialNo&&r.serialNo&&eq.serialNo.toLowerCase()===r.serialNo.toLowerCase();
              return nameMatch||serialMatch;
            });
            if(idx>=0){
              equipment[idx]={...equipment[idx],certifications:[...(equipment[idx].certifications||[]),cert]};
              matched++;
            } else {
              // Create new equipment entry for unmatched
              equipment.push({id:uid(),name:r.eqName||"Unknown Equipment",model:"",serialNo:r.serialNo||"",project:"",status:"Active",operator:"",certifications:[cert],invoices:[],insurance:[],permits:[]});
              unmatched++;
            }
          });
          showToast(`✓ Imported ${parsed.length} certs — ${matched} matched, ${unmatched} new equipment created`);
          return{...prev,equipment};
        });
      } catch(err){ showToast("Failed to read file","del"); console.error(err); }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
      {/* Show EquipmentDetail when equipment selected */}
      {eqFresh && <EquipmentDetail eq={eqFresh} projects={projects} onBack={()=>setSelEq(null)} onUpdate={updateEq} onDelete={()=>delEq(eqFresh.id)} onEdit={()=>setModal({mode:"edit",eq:eqFresh})} showToast={showToast}/>}
      {/* Show list when nothing selected */}
      {!eqFresh && <>
      <PageHeader title="EQUIPMENT" sub="Assets with certifications, invoices, insurance & permits" color={T.gold}>
        <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Projects</option>
          {renderProjectOptions(projects)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Statuses</option>
          <option>Active</option><option>Under Maintenance</option><option>Inactive</option>
        </select>
        <input ref={eqBulkRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importBulkEqCerts(e.target.files[0]);e.target.value="";}}}/>
        <Btn color={T.gold} onClick={()=>eqBulkRef.current.click()}>⬆ Import Excel</Btn>
        <ExportBtn data={equipment.map(e=>({Name:e.name,Model:e.model,"Serial No":e.serialNo,Project:e.project,Status:e.status,Operator:e.operator,"Purchase Date":e.purchaseDate}))} filename="Equipment_List"/>
        <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Add Equipment</Btn>
      </PageHeader>

      {/* Excel import banner */}
      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Equipment Certifications from Excel</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>ITEM TYPE, ITEM NAME/ID, REG/SERIAL NO, TUV PROVIDER, START DATE, EXPIRY DATE</strong> — auto-detects Sheet3, matches equipment by name or serial no.</div>
        </div>
        <button onClick={()=>eqBulkRef.current.click()} style={{background:T.gold,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,flexShrink:0}}>⬆ Upload Excel</button>
      </div>

      {visible.length===0
        ?<Empty icon="◎" label="No equipment found" sub="Add your first asset" color={T.gold} onAdd={()=>setModal({mode:"add"})}/>
        :<div style={{display:"grid",gap:10}}>
          {visible.map((eq,i)=>{
            const allExp=[...(eq.certifications||[]).map(c=>c.expiryDate),...(eq.insurance||[]).map(c=>c.expiryDate),...(eq.permits||[]).map(c=>c.expiryDate)];
            const alerts=allExp.filter(d=>{const x=daysUntil(d);return x!==null&&x<=90;}).length;
            const sCol=STATUS_COLORS[eq.status]||T.textMuted;
            return (
              <div key={eq.id} className="fade-up" onClick={()=>setSelEq(eq)}
                style={{background:T.card,border:`1px solid ${alerts>0?T.gold:T.border}`,borderLeft:`4px solid ${sCol}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",animationDelay:`${i*.03}s`,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.cardHover}
                onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:T.text}}>{eq.name}</span>
                      {eq.status&&<Tag color={sCol}>{eq.status}</Tag>}
                      {alerts>0&&<Tag color={T.gold}>{alerts} expiring</Tag>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {eq.model&&<Chip>{eq.model}</Chip>}
                      {eq.serialNo&&<Chip>S/N: {eq.serialNo}</Chip>}
                      {eq.project&&<Chip>{eq.project}</Chip>}
                      {eq.rig&&<Chip>🔩 {eq.rig}</Chip>}
                      {eq.operator&&<Chip>Op: {eq.operator}</Chip>}
                    </div>
                    <div style={{marginTop:8,fontSize:12,color:T.textMuted,display:"flex",gap:12}}>
                      <span>📜 {(eq.certifications||[]).length} certs</span>
                      <span>🧾 {(eq.invoices||[]).length} invoices</span>
                      <span>🛡 {(eq.insurance||[]).length} insurance</span>
                      <span>⬡ {(eq.permits||[]).length} permits</span>
                      <span style={{color:T.blue}}>click to view →</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",eq})}>✎</ABtn>
                    <ABtn color={T.red}  onClick={()=>{if(window.confirm("Delete this equipment?"))delEq(eq.id);}}>✕</ABtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }

      {modal&&<EqModal mode={modal.mode} eq={modal.eq} projects={projects} rigs={rigs} onClose={()=>setModal(null)} onSave={saveEq}/>}
      </>}
    </div>
  );
}

/* ─── Equipment Detail ───────────────────────────────────────────────────── */
function MaintenancePage({data,setData,showToast}) {
  const [filterStatus, setFilterStatus] = useState("Open");  // "All" | "Open" | "Closed"
  const [filterProj,   setFilterProj]   = useState("All");
  const [filterRig,    setFilterRig]    = useState("All");
  const [modal,        setModal]        = useState(null);    // null | {mode,ticket,eqId}
  const [closeModal,    setCloseModal]    = useState(null);
  const [closeNotes,    setCloseNotes]    = useState("");
  const [closeBy,       setCloseBy]       = useState("");
  const [closeFile,     setCloseFile]     = useState({link:"",name:""});
  const [closingUpload, setClosingUpload] = useState(false);
  const [closingUpErr,  setClosingUpErr]  = useState("");
  const closeFileRef = useRef();

  const handleCloseUpload = async (file) => {
    if (!file) return;
    setClosingUpload(true); setClosingUpErr("");
    try {
      const folder = "maintenance/completions";
      const url = await uploadToSupabase(file, folder);
      setCloseFile({link:url, name:file.name});
    } catch(err) {
      setClosingUpErr("Upload failed: " + (err.message||"check Supabase config"));
    } finally {
      setClosingUpload(false);
    }
  };
  const [expandId,     setExpandId]     = useState(null);

  const equipment = data.equipment || [];
  const projects  = data.projects  || [];
  const rigs      = data.rigs      || [];

  /* Flatten ALL maintenance tickets across all equipment */
  const allTickets = equipment.flatMap(eq =>
    (eq.maintenance || []).map(t => ({ ...t, _eqId: eq.id, _eqName: eq.name, _eqRig: eq.rig || "", _eqProject: eq.project || "" }))
  );

  /* Status colours */
  const STATUS = {
    "Open":        { color:"#ef4444", bg:"rgba(239,68,68,.12)",   icon:"🔴" },
    "In Progress": { color:"#f59e0b", bg:"rgba(245,158,11,.12)",  icon:"🟡" },
    "Closed":      { color:"#10b981", bg:"rgba(16,185,129,.12)",  icon:"🟢" },
  };
  const sOf = t => STATUS[t.status] || STATUS["Open"];

  /* Filtered + sorted tickets */
  /* Rigs for the selected project filter */
  const rigsForFilter = filterProj === "All"
    ? [...new Set(rigs.map(r=>r.name))]
    : rigs.filter(r=>r.project===filterProj).map(r=>r.name);

  const visible = allTickets
    .filter(t => filterStatus === "All" || (t.status||"Open") === filterStatus)
    .filter(t => filterProj   === "All" || (t.project === filterProj || t._eqProject === filterProj))
    .filter(t => filterRig    === "All" || t._eqRig === filterRig)
    .sort((a,b) => {
      const order = {"Open":0,"In Progress":1,"Closed":2};
      const so = (order[a.status||"Open"]||0) - (order[b.status||"Open"]||0);
      if (so !== 0) return so;
      return (b.raisedAt||b.date||"").localeCompare(a.raisedAt||a.date||"");
    });

  const openCount   = allTickets.filter(t => (t.status||"Open") === "Open").length;
  const inProgCount = allTickets.filter(t => t.status === "In Progress").length;
  const closedCount = allTickets.filter(t => t.status === "Closed").length;

  /* Update a ticket inside its equipment's maintenance array */
  const updateTicket = (eqId, updated) => {
    setData(prev => {
      const list = prev.equipment.map(eq => {
        if (eq.id !== eqId) return eq;
        return { ...eq, maintenance: (eq.maintenance||[]).map(t => t.id===updated.id ? updated : t) };
      });
      return { ...prev, equipment: list };
    });
  };

  /* Add new ticket */
  const addTicket = (eqId, rec) => {
    setData(prev => {
      const list = prev.equipment.map(eq => {
        if (eq.id !== eqId) return eq;
        const ticket = { ...rec, id: uid(), status: "Open", raisedAt: new Date().toISOString().slice(0,10) };
        return { ...eq, maintenance: [...(eq.maintenance||[]), ticket] };
      });
      return { ...prev, equipment: list };
    });
    // Send email notification
    const eqName = (data.equipment||[]).find(e=>e.id===eqId)?.name||"";
    const maintEmails = (loadNotifySettings().maintEmails||[]);
    setTimeout(()=>sendMaintenanceEmail({...rec,id:"new",status:"Open",raisedAt:new Date().toISOString().slice(0,10)},eqName,maintEmails),500);
    showToast("Maintenance ticket raised");
    setModal(null);
  };

  /* Close a ticket */
  const closeTicket = (ticket, notes, file, closedBy) => {
    updateTicket(ticket._eqId, {
      ...ticket,
      status: "Closed",
      closedAt: new Date().toISOString().slice(0,10),
      closingNotes: notes,
      closedBy: closedBy,
      ...(file.link ? {completionFileLink:file.link, completionFileName:file.name} : {}),
    });
    showToast("Ticket closed ✓");
    setCloseModal(null);
    setCloseNotes("");
    setCloseBy("");
    setCloseFile({link:"",name:""});
  };

  /* Reopen a ticket */
  const reopenTicket = ticket => {
    updateTicket(ticket._eqId, { ...ticket, status: "Open", closedAt: "", closingNotes: "" });
    showToast("Ticket reopened");
  };

  /* Mark in progress */
  const markInProgress = ticket => {
    updateTicket(ticket._eqId, { ...ticket, status: "In Progress" });
    showToast("Ticket marked In Progress");
  };

  const IS = { background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:13, color:T.textSub, outline:"none", width:"100%" };

  return (
    <div style={{maxWidth:"min(960px,95vw)",margin:"0 auto",width:"100%"}}>
      <PageHeader title="MAINTENANCE TICKETS" sub="Raise, track and close equipment maintenance requests" color={T.gold}>
        <ExportBtn
          data={allTickets.map(t=>({
            "Ticket ID":        t.id||"",
            "Equipment":        t._eqName||"",
            "Project":          t.project||"",
            "Status":           t.status||"Open",
            "Description":      t.description||"",
            "Reason":           t.reason||"",
            "Raised By":        t.raisedBy||"",
            "Date Raised":      t.raisedAt||"",
            "Service Provider": t.serviceProvider||"",
            "Est. Cost (SAR)":  t.cost||"",
            "Closed By":        t.closedBy||"",
            "Date Closed":      t.closedAt||"",
            "Closing Notes":    t.closingNotes||"",
            "File Link":        t.fileLink||"",
            "Completion File":  t.completionFileLink||"",
          }))}
          filename="Maintenance_Tickets"
        />
        <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Raise Ticket</Btn>
      </PageHeader>

      {/* ── Stats strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
        {[
          {label:"Total",       value:allTickets.length,  color:T.textMuted},
          {label:"Open",        value:openCount,          color:"#ef4444"},
          {label:"In Progress", value:inProgCount,        color:"#f59e0b"},
          {label:"Closed",      value:closedCount,        color:"#10b981"},
        ].map(s=>(
          <div key={s.label} onClick={()=>setFilterStatus(s.label==="Total"?"All":s.label)}
            style={{background:T.card,border:`1px solid ${filterStatus===(s.label==="Total"?"All":s.label)?s.color:T.border}`,borderRadius:12,padding:"14px 16px",textAlign:"center",cursor:"pointer",transition:"all .15s"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6}}>
          {["All","Open","In Progress","Closed"].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${filterStatus===s?T.gold:T.border}`,background:filterStatus===s?T.goldDim:"transparent",color:filterStatus===s?T.gold:T.textSub,fontSize:12,fontWeight:filterStatus===s?700:500,cursor:"pointer",transition:"all .15s"}}>
              {s}
            </button>
          ))}
        </div>
        {projects.length > 0 && (
          <select value={filterProj} onChange={e=>{setFilterProj(e.target.value);setFilterRig("All");}}
            style={{...IS, width:"auto",fontSize:12,padding:"6px 12px"}}>
            <option value="All">All Projects</option>
            {renderProjectOptions(projects)}
          </select>
        )}
        {rigsForFilter.length > 0 && (
          <select value={filterRig} onChange={e=>setFilterRig(e.target.value)}
            style={{...IS, width:"auto",fontSize:12,padding:"6px 12px"}}>
            <option value="All">All Rigs</option>
            {rigsForFilter.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <span style={{fontSize:12,color:T.textMuted,marginLeft:"auto"}}>{visible.length} ticket{visible.length!==1?"s":""}</span>
      </div>

      {/* ── Ticket list ── */}
      {visible.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",background:T.card,border:`1px solid ${T.border}`,borderRadius:16}}>
          <div style={{fontSize:48,marginBottom:12}}>🛠</div>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>
            {allTickets.length === 0 ? "No tickets yet" : "No tickets match this filter"}
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>
            {allTickets.length === 0 ? "Raise a maintenance request to get started" : "Try a different status or project filter"}
          </div>
          {allTickets.length === 0 && <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Raise First Ticket</Btn>}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {visible.map((ticket, i) => {
            const s   = sOf(ticket);
            const isE = expandId === ticket.id;
            const status = ticket.status || "Open";
            return (
              <div key={ticket.id} style={{background:T.card,border:`1px solid ${status==="Open"?"#ef444444":status==="In Progress"?"#f59e0b44":T.border}`,borderLeft:`4px solid ${s.color}`,borderRadius:14,overflow:"hidden",animationDelay:`${i*.03}s`}} className="fade-up">

                {/* ── Ticket header (always visible) ── */}
                <div style={{padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer"}} onClick={()=>setExpandId(isE?null:ticket.id)}>
                  {/* Status badge */}
                  <div style={{background:s.bg,border:`1px solid ${s.color}44`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:s.color,whiteSpace:"nowrap",flexShrink:0,marginTop:2}}>
                    {s.icon} {status}
                  </div>
                  {/* Main info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:4}}>{ticket.description || ticket.reason || "Maintenance Request"}</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:12,color:T.textMuted}}>
                      <span style={{fontWeight:600,color:T.gold}}>⚙ {ticket._eqName}</span>
                      {ticket._eqRig && <span style={{color:T.blue,fontWeight:600}}>🔩 {ticket._eqRig}</span>}
                      {ticket.project && <span>📍 {ticket.project}</span>}
                      {ticket.raisedBy && <span>👤 Raised by: <strong style={{color:T.text}}>{ticket.raisedBy}</strong></span>}
                      {ticket.raisedAt && <span>on {fmtDate(ticket.raisedAt)}</span>}
                      {ticket.closedBy && <span style={{color:"#10b981"}}>✓ Closed by: <strong>{ticket.closedBy}</strong></span>}
                      {ticket.closedAt && <span style={{color:"#10b981"}}>on {fmtDate(ticket.closedAt)}</span>}
                      {ticket.cost && <span>SAR {Number(ticket.cost).toLocaleString()}</span>}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                    {status === "Open" && (
                      <button onClick={()=>markInProgress(ticket)}
                        style={{background:"rgba(245,158,11,.15)",border:"1px solid rgba(245,158,11,.3)",color:"#f59e0b",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                        ▶ Start
                      </button>
                    )}
                    {(status === "Open" || status === "In Progress") && (
                      <button onClick={()=>{setCloseModal(ticket);setCloseNotes("");}}
                        style={{background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",color:"#10b981",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                        ✓ Close
                      </button>
                    )}
                    {status === "Closed" && (
                      <button onClick={()=>reopenTicket(ticket)}
                        style={{background:T.goldDim,border:`1px solid ${T.gold}44`,color:T.gold,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                        ↺ Reopen
                      </button>
                    )}
                    <span style={{color:T.textMuted,fontSize:13,marginLeft:4}}>{isE?"▲":"▼"}</span>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {isE && (
                  <div style={{borderTop:`1px solid ${T.border}`,background:T.card2,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
                      {ticket.reason && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:4,letterSpacing:.5}}>REASON FOR REQUEST</div>
                          <div style={{fontSize:13,color:T.text,lineHeight:1.6}}>{ticket.reason}</div>
                        </div>
                      )}
                      {ticket.serviceProvider && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:4,letterSpacing:.5}}>SERVICE PROVIDER</div>
                          <div style={{fontSize:13,color:T.text}}>{ticket.serviceProvider}</div>
                        </div>
                      )}
                      {ticket.closingNotes && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:4,letterSpacing:.5}}>CLOSING NOTES</div>
                          <div style={{fontSize:13,color:T.text,lineHeight:1.6}}>{ticket.closingNotes}</div>
                        </div>
                      )}
                      {ticket.closedBy && (
                        <div>
                          <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:4,letterSpacing:.5}}>CLOSED BY</div>
                          <div style={{fontSize:13,color:T.text,fontWeight:600}}>{ticket.closedBy}</div>
                        </div>
                      )}
                    </div>
                    {ticket.fileLink && (
                      <a href={ticket.fileLink} target="_blank" rel="noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:6,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,color:T.blue,textDecoration:"none",alignSelf:"flex-start"}}>
                        📎 View Attachment
                      </a>
                    )}
                    {/* Timeline */}
                    <div style={{display:"flex",gap:0,alignItems:"center",marginTop:4}}>
                      {[
                        {label:"Raised",      date:ticket.raisedAt, done:true},
                        {label:"In Progress", date:status==="In Progress"||status==="Closed"?ticket.raisedAt:"", done:status==="In Progress"||status==="Closed"},
                        {label:"Closed",      date:ticket.closedAt, done:status==="Closed"},
                      ].map((step,si)=>(
                        <Fragment key={si}>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                            <div style={{width:28,height:28,borderRadius:"50%",background:step.done?"#10b981":T.card2,border:`2px solid ${step.done?"#10b981":T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>
                              {step.done?"✓":"○"}
                            </div>
                            <div style={{fontSize:10,color:step.done?T.text:T.textMuted,fontWeight:step.done?600:400,textAlign:"center"}}>{step.label}</div>
                            {step.date&&<div style={{fontSize:10,color:T.textMuted}}>{fmtDate(step.date)}</div>}
                          </div>
                          {si<2&&<div style={{flex:1,height:2,background:step.done&&(si===0?status!=="Open":status==="Closed")?"#10b981":T.border,margin:"0 4px",marginBottom:22}}/>}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Raise Ticket Modal ── */}
      {modal && (
        <RaiseTicketModal
          equipment={equipment}
          projects={projects}
          onClose={()=>setModal(null)}
          onSave={addTicket}
        />
      )}

      {/* ── Close Ticket Modal ── */}
      {closeModal && (
        <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setCloseModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",padding:"24px",boxShadow:T.shadow,animation:"modalFloatIn .3s ease both"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:"#10b981",marginBottom:4}}>✓ CLOSE TICKET</div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:18}}>{closeModal.description||closeModal.reason||"Maintenance Request"} — <span style={{color:T.gold}}>{closeModal._eqName}</span></div>

            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>CLOSED BY *</div>
            <input value={closeBy} onChange={e=>setCloseBy(e.target.value)} placeholder="Your name (person closing this ticket)"
              style={{...IS,marginBottom:16,fontFamily:"inherit"}}/>

            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>CLOSING NOTES (optional)</div>
            <textarea
              value={closeNotes}
              onChange={e=>setCloseNotes(e.target.value)}
              placeholder="Describe what was done, parts replaced, outcome…"
              rows={4}
              style={{...IS,resize:"vertical",fontFamily:"inherit",lineHeight:1.6,marginBottom:16}}
            />

            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>COMPLETION DOCUMENT (optional)</div>
            {closeFile.link ? (
              <div style={{display:"flex",alignItems:"center",gap:10,background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:16}}>
                <span style={{fontSize:20}}>📄</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{closeFile.name}</div>
                  <a href={closeFile.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,fontWeight:600,textDecoration:"none"}}>↗ View</a>
                </div>
                <button onClick={()=>setCloseFile({link:"",name:""})}
                  style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✕</button>
              </div>
            ) : (
              <div
                onClick={()=>!closingUpload&&closeFileRef.current.click()}
                style={{border:`2px dashed ${T.border}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:closingUpload?"wait":"pointer",marginBottom:16,transition:"all .2s"}}
                onDragOver={e=>{e.preventDefault();}}
                onDrop={e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)handleCloseUpload(file);}}>
                {closingUpload
                  ? <div style={{fontSize:13,color:T.gold,fontWeight:600}}>⏳ Uploading…</div>
                  : <>
                      <div style={{fontSize:22,marginBottom:4}}>📎</div>
                      <div style={{fontSize:12,color:T.textMuted}}>Attach completion report, photo or certificate</div>
                    </>
                }
                <input ref={closeFileRef} type="file" style={{display:"none"}}
                  onChange={e=>{if(e.target.files[0]){handleCloseUpload(e.target.files[0]);e.target.value="";}}}/>
              </div>
            )}
            {closingUpErr&&<div style={{fontSize:12,color:T.red,marginBottom:10,fontWeight:600}}>⚠ {closingUpErr}</div>}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setCloseModal(null);setCloseNotes("");setCloseBy("");setCloseFile({link:"",name:""});}}
                style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                Cancel
              </button>
              <button onClick={()=>{if(!closeBy.trim()){alert("Please enter your name (Closed By)");return;}closeTicket(closeModal,closeNotes,closeFile,closeBy);}}
                style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
                ✓ Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RaiseTicketModal({equipment,projects,onClose,onSave}) {
  const [f,        setF]        = useState({date: new Date().toISOString().slice(0,10), status:"Open"});
  const [uploading,setUploading] = useState(false);
  const [uploadErr,setUploadErr] = useState("");
  const [dragging, setDragging]  = useState(false);
  const fileRef = useRef();
  const set = k => v => setF(p=>({...p,[k]:v}));
  const IS  = {background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",width:"100%",fontFamily:"inherit"};

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true); setUploadErr("");
    try {
      const folder = `maintenance/${(f.project||"general").replace(/[^a-zA-Z0-9]/g,"_")}`;
      const url = await uploadToSupabase(file, folder);
      setF(p=>({...p, fileLink:url, fileName:file.name}));
    } catch(err) {
      setUploadErr("Upload failed: " + (err.message||"check Supabase config"));
    } finally {
      setUploading(false);
    }
  };

  const fileIcon = name => {
    if (!name) return "📎";
    if (/\.pdf$/i.test(name))       return "📄";
    if (/\.(xlsx?|csv)$/i.test(name)) return "📊";
    if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return "🖼️";
    return "📎";
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:T.shadow,animation:"modalFloatIn .3s ease both"}}>
        <div style={{padding:"20px 24px 0",position:"sticky",top:0,background:T.card,zIndex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.gold,marginBottom:2}}>🛠 RAISE MAINTENANCE TICKET</div>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Fill in the details below — the ticket will be logged as Open</div>
        </div>
        <div style={{padding:"0 24px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>EQUIPMENT *</div>
            <select value={f.eqId||""} onChange={e=>set("eqId")(e.target.value)}
              style={{...IS,colorScheme:"dark"}}>
              <option value="">Select equipment…</option>
              {equipment.map(eq=><option key={eq.id} value={eq.id}>{eq.name}{eq.model?` — ${eq.model}`:""}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>PROJECT</div>
            <select value={f.project||""} onChange={e=>set("project")(e.target.value)}
              style={{...IS,colorScheme:"dark"}}>
              <option value="">Select project…</option>
              {renderProjectOptions(projects)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>DESCRIPTION OF ISSUE *</div>
            <textarea value={f.description||""} onChange={e=>set("description")(e.target.value)}
              placeholder="Describe the problem or maintenance needed…" rows={3}
              style={{...IS,resize:"vertical",lineHeight:1.6}}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>REASON / PRIORITY</div>
            <textarea value={f.reason||""} onChange={e=>set("reason")(e.target.value)}
              placeholder="Why is this needed? Is it urgent?" rows={2}
              style={{...IS,resize:"vertical",lineHeight:1.6}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>DATE</div>
              <input type="date" value={f.date||""} onChange={e=>set("date")(e.target.value)} style={{...IS,colorScheme:"dark"}}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>EST. COST (SAR)</div>
              <input type="number" value={f.cost||""} onChange={e=>set("cost")(e.target.value)} placeholder="0" style={{...IS}}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>SERVICE PROVIDER</div>
            <input value={f.serviceProvider||""} onChange={e=>set("serviceProvider")(e.target.value)} placeholder="Who will carry out the work?" style={{...IS}}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>RAISED BY *</div>
            <input value={f.raisedBy||""} onChange={e=>set("raisedBy")(e.target.value)} placeholder="Your name (person raising this ticket)" style={{...IS}}/>
          </div>
          {/* ── File upload ── */}
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:.5}}>ATTACH FILE</div>
            {f.fileLink ? (
              /* File attached — preview row */
              <div style={{display:"flex",alignItems:"center",gap:10,background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px"}}>
                <span style={{fontSize:22,flexShrink:0}}>{fileIcon(f.fileName||f.fileLink)}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.fileName||"Attached file"}</div>
                  <a href={f.fileLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,fontWeight:600,textDecoration:"none"}}>↗ View / Download</a>
                </div>
                <button onClick={()=>setF(p=>({...p,fileLink:"",fileName:""}))}
                  style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer",flexShrink:0}}>✕</button>
              </div>
            ) : (
              /* Drop zone */
              <div
                onDragOver={e=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file)handleUpload(file);}}
                onClick={()=>!uploading&&fileRef.current.click()}
                style={{border:`2px dashed ${dragging?T.gold:T.border}`,borderRadius:10,padding:"20px 16px",textAlign:"center",cursor:uploading?"wait":"pointer",background:dragging?T.goldDim:"transparent",transition:"all .2s"}}>
                {uploading
                  ? <div style={{fontSize:13,color:T.gold,fontWeight:600}}>⏳ Uploading…</div>
                  : <>
                      <div style={{fontSize:26,marginBottom:6}}>📎</div>
                      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>Drop file here or click to browse</div>
                      <div style={{fontSize:11,color:T.textMuted}}>PDF, images, Excel — any relevant documentation</div>
                    </>
                }
                <input ref={fileRef} type="file" style={{display:"none"}}
                  onChange={e=>{if(e.target.files[0]){handleUpload(e.target.files[0]);e.target.value="";}}}/>
              </div>
            )}
            {uploadErr && <div style={{fontSize:12,color:T.red,marginTop:6,fontWeight:600}}>⚠ {uploadErr}</div>}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:4}}>
            <button onClick={onClose}
              style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              Cancel
            </button>
            <button onClick={()=>{
              if(!f.eqId){alert("Please select equipment");return;}
              if(!f.description){alert("Please describe the issue");return;}
              if(!f.raisedBy?.trim()){alert("Please enter your name (Raised By)");return;}
              onSave(f.eqId, f);
            }}
              style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",color:"#000",borderRadius:10,padding:"10px 28px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
              🛠 Raise Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


  function EquipmentDetail({eq,projects,onBack,onUpdate,onDelete,onEdit,showToast}) {
  const [activeTab,setActiveTab]=useState("certifications");
  const [subModal, setSubModal] =useState(null);

  const EQ_SUBTABS=[
    {id:"certifications",label:"Certifications",icon:"📜",color:T.blue},
    {id:"invoices",      label:"Invoices",      icon:"🧾",color:T.green},
    {id:"insurance",     label:"Insurance",     icon:"🛡",color:T.purple},
    {id:"permits",       label:"Permits",       icon:"⬡",color:T.gold},
    {id:"maintenance",   label:"Maintenance",   icon:"🛠",   desc:"Maintenance requests",   color:T.gold},
  ];

  const eqFileRef=useRef();
  const saveSubRecord=(type,rec,mode)=>{
    setSubModal(null);
    setTimeout(()=>{
      const list=[...(eq[type]||[])];
      if(mode==="add")list.push({...rec,id:uid()});
      else{const i=list.findIndex(r=>r.id===rec.id);if(i>=0)list[i]=rec;}
      onUpdate({...eq,[type]:list});
      showToast(mode==="add"?"Record added":"Record updated");
    },0);
  };

  const delSubRecord=(type,id)=>{
    const list=(eq[type]||[]).filter(r=>r.id!==id);
    onUpdate({...eq,[type]:list});
    showToast("Deleted","del");
  };

  // Import equipment certifications from Excel for THIS equipment
  // Columns: EQUIPMENT, SERIAL NO, CERT NO, ISSUED BY, INSPECTION DATE, EXPIRY DATE
  const importEqCerts = file => {
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        // Headers on row 1 in Equipment_TUV_Tracker.xlsx (Sheet3)
        const wb=XLSX.read(e.target.result,{type:"array",cellDates:true});
        const sheetName=wb.SheetNames.includes("TUV MASTERSHEET")?"TUV MASTERSHEET":wb.SheetNames.includes("Sheet3")?"Sheet3":wb.SheetNames[0];
        const ws=wb.Sheets[sheetName];
        const rawRows=XLSX.utils.sheet_to_json(ws,{defval:""});
        const rows=rawRows.map(row=>{const n={};Object.entries(row).forEach(([k,v])=>{n[k.toUpperCase().trim()]=v;});return n;});
        const parsed=parseExcelRows(rows,EQ_CERT_MAP);
        if(!parsed.length){showToast(`No valid rows found in sheet: ${sheetName}`,"del");return;}
        const certs=parsed.map(r=>({
          id:uid(),
          equipmentName:r.eqName||eq.name||"",
          itemType:r.itemType||"",
          certNo:r.certNo||"",
          issuedBy:r.issuedBy||"",
          issueDate:r.issueDate||"",
          expiryDate:r.expiryDate||"",
          serialNo:r.serialNo||eq.serialNo||"",
          fileLink:"",
        }));
        onUpdate({...eq,certifications:[...(eq.certifications||[]),...certs]});
        showToast(`✓ Imported ${certs.length} certifications from ${sheetName}`);
      }catch(err){showToast("Failed to read file","del");console.error(err);}
    };
    reader.readAsArrayBuffer(file);
  };

  const curTab=EQ_SUBTABS.find(t=>t.id===activeTab);
  const records=eq[activeTab]||[];

  return (
    <div style={{maxWidth:"min(1200px,95vw)",margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{eq.name}</div>
          <div style={{fontSize:12,color:T.textMuted}}>{eq.model} · {eq.serialNo} · {eq.project}</div>
        </div>
        <Btn color={T.blue} onClick={onEdit}>✎ Edit</Btn>
        <Btn color={T.red}  onClick={()=>{if(window.confirm("Delete?"))onDelete();}}>✕ Delete</Btn>
      </div>

      {/* Info strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:22}}>
        {[["Status",eq.status,"—"],["Operator",eq.operator,"—"],["Project",eq.project,"—"],["Purchase Date",fmtDate(eq.purchaseDate),"—"]].map(([k,v])=>(
          <div key={k} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:700,marginBottom:4,letterSpacing:".5px"}}>{k.toUpperCase()}</div>
            <div style={{fontSize:14,color:T.text,fontWeight:600}}>{v||"—"}</div>
          </div>
        ))}
      </div>

      {/* 90-day expiry alert banner */}
      {(()=>{
        const expiring=[...(eq.certifications||[]),...(eq.insurance||[]),...(eq.permits||[])].filter(r=>{const d=daysUntil(r.expiryDate);return d!==null&&d<=90;}).sort((a,b)=>daysUntil(a.expiryDate)-daysUntil(b.expiryDate));
        if(!expiring.length) return null;
        return (
          <div style={{background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:14,fontWeight:700,color:T.red}}>⚠ EXPIRY ALERTS</span>
              <span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{expiring.length}</span>
            </div>
            <div style={{display:"grid",gap:6}}>
              {expiring.map((r,i)=>{
                const d=daysUntil(r.expiryDate);const s=getStatus(d);
                const lbl=r.equipmentName||r.itemType||r.certNo||r.policyNo||r.permitNo||"Item";
                return (
                  <div key={r.id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,borderRadius:8,padding:"8px 12px",border:`1px solid ${s.color}33`}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</div>
                      <div style={{fontSize:12,color:T.textSub,marginTop:1}}>Expires: {fmtDate(r.expiryDate)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:s.color,lineHeight:1}}>{Math.abs(d)}</div>
                      <div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>{d<0?"OVERDUE":"DAYS LEFT"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
        {EQ_SUBTABS.map(t=>{
          const cnt=(eq[t.id]||[]).length;
          const active=activeTab===t.id;
          return (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flexShrink:0,padding:"8px 16px",borderRadius:999,border:`1px solid ${active?t.color:T.border}`,background:active?`${t.color}18`:"transparent",color:active?t.color:T.textSub,fontSize:13,fontWeight:active?700:500,display:"flex",alignItems:"center",gap:6,transition:"all .15s"}}>
              {t.icon} {t.label} <span style={{background:active?t.color:T.border,color:active?"#000":T.textMuted,borderRadius:999,padding:"1px 7px",fontSize:11,fontWeight:700}}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Excel import banner — only for certifications tab */}
      {activeTab==="certifications"&&(
        <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:T.blue}}>📂 Import Certifications from Excel</div>
            <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>ITEM TYPE, ITEM NAME/ID, REG/SERIAL NO, TUV PROVIDER, START DATE, EXPIRY DATE</strong> (Sheet3 auto-detected)</div>
          </div>
          <input ref={eqFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importEqCerts(e.target.files[0]);e.target.value="";}}}/>
          <button onClick={()=>eqFileRef.current.click()} style={{background:T.blue,color:"#000",border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,flexShrink:0}}>⬆ Upload Excel</button>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <Btn color={curTab.color} solid onClick={()=>setSubModal({mode:"add",type:activeTab})}>+ Add {curTab.label.replace(/s$/,"")}</Btn>
      </div>

      {records.length===0
        ?<Empty icon={curTab.icon} label={`No ${curTab.label.toLowerCase()}`} sub={`Add the first record`} color={curTab.color} onAdd={()=>setSubModal({mode:"add",type:activeTab})}/>
        :<div style={{display:"grid",gap:10}}>
          {records.map((r,i)=><SubRecordCard key={r.id} r={r} type={activeTab} color={curTab.color} delay={i*.03} onEdit={()=>setSubModal({mode:"edit",type:activeTab,rec:r})} onDel={()=>delSubRecord(activeTab,r.id)}/>)}
        </div>
      }

      {subModal&&<SubRecordModal mode={subModal.mode} type={subModal.type} rec={subModal.rec} projects={projects} onClose={()=>setSubModal(null)} onSave={(rec,mode)=>saveSubRecord(subModal.type,rec,mode)}/>}
    </div>
  );
}

function SubRecordCard({r,type,color,delay,onEdit,onDel}) {
  const expDate=r.expiryDate;
  const days=daysUntil(expDate);
  const s=getStatus(days);
  // Build a meaningful title from whatever fields exist
  const title=r.equipmentName||r.itemType||r.certNo||r.invoiceNo||r.policyNo||r.permitNo||"Record";
  return (
    <div className="fade-up" style={{background:T.card,border:`1px solid ${expDate&&days!==null&&days<=90?s.color+"44":T.border}`,borderLeft:`4px solid ${expDate?s.color:color}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,animationDelay:`${delay}s`}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>{title}</span>
          {expDate&&<Tag color={s.color}>{s.label}</Tag>}
          {expDate&&days!==null&&days<=90&&<Tag color={s.color}>{days<0?`${Math.abs(days)}d overdue`:`${days}d left`}</Tag>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {r.itemType&&r.itemType!==title&&<Chip>{r.itemType}</Chip>}
          {r.serialNo&&<Chip>S/N: {r.serialNo}</Chip>}
          {r.certNo&&r.certNo!==title&&<Chip>Cert: {r.certNo}</Chip>}
          {r.issuedBy&&<Chip>{r.issuedBy}</Chip>}
          {r.supplier&&<Chip>{r.supplier}</Chip>}
          {r.insurer&&<Chip>{r.insurer}</Chip>}
          {r.type&&<Chip>{r.type}</Chip>}
          {r.amount&&<Chip color={T.green}>SAR {Number(r.amount).toLocaleString()}</Chip>}
          {r.issueDate&&<Chip>Start: {fmtDate(r.issueDate)}</Chip>}
          {r.date&&<Chip>Date: {fmtDate(r.date)}</Chip>}
          {expDate&&<Chip color={s.color}>Exp: {fmtDate(expDate)}</Chip>}
          {r.fileLink&&<FileLink href={r.fileLink}/>}
        </div>
        {r.description&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{r.description}</div>}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <ABtn color={T.blue} onClick={onEdit}>✎</ABtn>
        <ABtn color={T.red}  onClick={onDel}>✕</ABtn>
      </div>
    </div>
  );
}

function SubRecordModal({mode,type,rec,onClose,onSave,projects}) {
  const [f,setF]=useState(rec||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const CONFIGS={
    certifications:{color:T.blue,  title:"CERTIFICATION",  fields:[["certNo","Certificate No."],["issuedBy","Issued By"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
    invoices:      {color:T.green, title:"INVOICE",        fields:[["invoiceNo","Invoice No.","","req"],["supplier","Supplier","","req"],["amount","Amount (SAR)"],["date","Invoice Date","date"],["description","Description","textarea"],["fileLink","File Link","link"]]},
    insurance:     {color:T.purple,title:"INSURANCE",      fields:[["policyNo","Policy No.","","req"],["insurer","Insurer","","req"],["type","Policy Type"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
    permits:       {color:T.gold,  title:"PERMIT",         fields:[["permitNo","Permit No.","","req"],["type","Permit Type"],["issuedBy","Issued By"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
    maintenance:   {color:T.gold,  title:"MAINTENANCE",    fields:[["project","Project","select"],["date","Date","date"],["description","Description","textarea"],["reason","Reason for Request","textarea"],["cost","Cost (SAR)"],["serviceProvider","Service Provider"],["status","Status","status"],["fileLink","File Link","link"]]},
  };
  const cfg=CONFIGS[type]||CONFIGS.certifications;
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} ${cfg.title}`} color={cfg.color} onClose={onClose}
      onSave={()=>{onSave(f,mode);}}>
      {cfg.fields.map(([k,label,ftype,req])=>(
        <FieldRow key={k} label={`${label}${req?" *":""}`}>
          {ftype==="textarea"
            ?<FTextarea value={f[k]||""} onChange={set(k)} color={cfg.color}/>
            :ftype==="link"
              ?<FLink value={f[k]||""} onChange={set(k)}/>
              :ftype==="select"
                ?<FSelect value={f[k]||""} onChange={set(k)} color={cfg.color}>
                    <option value="">Select project…</option>
                    {renderProjectOptions(projects)}
                  </FSelect>
              :ftype==="status"
                ?<FSelect value={f[k]||""} onChange={set(k)} color={cfg.color}>
                    <option value="">Select status…</option>
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </FSelect>
              :<FInput type={ftype||"text"} value={f[k]||""} onChange={set(k)} color={cfg.color}/>
          }
        </FieldRow>
      ))}
    </FormModal>
  );
}

function EqModal({mode,eq,projects,rigs,onClose,onSave}) {
  const [f,setF]=useState(eq||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  // Rigs available for the currently selected project
  const projRigs = (rigs||[]).filter(r=>r.project===f.project);
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} EQUIPMENT`} color={T.gold} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Equipment name required");return;}onSave(f,mode);}}>
      <FieldRow label="Equipment Name *"><FInput value={f.name||""} onChange={set("name")} color={T.gold}/></FieldRow>
      <FieldRow label="Model / Make"><FInput value={f.model||""} onChange={set("model")} color={T.gold}/></FieldRow>
      <FieldRow label="Serial Number"><FInput value={f.serialNo||""} onChange={set("serialNo")} color={T.gold}/></FieldRow>
      <FieldRow label="Project">
        <FSelect value={f.project||""} onChange={v=>{setF(p=>({...p,project:v,rig:""}));}} color={T.gold}>
          <option value="">Select…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Rig / Spread">
        <FSelect value={f.rig||""} onChange={set("rig")} color={T.gold}>
          <option value="">Select rig…</option>
          {projRigs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
          {projRigs.length===0&&f.project&&<option disabled>— No rigs for this project yet —</option>}
        </FSelect>
      </FieldRow>
      <FieldRow label="Status">
        <FSelect value={f.status||""} onChange={set("status")} color={T.gold}>
          <option value="">Select…</option>
          <option>Active</option><option>Under Maintenance</option><option>Inactive</option>
        </FSelect>
      </FieldRow>
      <FieldRow label="Operator / Responsible Person"><FInput value={f.operator||""} onChange={set("operator")} color={T.gold}/></FieldRow>
      <FieldRow label="Purchase Date"><FInput type="date" value={f.purchaseDate||""} onChange={set("purchaseDate")} color={T.gold}/></FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.gold}/></FieldRow>
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
════════════════════════════════════════════════════════════════════════════ */
function PageHeader({title,sub,color,children}) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:22}}>
      <div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{title}</div>
        <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>{sub}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{children}</div>
    </div>
  );
}

function Empty({icon,label,sub,color,onAdd}) {
  return (
    <div style={{textAlign:"center",padding:"60px 20px",background:T.card,borderRadius:14,border:`1px dashed ${T.border}`}}>
      <div style={{fontSize:44,color,opacity:.2,marginBottom:14}}>{icon}</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.textSub,marginBottom:6}}>{label}</div>
      <div style={{fontSize:13,color:T.textMuted,marginBottom:22}}>{sub}</div>
      <button onClick={onAdd} style={{background:color,color:"#000",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:700}}>+ Add Now</button>
    </div>
  );
}

function Overlay({ children, onClose }) {
  const { height: viewportHeight } = useViewport();

  // Smart centering logic
  const isShortScreen = viewportHeight < 700;

  return (
    <div
      className="fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex",
        justifyContent: "center",

        // 👇 KEY CHANGE
        alignItems: isShortScreen ? "flex-start" : "center",

        // 👇 dynamic spacing
        padding: isShortScreen ? "20px 16px" : "32px 16px",

        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FormModal({ title, color, children, onClose, onSave }) {
  return (
    <Overlay onClose={onClose}>
      <div
        className="slide-up"
        style={{
          background: T.sidebar,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          width: "100%",
          maxWidth: 560,
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: T.text,
              letterSpacing: ".5px",
            }}
          >
            {title}
          </div>

          <button
            onClick={onClose}
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              color: T.textSub,
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {children}
        </div>

        <div
          style={{
            padding: "14px 24px 22px",
            display: "flex",
            gap: 10,
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.sidebar,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: T.bg,
              border: `1px solid ${T.border}`,
              color: T.textSub,
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            style={{
              flex: 2,
              background: color,
              border: "none",
              color: "#000",
              borderRadius: 10,
              padding: "12px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function CatManagerModal({title,cats,onSave,onClose}) {
  const [list,setList]=useState([...cats]);
  const [newCat,setNewCat]=useState("");
  const add=()=>{const n=newCat.trim();if(!n||list.includes(n))return;setList(l=>[...l,n]);setNewCat("");};
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:440,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{title.toUpperCase()}</div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>
        <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",gap:8}}>
            <input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New category name…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button onClick={add} style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,flexShrink:0}}>+ Add</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 22px"}}>
          {list.map((c,i)=>(
            <div key={c} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:T.bg,borderRadius:9,marginBottom:7,border:`1px solid ${T.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:T.blue}}/>
                <span style={{fontSize:14,color:T.text}}>{c}</span>
              </div>
              <button onClick={()=>setList(l=>l.filter(x=>x!==c))} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{padding:"12px 22px 22px",flexShrink:0}}>
          <button onClick={()=>{onSave(list);onClose();}} style={{width:"100%",background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700}}>Save Categories</button>
        </div>
      </div>
    </Overlay>
  );
}

function FieldRow({label,children}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:T.textSub,marginBottom:6,letterSpacing:".3px"}}>{label}</label>
      {children}
    </div>
  );
}

function SectionDivider({label}) {
  return <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"1.5px",marginTop:16,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.border}`}}>{label}</div>;
}

function FInput({type,value,onChange,color,placeholder}) {
  return <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:T.text,outline:"none",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FTextarea({value,onChange,color}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:T.text,outline:"none",resize:"vertical",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FSelect({value,onChange,color,children}) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:value?T.text:T.textMuted,outline:"none",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
    {children}
  </select>;
}

function FLink({value,onChange,folder}) {
  const [uploading,setUploading] = useState(false);
  const [uploadErr,setUploadErr] = useState("");
  const fileRef = useRef();
  const configured = isSupabaseConfigured();

  const handleUpload = async e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 50*1024*1024) { setUploadErr("File too large (max 50MB)"); return; }
    setUploading(true); setUploadErr("");
    try {
      const url = await uploadToSupabase(file, folder||"general");
      onChange(url);
      setUploadErr("");
    } catch(err) {
      setUploadErr("Upload failed: " + err.message);
    } finally { setUploading(false); }
    e.target.value="";
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",gap:6}}>
        <input type="url" value={value} onChange={e=>onChange(e.target.value)}
          placeholder="Paste link or upload file below…"
          style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.blue,outline:"none",colorScheme:"light"}}
          onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
        {value&&(
          <a href={value} target="_blank" rel="noreferrer"
            style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:8,padding:"0 12px",fontSize:12,fontWeight:600,flexShrink:0,cursor:"pointer",textDecoration:"none",display:"flex",alignItems:"center",whiteSpace:"nowrap"}}>
            ↗ Open
          </a>
        )}
      </div>
      {configured && (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input ref={fileRef} type="file" style={{display:"none"}} onChange={handleUpload}/>
          <button type="button" onClick={()=>fileRef.current.click()} disabled={uploading}
            style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:uploading?0.6:1}}>
            {uploading ? "⏳ Uploading…" : "⬆ Upload File"}
          </button>
          <span style={{fontSize:11,color:T.textMuted}}>PDF, Word, Excel, images up to 50MB</span>
        </div>
      )}
      {!configured && (
        <div style={{fontSize:11,color:T.textMuted,padding:"5px 8px",background:T.goldDim,borderRadius:6,border:`1px solid ${T.gold}33`}}>
          💡 Add your Supabase keys to enable direct file upload
        </div>
      )}
      {uploadErr && <div style={{fontSize:11,color:T.red}}>{uploadErr}</div>}

    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════════════
   FILE PREVIEW MODAL
════════════════════════════════════════════════════════════════════════════ */
function FilePreviewModal({url,onClose}) {
  // Detect file type from URL
  const clean   = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/.test(clean);
  const isPdf   = /\.pdf$/.test(clean);
  const isOffice= /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(clean);
  const isSupabase   = url.includes("supabase.co/storage");
  const isGDrive     = url.includes("drive.google.com");
  const isOneDrive   = url.includes("1drv.ms") || url.includes("onedrive.live.com");
  const isSharePoint = url.includes("sharepoint.com");

  // Build the best embed URL for each case
  const embedUrl = (() => {
    if (isImage) return url;
    // PDFs from Supabase — use Google PDF viewer as proxy (avoids X-Frame-Options)
    if (isPdf || isSupabase) return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    // Office files — Microsoft Office Online viewer
    if (isOffice) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    // Google Drive — convert to preview embed
    if (isGDrive) {
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
    // OneDrive
    if (isOneDrive) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    // SharePoint
    if (isSharePoint) return url + (url.includes("?") ? "&action=embedview" : "?action=embedview");
    return url;
  })();

  const filename = url.split("/").pop().split("?")[0] || "File";

  return (
    <div className="fade-in" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:16,width:"min(96vw,1000px)",height:"min(92vh,800px)",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>

        {/* ── Header ── */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontSize:18}}>{isImage?"🖼️":isPdf||isSupabase?"📄":isOffice?"📊":"📎"}</span>
          <div style={{flex:1,fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{decodeURIComponent(filename)}</div>
          <a href={url} download target="_blank" rel="noreferrer"
            style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            ⬇ Download
          </a>
          <a href={url} target="_blank" rel="noreferrer"
            style={{background:T.blueDim,border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            ↗ New Tab
          </a>
          <button onClick={onClose}
            style={{background:T.redDim,border:`1px solid ${T.red}44`,color:T.red,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>
            ✕
          </button>
        </div>

        {/* ── Preview ── */}
        <div style={{flex:1,overflow:"hidden",background:T.bg,position:"relative"}}>
          {isImage ? (
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
              <img src={url} alt="Preview"
                style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8,boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}/>
            </div>
          ) : (
            <iframe
              key={embedUrl}
              src={embedUrl}
              style={{width:"100%",height:"100%",border:"none"}}
              title="File Preview"
              allow="autoplay; fullscreen"
            />
          )}
        </div>

        {/* ── Footer tip for Google Viewer ── */}
        {(isPdf||isSupabase)&&!isImage&&(
          <div style={{padding:"8px 16px",background:T.goldDim,borderTop:`1px solid ${T.gold}33`,fontSize:11,color:T.gold,display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            💡 If preview doesn't load, click <strong>↗ New Tab</strong> to open directly — or <strong>⬇ Download</strong> to save the file.
          </div>
        )}
      </div>
    </div>
  );
}

const Chip     = ({children,color}) => <span style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:6,padding:"2px 9px",fontSize:12,color:color||T.textSub,fontWeight:500}}>{children}</span>;
const Tag      = ({children,color}) => <span style={{background:`${color}18`,border:`1px solid ${color}33`,borderRadius:5,padding:"2px 8px",fontSize:11,color,fontWeight:700}}>{children}</span>;
const ABtn     = ({onClick,color,children}) => <button onClick={onClick} style={{width:30,height:30,borderRadius:7,border:`1px solid ${color}33`,background:`${color}18`,color,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
const FileLink = ({href}) => {
  if(!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
      style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:6,padding:"3px 10px",fontSize:12,color:T.blue,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>
      📎 View File
    </a>
  );
};
function BulkUploadModal({ subTab, projects, onClose, onImport }) {
  const [rows, setRows]       = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep]       = useState(1); // 1=upload, 2=map, 3=preview
  const [fileName, setFileName] = useState("");
  const [error, setError]     = useState("");
  const fileRef               = useRef();

  const FIELD_DEFS = {
    invoices:     [
      {key:"name",           label:"Invoice Title *", required:true},
      {key:"project",        label:"Project"},
      {key:"invoiceType",    label:"Invoice Type (Income / Advance)"},
      {key:"refNo",          label:"Invoice No."},
      {key:"dueDate",        label:"Due Date"},
      {key:"amount",         label:"Amount (SAR)"},
      {key:"paymentStatus",  label:"Payment Status"},
      {key:"remainingAmount",label:"Remaining Amount (SAR)"},
      {key:"notes",          label:"Notes"},
    ],
    certificates: [
      {key:"project",        label:"Project"},
      {key:"jobNo",          label:"Job Number"},
      {key:"refNo",          label:"Certificate No."},
      {key:"startDate",      label:"Start Date"},
      {key:"completionDate", label:"Completion Date"},
      {key:"amount",         label:"Invoice Value (SAR)"},
      {key:"notes",          label:"Notes"},
    ],
    workorders: [
      {key:"name",       label:"Title *", required:true},
      {key:"project",    label:"Project"},
      {key:"refNo",      label:"Reference No."},
      {key:"supplier",   label:"Client / Counterparty"},
      {key:"amount",     label:"Contract Value (SAR)"},
      {key:"date",       label:"Date Signed"},
      {key:"expiryDate", label:"Expiry / End Date"},
      {key:"notes",      label:"Notes"},
    ],
  };

  const fields = FIELD_DEFS[subTab] || FIELD_DEFS.invoices;

  const TAB_COLORS = { invoices: T.green, certificates: T.blue, workorders: T.purple };
  const color = TAB_COLORS[subTab] || T.blue;

  // Auto-map: match header to field by fuzzy name comparison
  const autoMap = (hdrs) => {
    const m = {};
    fields.forEach(f => {
      const match = hdrs.find(h => {
        const hn = h.toLowerCase().replace(/[^a-z]/g,"");
        const fn = f.label.toLowerCase().replace(/[^a-z]/g,"");
        const fk = f.key.toLowerCase();
        return hn.includes(fk) || fk.includes(hn) || hn.includes(fn.slice(0,5)) || fn.includes(hn.slice(0,5));
      });
      if (match) m[f.key] = match;
    });
    return m;
  };

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
          if (!lines.length) { setError("Empty CSV file"); return; }
          const hdrs = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim());
          const data = lines.slice(1).filter(l=>l.trim()).map(line => {
            const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || line.split(",");
            const row = {};
            hdrs.forEach((h,i) => { row[h] = (vals[i]||"").replace(/^"|"$/g,"").trim(); });
            return row;
          }).filter(r => Object.values(r).some(v=>v));
          setHeaders(hdrs);
          setRows(data);
          setMapping(autoMap(hdrs));
          setStep(2);
        } catch(err) { setError("Failed to parse CSV: " + err.message); }
      };
      reader.readAsText(file);
    } else {
      // Excel
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, { type:"array", cellDates:true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval:"" });
          if (!rawRows.length) { setError("No data rows found in Excel file"); return; }
          const hdrs = Object.keys(rawRows[0]);
          const data = rawRows.filter(r => Object.values(r).some(v=>v!==null&&v!==""));
          setHeaders(hdrs);
          setRows(data);
          setMapping(autoMap(hdrs));
          setStep(2);
        } catch(err) { setError("Failed to parse Excel: " + err.message); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  const buildPreviewRows = () => {
    return rows.map(row => {
      const rec = {};
      fields.forEach(f => {
        const srcCol = mapping[f.key];
        if (srcCol && row[srcCol] !== undefined) {
          let val = String(row[srcCol]).trim();
          // Normalize date values
          if (["dueDate","date","expiryDate","startDate","completionDate","issueDate"].includes(f.key)) {
            val = excelDateToStr(row[srcCol]) || val;
          }
          rec[f.key] = val;
        }
      });
      // Auto-fill project if only one option
      if (!rec.project && projects.length === 1) rec.project = pName(projects[0]);
      return rec;
    }).filter(r => fields.filter(f=>f.required).every(f => r[f.key]));
  };

  const previewRows = step >= 3 ? buildPreviewRows() : [];
  const skippedCount = rows.length - previewRows.length;

  const STEP_LABELS = ["Upload File", "Map Columns", "Review & Import"];

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{
        background: T.sidebar, border:`1px solid ${T.border}`, borderRadius:18,
        width:"100%", maxWidth:680, maxHeight:"calc(100vh - 48px)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>
                BULK UPLOAD — {subTab.toUpperCase()}
              </div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>
                Import multiple records from CSV or Excel
              </div>
            </div>
            <button onClick={onClose} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer"}}>×</button>
          </div>

          {/* Step indicator */}
          <div style={{display:"flex", alignItems:"center", gap:0, marginTop:16}}>
            {STEP_LABELS.map((label, i) => {
              const sNum = i + 1;
              const active = step === sNum;
              const done = step > sNum;
              return (
                <div key={i} style={{display:"flex", alignItems:"center", flex: i < 2 ? 1 : "none"}}>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <div style={{
                      width:28, height:28, borderRadius:"50%",
                      background: done ? color : active ? `${color}33` : T.bg,
                      border: `2px solid ${done||active ? color : T.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:800,
                      color: done ? "#000" : active ? color : T.textMuted,
                      flexShrink:0,
                    }}>
                      {done ? "✓" : sNum}
                    </div>
                    <span style={{fontSize:12, fontWeight:active?700:500, color:active?color:T.textMuted, whiteSpace:"nowrap"}}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{flex:1, height:2, background: done ? color : T.border, margin:"0 12px"}}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1, overflowY:"auto", padding:"20px 24px"}}>

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div>
              {/* Template download hint */}
              <div style={{background:T.blueDim, border:`1px solid ${T.blue}33`, borderRadius:12, padding:"14px 16px", marginBottom:20}}>
                <div style={{fontSize:13, fontWeight:700, color:T.blue, marginBottom:6}}>📋 Expected Columns</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {fields.map(f => (
                    <span key={f.key} style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:"3px 10px", fontSize:12, color:f.required ? color : T.textSub, fontWeight:f.required?700:400}}>
                      {f.label}{f.required?" *":""}
                    </span>
                  ))}
                </div>
                <div style={{fontSize:11, color:T.textMuted, marginTop:8}}>
                  * Required fields. Column names are auto-detected — fuzzy matching will map them automatically.
                </div>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border:`2px dashed ${color}44`, borderRadius:14,
                  padding:"48px 24px", textAlign:"center",
                  cursor:"pointer", transition:"all .2s",
                  background:`${color}08`,
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=`${color}14`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=`${color}44`;e.currentTarget.style.background=`${color}08`;}}
              >
                <div style={{fontSize:44, marginBottom:12}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:T.text, marginBottom:6}}>
                  Click to Select File
                </div>
                <div style={{fontSize:13, color:T.textMuted}}>Supports CSV and Excel (.xlsx, .xls)</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={handleFile}/>

              {error && (
                <div style={{marginTop:12, padding:"10px 14px", background:T.redDim, border:`1px solid ${T.red}44`, borderRadius:8, fontSize:13, color:T.red}}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Map Columns ── */}
          {step === 2 && (
            <div>
              <div style={{fontSize:13, color:T.textMuted, marginBottom:16}}>
                📄 <strong style={{color:T.text}}>{fileName}</strong> — {rows.length} rows detected. Map your spreadsheet columns to the correct fields.
              </div>

              <div style={{display:"grid", gap:10}}>
                {fields.map(f => (
                  <div key={f.key} style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`}}>
                    <div style={{width:180, flexShrink:0}}>
                      <div style={{fontSize:13, fontWeight:600, color:f.required?color:T.text}}>{f.label}</div>
                      <div style={{fontSize:11, color:T.textMuted, marginTop:2}}>App field</div>
                    </div>
                    <div style={{fontSize:16, color:T.border, flexShrink:0}}>→</div>
                    <select
                      value={mapping[f.key] || ""}
                      onChange={e => setMapping(m => ({...m, [f.key]: e.target.value || undefined}))}
                      style={{flex:1, background:T.inputBg, border:`1px solid ${mapping[f.key] ? color+"66" : T.border}`, borderRadius:8, padding:"8px 12px", fontSize:13, color:mapping[f.key]?T.text:T.textMuted, outline:"none", colorScheme:"light"}}
                    >
                      <option value="">— Skip this field —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[f.key] && (
                      <div style={{fontSize:11, color:T.green, flexShrink:0, fontWeight:700}}>✓ Mapped</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{marginTop:16, padding:"10px 14px", background:T.goldDim, border:`1px solid ${T.gold}33`, borderRadius:8, fontSize:12, color:T.gold}}>
                💡 Fields marked with * are required. Rows missing required fields will be skipped during import.
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div>
              <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:16}}>
                <div style={{background:T.greenDim, border:`1px solid ${T.green}33`, borderRadius:8, padding:"8px 14px"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, color:T.green}}>{previewRows.length}</span>
                  <span style={{fontSize:12, color:T.textMuted, marginLeft:6}}>ready to import</span>
                </div>
                {skippedCount > 0 && (
                  <div style={{background:T.redDim, border:`1px solid ${T.red}33`, borderRadius:8, padding:"8px 14px"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, color:T.red}}>{skippedCount}</span>
                    <span style={{fontSize:12, color:T.textMuted, marginLeft:6}}>skipped (missing required)</span>
                  </div>
                )}
              </div>

              {previewRows.length === 0 ? (
                <div style={{textAlign:"center", padding:"40px", color:T.red, fontSize:14}}>
                  ⚠ No valid rows to import. Go back and check your column mapping.
                </div>
              ) : (
                <div style={{display:"grid", gap:8}}>
                  {previewRows.slice(0, 20).map((row, i) => (
                    <div key={i} style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px"}}>
                      <div style={{fontWeight:700, fontSize:14, color:T.text, marginBottom:6}}>
                        {row.name || row.jobNo || `Row ${i+1}`}
                      </div>
                      <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                        {fields.filter(f=>f.key!=="name"&&row[f.key]).map(f => (
                          <span key={f.key} style={{background:T.card, border:`1px solid ${T.borderLight}`, borderRadius:5, padding:"2px 8px", fontSize:11, color:T.textSub}}>
                            {f.label.replace(" *","")}: <strong style={{color:T.text}}>{row[f.key]}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {previewRows.length > 20 && (
                    <div style={{textAlign:"center", fontSize:13, color:T.textMuted, padding:"10px"}}>
                      … and {previewRows.length - 20} more rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{padding:"14px 24px 22px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, flexShrink:0}}>
          {step > 1 && (
            <button onClick={()=>setStep(s=>s-1)} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"12px 20px", fontSize:14, fontWeight:600, cursor:"pointer"}}>
              ← Back
            </button>
          )}
          <button onClick={onClose} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"12px 20px", fontSize:14, fontWeight:600, cursor:"pointer"}}>
            Cancel
          </button>
          <div style={{flex:1}}/>
          {step === 1 && (
            <button onClick={()=>fileRef.current.click()} style={{background:color, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer"}}>
              Select File
            </button>
          )}
          {step === 2 && (
            <button onClick={()=>setStep(3)} style={{background:color, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer"}}>
              Preview Import →
            </button>
          )}
          {step === 3 && previewRows.length > 0 && (
            <button onClick={()=>onImport(previewRows)} style={{background:T.green, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:15, fontWeight:800, cursor:"pointer"}}>
              ✓ Import {previewRows.length} Records
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEW COMPONENT — ScorpionBulkModal (for Scorpion Documents bulk upload)
// ═══════════════════════════════════════════════════════════════════

function ScorpionBulkModal({ cats, onClose, onImport }) {
  const [rows, setRows]     = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep]     = useState(1);
  const [fileName, setFileName] = useState("");
  const [error, setError]   = useState("");
  const fileRef             = useRef();

  const fields = [
    {key:"name",       label:"Document Name *", required:true},
    {key:"category",   label:"Category"},
    {key:"docNo",      label:"Reference / Doc No."},
    {key:"issueDate",  label:"Issue Date"},
    {key:"expiryDate", label:"Expiry Date"},
    {key:"fileLink",   label:"File Link"},
    {key:"notes",      label:"Notes"},
  ];

  const autoMap = hdrs => {
    const m = {};
    fields.forEach(f => {
      const match = hdrs.find(h => {
        const hn = h.toLowerCase().replace(/[^a-z]/g,"");
        const fk = f.key.toLowerCase();
        return hn.includes(fk) || fk.includes(hn);
      });
      if (match) m[f.key] = match;
    });
    return m;
  };

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    if (ext === "csv") {
      reader.onload = ev => {
        try {
          const lines = ev.target.result.split(/\r?\n/).filter(l=>l.trim());
          const hdrs = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
          const data = lines.slice(1).filter(l=>l.trim()).map(line => {
            const vals = line.split(",");
            const row = {};
            hdrs.forEach((h,i)=>{ row[h]=(vals[i]||"").replace(/^"|"$/g,"").trim(); });
            return row;
          }).filter(r=>Object.values(r).some(v=>v));
          setHeaders(hdrs); setRows(data); setMapping(autoMap(hdrs)); setStep(2);
        } catch(err) { setError("Failed to parse CSV"); }
      };
      reader.readAsText(file);
    } else {
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result,{type:"array",cellDates:true});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws,{defval:""});
          const hdrs = Object.keys(rawRows[0]||{});
          setHeaders(hdrs); setRows(rawRows.filter(r=>Object.values(r).some(v=>v))); setMapping(autoMap(hdrs)); setStep(2);
        } catch(err) { setError("Failed to parse Excel"); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value="";
  };

  const buildPreview = () => rows.map(row => {
    const rec = {};
    fields.forEach(f => {
      const src = mapping[f.key];
      if (src && row[src] !== undefined) {
        let val = String(row[src]).trim();
        if (["issueDate","expiryDate"].includes(f.key)) val = excelDateToStr(row[src]) || val;
        rec[f.key] = val;
      }
    });
    return rec;
  }).filter(r => r.name);

  const previewRows = step === 3 ? buildPreview() : [];

  const STEP_LABELS = ["Upload File","Map Columns","Review & Import"];

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:640, maxHeight:"calc(100vh - 48px)", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>BULK UPLOAD — COMPANY DOCUMENTS</div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>Import multiple documents from CSV or Excel</div>
            </div>
            <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:0,marginTop:16}}>
            {STEP_LABELS.map((label,i)=>{
              const sNum=i+1; const active=step===sNum; const done=step>sNum;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",flex:i<2?1:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:done?T.blue:active?`${T.blue}33`:T.bg,border:`2px solid ${done||active?T.blue:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:done?"#000":active?T.blue:T.textMuted,flexShrink:0}}>
                      {done?"✓":sNum}
                    </div>
                    <span style={{fontSize:12,fontWeight:active?700:500,color:active?T.blue:T.textMuted,whiteSpace:"nowrap"}}>{label}</span>
                  </div>
                  {i<2&&<div style={{flex:1,height:2,background:done?T.blue:T.border,margin:"0 12px"}}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {step===1&&(
            <div>
              <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:T.blue,marginBottom:6}}>📋 Expected Columns</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {fields.map(f=>(
                    <span key={f.key} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 10px",fontSize:12,color:f.required?T.blue:T.textSub,fontWeight:f.required?700:400}}>{f.label}</span>
                  ))}
                </div>
              </div>
              <div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${T.blue}44`,borderRadius:14,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:`${T.blue}08`}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.background=`${T.blue}14`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=`${T.blue}44`;e.currentTarget.style.background=`${T.blue}08`;}}>
                <div style={{fontSize:44,marginBottom:12}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:T.text,marginBottom:6}}>Click to Select File</div>
                <div style={{fontSize:13,color:T.textMuted}}>Supports CSV and Excel (.xlsx, .xls)</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={handleFile}/>
              {error&&<div style={{marginTop:12,padding:"10px 14px",background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:8,fontSize:13,color:T.red}}>⚠ {error}</div>}
            </div>
          )}

          {step===2&&(
            <div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:16}}>
                📄 <strong style={{color:T.text}}>{fileName}</strong> — {rows.length} rows. Map columns to fields.
              </div>
              <div style={{display:"grid",gap:10}}>
                {fields.map(f=>(
                  <div key={f.key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.bg,borderRadius:10,border:`1px solid ${T.border}`}}>
                    <div style={{width:180,flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:f.required?T.blue:T.text}}>{f.label}</div>
                    </div>
                    <div style={{fontSize:16,color:T.border,flexShrink:0}}>→</div>
                    <select value={mapping[f.key]||""} onChange={e=>setMapping(m=>({...m,[f.key]:e.target.value||undefined}))}
                      style={{flex:1,background:T.inputBg,border:`1px solid ${mapping[f.key]?T.blue+"66":T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:mapping[f.key]?T.text:T.textMuted,outline:"none",colorScheme:"light"}}>
                      <option value="">— Skip —</option>
                      {headers.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[f.key]&&<div style={{fontSize:11,color:T.green,flexShrink:0,fontWeight:700}}>✓</div>}
                  </div>
                ))}
              </div>
              {/* Category preview */}
              <div style={{marginTop:14,padding:"10px 14px",background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:8,fontSize:12,color:T.gold}}>
                💡 Available categories: {cats.join(", ")}. If "Category" column doesn't match exactly, you can edit after import.
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:8,padding:"8px 14px"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.green}}>{previewRows.length}</span>
                  <span style={{fontSize:12,color:T.textMuted,marginLeft:6}}>ready to import</span>
                </div>
                {rows.length - previewRows.length > 0 && (
                  <div style={{background:T.redDim,border:`1px solid ${T.red}33`,borderRadius:8,padding:"8px 14px"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.red}}>{rows.length-previewRows.length}</span>
                    <span style={{fontSize:12,color:T.textMuted,marginLeft:6}}>skipped</span>
                  </div>
                )}
              </div>
              {previewRows.length===0
                ?<div style={{textAlign:"center",padding:"40px",color:T.red,fontSize:14}}>⚠ No valid rows. Check column mapping.</div>
                :<div style={{display:"grid",gap:8}}>
                  {previewRows.slice(0,15).map((row,i)=>(
                    <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:6}}>{row.name}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {row.category&&<span style={{background:`${T.blue}18`,borderRadius:5,padding:"2px 8px",fontSize:11,color:T.blue,fontWeight:700}}>{row.category}</span>}
                        {row.docNo&&<Chip>Ref: {row.docNo}</Chip>}
                        {row.issueDate&&<Chip>Issued: {row.issueDate}</Chip>}
                        {row.expiryDate&&<Chip>Expires: {row.expiryDate}</Chip>}
                      </div>
                    </div>
                  ))}
                  {previewRows.length>15&&<div style={{textAlign:"center",fontSize:13,color:T.textMuted,padding:"10px"}}>… and {previewRows.length-15} more</div>}
                </div>
              }
            </div>
          )}
        </div>

        <div style={{padding:"14px 24px 22px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,flexShrink:0}}>
          {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>← Back</button>}
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <div style={{flex:1}}/>
          {step===1&&<button onClick={()=>fileRef.current.click()} style={{background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Select File</button>}
          {step===2&&<button onClick={()=>setStep(3)} style={{background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Preview →</button>}
          {step===3&&previewRows.length>0&&<button onClick={()=>onImport(previewRows)} style={{background:T.green,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:15,fontWeight:800,cursor:"pointer"}}>✓ Import {previewRows.length} Documents</button>}
        </div>
      </div>
    </Overlay>
  );
}
function MultiPdfCertUpload({ project, projects, onClose, onImport }) {
  const [files,       setFiles]       = useState([]); // [{file, name, jobNo, refNo, amount, startDate, completionDate, notes, status}]
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState({}); // {filename: "pending"|"uploading"|"done"|"error"}
  const [selProj,     setSelProj]     = useState(project || "");
  const [globalJobNo, setGlobalJobNo] = useState("");
  const dropRef                       = useRef();
  const fileInputRef                  = useRef();

  const STATUS_COLOR = {
    pending:   T.textMuted,
    uploading: T.blue,
    done:      T.green,
    error:     T.red,
  };
  const STATUS_ICON = {
    pending:   "⏳",
    uploading: "↑",
    done:      "✓",
    error:     "✕",
  };

  // Derive a clean display name from filename
  const cleanName = filename => {
    return filename
      .replace(/\.[^.]+$/, "")           // remove extension
      .replace(/[_-]+/g, " ")            // underscores/dashes → spaces
      .replace(/\b\w/g, c => c.toUpperCase()); // title case
  };

  const addFiles = newFiles => {
    const pdfs = Array.from(newFiles).filter(f =>
      /\.(pdf|png|jpg|jpeg|webp|doc|docx)$/i.test(f.name)
    );
    if (!pdfs.length) return;
    const entries = pdfs.map(f => ({
      id:              uid(),
      file:            f,
      displayName:     cleanName(f.name),
      jobNo:           "",
      refNo:           "",
      amount:          "",
      startDate:       "",
      completionDate:  "",
      notes:           "",
    }));
    setFiles(prev => [...prev, ...entries]);
    setProgress(prev => {
      const next = {...prev};
      entries.forEach(e => { next[e.id] = "pending"; });
      return next;
    });
  };

  const removeFile = id => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setProgress(prev => { const n={...prev}; delete n[id]; return n; });
  };

  const updateField = (id, key, val) => {
    setFiles(prev => prev.map(f => f.id === id ? {...f, [key]: val} : f));
  };

  // Drag & drop
  const onDragOver  = e => { e.preventDefault(); dropRef.current.style.borderColor = T.blue; };
  const onDragLeave = e => { dropRef.current.style.borderColor = `${T.blue}44`; };
  const onDrop      = e => {
    e.preventDefault();
    dropRef.current.style.borderColor = `${T.blue}44`;
    addFiles(e.dataTransfer.files);
  };

  const handleUploadAll = async () => {
    if (!selProj) { alert("Please select a project first."); return; }
    if (!files.length) { alert("No files selected."); return; }
    setUploading(true);

    const results = [];

    for (const entry of files) {
      setProgress(prev => ({...prev, [entry.id]: "uploading"}));
      try {
        const url = await uploadToSupabase(entry.file, `certificates/${selProj.replace(/\s+/g,"_")}`);
        setProgress(prev => ({...prev, [entry.id]: "done"}));
        results.push({
          project:        selProj,
          jobNo:          entry.jobNo || globalJobNo || "",
          refNo:          entry.refNo || "",
          amount:         entry.amount || "",
          startDate:      entry.startDate || "",
          completionDate: entry.completionDate || "",
          notes:          entry.notes || "",
          fileLink:       url,
          // name used for display (not a required field in CertificateModal)
          _fileName:      entry.displayName,
        });
      } catch (err) {
        setProgress(prev => ({...prev, [entry.id]: "error"}));
        console.error("Upload failed for", entry.file.name, err);
      }
    }

    setUploading(false);

    if (results.length) {
      onImport(results);
    } else {
      alert("All uploads failed. Check your Supabase configuration.");
    }
  };

  const doneCount    = Object.values(progress).filter(s => s === "done").length;
  const errorCount   = Object.values(progress).filter(s => s === "error").length;
  const pendingCount = Object.values(progress).filter(s => s === "pending").length;
  const allDone      = uploading && doneCount + errorCount === files.length && files.length > 0;

  return (
    <Overlay onClose={onClose}>
      <div
        className="slide-up"
        style={{
          background:     T.sidebar,
          border:         `1px solid ${T.border}`,
          borderRadius:   18,
          width:          "100%",
          maxWidth:       680,
          maxHeight:      "calc(100vh - 48px)",
          display:        "flex",
          flexDirection:  "column",
          overflow:       "hidden",
          boxShadow:      "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── Header ── */}
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>
                UPLOAD JOB COMPLETION CERTIFICATES
              </div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>
                Select multiple PDFs — one certificate record will be created per file
              </div>
            </div>
            <button
              onClick={onClose}
              style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer"}}
            >×</button>
          </div>

          {/* Project selector */}
          <div style={{marginTop:14, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
            <div style={{flex:1, minWidth:200}}>
              <label style={{display:"block", fontSize:11, fontWeight:700, color:T.textMuted, marginBottom:5, letterSpacing:".5px"}}>PROJECT *</label>
              <select
                value={selectedProject}
                onChange={e => setSelProj(e.target.value)}
                style={{width:"100%", background:T.inputBg, border:`1px solid ${selProj ? T.blue+"66" : T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:selProj ? T.text : T.textMuted, outline:"none", colorScheme:"light"}}
              >
                <option value="">Select project…</option>
                {renderProjectOptions(projects)}
              </select>
            </div>
            <div style={{flex:1, minWidth:160}}>
              <label style={{display:"block", fontSize:11, fontWeight:700, color:T.textMuted, marginBottom:5, letterSpacing:".5px"}}>JOB NO. (apply to all)</label>
              <input
                value={globalJobNo}
                onChange={e => setGlobalJobNo(e.target.value)}
                placeholder="e.g. JOB-2025-001"
                style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:T.text, outline:"none", colorScheme:"light"}}
                onFocus={e=>e.target.style.borderColor=T.blue}
                onBlur={e=>e.target.style.borderColor=T.border}
              />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{flex:1, overflowY:"auto", padding:"16px 24px"}}>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onClick={() => !uploading && fileInputRef.current.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={!uploading ? onDrop : undefined}
            style={{
              border:        `2px dashed ${T.blue}44`,
              borderRadius:  12,
              padding:       files.length ? "16px" : "36px 24px",
              textAlign:     "center",
              cursor:        uploading ? "not-allowed" : "pointer",
              transition:    "all .2s",
              background:    `${T.blue}06`,
              marginBottom:  14,
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor=T.blue; e.currentTarget.style.background=`${T.blue}12`; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${T.blue}44`; e.currentTarget.style.background=`${T.blue}06`; }}
          >
            {files.length === 0 ? (
              <>
                <div style={{fontSize:40, marginBottom:8}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color:T.text, marginBottom:4}}>
                  Drag & drop PDFs here, or click to browse
                </div>
                <div style={{fontSize:12, color:T.textMuted}}>
                  PDF, Word, PNG, JPG — select as many as you need
                </div>
              </>
            ) : (
              <div style={{fontSize:13, color:T.blue, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                <span>+</span> Click or drop more files to add ({files.length} selected)
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            style={{display:"none"}}
            onChange={e => { addFiles(e.target.files); e.target.value=""; }}
          />

          {/* Progress summary bar — shown during upload */}
          {uploading && (
            <div style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:14}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                <span style={{fontSize:13, fontWeight:700, color:T.text}}>Uploading…</span>
                <span style={{fontSize:13, color:T.textMuted}}>{doneCount + errorCount} / {files.length}</span>
              </div>
              <div style={{height:6, background:T.border, borderRadius:999, overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  width: `${files.length ? ((doneCount + errorCount) / files.length * 100) : 0}%`,
                  background: `linear-gradient(90deg, ${T.green}, ${T.blue})`,
                  borderRadius:999,
                  transition:"width .3s ease",
                }}/>
              </div>
              <div style={{display:"flex", gap:14, marginTop:8, fontSize:12}}>
                <span style={{color:T.green}}>✓ {doneCount} done</span>
                {errorCount > 0 && <span style={{color:T.red}}>✕ {errorCount} failed</span>}
                <span style={{color:T.textMuted}}>{pendingCount} remaining</span>
              </div>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div style={{display:"grid", gap:10}}>
              {files.map((entry, i) => {
                const st = progress[entry.id] || "pending";
                const stColor = STATUS_COLOR[st];
                const stIcon  = STATUS_ICON[st];
                const isExpanded = st === "pending" || st === "error";

                return (
                  <div
                    key={entry.id}
                    className="fade-up"
                    style={{
                      background:   T.bg,
                      border:       `1px solid ${st==="done" ? T.green+"44" : st==="error" ? T.red+"44" : T.border}`,
                      borderLeft:   `4px solid ${stColor}`,
                      borderRadius: 10,
                      padding:      "12px 14px",
                      animationDelay: `${i * 0.03}s`,
                    }}
                  >
                    {/* File header row */}
                    <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: isExpanded ? 10 : 0}}>
                      <span style={{fontSize:18, flexShrink:0}}>
                        {/\.pdf$/i.test(entry.file.name) ? "📄" : /\.(png|jpg|jpeg|webp)$/i.test(entry.file.name) ? "🖼️" : "📝"}
                      </span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                          {entry.displayName}
                        </div>
                        <div style={{fontSize:11, color:T.textMuted, marginTop:1}}>
                          {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      {/* Status badge */}
                      <div style={{background:`${stColor}18`, border:`1px solid ${stColor}44`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, color:stColor, flexShrink:0, display:"flex", alignItems:"center", gap:5}}>
                        <span>{stIcon}</span>
                        <span style={{textTransform:"capitalize"}}>{st}</span>
                      </div>
                      {/* Remove button — only if not uploading */}
                      {!uploading && (
                        <button
                          onClick={() => removeFile(entry.id)}
                          style={{background:T.redDim, border:`1px solid ${T.red}33`, color:T.red, borderRadius:6, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, cursor:"pointer", flexShrink:0}}
                        >✕</button>
                      )}
                    </div>

                    {/* Editable detail fields — shown when pending */}
                    {isExpanded && !uploading && (
                      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, paddingTop:8, borderTop:`1px solid ${T.border}`}}>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>JOB NO.</label>
                          <input
                            value={entry.jobNo}
                            onChange={e => updateField(entry.id, "jobNo", e.target.value)}
                            placeholder={globalJobNo || "JOB-001"}
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>CERT / REF NO.</label>
                          <input
                            value={entry.refNo}
                            onChange={e => updateField(entry.id, "refNo", e.target.value)}
                            placeholder="e.g. CERT-2025-01"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>AMOUNT (SAR)</label>
                          <input
                            type="number"
                            value={entry.amount}
                            onChange={e => updateField(entry.id, "amount", e.target.value)}
                            placeholder="0"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>COMPLETION DATE</label>
                          <input
                            type="date"
                            value={entry.completionDate}
                            onChange={e => updateField(entry.id, "completionDate", e.target.value)}
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div style={{gridColumn:"1 / -1"}}>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>NOTES</label>
                          <input
                            value={entry.notes}
                            onChange={e => updateField(entry.id, "notes", e.target.value)}
                            placeholder="Optional notes…"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                      </div>
                    )}

                    {/* Uploaded URL preview */}
                    {st === "done" && (
                      <div style={{marginTop:6, fontSize:11, color:T.green, display:"flex", alignItems:"center", gap:6}}>
                        <span>✓ Uploaded successfully</span>
                      </div>
                    )}
                    {st === "error" && (
                      <div style={{marginTop:6, fontSize:11, color:T.red}}>
                        ✕ Upload failed — check Supabase config or file size
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{padding:"14px 24px 22px", borderTop:`1px solid ${T.border}`, flexShrink:0, display:"flex", gap:10, alignItems:"center"}}>
          <div style={{flex:1, fontSize:12, color:T.textMuted}}>
            {files.length > 0
              ? `${files.length} file${files.length!==1?"s":""} selected — each becomes one certificate record`
              : "No files selected yet"}
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"11px 20px", fontSize:14, fontWeight:600, cursor:uploading?"not-allowed":"pointer", opacity:uploading?0.5:1}}
          >
            {allDone ? "Close" : "Cancel"}
          </button>
          {!uploading && files.length > 0 && (
            <button
              onClick={handleUploadAll}
              style={{
                background:   `linear-gradient(135deg, ${T.blue}, #2563eb)`,
                border:       "none",
                color:        "#fff",
                borderRadius: 10,
                padding:      "11px 28px",
                fontSize:     14,
                fontWeight:   800,
                cursor:       "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                boxShadow:    `0 4px 16px ${T.blue}44`,
              }}
            >
              ⬆ Upload {files.length} File{files.length!==1?"s":""}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
const Btn      = ({children,onClick,color,solid}) => <button onClick={onClick} style={{background:solid?color:T.bg,border:`1px solid ${solid?color:T.border}`,color:solid?"#000":color||T.textSub,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,transition:"all .15s"}}>{children}</button>;
