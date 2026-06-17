import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, parseExcelRows, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, FLink, FileLink, FilePreviewModal, PageHeader, Empty, CatManagerModal } from "./UI.jsx";

function MaintenancePage({data,setData,showToast,isAdmin}) {
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
      const url = await uploadFile(file, folder);
      setCloseFile({link:url, name:file.name});
    } catch(err) {
      setClosingUpErr("Upload failed: " + (err.message||"check Cloudflare Worker config"));
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
      const url = await uploadFile(file, folder);
      setF(p=>({...p, fileLink:url, fileName:file.name}));
    } catch(err) {
      setUploadErr("Upload failed: " + (err.message||"check Cloudflare Worker config"));
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


  function EquipmentDetail({eq,projects,onBack,onUpdate,onDelete,onEdit,showToast,isAdmin}) {
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
        {isAdmin && <Btn color={T.red}  onClick={()=>{if(window.confirm("Delete?"))onDelete();}}>✕ Delete</Btn>}
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
          {records.map((r,i)=><SubRecordCard key={r.id} r={r} type={activeTab} color={curTab.color} delay={i*.03} onEdit={()=>setSubModal({mode:"edit",type:activeTab,rec:r})} onDel={()=>delSubRecord(activeTab,r.id)} isAdmin={isAdmin}/>)}
        </div>
      }

      {subModal&&<SubRecordModal mode={subModal.mode} type={subModal.type} rec={subModal.rec} projects={projects} onClose={()=>setSubModal(null)} onSave={(rec,mode)=>saveSubRecord(subModal.type,rec,mode)}/>}
    </div>
  );
}

function SubRecordCard({r,type,color,delay,onEdit,onDel,isAdmin}) {
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
        {isAdmin && <ABtn color={T.blue} onClick={onEdit}>✎</ABtn>}
        {isAdmin && <ABtn color={T.red}  onClick={onDel}>✕</ABtn>}
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

export { MaintenancePage };
