import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "./theme.js";


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

  /* ── Phone-specific fixes ── */
  @media (max-width:600px) {
    /* Prevent horizontal scroll */
    html, body { overflow-x: hidden; }

    /* Stack 2-col grids to 1 col */
    .grid-2col { grid-template-columns: 1fr !important; }

    /* Tighter card padding on phones */
    .app-card { border-radius: 10px !important; }

    /* Modal full-width on phones */
    .slide-up { border-radius: 16px 16px 0 0 !important; }

    /* Top bar: reduce header height slightly */
    header { padding: 0 12px !important; }

    /* Shrink the top-bar action buttons on very small screens */
    .topbar-actions button { padding: 5px 7px !important; font-size: 13px !important; }

    /* Make toast full-width on mobile */
    .toast-fixed { right: 12px !important; left: 12px !important; bottom: 16px !important; }
  }

  /* Prevent modal overflow on all small screens */
  @media (max-width:768px) {
    .mobile-modal-pad { padding-left: 16px !important; padding-right: 16px !important; }
    /* Fix grid-map-columns that are fixed-width on mobile */
    .resp-grid-2 { grid-template-columns: 1fr !important; }
    .resp-grid-3 { grid-template-columns: 1fr !important; }
    .resp-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
  }

  /* Export button pulse */
  @keyframes exportPulse { 0%,100%{opacity:1;}50%{opacity:0.6;} }
`;

/* ─── Theme ──────────────────────────────────────────────────────────────── */
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

export {
  GLOBAL_CSS, uid, daysUntil, fmtDate, formatSarCompact,
  getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme,
  useViewport, printPage,
};
