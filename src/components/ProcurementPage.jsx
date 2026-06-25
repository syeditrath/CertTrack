import { useState, useRef, useMemo } from "react";
import { T } from "../theme.js";
import { uid, fmtDate, live } from "../utils.js";
import { getStatus, ExportBtn } from "../constants.js";
import { Btn, Chip, ABtn, PageHeader, Empty } from "./UI.jsx";

/* ─── Procurement document chip options ──────────────────────────────────── */
const PROC_DOC_OPTIONS = [
  "Quotation","Comparative Statement","Invoice","Delivery Note","Packing List","Other",
];

/* ─── Status pill toggle: Released / Unreleased ─────────────────────────── */
function ReleaseToggle({ value, onChange }) {
  const released = value === "Released";
  return (
    <button onClick={()=>onChange(released?"Unreleased":"Released")}
      style={{
        background: released ? T.greenDim : T.redDim,
        border: `1px solid ${released ? T.green : T.red}55`,
        color: released ? T.green : T.red,
        borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", width: "100%",
      }}>
      {released ? "✓ Released" : "○ Unreleased"}
    </button>
  );
}

/* ─── Status pill toggle: Done / Not Done ───────────────────────────────── */
function DoneToggle({ value, onChange, label }) {
  const done = value === true || value === "Done";
  return (
    <button onClick={()=>onChange(!done)}
      style={{
        background: done ? T.greenDim : T.goldDim,
        border: `1px solid ${done ? T.green : T.gold}55`,
        color: done ? T.green : T.gold,
        borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s", width: "100%",
      }}>
      {done ? `✓ ${label}` : `○ ${label}`}
    </button>
  );
}

