import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, FTextarea, FLink, FileLink, PageHeader, Empty, InvoiceMetricCard, pctColor } from "./UI.jsx";

function LoginPage({ onLogin }) {
  return (
    <FinanceLoginPage
      onLogin={onLogin}
      title="AUTHENTICATION"
      subtitle="Welcome back. Enter your password to access the portal."
      passwordLabel="PASSWORD"
      placeholder="Enter password…"
      buttonLabel="ENTER SCORPION"
    />
  );
}

function FinanceLoginPage({ onLogin, title="FINANCE ACCESS", subtitle="This section is restricted.\nEnter the finance password to continue.", passwordLabel="FINANCE PASSWORD", placeholder="Enter finance password…", buttonLabel="UNLOCK FINANCE" }) {
  const [pw,    setPw]    = useState("");
  const [error, setError] = useState("");
  const [show,  setShow]  = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (!onLogin(pw)) {
      setError("Incorrect password. Please try again.");
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:"60vh", padding:16,
    }}>
      <div
        className="slide-up"
        style={{
          background: T.card,
          border: `1px solid ${T.gold}55`,
          borderRadius: 20,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 420,
          boxShadow: `0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px ${T.gold}22`,
          animation: shake ? "none" : undefined,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold glow top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${T.gold},transparent)`,borderRadius:"20px 20px 0 0"}}/>

        {/* Header */}
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:T.goldDim,border:`2px solid ${T.gold}55`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`0 0 24px ${T.gold}33`}}>
            🔒
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,letterSpacing:"2px",color:T.gold}}>
            {title}
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:6,lineHeight:1.5,whiteSpace:"pre-line"}}>
            {subtitle}
          </div>
        </div>

        {/* Password field */}
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8,letterSpacing:"1.5px"}}>{passwordLabel}</label>
          <div style={{position:"relative"}}>
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && attempt()}
              placeholder={placeholder}
              style={{
                width:"100%",
                background:T.inputBg,
                border:`1px solid ${error ? T.red : T.border}`,
                borderRadius:10,
                padding:"12px 44px 12px 14px",
                fontSize:14,
                color:T.text,
                outline:"none",
                transition:"border-color .2s",
                colorScheme:"light",
              }}
              onFocus={e => e.target.style.borderColor = T.gold}
              onBlur={e => e.target.style.borderColor = error ? T.red : T.border}
            />
            <button onClick={() => setShow(s => !s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textMuted,fontSize:16,cursor:"pointer",padding:2}}>
              {show ? "🙈" : "👁"}
            </button>
          </div>
          {error && <div style={{fontSize:12,color:T.red,marginTop:6,display:"flex",alignItems:"center",gap:5}}>⚠ {error}</div>}
        </div>

        <button
          onClick={attempt}
          style={{
            width:"100%",
            background:`linear-gradient(135deg,${T.gold},#d97706)`,
            border:"none", borderRadius:10,
            padding:"13px",
            fontFamily:"'Barlow Condensed',sans-serif",
            fontWeight:800, fontSize:16,
            color:"#080b10",
            letterSpacing:"1.5px",
            cursor:"pointer",
            boxShadow:`0 4px 20px ${T.gold}44`,
            transition:"transform .15s,box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=`0 6px 28px ${T.gold}66`; }}
          onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=`0 4px 20px ${T.gold}44`; }}
        >
          {buttonLabel}
        </button>

        <div style={{textAlign:"center",fontSize:11,color:T.textMuted,marginTop:16,letterSpacing:"1px"}}>
          Contact your administrator if you forgot the password
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FINANCE PAGE
   Full financial overview — invoice values, collections, receivables.
   Only accessible after finance authentication.
