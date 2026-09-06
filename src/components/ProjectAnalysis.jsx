import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, excelDateToStr, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl, isCloudflareConfigured } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, FInput, FTextarea, FSelect, PageHeader, Empty, daysLeft, pctColor, deriveProjectStats } from "./UI.jsx";
import { RiskAlertsBar, ProjectAnalysisProNav, AnalyticsTab, TimelineTab, BudgetTab, ReportsTab, computeRiskInsights, costSheetsByProject } from "./ProjectAnalysisPro.jsx";

/* Flexible column-header mapping for generic/legacy daily report Excel files
   (non-Scorpion-template). Header text is upper-cased before matching. */
const DR_COL_MAP = {
  "PROJECT": "project", "PROJECT NAME": "project",
  "RIG": "rig", "RIG / SPREAD": "rig", "RIG/SPREAD": "rig", "SPREAD": "rig",
  "CROSSING": "crossing",
  "DATE": "date", "REPORT DATE": "date",
  "PROFILE": "profile", "WORK PROFILE": "profile",
  "ACTIVITY": "activity",
  "PERMIT RECEIVED": "permitReceived", "PERMIT": "permitReceived",
  "PERMIT HOURS": "permitHours", "PERMIT HRS": "permitHours",
  "STANDBY REASON": "standbyReason", "STANDBY": "standbyReason",
  "PROGRESS TODAY": "progressToday", "PROGRESS TODAY (M)": "progressToday", "PROGRESS (M)": "progressToday",
  "ACCUMULATED": "accumulated", "ACCUMULATED (M)": "accumulated",
  "ACTIVITY SUMMARY": "activities", "ACTIVITIES": "activities",
  "NOTES": "notes", "REMARKS": "notes",
};

