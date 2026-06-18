import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, PageHeader, Empty } from "./UI.jsx";

/* ─── Procurement document options (multi-select chips, no file upload) ──── */
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
        borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
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
        borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
        cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
      }}>
      {done ? `✓ ${label} Done` : `○ ${label} Pending`}
    </button>
  );
}

function ProcurementPage({data,setData,showToast,isAdmin}) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");

  const rows = data.procurement || [];

  const visible = rows.filter(r=>{
    const matchesSearch = !search || [r.itemDesc,r.prNo,r.poNo,r.requestedBy].some(v=>(v||"").toLowerCase().includes(search.toLowerCase()));
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

  const saveRow = (row, mode) => {
    setModal(null);
    setTimeout(()=>{
      setData(prev=>{
        const list=[...(prev.procurement||[])];
        if(mode==="add"){
          list.push({...row,id:uid(),date:new Date().toISOString().slice(0,10)});
        } else {
          const i=list.findIndex(r=>r.id===row.id);
          if(i>=0)list[i]={...list[i],...row};
        }
        return{...prev,procurement:list};
      });
      showToast(mode==="add"?"Request added":"Updated");
    },0);
  };

  const delRow = id => {
    setData(prev=>({...prev,procurement:(prev.procurement||[]).filter(r=>r.id!==id)}));
    showToast("Deleted","del");
  };

  const patchRow = (id, patch) => {
    setData(prev=>({
      ...prev,
      procurement:(prev.procurement||[]).map(r=>r.id===id?{...r,...patch}:r),
    }));
  };

  return (
    <div style={{maxWidth:"min(1500px,96vw)",margin:"0 auto",width:"100%"}}>
      <PageHeader title="PROCUREMENT WORKFLOW" sub="PR → PO → Documents → GRN → SES tracking" color={T.teal}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PR / PO / item / requester…"
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
          "Item / Description":r.itemDesc, "PR No":r.prNo, "PR Status":r.prStatus||"Unreleased",
          "PO No":r.poNo, "PO Status":r.poStatus||"Unreleased", "Documents":(r.docsAttached||[]).join(", "),
          "GRN":r.grnDone?"Done":"Not Done", "SES":r.sesDone?"Done":"Not Done",
          "Requested By":r.requestedBy, "Date":r.date, "Notes":r.notes,
        }))} filename="Procurement_Tracker"/>
        <Btn color={T.teal} solid onClick={()=>setModal({mode:"add"})}>+ New Request</Btn>
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

      {visible.length===0
        ? <Empty icon="📋" label="No procurement requests found" sub="Add your first PR to start tracking" color={T.teal} onAdd={()=>setModal({mode:"add"})}/>
        : <div style={{display:"grid",gap:10}}>
          {visible.map((r,i)=>(
            <div key={r.id} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 18px",animationDelay:`${i*.03}s`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:220}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text}}>{r.itemDesc||"Untitled Request"}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>
                    {r.requestedBy&&<>Requested by {r.requestedBy} · </>}{fmtDate(r.date)}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",row:r})}>✎</ABtn>
                  {isAdmin && <ABtn color={T.red} onClick={()=>{if(window.confirm("Delete this request?"))delRow(r.id);}}>✕</ABtn>}
                </div>
              </div>

              {/* Workflow stage row */}
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:12}}>
                <div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,borderRadius:8,padding:"6px 10px"}}>
                  <span style={{color:T.textMuted,fontWeight:600}}>PR:</span>
                  <span style={{color:T.text,fontWeight:700}}>{r.prNo||"—"}</span>
                  <ReleaseToggle value={r.prStatus} onChange={v=>patchRow(r.id,{prStatus:v})}/>
                </div>

                <span style={{color:T.border}}>→</span>

                <div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,borderRadius:8,padding:"6px 10px"}}>
                  <span style={{color:T.textMuted,fontWeight:600}}>PO:</span>
                  <span style={{color:T.text,fontWeight:700}}>{r.poNo||"—"}</span>
                  <ReleaseToggle value={r.poStatus} onChange={v=>patchRow(r.id,{poStatus:v})}/>
                </div>

                <span style={{color:T.border}}>→</span>

                <div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,borderRadius:8,padding:"6px 10px"}}>
                  <DoneToggle value={r.grnDone} onChange={v=>patchRow(r.id,{grnDone:v})} label="GRN"/>
                </div>

                <span style={{color:T.border}}>→</span>

                <div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,borderRadius:8,padding:"6px 10px"}}>
                  <DoneToggle value={r.sesDone} onChange={v=>patchRow(r.id,{sesDone:v})} label="SES"/>
                </div>
              </div>

              {/* Documents attached */}
              {(r.docsAttached||[]).length>0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
                  <span style={{fontSize:11,color:T.textMuted,fontWeight:600,marginRight:2}}>Docs:</span>
                  {r.docsAttached.map(d=><Chip key={d}>{d}</Chip>)}
                </div>
              )}

              {r.notes && <div style={{fontSize:12,color:T.textSub,marginTop:8,fontStyle:"italic"}}>{r.notes}</div>}
            </div>
          ))}
        </div>
      }

      {modal && <ProcurementModal mode={modal.mode} row={modal.row} onClose={()=>setModal(null)} onSave={saveRow}/>}
    </div>
  );
}

