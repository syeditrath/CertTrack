import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme, live } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, METHOD_STATEMENT_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA, excelDateToStr } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, FLink, FileLink, FilePreviewModal, PageHeader, Empty, CatManagerModal, BulkUploadModal, MultiPdfCertUpload, pctColor } from "./UI.jsx";
import { FinanceLoginPage } from "./FinancePage.jsx";

/* ─── Estimate categories (mirrors ProjectAnalysis.jsx's DAY_CATEGORIES classification) ── */
const EST_CATEGORIES = [
  { key:"preparation", label:"Preparation",  short:"Prep",  color:"#5b9bd5" },
  { key:"mobilization", label:"Mobilization", short:"Mob",   color:"#a78bfa" },
  { key:"pilot",        label:"Pilot",        short:"Pilot", color:"#2dd4bf" },
  { key:"reaming",      label:"Reaming",      short:"Ream",  color:"#f2a93b" },
  { key:"cleanpass",    label:"Clean Pass",   short:"Clean", color:"#f472b6" },
  { key:"pullpipe",     label:"Pull Pipe",    short:"Pull",  color:"#fb923c" },
];

// Standby (no permit) always takes priority over whatever activity was logged.
function classifyDayForEstimate(r) {
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

/* ─── HSE & Project Document Categories ─────────────────────────────────── */
const HSE_CATEGORIES = [
  "Pre-Mobilization Checklist","NAPD Certification","Risk Assessment",
  "Method Statement","JSA / Job Safety Analysis","Toolbox Talk Records",
  "Incident Report","Near Miss Report","Emergency Response Plan",
  "PPE Inspection","Environmental Permit","Safety Audit","Other",
];

const PROJDOC_CATEGORIES = [
  "Contract","Purchase Order","Work Order","Subcontract","Insurance Certificate",
  "Performance Bond","Project Schedule","Drawings / Blueprints","Inspection Report",
  "Material Approval","Site Survey","As-Built Document","Correspondence","Other",
];

const MSD_CATEGORIES = [
  "Method Statement","Drawing","Shop Drawing","As-Built Drawing","Technical Submittal",
  "Engineering Calculation","Layout Plan","Isometric Drawing","Revision / Markup","Other",
];

const PD_TABS = [
  {id:"certificates",    label:"Job Completion Certificates", icon:"📜", color:T.blue,   dim:T.blueDim},
  {id:"dailyreports",    label:"Daily Reports",               icon:"📅", color:T.gold,   dim:T.goldDim},
  {id:"hse",             label:"HSE",                         icon:"🦺", color:"#22c55e", dim:"rgba(34,197,94,0.12)"},
  {id:"projectdocuments",label:"Project Documents",           icon:"📁", color:"#a78bfa", dim:"rgba(167,139,250,0.12)"},
  {id:"methodstatement", label:"Method Statement & Drawing",  icon:"📐", color:"#fb923c", dim:"rgba(251,146,60,0.12)"},
];

const HOURS_PER_DAY = 10;   // full working day = 10 permit hours
const CAPACITY_OFF_DAY = 5; // Date.getDay(): 0=Sun … 5=Fri … 6=Sat — Fridays excluded from capacity

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
        top: { style: "thin", color: { rgb: "8B6914" } },
        bottom: { style: "thin", color: { rgb: "8B6914" } },
        left: { style: "thin", color: { rgb: "8B6914" } },
        right: { style: "thin", color: { rgb: "8B6914" } },
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
          top: { style: "thin", color: { rgb: "E8D5B7" } },
          bottom: { style: "thin", color: { rgb: "E8D5B7" } },
          left: { style: "thin", color: { rgb: "E8D5B7" } },
          right: { style: "thin", color: { rgb: "E8D5B7" } },
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

/* Total hours worked (sum of Permit Hours, cell H14 on each daily report)
   vs. total hours of capacity (working days between the first and last
   report in the set, excluding Fridays, × 10h/day). */
function computeHoursSummary(reports, hoursPerDay = HOURS_PER_DAY) {
  const list = reports || [];
  const workedHours = list.reduce((s, r) => s + (parseFloat(r.permitHours) || 0), 0);

  const validDates = list
    .map(r => r.date)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !Number.isNaN(d.getTime()));

  if (validDates.length === 0) {
    return { workedHours, capacityHours: 0, workingDays: 0, utilization: 0 };
  }

  const start = new Date(Math.min(...validDates));
  const end   = new Date(Math.max(...validDates));
  let workingDays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== CAPACITY_OFF_DAY) workingDays++;
    cur.setDate(cur.getDate() + 1);
  }

  const capacityHours = workingDays * hoursPerDay;
  const utilization = capacityHours > 0 ? Math.round((workedHours / capacityHours) * 100) : 0;
  return { workedHours, capacityHours, workingDays, utilization };
}

/* Compact inline badge — used in rig / crossing headers */
function HoursBadge({ reports }) {
  const { workedHours, capacityHours, utilization } = computeHoursSummary(reports);
  if (capacityHours === 0) return null;
  const color = pctColor(utilization);
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:`${color}18`,border:`1px solid ${color}44`,color,borderRadius:7,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
      ⏱ {Math.round(workedHours)}h / {capacityHours}h · {utilization}%
    </span>
  );
}

/* Larger KPI-style row — used at the top of a project's Daily Reports view */
function HoursSummaryPanel({ reports }) {
  const hs = computeHoursSummary(reports);
  if (hs.capacityHours === 0) return null;
  const color = pctColor(hs.utilization);
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:T.blue,lineHeight:1}}>{Math.round(hs.workedHours)}h</div>
        <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:600}}>HOURS WORKED (Permit)</div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:T.textSub,lineHeight:1}}>{hs.capacityHours}h</div>
        <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:600}}>CAPACITY ({hs.workingDays}d × {HOURS_PER_DAY}h, Fridays excluded)</div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color,lineHeight:1}}>{hs.utilization}%</div>
        <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:600}}>UTILIZATION</div>
      </div>
    </div>
  );
}