════════════════════════════════════════════════════════════════════════════ */
const FIN_TABS = [
  {id:"overview",    label:"Overview",                 icon:"$",  color:T.gold,   dim:T.goldDim},
  {id:"invoices",    label:"Invoices",                 icon:"🧾", color:T.green,  dim:T.greenDim},
  {id:"workorders",  label:"Work Orders / Agreements", icon:"📋", color:T.purple, dim:T.purpleDim},
];

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

        <div style={{flex:1, overflowY:"auto", padding:"16px 24px"}}>
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

          {files.length > 0 && (
            <div style={{display:"grid", gap:12}}>
              {files.map((entry, i) => {
                const st      = progress[entry.id] || "pending";
                const stColor = STATUS_COLOR[st];
                const stIcon  = STATUS_ICON[st];
                const isExp   = st === "pending" || st === "error";

                return (
                  <div key={entry.id} className="fade-up" style={{
                    background: T.bg, border: `1px solid ${st==="done"?T.green+"44":st==="error"?T.red+"44":T.border}`,
                    borderLeft: `4px solid ${stColor}`, borderRadius: 10, padding: "12px 14px",
                    animationDelay: `${i * 0.03}s`,
                  }}>
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

                    {isExp && !uploading && (
                      <div style={{display:"grid", gap:8, paddingTop:8, borderTop:`1px solid ${T.border}`}}>
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
                        {entry.paymentStatus === "Partial" && (
                          <div>
                            <label style={{display:"block", fontSize:10, fontWeight:700, color:T.gold, marginBottom:4, letterSpacing:".5px"}}>REMAINING AMOUNT (SAR)</label>
                            <input type="number" value={entry.remainingAmount} onChange={e => updateField(entry.id,"remainingAmount",e.target.value)} placeholder="Amount still outstanding"
                              style={{width:"100%", background:T.inputBg, border:`1px solid ${T.gold}66`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                              onFocus={e=>e.target.style.borderColor=T.gold} onBlur={e=>e.target.style.borderColor=`${T.gold}66`}/>
                          </div>
                        )}
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

function BulkInvoiceUpload({ projects, onClose, onImport }) {
  const [step, setStep]         = useState(1); // 1=upload, 2=preview
  const [rows, setRows]         = useState([]);
  const [errors, setErrors]     = useState([]);
  const [fileName, setFileName] = useState("");
  const fileRef                 = useRef();
  const pNames = (projects||[]).map(p => typeof p==="string" ? p : (p.name||"")).filter(Boolean);

  const COL_MAP = {
    "INVOICE TITLE":"name","INVOICE NAME":"name","TITLE":"name","NAME":"name","DESCRIPTION":"name","DESC":"name",
    "PROJECT":"project","PROJECT NAME":"project",
    "INVOICE NO":"refNo","INVOICE NO.":"refNo","INVOICE NUMBER":"refNo","INV NO":"refNo","REF NO":"refNo","REF NO.":"refNo","REFERENCE":"refNo","REF":"refNo",
    "JOB NO":"jobNo","JOB NO.":"jobNo","JOB NUMBER":"jobNo","JOB":"jobNo","PHASE":"jobNo",
    "AMOUNT":"amount","AMOUNT (SAR)":"amount","VALUE":"amount","INVOICE VALUE":"amount","INVOICE VALUE (SAR)":"amount","SAR":"amount","TOTAL":"amount","TOTAL (SAR)":"amount",
    "DUE DATE":"dueDate","DUE":"dueDate","PAYMENT DATE":"dueDate","DATE DUE":"dueDate",
    "DATE":"date","INVOICE DATE":"date","ISSUED DATE":"date","ISSUE DATE":"date",
    "TYPE":"invoiceType","INVOICE TYPE":"invoiceType","KIND":"invoiceType",
    "STATUS":"paymentStatus","PAYMENT STATUS":"paymentStatus","PAYMENT":"paymentStatus",
    "NOTES":"notes","REMARKS":"notes","COMMENT":"notes","COMMENTS":"notes",
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
          if (row.every(c => String(c).trim() === "")) continue;

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

          const rawType = get("invoiceType").toLowerCase();
          const invoiceType = rawType.includes("adv") ? "Advance" : "Income";

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

        <div style={{flex:1,overflowY:"auto",padding:"20px 26px"}}>

          {step===1 && (
            <div>
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
                      <div style={{display:"flex",gap:4,background:T.card,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
                        {["Income","Advance"].map(t=>(
                          <button key={t} onClick={()=>updateRow(i,"invoiceType",t)}
                            style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:row.invoiceType===t?(t==="Income"?T.blueDim:T.purpleDim):"transparent",color:row.invoiceType===t?(t==="Income"?T.blue:T.purple):T.textMuted,transition:"all .15s"}}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:4,background:T.card,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
                        {["Pending","Paid","Partial"].map(s=>(
                          <button key={s} onClick={()=>updateRow(i,"paymentStatus",s)}
                            style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:row.paymentStatus===s?`${statusColor(s)}22`:"transparent",color:row.paymentStatus===s?statusColor(s):T.textMuted,transition:"all .15s"}}>
                            {s}
                          </button>
                        ))}
                      </div>
                      {row.amount && (
                        <span style={{fontSize:13,fontWeight:700,color:T.green,marginLeft:"auto"}}>
                          SAR {Number(row.amount).toLocaleString()}
                        </span>
                      )}
                      <button onClick={()=>setRows(prev=>prev.filter((_,idx)=>idx!==i))}
                        style={{background:T.redDim,border:`1px solid ${T.red}33`,color:T.red,borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

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

function FinancePage({ data, setData, showToast, selectedInvoiceYear, setSelectedInvoiceYear, isAdmin, onManageProjects }) {
  const [finTab, setFinTab] = useState("overview");
  const [invoiceDetailView, setInvoiceDetailView] = useState(null);
  const [modal, setModal] = useState(null);
  const [bulkWoModal, setBulkWoModal] = useState(false);
  const [bulkInvModal, setBulkInvModal] = useState(false);
  const [multiPdfInvModal, setMultiPdfInvModal] = useState(null); // {project?:string}
  const [fProj, setFProj] = useState("");
  const [selProj, setSelProj] = useState(null);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState("All");

  const projects  = data.projects    || [];
  const allDocs   = data.projectDocs || [];
  const invoiceDocs = allDocs.filter(d => d.subTab === "invoices");
  const woDocs      = allDocs.filter(d => d.subTab === "workorders");

  const finCounts = {
    overview:   "",
    invoices:   invoiceDocs.length,
    workorders: woDocs.length,
  };

  // ── Save / delete helpers (write back to shared projectDocs) ──
  const saveDoc = (doc, mode) => {
    const st = finTab === "invoices" ? "invoices" : "workorders";
    setModal(null);
    setTimeout(() => {
      setData(prev => {
        const list = [...prev.projectDocs];
        if (mode === "add") list.push({...doc, id:uid(), subTab:st});
        else { const i = list.findIndex(d => d.id === doc.id); if (i >= 0) list[i] = {...doc, subTab:st}; }
        return {...prev, projectDocs:list};
      });
      showToast(mode === "add" ? "Document added" : "Updated");
    }, 0);
  };

  const delDoc = id => {
    setData(prev => ({...prev, projectDocs:prev.projectDocs.filter(d => d.id !== id)}));
    showToast("Deleted","del");
  };

  // ── Overview calculations ──
  const availableInvoiceYears = Array.from(new Set(
    invoiceDocs.map(doc => {
      if (!doc.dueDate) return null;
      const dt = new Date(doc.dueDate);
      return Number.isNaN(dt.getTime()) ? null : String(dt.getFullYear());
    }).filter(Boolean)
  )).sort((a,b) => Number(b) - Number(a));

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Available months depend on selected year
  const availableInvoiceMonths = selectedInvoiceYear === "All" ? [] : Array.from(new Set(
    invoiceDocs.map(doc => {
      if (!doc.dueDate) return null;
      const dt = new Date(doc.dueDate);
      if (Number.isNaN(dt.getTime())) return null;
      if (String(dt.getFullYear()) !== selectedInvoiceYear) return null;
      return dt.getMonth(); // 0-11
    }).filter(v => v !== null)
  )).sort((a,b) => a - b);

  // Reset month when year changes (handled inline via derived value)
  const effectiveMonth = selectedInvoiceYear === "All" ? "All" : selectedInvoiceMonth;

  const filteredInvoiceDocs = invoiceDocs.filter(doc => {
    if (!doc.dueDate) return selectedInvoiceYear === "All";
    const dt = new Date(doc.dueDate);
    if (Number.isNaN(dt.getTime())) return selectedInvoiceYear === "All";
    if (selectedInvoiceYear !== "All" && String(dt.getFullYear()) !== selectedInvoiceYear) return false;
    if (effectiveMonth !== "All" && dt.getMonth() !== Number(effectiveMonth)) return false;
    return true;
  });

  const totalInvoiceValue = filteredInvoiceDocs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const totalReceived     = filteredInvoiceDocs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const totalDue          = filteredInvoiceDocs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const incomeInvs        = filteredInvoiceDocs.filter(d => getInvoiceStream(d) === "income");
  const advanceInvs       = filteredInvoiceDocs.filter(d => getInvoiceStream(d) === "advance");
  const incomeInvoiced    = incomeInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const advanceInvoiced   = advanceInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const receivedFromIncome  = incomeInvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const receivedFromAdvance = advanceInvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
  const dueFromIncome   = incomeInvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const dueFromAdvance  = advanceInvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
  const collectionRate  = totalInvoiceValue > 0 ? Math.round((totalReceived / totalInvoiceValue) * 100) : 0;

  const projectBreakdown = projects.map(proj => { proj = pName(proj);
    const pinvs     = filteredInvoiceDocs.filter(d => d.project === proj);
    const invoiced  = pinvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
    const collected = pinvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
    const due       = pinvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
    const pct       = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;
    return {proj, invoiced, collected, due, pct, count:pinvs.length};
  }).filter(p => p.invoiced > 0 || p.count > 0).sort((a,b) => b.invoiced - a.invoiced);

  // ── Filtered work orders ──
  const filteredWoDocs = fProj ? woDocs.filter(d => d.project === fProj) : woDocs;
  // ── Filtered invoices (for the Invoices tab) ──
  const [projInvMonth, setProjInvMonth] = useState("All");
  const projInvsAll  = selProj ? invoiceDocs.filter(d => d.project === selProj) : [];
  const projInvs = projInvMonth === "All" ? projInvsAll : projInvsAll.filter(d => {
    if (!d.dueDate) return false;
    const dt = new Date(d.dueDate);
    return !Number.isNaN(dt.getTime()) && dt.getMonth() === Number(projInvMonth);
  });
  const projInvsMonths = Array.from(new Set(projInvsAll.map(d => {
    if (!d.dueDate) return null;
    const dt = new Date(d.dueDate);
    return Number.isNaN(dt.getTime()) ? null : dt.getMonth();
  }).filter(v => v !== null))).sort((a,b) => a - b);
  const projInvTotal = projInvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);

  return (
    <div style={{maxWidth:"min(1400px,95vw)",margin:"0 auto",width:"100%"}}>

      {/* ── Page header ── */}
      <div className="fade-up" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:32,color:T.text,display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:T.gold}}>$</span> FINANCE
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Invoices, work orders & financial overview · Restricted access</div>
        </div>
        <button onClick={()=>{
          const projRows = projectBreakdown.map(p=>`<tr>
            <td><strong>${p.proj}</strong></td>
            <td style="text-align:right">${formatSarCompact(p.invoiced)}</td>
            <td style="text-align:right">${formatSarCompact(p.collected)}</td>
            <td style="text-align:right;color:${p.due>0?"#dc2626":"#16a34a"}">${formatSarCompact(p.due)}</td>
            <td>${p.count} invoice${p.count!==1?"s":""}</td>
            <td><div>${p.pct}%</div><div class="bar-wrap"><div class="bar-fill" style="width:${p.pct}%;background:${p.pct>=80?"#16a34a":p.pct>=50?"#d97706":"#dc2626"}"></div></div></td>
          </tr>`).join("");
          const invRows = filteredInvoiceDocs.map(d=>`<tr>
            <td>${d.project||"—"}</td>
            <td>${d.docNo||d.name||"—"}</td>
            <td>${d.dueDate||"—"}</td>
            <td style="text-align:right">${formatSarCompact(parseFloat(d.amount)||0)}</td>
            <td style="text-align:right">${formatSarCompact(getInvoiceCollectedAmount(d))}</td>
            <td style="text-align:right;color:${getInvoiceRemainingAmount(d)>0?"#dc2626":"#16a34a"}">${formatSarCompact(getInvoiceRemainingAmount(d))}</td>
            <td>${d.invoiceType||"—"}</td>
          </tr>`).join("");
          printPage("Finance Report", `
            <h1>💰 FINANCE REPORT</h1>
            <div class="meta">Generated ${new Date().toLocaleDateString()} · ${selectedInvoiceYear === "All" ? "All Years" : selectedInvoiceYear + (effectiveMonth !== "All" ? " · " + MONTH_NAMES[Number(effectiveMonth)] : "")}</div>
            <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
              <div class="kpi"><div class="kpi-val">${formatSarCompact(totalInvoiceValue)}</div><div class="kpi-lbl">Total Invoiced</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#16a34a">${formatSarCompact(totalReceived)}</div><div class="kpi-lbl">Total Received</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Total Due</div></div>
              <div class="kpi"><div class="kpi-val">${collectionRate}%</div><div class="kpi-lbl">Collection Rate</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#2563eb">${formatSarCompact(incomeInvoiced)}</div><div class="kpi-lbl">Income Invoiced</div></div>
              <div class="kpi"><div class="kpi-val" style="color:#d97706">${formatSarCompact(advanceInvoiced)}</div><div class="kpi-lbl">Advance Invoiced</div></div>
            </div>
            <h2>Project Breakdown</h2>
            <table>
              <thead><tr><th>Project</th><th>Invoiced</th><th>Collected</th><th>Due</th><th>Invoices</th><th>Collection %</th></tr></thead>
              <tbody>${projRows}</tbody>
            </table>
            <h2>Invoice List</h2>
            <table>
              <thead><tr><th>Project</th><th>Invoice No</th><th>Due Date</th><th>Amount</th><th>Received</th><th>Due</th><th>Type</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          `);
        }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:11,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          🖨 Print
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {FIN_TABS.map(t => {
          const active = finTab === t.id;
          return (
            <button key={t.id} onClick={() => { setFinTab(t.id); setSelProj(null); setFProj(""); setModal(null); }}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:10,border:`1px solid ${active?t.color:T.border}`,background:active?t.dim:"transparent",color:active?t.color:T.textSub,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .15s"}}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {finCounts[t.id] !== "" && (
                <span style={{background:active?t.color:T.border,color:active?"#0d1117":T.textMuted,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:800}}>{finCounts[t.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
      {finTab === "overview" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>YEAR</label>
            <select value={selectedInvoiceYear} onChange={e => { setSelectedInvoiceYear(e.target.value); setSelectedInvoiceMonth("All"); }}
              style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
              <option value="All">All Years</option>
              {availableInvoiceYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {selectedInvoiceYear !== "All" && availableInvoiceMonths.length > 0 && (
              <>
                <label style={{fontSize:12,fontWeight:700,color:T.textMuted}}>MONTH</label>
                <select value={selectedInvoiceMonth} onChange={e => setSelectedInvoiceMonth(e.target.value)}
                  style={{background:T.inputBg,color:T.text,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
                  <option value="All">All Months</option>
                  {availableInvoiceMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                </select>
              </>
            )}
          </div>

          {/* KPI strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
            {[
              {label:"Total Invoiced",    v:formatSarCompact(totalInvoiceValue), color:T.green,  icon:"📋"},
              {label:"Total Collected",   v:formatSarCompact(totalReceived),     color:T.blue,   icon:"✓"},
              {label:"Total Outstanding", v:formatSarCompact(totalDue),          color:T.red,    icon:"⏳"},
              {label:"Collection Rate",   v:`${collectionRate}%`,                color:collectionRate>=80?T.green:collectionRate>=50?T.gold:T.red, icon:"◎"},
              {label:"Total Invoices",    v:filteredInvoiceDocs.length,          color:T.purple, icon:"◆"},
              {label:"Work Orders",       v:woDocs.length,                       color:T.purple, icon:"📋"},
            ].map((k,i) => (
              <div key={k.label} className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.05}s`,position:"relative",overflow:"hidden",boxShadow:T.shadow}}>
                <div style={{position:"absolute",top:10,right:14,fontSize:22,opacity:.1}}>{k.icon}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(22px,2.5vw,36px)",fontWeight:800,color:k.color,lineHeight:1}}>{k.v}</div>
                <div style={{fontSize:11,color:T.textSub,marginTop:5,fontWeight:500}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Collection rate bar */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",marginBottom:20,boxShadow:T.shadow}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:T.textSub,letterSpacing:".5px"}}>COLLECTION RATE</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(18px,2vw,26px)",color:collectionRate>=80?T.green:collectionRate>=50?T.gold:T.red}}>{collectionRate}%</span>
            </div>
            <div style={{height:8,background:T.border,borderRadius:999}}>
              <div style={{height:"100%",width:`${collectionRate}%`,borderRadius:999,transition:"width 1.2s cubic-bezier(0.22,1,0.36,1)",background:collectionRate>=80?`linear-gradient(90deg,${T.green},#059669)`:collectionRate>=50?`linear-gradient(90deg,${T.gold},#d97706)`:`linear-gradient(90deg,${T.red},#dc2626)`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:T.textSub}}>
              <span>{formatSarCompact(totalReceived)} collected of {formatSarCompact(totalInvoiceValue)} invoiced</span>
              <span style={{color:T.red}}>{formatSarCompact(totalDue)} outstanding</span>
            </div>
          </div>

          {/* Invoice metric cards */}
          <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>
              INVOICE VALUE {selectedInvoiceYear !== "All" ? `— ${selectedInvoiceYear}${effectiveMonth !== "All" ? ` · ${MONTH_NAMES[Number(effectiveMonth)]}` : ""}` : "— ALL YEARS"}
            </div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>
              {selectedInvoiceYear === "All" ? `Across all ${filteredInvoiceDocs.length} invoices` : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear} · ${filteredInvoiceDocs.length} invoices` : `For ${selectedInvoiceYear} · ${filteredInvoiceDocs.length} invoices`}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
              <InvoiceMetricCard title="TOTAL INVOICE VALUE" amount={formatSarCompact(totalInvoiceValue)} sub={`${filteredInvoiceDocs.length} invoices · ${selectedInvoiceYear === "All" ? "all years" : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : selectedInvoiceYear}`} color={T.green} onClick={() => setInvoiceDetailView({mode:"all",stream:"all"})} miniCards={[{title:"INCOME INVOICED",amount:formatSarCompact(incomeInvoiced),color:T.green,onClick:()=>setInvoiceDetailView({mode:"all",stream:"income"})},{title:"ADVANCE INVOICED",amount:formatSarCompact(advanceInvoiced),color:T.gold,onClick:()=>setInvoiceDetailView({mode:"all",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT RECEIVED" amount={formatSarCompact(totalReceived)} sub={selectedInvoiceYear === "All" ? "Collected across all invoices" : effectiveMonth !== "All" ? `Collected for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : `Collected for ${selectedInvoiceYear}`} color={T.blue} onClick={() => setInvoiceDetailView({mode:"received",stream:"all"})} miniCards={[{title:"RECEIVED FROM INCOME",amount:formatSarCompact(receivedFromIncome),color:T.blue,onClick:()=>setInvoiceDetailView({mode:"received",stream:"income"})},{title:"RECEIVED FROM ADVANCE",amount:formatSarCompact(receivedFromAdvance),color:T.teal,onClick:()=>setInvoiceDetailView({mode:"received",stream:"advance"})}]}/>
              <InvoiceMetricCard title="AMOUNT DUE" amount={formatSarCompact(totalDue)} sub={selectedInvoiceYear === "All" ? "Pending and partial balances" : effectiveMonth !== "All" ? `Outstanding for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : `Outstanding for ${selectedInvoiceYear}`} color={T.red} onClick={() => setInvoiceDetailView({mode:"due",stream:"all"})} miniCards={[{title:"DUE FROM INCOME",amount:formatSarCompact(dueFromIncome),color:T.red,onClick:()=>setInvoiceDetailView({mode:"due",stream:"income"})},{title:"DUE FROM ADVANCE",amount:formatSarCompact(dueFromAdvance),color:T.orange,onClick:()=>setInvoiceDetailView({mode:"due",stream:"advance"})}]}/>
            </div>
          </div>

          {/* Per-project breakdown */}
          {projectBreakdown.length > 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:T.shadow,padding:"22px",marginBottom:20}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:4}}>PER-PROJECT BREAKDOWN</div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Invoice collection status by project {selectedInvoiceYear !== "All" ? `for ${effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ` : ""}${selectedInvoiceYear}` : ""}</div>
              <div style={{display:"grid",gap:12}}>
                {projectBreakdown.map((p,i) => (
                  <div key={p.proj} className="fade-up" style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",animationDelay:`${i*.04}s`,display:"flex",alignItems:"center",gap:14}}>
                    {/* Project name + count */}
                    <div style={{minWidth:180,maxWidth:220}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.proj}</div>
                      <div style={{fontSize:11,color:T.textMuted}}>{p.count} invoice{p.count!==1?"s":""}</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:6,background:T.border,borderRadius:999,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${p.pct}%`,borderRadius:999,background:`linear-gradient(90deg,${pctColor(p.pct)},${pctColor(p.pct)}bb)`,transition:"width 1s"}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:pctColor(p.pct),minWidth:32,textAlign:"right"}}>{p.pct}%</div>
                    </div>
                    {/* Amounts */}
                    <div style={{display:"flex",gap:16,flexShrink:0}}>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.green}}>{formatSarCompact(p.invoiced)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>INVOICED</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:T.blue}}>{formatSarCompact(p.collected)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>COLLECTED</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,color:p.due>0?T.red:T.green}}>{formatSarCompact(p.due)}</div><div style={{fontSize:9,color:T.textMuted,fontWeight:600}}>DUE</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoiceDetailView && <InvoiceYearDetailsModal view={invoiceDetailView} invoices={filteredInvoiceDocs} yearLabel={selectedInvoiceYear === "All" ? "All" : effectiveMonth !== "All" ? `${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}` : selectedInvoiceYear} onClose={() => setInvoiceDetailView(null)}/>}

          {filteredInvoiceDocs.length === 0 && (
            <div className="fade-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center",boxShadow:T.shadow}}>
              <div style={{fontSize:44,marginBottom:12}}>📋</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.textSub,marginBottom:8}}>NO INVOICES</div>
              <div style={{fontSize:13,color:T.textMuted}}>{selectedInvoiceYear === "All" ? "No invoices found. Add invoices via the Invoices tab above." : effectiveMonth !== "All" ? `No invoices found for ${MONTH_NAMES[Number(effectiveMonth)]} ${selectedInvoiceYear}. Try a different month or year.` : `No invoices found for ${selectedInvoiceYear}. Try selecting a different year.`}</div>
            </div>
          )}
        </div>
      )}

      {/* ══ INVOICES TAB ══════════════════════════════════════════════════ */}
      {finTab === "invoices" && (
        selProj ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
              <button onClick={() => { setSelProj(null); setProjInvMonth("All"); }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:T.text}}>{selProj}</div>
                <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>{projInvs.length}{projInvMonth !== "All" ? ` of ${projInvsAll.length}` : ""} invoice{projInvs.length!==1?"s":""} · Total: <span style={{color:T.green,fontWeight:700}}>SAR {projInvTotal.toLocaleString()}</span></div>
              </div>
              {projInvsMonths.length > 1 && (
                <select value={projInvMonth} onChange={e => setProjInvMonth(e.target.value)}
                  style={{background:T.inputBg,color:T.text,border:`1px solid ${projInvMonth !== "All" ? T.gold : T.border}`,borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:600,outline:"none",colorScheme:"light"}}>
                  <option value="All">All Months</option>
                  {projInvsMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
                </select>
              )}
              <Btn color={T.teal} onClick={() => setMultiPdfInvModal({project:selProj})}>📄 Bulk PDF Upload</Btn>
              <Btn color={T.green} solid onClick={() => setModal({mode:"add",doc:{project:selProj}})}>+ Add Invoice</Btn>
            </div>
            {projInvs.length === 0
              ? <Empty icon="🧾" label="No invoices yet" sub="Add the first invoice for this project" color={T.green} onAdd={() => setModal({mode:"add",doc:{project:selProj}})}/>
              : <div style={{display:"grid",gap:10}}>{projInvs.map((doc,i) => <InvoiceCard key={doc.id} doc={doc} delay={i*.03} isAdmin={isAdmin} onEdit={() => setModal({mode:"edit",doc})} onDel={() => delDoc(doc.id)}/>)}</div>
            }
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>INVOICES</div>
                <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Select a project to view and manage invoices</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn color={T.green} onClick={() => setBulkInvModal(true)}>⬆ Bulk Import</Btn>
                <Btn color={T.teal} onClick={() => setMultiPdfInvModal({})}>📄 Bulk PDF Upload</Btn>
                <Btn color={T.green} solid onClick={() => setModal({mode:"add"})}>+ Add Invoice</Btn>
              </div>
            </div>
            {projects.length === 0
              ? <Empty icon="🧾" label="No projects yet" sub="Add projects via Manage Projects in the sidebar" color={T.green} onAdd={() => onManageProjects && onManageProjects()}/>
              : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                  {projects.map((p,i) => { p=pName(p);
                    const pinvs = invoiceDocs.filter(d => d.project === p);
                    const total = pinvs.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
                    const collected = pinvs.reduce((s,d) => s + getInvoiceCollectedAmount(d), 0);
                    const due = pinvs.reduce((s,d) => s + getInvoiceRemainingAmount(d), 0);
                    return (
                      <div key={p} className="fade-up card-hover" onClick={() => setSelProj(p)}
                        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",cursor:"pointer",animationDelay:`${i*.04}s`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                          <div style={{width:38,height:38,background:T.greenDim,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧾</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p}</div>
                            <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{pinvs.length} invoice{pinvs.length!==1?"s":""}</div>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div style={{background:T.bg,borderRadius:8,padding:"8px 10px"}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(total)}</div>
                            <div style={{fontSize:10,color:T.textMuted,marginTop:4,fontWeight:700}}>INVOICED</div>
                          </div>
                          <div style={{background:T.greenDim,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.green}33`}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.green,lineHeight:1}}>{formatSarCompact(collected)}</div>
                            <div style={{fontSize:10,color:T.green,marginTop:4,fontWeight:700}}>COLLECTED</div>
                          </div>
                          <div style={{background:T.redDim,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.red}33`}}>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:T.red,lineHeight:1}}>{formatSarCompact(due)}</div>
                            <div style={{fontSize:10,color:T.red,marginTop:4,fontWeight:700}}>DUE</div>
                          </div>
                        </div>
                        <div style={{fontSize:12,color:T.green,fontWeight:700,textAlign:"right",marginTop:12}}>View Invoices →</div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )
      )}

      {/* ══ WORK ORDERS TAB ═══════════════════════════════════════════════ */}
      {finTab === "workorders" && (
        <div>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>WORK ORDERS / AGREEMENTS</div>
              <div style={{fontSize:13,color:T.textMuted,marginTop:2}}>Contracts and work orders with clients</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={fProj} onChange={e => setFProj(e.target.value)} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textSub,outline:"none",colorScheme:"light"}}>
                <option value="">All Projects</option>
                {renderProjectOptions(projects)}
              </select>
              <Btn color={T.blue} onClick={() => setBulkWoModal(true)}>⬆ Bulk Upload</Btn>
              <Btn color={T.purple} solid onClick={() => setModal({mode:"add"})}>+ Add Work Order</Btn>
            </div>
          </div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:12}}>{filteredWoDocs.length} record{filteredWoDocs.length!==1?"s":""}</div>
          {filteredWoDocs.length === 0
            ? <Empty icon="📋" label="No work orders yet" sub="Add your first work order or agreement" color={T.purple} onAdd={() => setModal({mode:"add"})}/>
            : <div style={{display:"grid",gap:10}}>
                {filteredWoDocs.map((doc,i) => {
                  const hasExp = !!doc.expiryDate;
                  const s = getStatus(daysUntil(doc.expiryDate));
                  return (
                    <div key={doc.id} className="fade-up"
                      style={{background:T.card,border:`1px solid ${hasExp&&daysUntil(doc.expiryDate)<=90?s.color+"44":T.border}`,borderLeft:"4px solid "+T.purple,borderRadius:12,padding:"16px 18px",animationDelay:`${i*.03}s`,display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(14px,1.1vw,17px)",color:T.text}}>{doc.name}</span>
                          {doc.project && <Tag color={T.teal}>{doc.project}</Tag>}
                          {hasExp && <Tag color={s.color}>{s.label}</Tag>}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {doc.refNo    && <Chip>Ref: {doc.refNo}</Chip>}
                          {doc.supplier && <Chip>Client: {doc.supplier}</Chip>}
                          {doc.amount   && <Chip color={T.green}>SAR {Number(doc.amount).toLocaleString()}</Chip>}
                          {doc.date     && <Chip>Signed: {fmtDate(doc.date)}</Chip>}
                          {hasExp       && <Chip color={s.color}>Expires: {fmtDate(doc.expiryDate)}</Chip>}
                          {hasExp && daysUntil(doc.expiryDate)!==null && daysUntil(doc.expiryDate)<=90 && <Chip color={s.color}>{daysUntil(doc.expiryDate)>=0?`${daysUntil(doc.expiryDate)}d left`:`${Math.abs(daysUntil(doc.expiryDate))}d overdue`}</Chip>}
                          {(doc.fileLinks?.length ? doc.fileLinks : doc.fileLink ? [{url:doc.fileLink,label:""}] : []).map((l,i)=><FileLink key={i} href={l.url} label={l.label}/>)}
                        </div>
                        {doc.notes && <div style={{marginTop:6,fontSize:12,color:T.textMuted,fontStyle:"italic"}}>{doc.notes}</div>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <ABtn color={T.blue} onClick={() => setModal({mode:"edit",doc})}>✎</ABtn>
                        {isAdmin && <ABtn color={T.red}  onClick={() => delDoc(doc.id)}>✕</ABtn>}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* ── Modals ── */}
      {modal && finTab === "invoices"   && <InvoiceModal   mode={modal.mode} doc={modal.doc} projects={data.projects||[]} defaultProject={selProj} onClose={() => setModal(null)} onSave={saveDoc}/>}
      {modal && finTab === "workorders" && <WorkOrderModal mode={modal.mode} doc={modal.doc} projects={data.projects||[]}                          onClose={() => setModal(null)} onSave={saveDoc}/>}
      {bulkWoModal && <BulkWorkOrderUpload projects={projects} onClose={()=>setBulkWoModal(false)} onImport={docs=>{ setData(prev=>({...prev,projectDocs:[...(prev.projectDocs||[]),...docs.map(d=>({...d,id:uid(),subTab:"workorders"}))]})); setBulkWoModal(false); showToast(`✓ ${docs.length} work order${docs.length!==1?"s":""} uploaded`); }}/>}
      {bulkInvModal && <BulkInvoiceUpload projects={projects} onClose={()=>setBulkInvModal(false)} onImport={rows=>{ setData(prev=>({...prev,projectDocs:[...(prev.projectDocs||[]),...rows.map(r=>({...r,id:uid(),subTab:"invoices"}))]})); setBulkInvModal(false); showToast(`✓ ${rows.length} invoice${rows.length!==1?"s":""} imported`); }}/>}
      {multiPdfInvModal && (
        <MultiPdfInvoiceUpload
          project={multiPdfInvModal.project}
          projects={projects}
          onClose={() => setMultiPdfInvModal(null)}
          onImport={records => {
            setData(prev => ({
              ...prev,
              projectDocs: [...prev.projectDocs, ...records.map(r => ({...r, id:uid(), subTab:"invoices"}))]
            }));
            setMultiPdfInvModal(null);
            showToast(`✓ ${records.length} invoice${records.length!==1?"s":""} uploaded`);
          }}
        />
      )}
    </div>
  );
}

function InvoiceYearDetailsModal({ view, invoices, yearLabel, onClose }) {
  const rawMode = typeof view === "string" ? view : view?.mode;
  const rawStream = typeof view === "object" && view?.stream ? view.stream : "all";
  const normalizedView = rawMode === "received" ? "received" : rawMode === "due" ? "due" : "all";
  const normalizedStream = rawStream === "income" ? "income" : rawStream === "advance" ? "advance" : "all";

  const streamLabel = normalizedStream === "income"
    ? "Income"
    : normalizedStream === "advance"
    ? "Advance"
    : "All";

  const title = normalizedView === "received"
    ? normalizedStream === "all" ? "Amount Received Details" : `Received from ${streamLabel} Details`
    : normalizedView === "due"
    ? normalizedStream === "all" ? "Amount Due Details" : `Due from ${streamLabel} Details`
    : normalizedStream === "all"
    ? "Invoice Details"
    : `${streamLabel} Invoice Details`;

  const rows = invoices.filter((doc) => {
    const matchesStream = normalizedStream === "all" ? true : getInvoiceStream(doc) === normalizedStream;
    if (!matchesStream) return false;
    if (normalizedView === "received") return getInvoiceCollectedAmount(doc) > 0;
    if (normalizedView === "due") return getInvoiceRemainingAmount(doc) > 0;
    return true;
  });

  const totalAmount = rows.reduce((sum, doc) => sum + (parseFloat(doc.amount) || 0), 0);
  const totalReceived = rows.reduce((sum, doc) => sum + getInvoiceCollectedAmount(doc), 0);
  const totalDue = rows.reduce((sum, doc) => sum + getInvoiceRemainingAmount(doc), 0);

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:"min(1100px, calc(100vw - 24px))",maxWidth:"calc(100vw - 24px)",maxHeight:"calc(100vh - 24px)",display:"flex",flexDirection:"column",boxShadow:T.shadow}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,color:T.text}}>{title}</div>
            <div style={{fontSize:13,color:T.textMuted,marginTop:4}}>{yearLabel === "All" ? "All years" : yearLabel} • {rows.length} invoice{rows.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={() => {
              const periodLabel = yearLabel === "All" ? "All Years" : yearLabel;
              const tableRows = rows.map(doc => {
                const total    = parseFloat(doc.amount) || 0;
                const received = getInvoiceCollectedAmount(doc);
                const due      = getInvoiceRemainingAmount(doc);
                const stream   = getInvoiceStream(doc);
                const status   = doc.paymentStatus || doc.status || "Pending";
                return `<tr>
                  <td>${doc.name || "—"}</td>
                  <td>${doc.refNo || "—"}</td>
                  <td>${doc.project || "—"}</td>
                  <td><span style="background:${stream==="advance"?"#fef3c7":"#d1fae5"};color:${stream==="advance"?"#92400e":"#065f46"};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${stream === "advance" ? "Advance" : "Income"}</span></td>
                  <td>${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString() : "—"}</td>
                  <td style="text-align:right">${formatSarCompact(total)}</td>
                  <td style="text-align:right;color:#16a34a">${formatSarCompact(received)}</td>
                  <td style="text-align:right;color:${due > 0 ? "#dc2626" : "#16a34a"}">${formatSarCompact(due)}</td>
                  <td>${status}</td>
                </tr>`;
              }).join("");
              printPage(title, `
                <h1>${title}</h1>
                <div class="meta">${periodLabel} · ${rows.length} invoice${rows.length !== 1 ? "s" : ""}</div>
                <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
                  <div class="kpi"><div class="kpi-val">${formatSarCompact(totalAmount)}</div><div class="kpi-lbl">Total Value</div></div>
                  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${formatSarCompact(totalReceived)}</div><div class="kpi-lbl">Received</div></div>
                  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${formatSarCompact(totalDue)}</div><div class="kpi-lbl">Due</div></div>
                </div>
                <h2>Invoice List</h2>
                <table>
                  <thead><tr><th>Invoice</th><th>Ref No</th><th>Project</th><th>Type</th><th>Due Date</th><th>Amount</th><th>Received</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>${tableRows}</tbody>
                </table>
              `);
            }} style={{background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              🖨 Print
            </button>
            <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,width:38,height:38,fontSize:20,cursor:"pointer"}}>×</button>
          </div>
        </div>

        <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,flexShrink:0}}>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>TOTAL VALUE</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.green,marginTop:6}}>{formatSarCompact(totalAmount)}</div>
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>RECEIVED</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.blue,marginTop:6}}>{formatSarCompact(totalReceived)}</div>
          </div>
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:T.textMuted,fontWeight:700,letterSpacing:".08em"}}>DUE</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:28,color:T.red,marginTop:6}}>{formatSarCompact(totalDue)}</div>
          </div>
        </div>

        <div style={{padding:"14px 22px 22px",overflowY:"auto"}}>
          {rows.length === 0 ? (
            <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>No invoices found for this section.</div>
          ) : (
            <div style={{display:"grid",gap:10}}>
              {rows.map((doc) => {
                const total = parseFloat(doc.amount) || 0;
                const received = getInvoiceCollectedAmount(doc);
                const due = getInvoiceRemainingAmount(doc);
                const status = String(doc.paymentStatus || doc.status || "Pending");
                const statusColor = /paid|received/i.test(status) ? T.green : /partial/i.test(status) ? T.gold : T.red;
                const stream = getInvoiceStream(doc);
                return (
                  <div key={doc.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>{doc.name || "Invoice"}</div>
                          {doc.refNo && <Tag color={T.green}>#{doc.refNo}</Tag>}
                          {doc.project && <Tag color={T.blue}>{doc.project}</Tag>}
                          <Tag color={stream === "advance" ? T.gold : T.teal}>{stream === "advance" ? "Advance" : "Income"}</Tag>
                          <Tag color={statusColor}>{status}</Tag>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                          {doc.dueDate && <Chip color={T.gold}>Due: {fmtDate(doc.dueDate)}</Chip>}
                          <Chip color={T.green}>Total: {formatSarCompact(total)}</Chip>
                          <Chip color={T.blue}>Received: {formatSarCompact(received)}</Chip>
                          <Chip color={T.red}>Due: {formatSarCompact(due)}</Chip>
                          {doc.fileLink && <FileLink href={doc.fileLink} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function AlertRow({a, onClick}) {
  const s = getStatus(a.days);
  const SRC_COLOR = {"Company Doc":T.blue,"Passport":T.purple,"Visa":T.teal,"Iqama":T.green,"Muqeem":T.orange,"Cert":T.green,"Eq Cert":T.blue,"Insurance":T.purple,"Permit":T.gold};
  const sc = SRC_COLOR[a.src]||T.blue;
  return (
    <div
      onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bg,borderRadius:9,border:`1px solid ${T.border}`,cursor:onClick?"pointer":"default",transition:"border-color .15s"}}
      onMouseEnter={e=>{ if(onClick) e.currentTarget.style.borderColor=s.color; }}
      onMouseLeave={e=>{ if(onClick) e.currentTarget.style.borderColor=T.border; }}
    >
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
/* ─── HSE & Project Document Categories ─────────────────────────────────── */
const HSE_CATEGORIES = [
  "Pre-Mobilization Checklist","NAPD Certification","Risk Assessment",
  "Method Statement","JSA / Job Safety Analysis","Toolbox Talk Records",
  "Incident Report","Near Miss Report","Emergency Response Plan",
  "PPE Inspection","Environmental Permit","Safety Audit","Other",
];

const PROJDOC_CATEGORIES = [
  "Contract","Purchase Order","Work Order","Subcontract","Insurance Certificate",
  "Performance Bond","Project Schedule","Drawings / Blueprints","Inspection Report",
  "Material Approval","Site Survey","As-Built Document","Correspondence","Other",
];

const PD_TABS = [
  {id:"certificates",    label:"Job Completion Certificates", icon:"📜", color:T.blue,   dim:T.blueDim},
  {id:"dailyreports",    label:"Daily Reports",               icon:"📅", color:T.gold,   dim:T.goldDim},
  {id:"hse",             label:"HSE",                         icon:"🦺", color:"#22c55e", dim:"rgba(34,197,94,0.12)"},
  {id:"projectdocuments",label:"Project Documents",           icon:"📁", color:"#a78bfa", dim:"rgba(167,139,250,0.12)"},
];

/* ════════════════════════════════════════════════════════════════════════════
   PROJECT DOCS
════════════════════════════════════════════════════════════════════════════ */

export { LoginPage, FinanceLoginPage, FinancePage, AlertRow };
