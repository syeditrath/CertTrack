import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: 'Barlow', sans-serif; background: #080b10; color: #e8edf5; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #080b10; }
  ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
  input, select, textarea, button { font-family: 'Barlow', sans-serif; }
  button { cursor: pointer; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
  @keyframes slideUp { from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);} }
  @keyframes fadeIn  { from{opacity:0;}to{opacity:1;} }
  .fade-up  { animation: fadeUp  0.3s ease both; }
  .slide-up { animation: slideUp 0.35s cubic-bezier(0.34,1.3,0.64,1) both; }
  .fade-in  { animation: fadeIn  0.2s ease both; }
`;

const T = {
  bg:"#080b10", sidebar:"#0e1117", card:"#0e1117", cardHover:"#131820",
  border:"#1e293b", borderLight:"#253147",
  text:"#f1f5fb", textSub:"#8899b0", textMuted:"#3d5068",
  blue:"#38bdf8", green:"#34d399", gold:"#fbbf24", red:"#f87171",
  purple:"#a78bfa", pink:"#f472b6", teal:"#2dd4bf",
  blueDim:"rgba(56,189,248,0.1)", greenDim:"rgba(52,211,153,0.1)",
  goldDim:"rgba(251,191,36,0.1)", redDim:"rgba(248,113,113,0.1)",
  purpleDim:"rgba(167,139,250,0.1)", pinkDim:"rgba(244,114,182,0.1)",
  tealDim:"rgba(45,212,191,0.1)",
  inputBg:"#080b10", shadow:"0 2px 12px rgba(0,0,0,0.4)",
};

/* ─── Main nav tabs ──────────────────────────────────────────────────────── */
const MAIN_TABS = [
  {id:"dashboard", label:"Dashboard",  icon:"▦", desc:"Overview & metrics"},
  {id:"equipment", label:"Equipment",  icon:"◎", desc:"Equipment hub"},
  {id:"tuv",       label:"TUV",        icon:"◈", desc:"TUV certifications"},
  {id:"manpower",  label:"Manpower",   icon:"◉", desc:"Manpower certifications"},
  {id:"alerts",    label:"Alerts",     icon:"▲", desc:"Expiry notifications"},
];

/* ─── Equipment sub-tabs ─────────────────────────────────────────────────── */
const EQ_TABS = [
  {id:"certifications", label:"Certifications", icon:"◈", color:T.blue,   dim:T.blueDim},
  {id:"invoices",       label:"Invoices",       icon:"◆", color:T.green,  dim:T.greenDim},
  {id:"service",        label:"Service Records",icon:"⚙", color:T.purple, dim:T.purpleDim},
  {id:"permits",        label:"Permits",        icon:"⬡", color:T.gold,   dim:T.goldDim},
];

/* ─── Field definitions ──────────────────────────────────────────────────── */
const CERT_FIELDS = [
  {key:"project",        label:"Project",          req:true, type:"project"},
  {key:"equipmentName",  label:"Equipment Name",   req:true},
  {key:"modelMake",      label:"Model / Make"},
  {key:"serialNumber",   label:"Serial Number",    req:true},
  {key:"certNo",         label:"Certificate No."},
  {key:"inspectionDate", label:"Inspection Date",  type:"date"},
  {key:"expiryDate",     label:"Expiry Date",      type:"date", req:true},
  {key:"remarks",        label:"Remarks",          type:"textarea"},
];

const INVOICE_FIELDS = [
  {key:"project",       label:"Project",          req:true, type:"project"},
  {key:"equipmentName", label:"Equipment Name",   req:true},
  {key:"invoiceNo",     label:"Invoice No.",      req:true},
  {key:"supplier",      label:"Supplier / Vendor", req:true},
  {key:"amount",        label:"Amount (SAR)"},
  {key:"invoiceDate",   label:"Invoice Date",     type:"date", req:true},
  {key:"description",   label:"Description",      type:"textarea"},
  {key:"fileLink",      label:"File Link (Google Drive / SharePoint)", type:"link"},
];

const SERVICE_FIELDS = [
  {key:"project",       label:"Project",          req:true, type:"project"},
  {key:"equipmentName", label:"Equipment Name",   req:true},
  {key:"serviceType",   label:"Service Type",     req:true},
  {key:"technician",    label:"Technician / Company"},
  {key:"serviceDate",   label:"Service Date",     type:"date", req:true},
  {key:"nextServiceDate",label:"Next Service Due", type:"date"},
  {key:"cost",          label:"Cost (SAR)"},
  {key:"description",   label:"Work Description", type:"textarea"},
  {key:"fileLink",      label:"File Link (Google Drive / SharePoint)", type:"link"},
];

const PERMIT_FIELDS = [
  {key:"project",       label:"Project",          req:true, type:"project"},
  {key:"equipmentName", label:"Equipment Name",   req:true},
  {key:"permitNo",      label:"Permit No.",       req:true},
  {key:"permitType",    label:"Permit Type",      req:true},
  {key:"issuedBy",      label:"Issued By"},
  {key:"issueDate",     label:"Issue Date",       type:"date"},
  {key:"expiryDate",    label:"Expiry Date",      type:"date", req:true},
  {key:"remarks",       label:"Remarks",          type:"textarea"},
  {key:"fileLink",      label:"File Link (Google Drive / SharePoint)", type:"link"},
];

const TUV_FIELDS = [
  {key:"project",        label:"Project",          req:true, type:"project"},
  {key:"equipment",      label:"Equipment / Unit", req:true},
  {key:"serialId",       label:"Serial / ID",      req:true},
  {key:"certNo",         label:"Certificate No."},
  {key:"inspectionDate", label:"Inspection Date",  type:"date"},
  {key:"expiryDate",     label:"Expiry Date",      type:"date", req:true},
  {key:"remarks",        label:"Remarks",          type:"textarea"},
];

const MANPOWER_FIELDS = [
  {key:"project",     label:"Project",           req:true, type:"project"},
  {key:"name",        label:"Employee Name",     req:true},
  {key:"idPassport",  label:"ID / Passport No.", req:true},
  {key:"designation", label:"Designation"},
  {key:"certType",    label:"Certificate Type"},
  {key:"issueDate",   label:"Issue Date",        type:"date"},
  {key:"expiryDate",  label:"Expiry Date",       type:"date", req:true},
  {key:"remarks",     label:"Remarks",           type:"textarea"},
];

const EXCEL_MAP_TUV = {
  "EQUIPMENT/UNIT":"equipment","EQUIPMENT ID /SERIAL NUMBER":"serialId",
  "INSPECTION DATE":"inspectionDate","EXPIRE DATE":"expiryDate",
  "PROJECT":"project","CERTIFICATE NO":"certNo","REMARKS":"remarks",
};
const EXCEL_MAP_MAN = {
  "PROJECT":"project","EMPLOYEE NAME":"name","ID NO":"idPassport",
  "PASSPORT NO":"idPassport","DESIGNATION":"designation",
  "CERTIFICATE TYPE":"certType","ISSUE DATE":"issueDate",
  "EXPIRY DATE":"expiryDate","EXPIRE DATE":"expiryDate","REMARKS":"remarks",
};

const DEFAULT_PROJECTS = ["NEOM Phase 1","NEOM Phase 2","Riyadh Metro"];

const SEED_TUV = [
  {id:"t1",project:"NEOM Phase 1",equipment:"MUD TANK",           serialId:"SSD-MD-101",        certNo:"TUV-001",inspectionDate:"2025-04-09",expiryDate:"2026-03-03",remarks:""},
  {id:"t2",project:"NEOM Phase 1",equipment:"MAIN DB",            serialId:"ASC-600/2/1",       certNo:"TUV-002",inspectionDate:"2025-04-09",expiryDate:"2026-03-03",remarks:""},
  {id:"t3",project:"NEOM Phase 2",equipment:"PRV MUD PUMP 2000",  serialId:"1240411588",        certNo:"TUV-003",inspectionDate:"2025-09-13",expiryDate:"2026-03-12",remarks:""},
  {id:"t4",project:"NEOM Phase 2",equipment:"HIGH PRESSURE HOSE", serialId:"SA-HPH-8-01",       certNo:"TUV-004",inspectionDate:"2025-08-27",expiryDate:"2026-02-26",remarks:""},
  {id:"t5",project:"Riyadh Metro",equipment:"RECYCLE UNIT",       serialId:"KEM-TRON-279",      certNo:"TUV-005",inspectionDate:"2025-04-08",expiryDate:"2025-01-02",remarks:"Needs renewal"},
  {id:"t6",project:"Riyadh Metro",equipment:"HDD RIG MACHINE",    serialId:"XUG5060ZKSHH00003", certNo:"TUV-006",inspectionDate:"2025-04-08",expiryDate:"2026-04-08",remarks:""},
  {id:"t7",project:"NEOM Phase 1",equipment:"WATER TANK",         serialId:"SSE-WTU-001",       certNo:"TUV-007",inspectionDate:"2025-04-09",expiryDate:"2026-03-03",remarks:""},
];
const SEED_MAN = [
  {id:"m1",project:"NEOM Phase 1",name:"Ahmed Al-Rashid",  idPassport:"SA-1234567",designation:"Drilling Engineer",  certType:"IADC WellSharp",issueDate:"2024-06-01",expiryDate:"2026-06-01",remarks:""},
  {id:"m2",project:"NEOM Phase 1",name:"Mohammed Hassan",  idPassport:"SA-2345678",designation:"Site Supervisor",   certType:"NEBOSH IGC",    issueDate:"2024-01-15",expiryDate:"2026-01-15",remarks:""},
  {id:"m3",project:"Riyadh Metro",name:"Khalid Al-Otaibi", idPassport:"SA-3456789",designation:"Safety Officer",    certType:"First Aid",     issueDate:"2025-01-10",expiryDate:"2026-01-10",remarks:""},
  {id:"m4",project:"NEOM Phase 2",name:"Faisal Al-Zahrani",idPassport:"SA-4567890",designation:"Equipment Operator",certType:"Rigger Level 2",issueDate:"2023-03-01",expiryDate:"2025-02-01",remarks:"Expired – renewal in progress"},
  {id:"m5",project:"NEOM Phase 2",name:"Omar Al-Sayed",    idPassport:"SA-5678901",designation:"Welding Inspector", certType:"AWS CWI",       issueDate:"2024-11-01",expiryDate:"2026-01-10",remarks:""},
];
const SEED_EQ = {
  certifications:[
    {id:"ec1",project:"NEOM Phase 1",equipmentName:"HDD RIG MACHINE",  modelMake:"XZ5060",   serialNumber:"XUG5060ZKSHH00003",certNo:"EQ-001",inspectionDate:"2025-04-08",expiryDate:"2026-03-02",remarks:""},
    {id:"ec2",project:"NEOM Phase 1",equipmentName:"MUD PUMP ZLCONN",  modelMake:"ZLCONN",   serialNumber:"LT01-2024-020",    certNo:"EQ-002",inspectionDate:"2025-04-08",expiryDate:"2026-03-02",remarks:""},
    {id:"ec3",project:"Riyadh Metro",equipmentName:"ANGLE GRINDER",    modelMake:"Bosch GWS",serialNumber:"3220514432023",    certNo:"EQ-003",inspectionDate:"2025-08-27",expiryDate:"2026-02-26",remarks:""},
    {id:"ec4",project:"NEOM Phase 2",equipmentName:"FIRE EXTINGUISHER",modelMake:"Amerex",   serialNumber:"SAF-INS-005",     certNo:"EQ-004",inspectionDate:"2025-08-27",expiryDate:"2025-02-10",remarks:""},
  ],
  invoices:[
    {id:"ei1",project:"NEOM Phase 1",equipmentName:"HDD RIG MACHINE",  invoiceNo:"INV-2024-001",supplier:"Gulf Equipment Co.",  amount:"450000",invoiceDate:"2024-01-15",description:"Purchase of HDD Rig Machine XZ5060",fileLink:""},
    {id:"ei2",project:"NEOM Phase 1",equipmentName:"MUD PUMP ZLCONN",  invoiceNo:"INV-2024-002",supplier:"ZLCONN Arabia",        amount:"85000", invoiceDate:"2024-02-20",description:"Mud pump purchase and installation",fileLink:""},
    {id:"ei3",project:"Riyadh Metro",equipmentName:"ANGLE GRINDER",    invoiceNo:"INV-2024-003",supplier:"Bosch KSA",            amount:"1200",  invoiceDate:"2024-03-05",description:"Power tools procurement",fileLink:""},
  ],
  service:[
    {id:"es1",project:"NEOM Phase 1",equipmentName:"HDD RIG MACHINE",  serviceType:"Preventive Maintenance",technician:"Gulf Tech Services",serviceDate:"2025-01-10",nextServiceDate:"2025-07-10",cost:"12000",description:"6-month scheduled maintenance",fileLink:""},
    {id:"es2",project:"NEOM Phase 1",equipmentName:"MUD PUMP ZLCONN",  serviceType:"Oil Change & Filter",   technician:"ZLCONN Service Team",serviceDate:"2025-02-01",nextServiceDate:"2025-08-01",cost:"3500", description:"Routine oil and filter change",fileLink:""},
    {id:"es3",project:"Riyadh Metro",equipmentName:"ANGLE GRINDER",    serviceType:"Repair",                technician:"On-site technician",  serviceDate:"2025-03-15",nextServiceDate:"",           cost:"800",  description:"Replaced brushes and bearing",fileLink:""},
  ],
  permits:[
    {id:"ep1",project:"NEOM Phase 1",equipmentName:"HDD RIG MACHINE",  permitNo:"PERM-2025-001",permitType:"Operating License",issuedBy:"NEOM Authority",issueDate:"2025-01-01",expiryDate:"2026-01-01",remarks:"",fileLink:""},
    {id:"ep2",project:"NEOM Phase 2",equipmentName:"FIRE EXTINGUISHER",permitNo:"PERM-2025-002",permitType:"Safety Permit",    issuedBy:"Civil Defense",  issueDate:"2025-03-01",expiryDate:"2025-09-01",remarks:"Renewal pending",fileLink:""},
  ],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const daysUntil = d => d ? Math.ceil((new Date(d)-new Date())/86400000) : null;
const fmtDate   = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const uid       = () => Math.random().toString(36).slice(2,9);

function getStatus(days) {
  if (days===null) return {label:"Unknown",       color:T.textMuted, bg:"rgba(61,80,104,.15)"};
  if (days<0)      return {label:"Expired",       color:T.red,       bg:T.redDim};
  if (days<=90)    return {label:"Expiring Soon", color:T.gold,      bg:T.goldDim};
  return             {label:"Valid",            color:T.green,     bg:T.greenDim};
}

function excelDateToString(val) {
  if (!val) return "";
  if (typeof val==="number"){const d=new Date(Math.round((val-25569)*86400*1000));return d.toISOString().slice(0,10);}
  if (typeof val==="string"){const d=new Date(val);if(!isNaN(d))return d.toISOString().slice(0,10);}
  return String(val);
}

function parseExcel(data, map) {
  return data
    .filter(row=>Object.values(row).some(v=>v!==null&&v!==""))
    .map(row=>{
      const rec={id:uid()},upperRow={};
      Object.entries(row).forEach(([k,v])=>{upperRow[k.toUpperCase().trim()]=v;});
      Object.entries(map).forEach(([col,key])=>{
        if(!key)return;
        const val=upperRow[col.toUpperCase()];
        if(val!==undefined&&val!==null&&val!==""){
          if(["expiryDate","inspectionDate","issueDate","serviceDate","nextServiceDate","invoiceDate"].includes(key))rec[key]=excelDateToString(val);
          else rec[key]=String(val).trim();
        }
      });
      return rec;
    });
}

function loadData() {
  try {
    const d=localStorage.getItem("ct_v5");
    if(d) return JSON.parse(d);
    return {tuv:SEED_TUV, manpower:SEED_MAN, equipment:SEED_EQ};
  } catch { return {tuv:SEED_TUV, manpower:SEED_MAN, equipment:SEED_EQ}; }
}
function persist(data){try{localStorage.setItem("ct_v5",JSON.stringify(data));}catch{}}

/* ════════════════════════════ ROOT ════════════════════════════════════════ */
export default function App() {
  useEffect(()=>{
    if(!document.getElementById("ct-g")){
      const s=document.createElement("style");s.id="ct-g";s.textContent=GLOBAL_CSS;document.head.appendChild(s);
    }
  },[]);

  const [tab,      setTab]      = useState("dashboard");
  const [eqTab,    setEqTab]    = useState("certifications");
  const [data,     setData]     = useState(loadData);
  const [search,   setSearch]   = useState("");
  const [fProj,    setFProj]    = useState("");
  const [fStat,    setFStat]    = useState("");
  const [modal,    setModal]    = useState(null);  // {mode, type, record}
  const [detail,   setDetail]   = useState(null);
  const [alertMod, setAlertMod] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [projMod,  setProjMod]  = useState(false);
  const [projects, setProjects] = useState(()=>{
    try{return JSON.parse(localStorage.getItem("ct_projects")||"null")||DEFAULT_PROJECTS;}
    catch{return DEFAULT_PROJECTS;}
  });

  useEffect(()=>{persist(data);},[data]);
  useEffect(()=>{try{localStorage.setItem("ct_projects",JSON.stringify(projects));}catch{}},[projects]);

  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};
  const addProject=name=>{const n=name.trim();if(!n||projects.includes(n))return;setProjects(p=>[...p,n]);};
  const delProject=name=>{setProjects(p=>p.filter(x=>x!==name));};

  /* ── derived alert data ── */
  const allExpiry = [
    ...data.tuv.map(r=>({...r,src:"TUV",label:r.equipment,days:daysUntil(r.expiryDate)})),
    ...data.manpower.map(r=>({...r,src:"Manpower",label:r.name,days:daysUntil(r.expiryDate)})),
    ...(data.equipment.certifications||[]).map(r=>({...r,src:"Eq-Cert",label:r.equipmentName,days:daysUntil(r.expiryDate)})),
    ...(data.equipment.permits||[]).map(r=>({...r,src:"Permit",label:r.equipmentName,days:daysUntil(r.expiryDate)})),
    ...(data.equipment.service||[]).filter(r=>r.nextServiceDate).map(r=>({...r,src:"Service",label:r.equipmentName,days:daysUntil(r.nextServiceDate),expiryDate:r.nextServiceDate})),
  ];
  const attention = allExpiry.filter(r=>r.days!==null&&r.days<=90).sort((a,b)=>a.days-b.days);

  const allProjects = projects;

  /* ── CRUD helpers ── */
  const saveRecord=(type,record,mode)=>{
    setData(prev=>{
      if(type==="tuv"||type==="manpower"){
        const list=[...(prev[type]||[])];
        if(mode==="add")list.push({...record,id:uid()});
        else{const i=list.findIndex(r=>r.id===record.id);if(i>=0)list[i]=record;}
        return{...prev,[type]:list};
      } else {
        const list=[...(prev.equipment[type]||[])];
        if(mode==="add")list.push({...record,id:uid()});
        else{const i=list.findIndex(r=>r.id===record.id);if(i>=0)list[i]=record;}
        return{...prev,equipment:{...prev.equipment,[type]:list}};
      }
    });
    showToast(mode==="add"?"Record added":"Record updated");
    setModal(null);setDetail(null);
  };

  const delRecord=(type,id)=>{
    setData(prev=>{
      if(type==="tuv"||type==="manpower"){
        return{...prev,[type]:prev[type].filter(r=>r.id!==id)};
      } else {
        return{...prev,equipment:{...prev.equipment,[type]:prev.equipment[type].filter(r=>r.id!==id)}};
      }
    });
    showToast("Record deleted","del");setDetail(null);
  };

  const importExcel=(type,file,map)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
        const parsed=parseExcel(rows,map).filter(r=>Object.values(r).filter(v=>v&&v!==r.id).length>0);
        if(!parsed.length){showToast("No valid rows found","del");return;}
        setData(prev=>{
          if(type==="tuv")return{...prev,tuv:parsed};
          if(type==="manpower")return{...prev,manpower:parsed};
          return{...prev,equipment:{...prev.equipment,[type]:parsed}};
        });
        showToast(`✓ Imported ${parsed.length} records`);
      }catch{showToast("Failed to read Excel file","del");}
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── filter equipment sub-tab ── */
  const eqTabDef = EQ_TABS.find(t=>t.id===eqTab);
  const eqRecords = (data.equipment[eqTab]||[])
    .map(r=>({...r,days:daysUntil(r.expiryDate||r.nextServiceDate||null)}))
    .filter(r=>{
      const q=search.toLowerCase();
      return (!search||Object.values(r).some(v=>String(v).toLowerCase().includes(q)))&&
             (!fProj||r.project===fProj)&&
             (!fStat||getStatus(r.days).label===fStat);
    });

  const tuvRecords = data.tuv
    .map(r=>({...r,days:daysUntil(r.expiryDate)}))
    .filter(r=>{
      const q=search.toLowerCase();
      return (!search||Object.values(r).some(v=>String(v).toLowerCase().includes(q)))&&
             (!fProj||r.project===fProj)&&
             (!fStat||getStatus(r.days).label===fStat);
    });

  const manRecords = data.manpower
    .map(r=>({...r,days:daysUntil(r.expiryDate)}))
    .filter(r=>{
      const q=search.toLowerCase();
      return (!search||Object.values(r).some(v=>String(v).toLowerCase().includes(q)))&&
             (!fProj||r.project===fProj)&&
             (!fStat||getStatus(r.days).label===fStat);
    });

  const go=t=>{setTab(t);setSideOpen(false);setSearch("");setFProj("");setFStat("");};

  /* ── fields & map for current context ── */
  const getFields=type=>{
    if(type==="tuv")return TUV_FIELDS;
    if(type==="manpower")return MANPOWER_FIELDS;
    if(type==="certifications")return CERT_FIELDS;
    if(type==="invoices")return INVOICE_FIELDS;
    if(type==="service")return SERVICE_FIELDS;
    if(type==="permits")return PERMIT_FIELDS;
    return [];
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:T.bg}}>
      {sideOpen&&<div className="fade-in" onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:49}}/>}

      <Sidebar tab={tab} go={go} attention={attention} sideOpen={sideOpen} onManageProjects={()=>{setSideOpen(false);setProjMod(true);}} data={data}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <TopBar
          tab={tab} eqTab={eqTab} projects={allProjects}
          search={search} setSearch={setSearch}
          fProj={fProj} setFProj={setFProj}
          fStat={fStat} setFStat={setFStat}
          attention={attention}
          onAdd={()=>{
            if(tab==="tuv")setModal({mode:"add",type:"tuv"});
            else if(tab==="manpower")setModal({mode:"add",type:"manpower"});
            else if(tab==="equipment")setModal({mode:"add",type:eqTab});
          }}
          onAlertCfg={()=>setAlertMod(true)}
          onHamburger={()=>setSideOpen(true)}
          onImport={(file)=>{
            if(tab==="tuv")importExcel("tuv",file,EXCEL_MAP_TUV);
            else if(tab==="manpower")importExcel("manpower",file,EXCEL_MAP_MAN);
          }}
          showImport={tab==="tuv"||tab==="manpower"}
          showAdd={tab==="tuv"||tab==="manpower"||tab==="equipment"}
          eqTabDef={eqTabDef}
        />

        <main style={{flex:1,overflowY:"auto",padding:"20px"}}>
          {tab==="dashboard" && <Dashboard data={data} attention={attention} setTab={setTab} setEqTab={setEqTab} go={go}/>}
          {tab==="equipment" && (
            <EquipmentHub
              eqTab={eqTab} setEqTab={setEqTab}
              records={eqRecords} data={data}
              projects={allProjects}
              onAdd={()=>setModal({mode:"add",type:eqTab})}
              onEdit={r=>setModal({mode:"edit",type:eqTab,record:r})}
              onDel={id=>delRecord(eqTab,id)}
              onDetail={r=>setDetail({...r,type:eqTab})}
              onImport={(file)=>importExcel(eqTab,file,{})}
              search={search} setSearch={setSearch}
              fProj={fProj} setFProj={setFProj}
              fStat={fStat} setFStat={setFStat}
              allProjects={allProjects}
            />
          )}
          {tab==="tuv"      && <SimpleTracker label="TUV Certifications" color={T.blue} records={tuvRecords} count={data.tuv.length} onAdd={()=>setModal({mode:"add",type:"tuv"})} onEdit={r=>setModal({mode:"edit",type:"tuv",record:r})} onDel={id=>delRecord("tuv",id)} onDetail={r=>setDetail({...r,type:"tuv"})}/>}
          {tab==="manpower" && <SimpleTracker label="Manpower Certifications" color={T.green} records={manRecords} count={data.manpower.length} onAdd={()=>setModal({mode:"add",type:"manpower"})} onEdit={r=>setModal({mode:"edit",type:"manpower",record:r})} onDel={id=>delRecord("manpower",id)} onDetail={r=>setDetail({...r,type:"manpower"})}/>}
          {tab==="alerts"   && <Alerts attention={attention} onCfg={()=>setAlertMod(true)} onDetail={r=>setDetail(r)}/>}
        </main>
      </div>

      {modal   &&<RecordModal type={modal.type} mode={modal.mode} record={modal.record} fields={getFields(modal.type)} projects={projects} onClose={()=>setModal(null)} onSave={saveRecord}/>}
      {detail  &&<DetailModal rec={detail} fields={getFields(detail.type)} onClose={()=>setDetail(null)} onEdit={()=>{setModal({mode:"edit",type:detail.type,record:detail});setDetail(null);}} onDel={()=>delRecord(detail.type,detail.id)}/>}
      {alertMod&&<AlertConfig onClose={()=>setAlertMod(false)} showToast={showToast}/>}
      {projMod &&<ProjectsModal projects={projects} onAdd={addProject} onDel={delProject} onClose={()=>setProjMod(false)}/>}

      {toast&&(
        <div className="fade-up" style={{position:"fixed",bottom:24,right:24,zIndex:999,background:toast.type==="del"?"#130a0a":"#081310",border:`1px solid ${toast.type==="del"?T.red:T.green}`,color:toast.type==="del"?T.red:T.green,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10}}>
          {toast.type==="del"?"✕":"✓"} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════ SIDEBAR ════════════════════════════════════ */
function Sidebar({tab,go,attention,sideOpen,onManageProjects,data}) {
  const isMobile=window.innerWidth<900;
  const tuvExp  = data.tuv.filter(r=>daysUntil(r.expiryDate)!==null&&daysUntil(r.expiryDate)<=90).length;
  const manExp  = data.manpower.filter(r=>daysUntil(r.expiryDate)!==null&&daysUntil(r.expiryDate)<=90).length;
  const eqExp   = [...(data.equipment.certifications||[]),...(data.equipment.permits||[])].filter(r=>daysUntil(r.expiryDate)!==null&&daysUntil(r.expiryDate)<=90).length;

  return (
    <aside style={{width:255,flexShrink:0,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:50,position:isMobile?"fixed":"relative",top:0,left:0,height:"100%",transform:isMobile?(sideOpen?"translateX(0)":"translateX(-100%)"):"none",transition:"transform .28s ease"}}>
      <div style={{padding:"22px 20px 18px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <img src="logo.png" alt="Scorpion Arabia" style={{width:56,height:56,borderRadius:10,objectFit:"cover",background:"#000",flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,letterSpacing:".5px",lineHeight:1.1}}>SCORPION ARABIA</div>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:600,letterSpacing:"1.4px",marginTop:3}}>EQUIPMENT MANAGER</div>
          </div>
        </div>
      </div>

      <nav style={{padding:"14px 10px",flex:1,overflowY:"auto"}}>
        <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:"1.2px",padding:"0 8px 8px"}}>NAVIGATION</div>
        {MAIN_TABS.map(n=>{
          const badge=n.id==="alerts"?attention.length:n.id==="tuv"?tuvExp:n.id==="manpower"?manExp:n.id==="equipment"?eqExp:0;
          const active=tab===n.id;
          return (
            <button key={n.id} onClick={()=>go(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",marginBottom:2,textAlign:"left",background:active?T.blueDim:"transparent",borderLeft:`2px solid ${active?T.blue:"transparent"}`,transition:"all .15s"}}>
              <span style={{fontSize:18,color:active?T.blue:T.textMuted}}>{n.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:active?T.blue:T.text}}>{n.label}</div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:1}}>{n.desc}</div>
              </div>
              {badge>0&&<span style={{background:n.id==="alerts"?T.red:T.gold,color:"#000",borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>{badge}</span>}
            </button>
          );
        })}

        <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:"1.2px",padding:"14px 8px 8px"}}>SETTINGS</div>
        <button onClick={onManageProjects} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",textAlign:"left",transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.background=T.cardHover;e.currentTarget.style.borderColor=T.blue;}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=T.border;}}>
          <span style={{fontSize:18,color:T.blue}}>⊕</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Manage Projects</div>
            <div style={{fontSize:10,color:T.textMuted,marginTop:1}}>Add or remove projects</div>
          </div>
        </button>
      </nav>

      <div style={{padding:"12px 18px 20px",borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:10,color:T.textMuted,textAlign:"center"}}>Scorpion Arabia © 2025</div>
      </div>
    </aside>
  );
}

/* ════════════════════════════ TOP BAR ════════════════════════════════════ */
function TopBar({tab,eqTab,projects,search,setSearch,fProj,setFProj,fStat,setFStat,attention,onAdd,onAlertCfg,onHamburger,onImport,showImport,showAdd,eqTabDef}) {
  const fileRef=useRef();
  const addColor=tab==="tuv"?T.blue:tab==="manpower"?T.green:eqTabDef?.color||T.gold;
  const subLabel=tab==="equipment"&&eqTabDef?eqTabDef.label:tab==="tuv"?"TUV Certifications":tab==="manpower"?"Manpower Certifications":tab==="alerts"?"Alerts & Notifications":"Overview & Metrics";

  return (
    <header style={{background:T.sidebar,borderBottom:`1px solid ${T.border}`,padding:"0 20px",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",height:68,position:"relative"}}>
        <button onClick={onHamburger} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,zIndex:1}}>☰</button>
        <div style={{position:"absolute",left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text,letterSpacing:"3px"}}>CERTIFICATION TRACKER</div>
          <div style={{fontSize:11,color:T.textMuted,letterSpacing:"1px",marginTop:1}}>{subLabel}</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",zIndex:1}}>
          {showImport&&(
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){onImport(e.target.files[0]);e.target.value="";}}}/>
              <button onClick={()=>fileRef.current.click()} style={{background:T.goldDim,border:`1px solid ${T.gold}44`,color:T.gold,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600}}>⬆ Import Excel</button>
            </>
          )}
          {showAdd&&<button onClick={onAdd} style={{background:addColor,color:"#000",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700}}>+ Add</button>}
          {attention.length>0&&(
            <button onClick={onAlertCfg} style={{background:T.redDim,border:`1px solid ${T.red}44`,color:T.red,borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
              ▲<span style={{background:T.red,color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:10,fontWeight:700}}>{attention.length}</span>
            </button>
          )}
        </div>
      </div>

      {(tab==="tuv"||tab==="manpower"||tab==="equipment")&&(
        <div style={{paddingBottom:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:160,position:"relative"}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:T.textMuted,fontSize:15}}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"
              style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px 8px 32px",fontSize:13,color:T.text,outline:"none"}}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"dark"}}>
            <option value="">All Projects</option>
            {projects.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          {(tab==="tuv"||tab==="manpower"||(tab==="equipment"&&(eqTab==="certifications"||eqTab==="permits")))&&(
            <select value={fStat} onChange={e=>setFStat(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"dark"}}>
              <option value="">All Statuses</option>
              <option>Valid</option><option>Expiring Soon</option><option>Expired</option>
            </select>
          )}
        </div>
      )}
    </header>
  );
}

/* ════════════════════════════ DASHBOARD ══════════════════════════════════ */
function Dashboard({data,attention,setTab,setEqTab,go}) {
  const tuvStats  = calcStats(data.tuv,"expiryDate");
  const manStats  = calcStats(data.manpower,"expiryDate");
  const certStats = calcStats(data.equipment.certifications||[],"expiryDate");
  const permStats = calcStats(data.equipment.permits||[],"expiryDate");
  const invCount  = (data.equipment.invoices||[]).length;
  const svcCount  = (data.equipment.service||[]).length;
  const total     = tuvStats.total+manStats.total+certStats.total+permStats.total;
  const valid     = tuvStats.valid+manStats.valid+certStats.valid+permStats.valid;
  const pct       = total?Math.round(valid/total*100):0;

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {/* Compliance bar */}
      <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 22px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.textSub,letterSpacing:".5px"}}>OVERALL COMPLIANCE</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:pct>=80?T.green:pct>=60?T.gold:T.red}}>{pct}%</span>
        </div>
        <div style={{height:8,background:T.border,borderRadius:999}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:999,transition:"width .8s ease",background:pct>=80?`linear-gradient(90deg,${T.green},#059669)`:pct>=60?`linear-gradient(90deg,${T.gold},#d97706)`:`linear-gradient(90deg,${T.red},#dc2626)`}}/>
        </div>
      </div>

      {/* Module cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:22}}>
        {[
          {label:"TUV Certifications",icon:"◈",color:T.blue,  dim:T.blueDim,  stats:tuvStats,  onClick:()=>go("tuv")},
          {label:"Manpower Certs",    icon:"◉",color:T.green, dim:T.greenDim, stats:manStats,  onClick:()=>go("manpower")},
          {label:"Equipment Certs",   icon:"◈",color:T.blue,  dim:T.blueDim,  stats:certStats, onClick:()=>{go("equipment");setEqTab("certifications");}},
          {label:"Equipment Permits", icon:"⬡",color:T.gold,  dim:T.goldDim,  stats:permStats, onClick:()=>{go("equipment");setEqTab("permits");}},
          {label:"Invoices",icon:"◆",color:T.green,dim:T.greenDim,stats:{total:invCount,valid:invCount,expiring:0,expired:0},onClick:()=>{go("equipment");setEqTab("invoices");}},
          {label:"Service Records",icon:"⚙",color:T.purple,dim:T.purpleDim,stats:{total:svcCount,valid:svcCount,expiring:0,expired:0},onClick:()=>{go("equipment");setEqTab("service");}},
        ].map((m,i)=>(
          <div key={m.label} className="fade-up" onClick={m.onClick}
            style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px",cursor:"pointer",animationDelay:`${i*.06}s`,transition:"border-color .2s,transform .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=m.color;e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:30,height:30,background:m.dim,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:m.color}}>{m.icon}</div>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.text}}>{m.label}</span>
            </div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:800,color:m.color,lineHeight:1}}>{m.stats.total}</div>
            <div style={{display:"flex",gap:10,marginTop:6,fontSize:11}}>
              {m.stats.expiring>0&&<span style={{color:T.gold,fontWeight:600}}>{m.stats.expiring} expiring</span>}
              {m.stats.expired>0&&<span style={{color:T.red,fontWeight:600}}>{m.stats.expired} expired</span>}
              {m.stats.expiring===0&&m.stats.expired===0&&<span style={{color:T.textMuted}}>all good</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Attention */}
      {attention.length>0&&(
        <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:T.textSub,letterSpacing:".5px"}}>NEEDS ATTENTION</span>
            <span style={{background:T.redDim,color:T.red,borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:700}}>{attention.length}</span>
          </div>
          <div style={{display:"grid",gap:8}}>
            {attention.slice(0,10).map(r=>{
              const s=getStatus(r.days);
              const srcColor={TUV:T.blue,Manpower:T.green,"Eq-Cert":T.blue,Permit:T.gold,Service:T.purple}[r.src]||T.blue;
              return (
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:T.bg,borderRadius:10,border:`1px solid ${T.border}`,transition:"border-color .15s,background .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background=T.cardHover;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.bg;}}>
                  <div style={{width:4,height:36,borderRadius:2,background:s.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.label}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:2,display:"flex",gap:6}}>
                      <span style={{background:`${srcColor}18`,color:srcColor,borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{r.src}</span>
                      <span>{r.project}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:s.color,lineHeight:1}}>{Math.abs(r.days)}</div>
                    <div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>{r.days<0?"OVERDUE":"DAYS LEFT"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function calcStats(arr,dateKey) {
  const ds=arr.map(r=>daysUntil(r[dateKey]));
  return {total:ds.length,valid:ds.filter(d=>d!==null&&d>90).length,expiring:ds.filter(d=>d!==null&&d>=0&&d<=90).length,expired:ds.filter(d=>d!==null&&d<0).length};
}

/* ════════════════════════════ EQUIPMENT HUB ══════════════════════════════ */
function EquipmentHub({eqTab,setEqTab,records,data,projects,onAdd,onEdit,onDel,onDetail,search,setSearch,fProj,setFProj,fStat,setFStat,allProjects}) {
  const hasExpiry=eqTab==="certifications"||eqTab==="permits";
  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
        {EQ_TABS.map(t=>{
          const active=eqTab===t.id;
          const count=(data.equipment[t.id]||[]).length;
          return (
            <button key={t.id} onClick={()=>setEqTab(t.id)} style={{flexShrink:0,padding:"9px 18px",borderRadius:999,border:`1px solid ${active?t.color:T.border}`,background:active?t.dim:"transparent",color:active?t.color:T.textSub,fontSize:13,fontWeight:active?700:500,display:"flex",alignItems:"center",gap:8,transition:"all .2s"}}>
              <span style={{fontSize:15}}>{t.icon}</span>{t.label}
              <span style={{background:active?t.color:T.border,color:active?"#000":T.textMuted,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Add button inside hub */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <button onClick={onAdd} style={{background:EQ_TABS.find(t=>t.id===eqTab)?.color||T.gold,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700}}>
          + Add {EQ_TABS.find(t=>t.id===eqTab)?.label.replace("Records","Record").replace("Invoices","Invoice").replace("Permits","Permit").replace("Certifications","Certification")}
        </button>
      </div>

      <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{records.length} record{records.length!==1?"s":""}</div>

      {records.length===0
        ?<EqEmpty onAdd={onAdd} eqTab={eqTab}/>
        :<div style={{display:"grid",gap:10}}>
          {records.map((r,i)=><EqCard key={r.id} r={r} eqTab={eqTab} delay={i*.025} onEdit={()=>onEdit(r)} onDel={()=>onDel(r.id)} onDetail={()=>onDetail(r)}/>)}
        </div>
      }
    </div>
  );
}

function EqCard({r,eqTab,delay,onEdit,onDel,onDetail}) {
  const cfg=EQ_TABS.find(t=>t.id===eqTab)||EQ_TABS[0];
  const days=r.days;
  const s=getStatus(days);
  const hasExpiry=eqTab==="certifications"||eqTab==="permits";
  const hasDueDate=eqTab==="service"&&r.nextServiceDate;

  return (
    <div className="fade-up" onClick={onDetail}
      style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${cfg.color}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",animationDelay:`${delay}s`,transition:"background .15s"}}
      onMouseEnter={e=>e.currentTarget.style.background=T.cardHover}
      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:5}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.equipmentName||r.invoiceNo||r.permitNo||"—"}</div>
            {hasExpiry&&<span style={{flexShrink:0,background:s.bg,color:s.color,borderRadius:999,padding:"3px 12px",fontSize:12,fontWeight:700}}>{s.label}</span>}
            {hasDueDate&&<span style={{flexShrink:0,background:getStatus(daysUntil(r.nextServiceDate)).bg,color:getStatus(daysUntil(r.nextServiceDate)).color,borderRadius:999,padding:"3px 12px",fontSize:12,fontWeight:700}}>Due {fmtDate(r.nextServiceDate)}</span>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:r.description||r.remarks?8:0}}>
            {r.project&&<Chip>{r.project}</Chip>}
            {r.serialNumber&&<Chip>S/N: {r.serialNumber}</Chip>}
            {r.certNo&&<Chip>{r.certNo}</Chip>}
            {r.permitNo&&<Chip>{r.permitNo}</Chip>}
            {r.permitType&&<Chip>{r.permitType}</Chip>}
            {r.invoiceNo&&<Chip>{r.invoiceNo}</Chip>}
            {r.supplier&&<Chip>{r.supplier}</Chip>}
            {r.amount&&<Chip color={T.green}>SAR {Number(r.amount).toLocaleString()}</Chip>}
            {r.serviceType&&<Chip>{r.serviceType}</Chip>}
            {r.technician&&<Chip>{r.technician}</Chip>}
            {r.cost&&<Chip color={T.purple}>SAR {Number(r.cost).toLocaleString()}</Chip>}
            {r.invoiceDate&&<Chip>Date: {fmtDate(r.invoiceDate)}</Chip>}
            {r.serviceDate&&<Chip>Serviced: {fmtDate(r.serviceDate)}</Chip>}
            {r.expiryDate&&hasExpiry&&<Chip color={s.color}>Exp: {fmtDate(r.expiryDate)}</Chip>}
            {hasExpiry&&days!==null&&<Chip color={s.color}>{days>=0?`${days}d left`:`${Math.abs(days)}d overdue`}</Chip>}
            {r.fileLink&&(
              <a href={r.fileLink} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:6,padding:"2px 9px",fontSize:12,color:T.blue,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
                📎 Open File
              </a>
            )}
          </div>
          {(r.description||r.remarks)&&<div style={{fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{r.description||r.remarks}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <ABtn onClick={onEdit} color={T.blue}>✎</ABtn>
          <ABtn onClick={onDel}  color={T.red}>✕</ABtn>
        </div>
      </div>
    </div>
  );
}

function EqEmpty({onAdd,eqTab}) {
  const cfg=EQ_TABS.find(t=>t.id===eqTab)||EQ_TABS[0];
  return (
    <div style={{textAlign:"center",padding:"60px 20px",background:T.card,borderRadius:14,border:`1px dashed ${T.border}`}}>
      <div style={{fontSize:44,color:cfg.color,opacity:.25,marginBottom:14}}>{cfg.icon}</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.textSub,marginBottom:6}}>No {cfg.label} found</div>
      <div style={{fontSize:13,color:T.textMuted,marginBottom:22}}>Add your first record</div>
      <button onClick={onAdd} style={{background:cfg.color,color:"#000",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:700}}>+ Add Record</button>
    </div>
  );
}

/* ════════════════════════════ SIMPLE TRACKER (TUV/Manpower) ══════════════ */
function SimpleTracker({label,color,records,count,onAdd,onEdit,onDel,onDetail}) {
  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{records.length} of {count} records shown</div>
      {records.length===0
        ?<div style={{textAlign:"center",padding:"60px 20px",background:T.card,borderRadius:14,border:`1px dashed ${T.border}`}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.textSub,marginBottom:16}}>No records found</div>
          <button onClick={onAdd} style={{background:color,color:"#000",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:700}}>+ Add Record</button>
        </div>
        :<div style={{display:"grid",gap:10}}>
          {records.map((r,i)=>{
            const s=getStatus(r.days);
            const name=r.equipment||r.name||"—";
            const sub=r.serialId||r.designation||"";
            return (
              <div key={r.id} className="fade-up" onClick={()=>onDetail(r)}
                style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${s.color}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",animationDelay:`${i*.025}s`,transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.cardHover}
                onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:4}}>
                      <div style={{fontSize:15,fontWeight:600,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                      <span style={{flexShrink:0,background:s.bg,color:s.color,borderRadius:999,padding:"3px 12px",fontSize:12,fontWeight:700}}>{s.label}</span>
                    </div>
                    {sub&&<div style={{fontSize:12,color:T.textSub,marginBottom:8}}>{sub}</div>}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {r.project&&<Chip>{r.project}</Chip>}
                      {(r.certNo||r.certType)&&<Chip>{r.certNo||r.certType}</Chip>}
                      {r.inspectionDate&&<Chip>Insp: {fmtDate(r.inspectionDate)}</Chip>}
                      <Chip color={s.color}>Exp: {fmtDate(r.expiryDate)}</Chip>
                      {r.days!==null&&<Chip color={s.color}>{r.days>=0?`${r.days}d left`:`${Math.abs(r.days)}d overdue`}</Chip>}
                    </div>
                    {r.remarks&&<div style={{marginTop:8,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{r.remarks}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <ABtn onClick={()=>onEdit(r)} color={T.blue}>✎</ABtn>
                    <ABtn onClick={()=>onDel(r.id)} color={T.red}>✕</ABtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

/* ════════════════════════════ ALERTS ════════════════════════════════════ */
function Alerts({attention,onCfg,onDetail}) {
  const expired=attention.filter(r=>r.days<0).sort((a,b)=>a.days-b.days);
  const expiring=attention.filter(r=>r.days>=0).sort((a,b)=>a.days-b.days);
  return (
    <div style={{maxWidth:820,margin:"0 auto"}}>
      <div className="fade-up" style={{background:"linear-gradient(135deg,#0a1628,#0d2350)",border:"1px solid #1d3461",borderRadius:14,padding:"18px 22px",marginBottom:22}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.blue,marginBottom:4}}>📧 EMAIL NOTIFICATIONS</div>
            <div style={{fontSize:13,color:T.textMuted}}>Automatic alerts sent 90 days before expiry via your company SMTP server.</div>
          </div>
          <button onClick={onCfg} style={{background:"rgba(56,189,248,.15)",border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600}}>⚙ Configure</button>
        </div>
      </div>
      {attention.length===0
        ?<div style={{textAlign:"center",padding:"80px 20px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:52,marginBottom:16}}>✓</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.green,marginBottom:8}}>ALL CLEAR</div>
          <div style={{fontSize:14,color:T.textMuted}}>No certifications require attention</div>
        </div>
        :<>
          {expired.length>0&&<AlertSection title="EXPIRED" color={T.red} records={expired}/>}
          {expiring.length>0&&<AlertSection title="EXPIRING / DUE WITHIN 90 DAYS" color={T.gold} records={expiring}/>}
        </>
      }
    </div>
  );
}

function AlertSection({title,color,records}) {
  return (
    <div className="fade-up" style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:3,height:18,borderRadius:2,background:color}}/>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textSub,letterSpacing:".8px"}}>{title}</span>
        <span style={{background:`${color}20`,color,borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:700}}>{records.length}</span>
      </div>
      <div style={{display:"grid",gap:8}}>
        {records.map(r=>{
          const s=getStatus(r.days);
          const srcColor={TUV:T.blue,Manpower:T.green,"Eq-Cert":T.blue,Permit:T.gold,Service:T.purple}[r.src]||T.blue;
          return (
            <div key={r.id} style={{background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${s.color}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.cardHover}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.label}</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:3,display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{background:`${srcColor}18`,color:srcColor,borderRadius:4,padding:"1px 7px",fontSize:11,fontWeight:600}}>{r.src}</span>
                  <span>{r.project}</span>
                </div>
                <div style={{fontSize:12,color:T.textSub,marginTop:4}}>
                  {r.src==="Service"?`Next service: ${fmtDate(r.expiryDate)}`:`Expires: ${fmtDate(r.expiryDate)}`}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:s.color,lineHeight:1}}>{Math.abs(r.days)}</div>
                <div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>{r.days<0?"DAYS AGO":"DAYS LEFT"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════ SHARED UI ══════════════════════════════════ */
const Chip=({children,color})=><span style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:6,padding:"2px 9px",fontSize:12,color:color||T.textSub,fontWeight:500}}>{children}</span>;
const ABtn=({onClick,color,children})=><button onClick={onClick} style={{width:30,height:30,borderRadius:7,border:`1px solid ${color}33`,background:`${color}18`,color,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;

function Overlay({children,onClose}) {
  return (
    <div className="fade-in" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      {children}
    </div>
  );
}

/* ════════════════════════════ RECORD MODAL ═══════════════════════════════ */
function RecordModal({type,mode,record,fields,projects,onClose,onSave}) {
  const [form,setForm]=useState(record||{});
  const cfg=EQ_TABS.find(t=>t.id===type)||{color:type==="tuv"?T.blue:T.green};
  const accentColor=cfg.color||T.blue;

  const submit=()=>{
    const missing=fields.filter(f=>f.req&&!form[f.key]);
    if(missing.length){alert(`Required: ${missing.map(f=>f.label).join(", ")}`);return;}
    onSave(type,form,mode);
  };

  const typeLabel=type==="tuv"?"TUV":type==="manpower"?"MANPOWER":type.toUpperCase();

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:T.sidebar,zIndex:1}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{mode==="add"?"NEW":"EDIT"} {typeLabel} RECORD</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{mode==="add"?"Fill in the details below":"Update the record"}</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>
        <div style={{padding:"18px 22px"}}>
          {fields.map(f=>(
            <div key={f.key} style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>
                {f.label.toUpperCase()}{f.req&&<span style={{color:accentColor}}> *</span>}
              </label>
              {f.type==="project"
                ?<select value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:form[f.key]?T.text:T.textMuted,outline:"none",colorScheme:"dark"}}
                    onFocus={e=>e.target.style.borderColor=accentColor} onBlur={e=>e.target.style.borderColor=T.border}>
                    <option value="">Select a project…</option>
                    {projects.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                :f.type==="textarea"
                  ?<textarea value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} rows={2}
                      style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",resize:"vertical",colorScheme:"dark"}}
                      onFocus={e=>e.target.style.borderColor=accentColor} onBlur={e=>e.target.style.borderColor=T.border}/>
                  :f.type==="link"
                    ?<div>
                        <input type="url" value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                          placeholder="https://drive.google.com/... or https://sharepoint.com/..."
                          style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.blue,outline:"none",colorScheme:"dark"}}
                          onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
                        {form[f.key]&&<a href={form[f.key]} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,marginTop:4,display:"inline-block"}}>📎 Test link →</a>}
                      </div>
                    :<input type={f.type||"text"} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                        style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"dark"}}
                        onFocus={e=>e.target.style.borderColor=accentColor} onBlur={e=>e.target.style.borderColor=T.border}/>
              }
            </div>
          ))}
        </div>
        <div style={{padding:"0 22px 22px",display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={submit}  style={{flex:2,background:accentColor,border:"none",color:"#000",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700}}>{mode==="add"?"Add Record":"Save Changes"}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ════════════════════════════ DETAIL MODAL ═══════════════════════════════ */
function DetailModal({rec,fields,onClose,onEdit,onDel}) {
  const cfg=EQ_TABS.find(t=>t.id===rec.type);
  const accentColor=cfg?.color||(rec.type==="tuv"?T.blue:T.green);
  const days=daysUntil(rec.expiryDate||rec.nextServiceDate||null);
  const s=getStatus(days);
  const title=rec.equipmentName||rec.equipment||rec.name||rec.invoiceNo||rec.permitNo||"Record";

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:480,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{background:`${accentColor}12`,borderRadius:"18px 18px 0 0",padding:"20px 22px 16px",borderBottom:`1px solid ${accentColor}30`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:accentColor,fontWeight:700,letterSpacing:"1.2px",marginBottom:5}}>{(rec.type||"").toUpperCase()} RECORD</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:19,color:T.text,lineHeight:1.2}}>{title}</div>
              {days!==null&&(
                <div style={{marginTop:10,display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:40,color:s.color,lineHeight:1}}>{Math.abs(days)}</span>
                  <span style={{fontSize:13,color:T.textMuted}}>{days<0?"days overdue":"days remaining"}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"none",color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
          </div>
        </div>
        <div style={{padding:"16px 22px"}}>
          {fields.filter(f=>rec[f.key]).map(f=>(
            <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,color:T.textMuted,fontWeight:500,flexShrink:0,marginRight:12}}>{f.label}</span>
              {f.type==="link"
                ?<a href={rec[f.key]} target="_blank" rel="noreferrer" style={{fontSize:13,color:T.blue,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>📎 Open File →</a>
                :<span style={{fontSize:13,color:T.textSub,fontWeight:500,textAlign:"right",maxWidth:"60%",wordBreak:"break-word"}}>{f.type==="date"?fmtDate(rec[f.key]):rec[f.key]}</span>
              }
            </div>
          ))}
        </div>
        <div style={{padding:"0 22px 22px",display:"flex",gap:10}}>
          <button onClick={onDel}  style={{flex:1,background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Delete</button>
          <button onClick={onEdit} style={{flex:2,background:accentColor,border:"none",color:"#000",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700}}>Edit Record</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ════════════════════════════ PROJECTS MODAL ════════════════════════════ */
function ProjectsModal({projects,onAdd,onDel,onClose}) {
  const [newName,setNewName]=useState("");
  const handleAdd=()=>{if(newName.trim()){onAdd(newName);setNewName("");}};
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:460,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>MANAGE PROJECTS</div>
            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Add or remove projects</div>
          </div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>×</button>
        </div>
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8,letterSpacing:".5px"}}>ADD NEW PROJECT</div>
          <div style={{display:"flex",gap:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Jeddah Highway Phase 3"
              onKeyDown={e=>e.key==="Enter"&&handleAdd()}
              style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"dark"}}
              onFocus={e=>e.target.style.borderColor=T.green} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button onClick={handleAdd} style={{background:T.green,color:"#000",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,flexShrink:0}}>+ Add</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 22px"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:10,letterSpacing:".5px"}}>EXISTING PROJECTS ({projects.length})</div>
          {projects.map((p,i)=>(
            <div key={p} className="fade-up" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",background:T.bg,borderRadius:10,marginBottom:8,border:`1px solid ${T.border}`,animationDelay:`${i*.04}s`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
                <span style={{fontSize:14,color:T.text,fontWeight:500}}>{p}</span>
              </div>
              <button onClick={()=>onDel(p)} style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{padding:"12px 22px 22px",flexShrink:0}}>
          <button onClick={onClose} style={{width:"100%",background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700}}>Done</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ════════════════════════════ ALERT CONFIG ═══════════════════════════════ */
function AlertConfig({onClose,showToast}) {
  const [cfg,setCfg]=useState(()=>{try{return JSON.parse(localStorage.getItem("ct_alertcfg")||"{}");}catch{return{};}});
  const set=k=>e=>setCfg(p=>({...p,[k]:e.target.value}));
  const save=()=>{localStorage.setItem("ct_alertcfg",JSON.stringify(cfg));showToast("Alert settings saved");onClose();};
  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:460}}>
        <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>EMAIL ALERT CONFIGURATION</div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"18px 22px"}}>
          <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:T.blue}}>
            ℹ Alerts fire 90 days before expiry. Your backend must have SMTP configured.
          </div>
          {[{k:"emails",label:"Recipient Emails",ph:"user@company.com"},{k:"smtpHost",label:"SMTP Host",ph:"mail.company.com"},{k:"smtpPort",label:"SMTP Port",ph:"587"},{k:"smtpUser",label:"SMTP Sender",ph:"noreply@company.com"}].map(f=>(
            <div key={f.k} style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5,letterSpacing:".5px"}}>{f.label.toUpperCase()}</label>
              <input value={cfg[f.k]||""} onChange={set(f.k)} placeholder={f.ph}
                style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",colorScheme:"dark"}}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
          ))}
        </div>
        <div style={{padding:"0 22px 22px",display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={save}    style={{flex:2,background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700}}>Save Settings</button>
        </div>
      </div>
    </Overlay>
  );
}