/* ─── Add / Edit Procurement Request Modal ──────────────────────────────── */
function ProcurementModal({mode,row,onClose,onSave}) {
  const [f,setF]=useState(row||{prStatus:"Unreleased",poStatus:"Unreleased",grnDone:false,sesDone:false,docsAttached:[]});
  const set=k=>v=>setF(p=>({...p,[k]:v}));

  const toggleDoc = (doc) => {
    setF(p=>{
      const cur = p.docsAttached||[];
      return { ...p, docsAttached: cur.includes(doc) ? cur.filter(d=>d!==doc) : [...cur,doc] };
    });
  };

  return (
    <FormModal title={`${mode==="add"?"NEW":"EDIT"} PROCUREMENT REQUEST`} color={T.teal} onClose={onClose}
      onSave={()=>{if(!f.itemDesc){alert("Item / description required");return;}onSave(f,mode);}}>
      <FieldRow label="Item / Description *"><FInput value={f.itemDesc||""} onChange={set("itemDesc")} color={T.teal}/></FieldRow>
      <FieldRow label="Requested By"><FInput value={f.requestedBy||""} onChange={set("requestedBy")} color={T.teal}/></FieldRow>

      <SectionDivider label="PURCHASE REQUEST (PR)"/>
      <FieldRow label="PR Number"><FInput value={f.prNo||""} onChange={set("prNo")} color={T.teal}/></FieldRow>
      <FieldRow label="PR Status">
        <FSelect value={f.prStatus||"Unreleased"} onChange={set("prStatus")} color={T.teal}>
          <option value="Unreleased">Unreleased</option>
          <option value="Released">Released</option>
        </FSelect>
      </FieldRow>

      <SectionDivider label="PURCHASE ORDER (PO)"/>
      <FieldRow label="PO Number"><FInput value={f.poNo||""} onChange={set("poNo")} color={T.teal}/></FieldRow>
      <FieldRow label="PO Status">
        <FSelect value={f.poStatus||"Unreleased"} onChange={set("poStatus")} color={T.teal}>
          <option value="Unreleased">Unreleased</option>
          <option value="Released">Released</option>
        </FSelect>
      </FieldRow>

      <SectionDivider label="DOCUMENTS ATTACHED"/>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
        {PROC_DOC_OPTIONS.map(doc=>{
          const active=(f.docsAttached||[]).includes(doc);
          return (
            <button key={doc} type="button" onClick={()=>toggleDoc(doc)}
              style={{background:active?T.tealDim:T.bg,border:`1px solid ${active?T.teal:T.border}`,color:active?T.teal:T.textSub,borderRadius:999,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              {active?"✓ ":""}{doc}
            </button>
          );
        })}
      </div>

      <SectionDivider label="RECEIPT & SERVICE"/>
      <FieldRow label="GRN (Goods Received Note)">
        <FSelect value={f.grnDone?"Done":"Not Done"} onChange={v=>set("grnDone")(v==="Done")} color={T.teal}>
          <option value="Not Done">Not Done</option>
          <option value="Done">Done</option>
        </FSelect>
      </FieldRow>
      <FieldRow label="SES (Service Entry Sheet)">
        <FSelect value={f.sesDone?"Done":"Not Done"} onChange={v=>set("sesDone")(v==="Done")} color={T.teal}>
          <option value="Not Done">Not Done</option>
          <option value="Done">Done</option>
        </FSelect>
      </FieldRow>

      <SectionDivider label="NOTES"/>
      <FieldRow label="Notes"><FTextarea value={f.notes||""} onChange={set("notes")} color={T.teal}/></FieldRow>
    </FormModal>
  );
}

export { ProcurementPage };