function ProjectDocs({data,setData,showToast,onManageProjects,isAdmin}) {
  // ALL hooks must be at the top — never after a conditional return
  const [selectedProject, setSelectedProject] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedRig, setSelectedRig] = useState(null);
  const [collapsedRigs, setCollapsedRigs] = useState({});
  const toggleRig = id => setCollapsedRigs(p => ({...p, [id]: !p[id]}));
  const [collapsedCrossings, setCollapsedCrossings] = useState({});
  const toggleCrossing = id => setCollapsedCrossings(p => ({...p, [id]: !p[id]}));
  const [subTab,  setSubTab]  = useState("certificates");
  const [selProj, setSelProj] = useState(null);
  const [modal,   setModal]   = useState(null);
  const [fProj,   setFProj]   = useState("");
  const [bulkModal, setBulkModal] = useState(false);
  const [multiPdfModal, setMultiPdfModal] = useState(null);
  const [rigInput, setRigInput] = useState("");
  const [crossingPanelRig, setCrossingPanelRig] = useState("");
  const [crossingPanelName, setCrossingPanelName] = useState("");
  const [msAuthed, setMsAuthed] = useState(false);
  const docs     = live(data.projectDocs).filter(d=>!d._deleted);
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
          rig:            savedDoc.rig,
          crossing:       savedDoc.crossing,
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
    setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===id?{...d,_deleted:true}:d)}));
    showToast("Deleted","del");
  };

  // ── Rig management ──────────────────────────────────────────────────
  const rigs = live(data.rigs).filter(r=>!r._deleted);
  const analysisMap = Object.fromEntries(
  (data.projectAnalysis || []).map(p => [p.project, p.status || "Active"])
);
  const STATUS_OPTS = ["All", "In Progress", "Not Started", "On Hold", "Completed", "Cancelled"];
  const crossings = live(data.crossings).filter(c=>!c._deleted);
  const projRigs = selectedProject ? rigs.filter(r=>r.project===selectedProject) : [];
  const projCrossings = selectedProject ? crossings.filter(c=>c.project===selectedProject) : [];

  const addRig = () => {
    const name = rigInput.trim();
    if (!name) { showToast("Enter a rig name first","del"); return; }
    if (!selectedProject) { showToast("No project selected","del"); return; }
    if (rigs.some(r=>r.project===selectedProject && r.name===name)) { showToast("Rig already exists","del"); return; }
    setData(prev=>({...prev, rigs:[...(prev.rigs||[]), {id:uid(), project:selectedProject, name}]}));
    setRigInput("");
    showToast("Rig added ✓");
  };
  const delRig = id => {
    setData(prev=>({...prev, rigs:(prev.rigs||[]).map(r=>r.id===id?{...r,_deleted:true}:r)}));
    showToast("Rig removed","del");
  };

  const addCrossing = (project, rig, name) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (crossings.some(c=>c.project===project && c.rig===rig && c.name===trimmed)) {
      showToast("Crossing already exists","del");
      return;
    }
    setData(prev=>({...prev, crossings:[...(prev.crossings||[]), {id:uid(), project, rig, name:trimmed, status:"Active", estimates:{}}]}));
    showToast("Crossing added ✓");
  };

  const updateCrossingEstimate = (id, category, value) => {
    const num = value!=null && value!=="" ? Number(value) : null;
    setData(prev=>({...prev, crossings:(prev.crossings||[]).map(c=>c.id===id?{...c, estimates:{...(c.estimates||{}), [category]: num}}:c)}));
  };

  const toggleCrossingStatus = (id) => {
    setData(prev=>({
      ...prev,
      crossings:(prev.crossings||[]).map(c=>c.id===id?{...c,status:c.status==="Completed"?"Active":"Completed"}:c),
    }));
  };

  const delCrossing = id => {
    setData(prev=>({...prev, crossings:(prev.crossings||[]).map(c=>c.id===id?{...c,_deleted:true}:c)}));
    showToast("Crossing removed","del");
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

        {/* Status filter */}
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{
                padding:"6px 14px", borderRadius:999,
                border:`1px solid ${filterStatus===s ? T.blue : T.border}`,
                background: filterStatus===s ? T.blueDim : "transparent",
                color: filterStatus===s ? T.blue : T.textSub,
                fontSize:12, fontWeight: filterStatus===s ? 700 : 500,
                cursor:"pointer", transition:"all .15s"
              }}>
              {s}
              {s !== "All" && (
                <span style={{opacity:.6, marginLeft:4}}>
                  ({projects.filter(p => analysisMap[pName(p)] === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {projects.length===0
          ? <Empty icon="◆" label="No projects yet" sub="Add projects from Manage Projects in the sidebar" color={T.blue} onAdd={() => onManageProjects && onManageProjects()}/>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
              {projects
                .filter(p => filterStatus === "All" || analysisMap[pName(p)] === filterStatus)
                .map((project,i)=>{ project=pName(project);
                const projectDocs = docs.filter(d=>d.project===project);
                const projectCerts = projectDocs.filter(d=>d.subTab==="certificates");
                const projectDailyReports = projectDocs.filter(d=>d.subTab==="dailyreports");
                const projectStatus = analysisMap[project];
                const stColor = {"Not Started":T.textMuted,"In Progress":T.blue,"On Hold":T.gold,"Completed":T.green,"Cancelled":T.red}[projectStatus]||T.textMuted;

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
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                        <div style={{width:42,height:42,borderRadius:12,background:T.blueDim,display:"flex",alignItems:"center",justifyContent:"center",color:T.blue,fontSize:18,fontWeight:800}}>◆</div>
                        {projectStatus && (
                          <span style={{background:`${stColor}18`,border:`1px solid ${stColor}44`,color:stColor,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                            {projectStatus}
                          </span>
                        )}
                      </div>
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

                    {(()=>{ const rc=rigs.filter(r=>r.project===project).length; if(!rc) return null; const rigNames=rigs.filter(r=>r.project===project).map(r=>r.name); return (<div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>{rigNames.map(n=><span key={n} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",fontSize:11,color:T.textMuted,fontWeight:600}}>🔩 {n}</span>)}</div>); })()}
                    {projectDailyReports.length>0 && (
                      <div style={{marginTop:10}}>
                        <HoursBadge reports={projectDailyReports}/>
                      </div>
                    )}
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
      <SubTabBar tabs={PD_TABS.map(t=>t.id==="methodstatement"&&!msAuthed?{...t,label:`🔒 ${t.label}`}:t)} active={subTab} counts={counts} onChange={changeTab}/>

      {subTab === "dailyreports" && <HoursSummaryPanel reports={projDRs}/>}

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
    {projRigs.map(r => {
      const eqCount = (data.equipment || []).filter(
        e => e.rig === r.name && e.project === selectedProject
      ).length;
      const maintCount = (data.equipment || [])
        .filter(e => e.rig === r.name && e.project === selectedProject)
        .flatMap(e => (e.maintenance || []).filter(t => (t.status || "Open") !== "Closed"))
        .length;

      return (
        <span
          key={r.id}
          style={{
            background: T.card2,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 11,
            color: T.textMuted,
            fontWeight: 600
          }}
        >
          🔩 {r.name}
        </span>
      );
    })}
  </div>
)}

      {/* ── Crossings panel ── */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.text}}>
            🛤️ CROSSINGS
            <span style={{marginLeft:8,fontSize:12,color:T.textMuted,fontWeight:500,fontFamily:"inherit"}}>{projCrossings.filter(c=>!c._deleted).length} defined</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <select
              value={crossingPanelRig}
              onChange={e=>setCrossingPanelRig(e.target.value)}
              style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
            >
              <option value="">Select rig…</option>
              {projRigs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            <input
              value={crossingPanelName}
              onChange={e=>setCrossingPanelName(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter" && crossingPanelRig){ addCrossing(selectedProject, crossingPanelRig, crossingPanelName); setCrossingPanelName(""); } }}
              placeholder="Crossing name…"
              style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.text,outline:"none",width:190}}
            />
            <button type="button" onClick={()=>{
              if (!crossingPanelRig) { showToast("Select a rig first","del"); return; }
              addCrossing(selectedProject, crossingPanelRig, crossingPanelName);
              setCrossingPanelName("");
            }}
              style={{background:T.gold,border:"none",color:"#000",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              + Add Crossing
            </button>
          </div>
        </div>
        <div style={{fontSize:11,color:T.textMuted,marginTop:8}}>Set per-activity day estimates below — actual counts update automatically from daily reports.</div>
        {projCrossings.filter(c=>!c._deleted).length > 0 && (
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
            {projCrossings.filter(c=>!c._deleted).map(c => {
              const isCompleted = c.status === "Completed";
              const estimates = c.estimates || {};
              const crossingReports = drAll.filter(d=>d.project===selectedProject && d.rig===c.rig && d.crossing===c.name && !d._deleted);
              return (
                <div key={c.id} style={{background: isCompleted ? T.greenDim : T.card2, border:`1px solid ${isCompleted?T.green+"44":T.border}`, borderRadius:10, padding:"10px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700,color:isCompleted?T.green:T.text}}>🛤️ {c.name}</span>
                    <span style={{fontSize:11,color:T.textMuted}}>({c.rig})</span>
                    <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto"}}>{crossingReports.length} report{crossingReports.length!==1?"s":""}</span>
                    <button onClick={()=>toggleCrossingStatus(c.id)} title={isCompleted?"Mark Active":"Mark Completed"}
                      style={{background:isCompleted?T.green:"transparent",border:`1px solid ${isCompleted?T.green:T.border}`,color:isCompleted?"#000":T.textMuted,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      {isCompleted?"✓ Completed":"Mark Completed"}
                    </button>
                    {isAdmin && <button onClick={()=>delCrossing(c.id)} title="Remove" style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:13,padding:0}}>✕</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
                    {EST_CATEGORIES.map(cat => {
                      const actual = crossingReports.filter(r=>classifyDayForEstimate(r)===cat.key).length;
                      const est = estimates[cat.key];
                      const over = est!=null && actual > est;
                      return (
                        <div key={cat.key} style={{background:T.bg,border:`1px solid ${over?T.red+"55":T.border}`,borderRadius:7,padding:"5px 6px",textAlign:"center"}}>
                          <div style={{fontSize:9.5,color:cat.color,fontWeight:700,marginBottom:3}}>{cat.short}</div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:2}}>
                            <input
                              type="number"
                              defaultValue={est ?? ""}
                              onBlur={e=>{ const v=e.target.value; if (v!==String(est??"")) updateCrossingEstimate(c.id, cat.key, v); }}
                              placeholder="—"
                              style={{width:26,background:"transparent",border:"none",outline:"none",color:T.text,fontSize:11,fontWeight:700,textAlign:"center"}}
                            />
                            <span style={{fontSize:10,color:T.textMuted}}>/</span>
                            <span style={{fontSize:11,fontWeight:700,color:over?T.red:T.textSub}}>{actual}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

        <div style={{display:"flex", gap:8}}>
          <Btn color={T.blue} onClick={()=>setMultiPdfModal({project:selProj})}>⬆ Upload PDFs</Btn>
          <Btn color={T.blue} solid onClick={()=>setModal({mode:"add",doc:{project:selProj}})}>+ Add Manually</Btn>
        </div>
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
                  {isAdmin && <ABtn color={T.red} onClick={()=>delDoc(doc.id)}>✕</ABtn>}
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

      {/* ══ DAILY REPORTS ══ */}
{subTab === "dailyreports" && (() => {

  const DrCard = ({doc, i}) => (
    <div key={doc.id} className="fade-up"
      style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.gold}`,borderRadius:12,padding:"14px 16px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:12}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(13px,1.1vw,16px)",color:T.text}}>{doc.name}</span>
          {doc.date&&<Tag color={T.gold}>{fmtDate(doc.date)}</Tag>}
          {doc.rig&&<Tag color={T.purple}>🔩 {doc.rig}</Tag>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {doc.refNo&&<Chip>Ref: {doc.refNo}</Chip>}
          {doc.fileLink&&<FileLink href={doc.fileLink}/>}
        </div>
        {doc.notes&&<div style={{marginTop:5,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        {doc.fileLink&&<a href={doc.fileLink} download onClick={e=>e.stopPropagation()} title="Download" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:7,background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,fontSize:14,textDecoration:"none"}}>⬇</a>}
        {isAdmin&&<ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>}
        {isAdmin&&<ABtn color={T.red}  onClick={()=>delDoc(doc.id)}>✕</ABtn>}
      </div>
    </div>
  );

  const rigColors = ["#a78bfa","#38bdf8","#34d399","#f472b6","#fb923c","#fbbf24"];

  const exportDRs = (docs, filename) => {
    if (!docs.length) return;
    exportToExcel(docs.map(r=>({
      "Project":            r.project||selectedProject,
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
    })), filename);
  };

  // ── Per-project view ──
  if (selProj) {
    const rigSections = projRigs.map((rig, ri) => {
      const rigReports = projDRs.filter(d=>d.rig===rig.name);
      const rigCrossings = crossings.filter(c=>c.project===selProj && c.rig===rig.name);
      const crossingSections = rigCrossings.map(c => ({
        crossing: c,
        reports: rigReports.filter(d=>d.crossing===c.name).sort((a,b)=>(b.date||"").localeCompare(a.date||"")),
      }));
      const noCrossingReports = rigReports
        .filter(d=>!d.crossing || !rigCrossings.some(c=>c.name===d.crossing))
        .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      return {
        rig,
        color: rigColors[ri % rigColors.length],
        reports: rigReports.sort((a,b)=>(b.date||"").localeCompare(a.date||"")),
        crossingSections,
        noCrossingReports,
      };
    });
    const unassigned = projDRs
      .filter(d=>!d.rig||!projRigs.some(r=>r.name===d.rig))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

    return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={backToProjects} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Back</button>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selectedProject}</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>{projDRs.length} report{projDRs.length!==1?"s":""} · {projRigs.length} rig{projRigs.length!==1?"s":""}</div>
          </div>
          {projDRs.length>0&&(
            <button onClick={()=>exportDRs(projDRs,`Daily_Reports_${(selectedProject||"Project").replace(/\s+/g,"_")}_ALL_RIGS`)}
              style={{background:`${T.green}18`,border:`1px solid ${T.green}44`,color:T.green,borderRadius:9,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              ⬇ Export All Rigs
            </button>
          )}
        </div>

        {projRigs.length===0 ? (
          <div>
            <div style={{background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"14px 16px",marginBottom:16,fontSize:13,color:T.gold}}>
              🔩 No rigs defined for this project yet. Add rigs using the panel above.
            </div>
            {projDRs.length===0
              ?<Empty icon="📅" label="No daily reports yet" sub="Add rigs first, then add daily reports per rig" color={T.gold} onAdd={()=>setModal({mode:"add",doc:{project:selProj}})}/>
              :<div style={{display:"grid",gap:8}}>{projDRs.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)}</div>
            }
          </div>
        ) : (
          <div style={{display:"grid",gap:16}}>
            {rigSections.map(({rig, color, reports, crossingSections, noCrossingReports})=>{
              const isCollapsed = collapsedRigs[rig.id];
              const activeCrossings = crossingSections.filter(cs=>cs.crossing.status!=="Completed");
              const completedCrossings = crossingSections.filter(cs=>cs.crossing.status==="Completed");
              return (
                <div key={rig.id} style={{background:T.card,border:`2px solid ${color}44`,borderRadius:16,overflow:"hidden"}}>
                  {/* Rig header */}
                  <div
                    onClick={()=>toggleRig(rig.id)}
                    style={{background:`${color}18`,borderBottom:isCollapsed?"none":`1px solid ${color}33`,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",cursor:"pointer",userSelect:"none"}}
                  >
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:13,color,transition:"transform 0.2s",display:"inline-block",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)"}}>▼</span>
                      <span style={{fontSize:20}}>🔩</span>
                      <div>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color}}>{rig.name}</div>
                        <div style={{fontSize:12,color:T.textMuted,marginTop:1}}>
                          {isCollapsed?`${reports.length} report${reports.length!==1?"s":""} · ${activeCrossings.length} active crossing${activeCrossings.length!==1?"s":""} — click to expand`:`${reports.length} report${reports.length!==1?"s":""} · ${activeCrossings.length} active crossing${activeCrossings.length!==1?"s":""}`}
                        </div>
                      </div>
                      <HoursBadge reports={reports}/>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                      {reports.length>0&&(
                        <button
                          onClick={()=>exportDRs(reports,`Daily_Reports_${(selectedProject||"Project").replace(/\s+/g,"_")}_${rig.name.replace(/\s+/g,"_")}`)}
                          style={{background:`${color}18`,border:`1px solid ${color}44`,color,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                          ⬇ Export {rig.name}
                        </button>
                      )}
                      <Btn color={color} solid onClick={()=>setModal({mode:"add",doc:{project:selProj,rig:rig.name}})}>+ Add Report</Btn>
                    </div>
                  </div>
                  {/* Collapsible body */}
                  {!isCollapsed&&(
                    <div style={{padding:"14px 16px",display:"grid",gap:12}}>
                      {activeCrossings.length===0 && completedCrossings.length===0 && noCrossingReports.length===0 && (
                        <div style={{textAlign:"center",padding:"20px 0",fontSize:13,color:T.textMuted}}>
                          No crossings yet — <button onClick={()=>setModal({mode:"add",doc:{project:selProj,rig:rig.name}})} style={{background:"none",border:"none",color,fontWeight:700,cursor:"pointer",padding:0,fontSize:13}}>add a report to create one</button>
                        </div>
                      )}

                      {/* Active crossings */}
                      {activeCrossings.map(({crossing, reports:crReports})=>{
                        const isCrCollapsed = collapsedCrossings[crossing.id];
                        return (
                          <div key={crossing.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
                            <div
                              onClick={()=>toggleCrossing(crossing.id)}
                              style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",cursor:"pointer",userSelect:"none"}}
                            >
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:11,color:T.textMuted,transition:"transform 0.2s",display:"inline-block",transform:isCrCollapsed?"rotate(-90deg)":"rotate(0deg)"}}>▼</span>
                                <span style={{fontSize:14}}>📍</span>
                                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.text}}>{crossing.name}</span>
                                <span style={{fontSize:11,color:T.textMuted}}>({crReports.length} report{crReports.length!==1?"s":""})</span>
                                <HoursBadge reports={crReports}/>
                              </div>
                              <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                                {crReports.length>0&&(
                                  <button onClick={()=>exportDRs(crReports,`Daily_Reports_${(selectedProject||"Project").replace(/\s+/g,"_")}_${rig.name.replace(/\s+/g,"_")}_${crossing.name.replace(/\s+/g,"_")}`)}
                                    style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                    ⬇ Export
                                  </button>
                                )}
                                <button onClick={()=>toggleCrossingStatus(crossing.id)}
                                  style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                  ✓ Mark Completed
                                </button>
                                {isAdmin&&(
                                  <button onClick={()=>{if(window.confirm("Delete this crossing? Reports will remain but become unassigned."))delCrossing(crossing.id);}}
                                    style={{background:T.redDim,border:`1px solid ${T.red}44`,color:T.red,borderRadius:7,padding:"5px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                            {!isCrCollapsed&&(
                              <div style={{padding:"0 14px 12px",display:"grid",gap:8}}>
                                {crReports.length===0
                                  ?<div style={{textAlign:"center",padding:"12px 0",fontSize:12,color:T.textMuted}}>No reports yet for this crossing</div>
                                  :crReports.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)
                                }
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Completed crossings, collapsed by default styling */}
                      {completedCrossings.length>0&&(
                        <div style={{marginTop:4}}>
                          <div style={{fontSize:11,color:T.textMuted,fontWeight:700,marginBottom:8,letterSpacing:".05em"}}>✓ COMPLETED CROSSINGS</div>
                          <div style={{display:"grid",gap:8}}>
                            {completedCrossings.map(({crossing, reports:crReports})=>{
                              return (
                                <div key={crossing.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",opacity:0.75}}>
                                  <div
                                    onClick={()=>toggleCrossing(crossing.id)}
                                    style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",cursor:"pointer",userSelect:"none"}}
                                  >
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{fontSize:11,color:T.textMuted,transition:"transform 0.2s",display:"inline-block",transform:collapsedCrossings[crossing.id]===false?"rotate(0deg)":"rotate(-90deg)"}}>▼</span>
                                      <span style={{fontSize:14}}>✅</span>
                                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textMuted,textDecoration:"line-through"}}>{crossing.name}</span>
                                      <span style={{fontSize:11,color:T.textMuted}}>({crReports.length} report{crReports.length!==1?"s":""})</span>
                                      <HoursBadge reports={crReports}/>
                                    </div>
                                    <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                                      {crReports.length>0&&(
                                        <button onClick={()=>exportDRs(crReports,`Daily_Reports_${(selectedProject||"Project").replace(/\s+/g,"_")}_${rig.name.replace(/\s+/g,"_")}_${crossing.name.replace(/\s+/g,"_")}`)}
                                          style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                          ⬇ Export
                                        </button>
                                      )}
                                      <button onClick={()=>toggleCrossingStatus(crossing.id)}
                                        style={{background:T.goldDim,border:`1px solid ${T.gold}44`,color:T.gold,borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                        ↺ Reopen
                                      </button>
                                      {isAdmin&&(
                                        <button onClick={()=>{if(window.confirm("Delete this crossing? Reports will remain but become unassigned."))delCrossing(crossing.id);}}
                                          style={{background:T.redDim,border:`1px solid ${T.red}44`,color:T.red,borderRadius:7,padding:"5px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {collapsedCrossings[crossing.id]===false&&(
                                    <div style={{padding:"0 14px 12px",display:"grid",gap:8}}>
                                      {crReports.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Reports under this rig with no crossing assigned (legacy / not yet tagged) */}
                      {noCrossingReports.length>0&&(
                        <div style={{marginTop:4}}>
                          <div style={{fontSize:11,color:T.textMuted,fontWeight:700,marginBottom:8,letterSpacing:".05em"}}>⚠ NO CROSSING ASSIGNED</div>
                          <div style={{display:"grid",gap:8}}>
                            {noCrossingReports.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned reports */}
            {unassigned.length>0&&(
              <div style={{background:T.card,border:`1px dashed ${T.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.textSub}}>Unassigned Reports</div>
                    <div style={{fontSize:12,color:T.textMuted}}>{unassigned.length} report{unassigned.length!==1?"s":""} not linked to a rig</div>
                  </div>
                </div>
                <div style={{padding:"14px 16px",display:"grid",gap:8}}>
                  {unassigned.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── All-projects view ──
  const drDocs = fProj ? drAll.filter(d=>d.project===fProj) : drAll;
  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>DAILY REPORTS</div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Site activity and progress reports — per rig, per project</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
            <option value="">All Projects</option>
            {renderProjectOptions(projects)}
          </select>
        </div>
      </div>
      {drDocs.length===0
        ?<Empty icon="📅" label="No daily reports yet" sub="Open a project and add reports per rig" color={T.gold}/>
        :<div style={{display:"grid",gap:8}}>
          {drDocs.map((doc,i)=>(
            <div key={doc.id} className="fade-up"
              style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.gold}`,borderRadius:12,padding:"14px 16px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(13px,1.1vw,16px)",color:T.text}}>{doc.name}</span>
                  {doc.project&&<Tag color={T.teal}>{doc.project}</Tag>}
                  {doc.rig&&<Tag color={T.purple}>🔩 {doc.rig}</Tag>}
                  {doc.date&&<Tag color={T.gold}>{fmtDate(doc.date)}</Tag>}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {doc.refNo&&<Chip>Ref: {doc.refNo}</Chip>}
                  {doc.fileLink&&<FileLink href={doc.fileLink}/>}
                </div>
                {doc.notes&&<div style={{marginTop:5,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                {isAdmin&&<ABtn color={T.red} onClick={()=>delDoc(doc.id)}>✕</ABtn>}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
})()}
      {/* ══ HSE ════════════════════════════════════════════════════════ */}
      {subTab==="hse" && (
        <HseSection
          docs={docs.filter(d=>d.subTab==="hse" && (!selectedProject||d.project===selectedProject))}
          projects={projects}
          selectedProject={selectedProject}
          isAdmin={isAdmin}
          showToast={showToast}
          onAdd={doc=>setData(prev=>({...prev,projectDocs:[...prev.projectDocs,{...doc,id:uid(),subTab:"hse"}]}))}
          onEdit={doc=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===doc.id?{...doc,subTab:"hse"}:d)}))}
          onDel={id=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===id?{...d,_deleted:true}:d)}))}
        />
      )}

      {/* ══ PROJECT DOCUMENTS ════════════════════════════════════════════ */}
      {subTab==="projectdocuments" && (
        <ProjectDocumentsSection
          docs={docs.filter(d=>d.subTab==="projectdocuments" && (!selectedProject||d.project===selectedProject))}
          projects={projects}
          selectedProject={selectedProject}
          isAdmin={isAdmin}
          showToast={showToast}
          onAdd={doc=>setData(prev=>({...prev,projectDocs:[...prev.projectDocs,{...doc,id:uid(),subTab:"projectdocuments"}]}))}
          onEdit={doc=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===doc.id?{...doc,subTab:"projectdocuments"}:d)}))}
          onDel={id=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===id?{...d,_deleted:true}:d)}))}
        />
      )}

      {/* ══ METHOD STATEMENT & DRAWING ═══════════════════════════════════ */}
      {subTab==="methodstatement" && (
        msAuthed ? (
          <MethodStatementSection
            docs={docs.filter(d=>d.subTab==="methodstatement" && (!selectedProject||d.project===selectedProject))}
            projects={projects}
            selectedProject={selectedProject}
            isAdmin={isAdmin}
            showToast={showToast}
            onAdd={doc=>setData(prev=>({...prev,projectDocs:[...prev.projectDocs,{...doc,id:uid(),subTab:"methodstatement"}]}))}
            onEdit={doc=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===doc.id?{...doc,subTab:"methodstatement"}:d)}))}
            onDel={id=>setData(prev=>({...prev,projectDocs:prev.projectDocs.map(d=>d.id===id?{...d,_deleted:true}:d)}))}
          />
        ) : (
          <FinanceLoginPage title="METHOD STATEMENT & DRAWING ACCESS" subtitle="This section is restricted.\nEnter the password to continue." passwordLabel="METHOD STATEMENT PASSWORD" placeholder="Enter password…" buttonLabel="UNLOCK SECTION" onLogin={(pw) => {
            if (pw === METHOD_STATEMENT_PASSWORD) { setMsAuthed(true); return true; }
            return false;
          }}/>
        )
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}
      {modal && subTab==="certificates"  && <CertificateModal  mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {modal && subTab==="dailyreports"  && <ProjectDocDailyReportModal mode={modal.mode} doc={modal.doc} projects={projects} defaultProject={selectedProject} rigs={rigs} crossings={crossings} onAddCrossing={addCrossing} onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {bulkModal && <BulkUploadModal subTab={subTab} projects={projects} onClose={()=>setBulkModal(false)} onImport={(rows)=>{ setData(prev=>({...prev,projectDocs:[...prev.projectDocs,...rows.map(r=>({...r,id:uid(),subTab}))]})); setBulkModal(false); showToast(`✓ ${rows.length} records imported`); }}/>}
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
    </div>
  );
}

function ProjectDocUploadModal({ title, categories, projects, selectedProject, onClose, onSave }) {
  const [form, setForm] = useState({
    project:  selectedProject||"",
    category: "",
    name:     "",
    notes:    "",
    fileLink: "",
    fileName: "",
    expiryDate:"",
  });
  const [file,      setFile]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState("");
  const fileRef = useRef();

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSave = async () => {
    if (!form.project)  { setMsg("Please select a project."); return; }
    if (!form.category) { setMsg("Please select a category."); return; }
    if (!form.name)     { setMsg("Please enter a document name."); return; }
    setUploading(true);
    let fileLink = form.fileLink, fileName = form.fileName;
    if (file) {
      try {
        fileLink = await uploadFile(file, `docs/${form.project.replace(/\s+/g,"_")}`);
        fileName = file.name;
      } catch(e) {
        setMsg("⚠ File upload failed: " + e.message);
        setUploading(false);
        return;
      }
    }
    onSave({ ...form, fileLink, fileName, date: new Date().toISOString().slice(0,10) });
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:520,padding:"24px 28px",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>{title}</div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Project */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>PROJECT *</label>
            <select value={form.project} onChange={e=>set("project",e.target.value)}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}>
              <option value="">Select project…</option>
              {renderProjectOptions(projects)}
            </select>
          </div>
          {/* Category */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>CATEGORY *</label>
            <select value={form.category} onChange={e=>set("category",e.target.value)}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}>
              <option value="">Select category…</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Document Name */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>DOCUMENT NAME *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Pre-Mobilization Checklist – May 2026"
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none"}}
              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {/* Expiry Date */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>EXPIRY DATE (optional)</label>
            <input type="date" value={form.expiryDate} onChange={e=>set("expiryDate",e.target.value)}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {/* File Upload */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>UPLOAD FILE</label>
            <div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${T.green}44`,borderRadius:10,padding:"14px",textAlign:"center",cursor:"pointer",background:`${T.green}06`}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.background=`${T.green}12`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=`${T.green}44`;e.currentTarget.style.background=`${T.green}06`;}}>
              {file ? <span style={{fontSize:13,color:T.green,fontWeight:600}}>📎 {file.name}</span>
                    : <span style={{fontSize:13,color:T.textMuted}}>Click to select file (PDF, Word, Image…)</span>}
            </div>
            <input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>setFile(e.target.files[0])}/>
          </div>
          {/* Notes */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>NOTES</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} placeholder="Optional notes…"
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",resize:"vertical"}}/>
          </div>
          {msg && <div style={{fontSize:12,color:T.red}}>{msg}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
            <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={handleSave} disabled={uploading}
              style={{background:`linear-gradient(135deg,${T.green},${T.teal})`,border:"none",color:"#000",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:800,cursor:uploading?"not-allowed":"pointer",opacity:uploading?0.7:1}}>
              {uploading?"Uploading…":"Save Document"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function DocSectionUI({ docs, categories, accentColor, accentDim, projects, selectedProject, isAdmin, showToast, onAdd, onEdit, onDel, title, icon, catList }) {
  const [modal,   setModal]   = useState(null); // null | "add" | doc
  const [selCat,  setSelCat]  = useState("All");
  const [selProj, setSelProj] = useState(selectedProject||"All");

  const filtered = docs.filter(d =>
    (selCat==="All"  || d.category===selCat) &&
    (selProj==="All" || d.project===selProj)
  );

  const grouped = catList.reduce((acc, cat) => {
    const catDocs = filtered.filter(d=>d.category===cat);
    if (catDocs.length) acc[cat] = catDocs;
    return acc;
  }, {});

  const uncategorised = filtered.filter(d=>!catList.includes(d.category));
  if (uncategorised.length) grouped["Other"] = [...(grouped["Other"]||[]), ...uncategorised];

  return (
    <div>
      {/* Toolbar */}
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <div style={{flex:1,display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* Project filter */}
          {!selectedProject && (
            <select value={selProj} onChange={e=>setSelProj(e.target.value)}
              style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,outline:"none",colorScheme:"light"}}>
              <option value="All">All Projects</option>
              {projects.map(p=><option key={p.project} value={p.project}>{p.project}</option>)}
            </select>
          )}
          {/* Category filter */}
          <select value={selCat} onChange={e=>setSelCat(e.target.value)}
            style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:T.text,outline:"none",colorScheme:"light"}}>
            <option value="All">All Categories</option>
            {catList.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={()=>setModal("add")}
          style={{background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,border:"none",color:"#fff",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          + Add Document
        </button>
      </div>

      {/* Empty state */}
      {!filtered.length && (
        <div style={{textAlign:"center",padding:"48px 24px",color:T.textMuted}}>
          <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
          <div style={{fontSize:16,fontWeight:700,color:T.textSub,marginBottom:6}}>No {title} documents yet</div>
          <div style={{fontSize:13}}>Click <strong>+ Add Document</strong> to upload your first one</div>
        </div>
      )}

      {/* Grouped by category */}
      {Object.entries(grouped).map(([cat, catDocs])=>(
        <div key={cat} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:4,height:20,background:accentColor,borderRadius:2}}/>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:accentColor}}>{cat}</div>
            <div style={{background:accentDim,border:`1px solid ${accentColor}44`,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700,color:accentColor}}>{catDocs.length}</div>
          </div>
          <div style={{display:"grid",gap:10}}>
            {catDocs.map(doc=>(
              <div key={doc.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:accentDim,border:`1px solid ${accentColor}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {/\.pdf$/i.test(doc.fileName||"")?"📄":/\.(xlsx?|csv)$/i.test(doc.fileName||"")?"📊":/\.(png|jpe?g|webp)$/i.test(doc.fileName||"")?"🖼️":"📁"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>📂 {doc.project}</span>
                    {doc.date&&<span>📅 {doc.date}</span>}
                    {doc.expiryDate&&<span style={{color:new Date(doc.expiryDate)<new Date()?T.red:T.gold}}>⏳ Expires {doc.expiryDate}</span>}
                    {doc.notes&&<span>💬 {doc.notes}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  {doc.fileLink&&(
                    <a href={doc.fileLink} target="_blank" rel="noreferrer"
                      style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                      ↗ View
                    </a>
                  )}
                  {isAdmin&&<button onClick={()=>setModal(doc)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✎</button>}
                  {isAdmin&&<button onClick={()=>{ if(confirm(`Delete "${doc.name}"?`)) onDel(doc.id); }} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer"}}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Modal */}
      {modal && (
        <ProjectDocUploadModal
          title={modal==="add" ? `Add ${title} Document` : `Edit Document`}
          categories={catList}
          projects={projects}
          selectedProject={selectedProject}
          onClose={()=>setModal(null)}
          onSave={doc => {
            if (modal==="add") onAdd(doc);
            else onEdit({...modal,...doc});
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function HseSection(props) {
  return <DocSectionUI {...props} title="HSE" icon="🦺" accentColor="#22c55e" accentDim="rgba(34,197,94,0.12)" catList={HSE_CATEGORIES}/>;
}

function ProjectDocumentsSection(props) {
  return <DocSectionUI {...props} title="Project Documents" icon="📁" accentColor="#a78bfa" accentDim="rgba(167,139,250,0.12)" catList={PROJDOC_CATEGORIES}/>;
}

function MethodStatementSection(props) {
  return <DocSectionUI {...props} title="Method Statement & Drawing" icon="📐" accentColor="#fb923c" accentDim="rgba(251,146,60,0.12)" catList={MSD_CATEGORIES}/>;
}

/* ─── SubTabBar ─────────────────────────────────────────────────────────── */
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
function InvoiceCard({ doc, delay, onEdit, onDel, isAdmin }) {
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
        {isAdmin && <ABtn color={T.blue} onClick={onEdit}>✎</ABtn>}
        {isAdmin && <ABtn color={T.red} onClick={onDel}>✕</ABtn>}
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

/* ─── Daily Progress Report (DPR) Excel Parsing ─────────────────────────── */
const DR_COL_MAP = {
  "DATE":"date","REPORT DATE":"date","DAY":"date",
  "WEATHER":"weather","WEATHER CONDITIONS":"weather","CONDITIONS":"weather",
  "CROSSING":"crossing","CROSSING NO":"crossing","CROSSING NO.":"crossing","CROSSING NAME":"crossing","CROSSING/KP":"crossing","KP":"crossing","KP NO":"crossing","CROSSING LOCATION":"crossing",
  "ACTIVITIES":"activities","WORK DONE":"activities","WORK":"activities","ACTIVITY":"activities","DESCRIPTION":"activities","WORK DESCRIPTION":"activities",
  "MANPOWER":"manpower","MANPOWER COUNT":"manpower","WORKERS":"manpower","NO. OF WORKERS":"manpower","HEADCOUNT":"manpower","NO OF WORKERS":"manpower",
  "EQUIPMENT":"equipment","EQUIPMENT USED":"equipment","PLANT":"equipment","PLANT & EQUIPMENT":"equipment","MACHINERY":"equipment",
  "ISSUES":"issues","DELAYS":"issues","ISSUES / DELAYS":"issues","PROBLEMS":"issues","REMARKS":"issues",
  "NOTES":"notes","ADDITIONAL NOTES":"notes","COMMENTS":"notes","SUPERVISOR NOTES":"notes",
};

/* ── Scorpion DPR template cell reader ───────────────────────────────────── */
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
    crossing:       erp["crossing"] || erp["crossing_no"] || erp["crossing_name"] || "",
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

function ProjectDocDailyReportModal({mode,doc,projects,defaultProject,rigs,crossings,onAddCrossing,onClose,onSave}) {
  const [f,setF] = useState({ project: defaultProject || "", rig: "", crossing: "", ...(doc || {}) });
  const [parsing,setParsing] = useState(false);
  const [msg,setMsg] = useState("");
  const [newCrossingName,setNewCrossingName] = useState("");
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
        fileUrl = await uploadFile(
          file,
          `daily-reports/${(f.project || defaultProject || "general").replace(/[^a-zA-Z0-9]/g, "_")}`
        );
      } catch (uploadErr) {
        console.error("File upload failed:", uploadErr);
        setMsg("⚠ File uploaded to app but could not be stored in cloud: " + (uploadErr.message || "Unknown error"));
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
        const projRigsForValidation = (rigs||[]).filter(r=>r.project===f.project);
        if (projRigsForValidation.length > 0 && !f.rig) {
          alert("Please select a rig for this project");
          return;
        }
        if (f.rig && !f.crossing) {
          alert("Please select or add a crossing for this rig");
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
        <FSelect value={f.project || ""} onChange={v => setF(p => ({...p, project:v, rig:""}))} color={T.gold}>
          <option value="">Select project…</option>
          {renderProjectOptions(projects)}
        </FSelect>
      </FieldRow>

      {f.project && (() => {
        const projRigs = (rigs||[]).filter(r=>r.project===f.project);
        if (!projRigs.length) return null;
        return (
          <FieldRow label="Rig / Spread *">
            <FSelect value={f.rig||""} onChange={v=>setF(p=>({...p,rig:v,crossing:""}))} color={T.gold}>
              <option value="">Select rig…</option>
              {projRigs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </FSelect>
          </FieldRow>
        );
      })()}

      {f.project && f.rig && (() => {
        const rigCrossings = (crossings||[]).filter(c=>c.project===f.project && c.rig===f.rig && c.status!=="Completed");
        return (
          <FieldRow label="Crossing *">
            <FSelect value={f.crossing||""} onChange={v=>setF(p=>({...p,crossing:v}))} color={T.gold}>
              <option value="">Select crossing…</option>
              {rigCrossings.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </FSelect>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input
                value={newCrossingName}
                onChange={e=>setNewCrossingName(e.target.value)}
                onKeyDown={e=>{
                  if(e.key==="Enter"){
                    e.preventDefault();
                    const name=newCrossingName.trim();
                    if(!name) return;
                    onAddCrossing(f.project, f.rig, name);
                    setF(p=>({...p,crossing:name}));
                    setNewCrossingName("");
                  }
                }}
                placeholder="New crossing name…"
                style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px",fontSize:13,color:T.text,outline:"none"}}
              />
              <button type="button" onClick={()=>{
                const name=newCrossingName.trim();
                if(!name) return;
                onAddCrossing(f.project, f.rig, name);
                setF(p=>({...p,crossing:name}));
                setNewCrossingName("");
              }} style={{background:T.gold,border:"none",color:"#000",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                + Add Crossing
              </button>
            </div>
          </FieldRow>
        );
      })()}

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

export { ProjectDocs, parseDailyReportExcel };
