import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, parseExcelRows, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FLink, FileLink, FilePreviewModal, PageHeader, Empty, CatManagerModal } from "./UI.jsx";

function EquipmentPage({data,setData,showToast,isAdmin,deepLinkId,onDeepLinkConsumed}) {
  const rigs = data.rigs || [];
  const [modal,   setModal]   = useState(null);
  const [selEq,   setSelEq]   = useState(null); // selected equipment
  const [fProj,   setFProj]   = useState("");
  const [fStatus, setFStatus] = useState("");
  const eqBulkRef = useRef(); // must be here — hooks cannot be after early return
  useEffect(() => {

  if (deepLinkId) {
    const eq = (data.equipment || []).find(
      e => String(e.id) === String(deepLinkId)
    );


    if (eq) {
      setSelEq(eq);
    } else {
      console.error("No equipment found for ID:", deepLinkId);
    }

    onDeepLinkConsumed?.();
  }
}, [deepLinkId, data.equipment, onDeepLinkConsumed]);

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
        if(mode==="add")list.push({...eq,id:uid(),certifications:[],invoices:[],insurance:[],permits:[],maintenance:[]});
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
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>
      {/* Show EquipmentDetail when equipment selected */}
      {eqFresh && <EquipmentDetail eq={eqFresh} projects={projects} onBack={()=>setSelEq(null)} onUpdate={updateEq} onDelete={()=>delEq(eqFresh.id)} onEdit={()=>setModal({mode:"edit",eq:eqFresh})} showToast={showToast} isAdmin={isAdmin}/>}
      {/* Show list when nothing selected */}
      {!eqFresh && <>
      <PageHeader title="EQUIPMENT" sub="Assets with certifications, invoices, insurance & permits" color={T.gold}>
        <select value={fProj} onChange={e=>setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Projects</option>
          {renderProjectOptions(projects)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
          <option value="">All Statuses</option>
          <option>Active</option><option>Under Maintenance</option><option>Inactive</option>
        </select>
        <input ref={eqBulkRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importBulkEqCerts(e.target.files[0]);e.target.value="";}}}/>
        <Btn color={T.gold} onClick={()=>eqBulkRef.current.click()}>⬆ Import Excel</Btn>
        <ExportBtn data={equipment.map(e=>({Name:e.name,Model:e.model,"Serial No":e.serialNo,Project:e.project,Status:e.status,Operator:e.operator,"Purchase Date":e.purchaseDate}))} filename="Equipment_List"/>
        <Btn color={T.gold} solid onClick={()=>setModal({mode:"add"})}>+ Add Equipment</Btn>
      </PageHeader>

      {/* Excel import banner */}
      <div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Equipment Certifications from Excel</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Columns: <strong style={{color:T.textSub}}>ITEM TYPE, ITEM NAME/ID, REG/SERIAL NO, TUV PROVIDER, START DATE, EXPIRY DATE</strong> — auto-detects Sheet3, matches equipment by name or serial no.</div>
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
                      {eq.rig&&<Chip>🔩 {eq.rig}</Chip>}
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
                    {isAdmin && <ABtn color={T.red}  onClick={()=>{if(window.confirm("Delete this equipment?"))delEq(eq.id);}}>✕</ABtn>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }
      </>}
      {modal&&<EqModal mode={modal.mode} eq={modal.eq} projects={projects} rigs={rigs} onClose={()=>setModal(null)} onSave={saveEq}/>}
    </div>
  );
}

/* ─── Equipment Detail ───────────────────────────────────────────────────── */

export { EquipmentPage };
