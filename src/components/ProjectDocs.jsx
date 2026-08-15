import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, FLink, FileLink, FilePreviewModal, PageHeader, Empty, CatManagerModal, BulkUploadModal, MultiPdfCertUpload } from "./UI.jsx";
import { PD_TABS, PROJDOC_CATEGORIES } from "./FinancePage.jsx";
import { parseDailyReportExcel } from "./ProjectAnalysis.jsx";

function ProjectDocs({data,setData,showToast,onManageProjects,isAdmin}) {
  // ALL hooks must be at the top — never after a conditional return
  const [selectedProject, setSelectedProject] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedRig, setSelectedRig] = useState(null);
  const [collapsedRigs, setCollapsedRigs] = useState({});
  const toggleRig = id => setCollapsedRigs(p => ({...p, [id]: !p[id]}));
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
  const analysisMap = Object.fromEntries(
  (data.projectAnalysis || []).map(p => [p.project, p.status || "Active"])
);
  const STATUS_OPTS = ["All", "In Progress", "Not Started", "On Hold", "Completed", "Cancelled"];
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

                    {(()=>{ const rc=(data.rigs||[]).filter(r=>r.project===project).length; if(!rc) return null; const rigNames=(data.rigs||[]).filter(r=>r.project===project).map(r=>r.name); return (<div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>{rigNames.map(n=><span key={n} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 8px",fontSize:11,color:T.textMuted,fontWeight:600}}>🔩 {n}</span>)}</div>); })()}
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
    const rigSections = projRigs.map((rig, ri) => ({
      rig,
      color: rigColors[ri % rigColors.length],
      reports: projDRs.filter(d=>d.rig===rig.name).sort((a,b)=>(b.date||"").localeCompare(a.date||"")),
    }));
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
            {rigSections.map(({rig, color, reports})=>{
              const isCollapsed = collapsedRigs[rig.id];
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
                          {isCollapsed?`${reports.length} report${reports.length!==1?"s":""} — click to expand`:`${reports.length} report${reports.length!==1?"s":""}`}
                        </div>
                      </div>
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
                    <div style={{padding:"14px 16px",display:"grid",gap:8}}>
                      {reports.length===0
                        ?<div style={{textAlign:"center",padding:"20px 0",fontSize:13,color:T.textMuted}}>
                          No reports yet — <button onClick={()=>setModal({mode:"add",doc:{project:selProj,rig:rig.name}})} style={{background:"none",border:"none",color,fontWeight:700,cursor:"pointer",padding:0,fontSize:13}}>add the first one</button>
                         </div>
                        :reports.map((doc,i)=><DrCard key={doc.id} doc={doc} i={i}/>)
                      }
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
          onDel={id=>setData(prev=>({...prev,projectDocs:prev.projectDocs.filter(d=>d.id!==id)}))}
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
          onDel={id=>setData(prev=>({...prev,projectDocs:prev.projectDocs.filter(d=>d.id!==id)}))}
        />
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}
      {modal && subTab==="certificates"  && <CertificateModal  mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {modal && subTab==="dailyreports"  && <ProjectDocDailyReportModal mode={modal.mode} doc={modal.doc} projects={projects} defaultProject={selectedProject} rigs={data.rigs||[]} onClose={()=>setModal(null)} onSave={saveDoc}/>}
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
        {isAdmin && (
          <button onClick={()=>setModal("add")}
            style={{background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,border:"none",color:"#fff",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            + Add Document
          </button>
        )}
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

/* ── Work Order modal ────────────────────────────────────────────────────── */
/* ─── Multi-PDF Invoice Upload ────────────────────────────────────────────── */
function MultiPdfInvoiceUpload({ project, projects, onClose, onImport }) {
  const [files,       setFiles]       = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState({});
  const [selProj,     setSelProj]     = useState(project || "");
  const dropRef                       = useRef();
  const fileInputRef                  = useRef();

  const STATUS_COLOR = { pending: T.textMuted, uploading: T.blue, done: T.green, error: T.red };
  const STATUS_ICON  = { pending: "⏳", uploading: "↑", done: "✓", error: "✕" };

  const cleanName = filename =>
    filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const addFiles = newFiles => {
    const pdfs = Array.from(newFiles).filter(f => /\.(pdf|png|jpg|jpeg|webp|doc|docx)$/i.test(f.name));
    if (!pdfs.length) return;
    const entries = pdfs.map(f => ({
      id:             uid(),
      file:           f,
      displayName:    cleanName(f.name),
      refNo:          "",
      jobNo:          "",
      amount:         "",
      paymentStatus:  "Pending",
      invoiceType:    "Income",
      dueDate:        "",
      remainingAmount:"",
      notes:          "",
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

  const updateField = (id, key, val) =>
    setFiles(prev => prev.map(f => f.id === id ? {...f, [key]: val} : f));

  const onDragOver  = e => { e.preventDefault(); dropRef.current.style.borderColor = T.green; };
  const onDragLeave = ()  => { dropRef.current.style.borderColor = `${T.green}44`; };
  const onDrop      = e   => {
    e.preventDefault();
    dropRef.current.style.borderColor = `${T.green}44`;
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
        const url = await uploadFile(entry.file, `invoices/${selProj.replace(/\s+/g,"_")}`);
        setProgress(prev => ({...prev, [entry.id]: "done"}));
        results.push({
          project:        selProj,
          name:           entry.displayName,
          refNo:          entry.refNo || "",
          jobNo:          entry.jobNo || "",
          amount:         entry.amount || "",
          paymentStatus:  entry.paymentStatus || "Pending",
          invoiceType:    entry.invoiceType || "Income",
          dueDate:        entry.dueDate || "",
          remainingAmount:entry.remainingAmount || "",
          notes:          entry.notes || "",
          fileLink:       url,
        });
      } catch (err) {
        setProgress(prev => ({...prev, [entry.id]: "error"}));
        console.error("Upload failed for", entry.file.name, err);
      }
    }
    setUploading(false);
    if (results.length) onImport(results);
    else alert("All uploads failed. Check your Cloudflare Worker configuration.");
  };

  const doneCount    = Object.values(progress).filter(s => s === "done").length;
  const errorCount   = Object.values(progress).filter(s => s === "error").length;
  const pendingCount = Object.values(progress).filter(s => s === "pending").length;
  const allDone      = uploading && doneCount + errorCount === files.length && files.length > 0;

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{
        background: T.sidebar, border: `1px solid ${T.border}`, borderRadius: 18,
        width: "100%", maxWidth: 720, maxHeight: "calc(100vh - 48px)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        {/* ── Header ── */}
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>
                📄 BULK INVOICE PDF UPLOAD
              </div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>
                Select multiple PDFs — fill invoice details for each, then upload all at once
              </div>
            </div>
            <button onClick={onClose} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer"}}>×</button>
          </div>
          {/* Project selector */}
          <div style={{marginTop:14}}>
            <label style={{display:"block", fontSize:11, fontWeight:700, color:T.textMuted, marginBottom:5, letterSpacing:".5px"}}>PROJECT *</label>
            <select
              value={selProj}
              onChange={e => setSelProj(e.target.value)}
              style={{width:"100%", background:T.inputBg, border:`1px solid ${selProj ? T.green+"66" : T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:selProj ? T.text : T.textMuted, outline:"none", colorScheme:"light"}}
            >
              <option value="">Select project…</option>
              {renderProjectOptions(projects)}
            </select>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{flex:1, overflowY:"auto", padding:"16px 24px"}}>
          {/* Drop zone */}
          <div
            ref={dropRef}
            onClick={() => !uploading && fileInputRef.current.click()}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={!uploading ? onDrop : undefined}
            style={{
              border: `2px dashed ${T.green}44`, borderRadius: 12,
              padding: files.length ? "16px" : "36px 24px",
              textAlign: "center", cursor: uploading ? "not-allowed" : "pointer",
              transition: "all .2s", background: `${T.green}06`, marginBottom: 14,
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor=T.green; e.currentTarget.style.background=`${T.green}12`; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${T.green}44`; e.currentTarget.style.background=`${T.green}06`; }}
          >
            {files.length === 0 ? (
              <>
                <div style={{fontSize:40, marginBottom:8}}>🧾</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color:T.text, marginBottom:4}}>
                  Drag & drop invoice PDFs here, or click to browse
                </div>
                <div style={{fontSize:12, color:T.textMuted}}>PDF, Word, PNG, JPG — select as many as you need</div>
              </>
            ) : (
              <div style={{fontSize:13, color:T.green, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                <span>+</span> Click or drop more files ({files.length} selected)
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            style={{display:"none"}} onChange={e => { addFiles(e.target.files); e.target.value=""; }}/>

          {/* Upload progress bar */}
          {uploading && (
            <div style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:14}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                <span style={{fontSize:13, fontWeight:700, color:T.text}}>Uploading…</span>
                <span style={{fontSize:13, color:T.textMuted}}>{doneCount + errorCount} / {files.length}</span>
              </div>
              <div style={{height:6, background:T.border, borderRadius:999, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${files.length ? ((doneCount + errorCount) / files.length * 100) : 0}%`, background:`linear-gradient(90deg, ${T.green}, ${T.teal})`, borderRadius:999, transition:"width .3s ease"}}/>
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
            <div style={{display:"grid", gap:12}}>
              {files.map((entry, i) => {
                const st      = progress[entry.id] || "pending";
                const stColor = STATUS_COLOR[st];
                const stIcon  = STATUS_ICON[st];
                const isExp   = st === "pending" || st === "error";
                const psColor = entry.paymentStatus === "Paid" ? T.green : entry.paymentStatus === "Partial" ? T.gold : T.red;

                return (
                  <div key={entry.id} className="fade-up" style={{
                    background: T.bg, border: `1px solid ${st==="done"?T.green+"44":st==="error"?T.red+"44":T.border}`,
                    borderLeft: `4px solid ${stColor}`, borderRadius: 10, padding: "12px 14px",
                    animationDelay: `${i * 0.03}s`,
                  }}>
                    {/* File header */}
                    <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: isExp ? 10 : 0}}>
                      <span style={{fontSize:18, flexShrink:0}}>{/\.pdf$/i.test(entry.file.name) ? "📄" : "🖼️"}</span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{entry.displayName}</div>
                        <div style={{fontSize:11, color:T.textMuted, marginTop:1}}>{(entry.file.size/1024/1024).toFixed(2)} MB</div>
                      </div>
                      <div style={{background:`${stColor}18`, border:`1px solid ${stColor}44`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, color:stColor, flexShrink:0, display:"flex", alignItems:"center", gap:5}}>
                        <span>{stIcon}</span><span style={{textTransform:"capitalize"}}>{st}</span>
                      </div>
                      {!uploading && (
                        <button onClick={() => removeFile(entry.id)} style={{background:T.redDim, border:`1px solid ${T.red}33`, color:T.red, borderRadius:6, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, cursor:"pointer", flexShrink:0}}>✕</button>
                      )}
                    </div>

                    {/* Editable fields */}
                    {isExp && !uploading && (
                      <div style={{display:"grid", gap:8, paddingTop:8, borderTop:`1px solid ${T.border}`}}>

                        {/* Row 1: Invoice No + Job No */}
                        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>INVOICE NO.</label>
                            <input value={entry.refNo} onChange={e => updateField(entry.id,"refNo",e.target.value)} placeholder="e.g. INV-2025-01"
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                          </div>
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>JOB NO.</label>
                            <input value={entry.jobNo} onChange={e => updateField(entry.id,"jobNo",e.target.value)} placeholder="e.g. JOB-001"
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                          </div>
                        </div>

                        {/* Row 2: Amount + Due Date */}
                        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>INVOICE VALUE (SAR)</label>
                            <input type="number" value={entry.amount} onChange={e => updateField(entry.id,"amount",e.target.value)} placeholder="0"
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                          </div>
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>DUE DATE</label>
                            <input type="date" value={entry.dueDate} onChange={e => updateField(entry.id,"dueDate",e.target.value)}
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                          </div>
                        </div>

                        {/* Row 3: Payment Status toggle */}
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>PAYMENT STATUS</label>
                          <div style={{display:"flex", gap:6}}>
                            {["Pending","Paid","Partial"].map(s => {
                              const active = entry.paymentStatus === s;
                              const col = s==="Paid"?T.green:s==="Partial"?T.gold:T.red;
                              return (
                                <button key={s} type="button" onClick={() => updateField(entry.id,"paymentStatus",s)}
                                  style={{flex:1, padding:"7px 0", borderRadius:7, border:`1px solid ${active?col:T.border}`, background:active?`${col}18`:"transparent", color:active?col:T.textMuted, fontSize:11, fontWeight:active?700:500, cursor:"pointer", transition:"all .15s"}}>
                                  {s==="Paid"?"✓ Paid":s==="Partial"?"½ Partial":"⏳ Pending"}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Remaining amount — only for Partial */}
                        {entry.paymentStatus === "Partial" && (
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.gold, marginBottom:4, letterSpacing:".5px"}}>REMAINING AMOUNT (SAR)</label>
                            <input type="number" value={entry.remainingAmount} onChange={e => updateField(entry.id,"remainingAmount",e.target.value)} placeholder="Amount still outstanding"
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.gold}66`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=`${T.gold}66`}/>
                          </div>
                        )}

                        {/* Row 4: Invoice Type toggle */}
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>INVOICE TYPE</label>
                          <div style={{display:"flex", gap:6}}>
                            {["Income","Advance"].map(s => {
                              const active = entry.invoiceType === s;
                              const col = s==="Income"?T.blue:T.purple;
                              return (
                                <button key={s} type="button" onClick={() => updateField(entry.id,"invoiceType",s)}
                                  style={{flex:1, padding:"7px 0", borderRadius:7, border:`1px solid ${active?col:T.border}`, background:active?`${col}18`:"transparent", color:active?col:T.textMuted, fontSize:11, fontWeight:active?700:500, cursor:"pointer", transition:"all .15s"}}>
                                  {s==="Income"?"💰 Income":"⏫ Advance"}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Row 5: Notes */}
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>NOTES</label>
                          <input value={entry.notes} onChange={e => updateField(entry.id,"notes",e.target.value)} placeholder="Optional notes…"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                        </div>
                      </div>
                    )}

                    {st === "done" && (
                      <div style={{marginTop:6, fontSize:11, color:T.green, display:"flex", alignItems:"center", gap:6}}>✓ Uploaded successfully</div>
                    )}
                    {st === "error" && (
                      <div style={{marginTop:6, fontSize:11, color:T.red}}>✕ Upload failed — check Cloudflare Worker config or file size</div>
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
              ? `${files.length} file${files.length!==1?"s":""} selected — each becomes one invoice record`
              : "No files selected yet"}
          </div>
          <button onClick={onClose} disabled={uploading}
            style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"11px 20px", fontSize:14, fontWeight:600, cursor:uploading?"not-allowed":"pointer", opacity:uploading?0.5:1}}>
            {allDone ? "Close" : "Cancel"}
          </button>
          {!uploading && files.length > 0 && (
            <button onClick={handleUploadAll} style={{
              background: `linear-gradient(135deg, ${T.green}, ${T.teal})`,
              border: "none", color: "#000", borderRadius: 10,
              padding: "11px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: `0 4px 16px ${T.green}44`,
            }}>
              ⬆ Upload {files.length} Invoice{files.length!==1?"s":""}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ─── Bulk Invoice Upload (Excel / CSV) ──────────────────────────────────── */
function BulkInvoiceUpload({ projects, onClose, onImport }) {
  const [step, setStep]         = useState(1); // 1=upload, 2=preview
  const [rows, setRows]         = useState([]);
  const [errors, setErrors]     = useState([]);
  const [fileName, setFileName] = useState("");
  const fileRef                 = useRef();
  const pNames = (projects||[]).map(p => typeof p==="string" ? p : (p.name||"")).filter(Boolean);

  // Flexible column header map (upper-cased keys)
  const COL_MAP = {
    // Invoice title / name
    "INVOICE TITLE":"name","INVOICE NAME":"name","TITLE":"name","NAME":"name","DESCRIPTION":"name","DESC":"name",
    // Project
    "PROJECT":"project","PROJECT NAME":"project",
    // Invoice / ref number
    "INVOICE NO":"refNo","INVOICE NO.":"refNo","INVOICE NUMBER":"refNo","INV NO":"refNo","REF NO":"refNo","REF NO.":"refNo","REFERENCE":"refNo","REF":"refNo",
    // Job number
    "JOB NO":"jobNo","JOB NO.":"jobNo","JOB NUMBER":"jobNo","JOB":"jobNo","PHASE":"jobNo",
    // Amount / value
    "AMOUNT":"amount","AMOUNT (SAR)":"amount","VALUE":"amount","INVOICE VALUE":"amount","INVOICE VALUE (SAR)":"amount","SAR":"amount","TOTAL":"amount","TOTAL (SAR)":"amount",
    // Due date
    "DUE DATE":"dueDate","DUE":"dueDate","PAYMENT DATE":"dueDate","DATE DUE":"dueDate",
    // Invoice date
    "DATE":"date","INVOICE DATE":"date","ISSUED DATE":"date","ISSUE DATE":"date",
    // Invoice type
    "TYPE":"invoiceType","INVOICE TYPE":"invoiceType","KIND":"invoiceType",
    // Payment status
    "STATUS":"paymentStatus","PAYMENT STATUS":"paymentStatus","PAYMENT":"paymentStatus",
    // Notes
    "NOTES":"notes","REMARKS":"notes","COMMENT":"notes","COMMENTS":"notes",
    // File link
    "FILE":"fileLink","FILE LINK":"fileLink","LINK":"fileLink","URL":"fileLink","ATTACHMENT":"fileLink",
  };

  const parseFile = file => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type:"binary", cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
        if (!raw.length) { setErrors(["File appears to be empty."]); return; }

        // Find header row (first row with recognisable columns)
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(6, raw.length); r++) {
          const upper = raw[r].map(c => String(c).toUpperCase().trim());
          if (upper.some(u => COL_MAP[u])) { headerRowIdx = r; break; }
        }

        const headers = raw[headerRowIdx].map(c => String(c).toUpperCase().trim());
        const colIdx  = {};
        headers.forEach((h, i) => { if (COL_MAP[h]) colIdx[COL_MAP[h]] = i; });

        if (!colIdx.amount && !colIdx.name) {
          setErrors(["Could not find required columns. Make sure your file has columns like: Invoice Title, Amount, Due Date, Project."]);
          return;
        }

        const parsed = [];
        const errs   = [];
        for (let r = headerRowIdx + 1; r < raw.length; r++) {
          const row = raw[r];
          if (row.every(c => String(c).trim() === "")) continue; // skip blank rows

          const get = key => {
            const i = colIdx[key];
            return i !== undefined ? String(row[i] ?? "").trim() : "";
          };

          const dateVal = v => {
            if (!v) return "";
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            if (typeof v === "number") {
              const d = new Date(Math.round((v - 25569) * 86400 * 1000));
              return isNaN(d) ? "" : d.toISOString().slice(0, 10);
            }
            const s = String(v).trim();
            const d = new Date(s);
            return isNaN(d) ? "" : d.toISOString().slice(0, 10);
          };

          const rawDate = colIdx.dueDate !== undefined ? row[colIdx.dueDate] : "";
          const rawInvoiceDate = colIdx.date !== undefined ? row[colIdx.date] : "";

          const name    = get("name")   || `Invoice ${r - headerRowIdx}`;
          const project = get("project") || "";
          const amount  = parseFloat(get("amount").replace(/[^0-9.-]/g, "")) || "";
          const dueDate = dateVal(rawDate);
          const date    = dateVal(rawInvoiceDate);
          const refNo   = get("refNo");
          const jobNo   = get("jobNo");
          const notes   = get("notes");
          const fileLink= get("fileLink");

          // Normalise invoiceType
          const rawType = get("invoiceType").toLowerCase();
          const invoiceType = rawType.includes("adv") ? "Advance" : "Income";

          // Normalise paymentStatus
          const rawStatus = get("paymentStatus").toLowerCase();
          const paymentStatus = rawStatus.includes("paid") && !rawStatus.includes("partial") ? "Paid"
            : rawStatus.includes("partial") ? "Partial"
            : "Pending";

          if (!amount && amount !== 0) errs.push(`Row ${r - headerRowIdx}: No amount found`);

          parsed.push({ name, project, amount, dueDate, date, refNo, jobNo, invoiceType, paymentStatus, notes, fileLink });
        }

        setRows(parsed);
        setErrors(errs);
        if (parsed.length) setStep(2);
      } catch(err) {
        setErrors(["Failed to parse file: " + (err.message || "unknown error")]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFilePick = e => { if (e.target.files[0]) { parseFile(e.target.files[0]); e.target.value=""; } };
  const onDrop = e => { e.preventDefault(); if (e.dataTransfer.files[0]) parseFile(e.dataTransfer.files[0]); };

  const updateRow = (i, key, val) => setRows(prev => prev.map((r, idx) => idx===i ? {...r, [key]:val} : r));

  const confirm = () => onImport(rows);

  const statusColor = s => s==="Paid"?T.green:s==="Partial"?T.gold:T.red;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:T.card,borderRadius:20,width:"min(860px,96vw)",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 28px 80px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>
                ⬆ BULK INVOICE IMPORT
              </div>
              <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>
                Upload an Excel or CSV file — one row per invoice
              </div>
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textMuted,fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
          </div>

          {/* Step indicator */}
          <div style={{display:"flex",gap:6,marginTop:14,alignItems:"center"}}>
            {["Upload File","Preview & Confirm"].map((label,i) => (
              <Fragment key={label}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:step>i?T.green:step===i+1?T.greenDim:T.border,border:`2px solid ${step>i?T.green:step===i+1?T.green:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:step>i?"#000":step===i+1?T.green:T.textMuted}}>
                    {step>i+1?"✓":i+1}
                  </div>
                  <span style={{fontSize:12,fontWeight:step===i+1?700:500,color:step===i+1?T.text:T.textMuted}}>{label}</span>
                </div>
                {i<1&&<div style={{width:24,height:2,background:step>1?T.green:T.border,borderRadius:1}}/>}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 26px"}}>

          {/* ── Step 1: Upload ── */}
          {step===1 && (
            <div>
              {/* Drop zone */}
              <div
                onDragOver={e=>e.preventDefault()} onDrop={onDrop}
                onClick={()=>fileRef.current.click()}
                style={{border:`2px dashed ${T.green}55`,borderRadius:14,padding:"44px 24px",textAlign:"center",cursor:"pointer",background:`${T.green}06`,marginBottom:20,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${T.green}12`;e.currentTarget.style.borderColor=T.green;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${T.green}06`;e.currentTarget.style.borderColor=`${T.green}55`;}}
              >
                <div style={{fontSize:40,marginBottom:10}}>📊</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text,marginBottom:6}}>
                  Drag & drop your Excel or CSV file here
                </div>
                <div style={{fontSize:13,color:T.textMuted}}>or click to browse · .xlsx, .xls, .csv supported</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFilePick}/>
              </div>

              {errors.length > 0 && (
                <div style={{background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
                  {errors.map((e,i) => <div key={i} style={{fontSize:13,color:T.red,fontWeight:600}}>⚠ {e}</div>)}
                </div>
              )}

              {/* Column guide */}
              <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 20px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color:T.textSub,marginBottom:10,letterSpacing:".5px"}}>EXPECTED COLUMNS (flexible — headers are auto-detected)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:6}}>
                  {[
                    {col:"Invoice Title",req:true,note:"Required"},
                    {col:"Project",req:false,note:"Match project name"},
                    {col:"Amount (SAR)",req:true,note:"Required"},
                    {col:"Due Date",req:false,note:"YYYY-MM-DD or DD/MM/YYYY"},
                    {col:"Invoice No.",req:false,note:"Reference number"},
                    {col:"Job No.",req:false,note:"Phase / job grouping"},
                    {col:"Invoice Type",req:false,note:"Income or Advance"},
                    {col:"Payment Status",req:false,note:"Pending / Paid / Partial"},
                    {col:"Invoice Date",req:false,note:"Date of issue"},
                    {col:"Notes",req:false,note:"Optional remarks"},
                  ].map(({col,req,note}) => (
                    <div key={col} style={{display:"flex",alignItems:"flex-start",gap:6}}>
                      <span style={{color:req?T.green:T.textMuted,fontWeight:700,fontSize:12,flexShrink:0,marginTop:1}}>{req?"●":"○"}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:T.text}}>{col}</div>
                        <div style={{fontSize:10,color:T.textMuted}}>{note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step===2 && (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{rows.length} invoice{rows.length!==1?"s":""} detected</span>
                  <span style={{fontSize:12,color:T.textMuted,marginLeft:10}}>from {fileName}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setStep(1);setRows([]);setErrors([]);}} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Re-upload</button>
                  <span style={{fontSize:12,color:T.textMuted,alignSelf:"center"}}>Review and edit before confirming</span>
                </div>
              </div>

              {errors.length > 0 && (
                <div style={{background:T.goldDim,border:`1px solid ${T.gold}44`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  {errors.map((e,i) => <div key={i} style={{fontSize:12,color:T.gold}}>⚠ {e}</div>)}
                </div>
              )}

              <div style={{display:"grid",gap:8}}>
                {rows.map((row,i) => (
                  <div key={i} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderLeft:`4px solid ${T.green}`,borderRadius:10,padding:"12px 16px",animationDelay:`${i*.02}s`}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>INVOICE TITLE *</label>
                        <input value={row.name} onChange={e=>updateRow(i,"name",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
                          onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>PROJECT</label>
                        <select value={row.project} onChange={e=>updateRow(i,"project",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:row.project?T.text:T.textMuted,outline:"none",colorScheme:"light"}}>
                          <option value="">— select —</option>
                          {pNames.map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>AMOUNT (SAR) *</label>
                        <input type="number" value={row.amount} onChange={e=>updateRow(i,"amount",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${!row.amount?T.red+"88":T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
                          onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=row.amount?T.border:T.red+"88"}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>DUE DATE</label>
                        <input type="date" value={row.dueDate} onChange={e=>updateRow(i,"dueDate",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
                          onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>INVOICE NO.</label>
                        <input value={row.refNo} onChange={e=>updateRow(i,"refNo",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
                          onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:".5px",display:"block",marginBottom:3}}>JOB NO.</label>
                        <input value={row.jobNo} onChange={e=>updateRow(i,"jobNo",e.target.value)}
                          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
                          onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      {/* Invoice Type toggle */}
                      <div style={{display:"flex",gap:4,background:T.card,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
                        {["Income","Advance"].map(t=>(
                          <button key={t} onClick={()=>updateRow(i,"invoiceType",t)}
                            style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:row.invoiceType===t?(t==="Income"?T.blueDim:T.purpleDim):"transparent",color:row.invoiceType===t?(t==="Income"?T.blue:T.purple):T.textMuted,transition:"all .15s"}}>
                            {t}
                          </button>
                        ))}
                      </div>
                      {/* Payment status toggle */}
                      <div style={{display:"flex",gap:4,background:T.card,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
                        {["Pending","Paid","Partial"].map(s=>(
                          <button key={s} onClick={()=>updateRow(i,"paymentStatus",s)}
                            style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:row.paymentStatus===s?`${statusColor(s)}22`:"transparent",color:row.paymentStatus===s?statusColor(s):T.textMuted,transition:"all .15s"}}>
                            {s}
                          </button>
                        ))}
                      </div>
                      {/* Amount preview */}
                      {row.amount && (
                        <span style={{fontSize:13,fontWeight:700,color:T.green,marginLeft:"auto"}}>
                          SAR {Number(row.amount).toLocaleString()}
                        </span>
                      )}
                      {/* Remove row */}
                      <button onClick={()=>setRows(prev=>prev.filter((_,idx)=>idx!==i))}
                        style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary bar */}
              {rows.length > 0 && (
                <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:10,padding:"10px 16px",marginTop:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.green}}>{rows.length} invoice{rows.length!==1?"s":""}</span>
                  <span style={{fontSize:13,color:T.textMuted}}>·</span>
                  <span style={{fontSize:14,fontWeight:700,color:T.green}}>SAR {rows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0).toLocaleString()} total value</span>
                  <span style={{fontSize:13,color:T.textMuted}}>·</span>
                  <span style={{fontSize:12,color:T.textMuted}}>{rows.filter(r=>r.dueDate).length} have due dates</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 26px 22px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:10,justifyContent:"flex-end",alignItems:"center"}}>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          {step===2 && rows.length>0 && (
            <button onClick={confirm}
              disabled={rows.some(r=>!r.name||!r.amount)}
              style={{background:`linear-gradient(135deg,${T.green},#059669)`,border:"none",color:"#000",borderRadius:10,padding:"11px 28px",fontSize:14,fontWeight:800,cursor:rows.some(r=>!r.name||!r.amount)?"not-allowed":"pointer",opacity:rows.some(r=>!r.name||!r.amount)?0.6:1,display:"flex",alignItems:"center",gap:8,boxShadow:`0 4px 16px ${T.green}44`}}>
              ✓ Import {rows.length} Invoice{rows.length!==1?"s":""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkWorkOrderUpload({ projects, onClose, onImport }) {
  const [rows, setRows] = useState([]); // [{file, name, project, status, url, error}]
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef();
  const pNames = (projects||[]).map(p => typeof p==="string"?p:(p.name||"")).filter(Boolean);

  const guessProject = filename => {
    const lower = filename.toLowerCase();
    return pNames.find(p => lower.includes(p.toLowerCase())) || "";
  };

  const handleFiles = files => {
    const arr = Array.from(files).map(file => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      project: guessProject(file.name),
      status: "pending",
      url: "",
      error: "",
    }));
    setRows(prev => [...prev, ...arr]);
  };

  const setRow = (i, patch) => setRows(prev => prev.map((r, idx) => idx===i ? {...r,...patch} : r));

  const upload = async () => {
    setUploading(true);
    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done") continue;
      setRows(r => r.map((x,idx) => idx===i ? {...x, status:"uploading"} : x));
      try {
        const url = await uploadFile(updated[i].file, "work-orders");
        updated[i] = {...updated[i], url, status:"done", error:""};
      } catch(e) {
        updated[i] = {...updated[i], status:"error", error: e.message||"Upload failed"};
      }
      setRows([...updated]);
    }
    setUploading(false);
    setDone(true);
  };

  const finish = () => {
    const docs = rows.filter(r=>r.status==="done").map(r=>({
      name: r.name,
      project: r.project,
      fileLinks: [{url:r.url, label:r.name}],
      fileLink: r.url,
    }));
    onImport(docs);
  };

  const allDone = rows.length > 0 && rows.every(r=>r.status==="done"||r.status==="error");
  const successCount = rows.filter(r=>r.status==="done").length;
  const statusColor = s => s==="done"?T.green:s==="error"?T.red:s==="uploading"?T.gold:T.textMuted;
  const statusIcon  = s => s==="done"?"✓":s==="error"?"✕":s==="uploading"?"⏳":"○";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:T.card,borderRadius:18,padding:28,width:"min(700px,95vw)",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.4)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>
            ⬆️ BULK WORK ORDER UPLOAD
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textMuted,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* Drop zone */}
        <div
          onClick={()=>inputRef.current.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}}
          style={{border:`2px dashed ${T.purple}66`,borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:T.bg,marginBottom:18,transition:"border-color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=T.purple}
          onMouseLeave={e=>e.currentTarget.style.borderColor=T.purple+"66"}
        >
          <div style={{fontSize:32,marginBottom:8}}>📂</div>
          <div style={{fontWeight:700,color:T.text,fontSize:15}}>Drop files here or click to browse</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>PDF, Word, Excel — one record created per file</div>
          <input ref={inputRef} type="file" multiple style={{display:"none"}} onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
        </div>

        {/* File rows */}
        {rows.length > 0 && (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:13,color:T.textSub,marginBottom:2}}>{rows.length} file{rows.length!==1?"s":""} queued</div>
            {rows.map((r,i) => (
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",background:T.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${statusColor(r.status)}33`}}>
                <span style={{fontSize:16,color:statusColor(r.status),flexShrink:0}}>{statusIcon(r.status)}</span>
                <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:4}}>
                  <input
                    value={r.name}
                    onChange={e=>setRow(i,{name:e.target.value})}
                    disabled={uploading||r.status==="done"}
                    placeholder="Work order name…"
                    style={{background:"transparent",border:"none",borderBottom:`1px solid ${T.border}`,color:T.text,fontSize:13,fontWeight:600,outline:"none",padding:"2px 0",width:"100%"}}
                  />
                  <select
                    value={r.project}
                    onChange={e=>setRow(i,{project:e.target.value})}
                    disabled={uploading||r.status==="done"}
                    style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",fontSize:12,color:r.project?T.text:T.textMuted,outline:"none",colorScheme:"light"}}
                  >
                    <option value="">Assign to project (optional)…</option>
                    {pNames.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  {r.error && <div style={{fontSize:11,color:T.red,fontWeight:600}}>{r.error}</div>}
                </div>
                {r.status!=="done" && r.status!=="uploading" && (
                  <button onClick={()=>setRows(prev=>prev.filter((_,idx)=>idx!==i))} style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          {!done
            ? <button onClick={upload} disabled={uploading||rows.length===0} style={{background:uploading||rows.length===0?"#555":`linear-gradient(135deg,${T.purple},#7c3aed)`,border:"none",color:"#fff",borderRadius:9,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:uploading||rows.length===0?"not-allowed":"pointer"}}>
                {uploading?"⏳ Uploading…":"⬆️ Upload All"}
              </button>
            : <button onClick={finish} disabled={successCount===0} style={{background:successCount===0?"#555":`linear-gradient(135deg,${T.green},#059669)`,border:"none",color:"#fff",borderRadius:9,padding:"10px 22px",fontSize:13,fontWeight:700,cursor:successCount===0?"not-allowed":"pointer"}}>
                ✓ Save {successCount} Work Order{successCount!==1?"s":""}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

function WorkOrderModal({mode,doc,projects,onClose,onSave}) {
  const initLinks = () => {
    if (doc?.fileLinks?.length) return doc.fileLinks;
    if (doc?.fileLink) return [{ url: doc.fileLink, label: "" }];
    return [{ url: "", label: "" }];
  };
  const [f,setF]=useState(doc||{});
  const [links,setLinks]=useState(initLinks);
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const setLink=(i,field)=>v=>setLinks(ls=>ls.map((l,idx)=>idx===i?{...l,[field]:v}:l));
  const addLink=()=>setLinks(ls=>[...ls,{url:"",label:""}]);
  const removeLink=i=>setLinks(ls=>ls.filter((_,idx)=>idx!==i));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} WORK ORDER / AGREEMENT`} color={T.purple} onClose={onClose}
      onSave={()=>{
        if(!f.name){alert("Title required");return;}
        const cleanLinks=links.filter(l=>l.url.trim());
        onSave({...f, fileLinks:cleanLinks, fileLink:cleanLinks[0]?.url||""},mode);
      }}>
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
      <FieldRow label="File Links">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {links.map((l,i)=>(
            <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
              <FInput value={l.label||""} onChange={setLink(i,"label")} color={T.purple} placeholder="Label (optional)…" style={{width:120,flexShrink:0}}/>
              <FLink value={l.url||""} onChange={setLink(i,"url")} style={{flex:1}}/>
              {links.length>1&&<button type="button" onClick={()=>removeLink(i)} style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 4px"}} title="Remove">✕</button>}
            </div>
          ))}
          <button type="button" onClick={addLink} style={{alignSelf:"flex-start",background:T.card,border:`1px dashed ${T.purple}66`,color:T.purple,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Another File Link</button>
        </div>
      </FieldRow>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.purple}/></FieldRow>
    </FormModal>
  );
}

function ProjectDocDailyReportModal({mode,doc,projects,defaultProject,rigs,onClose,onSave}) {
  const [f,setF] = useState({ project: defaultProject || "", rig: "", ...(doc || {}) });
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
            <FSelect value={f.rig||""} onChange={v=>setF(p=>({...p,rig:v}))} color={T.gold}>
              <option value="">Select rig…</option>
              {projRigs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </FSelect>
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

export { ProjectDocs };
