import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { Btn, Chip, Tag, Overlay } from "./UI.jsx";

function Sidebar({page,go,sideOpen,alerts,data,viewportWidth,isAdmin,onManageProjects,darkMode,onToggleDark,onLogout,financeAuthed,analysisAuthed,costAuthed}) {
  const isMobile = viewportWidth < 1200;
  const NAV = [
    {id:"dashboard", icon:"▦", label:"Dashboard",          desc:"Overview"},
    {id:"scorpion",  icon:"◉", label:"Scorpion Documents", desc:"Company docs & licenses"},
    {id:"projects",  icon:"◆", label:"Project Docs",       desc:"Certs & daily reports"},
    {id:"analysis",  icon:"◐", label:"Project Analysis",   desc:"PO value, progress & jobs", locked:!analysisAuthed},
    {id:"costs",     icon:"⊕", label:"Cost Control",       desc:"Budget vs actual, margin",  locked:!costAuthed},
    {id:"manpower",  icon:"◈", label:"Manpower",           desc:"Staff & certifications"},
    {id:"equipment", icon:"◎", label:"Equipment",          desc:"Assets & records"},
    {id:"rigs", icon:"🔩", label:"RIGS", desc:"Rig fleet & attached equipment"},
    {id:"maintenance", icon:"🛠", label:"Maintenance", desc:"Equipment maintenance requests",},
    {id:"finance",   icon:"$", label:"Finance",            desc:"Invoices & work orders",    locked:!financeAuthed},
  ];
  const handleNav = (id) => {
    go(id);
    // auto-close sidebar on mobile after navigation
  };
  return (
    <aside style={{width:"clamp(220px,18vw,280px)",flexShrink:0,background:T.sidebar,borderRight:"none",display:"flex",flexDirection:"column",zIndex:50,position:isMobile?"fixed":"relative",top:0,left:0,height:"100%",transform:isMobile?(sideOpen?"translateX(0)":"translateX(-100%)"):"none",transition:"transform .28s ease",boxShadow:"2px 0 12px rgba(0,0,0,0.06)"}}>
      <div style={{padding:"16px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{position:"relative",flexShrink:0,width:56,height:56}}>
          {/* Spinning rings — thin and tight */}
          <div className="logo-ring-spin" style={{position:"absolute",inset:-2,borderRadius:"50%",border:"1px solid rgba(251,191,36,0.4)",pointerEvents:"none"}}/>
          <div className="logo-ring-spin-rev" style={{position:"absolute",inset:-5,borderRadius:"50%",border:"1px dashed rgba(56,189,248,0.18)",pointerEvents:"none"}}/>
          {/* Logo */}
          <div className="logo-animate" style={{width:56,height:56,borderRadius:"50%",background:"#000",overflow:"hidden",boxShadow:"0 0 16px rgba(251,191,36,0.35)",border:"1.5px solid rgba(251,191,36,0.4)",position:"relative",zIndex:1}}>
            <img src="logo.png" alt="Scorpion Arabia" style={{width:"100%",height:"100%",objectFit:"cover",mixBlendMode:"lighten"}}/>
          </div>
        </div>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.4vw,20px)",letterSpacing:"1px",lineHeight:1.1,background:"linear-gradient(90deg,#92400e,#fbbf24,#fef3c7,#fbbf24,#f59e0b,#92400e)",backgroundSize:"300% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"shimmer 8s linear infinite",filter:"drop-shadow(0 0 8px rgba(251,191,36,0.6))",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>SCORPION ARABIA</div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:"1.4px",marginTop:2,color:"#93c5fd"}}>PORTAL</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"10px 8px",flex:1,overflowY:"auto"}}>
          {NAV.map(n=>{
          const active=page===n.id;
          const badge=n.id==="dashboard"?alerts:0;
          return (
            <button key={n.id} onClick={()=>handleNav(n.id)} className="nav-item" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",marginBottom:2,textAlign:"left",background:active?"rgba(59,130,246,0.15)":"transparent",borderLeft:`2px solid ${active?"#93c5fd":"transparent"}`,transition:"all .15s",cursor:"pointer"}}>
              <span style={{fontSize:18,color:active?"#93c5fd":n.locked?"#64748b":"#94a3b8",flexShrink:0}}>{n.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:active?"#93c5fd":n.locked?"#64748b":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.label}</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.locked?"🔒 Locked":n.desc}</div>
              </div>
              {badge>0&&<span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      {/* Manage Projects */}
     
      <div style={{ padding: "6px 10px 0" }}>
  {isAdmin && (
    <button
      onClick={onManageProjects}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #334155",
        background: "transparent",
        textAlign: "left",
        transition: "all .15s",
        marginBottom: 4
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        e.currentTarget.style.borderColor = "#93c5fd";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "#334155";
      }}
    >
      <span style={{ fontSize: 16, color: T.blue }}>⊕</span>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>
          Manage Projects
        </div>

        <div style={{ fontSize: 10, color: "#64748b" }}>
          Add, rename, delete
        </div>
      </div>
    </button>
  )}
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
function ProjectsModal({projects,onSave,onClose,isAdmin}) {
  const [list,    setList]    = useState(projects.map(p=>typeof p==="string"?{name:p,client:"",contractValue:""}:{contractValue:"",...p}));
  const [newName, setNewName] = useState("");
  const [newClient,setNewClient]=useState("");
  const [newContractValue,setNewContractValue]=useState("");
  const [editing, setEditing] = useState(null); // {idx, field, val}

  const clients = [...new Set(list.map(p=>p.client).filter(Boolean))].sort();

  const add = () => {
    const n=newName.trim();
    if(!n||list.some(x=>x.name===n)) return;
    setList(l=>[...l,{name:n,client:newClient.trim(),contractValue:newContractValue.trim()}]);
    setNewName(""); setNewContractValue("");
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
        {editing&&editing.idx===p._idx&&editing.field==="contractValue"
          ?<input autoFocus type="number" value={editing.val} onChange={e=>setEditing({...editing,val:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(null);}} onBlur={commitEdit}
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.teal}`,borderRadius:6,padding:"3px 7px",fontSize:11,color:T.text,outline:"none",marginTop:3}}/>
          :<div style={{fontSize:11,color:p.contractValue?T.teal:T.textMuted,marginTop:2,cursor:"text"}} onDoubleClick={()=>startEdit(p._idx,"contractValue",p.contractValue||"")}>
            {p.contractValue?(`Contract: ${formatSarCompact(parseFloat(p.contractValue))}`):"No contract value — double-click to set"}
          </div>
        }
      </div>
      <button onClick={()=>startEdit(p._idx,"name",p.name)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,cursor:"pointer"}} title="Rename">✎</button>
      {isAdmin && <button onClick={()=>del(p._idx)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,cursor:"pointer"}} title="Delete">✕</button>}
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
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={newClient} onChange={e=>setNewClient(e.target.value)} list="existing-clients" onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="Client name (optional)…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=T.border}/>
            <datalist id="existing-clients">{clients.map(c=><option key={c} value={c}/>)}</datalist>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input type="number" value={newContractValue} onChange={e=>setNewContractValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="Contract / PO value (SAR, optional)…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 11px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}/>
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

export { Sidebar };
