import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "./theme.js";
import { uid, daysUntil, fmtDate, printPage } from "./utils.js";

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
  // ── Identity ──────────────────────────────────────────────────────────────
  "ID":"idNo","EMPLOYEE ID":"idNo","EMP ID":"idNo","STAFF ID":"idNo",
  "NAME":"name","EMPLOYEE NAME":"name","EMPLOYEE":"name",

  // ── Personal info ─────────────────────────────────────────────────────────
  "POSITION":"position","JOB TITLE":"position","DESIGNATION":"position",
  "NATIONALITY":"nationality","CITIZENSHIP":"nationality",

  // ── Iqama / Residence ID ──────────────────────────────────────────────────
  "NATIONAL / IQAMA ID":"iqamaNo","IQAMA ID":"iqamaNo","IQAMA NO":"iqamaNo",
  "NATIONAL ID":"iqamaNo","ID NO":"iqamaNo","RESIDENCE ID":"iqamaNo",

  // ── Iqama Expiry ──────────────────────────────────────────────────────────
  "ID EXP. DATE":"iqamaExpiry","IQAMA EXPIRY":"iqamaExpiry","ID EXPIRY":"iqamaExpiry",
  "IQAMA EXP DATE":"iqamaExpiry","RESIDENCE EXPIRY":"iqamaExpiry",

  // ── Passport ──────────────────────────────────────────────────────────────
  "PASSPORT NO.":"passportNo","PASSPORT NO":"passportNo","PASSPORT NUMBER":"passportNo",
  "PP NO":"passportNo",

  // ── Passport Expiry ───────────────────────────────────────────────────────
  "PASSPORT EXP. DATE":"passportExpiry","PASSPORT EXPIRY DATE":"passportExpiry",
  "PASSPORT EXPIRY":"passportExpiry","PASSPORT EXP DATE":"passportExpiry",

  // ── Sponsor ───────────────────────────────────────────────────────────────
  "SPONSOR NAME":"sponsor","SPONSOR":"sponsor","SPONSER":"sponsor","KAFEEL":"sponsor",

  // ── Certification ─────────────────────────────────────────────────────────
  "CERTIFICATE":"certName","CERTIFICATION":"certName","CERT TYPE":"certName",
  "ISSUED BY":"issuedBy","ISSUING BODY":"issuedBy","ISSUING AUTHORITY":"issuedBy",
  "CERT ISSUE DATE":"issueDate","ISSUE DATE":"issueDate","DATE ISSUED":"issueDate",
  "CERT EXPIRY DATE":"expiryDate","EXPIRY DATE":"expiryDate","EXPIRY":"expiryDate",
};

// Your Excel has headers on ROW 1 (not row 4)
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
    const defaults = { enabled: false, responsiblePersons: [], managers: [], managingDirector: [], ceo: [], maintEmails: [] };
    if (!s) return defaults;
    const p = JSON.parse(s);
    // migrate legacy flat emails list → responsiblePersons
    if (!p.responsiblePersons) p.responsiblePersons = p.emails || (p.email ? [p.email] : []);
    if (!p.managers)           p.managers = [];
    if (!p.managingDirector)   p.managingDirector = [];
    if (!p.ceo)                p.ceo = [];
    if (!p.maintEmails)        p.maintEmails = [];
    return { ...defaults, ...p };
  } catch { return { enabled: false, responsiblePersons: [], managers: [], managingDirector: [], ceo: [], maintEmails: [] }; }
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
const ADMIN_PASSWORD    = "admin2025";  // Only admin can delete — change this
const ADMIN_KEY         = "cta_admin";

/* ─── Cloudflare Worker config ──────────────────────────────────────────── */
/* ── Cloudflare Worker URLs ───────────────────────────────────────────────
   CF_WORKER_URL  → your KV data Worker  (load/save app state)
   R2_WORKER_URL  → your R2 upload Worker (file uploads)
   Both point to the same Worker if you combined them.
──────────────────────────────────────────────────────────────────────── */
const CF_WORKER_URL = "https://bucket.syed-itrath.workers.dev";

