import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

/* ─── Global CSS ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: 'Barlow', sans-serif; background: #e8edf5; color: #0d1f35; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #e8edf5; }
  ::-webkit-scrollbar-thumb { background: #b8cce0; border-radius: 3px; }
  input, select, textarea, button { font-family: 'Barlow', sans-serif; }
  button { cursor: pointer; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
  @keyframes slideUp { from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);} }
  @keyframes fadeIn  { from{opacity:0;}to{opacity:1;} }
  @keyframes slideIn { from{opacity:0;transform:translateX(30px);}to{opacity:1;transform:translateX(0);} }
  .fade-up  { animation: fadeUp  0.3s ease both; }
  .slide-up { animation: slideUp 0.35s cubic-bezier(0.34,1.3,0.64,1) both; }
  .fade-in  { animation: fadeIn  0.2s ease both; }
  .slide-in { animation: slideIn 0.3s ease both; }
`;

/* ─── Theme ──────────────────────────────────────────────────────────────── */
const T = {
  bg:"#e8edf5",
  sidebar:"#1e3a5f",
  card:"#f4f7fb",
  card2:"#d4dff0",
  cardHover:"#d4dff0",
  border:"#b8cce0",
  borderLight:"#b8cce0",
  text:"#0d1f35",
  textSub:"#2d4a6b",
  textMuted:"#5a7a9a",
  blue:"#1d6fce",
  green:"#0d9e6e",
  gold:"#d97706",
  red:"#dc2626",
  purple:"#7c3aed",
  teal:"#0891b2",
  orange:"#ea580c",
  blueDim:"rgba(29,111,206,0.12)",
  greenDim:"rgba(13,158,110,0.12)",
  goldDim:"rgba(217,119,6,0.12)",
  redDim:"rgba(220,38,38,0.12)",
  purpleDim:"rgba(124,58,237,0.12)",
  tealDim:"rgba(8,145,178,0.12)",
  orangeDim:"rgba(234,88,12,0.12)",
  inputBg:"#f4f7fb",
  shadow:"0 4px 16px rgba(13,31,53,0.10)",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const uid       = () => Math.random().toString(36).slice(2,9);
const daysUntil = d  => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const fmtDate   = d  => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";

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

const EMPTY_DATA = {
  scorpionDocs: [],   // { id, category, name, docNo, issueDate, expiryDate, fileLink, notes }
  manpowerCats: DEFAULT_MANPOWER_CATS,
  manpower: [],       // { id, category, name, idNo, nationality, designation,
                      //   passportNo, passportExpiry, visaNo, visaExpiry,
                      //   iqamaNo, iqamaExpiry, muqeemNo, muqeemExpiry,
                      //   certs: [{id,name,certNo,issueDate,expiryDate,fileLink}],
                      //   docs:  [{id,type,docNo,expiryDate,fileLink}]  }
  equipment: [],      // { id, name, model, serialNo, status, operator, project,
                      //   purchaseDate, notes,
                      //   certifications:[{id,certNo,issuedBy,issueDate,expiryDate,fileLink}],
                      //   invoices:      [{id,invoiceNo,supplier,amount,date,fileLink}],
                      //   insurance:     [{id,policyNo,insurer,type,issueDate,expiryDate,fileLink}],
                      //   permits:       [{id,permitNo,type,issuedBy,issueDate,expiryDate,fileLink}] }
  scorpionDocCats: DEFAULT_SCORPION_CATS,
  projects: ["NEOM Phase 1","NEOM Phase 2","Riyadh Metro"],
  projectDocs: [],  // { id, project, subTab, name, refNo, date, expiryDate, amount, fileLink, notes }
};

function loadData() {
  try { const d = localStorage.getItem("cta_v1"); return d ? JSON.parse(d) : EMPTY_DATA; }
  catch { return EMPTY_DATA; }
}
function persist(data) { try { localStorage.setItem("cta_v1", JSON.stringify(data)); } catch {} }

/* ════════════════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════════════════ */
export default function App() {
  useEffect(() => {
    if (!document.getElementById("ct-g")) {
      const s = document.createElement("style"); s.id = "ct-g";
      s.textContent = GLOBAL_CSS; document.head.appendChild(s);
    }
  }, []);

  const [data,     setData]     = useState(loadData);
  const [page,     setPage]     = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [projMod,  setProjMod]  = useState(false);

  useEffect(() => { persist(data); }, [data]);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(() => setToast(null), 3200); };

  const go = p => { setPage(p); setSideOpen(false); };

  const saveProjects = projects => setData(prev=>({...prev,projects}));

  /* ── expiry alerts across everything ── */
  const allExpiries = [
    ...data.scorpionDocs.filter(d=>d.expiryDate).map(d=>({label:d.name,src:"Company Doc",days:daysUntil(d.expiryDate)})),
    ...(data.projectDocs||[]).filter(d=>d.expiryDate).map(d=>({label:d.name,src:"Project Doc",days:daysUntil(d.expiryDate)})),
    ...data.manpower.flatMap(p=>[
      p.passportExpiry && {label:p.name,src:"Passport",    days:daysUntil(p.passportExpiry)},
      p.visaExpiry     && {label:p.name,src:"Visa",        days:daysUntil(p.visaExpiry)},
      p.iqamaExpiry    && {label:p.name,src:"Iqama",       days:daysUntil(p.iqamaExpiry)},
      p.muqeemExpiry   && {label:p.name,src:"Muqeem",      days:daysUntil(p.muqeemExpiry)},
      ...(p.certs||[]).map(c=>({label:`${p.name} — ${c.name}`,src:"Cert",days:daysUntil(c.expiryDate)})),
    ].filter(Boolean)),
    ...data.equipment.flatMap(e=>[
      ...(e.certifications||[]).map(c=>({label:`${e.name} — ${c.certNo||"Cert"}`,src:"Eq Cert",days:daysUntil(c.expiryDate)})),
      ...(e.insurance||[]).map(c=>({label:`${e.name} — Insurance`,src:"Insurance",days:daysUntil(c.expiryDate)})),
      ...(e.permits||[]).map(c=>({label:`${e.name} — ${c.type||"Permit"}`,src:"Permit",days:daysUntil(c.expiryDate)})),
    ]),
  ].filter(x=>x.days!==null&&x.days<=90).sort((a,b)=>a.days-b.days);

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:T.bg}}>
      {sideOpen && <div className="fade-in" onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(13,31,53,0.45)",zIndex:49}}/>}

      <Sidebar page={page} go={go} sideOpen={sideOpen} alerts={allExpiries.length} data={data} onManageProjects={()=>{setSideOpen(false);setProjMod(true);}}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* ── Top bar ── */}
        <header style={{background:"#1e3a5f",borderBottom:"1px solid #b8cce0",padding:"0 20px",flexShrink:0,boxShadow:"0 2px 8px rgba(13,31,53,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",height:64,position:"relative"}}>
            <button onClick={()=>setSideOpen(true)} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",color:"#ffffff",borderRadius:8,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,zIndex:1}}>☰</button>
            <div style={{position:"absolute",left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:"#ffffff",letterSpacing:"3px"}}>SCORPION ARABIA</div>
              <div style={{fontSize:11,color:"#93c5fd",letterSpacing:"1.5px",marginTop:1}}>DOCUMENT & ASSET MANAGER</div>
            </div>
            {allExpiries.length>0 && (
              <div style={{marginLeft:"auto",zIndex:1}}>
                <div style={{background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.5)",color:"#fca5a5",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                  ▲ <span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:11,fontWeight:700}}>{allExpiries.length}</span> alerts
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{flex:1,overflowY:"auto",padding:"24px 20px"}}>
          {page==="dashboard" && <Dashboard data={data} alerts={allExpiries} go={go}/>}
          {page==="scorpion"  && <ScorpionDocs data={data} setData={setData} showToast={showToast}/>}
          {page==="projects"  && <ProjectDocs data={data} setData={setData} showToast={showToast}/>}
          {page==="manpower"  && <ManpowerPage data={data} setData={setData} showToast={showToast}/>}
          {page==="equipment" && <EquipmentPage data={data} setData={setData} showToast={showToast}/>}
        </main>
      </div>

      {projMod && <ProjectsModal projects={data.projects||[]} onSave={saveProjects} onClose={()=>setProjMod(false)}/>}

      {toast && (
        <div className="fade-up" style={{position:"fixed",bottom:24,right:24,zIndex:999,background:toast.type==="del"?"#fee2e2":"#d1fae5",border:`1px solid ${toast.type==="del"?T.red:T.green}`,color:toast.type==="del"?T.red:T.green,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10}}>
          {toast.type==="del"?"✕":"✓"} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════════════════════ */
function Sidebar({page,go,sideOpen,alerts,data,onManageProjects}) {
  const isMobile = window.innerWidth < 900;
  const NAV = [
    {id:"dashboard", icon:"▦", label:"Dashboard",          desc:"Overview"},
    {id:"scorpion",  icon:"◉", label:"Scorpion Documents", desc:"Company docs & licenses"},
    {id:"projects",  icon:"◆", label:"Project Docs",       desc:"Invoices, certs & orders"},
    {id:"manpower",  icon:"◈", label:"Manpower",           desc:"Staff & certifications"},
    {id:"equipment", icon:"◎", label:"Equipment",          desc:"Assets & records"},
  ];
  return (
    <aside style={{width:255,flexShrink:0,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:50,position:isMobile?"fixed":"relative",top:0,left:0,height:"100%",transform:isMobile?(sideOpen?"translateX(0)":"translateX(-100%)"):"none",transition:"transform .28s ease",boxShadow:"2px 0 12px rgba(0,0,0,0.06)"}}>
      <div style={{padding:"22px 20px 18px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <img src="logo.png" alt="Scorpion Arabia" style={{width:56,height:56,borderRadius:10,objectFit:"cover",background:"#000",flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:"#ffffff",letterSpacing:".5px",lineHeight:1.1}}>SCORPION ARABIA</div>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:"1.4px",marginTop:3,color:"#93c5fd"}}>ASSET MANAGER</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"14px 10px",flex:1,overflowY:"auto"}}>
        {NAV.map(n=>{
          const active=page===n.id;
          const badge=n.id==="dashboard"?alerts:0;
          return (
            <button key={n.id} onClick={()=>go(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:8,border:"none",marginBottom:3,textAlign:"left",background:active?"rgba(59,130,246,0.15)":"transparent",borderLeft:`2px solid ${active?"#93c5fd":"transparent"}`,transition:"all .15s"}}>
              <span style={{fontSize:20,color:active?"#93c5fd":"#94a3b8"}}>{n.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:active?"#93c5fd":"#e2e8f0"}}>{n.label}</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{n.desc}</div>
              </div>
              {badge>0&&<span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700}}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      {/* Manage Projects */}
      <div style={{padding:"10px 10px 0"}}>
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
      <div style={{padding:"8px 18px 16px",fontSize:10,color:T.textMuted,textAlign:"center"}}>Scorpion Arabia © 2025</div>
    </aside>
  );
}

/* ── Projects Manager Modal ──────────────────────────────────────────────── */
function ProjectsModal({projects,onSave,onClose}) {
  const [list,    setList]    = useState([...projects]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // {idx, val}

  const add = () => {
    const n=newName.trim();
    if(!n||list.includes(n)) return;
    setList(l=>[...l,n]);
    setNewName("");
  };

  const del = idx => setList(l=>l.filter((_,i)=>i!==idx));

  const startEdit = (idx,val) => setEditing({idx,val});
  const commitEdit = () => {
    if(!editing) return;
    const n=editing.val.trim();
    if(n&&!list.some((x,i)=>x===n&&i!==editing.idx)){
      setList(l=>l.map((x,i)=>i===editing.idx?n:x));
    }
    setEditing(null);
  };

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:460,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>MANAGE PROJECTS</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Add, rename or delete projects</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>

        {/* Add new */}
        <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",gap:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
              placeholder="New project name…"
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button onClick={add} style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,flexShrink:0}}>+ Add</button>
          </div>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 22px"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:10,letterSpacing:".5px"}}>PROJECTS ({list.length})</div>
          {list.length===0&&<div style={{textAlign:"center",padding:"30px",color:T.textMuted,fontSize:13}}>No projects yet.</div>}
          {list.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:T.bg,borderRadius:9,marginBottom:7,border:`1px solid ${T.border}`}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
              {editing&&editing.idx===i
                ? <input autoFocus value={editing.val} onChange={e=>setEditing({...editing,val:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(null);}} onBlur={commitEdit}
                    style={{flex:1,background:T.inputBg,border:`1px solid ${T.blue}`,borderRadius:6,padding:"5px 9px",fontSize:13,color:T.text,outline:"none"}}/>
                : <span style={{flex:1,fontSize:14,color:T.text,cursor:"text"}} onDoubleClick={()=>startEdit(i,p)}>{p}</span>
              }
              <button onClick={()=>startEdit(i,p)} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:6,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✎</button>
              <button onClick={()=>del(i)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✕</button>
            </div>
          ))}
        </div>

        <div style={{padding:"12px 22px 22px",flexShrink:0,borderTop:`1px solid ${T.border}`}}>
          <button onClick={()=>{onSave(list);onClose();}} style={{width:"100%",background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700}}>Save Projects</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
function Dashboard({data,alerts,go}) {
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

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>

      {/* ── Top KPI strip ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Alerts",    v:totalAlerts,  color:totalAlerts>0?T.red:T.green,  icon:"▲"},
          {label:"Overdue",         v:overdueCount, color:overdueCount>0?T.red:T.textMuted, icon:"✕"},
          {label:"Due in 30 Days",  v:expiring30,   color:expiring30>0?T.gold:T.textMuted,  icon:"⏱"},
          {label:"Compliance",      v:`${pct}%`,    color:pct>=80?T.green:pct>=60?T.gold:T.red, icon:"◎"},
          {label:"People",          v:mpPeople,     color:T.green,  icon:"◈"},
          {label:"Equipment Assets",v:eqTotal,      color:T.gold,   icon:"◎"},
        ].map((k,i)=>(
          <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.05}s`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:10,right:14,fontSize:26,color:k.color,opacity:.08,fontWeight:800}}>{k.icon}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:34,fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:5,fontWeight:500}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Compliance bar ── */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",marginBottom:18,animationDelay:".3s"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textSub,letterSpacing:".5px"}}>OVERALL COMPLIANCE</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:pct>=80?T.green:pct>=60?T.gold:T.red}}>{pct}%</span>
        </div>
        <div style={{height:8,background:T.border,borderRadius:999}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:999,transition:"width .8s ease",background:pct>=80?`linear-gradient(90deg,${T.green},#059669)`:pct>=60?`linear-gradient(90deg,${T.gold},#d97706)`:`linear-gradient(90deg,${T.red},#dc2626)`}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:T.textMuted}}>
          <span>{validCount} valid of {allTracked.length} tracked items</span>
          <span>{overdueCount>0?`${overdueCount} overdue`:"No overdue items"}</span>
        </div>
      </div>

      {/* ── 3 section cards ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:14,marginBottom:20}}>

        {/* Scorpion Documents */}
        <div className="fade-up" onClick={()=>go("scorpion")}
          style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",cursor:"pointer",animationDelay:".35s",transition:"border-color .2s,transform .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:38,height:38,background:T.blueDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.blue}}>◉</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>SCORPION DOCUMENTS</div>
              <div style={{fontSize:11,color:T.textMuted}}>CR, insurance, licenses, contracts</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["Total Docs",data.scorpionDocs.length,T.blue],["Expiring",scorpionExp,scorpionExp>0?T.red:T.textMuted],["Due in 30d",scorpionExp30,scorpionExp30>0?T.gold:T.textMuted],["Categories",(data.scorpionDocCats||[]).length,T.blue]].map(([l,v,c])=>(
              <div key={l} style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:T.blue,fontWeight:600,textAlign:"right"}}>Open Documents →</div>
        </div>

        {/* Project Docs */}
        <div className="fade-up" onClick={()=>go("projects")}
          style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",cursor:"pointer",animationDelay:".40s",transition:"border-color .2s,transform .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:38,height:38,background:T.tealDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.teal}}>◆</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>PROJECT DOCS</div>
              <div style={{fontSize:11,color:T.textMuted}}>Invoices, completion certs & work orders</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[
              ["Total",(data.projectDocs||[]).length,T.teal],
              ["Invoices",(data.projectDocs||[]).filter(d=>d.subTab==="invoices").length,T.green],
              ["Job Certs",(data.projectDocs||[]).filter(d=>d.subTab==="certificates").length,T.blue],
              ["Work Orders",(data.projectDocs||[]).filter(d=>d.subTab==="workorders").length,T.purple],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:T.teal,fontWeight:600,textAlign:"right"}}>Open Project Docs →</div>
        </div>

        {/* Manpower */}
        <div className="fade-up" onClick={()=>go("manpower")}
          style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",cursor:"pointer",animationDelay:".42s",transition:"border-color .2s,transform .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:38,height:38,background:T.greenDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.green}}>◈</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>MANPOWER</div>
              <div style={{fontSize:11,color:T.textMuted}}>Staff, documents & certifications</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["People",mpPeople,T.green],["Categories",mpCats,T.green],["Doc Alerts",mpDocAlerts,mpDocAlerts>0?T.red:T.textMuted],["Certs",data.manpower.reduce((n,p)=>n+(p.certs||[]).length,0),T.green]].map(([l,v,c])=>(
              <div key={l} style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Category breakdown */}
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {(data.manpowerCats||[]).map(c=>(
              <span key={c} style={{background:T.greenDim,color:T.green,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600}}>
                {c} ({data.manpower.filter(p=>p.category===c).length})
              </span>
            ))}
          </div>
          <div style={{fontSize:12,color:T.green,fontWeight:600,textAlign:"right"}}>Open Manpower →</div>
        </div>

        {/* Equipment */}
        <div className="fade-up" onClick={()=>go("equipment")}
          style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px",cursor:"pointer",animationDelay:".49s",transition:"border-color .2s,transform .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.gold;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:38,height:38,background:T.goldDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.gold}}>◎</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>EQUIPMENT</div>
              <div style={{fontSize:11,color:T.textMuted}}>Assets, certs, invoices & permits</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["Total Assets",eqTotal,T.gold],["Active",eqActive,T.green],["Maintenance",eqMaint,eqMaint>0?T.gold:T.textMuted],["Exp. Alerts",eqExp,eqExp>0?T.red:T.textMuted]].map(([l,v,c])=>(
              <div key={l} style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {[["📜 Certs",data.equipment.reduce((n,e)=>n+(e.certifications||[]).length,0)],["🧾 Invoices",data.equipment.reduce((n,e)=>n+(e.invoices||[]).length,0)],["🛡 Insurance",data.equipment.reduce((n,e)=>n+(e.insurance||[]).length,0)],["⬡ Permits",data.equipment.reduce((n,e)=>n+(e.permits||[]).length,0)]].map(([l,v])=>(
              <span key={l} style={{background:T.goldDim,color:T.gold,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600}}>{l}: {v}</span>
            ))}
          </div>
          <div style={{fontSize:12,color:T.gold,fontWeight:600,textAlign:"right"}}>Open Equipment →</div>
        </div>
      </div>

      {/* ── Alerts split into 2 columns ── */}
      {alerts.length>0 ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {/* Overdue */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px",animationDelay:".55s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:18,borderRadius:2,background:T.red}}/>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.red,letterSpacing:".5px"}}>OVERDUE</span>
              <span style={{background:T.redDim,color:T.red,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{expired.length}</span>
            </div>
            {expired.length===0
              ?<div style={{textAlign:"center",padding:"20px",color:T.textMuted,fontSize:13}}>✓ Nothing overdue</div>
              :<div style={{display:"grid",gap:7}}>
                {expired.slice(0,8).map((a,i)=><AlertRow key={i} a={a}/>)}
                {expired.length>8&&<div style={{fontSize:11,color:T.textMuted,textAlign:"center",paddingTop:4}}>+{expired.length-8} more — check Alerts page</div>}
              </div>
            }
          </div>

          {/* Expiring soon */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px",animationDelay:".62s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:3,height:18,borderRadius:2,background:T.gold}}/>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.gold,letterSpacing:".5px"}}>EXPIRING SOON</span>
              <span style={{background:T.goldDim,color:T.gold,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{expiring.length}</span>
            </div>
            {expiring.length===0
              ?<div style={{textAlign:"center",padding:"20px",color:T.textMuted,fontSize:13}}>✓ Nothing expiring soon</div>
              :<div style={{display:"grid",gap:7}}>
                {expiring.slice(0,8).map((a,i)=><AlertRow key={i} a={a}/>)}
                {expiring.length>8&&<div style={{fontSize:11,color:T.textMuted,textAlign:"center",paddingTop:4}}>+{expiring.length-8} more</div>}
              </div>
            }
          </div>
        </div>
      ) : (
        <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"40px 20px",textAlign:"center",animationDelay:".55s"}}>
          <div style={{fontSize:44,marginBottom:12}}>✓</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.green,marginBottom:6}}>ALL CLEAR</div>
          <div style={{fontSize:13,color:T.textMuted}}>No expiring or overdue items — everything is up to date.</div>
        </div>
      )}
    </div>
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
  {id:"invoices",     label:"Invoices",                    icon:"🧾", color:T.green,  dim:T.greenDim},
  {id:"certificates", label:"Job Completion Certificates", icon:"📜", color:T.blue,   dim:T.blueDim},
  {id:"workorders",   label:"Work Orders / Agreements",    icon:"📋", color:T.purple, dim:T.purpleDim},
];

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT DOCS
════════════════════════════════════════════════════════════════════════════ */
function ProjectDocs({data,setData,showToast}) {
  // ALL hooks must be at the top — never after a conditional return
  const [subTab,  setSubTab]  = useState("invoices");
  const [selProj, setSelProj] = useState(null);
  const [modal,   setModal]   = useState(null);
  const [fProj,   setFProj]   = useState("");

  const docs     = data.projectDocs || [];
  const projects = data.projects    || [];
  const cur      = PD_TABS.find(t=>t.id===subTab);
  const counts   = Object.fromEntries(PD_TABS.map(t=>[t.id, docs.filter(d=>d.subTab===t.id).length]));

  const changeTab = t => { setSubTab(t); setSelProj(null); setFProj(""); };

  const saveDoc = (doc, mode) => {
    const st = subTab; // capture before any state changes
    // Close modal FIRST so it unmounts cleanly before data update triggers re-render
    setModal(null);
    setTimeout(() => {
      setData(prev=>{
        const list=[...prev.projectDocs];
        if(mode==="add") list.push({...doc,id:uid(),subTab:st});
        else { const i=list.findIndex(d=>d.id===doc.id); if(i>=0) list[i]={...doc,subTab:st}; }
        return{...prev,projectDocs:list};
      });
      showToast(mode==="add"?"Document added":"Updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev=>({...prev,projectDocs:prev.projectDocs.filter(d=>d.id!==id)}));
    showToast("Deleted","del");
  };

  // ── Derived data (no hooks below this line) ───────────────────────────
  const invDocs  = docs.filter(d=>d.subTab==="invoices");
  const projInvs = selProj ? invDocs.filter(d=>d.project===selProj) : [];
  const totalAmt = projInvs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const certDocs = docs.filter(d=>d.subTab==="certificates"&&(!fProj||d.project===fProj));
  const woDocs   = docs.filter(d=>d.subTab==="workorders"&&(!fProj||d.project===fProj));

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <SubTabBar tabs={PD_TABS} active={subTab} counts={counts} onChange={changeTab}/>

      {/* ══ INVOICES ════════════════════════════════════════════════════ */}
      {subTab==="invoices" && (
        selProj ? (
          /* Project detail — invoice list */
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={()=>setSelProj(null)} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>{selProj}</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>
                  {projInvs.length} invoice{projInvs.length!==1?"s":""} · Total: <span style={{color:T.green,fontWeight:700}}>SAR {totalAmt.toLocaleString()}</span>
                </div>
              </div>
              <Btn color={T.green} solid onClick={()=>setModal({mode:"add",doc:{project:selProj}})}>+ Add Invoice</Btn>
            </div>
            {projInvs.length===0
              ?<Empty icon="🧾" label="No invoices yet" sub="Add the first invoice for this project" color={T.green} onAdd={()=>setModal({mode:"add",doc:{project:selProj}})}/>
              :<div style={{display:"grid",gap:10}}>
                {projInvs.map((doc,i)=><InvoiceCard key={doc.id} doc={doc} delay={i*.03} onEdit={()=>setModal({mode:"edit",doc})} onDel={()=>delDoc(doc.id)}/>)}
              </div>
            }
          </div>
        ) : (
          /* Project grid */
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>INVOICES</div>
                <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Select a project to view and manage its invoices</div>
              </div>
              <Btn color={T.green} solid onClick={()=>setModal({mode:"add"})}>+ Add Invoice</Btn>
            </div>
            {projects.length===0
              ?<Empty icon="🧾" label="No projects yet" sub="Add projects via Manage Projects in the sidebar" color={T.green} onAdd={()=>{}}/>
              :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                {projects.map((p,i)=>{
                  const pinvs=invDocs.filter(d=>d.project===p);
                  const total=pinvs.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
                  return (
                    <div key={p} className="fade-up" onClick={()=>setSelProj(p)}
                      style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",cursor:"pointer",animationDelay:`${i*.05}s`,transition:"border-color .2s,transform .2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.green;e.currentTarget.style.transform="translateY(-2px)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                        <div style={{width:38,height:38,background:T.greenDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧾</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p}</div>
                          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{pinvs.length} invoice{pinvs.length!==1?"s":""}</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        <div style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:T.green,lineHeight:1}}>{pinvs.length}</div>
                          <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>Invoices</div>
                        </div>
                        <div style={{background:T.bg,borderRadius:8,padding:"10px 12px"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:T.green,lineHeight:1}}>{total>0?`SAR ${(total/1000).toFixed(0)}K`:"—"}</div>
                          <div style={{fontSize:10,color:T.textMuted,marginTop:3}}>Total Value</div>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:T.green,fontWeight:600,textAlign:"right"}}>View Invoices →</div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )
      )}

      {/* ══ CERTIFICATES ════════════════════════════════════════════════ */}
      {subTab==="certificates" && (
        <div>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>JOB COMPLETION CERTIFICATES</div>
              <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Certificates issued upon completion of drilling work</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
                <option value="">All Projects</option>
                {projects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <Btn color={T.blue} solid onClick={()=>setModal({mode:"add"})}>+ Add Certificate</Btn>
            </div>
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{certDocs.length} record{certDocs.length!==1?"s":""}</div>
          {certDocs.length===0
            ?<Empty icon="📜" label="No certificates yet" sub="Add your first job completion certificate" color={T.blue} onAdd={()=>setModal({mode:"add"})}/>
            :<div style={{display:"grid",gap:10}}>
              {certDocs.map((doc,i)=>(
                <div key={doc.id} className="fade-up"
                  style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:"4px solid "+T.blue,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{doc.name}</span>
                      {doc.project&&<Tag color={T.teal}>{doc.project}</Tag>}
                      {doc.jobNo&&<Tag color={T.blue}>Job #{doc.jobNo}</Tag>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {doc.client&&<Chip>Client: {doc.client}</Chip>}
                      {doc.startDate&&<Chip>Start: {fmtDate(doc.startDate)}</Chip>}
                      {doc.completionDate&&<Chip color={T.green}>Completed: {fmtDate(doc.completionDate)}</Chip>}
                      {doc.amount&&<Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
                      {doc.refNo&&<Chip>Cert No: {doc.refNo}</Chip>}
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
      )}

      {/* ══ WORK ORDERS ═════════════════════════════════════════════════ */}
      {subTab==="workorders" && (
        <div>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>WORK ORDERS / AGREEMENTS</div>
              <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Contracts and work orders with clients</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
                <option value="">All Projects</option>
                {projects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <Btn color={T.purple} solid onClick={()=>setModal({mode:"add"})}>+ Add Work Order</Btn>
            </div>
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{woDocs.length} record{woDocs.length!==1?"s":""}</div>
          {woDocs.length===0
            ?<Empty icon="📋" label="No work orders yet" sub="Add your first work order or agreement" color={T.purple} onAdd={()=>setModal({mode:"add"})}/>
            :<div style={{display:"grid",gap:10}}>
              {woDocs.map((doc,i)=>{
                const hasExp=!!doc.expiryDate;
                const s=getStatus(daysUntil(doc.expiryDate));
                return (
                  <div key={doc.id} className="fade-up"
                    style={{background:T.card,border:`1px solid ${hasExp&&daysUntil(doc.expiryDate)<=90?s.color+"44":T.border}`,borderLeft:"4px solid "+T.purple,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{doc.name}</span>
                        {doc.project&&<Tag color={T.teal}>{doc.project}</Tag>}
                        {hasExp&&<Tag color={s.color}>{s.label}</Tag>}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {doc.refNo&&<Chip>Ref: {doc.refNo}</Chip>}
                        {doc.supplier&&<Chip>Client: {doc.supplier}</Chip>}
                        {doc.amount&&<Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
                        {doc.date&&<Chip>Signed: {fmtDate(doc.date)}</Chip>}
                        {hasExp&&<Chip color={s.color}>Expires: {fmtDate(doc.expiryDate)}</Chip>}
                        {hasExp&&daysUntil(doc.expiryDate)!==null&&daysUntil(doc.expiryDate)<=90&&<Chip color={s.color}>{daysUntil(doc.expiryDate)>=0?`${daysUntil(doc.expiryDate)}d left`:`${Math.abs(daysUntil(doc.expiryDate))}d overdue`}</Chip>}
                        {doc.fileLink&&<FileLink href={doc.fileLink}/>}
                      </div>
                      {doc.notes&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
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
        </div>
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}
      {modal && subTab==="invoices"     && <InvoiceModal     mode={modal.mode} doc={modal.doc} projects={projects} defaultProject={selProj} onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {modal && subTab==="certificates" && <CertificateModal mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={()=>setModal(null)} onSave={saveDoc}/>}
      {modal && subTab==="workorders"   && <WorkOrderModal   mode={modal.mode} doc={modal.doc} projects={projects}                          onClose={()=>setModal(null)} onSave={saveDoc}/>}
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
function InvoiceCard({doc,delay,onEdit,onDel}) {
  const due = daysUntil(doc.dueDate);
  const ds  = getStatus(due);
  return (
    <div className="fade-up" style={{background:T.card,border:`1px solid ${due!==null&&due<=30?ds.color+"44":T.border}`,borderLeft:"4px solid "+T.green,borderRadius:12,padding:"16px 18px",animationDelay:`${delay}s`,display:"flex",alignItems:"flex-start",gap:14}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{doc.name}</span>
          {doc.refNo&&<Tag color={T.green}>#{doc.refNo}</Tag>}
          {doc.dueDate&&due!==null&&due<=30&&<Tag color={ds.color}>{due<0?`${Math.abs(due)}d overdue`:`Due in ${due}d`}</Tag>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {doc.client&&<Chip>Client: {doc.client}</Chip>}
          {doc.dueDate&&<Chip color={ds.color}>Due: {fmtDate(doc.dueDate)}</Chip>}
          {doc.amount&&<Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
          {doc.fileLink&&<FileLink href={doc.fileLink}/>}
        </div>
        {doc.notes&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0}}>
        <ABtn color={T.blue} onClick={onEdit}>✎</ABtn>
        <ABtn color={T.red}  onClick={onDel}>✕</ABtn>
      </div>
    </div>
  );
}

/* ── Invoice modal ───────────────────────────────────────────────────────── */
function InvoiceModal({mode,doc,projects,defaultProject,onClose,onSave}) {
  const [f,setF]=useState(doc||{project:defaultProject||""});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} INVOICE`} color={T.green} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Invoice title required");return;}onSave(f,mode);}}>
      <FieldRow label="Invoice Title *"><FInput value={f.name||""} onChange={set("name")} color={T.green}/></FieldRow>
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.green}>
          <option value="">Select project…</option>
          {projects.map(p=><option key={p} value={p}>{p}</option>)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Invoice No."><FInput value={f.refNo||""} onChange={set("refNo")} color={T.green}/></FieldRow>
      <FieldRow label="Client"><FInput value={f.client||""} onChange={set("client")} color={T.green}/></FieldRow>
      <FieldRow label="Due Date"><FInput type="date" value={f.dueDate||""} onChange={set("dueDate")} color={T.green}/></FieldRow>
      <FieldRow label="Invoice Value (SAR)"><FInput type="number" value={f.amount||""} onChange={set("amount")} color={T.green}/></FieldRow>
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
      onSave={()=>{if(!f.name){alert("Certificate title required");return;}onSave(f,mode);}}>
      <FieldRow label="Certificate Title *"><FInput value={f.name||""} onChange={set("name")} color={T.blue}/></FieldRow>
      <FieldRow label="Project *">
        <FSelect value={f.project||""} onChange={set("project")} color={T.blue}>
          <option value="">Select project…</option>
          {projects.map(p=><option key={p} value={p}>{p}</option>)}
        </FSelect>
      </FieldRow>
      <FieldRow label="Job Number"><FInput value={f.jobNo||""} onChange={set("jobNo")} color={T.blue}/></FieldRow>
      <FieldRow label="Client"><FInput value={f.client||""} onChange={set("client")} color={T.blue}/></FieldRow>
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
          {projects.map(p=><option key={p} value={p}>{p}</option>)}
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

/* ════════════════════════════════════════════════════════════════════════════
   SCORPION DOCUMENTS
════════════════════════════════════════════════════════════════════════════ */
function ScorpionDocs({data,setData,showToast}) {
  const [modal,    setModal]    = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [selCat,   setSelCat]   = useState("All");

  const docs    = data.scorpionDocs || [];
  const cats    = data.scorpionDocCats || DEFAULT_SCORPION_CATS;
  const visible = selCat==="All" ? docs : docs.filter(d=>d.category===selCat);

  const saveDoc = (doc, mode) => {
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...prev.scorpionDocs];
        if (mode==="add") list.push({...doc, id:uid()});
        else { const i=list.findIndex(d=>d.id===doc.id); if(i>=0) list[i]=doc; }
        return {...prev, scorpionDocs:list};
      });
      showToast(mode==="add"?"Document added":"Document updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev=>({...prev, scorpionDocs:prev.scorpionDocs.filter(d=>d.id!==id)}));
    showToast("Document deleted","del");
  };

  const saveCats = cats => setData(prev=>({...prev, scorpionDocCats:cats}));

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <PageHeader title="SCORPION DOCUMENTS" sub="Company licenses, insurance, contracts & registrations" color={T.blue}>
        <Btn color={T.blue} onClick={()=>setCatModal(true)}>⊕ Categories</Btn>
        <Btn color={T.blue} solid onClick={()=>setModal({mode:"add"})}>+ Add Document</Btn>
      </PageHeader>

      {/* Category filter pills */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {["All",...cats].map(c=>(
          <button key={c} onClick={()=>setSelCat(c)} style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${selCat===c?T.blue:T.border}`,background:selCat===c?T.blueDim:"transparent",color:selCat===c?T.blue:T.textSub,fontSize:12,fontWeight:selCat===c?700:500,transition:"all .15s"}}>
            {c} {c!=="All"&&<span style={{opacity:.6}}>({docs.filter(d=>d.category===c).length})</span>}
          </button>
        ))}
      </div>

      {visible.length===0
        ?<Empty icon="◉" label="No documents yet" sub="Add your first company document" color={T.blue} onAdd={()=>setModal({mode:"add"})}/>
        :<div style={{display:"grid",gap:10}}>
          {visible.map((doc,i)=>{
            const s=getStatus(daysUntil(doc.expiryDate));
            return (
              <div key={doc.id} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${doc.expiryDate?s.color:T.blue}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"center",gap:14}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>{doc.name}</span>
                    <Tag color={T.blue}>{doc.category}</Tag>
                    {doc.expiryDate&&<Tag color={s.color}>{s.label}</Tag>}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {doc.docNo&&<Chip>Ref: {doc.docNo}</Chip>}
                    {doc.issueDate&&<Chip>Issued: {fmtDate(doc.issueDate)}</Chip>}
                    {doc.expiryDate&&<Chip color={s.color}>Expires: {fmtDate(doc.expiryDate)}</Chip>}
                    {doc.fileLink&&<FileLink href={doc.fileLink}/>}
                  </div>
                  {doc.notes&&<div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
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
  const [f,setF]=useState(doc||{});
  const F=(k,label,type)=>({key:k,label,type:type||"text"});
  const fields=[F("name","Document Name"),F("category","Category","select"),F("docNo","Reference / Doc No."),F("issueDate","Issue Date","date"),F("expiryDate","Expiry Date","date"),F("fileLink","File Link (Google Drive / SharePoint)","link"),F("notes","Notes","textarea")];
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} DOCUMENT`} color={T.blue} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Document name is required");return;}onSave(f,mode);}}>
      {fields.map(fl=>(
        <FieldRow key={fl.key} label={fl.label}>
          {fl.type==="select"
            ?<FSelect value={f[fl.key]||""} onChange={v=>setF(p=>({...p,[fl.key]:v}))} color={T.blue}>
                <option value="">Select…</option>
                {cats.map(c=><option key={c} value={c}>{c}</option>)}
              </FSelect>
            :fl.type==="textarea"
              ?<FTextarea value={f[fl.key]||""} onChange={v=>setF(p=>({...p,[fl.key]:v}))} color={T.blue}/>
              :fl.type==="link"
                ?<FLink value={f[fl.key]||""} onChange={v=>setF(p=>({...p,[fl.key]:v}))}/>
                :<FInput type={fl.type} value={f[fl.key]||""} onChange={v=>setF(p=>({...p,[fl.key]:v}))} color={T.blue}/>
          }
        </FieldRow>
      ))}
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
    <div style={{maxWidth:1000,margin:"0 auto"}}>
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
        <Btn color={T.green} solid onClick={()=>setAddModal({mode:"add"})}>+ Add Person</Btn>
      </PageHeader>

      {/* Excel import banner */}
      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Manpower Certifications from Excel</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>NAME, ID, CERTIFICATE, ISSUED BY, ISSUE DATE, EXPIRY DATE</strong> (headers auto-detected from row 4) — matches people by name, creates new if not found</div>
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
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{p.name}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{p.designation||"—"} · {p.nationality||""}</div>
                  </div>
                  {critical>0&&<span style={{background:T.goldDim,color:T.gold,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>{critical} alerts</span>}
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
                        <span style={{fontSize:11,color:T.textMuted}}>{lbl}</span>
                        {exp
                          ?<span style={{fontSize:11,color:s.color,fontWeight:600}}>{s.label==="Valid"?fmtDate(exp):s.label}</span>
                          :<span style={{fontSize:11,color:T.textMuted}}>—</span>
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

      {addModal  && <PersonModal mode={addModal.mode} person={addModal.person} cats={cats}
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
    ["Passport No.",person.passportNo],["Passport Expiry",fmtDate(person.passportExpiry)],
    ["Visa No.",person.visaNo],["Visa Expiry",fmtDate(person.visaExpiry)],
    ["Iqama No.",person.iqamaNo],["Iqama Expiry",fmtDate(person.iqamaExpiry)],
    ["Muqeem No.",person.muqeemNo],["Muqeem Expiry",fmtDate(person.muqeemExpiry)],
  ].filter(([,v])=>v&&v!=="—");

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <button onClick={onBack} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{person.name}</div>
          <div style={{fontSize:12,color:T.textMuted}}>{person.designation} · {person.category}</div>
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
              <div style={{fontSize:11,color:T.textMuted,fontWeight:600,marginBottom:6}}>{lbl.toUpperCase()}</div>
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
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 22px"}}>
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

function PersonModal({mode,person,cats,onClose,onSave}) {
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
        if(mode==="add")list.push({...eq,id:uid(),certifications:[],invoices:[],insurance:[],permits:[]});
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
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {/* Show EquipmentDetail when equipment selected */}
      {eqFresh && <EquipmentDetail eq={eqFresh} projects={projects} onBack={()=>setSelEq(null)} onUpdate={updateEq} onDelete={()=>delEq(eqFresh.id)} onEdit={()=>setModal({mode:"edit",eq:eqFresh})} showToast={showToast}/>}
      {/* Show list when nothing selected */}
      {!eqFresh && <>
      <PageHeader title="EQUIPMENT" sub="Assets with certifications, invoices, insurance & permits" color={T.gold}>
        <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Projects</option>
          {projects.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Statuses</option>
          <option>Active</option><option>Under Maintenance</option><option>Inactive</option>
        </select>
        <input ref={eqBulkRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importBulkEqCerts(e.target.files[0]);e.target.value="";}}}/>
        <Btn color={T.gold} onClick={()=>eqBulkRef.current.click()}>⬆ Import Excel</Btn>
        <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Add Equipment</Btn>
      </PageHeader>

      {/* Excel import banner */}
      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Equipment Certifications from Excel</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>ITEM TYPE, ITEM NAME/ID, REG/SERIAL NO, TUV PROVIDER, START DATE, EXPIRY DATE</strong> — auto-detects Sheet3, matches equipment by name or serial no.</div>
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

      {modal&&<EqModal mode={modal.mode} eq={modal.eq} projects={projects} onClose={()=>setModal(null)} onSave={saveEq}/>}
      </>}
    </div>
  );
}

/* ─── Equipment Detail ───────────────────────────────────────────────────── */
function EquipmentDetail({eq,projects,onBack,onUpdate,onDelete,onEdit,showToast}) {
  const [activeTab,setActiveTab]=useState("certifications");
  const [subModal, setSubModal] =useState(null);

  const EQ_SUBTABS=[
    {id:"certifications",label:"Certifications",icon:"📜",color:T.blue},
    {id:"invoices",      label:"Invoices",      icon:"🧾",color:T.green},
    {id:"insurance",     label:"Insurance",     icon:"🛡",color:T.purple},
    {id:"permits",       label:"Permits",       icon:"⬡",color:T.gold},
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
    <div style={{maxWidth:1000,margin:"0 auto"}}>
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
                      <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>Expires: {fmtDate(r.expiryDate)}</div>
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
            <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>ITEM TYPE, ITEM NAME/ID, REG/SERIAL NO, TUV PROVIDER, START DATE, EXPIRY DATE</strong> (Sheet3 auto-detected)</div>
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

      {subModal&&<SubRecordModal mode={subModal.mode} type={subModal.type} rec={subModal.rec} onClose={()=>setSubModal(null)} onSave={(rec,mode)=>saveSubRecord(subModal.type,rec,mode)}/>}
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

function SubRecordModal({mode,type,rec,onClose,onSave}) {
  const [f,setF]=useState(rec||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  const CONFIGS={
    certifications:{color:T.blue,  title:"CERTIFICATION",  fields:[["certNo","Certificate No."],["issuedBy","Issued By"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
    invoices:      {color:T.green, title:"INVOICE",        fields:[["invoiceNo","Invoice No.","","req"],["supplier","Supplier","","req"],["amount","Amount (SAR)"],["date","Invoice Date","date"],["description","Description","textarea"],["fileLink","File Link","link"]]},
    insurance:     {color:T.purple,title:"INSURANCE",      fields:[["policyNo","Policy No.","","req"],["insurer","Insurer","","req"],["type","Policy Type"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
    permits:       {color:T.gold,  title:"PERMIT",         fields:[["permitNo","Permit No.","","req"],["type","Permit Type"],["issuedBy","Issued By"],["issueDate","Issue Date","date"],["expiryDate","Expiry Date","date"],["fileLink","File Link","link"]]},
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
              :<FInput type={ftype||"text"} value={f[k]||""} onChange={set(k)} color={cfg.color}/>
          }
        </FieldRow>
      ))}
    </FormModal>
  );
}

function EqModal({mode,eq,projects,onClose,onSave}) {
  const [f,setF]=useState(eq||{});
  const set=k=>v=>setF(p=>({...p,[k]:v}));
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} EQUIPMENT`} color={T.gold} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Equipment name required");return;}onSave(f,mode);}}>
      <FieldRow label="Equipment Name *"><FInput value={f.name||""} onChange={set("name")} color={T.gold}/></FieldRow>
      <FieldRow label="Model / Make"><FInput value={f.model||""} onChange={set("model")} color={T.gold}/></FieldRow>
      <FieldRow label="Serial Number"><FInput value={f.serialNo||""} onChange={set("serialNo")} color={T.gold}/></FieldRow>
      <FieldRow label="Project">
        <FSelect value={f.project||""} onChange={set("project")} color={T.gold}>
          <option value="">Select…</option>
          {projects.map(p=><option key={p} value={p}>{p}</option>)}
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

function Overlay({children,onClose}) {
  return (
    <div className="fade-in" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(13,31,53,0.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      {children}
    </div>
  );
}

function FormModal({title,color,children,onClose,onSave}) {
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:500,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:T.sidebar,zIndex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{title}</div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>
        <div style={{padding:"18px 22px"}}>{children}</div>
        <div style={{padding:"0 22px 22px",display:"flex",gap:10,position:"sticky",bottom:0,background:T.sidebar,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={onSave}  style={{flex:2,background:color,border:"none",color:"#000",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700}}>Save</button>
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
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>{label.toUpperCase()}</label>
      {children}
    </div>
  );
}

function SectionDivider({label}) {
  return <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"1.5px",marginTop:16,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.border}`}}>{label}</div>;
}

function FInput({type,value,onChange,color,placeholder}) {
  return <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"light"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FTextarea({value,onChange,color}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} rows={2}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",resize:"vertical",colorScheme:"light"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FSelect({value,onChange,color,children}) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:value?T.text:T.textMuted,outline:"none",colorScheme:"light"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
    {children}
  </select>;
}

function FLink({value,onChange}) {
  return (
    <div>
      <input type="url" value={value} onChange={e=>onChange(e.target.value)} placeholder="https://drive.google.com/… or sharepoint.com/…"
        style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.blue,outline:"none",colorScheme:"light"}}
        onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
      {value&&<a href={value} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,marginTop:4,display:"inline-block"}}>📎 Test link →</a>}
    </div>
  );
}

const Chip     = ({children,color}) => <span style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:6,padding:"2px 9px",fontSize:12,color:color||T.textSub,fontWeight:500}}>{children}</span>;
const Tag      = ({children,color}) => <span style={{background:`${color}18`,border:`1px solid ${color}33`,borderRadius:5,padding:"2px 8px",fontSize:11,color,fontWeight:700}}>{children}</span>;
const ABtn     = ({onClick,color,children}) => <button onClick={onClick} style={{width:30,height:30,borderRadius:7,border:`1px solid ${color}33`,background:`${color}18`,color,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
const FileLink = ({href}) => <a href={href} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:6,padding:"2px 9px",fontSize:12,color:T.blue,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>📎 Open File</a>;
const Btn      = ({children,onClick,color,solid}) => <button onClick={onClick} style={{background:solid?color:T.bg,border:`1px solid ${solid?color:T.border}`,color:solid?"#000":color||T.textSub,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,transition:"all .15s"}}>{children}</button>;
