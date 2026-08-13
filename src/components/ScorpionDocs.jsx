import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FTextarea, FSelect, FLink, FileLink, FilePreviewModal, PageHeader, Empty, CatManagerModal, ScorpionBulkModal } from "./UI.jsx";

function ScorpionDocs({data,setData,showToast,isAdmin,deepLinkId,onDeepLinkConsumed}) {
  const [modal,    setModal]    = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [selCat,   setSelCat]   = useState("All");
  const [sortBy,   setSortBy]   = useState("name"); // "name" | "expiry" | "category"
  const [selDoc, setSelDoc] = useState(null);
  useEffect(() => {
  if (deepLinkId) {
    const doc = (data.scorpionDocs || []).find(
      d => String(d.id) === String(deepLinkId)
    );

    if (doc) {
      setSelCat(doc.category || "All"); // optional but useful
      // optionally you can also auto-scroll later if needed
    }

    onDeepLinkConsumed?.();
  }
}, [deepLinkId, data.scorpionDocs, onDeepLinkConsumed]);

  const docs = data.scorpionDocs || [];
  const cats = data.scorpionDocCats || DEFAULT_SCORPION_CATS;

  const filtered = selCat === "All" ? docs : docs.filter(d => d.category === selCat);
  const visible  = [...filtered].sort((a, b) => {
    if (sortBy === "expiry") {
      const da = daysUntil(a.expiryDate) ?? 99999;
      const db = daysUntil(b.expiryDate) ?? 99999;
      return da - db;
    }
    if (sortBy === "category") return (a.category||"").localeCompare(b.category||"");
    return (a.name||"").localeCompare(b.name||"");
  });

  const withExpiry = docs.filter(d => d.expiryDate);
  const expired    = withExpiry.filter(d => daysUntil(d.expiryDate) < 0);
  const exp30      = withExpiry.filter(d => { const x=daysUntil(d.expiryDate); return x>=0&&x<=30; });
  const exp90      = withExpiry.filter(d => { const x=daysUntil(d.expiryDate); return x>30&&x<=90; });

  const saveDoc = (doc, mode) => {
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...prev.scorpionDocs];
        if (mode === "add") list.push({...doc, id:uid()});
        else { const i = list.findIndex(d => d.id===doc.id); if(i>=0) list[i]=doc; }
        return {...prev, scorpionDocs:list};
      });
      showToast(mode==="add" ? "Document added" : "Document updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev=>({...prev, scorpionDocs:prev.scorpionDocs.filter(d=>d.id!==id)}));
    showToast("Document deleted","del");
  };

  const saveCats = cats => setData(prev=>({...prev, scorpionDocCats:cats}));

  return (
    <div style={{maxWidth:"min(1200px,95vw)",margin:"0 auto",width:"100%"}}>
      <PageHeader title="SCORPION DOCUMENTS" sub="Company licenses, insurance, contracts & registrations" color={T.blue}>
        <Btn color={T.blue} onClick={()=>setCatModal(true)}>⊕ Categories</Btn>
        <ExportBtn data={docs.map(d=>({Name:d.name,Category:d.category,"Ref No":d.docNo,"Issue Date":d.issueDate,"Expiry Date":d.expiryDate,"File Link":d.fileLink,Notes:d.notes}))} filename="Scorpion_Documents"/>
        <Btn color={T.blue} solid onClick={()=>setModal({mode:"add"})}>+ Add Document</Btn>
      </PageHeader>

      {/* ── Expiry Alert Banners ── */}
      {(expired.length > 0 || exp30.length > 0 || exp90.length > 0) && (
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {expired.length > 0 && (
            <div style={{background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>🚨</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.red,fontSize:14}}>{expired.length} document{expired.length!==1?"s":""} EXPIRED</div>
                <div style={{fontSize:12,color:T.red,opacity:.8,marginTop:3}}>
                  {expired.map(d=>`${d.name} (${Math.abs(daysUntil(d.expiryDate))}d ago)`).join("  ·  ")}
                </div>
              </div>
              <button onClick={()=>{setSortBy("expiry");setSelCat("All");}}
                style={{background:T.red,border:"none",color:"#fff",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                Show First ↑
              </button>
            </div>
          )}
          {exp30.length > 0 && (
            <div style={{background:T.goldDim,border:`1px solid ${T.gold}44`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>⚠️</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.gold,fontSize:14}}>{exp30.length} document{exp30.length!==1?"s":""} expiring within 30 days</div>
                <div style={{fontSize:12,color:T.gold,opacity:.85,marginTop:3}}>
                  {exp30.map(d=>`${d.name} (${daysUntil(d.expiryDate)}d left)`).join("  ·  ")}
                </div>
              </div>
              <button onClick={()=>{setSortBy("expiry");setSelCat("All");}}
                style={{background:T.gold,border:"none",color:"#000",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                Sort by Expiry
              </button>
            </div>
          )}
          {exp30.length === 0 && exp90.length > 0 && (
            <div style={{background:`${T.gold}11`,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:22}}>📋</span>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:T.gold,fontSize:14}}>{exp90.length} document{exp90.length!==1?"s":""} expiring within 90 days</div>
                <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>
                  {exp90.map(d=>`${d.name} (${daysUntil(d.expiryDate)}d left)`).join("  ·  ")}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stats strip ── */}
      {docs.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:18}}>
          {[
            {label:"Total Docs",   value:docs.length,                                                              color:T.blue},
            {label:"With Expiry",  value:withExpiry.length,                                                        color:T.textMuted},
            {label:"Valid",        value:withExpiry.filter(d=>(daysUntil(d.expiryDate)??-1)>=90).length,           color:T.green},
            {label:"Expiring ≤90", value:exp30.length + exp90.length,                                              color:T.gold},
            {label:"Expired",      value:expired.length,                                                           color:T.red},
          ].map(s=>(
            <div key={s.label} style={{background:T.card,border:`1px solid ${s.value>0&&(s.label==="Expired"||s.label==="Expiring ≤90")?s.color+"44":T.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Category pills + Sort ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["All",...cats].map(c=>(
            <button key={c} onClick={()=>setSelCat(c)}
              style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${selCat===c?T.blue:T.border}`,background:selCat===c?T.blueDim:"transparent",color:selCat===c?T.blue:T.textSub,fontSize:12,fontWeight:selCat===c?700:500,transition:"all .15s",cursor:"pointer"}}>
              {c}{c!=="All"&&<span style={{opacity:.6}}> ({docs.filter(d=>d.category===c).length})</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:12,color:T.textMuted}}>Sort:</span>
          {[["name","🔤 Name"],["expiry","⏳ Expiry"],["category","📁 Category"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSortBy(k)}
              style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${sortBy===k?T.blue:T.border}`,background:sortBy===k?T.blueDim:"transparent",color:sortBy===k?T.blue:T.textSub,fontSize:12,fontWeight:sortBy===k?700:500,cursor:"pointer",transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document list ── */}
      {visible.length === 0
        ? <Empty icon="◉" label="No documents yet" sub="Add your first company document" color={T.blue} onAdd={()=>setModal({mode:"add"})}/>
        : <div style={{display:"grid",gap:10}}>
            {visible.map((doc,i)=>{
              const days = daysUntil(doc.expiryDate);
              const s    = getStatus(days);
              const rowBg = days!==null&&days<0 ? `${T.red}08` : days!==null&&days<=30 ? `${T.gold}06` : T.card;
              return (
                <div key={doc.id} className="fade-up"
                  style={{background:rowBg,border:`1px solid ${doc.expiryDate&&days<=90?s.color+"55":T.border}`,borderLeft:`4px solid ${doc.expiryDate?s.color:T.blue}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    {/* Title row */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>{doc.name}</span>
                      <Tag color={T.blue}>{doc.category||"—"}</Tag>
                      {doc.expiryDate && <Tag color={s.color}>{s.label}</Tag>}
                    </div>
                    {/* Metadata chips */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {doc.docNo     && <Chip>Ref: {doc.docNo}</Chip>}
                      {doc.issueDate && <Chip>Issued: {fmtDate(doc.issueDate)}</Chip>}
                      {doc.expiryDate && (
                        <Chip color={s.color}>
                          Expires: {fmtDate(doc.expiryDate)}
                          {days!==null&&<span style={{marginLeft:5,fontWeight:800}}>({days<0?`${Math.abs(days)}d overdue`:`${days}d left`})</span>}
                        </Chip>
                      )}
                      {doc.fileLink  && <FileLink href={doc.fileLink}/>}
                    </div>
                    {doc.notes && <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <ABtn color={T.blue} onClick={()=>setModal({mode:"edit",doc})}>✎</ABtn>
                    {isAdmin && <ABtn color={T.red}  onClick={()=>delDoc(doc.id)}>✕</ABtn>}
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
  const [f,setF] = useState(doc || {});
  const set = k => v => setF(p=>({...p,[k]:v}));
  const days = f.expiryDate ? daysUntil(f.expiryDate) : null;
  const s    = getStatus(days);
  return (
    <FormModal title={`${mode==="add"?"ADD":"EDIT"} DOCUMENT`} color={T.blue} onClose={onClose}
      onSave={()=>{if(!f.name){alert("Document name is required");return;}onSave(f,mode);}}>

      <FieldRow label="Document Name">
        <FInput value={f.name||""} onChange={set("name")} color={T.blue} placeholder="e.g. Company Registration Certificate"/>
      </FieldRow>

      <FieldRow label="Category">
        <FSelect value={f.category||""} onChange={set("category")} color={T.blue}>
          <option value="">Select category…</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </FSelect>
      </FieldRow>

      <FieldRow label="Reference / Doc No.">
        <FInput value={f.docNo||""} onChange={set("docNo")} color={T.blue} placeholder="e.g. CR-2024-001"/>
      </FieldRow>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <FieldRow label="Issue Date">
          <FInput type="date" value={f.issueDate||""} onChange={set("issueDate")} color={T.blue}/>
        </FieldRow>
        <FieldRow label="Expiry Date">
          <FInput type="date" value={f.expiryDate||""} onChange={set("expiryDate")} color={days!==null&&days<=90?T.gold:T.blue}/>
        </FieldRow>
      </div>

      {/* Live expiry status preview */}
      {f.expiryDate && (
        <div style={{background:s.bg,border:`1px solid ${s.color}44`,borderRadius:8,padding:"10px 14px",fontSize:13,color:s.color,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>{days<0?"🚨":days<=30?"⚠️":days<=90?"📋":"✅"}</span>
          {days<0
            ? `Expired ${Math.abs(days)} day${Math.abs(days)!==1?"s":""} ago — renew immediately`
            : days<=30
              ? `Expiring in ${days} day${days!==1?"s":""} — urgent renewal needed`
              : days<=90
                ? `Expiring in ${days} day${days!==1?"s":""} — plan renewal soon`
                : `Valid — ${days} day${days!==1?"s":""} until expiry`
          }
        </div>
      )}

      <FieldRow label="File Link (Google Drive / SharePoint)">
        <FLink value={f.fileLink||""} onChange={set("fileLink")}/>
      </FieldRow>

      <FieldRow label="Notes">
        <FTextarea value={f.notes||""} onChange={set("notes")} color={T.blue} placeholder="Any remarks about this document…"/>
      </FieldRow>
    </FormModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MANPOWER PAGE
════════════════════════════════════════════════════════════════════════════ */

export { ScorpionDocs };