/* ─── Docs cell: clickable chips that toggle which docs are attached ────── */
function DocsCell({ docsAttached, onToggle }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const active = docsAttached || [];

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
    setOpen(true);
  };

  return (
    <div style={{position:"relative"}}>
      <button ref={btnRef} onClick={handleOpen}
        style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",width:"100%",textAlign:"left"}}>
        {active.length === 0 ? "+ Add docs…" : `${active.length} doc${active.length!==1?"s":""} ▾`}
      </button>
      {active.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
          {active.map(d=><Chip key={d}>{d}</Chip>)}
        </div>
      )}
      {open && coords && (
        <>
          <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:1000}}/>
          <div style={{position:"fixed",top:coords.top,left:coords.left,width:coords.width,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:10,zIndex:1001,boxShadow:"0 10px 30px rgba(0,0,0,0.4)",display:"flex",flexWrap:"wrap",gap:6}}>
            {PROC_DOC_OPTIONS.map(doc=>{
              const isActive = active.includes(doc);
              return (
                <button key={doc} type="button" onClick={()=>onToggle(doc)}
                  style={{background:isActive?T.tealDim:T.bg,border:`1px solid ${isActive?T.teal:T.border}`,color:isActive?T.teal:T.textSub,borderRadius:999,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {isActive?"✓ ":""}{doc}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Editable text cell ─────────────────────────────────────────────────── */
function EditableCell({ value, onChange, placeholder }) {
  return (
    <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:"transparent",border:"none",color:T.text,fontSize:13,fontWeight:600,outline:"none",padding:"4px 2px"}}/>
  );
}

function ProcurementPage({data,setData,showToast,isAdmin}) {
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [newRow, setNewRow] = useState(null); // draft row being added, or null

  const rows = live(data.procurement);

  const visible = rows.filter(r=>{
    const matchesSearch = !search || [r.prNo,r.poNo].some(v=>(v||"").toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !fStatus
      || (fStatus==="pending_pr"   && r.prStatus!=="Released")
      || (fStatus==="pending_po"   && r.prStatus==="Released" && r.poStatus!=="Released")
      || (fStatus==="pending_grn"  && r.poStatus==="Released" && !r.grnDone)
      || (fStatus==="pending_ses"  && r.poStatus==="Released" && !r.sesDone)
      || (fStatus==="complete"     && r.prStatus==="Released" && r.poStatus==="Released" && r.grnDone && r.sesDone);
    return matchesSearch && matchesStatus;
  }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));

  const stats = useMemo(()=>{
    const total = rows.length;
    const prPending  = rows.filter(r=>r.prStatus!=="Released").length;
    const poPending  = rows.filter(r=>r.prStatus==="Released" && r.poStatus!=="Released").length;
    const grnPending = rows.filter(r=>r.poStatus==="Released" && !r.grnDone).length;
    const sesPending = rows.filter(r=>r.poStatus==="Released" && !r.sesDone).length;
    const complete   = rows.filter(r=>r.prStatus==="Released" && r.poStatus==="Released" && r.grnDone && r.sesDone).length;
    return { total, prPending, poPending, grnPending, sesPending, complete };
  }, [rows]);

  const patchRow = (id, patch) => {
    setData(prev=>({
      ...prev,
      procurement:(prev.procurement||[]).map(r=>r.id===id?{...r,...patch}:r),
    }));
  };

  const toggleDoc = (id, doc, currentDocs) => {
    const cur = currentDocs || [];
    const next = cur.includes(doc) ? cur.filter(d=>d!==doc) : [...cur,doc];
    patchRow(id, { docsAttached: next });
  };

  const delRow = id => {
    setData(prev=>({...prev,procurement:(prev.procurement||[]).map(r=>r.id===id?{...r,_deleted:true}:r)}));
    showToast("Deleted","del");
  };

  const startNewRow = () => {
    setNewRow({ prNo:"", prStatus:"Unreleased", poNo:"", poStatus:"Unreleased", docsAttached:[], grnDone:false, sesDone:false });
  };

  const commitNewRow = () => {
    if (!newRow.prNo && !newRow.poNo) { showToast("Enter at least a PR or PO number","del"); return; }
    setData(prev=>({
      ...prev,
      procurement:[...(prev.procurement||[]), {...newRow, id:uid(), date:new Date().toISOString().slice(0,10)}],
    }));
    setNewRow(null);
    showToast("Request added");
  };

  const colWidths = "120px 110px 120px 110px 200px 130px 130px 40px";

  return (
    <div style={{maxWidth:"min(1500px,96vw)",margin:"0 auto",width:"100%"}}>
      <PageHeader title="PROCUREMENT WORKFLOW" sub="PR → PO → Documents → GRN → SES tracking" color={T.teal}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PR / PO…"
          style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.text,outline:"none",minWidth:220}}/>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)}
          style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Stages</option>
          <option value="pending_pr">Pending PR Release</option>
          <option value="pending_po">Pending PO Release</option>
          <option value="pending_grn">Pending GRN</option>
          <option value="pending_ses">Pending SES</option>
          <option value="complete">Fully Complete</option>
        </select>
        <ExportBtn data={rows.map(r=>({
          "PR No":r.prNo, "PR Status":r.prStatus||"Unreleased",
          "PO No":r.poNo, "PO Status":r.poStatus||"Unreleased", "Documents":(r.docsAttached||[]).join(", "),
          "GRN":r.grnDone?"Done":"Not Done", "SES":r.sesDone?"Done":"Not Done", "Date":r.date,
        }))} filename="Procurement_Tracker"/>
        <Btn color={T.teal} solid onClick={startNewRow}>+ New Request</Btn>
      </PageHeader>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:20}}>
        {[
          ["Total Requests", stats.total, T.blue],
          ["PR Pending Release", stats.prPending, T.red],
          ["PO Pending Release", stats.poPending, T.gold],
          ["GRN Pending", stats.grnPending, T.gold],
          ["SES Pending", stats.sesPending, T.gold],
          ["Fully Complete", stats.complete, T.green],
        ].map(([label,val,color])=>(
          <div key={label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 16px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color}}>{val}</div>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:600,marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      {visible.length===0 && !newRow
        ? <Empty icon="📋" label="No procurement requests found" sub="Add your first PR to start tracking" color={T.teal} onAdd={startNewRow}/>
        : <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
          {/* Header row */}
          <div style={{display:"grid",gridTemplateColumns:colWidths,gap:10,padding:"10px 14px",background:T.bg,borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:".04em"}}>
            <div>PR NO.</div><div>PR STATUS</div><div>PO NO.</div><div>PO STATUS</div><div>DOCUMENTS</div><div>GRN</div><div>SES</div><div></div>
          </div>

          {/* Draft new row */}
          {newRow && (
            <div style={{display:"grid",gridTemplateColumns:colWidths,gap:10,padding:"8px 14px",alignItems:"center",borderBottom:`1px solid ${T.border}`,background:T.tealDim}}>
              <EditableCell value={newRow.prNo} onChange={v=>setNewRow(p=>({...p,prNo:v}))} placeholder="PR-0001"/>
              <ReleaseToggle value={newRow.prStatus} onChange={v=>setNewRow(p=>({...p,prStatus:v}))}/>
              <EditableCell value={newRow.poNo} onChange={v=>setNewRow(p=>({...p,poNo:v}))} placeholder="PO-0001"/>
              <ReleaseToggle value={newRow.poStatus} onChange={v=>setNewRow(p=>({...p,poStatus:v}))}/>
              <DocsCell docsAttached={newRow.docsAttached} onToggle={doc=>setNewRow(p=>({...p,docsAttached:(p.docsAttached||[]).includes(doc)?p.docsAttached.filter(d=>d!==doc):[...(p.docsAttached||[]),doc]}))}/>
              <DoneToggle value={newRow.grnDone} onChange={v=>setNewRow(p=>({...p,grnDone:v}))} label="GRN"/>
              <DoneToggle value={newRow.sesDone} onChange={v=>setNewRow(p=>({...p,sesDone:v}))} label="SES"/>
              <div style={{display:"flex",gap:4}}>
                <ABtn color={T.green} onClick={commitNewRow}>✓</ABtn>
                <ABtn color={T.red} onClick={()=>setNewRow(null)}>✕</ABtn>
              </div>
            </div>
          )}

          {/* Data rows */}
          {visible.map((r,i)=>(
            <div key={r.id} className="fade-up" style={{display:"grid",gridTemplateColumns:colWidths,gap:10,padding:"8px 14px",alignItems:"center",borderBottom:i!==visible.length-1?`1px solid ${T.border}`:"none",animationDelay:`${i*.02}s`}}>
              <EditableCell value={r.prNo} onChange={v=>patchRow(r.id,{prNo:v})} placeholder="—"/>
              <ReleaseToggle value={r.prStatus} onChange={v=>patchRow(r.id,{prStatus:v})}/>
              <EditableCell value={r.poNo} onChange={v=>patchRow(r.id,{poNo:v})} placeholder="—"/>
              <ReleaseToggle value={r.poStatus} onChange={v=>patchRow(r.id,{poStatus:v})}/>
              <DocsCell docsAttached={r.docsAttached} onToggle={doc=>toggleDoc(r.id,doc,r.docsAttached)}/>
              <DoneToggle value={r.grnDone} onChange={v=>patchRow(r.id,{grnDone:v})} label="GRN"/>
              <DoneToggle value={r.sesDone} onChange={v=>patchRow(r.id,{sesDone:v})} label="SES"/>
              <div>
                {isAdmin && <ABtn color={T.red} onClick={()=>{if(window.confirm("Delete this request?"))delRow(r.id);}}>✕</ABtn>}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

export { ProcurementPage };