/* Builds a styled .xlsx file from an array of plain row objects and triggers download */
function exportToExcel(rows, filename) {
  if (!rows || !rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  headers.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "B8860B" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "8B6914" } }, bottom: { style: "thin", color: { rgb: "8B6914" } },
        left: { style: "thin", color: { rgb: "8B6914" } }, right: { style: "thin", color: { rgb: "8B6914" } },
      },
    };
  });
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = {
        font: { sz: 10, color: { rgb: "1A0A00" } },
        fill: { fgColor: { rgb: r % 2 === 0 ? "FDF8F0" : "FFFFFF" } },
        alignment: { vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "E8D5B7" } }, bottom: { style: "thin", color: { rgb: "E8D5B7" } },
          left: { style: "thin", color: { rgb: "E8D5B7" } }, right: { style: "thin", color: { rgb: "E8D5B7" } },
        },
      };
    }
  }
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(h.length, ...rows.map((row) => String(row[h] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, `${filename}.xlsx`);
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
    rig:            rd("G6"),
    date:           date,
    profile:        get("profile",       "C13"),
    activity:       get("activity",      "H13"),
    permitStartTime: rd("C11"),
    permitEndTime:   rd("H11"),
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

function BulkDailyReportImport({ projectName, onImport }) {
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setMsg("");
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseDailyReportExcel(buffer);
      if (!rows.length) {
        setMsg("No rows found in this file.");
      } else {
        const withProject = rows.map(r => ({ ...r, id: r.id || uid(), project: r.project || projectName }));
        onImport(withProject);
        setMsg(`✓ Imported ${rows.length} report${rows.length !== 1 ? "s" : ""}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("Could not read this file.");
    }
    setImporting(false);
  };

  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
      <button
        type="button"
        onClick={()=>fileRef.current.click()}
        disabled={importing}
        style={{background:T.purpleDim,border:`1px solid ${T.purple}44`,color:T.purple,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:importing?"not-allowed":"pointer"}}
      >
        {importing ? "Importing…" : "📥 Bulk Import"}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}}
        onChange={e=>{ if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value=""; }}/>
      {msg && <span style={{fontSize:11,color:msg.startsWith("✓")?T.green:T.red}}>{msg}</span>}
    </div>
  );
}

function DailyReportModal({ report, projectName, rigs, onSave, onClose }) {
  const blank = { id: uid(), date: new Date().toISOString().slice(0,10), rig:"", weather:"", activities:"", manpower:"", equipment:"", issues:"", notes:"", fileLink:"", fileName:"" };
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

  /* Upload daily report file (PDF/image/doc) to Cloudflare R2 */
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true); setUploadErr("");
    try {
      const folder = `daily-reports/${(projectName||"general").replace(/[^a-zA-Z0-9]/g,"_")}`;
      const url = await uploadFile(file, folder);
      upd("fileLink", url);
      upd("fileName", file.name);
    } catch(err) {
      setUploadErr("Upload failed: " + (err.message || "check Cloudflare Worker config"));
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
          {rigs && rigs.length > 0 && (
            <div>
              <label style={LS}>RIG / SPREAD *</label>
              <select value={f.rig||""} onChange={e=>upd("rig",e.target.value)}
                style={{...IS,colorScheme:"light"}} onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=T.border}>
                <option value="">Select rig…</option>
                {rigs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          )}
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
   Collates daily reports from ALL projects/rigs into one master Excel export.
   Reports are organised by Project → Rig. Each rig gets its own sheet.
   Also lets the user drop multiple DPR Excel files directly to parse them.
════════════════════════════════════════════════════════════════════════════ */
/* ─── Day classification & analysis helpers ──────────────────────────────
   Classifies each daily report into exactly one operational bucket, and
   computes hours-worked utilization for a set of reports. */

const DAY_CATEGORIES = [
  { key: "preparation", label: "Preparation / Set-up",     color: "#38bdf8" },
  { key: "mobilization", label: "Mobilization",            color: "#a78bfa" },
  { key: "pilot",        label: "Pilot",                   color: "#2dd4bf" },
  { key: "reaming",      label: "Reaming",                 color: "#fbbf24" },
  { key: "cleanpass",    label: "Clean Pass",              color: "#f472b6" },
  { key: "pullpipe",     label: "Pull Pipe",               color: "#fb923c" },
  { key: "standby",      label: "Standby",                 color: "#f87171" },
  { key: "other",        label: "Other / Unclassified",    color: "#9ca3af" },
];

// The 6 "plannable" categories that get budget estimates entered against
// them (Standby and Other are operational realities, not planned work).
const ESTIMATABLE_CATEGORIES = DAY_CATEGORIES.filter(c => !["standby","other"].includes(c.key));

// Standby (no permit) always takes priority over whatever activity was logged,
// since a day with no permit received is a standby day regardless of what
// activity text a supervisor may have typed.
function classifyDay(r) {
  const permit = (r.permitReceived || "").trim().toLowerCase();
  if (permit === "no") return "standby";
  const act = (r.activity || "").trim().toLowerCase();
  if (act === "preparation") return "preparation";
  if (act === "mob" || act === "demob") return "mobilization";
  if (act === "pilot") return "pilot";
  if (act === "reaming") return "reaming";
  if (act === "clean pass") return "cleanpass";
  if (act === "pull pipe") return "pullpipe";
  return "other";
}

// A record is "flagged" (data-quality issue) when permit was NOT received
// (standby day) but permit hours were still logged as worked — these need
// manual review/correction before they're trusted in analysis.
function isFlaggedRow(r) {
  const permit = (r.permitReceived || "").trim().toLowerCase();
  const hrs = parseFloat(r.permitHours);
  return permit === "no" && !isNaN(hrs) && hrs > 0;
}

const ANALYSIS_HOURS_PER_DAY = 10;
const ANALYSIS_OFF_DAY = 5; // Date.getDay(): 5 = Friday, excluded from capacity

function computeGroupStats(reports) {
  const counts = Object.fromEntries(DAY_CATEGORIES.map(c => [c.key, 0]));
  let workedHours = 0;
  reports.forEach(r => {
    counts[classifyDay(r)]++;
    const h = parseFloat(r.permitHours);
    if (!isNaN(h)) workedHours += h;
  });
  const dates = reports.map(r => r.date).filter(Boolean).sort();
  let capacityHours = 0;
  if (dates.length) {
    const start = new Date(dates[0]), end = new Date(dates[dates.length - 1]);
    let workingDays = 0;
    const cur = new Date(start);
    while (cur <= end) { if (cur.getDay() !== ANALYSIS_OFF_DAY) workingDays++; cur.setDate(cur.getDate() + 1); }
    capacityHours = workingDays * ANALYSIS_HOURS_PER_DAY;
  }
  const utilization = capacityHours > 0 ? Math.round((workedHours / capacityHours) * 100) : 0;
  return {
    counts,
    totalDays: reports.length,
    workedHours,
    capacityHours,
    utilization,
    flaggedCount: reports.filter(isFlaggedRow).length,
  };
}

/* ─── Activity donut chart: animated, hoverable breakdown of days by category ── */
function ActivityDonutChart({ counts, totalDays, size=176, strokeWidth=24 }) {
  const [hovered, setHovered] = useState(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(()=>setAnimated(true), 60); return ()=>clearTimeout(t); }, []);

  const r = (size - strokeWidth) / 2;
  const cx = size/2, cy = size/2;
  const circumference = 2 * Math.PI * r;

  const segments = DAY_CATEGORIES.map(c => ({ ...c, value: counts[c.key]||0 })).filter(s => s.value > 0);
  let cumulative = 0;
  const arcs = segments.map(s => {
    const pct = totalDays>0 ? s.value/totalDays : 0;
    const len = pct * circumference;
    const arc = { ...s, pct, offset: cumulative };
    cumulative += len;
    return arc;
  });

  if (!totalDays) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:size,height:size,color:T.textMuted,fontSize:12}}>No data</div>
  );

  const hoveredArc = hovered ? arcs.find(a=>a.key===hovered) : null;

  return (
    <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
      <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
        <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={strokeWidth}/>
          {arcs.map((a,i) => {
            const len = a.pct * circumference;
            return (
              <circle
                key={a.key}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={a.color}
                strokeWidth={hovered===a.key ? strokeWidth+5 : strokeWidth}
                strokeLinecap="butt"
                strokeDasharray={animated ? `${len} ${circumference-len}` : `0 ${circumference}`}
                strokeDashoffset={-a.offset}
                style={{transition:`stroke-dasharray .9s cubic-bezier(.22,1,.36,1) ${i*0.07}s, stroke-width .18s, opacity .18s`, cursor:"pointer", opacity: hovered && hovered!==a.key ? 0.35 : 1}}
                onMouseEnter={()=>setHovered(a.key)}
                onMouseLeave={()=>setHovered(null)}
              >
                <title>{`${a.label}: ${a.value} day${a.value!==1?"s":""} (${Math.round(a.pct*100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none",textAlign:"center"}}>
          {hoveredArc ? (
            <>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:hoveredArc.color,lineHeight:1}}>{hoveredArc.value}</div>
              <div style={{fontSize:9.5,color:T.textSub,fontWeight:700,marginTop:4,maxWidth:size*0.62,lineHeight:1.2}}>{hoveredArc.label}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{Math.round(hoveredArc.pct*100)}%</div>
            </>
          ) : (
            <>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text,lineHeight:1}}>{totalDays}</div>
              <div style={{fontSize:9.5,color:T.textMuted,fontWeight:700,marginTop:4,letterSpacing:".5px"}}>TOTAL DAYS</div>
            </>
          )}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:150}}>
        {arcs.map(a => (
          <div key={a.key}
            onMouseEnter={()=>setHovered(a.key)}
            onMouseLeave={()=>setHovered(null)}
            style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 7px",borderRadius:7,background:hovered===a.key?`${a.color}18`:"transparent",transition:"background .15s"}}>
            <span style={{width:10,height:10,borderRadius:3,background:a.color,flexShrink:0}}/>
            <span style={{fontSize:12,color:T.textSub,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.label}</span>
            <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto",flexShrink:0,fontWeight:600}}>{a.value}d · {Math.round(a.pct*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DprConsolidateModal({ projectAnalysis, projectDocs, rigs, crossings, setData, showToast, onClose }) {
  const [dropping, setDropping]         = useState(false);
  const [ingestStatus, setIngestStatus] = useState([]); // [{name, ok, rec}]
  const [ingesting, setIngesting]       = useState(false);
  const [filterProj, setFilterProj]     = useState("");
  const [filterRig,  setFilterRig]      = useState("");
  const [viewMode, setViewMode]         = useState("data"); // "data" | "analysis"
  const fileRef = useRef();

  // Saved daily reports come from projectDocs (subTab=dailyreports) — enriched with rig
  const savedRows = (projectDocs || [])
    .filter(d => d.subTab === "dailyreports" && !d._deleted)
    .map(r => ({ ...r, _project: r.project || "Unassigned", _rig: r.rig || "Unassigned", _crossing: r.crossing || "", _source: "saved" }));

  // Legacy: only pull from projectAnalysis.dailyReports for records that DON'T
  // already exist in projectDocs — every current save mirrors into both places,
  // so without this exclusion nearly every report would be duplicated in exports.
  const savedIds = new Set(savedRows.map(r => r.id));
  const legacyRows = (projectAnalysis || []).flatMap(pa =>
    (pa.dailyReports || [])
      .filter(r => !savedIds.has(r.id))
      .map(r => ({ ...r, _project: pa.project, _rig: r.rig || "Unassigned", _crossing: r.crossing || "", _source: "saved" }))
  );

  // Ingested-from-drop rows
  const droppedRows = ingestStatus.filter(s => s.ok && s.rec).map(s => ({
    ...s.rec, _project: s.rec.project || "Unassigned", _rig: s.rec.rig || "Unassigned", _fromFile: s.name, _source: "file"
  }));

  const allRows = [...savedRows, ...legacyRows, ...droppedRows]
    .sort((a,b) => (a._project).localeCompare(b._project) || (a._rig).localeCompare(b._rig) || (b.date||"").localeCompare(a.date||""));

  // ── Data-cleansing: edit a single report's Permit Hours (persists to projectDocs + mirrors into projectAnalysis) ──
  const updatePermitHours = (reportId, newVal) => {
    setData(prev => ({
      ...prev,
      projectDocs: (prev.projectDocs || []).map(d => d.id === reportId ? { ...d, permitHours: newVal } : d),
      projectAnalysis: (prev.projectAnalysis || []).map(p => ({
        ...p,
        dailyReports: (p.dailyReports || []).map(r => r.id === reportId ? { ...r, permitHours: newVal } : r),
      })),
    }));
  };

  // Zero out Permit Hours for every flagged (standby-but-hours-logged) row in the given set
  const bulkFixFlagged = (rowsToFix) => {
    const ids = new Set(rowsToFix.map(r => r.id));
    if (!ids.size) return;
    setData(prev => ({
      ...prev,
      projectDocs: (prev.projectDocs || []).map(d => ids.has(d.id) ? { ...d, permitHours: "0" } : d),
      projectAnalysis: (prev.projectAnalysis || []).map(p => ({
        ...p,
        dailyReports: (p.dailyReports || []).map(r => ids.has(r.id) ? { ...r, permitHours: "0" } : r),
      })),
    }));
    showToast(`✓ Fixed ${ids.size} flagged record${ids.size !== 1 ? "s" : ""}`);
  };

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
      "Project", "Rig / Spread", "Crossing", "Date", "Work Profile", "Activity",
      "Permit Start Time", "Permit End Time",
      "Permit Received", "Permit Hours", "Standby Reason",
      "Progress Today (m)", "Accumulated (m)", "Activity Summary", "Issues / Delays", "Notes",
    ];
    const safe = str => String(str||"").replace(/[\\/?*[\]:]/g,"").slice(0,28);
    const toRow = r => [
      r._project||r.project||"", r._rig||r.rig||"", r._crossing||r.crossing||"", r.date||"",
      r.profile||"", r.activity||"",
      r.permitStartTime||"",
      r.permitEndTime||"",
      r.permitReceived||"",
      r.permitHours!=null?String(r.permitHours):"",
      r.standbyReason||"",
      r.progressToday!=null?String(r.progressToday):"",
      r.accumulated!=null?String(r.accumulated):"",
      r.activities||"", r.issues||"", r.notes||"",
    ];
    const colWidths = [26,18,20,12,20,24,16,16,14,13,30,16,14,48,30,30];
    const makeSheet = rows => {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(toRow)]);
      ws["!cols"] = colWidths.map(w=>({wch:w}));
      ws["!freeze"] = {xSplit:0,ySplit:1};
      return ws;
    };
    const wb = XLSX.utils.book_new();
    // Master sheet — all projects, all rigs
    XLSX.utils.book_append_sheet(wb, makeSheet(allRows), "DPR Master");
    // Group by project → rig
    const byProject = {};
    allRows.forEach(r => {
      const proj = r._project||r.project||"Unassigned";
      const rig  = r._rig||r.rig||"No Rig";
      if (!byProject[proj]) byProject[proj] = {};
      if (!byProject[proj][rig]) byProject[proj][rig] = [];
      byProject[proj][rig].push(r);
    });
    Object.entries(byProject).forEach(([proj, rigMap]) => {
      const projSafe = safe(proj).slice(0,20);
      const allProjRows = Object.values(rigMap).flat();
      // Per-project summary sheet
      XLSX.utils.book_append_sheet(wb, makeSheet(allProjRows), projSafe);
      // Per-rig sheet (only if multiple rigs)
      if (Object.keys(rigMap).length > 1) {
        Object.entries(rigMap).forEach(([rig, rigRows]) => {
          const sheetName = (projSafe + "-" + safe(rig)).slice(0,31);
          XLSX.utils.book_append_sheet(wb, makeSheet(rigRows), sheetName);
        });
      }
    });
    const today = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `DPR_Consolidation_${today}.xlsx`);
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
              {savedRows.length + legacyRows.length} saved report{(savedRows.length+legacyRows.length)!==1?"s":""} across {Object.keys(Object.fromEntries(allRows.map(r=>[r._project,1]))).length} project{Object.keys(Object.fromEntries(allRows.map(r=>[r._project,1]))).length!==1?"s":""} · {Object.keys(Object.fromEntries(allRows.map(r=>[r._rig,1]))).length} rig{Object.keys(Object.fromEntries(allRows.map(r=>[r._rig,1]))).length!==1?"s":""}
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

          {/* Filters */}
          {allRows.length > 0 && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <select value={filterProj} onChange={e=>setFilterProj(e.target.value)}
                style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light",flex:1,minWidth:160}}>
                <option value="">All Projects</option>
                {[...new Set(allRows.map(r=>r._project))].sort().map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterRig} onChange={e=>setFilterRig(e.target.value)}
                style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light",flex:1,minWidth:140}}>
                <option value="">All Rigs</option>
                {[...new Set(allRows.filter(r=>!filterProj||r._project===filterProj).map(r=>r._rig))].sort().map(rg=><option key={rg} value={rg}>{rg}</option>)}
              </select>
              {(filterProj||filterRig)&&<button onClick={()=>{setFilterProj("");setFilterRig("");}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✕ Clear</button>}
            </div>
          )}

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

          {/* View mode tabs */}
          {allRows.length > 0 && (
            <div style={{display:"flex",gap:6,background:T.card2,borderRadius:10,padding:4,width:"fit-content"}}>
              {[
                {id:"data", label:"📝 Data Cleansing"},
                {id:"analysis", label:"📊 Analysis"},
              ].map(v => (
                <button key={v.id} onClick={()=>setViewMode(v.id)}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",
                    background:viewMode===v.id?T.card:"transparent",color:viewMode===v.id?T.text:T.textMuted,
                    boxShadow:viewMode===v.id?T.shadow:"none",transition:"all .15s"}}>
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {/* ══ DATA CLEANSING VIEW ══ */}
          {viewMode==="data" && (() => {
            const visRows = allRows.filter(r =>
              (!filterProj || r._project === filterProj) &&
              (!filterRig  || r._rig    === filterRig)
            );
            if (!visRows.length) return (
              <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:14}}>{allRows.length ? "No reports match the current filter." : "No daily reports yet. Add reports from each project's rig sections, or drop DPR Excel files above."}</div>
              </div>
            );

            const totalFlagged = visRows.filter(isFlaggedRow);

            // Group by project → rig → crossing for display
            const groups = {};
            visRows.forEach(r => {
              const k = r._project;
              if (!groups[k]) groups[k] = {};
              const rk = r._rig;
              if (!groups[k][rk]) groups[k][rk] = [];
              groups[k][rk].push(r);
            });

            return (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div style={{fontSize:12,color:T.textMuted,fontWeight:700}}>{visRows.length} REPORT{visRows.length!==1?"S":""} {filterProj||filterRig?"(FILTERED)":"TOTAL"}</div>
                  {totalFlagged.length>0 && (
                    <div style={{display:"flex",alignItems:"center",gap:8,background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:9,padding:"6px 12px"}}>
                      <span style={{fontSize:12,color:T.red,fontWeight:700}}>⚠ {totalFlagged.length} record{totalFlagged.length!==1?"s":""} flagged — permit not received but hours logged</span>
                      <button onClick={()=>bulkFixFlagged(totalFlagged.filter(r=>r._source==="saved"))}
                        style={{background:T.red,border:"none",color:"#fff",borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        Fix All ({totalFlagged.filter(r=>r._source==="saved").length})
                      </button>
                    </div>
                  )}
                </div>
                {Object.entries(groups).map(([proj, rigMap]) => (
                  <div key={proj} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
                    {/* Project header */}
                    <div style={{background:T.card2,padding:"10px 16px",borderBottom:`1px solid ${T.border}`,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,display:"flex",alignItems:"center",gap:10}}>
                      <span>◆</span> {proj}
                      <span style={{fontSize:12,color:T.textMuted,fontWeight:500,fontFamily:"inherit"}}>{Object.values(rigMap).flat().length} report{Object.values(rigMap).flat().length!==1?"s":""}</span>
                    </div>
                    {/* Per-rig sections */}
                    {Object.entries(rigMap).map(([rig, rigRows], ri) => {
                      const rigCrossings = (crossings||[]).filter(c=>c.project===proj && c.rig===rig);
                      const crossingGroups = rigCrossings.map(c => ({
                        crossing: c,
                        reports: rigRows.filter(r=>r._crossing===c.name),
                      })).filter(g=>g.reports.length>0);
                      const noCrossingRows = rigRows.filter(r=>!r._crossing || !rigCrossings.some(c=>c.name===r._crossing));

                      const renderTable = (rows) => (
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{background:T.card2}}>
                                {["Date","Work Profile","Activity","Permit","Permit Hrs","Progress Today","Accumulated","Source"].map(h=>(
                                  <th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:700,fontSize:10,color:T.textMuted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map((r,i)=>{
                                const flagged = isFlaggedRow(r);
                                return (
                                <tr key={r.id||i} style={{borderBottom:`1px solid ${T.border}`,background:flagged?T.redDim:(i%2===0?T.card:T.card2)}}>
                                  <td style={{padding:"7px 10px",color:T.textSub,whiteSpace:"nowrap"}}>{r.date?fmtDate(r.date):"—"}</td>
                                  <td style={{padding:"7px 10px",color:T.textSub,whiteSpace:"nowrap"}}>{r.profile||"—"}</td>
                                  <td style={{padding:"7px 10px",color:T.textSub,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.activity||"—"}</td>
                                  <td style={{padding:"7px 10px",textAlign:"center"}}>
                                    {r.permitReceived
                                      ? <span style={{background:r.permitReceived.toLowerCase()==="yes"?T.greenDim:T.redDim,color:r.permitReceived.toLowerCase()==="yes"?T.green:T.red,fontWeight:700,borderRadius:5,padding:"1px 7px",fontSize:11}}>{r.permitReceived}</span>
                                      : <span style={{color:T.textMuted}}>—</span>}
                                  </td>
                                  <td style={{padding:"7px 10px",textAlign:"center"}}>
                                    {r._source==="saved" ? (
                                      <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                                        <input
                                          type="number"
                                          defaultValue={r.permitHours||""}
                                          onBlur={e=>{ const v=e.target.value; if (v!==String(r.permitHours||"")) updatePermitHours(r.id, v); }}
                                          style={{width:52,background:flagged?"#fff":T.inputBg,border:`1px solid ${flagged?T.red:T.border}`,borderRadius:5,padding:"3px 5px",fontSize:12,color:T.text,outline:"none",textAlign:"center"}}
                                        />
                                        {flagged && <span title="Permit not received but hours logged" style={{color:T.red,fontSize:12}}>⚠</span>}
                                      </div>
                                    ) : (r.permitHours||"—")}
                                  </td>
                                  <td style={{padding:"7px 10px",textAlign:"center"}}>
                                    {r.progressToday
                                      ? <span style={{background:T.blueDim,color:T.blue,fontWeight:700,borderRadius:5,padding:"1px 7px",fontSize:11}}>{r.progressToday}m</span>
                                      : <span style={{color:T.textMuted}}>—</span>}
                                  </td>
                                  <td style={{padding:"7px 10px",color:T.textSub,textAlign:"center"}}>{r.accumulated||"—"}</td>
                                  <td style={{padding:"7px 10px",color:T.textMuted,fontSize:11}}>
                                    {r._fromFile
                                      ? <span style={{background:T.goldDim,color:T.gold,borderRadius:5,padding:"1px 7px",fontWeight:600}}>📂 File</span>
                                      : <span style={{background:T.greenDim,color:T.green,borderRadius:5,padding:"1px 7px",fontWeight:600}}>✓ Saved</span>}
                                  </td>
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      );

                      return (
                        <div key={rig}>
                          {/* Rig sub-header */}
                          <div style={{background:`${T.gold}0e`,padding:"8px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,borderTop: ri>0?`1px solid ${T.border}`:"none"}}>
                            <span style={{fontSize:13}}>🔩</span>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.gold}}>{rig}</span>
                            <span style={{fontSize:11,color:T.textMuted}}>{rigRows.length} report{rigRows.length!==1?"s":""}</span>
                          </div>
                          {crossingGroups.length===0 ? renderTable(rigRows) : (
                            <>
                              {crossingGroups.map(({crossing, reports}) => (
                                <div key={crossing.id}>
                                  <div style={{background:T.bg,padding:"6px 16px",display:"flex",alignItems:"center",gap:8}}>
                                    <span style={{fontSize:12}}>🛤️</span>
                                    <span style={{fontSize:12,fontWeight:700,color:T.textSub}}>{crossing.name}</span>
                                    <span style={{fontSize:11,color:T.textMuted}}>{reports.length} report{reports.length!==1?"s":""}</span>
                                    {crossing.status==="Completed" && <span style={{fontSize:10,color:T.green,fontWeight:700}}>✓ Completed</span>}
                                  </div>
                                  {renderTable(reports)}
                                </div>
                              ))}
                              {noCrossingRows.length>0 && (
                                <div>
                                  <div style={{background:T.bg,padding:"6px 16px",fontSize:12,fontWeight:700,color:T.textMuted}}>No Crossing Assigned · {noCrossingRows.length} report{noCrossingRows.length!==1?"s":""}</div>
                                  {renderTable(noCrossingRows)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ══ ANALYSIS VIEW ══ */}
          {viewMode==="analysis" && (() => {
            const visRows = allRows.filter(r =>
              (!filterProj || r._project === filterProj) &&
              (!filterRig  || r._rig    === filterRig)
            );
            if (!visRows.length) return (
              <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📊</div>
                <div style={{fontSize:14}}>No reports to analyze yet.</div>
              </div>
            );

            const groups = {};
            visRows.forEach(r => {
              const k = r._project;
              if (!groups[k]) groups[k] = {};
              const rk = r._rig;
              if (!groups[k][rk]) groups[k][rk] = [];
              groups[k][rk].push(r);
            });

            const StatBlock = ({title, reports, accent, showChart, estimates}) => {
              const stats = computeGroupStats(reports);
              const est = estimates || null;
              const catCompare = est ? ESTIMATABLE_CATEGORIES.map(cat => {
                const e = est[cat.key]!=null ? Number(est[cat.key]) : null;
                const actual = stats.counts[cat.key]||0;
                return { ...cat, est: e, actual, variance: e!=null ? actual - e : null };
              }).filter(c => c.est!=null || c.actual>0) : [];
              const hasAnyEst = catCompare.some(c=>c.est!=null);
              const totalEst = hasAnyEst ? catCompare.reduce((s,c)=>s+(c.est||0),0) : null;
              const totalPlannedActual = hasAnyEst ? catCompare.reduce((s,c)=>s+c.actual,0) : null;
              const totalVariance = hasAnyEst ? totalPlannedActual - totalEst : null;
              const onBudget = totalVariance!=null && totalVariance<=0;
              return (
                <div style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${accent}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text}}>{title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {stats.flaggedCount>0 && <span style={{fontSize:11,color:T.red,fontWeight:700}}>⚠ {stats.flaggedCount} flagged</span>}
                      {hasAnyEst ? (
                        <span style={{fontSize:11,fontWeight:700,color:onBudget?T.green:T.red,background:onBudget?T.greenDim:T.redDim,border:`1px solid ${onBudget?T.green:T.red}44`,borderRadius:6,padding:"2px 8px"}}>
                          {totalPlannedActual}d / {totalEst}d est {onBudget?"":`(+${totalVariance}d)`}
                        </span>
                      ) : (
                        <span style={{fontSize:11,color:T.textMuted}}>{stats.totalDays} total days</span>
                      )}
                    </div>
                  </div>
                  {/* Hours utilization */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:pctColor(stats.utilization)}}>{stats.utilization}%</div>
                    <div style={{fontSize:11,color:T.textMuted}}>utilization</div>
                    <div style={{flex:1,minWidth:100,height:6,background:T.border,borderRadius:999,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(stats.utilization,100)}%`,background:pctColor(stats.utilization),borderRadius:999}}/>
                    </div>
                    <div style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>{Math.round(stats.workedHours)}h / {stats.capacityHours}h</div>
                  </div>
                  {showChart ? (
                    <div style={{paddingTop:4}}>
                      <ActivityDonutChart counts={stats.counts} totalDays={stats.totalDays}/>
                    </div>
                  ) : (
                    /* Day-type breakdown (compact, no chart) */
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                      {DAY_CATEGORIES.map(cat => (
                        <div key={cat.key} style={{background:`${cat.color}18`,border:`1px solid ${cat.color}44`,borderRadius:9,padding:"8px 10px"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:cat.color,lineHeight:1}}>{stats.counts[cat.key]}</div>
                          <div style={{fontSize:10,color:T.textSub,marginTop:3,fontWeight:600}}>{cat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasAnyEst && (
                    <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${T.border}`,display:"flex",flexDirection:"column",gap:7}}>
                      <div style={{fontSize:10.5,color:T.textMuted,fontWeight:700,letterSpacing:".3px"}}>ESTIMATED VS ACTUAL BY ACTIVITY</div>
                      {catCompare.map(c => {
                        const over = c.variance!=null && c.variance>0;
                        return (
                          <div key={c.key} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                            <span style={{width:8,height:8,borderRadius:2,background:c.color,flexShrink:0}}/>
                            <span style={{color:T.textSub,fontWeight:600,minWidth:76}}>{c.label}</span>
                            <span style={{color:T.textMuted}}>{c.est!=null ? `${c.est}d est` : "no est."}</span>
                            <span style={{marginLeft:"auto",fontWeight:700,color:over?T.red:T.textSub}}>{c.actual}d actual</span>
                            {c.variance!=null && <span style={{fontWeight:700,color:over?T.red:T.green,minWidth:38,textAlign:"right"}}>{over?"+":""}{c.variance}d</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            const buildAnalysisRows = () => {
              const rows = [];
              Object.entries(groups).forEach(([proj, rigMap]) => {
                Object.entries(rigMap).forEach(([rig, rigRows]) => {
                  const rigCrossings = (crossings||[]).filter(c=>c.project===proj && c.rig===rig);
                  const crossingGroups = rigCrossings.map(c => ({
                    crossing: c,
                    reports: rigRows.filter(r=>r._crossing===c.name),
                  })).filter(g=>g.reports.length>0);
                  const noCrossingRows = rigRows.filter(r=>!r._crossing || !rigCrossings.some(c=>c.name===r._crossing));

                  const pushRow = (crossingName, reports, status, estimates) => {
                    const s = computeGroupStats(reports);
                    const catData = ESTIMATABLE_CATEGORIES.map(cat => {
                      const e = estimates && estimates[cat.key]!=null ? Number(estimates[cat.key]) : null;
                      const actual = s.counts[cat.key]||0;
                      return { key: cat.key, label: cat.label, est: e, actual, variance: e!=null ? actual - e : null };
                    });
                    const hasAnyEst = catData.some(c=>c.est!=null);
                    const totalEst = hasAnyEst ? catData.reduce((sum,c)=>sum+(c.est||0),0) : null;
                    const totalPlannedActual = hasAnyEst ? catData.reduce((sum,c)=>sum+c.actual,0) : null;
                    rows.push({
                      project: proj, rig, crossing: crossingName, status: status||"",
                      totalDays: s.totalDays, hoursWorked: Math.round(s.workedHours*10)/10,
                      capacityHours: s.capacityHours, utilization: s.utilization,
                      counts: s.counts, flaggedCount: s.flaggedCount,
                      catData, estimatedDays: totalEst, variance: hasAnyEst ? totalPlannedActual - totalEst : null,
                    });
                  };

                  crossingGroups.forEach(({crossing, reports}) => pushRow(crossing.name, reports, crossing.status||"Active", crossing.estimates));
                  if (noCrossingRows.length) pushRow("", noCrossingRows, "");
                });
              });
              return rows;
            };

            const exportAnalysis = () => {
              const rows = buildAnalysisRows();
              if (!rows.length) { showToast && showToast("Nothing to export","del"); return; }
              exportToExcel(rows.map(r => {
                const byCat = Object.fromEntries(r.catData.map(c=>[c.key,c]));
                const out = {
                  "Project": r.project, "Rig / Spread": r.rig, "Crossing": r.crossing, "Status": r.status,
                  "Total Days": r.totalDays,
                  "Hours Worked": r.hoursWorked, "Capacity Hours": r.capacityHours, "Utilization %": r.utilization,
                };
                ESTIMATABLE_CATEGORIES.forEach(cat => {
                  const c = byCat[cat.key];
                  out[`${cat.label} — Estimated`] = c && c.est!=null ? c.est : "";
                  out[`${cat.label} — Actual`] = c ? c.actual : r.counts[cat.key];
                  out[`${cat.label} — Variance`] = c && c.variance!=null ? c.variance : "";
                });
                out["Standby Days"] = r.counts.standby;
                out["Other Days"] = r.counts.other;
                out["Total Estimated (Planned)"] = r.estimatedDays!=null ? r.estimatedDays : "";
                out["Total Variance (Planned)"] = r.variance!=null ? r.variance : "";
                out["Flagged Records"] = r.flaggedCount;
                return out;
              }), `DPR_Crossing_Analysis_${new Date().toISOString().slice(0,10)}`);
            };

            const exportUtilization = () => {
              const rows = buildAnalysisRows();
              if (!rows.length) { showToast && showToast("Nothing to export","del"); return; }
              exportToExcel(rows.map(r => ({
                "Project": r.project, "Rig / Spread": r.rig, "Crossing": r.crossing, "Status": r.status,
                "Total Days": r.totalDays, "Estimated Days": r.estimatedDays!=null?r.estimatedDays:"", "Variance": r.variance!=null?r.variance:"",
                "Hours Worked": r.hoursWorked,
                "Capacity Hours": r.capacityHours, "Utilization %": r.utilization,
              })), `Permit_Hours_Utilization_${new Date().toISOString().slice(0,10)}`);
            };

            const exportPermitHoursDetail = () => {
              if (!visRows.length) { showToast && showToast("Nothing to export","del"); return; }
              const sorted = [...visRows].sort((a,b)=>
                a._project.localeCompare(b._project) || a._rig.localeCompare(b._rig) ||
                (a._crossing||"").localeCompare(b._crossing||"") || (a.date||"").localeCompare(b.date||"")
              );
              exportToExcel(sorted.map(r => ({
                "Project": r._project, "Rig / Spread": r._rig, "Crossing": r._crossing||"",
                "Date": r.date||"", "Work Profile": r.profile||"", "Activity": r.activity||"",
                "Permit Received": r.permitReceived||"", "Permit Hours": r.permitHours!=null?String(r.permitHours):"",
                "Standby Reason": r.standbyReason||"", "Progress Today (m)": r.progressToday!=null?String(r.progressToday):"",
              })), `Permit_Hours_Detail_${new Date().toISOString().slice(0,10)}`);
            };

            const utilRows = buildAnalysisRows();

            return (
              <div style={{display:"flex",flexDirection:"column",gap:20}}>
                <div style={{display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap"}}>
                  <button onClick={exportPermitHoursDetail}
                    style={{background:`${T.purple}18`,border:`1px solid ${T.purple}44`,color:T.purple,borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    ⬇ Export Permit Hours Detail (Daily)
                  </button>
                  <button onClick={exportUtilization}
                    style={{background:`${T.blue}18`,border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    ⬇ Export Permit Hours / Utilization
                  </button>
                  <button onClick={exportAnalysis}
                    style={{background:`${T.green}18`,border:`1px solid ${T.green}44`,color:T.green,borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    ⬇ Export Analysis to Excel
                  </button>
                </div>

                {/* ── Compact Permit Hours / Utilization summary table ── */}
                {utilRows.length > 0 && (
                  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
                    <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:15}}>⏱</span>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text}}>Permit Hours &amp; Utilization Summary</span>
                      <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto"}}>{utilRows.length} crossing{utilRows.length!==1?"s":""}</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                        <thead>
                          <tr style={{background:T.card2}}>
                            {["Project","Rig","Crossing","Days","Est. Days","Variance","Hours Worked","Capacity","Utilization"].map(h=>(
                              <th key={h} style={{padding:"8px 12px",textAlign:h==="Project"||h==="Rig"||h==="Crossing"?"left":"right",fontWeight:700,fontSize:10.5,color:T.textMuted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {utilRows.sort((a,b)=>a.project.localeCompare(b.project)||a.rig.localeCompare(b.rig)).map((r,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.card2}}>
                              <td style={{padding:"7px 12px",color:T.textSub,whiteSpace:"nowrap"}}>{r.project}</td>
                              <td style={{padding:"7px 12px",color:T.textSub,whiteSpace:"nowrap"}}>{r.rig}</td>
                              <td style={{padding:"7px 12px",color:T.textSub}}>{r.crossing||<span style={{color:T.textMuted}}>—</span>}</td>
                              <td style={{padding:"7px 12px",color:T.textSub,textAlign:"right"}}>{r.totalDays}</td>
                              <td style={{padding:"7px 12px",color:T.textMuted,textAlign:"right"}}>{r.estimatedDays!=null?`${r.estimatedDays}d`:"—"}</td>
                              <td style={{padding:"7px 12px",textAlign:"right"}}>
                                {r.variance!=null ? (
                                  <span style={{fontWeight:700,color:r.variance<=0?T.green:T.red}}>{r.variance<=0?`${Math.abs(r.variance)}d under`:`+${r.variance}d`}</span>
                                ) : <span style={{color:T.textMuted}}>—</span>}
                              </td>
                              <td style={{padding:"7px 12px",color:T.textSub,textAlign:"right"}}>{r.hoursWorked}h</td>
                              <td style={{padding:"7px 12px",color:T.textMuted,textAlign:"right"}}>{r.capacityHours}h</td>
                              <td style={{padding:"7px 12px",textAlign:"right"}}>
                                <span style={{fontWeight:700,color:pctColor(r.utilization)}}>{r.utilization}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {(() => {
                  const sumEstimates = (crossingsList) => {
                    const result = {};
                    ESTIMATABLE_CATEGORIES.forEach(cat => {
                      const withEst = crossingsList.filter(c=>c.estimates && c.estimates[cat.key]!=null);
                      result[cat.key] = withEst.length ? withEst.reduce((s,c)=>s+Number(c.estimates[cat.key]),0) : null;
                    });
                    return result;
                  };
                  return Object.entries(groups).map(([proj, rigMap]) => {
                  const allProjRows = Object.values(rigMap).flat();
                  const projCrossings = (crossings||[]).filter(c=>c.project===proj && !c._deleted);
                  return (
                    <div key={proj} style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,display:"flex",alignItems:"center",gap:8}}>
                        <span>◆</span> {proj}
                      </div>
                      <StatBlock title="Project Total" reports={allProjRows} accent={T.blue} showChart estimates={sumEstimates(projCrossings)}/>
                      {Object.entries(rigMap).map(([rig, rigRows]) => {
                        const rigCrossings = (crossings||[]).filter(c=>c.project===proj && c.rig===rig);
                        const crossingGroups = rigCrossings.map(c => ({
                          crossing: c,
                          reports: rigRows.filter(r=>r._crossing===c.name),
                        })).filter(g=>g.reports.length>0);
                        const noCrossingRows = rigRows.filter(r=>!r._crossing || !rigCrossings.some(c=>c.name===r._crossing));
                        return (
                          <div key={rig} style={{marginLeft:16,display:"flex",flexDirection:"column",gap:8}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.gold,display:"flex",alignItems:"center",gap:6}}>
                              <span>🔩</span> {rig}
                            </div>
                            <StatBlock title={`${rig} — Total`} reports={rigRows} accent={T.gold} showChart estimates={sumEstimates(rigCrossings)}/>
                            {crossingGroups.map(({crossing,reports}) => (
                              <div key={crossing.id} style={{marginLeft:16}}>
                                <StatBlock title={`🛤️ ${crossing.name}`} reports={reports} accent={crossing.status==="Completed"?T.green:T.purple} estimates={crossing.estimates}/>
                              </div>
                            ))}
                            {noCrossingRows.length>0 && (
                              <div style={{marginLeft:16}}>
                                <StatBlock title="No Crossing Assigned" reports={noCrossingRows} accent={T.textMuted}/>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                  });
                })()}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 24px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"center",flexShrink:0,borderRadius:"0 0 18px 18px",background:T.card}}>
          <div style={{flex:1,fontSize:12,color:T.textMuted}}>
            {allRows.length} report{allRows.length!==1?"s":""} →
            1 master sheet + {[...new Set(allRows.map(r=>r._project))].length} project sheet{[...new Set(allRows.map(r=>r._project))].length!==1?"s":""}
            + per-rig sheets where multiple rigs exist
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
function ProjectAnalysisModal({ proj, projectNames, workOrders, onSave, onClose }) {
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
            ℹ Progress is calculated automatically from invoices in Project Docs. The contract / PO value is set on the project itself (Manage Projects).
          </div>
          <div>
            <label style={LS}>PROJECT *</label>
            <select value={f.project} onChange={e=>upd("project",e.target.value)} style={{...IS,colorScheme:"light"}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
              <option value="">— Select project —</option>
              {projectNames.map(p=>{ const name = typeof p==="string"?p:(p?.name??""); return <option key={name} value={name}>{name}</option>; })}
            </select>
          </div>
          {(() => {
            const wos = (workOrders||[]).filter(d=>d.project===f.project);
            const cv = wos.length ? Math.max(...wos.map(d=>parseFloat(d.amount)||0)) : 0;
            return cv ? (
              <div style={{background:`${T.teal}12`,border:`1px solid ${T.teal}44`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.teal,fontWeight:700}}>
                💰 Contract Value: {formatSarCompact(cv)} — from Work Orders / Agreements
              </div>
            ) : (
              <div style={{background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:T.gold}}>
                ⚠ No contract value found. Add a Work Order / Agreement for this project under Finance.
              </div>
            );
          })()}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={LS}>PO NUMBER</label><input value={f.poNumber} onChange={e=>upd("poNumber",e.target.value)} placeholder="e.g. PO-2025-001" style={IS} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/></div>
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
function ProjectAnalysisDetail({ proj, projectDocs, projectNames, data, setData, showToast, onUpdate, onDelete, onBack, go, isAdmin }) {
  const [editProj, setEditProj]     = useState(false);
  const [drModal,  setDrModal]      = useState(null);
  const [expandDr, setExpandDr]     = useState(null);
  const [expandJob,          setExpandJob]          = useState(null);
  const [expandAllInvs,      setExpandAllInvs]      = useState(false);
  const [expandJobsSection,  setExpandJobsSection]  = useState(false);
  const [expandDailySection, setExpandDailySection] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  // Cost sheet file upload state (hoisted from IIFE to satisfy Rules of Hooks)
  const [csUploading, setCsUploading]       = useState(false);
  const csFileRef                            = useRef();
  // Quotation file upload state
  const [quoteUploading, setQuoteUploading] = useState({});
  const quoteFileRefs                        = useRef({});

  const { invs, totalInvoiced, totalCollected, totalDue, jobs, ungroupedInvs, ungroupedCerts } = deriveProjectStats(proj.project, projectDocs);
  const poValue = parseFloat(proj.poValue) || 0;
  const pct = poValue > 0 ? Math.min(100, Math.round((totalInvoiced / poValue) * 100)) : 0;
  const dl = daysLeft(proj.estEndDate);
  const duration = proj.startDate && proj.estEndDate
    ? Math.ceil((new Date(proj.estEndDate) - new Date(proj.startDate)) / 86400000)
    : null;
  const stColor = { "Not Started":T.textMuted,"In Progress":T.blue,"On Hold":T.gold,"Completed":T.green,"Cancelled":T.red }[proj.status]||T.textMuted;
  // Pull daily reports from projectDocs (same source as Project Docs tab — has rig correctly set)
  const reports = (projectDocs||[])
    .filter(d => d.subTab==="dailyreports" && d.project===proj.project)
    .slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const saveReport = r => {
    const rec = {...r, subTab:"dailyreports", project:proj.project, id:r.id||uid()};
    setData(prev => {
      const docs = prev.projectDocs||[];
      const exists = docs.find(x=>x.id===rec.id);
      return {...prev, projectDocs: exists ? docs.map(x=>x.id===rec.id?rec:x) : [...docs, rec]};
    });
    setDrModal(null);
  };
  const delReport = id => setData(prev=>({...prev, projectDocs:(prev.projectDocs||[]).filter(d=>d.id!==id)}));

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
        {isAdmin && <button onClick={()=>{if(window.confirm("Delete this project analysis?")) onDelete();}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Delete</button>}
      </div>

      {/* Detail tab bar */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {id:"overview",   label:"Overview",   icon:"◐"},
          {id:"costsheet",  label:"Cost Sheet",  icon:"💰"},
          {id:"quotation",  label:"Quotation",   icon:"📄"},
        ].map(t=>{
          const active = detailTab===t.id;
          const accentColor = t.id==="costsheet"?T.teal:t.id==="quotation"?T.purple:T.blue;
          return (
            <button key={t.id} onClick={()=>setDetailTab(t.id)}
              style={{background:active?`${accentColor}18`:T.card, border:`1px solid ${active?accentColor+"66":T.border}`, color:active?accentColor:T.textMuted, borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all .15s"}}>
              <span>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {/* ══ COST SHEET tab ═══════════════════════════════════════════════ */}
      {detailTab==="costsheet" && (() => {
        const sheets = (data.costSheets||[]).filter(s=>s.project===proj.project);
        const addSheet = () => {
          const desc = window.prompt("Cost item description:");
          if (!desc) return;
          const est = window.prompt("Estimated cost (SAR):");
          const act = window.prompt("Actual cost (SAR, leave blank if not yet spent):");
          setData(prev=>({...prev, costSheets:[...(prev.costSheets||[]), {id:uid(), project:proj.project, description:desc, estimatedCost:est||"0", actualCost:act||"", date:new Date().toISOString().slice(0,10), notes:""}]}));
          showToast("Cost sheet entry added");
        };
        const delSheet = id => setData(prev=>({...prev, costSheets:(prev.costSheets||[]).filter(s=>s.id!==id)}));
        const totalEst = sheets.reduce((s,x)=>s+(parseFloat(x.estimatedCost)||0),0);
        const totalAct = sheets.reduce((s,x)=>s+(parseFloat(x.actualCost)||0),0);

        // Cost sheet file upload & estimated total cost (stored on the projectAnalysis entry)
        const paEntry = (data.projectAnalysis||[]).find(x=>x.project===proj.project) || {};
        const handleCsFileUpload = async (file) => {
          if (!file) return;
          setCsUploading(true);
          try {
            let fileUrl = "";
            if (isCloudflareConfigured()) {
              fileUrl = await uploadFile(file, "costsheets");
            } else {
              fileUrl = URL.createObjectURL(file);
            }
            setData(prev=>({...prev, projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.project===proj.project?{...x,costSheetFileUrl:fileUrl,costSheetFileName:file.name}:x)}));
            showToast("Cost sheet file uploaded");
          } catch(e) { showToast("Upload failed","error"); }
          setCsUploading(false);
        };
        const handleEstTotalChange = (v) => {
          setData(prev=>({...prev, projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.project===proj.project?{...x,estimatedTotalCost:v}:x)}));
        };

        return (
          <div className="fade-in">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>💰 COST SHEET — {proj.project}</div>
              <button onClick={addSheet} style={{background:T.teal,border:"none",color:"#fff",borderRadius:10,padding:"9px 18px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",letterSpacing:"1px"}}>+ ADD ENTRY</button>
            </div>
            {/* ── Cost sheet file upload + estimated total cost ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              {/* File upload */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",marginBottom:8}}>COST SHEET FILE</div>
                <input ref={csFileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.doc,.docx" style={{display:"none"}} onChange={e=>{handleCsFileUpload(e.target.files[0]);e.target.value="";}}/>
                {paEntry.costSheetFileUrl ? (
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:16}}>{/\.pdf$/i.test(paEntry.costSheetFileName||"")?"📄":/\.(png|jpg|jpeg|webp)$/i.test(paEntry.costSheetFileName||"")?"🖼️":"📎"}</span>
                    <a href={paEntry.costSheetFileUrl} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:T.blue,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:"none"}}>
                      {paEntry.costSheetFileName||"View File"}
                    </a>
                    <button onClick={()=>csFileRef.current&&csFileRef.current.click()} style={{background:T.tealDim,border:`1px solid ${T.teal}44`,color:T.teal,borderRadius:7,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Replace</button>
                  </div>
                ) : (
                  <button
                    onClick={()=>csFileRef.current&&csFileRef.current.click()}
                    disabled={csUploading}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:T.tealDim,border:`1px dashed ${T.teal}66`,color:T.teal,borderRadius:9,padding:"9px 14px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",opacity:csUploading?0.6:1}}
                  >
                    {csUploading?"⏳ Uploading…":"📎 Attach Cost Sheet File"}
                  </button>
                )}
              </div>
              {/* Estimated total cost */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",marginBottom:8}}>ESTIMATED TOTAL COST (SAR)</div>
                <input
                  type="number"
                  value={paEntry.estimatedTotalCost||""}
                  onChange={e=>handleEstTotalChange(e.target.value)}
                  placeholder="0"
                  style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:15,fontWeight:700,color:T.gold,outline:"none",colorScheme:"light"}}
                  onFocus={e=>e.target.style.borderColor=T.teal}
                  onBlur={e=>e.target.style.borderColor=T.border}
                />
                {paEntry.estimatedTotalCost&&<div style={{fontSize:11,color:T.textMuted,marginTop:5}}>= {formatSarCompact(parseFloat(paEntry.estimatedTotalCost)||0)}</div>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
              {[
                {label:"TOTAL ESTIMATED", v:formatSarCompact(totalEst), color:T.gold},
                {label:"TOTAL ACTUAL",    v:totalAct>0?formatSarCompact(totalAct):"—", color:T.red},
                {label:"VARIANCE",        v:totalAct>0?formatSarCompact(Math.abs(totalEst-totalAct)):"—", color:totalAct>totalEst?T.red:T.green},
                {label:"ENTRIES",         v:sheets.length, color:T.blue},
              ].map(k=>(
                <div key={k.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:k.color}}>{k.v}</div>
                  <div style={{fontSize:10,color:T.textMuted,marginTop:4,fontWeight:700,letterSpacing:".5px"}}>{k.label}</div>
                </div>
              ))}
            </div>
            {sheets.length===0
              ? <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center"}}>
                  <div style={{fontSize:40,marginBottom:10}}>💰</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.textSub,marginBottom:8}}>NO COST ENTRIES</div>
                  <div style={{fontSize:13,color:T.textMuted,marginBottom:16}}>Add estimated and actual costs for this project</div>
                  <button onClick={addSheet} style={{background:T.teal,border:"none",color:"#fff",borderRadius:10,padding:"10px 22px",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer"}}>+ ADD ENTRY</button>
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px 120px 40px",gap:12,padding:"8px 16px",background:T.card,borderRadius:10,fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:".5px"}}>
                    <span>DESCRIPTION</span><span style={{textAlign:"right"}}>ESTIMATED</span><span style={{textAlign:"right"}}>ACTUAL</span><span style={{textAlign:"right"}}>DATE</span><span/>
                  </div>
                  {sheets.map(s=>{
                    const est=parseFloat(s.estimatedCost)||0;
                    const act=parseFloat(s.actualCost)||0;
                    const over=act>0&&act>est;
                    return (
                      <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 140px 140px 120px 40px",gap:12,padding:"12px 16px",background:T.card,border:`1px solid ${over?T.red+"44":T.border}`,borderRadius:10,alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:14,color:T.text}}>{s.description}</div>
                          {s.notes&&<div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.notes}</div>}
                        </div>
                        <div style={{textAlign:"right",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.gold}}>{formatSarCompact(est)}</div>
                        <div style={{textAlign:"right",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:act>0?(over?T.red:T.green):T.textMuted}}>{act>0?formatSarCompact(act):"—"}</div>
                        <div style={{textAlign:"right",fontSize:12,color:T.textMuted}}>{s.date||"—"}</div>
                        {isAdmin && <button onClick={()=>delSheet(s.id)} style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:16,padding:0}}>✕</button>}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        );
      })()}

      {/* ══ QUOTATION tab ════════════════════════════════════════════════ */}
      {detailTab==="quotation" && (() => {
        const paEntry = (data.projectAnalysis||[]).find(x=>x.project===proj.project) || {};
        const handleQuoteFileUpload = async (file) => {
          if (!file) return;
          setQuoteUploading(p=>({...p, _main:true}));
          try {
            let fileUrl = "";
            if (isCloudflareConfigured()) {
              fileUrl = await uploadFile(file, "quotations");
            } else {
              fileUrl = URL.createObjectURL(file);
            }
            setData(prev=>({...prev, projectAnalysis:(prev.projectAnalysis||[]).map(x=>x.project===proj.project?{...x,quotationFileUrl:fileUrl,quotationFileName:file.name}:x)}));
            showToast("File uploaded");
          } catch(e) { showToast("Upload failed","error"); }
          setQuoteUploading(p=>({...p, _main:false}));
        };
        return (
          <div className="fade-in">
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text,marginBottom:16}}>📄 QUOTATION — {proj.project}</div>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"24px 20px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:".5px",marginBottom:12}}>QUOTATION FILE</div>
              <input
                ref={el => { quoteFileRefs.current["_main"] = el; }}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.doc,.docx"
                style={{display:"none"}}
                onChange={e => { handleQuoteFileUpload(e.target.files[0]); e.target.value=""; }}
              />
              {paEntry.quotationFileUrl ? (
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:20}}>{/\.pdf$/i.test(paEntry.quotationFileName||"")?"📄":/\.(png|jpg|jpeg|webp)$/i.test(paEntry.quotationFileName||"")?"🖼️":"📎"}</span>
                  <a href={paEntry.quotationFileUrl} target="_blank" rel="noreferrer" style={{flex:1,fontSize:14,color:T.blue,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:"none"}}>
                    {paEntry.quotationFileName||"View Quotation File"}
                  </a>
                  <button onClick={()=>quoteFileRefs.current["_main"]&&quoteFileRefs.current["_main"].click()} style={{background:T.purpleDim,border:`1px solid ${T.purple}44`,color:T.purple,borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Replace</button>
                </div>
              ) : (
                <button
                  onClick={()=>quoteFileRefs.current["_main"]&&quoteFileRefs.current["_main"].click()}
                  disabled={quoteUploading["_main"]}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:T.purpleDim,border:`2px dashed ${T.purple}66`,color:T.purple,borderRadius:12,padding:"28px 20px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",opacity:quoteUploading["_main"]?0.6:1}}
                >
                  {quoteUploading["_main"] ? "⏳ Uploading…" : "📎 Attach Quotation File"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {detailTab==="overview" && <>
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

      {/* ── Estimated vs Actual — by Activity ── */}
      {reports.length > 0 && (() => {
        const projCrossingsForEst = (data.crossings||[]).filter(c=>c.project===proj.project && !c._deleted);
        const catRows = ESTIMATABLE_CATEGORIES.map(cat => {
          const hasEst = projCrossingsForEst.some(c=>c.estimates && c.estimates[cat.key]!=null);
          const est = hasEst ? projCrossingsForEst.reduce((sum,c)=> sum + (c.estimates && c.estimates[cat.key]!=null ? Number(c.estimates[cat.key]) : 0), 0) : null;
          const actual = reports.filter(r=>classifyDay(r)===cat.key).length;
          const variance = hasEst ? actual - est : null;
          return { ...cat, est, actual, variance };
        });
        const anyEstimates = catRows.some(r=>r.est!=null);
        if (!anyEstimates) return null; // no crossing estimates set yet for this project

        const totalEst = catRows.reduce((s,r)=>s+(r.est||0),0);
        const totalActual = catRows.reduce((s,r)=>s+r.actual,0);
        const totalVariance = totalActual - totalEst;
        const onBudget = totalVariance <= 0;

        return (
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 24px",marginBottom:16,boxShadow:T.shadow}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>🎯 Estimated vs Actual — by Activity</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Budget estimate (from crossing planning) vs actual days recorded, per activity type</div>
              </div>
              <div style={{background:onBudget?T.greenDim:T.redDim,border:`1px solid ${onBudget?T.green:T.red}44`,borderRadius:12,padding:"8px 16px",textAlign:"center"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:onBudget?T.green:T.red,lineHeight:1}}>
                  {onBudget ? `${Math.abs(totalVariance)}d under` : `+${totalVariance}d over`}
                </div>
                <div style={{fontSize:11,color:onBudget?T.green:T.red,fontWeight:600,marginTop:2}}>TOTAL PLANNED WORK</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {catRows.map(cat => {
                const maxVal = Math.max(cat.est||0, cat.actual, 1) * 1.15;
                const estPct = cat.est!=null ? Math.min(100,(cat.est/maxVal)*100) : 0;
                const actPct = Math.min(100,(cat.actual/maxVal)*100);
                const over = cat.variance!=null && cat.variance>0;
                return (
                  <div key={cat.key}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,flexWrap:"wrap",gap:6}}>
                      <span style={{fontSize:12.5,fontWeight:700,color:cat.color}}>{cat.label}</span>
                      <span style={{fontSize:11,color:T.textMuted}}>
                        {cat.est!=null ? (
                          <>Est <b style={{color:T.text}}>{cat.est}d</b> · Actual <b style={{color:over?T.red:T.text}}>{cat.actual}d</b>{cat.variance!=null && <span style={{color:over?T.red:T.green,fontWeight:700}}> ({over?"+":""}{cat.variance}d)</span>}</>
                        ) : (
                          <>No estimate set · {cat.actual}d actual</>
                        )}
                      </span>
                    </div>
                    <div style={{position:"relative",height:11,background:T.border,borderRadius:999,overflow:"hidden"}}>
                      <div style={{position:"absolute",inset:0,width:`${actPct}%`,background:over?T.red:cat.color,borderRadius:999,opacity:.9,transition:"width .8s cubic-bezier(.22,1,.36,1)"}}/>
                      {cat.est!=null && (
                        <div style={{position:"absolute",top:-2,bottom:-2,left:`${estPct}%`,width:2,background:T.text,opacity:.65}} title={`Estimate: ${cat.est}d`}/>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:10,color:T.textMuted,marginTop:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{display:"inline-block",width:2,height:10,background:T.text,opacity:.65}}/> vertical marker = estimated days
            </div>
          </div>
        );
      })()}

      {/* ── Activity Breakdown (day-type composition, animated & hoverable) ── */}
      {reports.length > 0 && (() => {
        const dayStats = computeGroupStats(reports);
        return (
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,padding:"20px 24px",marginBottom:16,boxShadow:T.shadow}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>📊 Activity Breakdown</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>How site days were spent — hover the chart for details</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                {dayStats.flaggedCount>0 && (
                  <span style={{fontSize:12,color:T.red,fontWeight:700,background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:8,padding:"5px 12px"}}>
                    ⚠ {dayStats.flaggedCount} flagged record{dayStats.flaggedCount!==1?"s":""}
                  </span>
                )}
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:pctColor(dayStats.utilization)}}>{dayStats.utilization}%</div>
                  <div style={{fontSize:10,color:T.textMuted,fontWeight:700}}>UTILIZATION</div>
                </div>
              </div>
            </div>
            <ActivityDonutChart counts={dayStats.counts} totalDays={dayStats.totalDays} size={200} strokeWidth={26}/>
          </div>
        );
      })()}

      {/* ── Permit Hours & Utilization report (per rig, this project only) ── */}
      {reports.length > 0 && (() => {
        const rigGroups = {};
        reports.forEach(r => {
          const rig = r.rig || "Unassigned";
          (rigGroups[rig] = rigGroups[rig] || []).push(r);
        });
        const rigNames = Object.keys(rigGroups).sort();
        const projCrossingsForEst = (data.crossings||[]).filter(c=>c.project===proj.project && !c._deleted);
        const utilRows = rigNames.map(rig => {
          const rigReports = rigGroups[rig];
          const s = computeGroupStats(rigReports);
          const rigCrossings = projCrossingsForEst.filter(c=>c.rig===rig);
          const hasEst = rigCrossings.some(c=>c.estimates && ESTIMATABLE_CATEGORIES.some(cat=>c.estimates[cat.key]!=null));
          const estimatedDays = hasEst ? ESTIMATABLE_CATEGORIES.reduce((catSum,cat)=>
            catSum + rigCrossings.reduce((sum,c)=>sum+(c.estimates && c.estimates[cat.key]!=null ? Number(c.estimates[cat.key]) : 0), 0), 0) : null;
          const plannedActual = ESTIMATABLE_CATEGORIES.reduce((sum,cat)=>sum+rigReports.filter(r=>classifyDay(r)===cat.key).length, 0);
          const variance = estimatedDays!=null ? plannedActual - estimatedDays : null;
          return { rig, totalDays: s.totalDays, hoursWorked: Math.round(s.workedHours*10)/10, capacityHours: s.capacityHours, utilization: s.utilization, estimatedDays, variance };
        });

        const exportProjectUtilization = () => {
          exportToExcel(utilRows.map(r => ({
            "Project": proj.project, "Rig / Spread": r.rig,
            "Total Days": r.totalDays, "Estimated Days": r.estimatedDays!=null?r.estimatedDays:"", "Variance": r.variance!=null?r.variance:"",
            "Hours Worked": r.hoursWorked,
            "Capacity Hours": r.capacityHours, "Utilization %": r.utilization,
          })), `${proj.project.replace(/\s+/g,"_")}_Utilization_${new Date().toISOString().slice(0,10)}`);
        };

        const exportProjectPermitDetail = () => {
          const sorted = [...reports].sort((a,b)=>
            (a.rig||"").localeCompare(b.rig||"") || (a.crossing||"").localeCompare(b.crossing||"") || (a.date||"").localeCompare(b.date||"")
          );
          exportToExcel(sorted.map(r => ({
            "Project": proj.project, "Rig / Spread": r.rig||"", "Crossing": r.crossing||"",
            "Date": r.date||"", "Work Profile": r.profile||"", "Activity": r.activity||"",
            "Permit Received": r.permitReceived||"", "Permit Hours": r.permitHours!=null?String(r.permitHours):"",
            "Standby Reason": r.standbyReason||"", "Progress Today (m)": r.progressToday!=null?String(r.progressToday):"",
          })), `${proj.project.replace(/\s+/g,"_")}_Permit_Hours_Detail_${new Date().toISOString().slice(0,10)}`);
        };

        return (
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:15}}>⏱</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text}}>Permit Hours &amp; Utilization</span>
              <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={exportProjectPermitDetail}
                  style={{background:`${T.purple}18`,border:`1px solid ${T.purple}44`,color:T.purple,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  ⬇ Export Daily Detail
                </button>
                <button onClick={exportProjectUtilization}
                  style={{background:`${T.blue}18`,border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  ⬇ Export Summary
                </button>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead>
                  <tr style={{background:T.card2}}>
                    {["Rig / Spread","Days","Est. Days","Variance","Hours Worked","Capacity","Utilization"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:h==="Rig / Spread"?"left":"right",fontWeight:700,fontSize:10.5,color:T.textMuted,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {utilRows.map((r,i)=>(
                    <tr key={r.rig} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.card2}}>
                      <td style={{padding:"7px 12px",color:T.textSub,fontWeight:600}}>🔩 {r.rig}</td>
                      <td style={{padding:"7px 12px",color:T.textSub,textAlign:"right"}}>{r.totalDays}</td>
                      <td style={{padding:"7px 12px",color:T.textMuted,textAlign:"right"}}>{r.estimatedDays!=null?`${r.estimatedDays}d`:"—"}</td>
                      <td style={{padding:"7px 12px",textAlign:"right"}}>
                        {r.variance!=null ? (
                          <span style={{fontWeight:700,color:r.variance<=0?T.green:T.red}}>{r.variance<=0?`${Math.abs(r.variance)}d under`:`+${r.variance}d`}</span>
                        ) : <span style={{color:T.textMuted}}>—</span>}
                      </td>
                      <td style={{padding:"7px 12px",color:T.textSub,textAlign:"right"}}>{r.hoursWorked}h</td>
                      <td style={{padding:"7px 12px",color:T.textMuted,textAlign:"right"}}>{r.capacityHours}h</td>
                      <td style={{padding:"7px 12px",textAlign:"right"}}>
                        <span style={{fontWeight:700,color:pctColor(r.utilization)}}>{r.utilization}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Breakdown by Rig / Location (only when project has multiple rigs) ── */}
      {reports.length > 0 && (() => {
        const rigGroups = {};
        reports.forEach(r => {
          const rig = r.rig || "Unassigned";
          (rigGroups[rig] = rigGroups[rig] || []).push(r);
        });
        const rigNames = Object.keys(rigGroups).sort();
        if (rigNames.length <= 1) return null; // single-rig projects already covered by the panel above

        return (
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              🔩 Breakdown by Rig / Location
              <span style={{fontSize:11,color:T.textMuted,fontWeight:500,fontFamily:"inherit"}}>{rigNames.length} rigs</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}}>
              {rigNames.map((rig,i) => {
                const rigReports = rigGroups[rig];
                const rs = computeGroupStats(rigReports);
                return (
                  <div key={rig} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"18px 20px",boxShadow:T.shadow,animationDelay:`${i*.06}s`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.gold}}>🔩 {rig}</div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        {rs.flaggedCount>0 && (
                          <span style={{fontSize:11,color:T.red,fontWeight:700,background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:6,padding:"3px 8px"}}>
                            ⚠ {rs.flaggedCount}
                          </span>
                        )}
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:pctColor(rs.utilization)}}>{rs.utilization}%</div>
                          <div style={{fontSize:9,color:T.textMuted,fontWeight:700}}>UTIL</div>
                        </div>
                      </div>
                    </div>
                    <ActivityDonutChart counts={rs.counts} totalDays={rs.totalDays} size={160} strokeWidth={20}/>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                  "Project":            proj.project,
                  "Rig / Spread":       r.rig||"",
                  "Crossing":           r.crossing||"",
                  "Date":               r.date||"",
                  "Work Profile":       r.profile||"",
                  "Activity":           r.activity||"",
                  "Permit Received":    r.permitReceived||"",
                  "Permit Hours":       r.permitHours!=null?String(r.permitHours):"",
                  "Standby Reason":     r.standbyReason||"",
                  "Progress Today (m)": r.progressToday!=null?String(r.progressToday):"",
                  "Accumulated (m)":    r.accumulated!=null?String(r.accumulated):"",
                  "Activity Summary":   r.activities||"",
                  "Notes":              r.notes||"",
                })),
                `Daily_Reports_${(proj.project||"Project").replace(/\s+/g,"_")}_ALL_RIGS`
              )}
                style={{background:"rgba(52,211,153,0.12)",border:"1px solid rgba(52,211,153,0.3)",color:"#34d399",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                ⬇ Export All Rigs
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
        {expandDailySection && (() => {
          const projRigsPA = (data.rigs||[]).filter(r=>r.project===proj.project);
          const rigColors  = ["#a78bfa","#38bdf8","#34d399","#f472b6","#fb923c","#fbbf24"];

          const exportRigReports = (rigReports, rigName) => {
            if (!rigReports.length) return;
            exportToExcel(rigReports.map(r=>({
              "Project":            proj.project,
              "Rig / Spread":       r.rig||rigName||"",
              "Crossing":           r.crossing||"",
              "Date":               r.date||"",
              "Work Profile":       r.profile||"",
              "Activity":           r.activity||"",
              "Permit Received":    r.permitReceived||"",
              "Permit Hours":       r.permitHours!=null?String(r.permitHours):"",
              "Standby Reason":     r.standbyReason||"",
              "Progress Today (m)": r.progressToday!=null?String(r.progressToday):"",
              "Accumulated (m)":    r.accumulated!=null?String(r.accumulated):"",
              "Activity Summary":   r.activities||"",
              "Notes":              r.notes||"",
            })), `Daily_Reports_${(proj.project||"Project").replace(/\s+/g,"_")}_${(rigName||"Unassigned").replace(/\s+/g,"_")}`);
          };

          // Report card shared renderer
          const DrCardPA = ({r}) => {
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
                    {isAdmin&&<button onClick={e=>{e.stopPropagation();delReport(r.id);}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✕</button>}
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
          };

          // Quick-assign rig for a report
          const assignRig = (reportId, rigName) => {
            setData(prev=>({...prev, projectDocs:(prev.projectDocs||[]).map(d=>d.id===reportId?{...d,rig:rigName}:d)}));
          };

          if (reports.length===0) return (
            <div style={{textAlign:"center",padding:"30px 20px",color:T.textMuted,fontSize:14}}>
              <div style={{fontSize:36,marginBottom:10}}>📋</div>
              No daily reports yet. Click <strong>+ Add Report</strong> to start tracking site progress.
            </div>
          );

          if (!projRigsPA.length) return (
            <div style={{display:"flex",flexDirection:"column",gap:8,padding:"4px 0"}}>
              {reports.map(r=><DrCardPA key={r.id} r={r}/>)}
            </div>
          );

          // Grouped by rig
          const unassignedPA = reports.filter(r=>!r.rig||!projRigsPA.some(x=>x.name===r.rig));
          return (
            <div style={{display:"flex",flexDirection:"column",gap:12,padding:"4px 0"}}>
              {projRigsPA.map((rig,ri)=>{
                const color    = rigColors[ri%rigColors.length];
                const rigReps  = reports.filter(r=>r.rig===rig.name).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                return (
                  <div key={rig.id||rig.name} style={{border:`2px solid ${color}44`,borderRadius:14,overflow:"hidden"}}>
                    {/* Rig header */}
                    <div style={{background:`${color}14`,borderBottom:`1px solid ${color}33`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:18}}>🔩</span>
                        <div>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color}}>{rig.name}</div>
                          <div style={{fontSize:11,color:T.textMuted}}>{rigReps.length} report{rigReps.length!==1?"s":""}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {rigReps.length>0&&(
                          <button onClick={()=>exportRigReports(rigReps,rig.name)}
                            style={{background:`${color}18`,border:`1px solid ${color}44`,color,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            ⬇ Export {rig.name}
                          </button>
                        )}
                        <button onClick={()=>setDrModal({rig:rig.name})}
                          style={{background:`${color}22`,border:`1px solid ${color}55`,color,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                          + Add Report
                        </button>
                      </div>
                    </div>
                    {/* Rig reports */}
                    <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                      {rigReps.length===0
                        ?<div style={{textAlign:"center",padding:"16px",fontSize:13,color:T.textMuted}}>No reports yet for {rig.name}</div>
                        :rigReps.map(r=><DrCardPA key={r.id} r={r}/>)
                      }
                    </div>
                  </div>
                );
              })}
              {unassignedPA.length>0&&(
                <div style={{border:`1px dashed ${T.gold}55`,borderRadius:14,overflow:"hidden"}}>
                  <div style={{background:`${T.gold}08`,borderBottom:`1px solid ${T.gold}33`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.gold}}>⚠ Unassigned Reports</div>
                      <div style={{fontSize:11,color:T.textMuted}}>{unassignedPA.length} report{unassignedPA.length!==1?"s":""} — click Auto-Assign to match by filename</div>
                    </div>
                    <button onClick={()=>exportRigReports(unassignedPA,"Unassigned")}
                      style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      ⬇ Export Unassigned
                    </button>
                  </div>
                  <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                    {unassignedPA.map(r=>(
                      <div key={r.id} style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:T.card}}>
                          <div style={{width:32,height:32,borderRadius:7,background:T.goldDim,border:`1px solid ${T.gold}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📅</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{fmtDate(r.date)}</div>
                            {r.fileLink&&<div style={{fontSize:11,color:T.blue,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📎 {r.fileName||"File attached"}</div>}
                          </div>
                          {/* Quick-assign rig dropdown */}
                          <select
                            defaultValue=""
                            onChange={e=>{ if(e.target.value) assignRig(r.id, e.target.value); }}
                            style={{background:T.inputBg,border:`1px solid ${T.gold}55`,borderRadius:7,padding:"6px 10px",fontSize:12,color:T.text,outline:"none",cursor:"pointer",colorScheme:"light",minWidth:140}}
                          >
                            <option value="">Assign to rig…</option>
                            {projRigsPA.map(rig=><option key={rig.id||rig.name} value={rig.name}>{rig.name}</option>)}
                          </select>
                          <button onClick={e=>{e.stopPropagation();setDrModal(r);}} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer",flexShrink:0}}>✎</button>
                          {isAdmin&&<button onClick={e=>{e.stopPropagation();delReport(r.id);}} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer",flexShrink:0}}>✕</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {editProj&&<ProjectAnalysisModal proj={proj} projectNames={projectNames} workOrders={(data.projectDocs||[]).filter(d=>d.subTab==="workorders")} onSave={p=>{onUpdate(p);setEditProj(false);}} onClose={()=>setEditProj(false)}/>}
      {drModal&&<DailyReportModal report={drModal==="new"?null:drModal} projectName={proj.project} rigs={(data.rigs||[]).filter(r=>r.project===proj.project)} onSave={saveReport} onClose={()=>setDrModal(null)}/>}
      </> /* end detailTab===overview */}
    </div>
  );
}

/* ── Project Analysis list page ── */
function ProjectAnalysisPage({ data, setData, showToast, go, isAdmin }) {
  const [modal,  setModal]  = useState(null);
  const [detail, setDetail] = useState(null);
  const [fStat,  setFStat]  = useState("All");
  const [search, setSearch] = useState("");
  const [showDprConsolidate, setShowDprConsolidate] = useState(false);
  const [proTab, setProTab] = useState("portfolio");

  const projects  = data.projects || [];
  const projectDocs = data.projectDocs || [];

  // Auto-sync: any project in data.projects not yet in projectAnalysis gets added automatically
  const rawAnalysis = data.projectAnalysis || [];
  const workOrders = projectDocs.filter(d => d.subTab === "workorders");

  // Get contract value for a project from its work order (highest amount if multiple)
  const getWorkOrderValue = (projectName) => {
    const wo = workOrders.filter(d => d.project === projectName);
    if (!wo.length) return "";
    return String(Math.max(...wo.map(d => parseFloat(d.amount) || 0)) || "");
  };

  const analysis = useMemo(() => {
    const existingIds = new Set(rawAnalysis.map(x => x.project));
    const autoAdded = projects
      .filter(p => !existingIds.has(typeof p === "string" ? p : p.name))
      .map(p => {
        const name = typeof p === "string" ? p : p.name;
        return { id: uid(), project: name, status: "Active", poValue: "", clientName: typeof p === "object" ? (p.client || "") : "", poNumber: "", quotationRef: "", notes: "" };
      });
    return autoAdded.length > 0 ? [...rawAnalysis, ...autoAdded] : rawAnalysis;
  }, [projects, rawAnalysis]);

  // Persist auto-synced entries to data
  useEffect(() => {
    if (analysis.length > rawAnalysis.length) {
      setData(prev => ({ ...prev, projectAnalysis: analysis }));
    }
  }, [analysis.length]);

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
    const woValue = getWorkOrderValue(detailRec.project);
    return <ProjectAnalysisDetail
      proj={{...detailRec, poValue: woValue || detailRec.poValue}} projectDocs={projectDocs} projectNames={projects}
      data={data} setData={setData} showToast={showToast}
      onUpdate={p=>{update(p);setDetail(p.id);}} onDelete={()=>del(detailRec.id)}
      onBack={()=>setDetail(null)} go={go} isAdmin={isAdmin}/>;
  }

  // Enrich each record with live invoice stats + work order contract value
  const enriched = analysis.map(p => ({
    ...p,
    poValue: getWorkOrderValue(p.project) || p.poValue,
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
          <button onClick={()=>{
            const rows = visible.map(p=>{
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
            printPage("Project Analysis Report", `
              <h1>📊 PROJECT ANALYSIS</h1>
              <div class="meta">Generated ${new Date().toLocaleDateString()} · ${visible.length} project${visible.length!==1?"s":""}${fStat!=="All"?` · Filter: ${fStat}`:""}${search?` · Search: "${search}"`:""}
              </div>
              <div class="kpi-grid">
                <div class="kpi"><div class="kpi-val">${formatSarCompact(totalPO)}</div><div class="kpi-lbl">Total PO Value</div></div>
                <div class="kpi"><div class="kpi-val">${formatSarCompact(totalInvoiced)}</div><div class="kpi-lbl">Total Invoiced</div></div>
                <div class="kpi"><div class="kpi-val">${formatSarCompact(totalCollected)}</div><div class="kpi-lbl">Total Collected</div></div>
                <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Total Due</div></div>
                <div class="kpi"><div class="kpi-val">${enriched.filter(x=>x.status==="In Progress").length}</div><div class="kpi-lbl">In Progress</div></div>
                <div class="kpi"><div class="kpi-val">${enriched.filter(x=>x.status==="Completed").length}</div><div class="kpi-lbl">Completed</div></div>
              </div>
              <h2>Project Details</h2>
              <table>
                <thead><tr><th>Project</th><th>PO Number</th><th>Status</th><th>PO Value</th><th>Invoiced</th><th>Collected</th><th>Due</th><th>Progress</th><th>Start</th><th>End</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            `);
          }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:11,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            🖨 Print
          </button>
          <button onClick={()=>setShowDprConsolidate(true)}
            style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:11,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            📊 DPR Consolidation
          </button>
          <button onClick={()=>setModal("new")} style={{background:`linear-gradient(135deg,${T.gold},#d97706)`,border:"none",color:"#000",borderRadius:11,padding:"11px 22px",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:`0 4px 14px ${T.gold}44`}}>+ New Project</button>
        </div>
      </div>

      {/* Risk alerts + tab navigation */}
      <RiskAlertsBar enriched={enriched} data={data} onOpenProject={setDetail} />
      <ProjectAnalysisProNav tab={proTab} setTab={setProTab} riskCount={computeRiskInsights(enriched, costSheetsByProject(data.costSheets)).total} />

      {proTab==="portfolio" && (<>

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
                    <button onClick={()=>{ const {invs,jobs,ungroupedInvs,ungroupedCerts,totalInvoiced,totalCollected,totalDue,...clean}=p; setModal(clean); }} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer"}}>✎</button>
                    {isAdmin && <button onClick={()=>del(p.id)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,cursor:"pointer"}}>✕</button>}
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

      </>)}

      {proTab==="analytics" && <AnalyticsTab enriched={enriched} />}
      {proTab==="timeline"  && <TimelineTab enriched={enriched} onOpenProject={setDetail} />}
      {proTab==="budget"    && <BudgetTab enriched={enriched} data={data} setData={setData} showToast={showToast} isAdmin={isAdmin} onOpenProject={setDetail} />}
      {proTab==="reports"   && <ReportsTab enriched={enriched} fStat={fStat} search={search} risk={computeRiskInsights(enriched, costSheetsByProject(data.costSheets))} />}

      {showDprConsolidate&&<DprConsolidateModal projectAnalysis={analysis} projectDocs={data.projectDocs||[]} rigs={data.rigs||[]} crossings={data.crossings||[]} setData={setData} showToast={showToast} onClose={()=>setShowDprConsolidate(false)}/>}
      {modal&&<ProjectAnalysisModal proj={modal==="new"?null:modal} projectNames={projects} workOrders={workOrders} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}



export { ProjectAnalysisPage };