async function fetchAppData() {
  const res = await fetch(`${CF_WORKER_URL}/data`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load app data");
  const json = await res.json();
  // Worker returns { data: {...} } or the data object directly
  const payload = json.data ?? json;
  if (!payload || typeof payload !== "object") return EMPTY_DATA;
  return { ...EMPTY_DATA, ...payload };
}
/* ── Cloudflare R2 upload via Worker ─────────────────────────────────────
   Set R2_WORKER_URL to your deployed Worker URL, e.g.:
   "https://scorpion-upload.YOUR-SUBDOMAIN.workers.dev"
──────────────────────────────────────────────────────────────────────── */
const R2_WORKER_URL = "https://bucket.syed-itrath.workers.dev";

async function uploadFile(file, folder) {
  if (R2_WORKER_URL === "YOUR_WORKER_URL") {
    throw new Error("R2 Worker URL not configured. Set R2_WORKER_URL in App.jsx.");
  }
  const safeFolder = folder.replace(/[^a-zA-Z0-9._\-/]/g, "_");
  const safeFile   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key        = `${safeFolder}/${Date.now()}_${safeFile}`;

  const res = await fetch(`${R2_WORKER_URL}/upload/${key}`, {
    method:  "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body:    file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "R2 upload failed");
  }

  const { url } = await res.json();
  return url;
}
async function saveAppData(data) {
  const res = await fetch(`${CF_WORKER_URL}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error("Failed to save app data");
}
function isCloudflareConfigured() {
  return CF_WORKER_URL !== "YOUR_WORKER_URL";
}
function isR2Configured() {
  return CF_WORKER_URL !== "YOUR_WORKER_URL";
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
  // Cloudflare R2 public URL — direct embed
  // Cloudflare R2 public URL — direct embed
  if (url.includes(".r2.dev") || url.includes("workers.dev")) return url;
  return url;
}

function isAuthenticated() {
  try { return sessionStorage.getItem(AUTH_KEY) === "true"; } catch { return false; }
}

const EMPTY_DATA = {
  scorpionDocs: [],
  manpowerCats: DEFAULT_MANPOWER_CATS,
  manpower: [],
  equipment: [],
  scorpionDocCats: DEFAULT_SCORPION_CATS,
  projects: [
    {name:"BIN QURAYA",client:""},
    {name:"NESMA",client:""},
    {name:"DENYS DAMMAM PHASE 2",client:""},
    {name:"DENYS KHURSANIYAH",client:""},
    {name:"DENYS JAFURAH",client:""},
    {name:"MACE",client:""},
    {name:"MCCL",client:""},
    {name:"KALPATARU",client:""},
    {name:"WIDE HORIZON",client:""},
    {name:"AYTB",client:""},
    {name:"KENTZ",client:""},
    {name:"AL BAWANI",client:""},
    {name:"ABIS",client:""},
  ],
  projectDocs: [],
  projectAnalysis: [],
  rigs: [],          // { id, project, name }
  costControl: [],  // { id, project, category, description, amount, date, refNo, notes, budgeted }
                    // category: "Labour"|"Equipment"|"Materials"|"Subcontractor"|"Overhead"|"Other"
  costSheets:  [],  // { id, project, description, estimatedCost, actualCost, date, notes }
  quotations:  [],  // { id, project, quotationNo, clientName, date, validUntil, items:[], status, notes }
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

export {
  getStatus,
  DEFAULT_SCORPION_CATS, DEFAULT_MANPOWER_CATS,
  MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW,
  excelDateToStr, parseExcelRows, parseExcelWithHeaderRow,
  EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_MAINT_TEMPLATE_ID, EMAILJS_PUBLIC_KEY,
  NOTIFY_STORAGE_KEY, NOTIFY_LAST_SENT_KEY,
  loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail,
  COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY,
  isAuthenticated, EMPTY_DATA,
};
