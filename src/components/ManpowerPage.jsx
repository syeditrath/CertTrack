import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FLink, FileLink, PageHeader, Empty, CatManagerModal } from "./UI.jsx";

function ManpowerPage({data,setData,showToast,isAdmin}) {
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
      const parsed = parseExcelWithHeaderRow(e.target.result, MP_CERT_MAP, MP_HEADER_ROW);
      if (!parsed.length) { showToast("No valid rows found", "del"); return; }

      setData(prev => {
        const manpower = [...prev.manpower];
        let added = 0, updated = 0;

        parsed.forEach(row => {
          const personName = (row.name || "").trim();
          if (!personName) return;

          // ── Personal info fields (only set if non-empty) ─────────────────
          const personalFields = {
            ...(row.idNo          && { idNo:          String(row.idNo) }),
            ...(row.position      && { designation:   row.position }),
            ...(row.nationality   && { nationality:   row.nationality }),
            ...(row.iqamaNo       && { iqamaNo:       String(row.iqamaNo) }),
            ...(row.iqamaExpiry   && { iqamaExpiry:   row.iqamaExpiry }),
            ...(row.passportNo    && { passportNo:    String(row.passportNo) }),
            ...(row.passportExpiry&& { passportExpiry:row.passportExpiry }),
            ...(row.sponsor       && { sponsor:       row.sponsor }),
          };

          // ── Cert object — only if a cert name exists on this row ─────────
          const hasCert = !!(row.certName || "").trim();
          const cert = hasCert ? {
            id:         uid(),
            name:       (row.certName || "").trim(),
            certNo:     row.certNo    || "",
            issueDate:  row.issueDate  || "",
            expiryDate: row.expiryDate || "",
            issuedBy:   row.issuedBy   || "",
            fileLink:   "",
          } : null;

          const idx = manpower.findIndex(
            p => p.name.toLowerCase() === personName.toLowerCase()
          );

          if (idx >= 0) {
            // Person EXISTS — fill any blank personal fields, optionally append cert
            const existing = manpower[idx];
            const updates = {};
            Object.entries(personalFields).forEach(([k, v]) => {
              if (!existing[k]) updates[k] = v; // never overwrite existing data
            });

            let newCerts = existing.certs || [];
            if (cert) {
              const duplicate = newCerts.some(
                c => c.name.toLowerCase() === cert.name.toLowerCase()
                  && c.expiryDate === cert.expiryDate
              );
              if (!duplicate) {
                newCerts = [...newCerts, cert];
                updated++;
              }
            }

            manpower[idx] = { ...existing, ...updates, certs: newCerts };

          } else {
            // Person does NOT EXIST — create full record
            manpower.push({
              id:             uid(),
              name:           personName,
              category:       defaultCat || "",
              certs:          cert ? [cert] : [],   // empty array if no cert
              docs:           [],
              idNo:           personalFields.idNo           || "",
              designation:    personalFields.designation    || "",
              nationality:    personalFields.nationality    || "",
              iqamaNo:        personalFields.iqamaNo        || "",
              iqamaExpiry:    personalFields.iqamaExpiry    || "",
              passportNo:     personalFields.passportNo     || "",
              passportExpiry: personalFields.passportExpiry || "",
              sponsor:        personalFields.sponsor        || "",
            });
            added++;
          }
        });

        const certCount = parsed.filter(r => (r.certName || "").trim()).length;
        showToast(`✓ Imported ${added + updated} people (${added} new · ${updated} updated · ${certCount} certs)`);
        return { ...prev, manpower };
      });

      setImpModal(false);
    } catch (err) {
      console.error(err);
      showToast("Failed to read Excel file", "del");
    }
  };
  reader.readAsArrayBuffer(file);
};

  const personFresh = person ? (data.manpower.find(p=>p.id===person.id)||person) : null;

  return (
    <div style={{maxWidth:"min(1200px,95vw)",margin:"0 auto",width:"100%"}}>
      {/* Show PersonDetail when a person is selected */}
      {personFresh && (
        <PersonDetail person={personFresh} cats={cats}
          onBack={()=>setPerson(null)}
          onUpdate={updatePerson}
          onDelete={()=>delPerson(personFresh.id)}
          onEdit={()=>{setEditingFrom(personFresh);setPerson(null);setAddModal({mode:"edit",person:personFresh});}}
          showToast={showToast}
          isAdmin={isAdmin}/>
      )}
      {/* Show list when no person selected */}
      {!personFresh && <>
      <PageHeader title="MANPOWER" sub="Staff profiles, documents & certifications" color={T.green}>
        <Btn color={T.green} onClick={()=>setCatModal(true)}>⊕ Categories</Btn>
        <Btn color={T.gold}  onClick={()=>setImpModal(true)}>⬆ Import Excel</Btn>
        <ExportBtn data={people.map(p=>({Name:p.name,ID:p.idNo,Category:p.category,Designation:p.designation,Nationality:p.nationality,"Passport No":p.passportNo,"Passport Expiry":p.passportExpiry,"Visa No":p.visaNo,"Visa Expiry":p.visaExpiry,"Iqama No":p.iqamaNo,"Iqama Expiry":p.iqamaExpiry,"Muqeem No":p.muqeemNo,"Muqeem Expiry":p.muqeemExpiry}))} filename="Manpower_List"/>
        <Btn color={T.green} solid onClick={()=>setAddModal({mode:"add"})}>+ Add Person</Btn>
      </PageHeader>

      {/* Excel import banner */}
<div style={{background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
  <div>
    <div style={{fontSize:13,fontWeight:600,color:T.gold}}>📂 Import Manpower Certifications from Excel</div>
    <div style={{fontSize:12,color:T.textSub,marginTop:2}}>
      Columns: <strong style={{color:T.textSub}}>ID, NAME, POSITION, NATIONALITY, NATIONAL/IQAMA ID, ID EXP. DATE, PASSPORT NO., PASSPORT EXP. DATE, SPONSOR</strong> — cert columns optional: <strong style={{color:T.textSub}}>CERTIFICATE, ISSUED BY, CERT ISSUE DATE, CERT EXPIRY DATE</strong>
    </div>
  </div>  {/* ← closes the inner <div> */}
  <input ref={mpFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){setImpModal({file:e.target.files[0]});e.target.value="";}}}/>
  <button onClick={()=>mpFileRef.current.click()} style={{background:T.gold,color:"#000",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,flexShrink:0}}>⬆ Upload Excel</button>
</div>  {/* ← closes the outer <div> */}

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
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{p.name}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{p.designation||"—"} · {p.nationality||""}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0,marginLeft:8}}>
                    {p.project && (
                      <span style={{background:T.blueDim,color:T.blue,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,border:`1px solid ${T.blue}33`,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}} title={p.project}>
                        ◆ {p.project}
                      </span>
                    )}
                    {critical>0&&<span style={{background:T.goldDim,color:T.gold,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:700}}>{critical} alerts</span>}
                  </div>
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
                        <span style={{fontSize:12,color:T.textSub}}>{lbl}</span>
                        {exp
                          ?<span style={{fontSize:11,color:s.color,fontWeight:600}}>{s.label==="Valid"?fmtDate(exp):s.label}</span>
                          :<span style={{fontSize:12,color:T.textSub}}>—</span>
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

      {addModal  && <PersonModal mode={addModal.mode} person={addModal.person} cats={cats} projects={data.projects||[]}
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
function MpDocUploadModal({person, onClose, onSave, showToast}) {
  const [f, setF] = useState({docType:"", expiryDate:"", name:""});
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const set = k => v => setF(p=>({...p,[k]:v}));

  const DOC_TYPES = ["Iqama","Muqeem","Passport","Visa","Medical Certificate","Training Certificate","Employment Contract","Other"];

  const handleUpload = async () => {
    if (!file)      { alert("Please select a file"); return; }
    if (!f.docType) { alert("Please select a document type"); return; }
    setUploading(true);
    try {
      const url = await uploadFile(file, `manpower/${person.id}/docs`);
      onSave({
        name:       f.name || file.name,
        docType:    f.docType,
        expiryDate: f.expiryDate || "",
        fileType:   file.type,
        url,
      });
    } catch(err) {
      showToast("Upload failed: " + err.message, "del");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:18,width:"100%",maxWidth:440,padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>UPLOAD DOCUMENT</div>
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer"}}>×</button>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:".5px"}}>DOCUMENT TYPE *</label>
          <select value={f.docType} onChange={e=>set("docType")(e.target.value)}
            style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:f.docType?T.text:T.textMuted,outline:"none"}}>
            <option value="">Select type…</option>
            {DOC_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:".5px"}}>DISPLAY NAME</label>
          <input value={f.name} onChange={e=>set("name")(e.target.value)}
            placeholder={file?.name||"Leave blank to use filename"}
            style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:".5px"}}>EXPIRY DATE (optional)</label>
          <input type="date" value={f.expiryDate} onChange={e=>set("expiryDate")(e.target.value)}
            style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.text,outline:"none",boxSizing:"border-box",colorScheme:"light"}}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6,letterSpacing:".5px"}}>FILE *</label>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{display:"none"}}
            onChange={e=>{if(e.target.files[0]){setFile(e.target.files[0]);if(!f.name)set("name")(e.target.files[0].name);}}}/>
          <div onClick={()=>fileRef.current.click()}
            style={{background:T.inputBg,border:`2px dashed ${file?T.green:T.border}`,borderRadius:10,padding:"18px",textAlign:"center",cursor:"pointer",transition:"border-color .2s"}}>
            {file
              ?<><div style={{fontSize:13,fontWeight:600,color:T.green}}>{file.name}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>{(file.size/1024).toFixed(1)} KB · click to change</div></>
              :<><div style={{fontSize:13,color:T.textMuted}}>Click to select file</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>PDF, JPG, PNG, DOC supported</div></>
            }
          </div>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={handleUpload} disabled={uploading}
            style={{flex:2,background:uploading?T.border:T.green,border:"none",color:"#fff",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,cursor:uploading?"not-allowed":"pointer"}}>
            {uploading?"Uploading…":"Upload Document"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
/* ─── Add / Edit Person Modal ────────────────────────────────────────────── */
function PersonModal({mode,person,cats,projects,onClose,onSave}) {
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
      <FieldRow label="Assigned Project">
        <FSelect value={f.project||""} onChange={set("project")} color={T.green}>
          <option value="">No project assigned</option>
          {renderProjectOptions(projects)}
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

/* ─── Person Detail view ─────────────────────────────────────────────────── */
function PersonDetail({person,cats,onBack,onUpdate,onDelete,onEdit,showToast,isAdmin}) {
  const [certModal, setCertModal] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [docModal, setDocModal] = useState(false);

  const PTABS=[
    {id:"profile",label:"Profile"},
    {id:"certs",label:`Certifications (${(person.certs||[]).length})`},
    {id:"docs",label:`Documents (${(person.docs||[]).length})`},
  ];

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

  const saveDoc=(doc)=>{
    setDocModal(false);
    const docs=[...(person.docs||[]),{...doc,id:uid(),uploadedAt:new Date().toISOString().split("T")[0]}];
    onUpdate({...person,docs});
    showToast("Document uploaded");
  };

  const delDoc=(id)=>{
    const docs=(person.docs||[]).filter(d=>d.id!==id);
    onUpdate({...person,docs});
    showToast("Document removed","del");
  };

  const PROFILE_ROWS=[
    ["Full Name",person.name],["ID No.",person.idNo],["Nationality",person.nationality],
    ["Designation",person.designation],["Category",person.category],
    ["Assigned Project",person.project],
    ["Passport No.",person.passportNo],["Passport Expiry",fmtDate(person.passportExpiry)],
    ["Visa No.",person.visaNo],["Visa Expiry",fmtDate(person.visaExpiry)],
    ["Iqama No.",person.iqamaNo],["Iqama Expiry",fmtDate(person.iqamaExpiry)],
    ["Muqeem No.",person.muqeemNo],["Muqeem Expiry",fmtDate(person.muqeemExpiry)],
  ].filter(([,v])=>v&&v!=="—");

  return (
    <div style={{maxWidth:"min(1100px,95vw)",margin:"0 auto",width:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
        <button onClick={onBack} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{person.name}</div>
          <div style={{fontSize:12,color:T.textMuted,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span>{person.designation} · {person.category}</span>
            {person.project&&<span style={{background:T.blueDim,color:T.blue,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>◆ {person.project}</span>}
          </div>
        </div>
        <Btn color={T.blue} onClick={onEdit}>✎ Edit</Btn>
        {isAdmin&&<Btn color={T.red} onClick={()=>{if(window.confirm("Delete this person?"))onDelete();}}>✕ Delete</Btn>}
      </div>

      {/* Status cards row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:22}}>
        {[["Passport",person.passportExpiry],["Visa",person.visaExpiry],["Iqama",person.iqamaExpiry],["Muqeem",person.muqeemExpiry]].map(([lbl,exp])=>{
          const s=getStatus(daysUntil(exp));
          return (
            <div key={lbl} style={{background:T.card,border:`1px solid ${exp?s.color+"44":T.border}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:12,color:T.textSub,fontWeight:600,marginBottom:6}}>{lbl.toUpperCase()}</div>
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

      {/* Profile Tab */}
      {activeTab==="profile"&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 2px 10px rgba(26,10,0,0.07),0 0 0 1px rgba(232,213,183,0.5)",padding:"18px 22px"}}>
          {PROFILE_ROWS.map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,color:T.textMuted,fontWeight:500}}>{k}</span>
              <span style={{fontSize:13,color:T.textSub,fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Certs Tab */}
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
                      {isAdmin&&<ABtn color={T.red} onClick={()=>delCert(c.id)}>✕</ABtn>}
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {/* Docs Tab */}
      {activeTab==="docs"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <Btn color={T.green} solid onClick={()=>setDocModal(true)}>+ Upload Document</Btn>
          </div>
          {(person.docs||[]).length===0
            ?<Empty icon="📄" label="No documents uploaded" sub="Upload Iqama, Muqeem, Passport copies, etc." color={T.green} onAdd={()=>setDocModal(true)}/>
            :<div style={{display:"grid",gap:10}}>
              {(person.docs||[]).map((d,i)=>(
                <div key={d.id} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,animationDelay:`${i*.04}s`}}>
                  <div style={{fontSize:28,flexShrink:0}}>
                    {d.fileType?.includes("pdf")?"📄":d.fileType?.includes("image")?"🖼️":"📎"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:5}}>
                      {d.docType&&<Chip>{d.docType}</Chip>}
                      {d.uploadedAt&&<Chip>Uploaded: {fmtDate(d.uploadedAt)}</Chip>}
                      {d.expiryDate&&<Chip color={getStatus(daysUntil(d.expiryDate)).color}>Exp: {fmtDate(d.expiryDate)}</Chip>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <a href={d.url} target="_blank" rel="noreferrer"
                      style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                      View
                    </a>
                    {isAdmin&&<ABtn color={T.red} onClick={()=>delDoc(d.id)}>✕</ABtn>}
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Modals */}
      {certModal&&<CertModal mode={certModal.mode} cert={certModal.cert} onClose={()=>setCertModal(null)} onSave={saveCert}/>}
      {docModal&&<MpDocUploadModal person={person} onClose={()=>setDocModal(false)} onSave={saveDoc} showToast={showToast}/>}
    </div>
  );
}
/* ─── Add / Edit Certification Modal ─────────────────────────────────────── */
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

export { ManpowerPage };
