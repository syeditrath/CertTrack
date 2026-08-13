import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl, isCloudflareConfigured } from "../cloudflare.js";

const pName = p => typeof p === "string" ? p : (p?.name ?? "");

/* ─── InvoiceMetricCard / darkenTextShadow — shared by Dashboard & FinancePage ── */
function InvoiceMetricCard({ title, amount, sub, color, onClick, miniCards = [] }) {
  const cardGlow = `0 10px 34px ${String(color || T.blue).replace(')', ',0.16)').replace('rgb', 'rgba')}`;
  return (
    <div
      className="card-hover"
      style={{
        background:`linear-gradient(180deg, ${T.card} 0%, ${T.bg} 100%)`,
        border:`1px solid ${T.border}`,
        borderRadius:18,
        padding:"18px 18px 16px",
        boxShadow:T.shadow,
        position:"relative",
        overflow:"hidden",
      }}
    >
      <div
        style={{
          position:"absolute",
          inset:0,
          pointerEvents:"none",
          background:`radial-gradient(circle at top right, ${String(color || T.blue).replace(')', ',0.14)').replace('rgb', 'rgba')} 0%, transparent 40%)`,
        }}
      />

      <button
        onClick={onClick}
        style={{
          background:"transparent",
          border:"none",
          padding:0,
          margin:0,
          width:"100%",
          textAlign:"left",
          cursor:"pointer",
          position:"relative",
          zIndex:1,
        }}
      >
        <div style={{fontSize:12,color:T.textMuted,fontWeight:700,letterSpacing:".08em",marginBottom:10}}>{title}</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,44px)",color,lineHeight:1,textShadow:darkenTextShadow(color)}}>{amount}</div>
        <div style={{fontSize:13,color:T.textMuted,marginTop:10}}>{sub}</div>
        <div style={{fontSize:12,color:color,marginTop:10,fontWeight:700}}>Click to view details →</div>
      </button>

      {miniCards.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:14,position:"relative",zIndex:1}}>
          {miniCards.map((card) => {
            const type = /advance/i.test(card.title) ? "advance" : "income";
            const theme = getMetricTypeTheme(type);
            return (
              <button
                key={card.title}
                onClick={card.onClick}
                style={{
                  background:`linear-gradient(180deg, ${theme.dim} 0%, ${T.card} 100%)`,
                  border:`1px solid ${theme.accent}55`,
                  borderRadius:14,
                  padding:"12px 12px 10px",
                  textAlign:"left",
                  cursor:"pointer",
                  boxShadow:`inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px ${theme.glow}`,
                  transition:"transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px ${theme.glow}`; e.currentTarget.style.borderColor=`${theme.accent}88`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=`inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px ${theme.glow}`; e.currentTarget.style.borderColor=`${theme.accent}55`;}}
              >
                <div style={{fontSize:10,color:theme.accent,fontWeight:800,letterSpacing:".09em",marginBottom:8}}>{card.title}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:800,color:theme.accent,lineHeight:1}}>{card.amount}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function darkenTextShadow(color) {
  if (color === T.gold) return '0 2px 16px rgba(251,191,36,0.16)';
  if (color === T.blue) return '0 2px 16px rgba(56,189,248,0.16)';
  if (color === T.red) return '0 2px 16px rgba(248,113,113,0.12)';
  if (color === T.green) return '0 2px 16px rgba(52,211,153,0.12)';
  return 'none';
}


/* ─── daysLeft: whole days between today and a target date (negative = overdue) ── */
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

/* ─── pctColor: returns a hex color for a 0-100 progress percentage ─────
   (returned as plain hex so callers can safely append an alpha suffix,
   e.g. `${pctColor(pct)}bb`) ────────────────────────────────────────── */
function pctColor(p) {
  if (p >= 80) return T.green;
  if (p >= 40) return T.blue;
  if (p >= 20) return T.gold;
  return T.red;
}

/* ─── deriveProjectStats: aggregates a project's invoices/certificates from
   projectDocs into invoice totals and job-phase groupings, keyed by jobNo.
   Shape consumed by ProjectAnalysisPage / ProjectAnalysisDetail:
   { invs, certs, totalInvoiced, totalCollected, totalDue, jobs, ungroupedInvs, ungroupedCerts } */
function deriveProjectStats(projectName, projectDocs) {
  const invs  = (projectDocs || []).filter(d => d.subTab === "invoices"     && d.project === projectName);
  const certs = (projectDocs || []).filter(d => d.subTab === "certificates" && d.project === projectName);

  const totalInvoiced  = invs.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const totalCollected = invs.reduce((s, d) => s + getInvoiceCollectedAmount(d), 0);
  const totalDue       = invs.reduce((s, d) => s + getInvoiceRemainingAmount(d), 0);

  // Group ONLY invoices/certs that have a jobNo into named job phases
  const jobMap = {};
  invs.forEach(d => {
    const key = d.jobNo ? String(d.jobNo).trim() : null;
    if (!key) return;
    if (!jobMap[key]) jobMap[key] = { jobNo: key, invoices: [], certs: [] };
    jobMap[key].invoices.push(d);
  });
  certs.forEach(d => {
    const key = d.jobNo ? String(d.jobNo).trim() : null;
    if (!key) return;
    if (!jobMap[key]) jobMap[key] = { jobNo: key, invoices: [], certs: [] };
    jobMap[key].certs.push(d);
  });

  const jobs = Object.values(jobMap).map(j => ({
    ...j,
    totalInvoiced:  j.invoices.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0),
    totalCollected: j.invoices.reduce((s, d) => s + getInvoiceCollectedAmount(d), 0),
    totalDue:       j.invoices.reduce((s, d) => s + getInvoiceRemainingAmount(d), 0),
  })).sort((a, b) => a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true }));

  // Invoices & certs with no jobNo shown as a flat list
  const ungroupedInvs  = invs.filter(d => !d.jobNo);
  const ungroupedCerts = certs.filter(d => !d.jobNo);

  return { invs, certs, totalInvoiced, totalCollected, totalDue, jobs, ungroupedInvs, ungroupedCerts };
}

function renderProjectOptions(projects) {
  const byClient = {};
  const noClient = [];
  (projects || []).forEach(p => {
    const n = pName(p);
    const c = typeof p === "object" ? p.client : "";
    if (c) { if (!byClient[c]) byClient[c] = []; byClient[c].push(n); }
    else noClient.push(n);
  });
  const clients = Object.keys(byClient).sort();
  return (
    <>
      {clients.map(c => (
        <optgroup key={c} label={"▸ " + c}>
          {byClient[c].map(n => <option key={n} value={n}>{n}</option>)}
        </optgroup>
      ))}
      {noClient.length > 0 && clients.length > 0
        ? <optgroup label="▸ Other">{noClient.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
        : noClient.map(n => <option key={n} value={n}>{n}</option>)
      }
    </>
  );
}


function PageHeader({title,sub,color,children}) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:18}}>
      <div style={{minWidth:0}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:"clamp(20px,4vw,26px)",color:T.text}}>{title}</div>
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

function Overlay({ children, onClose }) {
  const { height: viewportHeight, width: viewportWidth } = useViewport();
  const isMobile = viewportWidth < 600;
  const isShortScreen = viewportHeight < 700;

  return (
    <div
      className="fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        alignItems: isMobile ? "flex-end" : isShortScreen ? "flex-start" : "center",
        padding: isMobile ? "0" : isShortScreen ? "20px 16px" : "32px 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : undefined,
          display: "flex",
          justifyContent: "center",
          // On mobile, let child take full width with rounded top corners
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FormModal({ title, color, children, onClose, onSave }) {
  const { width: vw } = useViewport();
  const isMobile = vw < 600;
  return (
    <Overlay onClose={onClose}>
      <div
        className="slide-up"
        style={{
          background: T.sidebar,
          border: `1px solid ${T.border}`,
          borderRadius: isMobile ? "18px 18px 0 0" : 18,
          width: "100%",
          maxWidth: isMobile ? "100%" : 560,
          maxHeight: isMobile ? "92vh" : "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: T.text,
              letterSpacing: ".5px",
            }}
          >
            {title}
          </div>

          <button
            onClick={onClose}
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              color: T.textSub,
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {children}
        </div>

        <div
          style={{
            padding: "14px 24px 22px",
            display: "flex",
            gap: 10,
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
            background: T.sidebar,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: T.bg,
              border: `1px solid ${T.border}`,
              color: T.textSub,
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            style={{
              flex: 2,
              background: color,
              border: "none",
              color: "#000",
              borderRadius: 10,
              padding: "12px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save
          </button>
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
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:T.textSub,marginBottom:6,letterSpacing:".3px"}}>{label}</label>
      {children}
    </div>
  );
}

function SectionDivider({label}) {
  return <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"1.5px",marginTop:16,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.border}`}}>{label}</div>;
}

function FInput({type,value,onChange,color,placeholder}) {
  return <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:T.text,outline:"none",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FTextarea({value,onChange,color}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:T.text,outline:"none",resize:"vertical",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>;
}

function FSelect({value,onChange,color,children}) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",fontSize:14,color:value?T.text:T.textMuted,outline:"none",colorScheme:"light",transition:"border-color .15s"}}
    onFocus={e=>e.target.style.borderColor=color||T.blue} onBlur={e=>e.target.style.borderColor=T.border}>
    {children}
  </select>;
}

function FLink({value,onChange,folder}) {
  const [uploading,setUploading] = useState(false);
  const [uploadErr,setUploadErr] = useState("");
  const fileRef = useRef();
  const configured = isCloudflareConfigured();

  const handleUpload = async e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 50*1024*1024) { setUploadErr("File too large (max 50MB)"); return; }
    setUploading(true); setUploadErr("");
    try {
      const url = await uploadFile(file, folder||"general");
      onChange(url);
      setUploadErr("");
    } catch(err) {
      setUploadErr("Upload failed: " + err.message);
    } finally { setUploading(false); }
    e.target.value="";
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",gap:6}}>
        <input type="url" value={value} onChange={e=>onChange(e.target.value)}
          placeholder="Paste link or upload file below…"
          style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:T.blue,outline:"none",colorScheme:"light"}}
          onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
        {value&&(
          <a href={value} target="_blank" rel="noreferrer"
            style={{background:T.blueDim,border:`1px solid ${T.blue}33`,color:T.blue,borderRadius:8,padding:"0 12px",fontSize:12,fontWeight:600,flexShrink:0,cursor:"pointer",textDecoration:"none",display:"flex",alignItems:"center",whiteSpace:"nowrap"}}>
            ↗ Open
          </a>
        )}
      </div>
      {configured && (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input ref={fileRef} type="file" style={{display:"none"}} onChange={handleUpload}/>
          <button type="button" onClick={()=>fileRef.current.click()} disabled={uploading}
            style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:uploading?0.6:1}}>
            {uploading ? "⏳ Uploading…" : "⬆ Upload File"}
          </button>
          <span style={{fontSize:11,color:T.textMuted}}>PDF, Word, Excel, images up to 50MB</span>
        </div>
      )}
      {!configured && (
        <div style={{fontSize:11,color:T.textMuted,padding:"5px 8px",background:T.goldDim,borderRadius:6,border:`1px solid ${T.gold}33`}}>
          💡 Set CF_WORKER_URL to enable direct file upload
        </div>
      )}
      {uploadErr && <div style={{fontSize:11,color:T.red}}>{uploadErr}</div>}

    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════════════
   FILE PREVIEW MODAL
════════════════════════════════════════════════════════════════════════════ */
function FilePreviewModal({url,onClose}) {
  // Detect file type from URL
  const clean   = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/.test(clean);
  const isPdf   = /\.pdf$/.test(clean);
  const isOffice= /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(clean);
  // Cloudflare R2 — direct URL, no special handling needed
  const isGDrive     = url.includes("drive.google.com");
  const isOneDrive   = url.includes("1drv.ms") || url.includes("onedrive.live.com");
  const isSharePoint = url.includes("sharepoint.com");

  // Build the best embed URL for each case
  const embedUrl = (() => {
    if (isImage) return url;
    // PDFs / R2 files — use Google PDF viewer as proxy (avoids X-Frame-Options)
    if (isPdf) return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    // Office files — Microsoft Office Online viewer
    if (isOffice) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    // Google Drive — convert to preview embed
    if (isGDrive) {
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
    // OneDrive
    if (isOneDrive) return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    // SharePoint
    if (isSharePoint) return url + (url.includes("?") ? "&action=embedview" : "?action=embedview");
    return url;
  })();

  const filename = url.split("/").pop().split("?")[0] || "File";

  return (
    <div className="fade-in" onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div className="slide-up" style={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:16,width:"min(96vw,1000px)",height:"min(92vh,800px)",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>

        {/* ── Header ── */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontSize:18}}>{isImage?"🖼️":isPdf?"📄":isOffice?"📊":"📎"}</span>
          <div style={{flex:1,fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{decodeURIComponent(filename)}</div>
          <a href={url} download target="_blank" rel="noreferrer"
            style={{background:T.greenDim,border:`1px solid ${T.green}44`,color:T.green,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            ⬇ Download
          </a>
          <a href={url} target="_blank" rel="noreferrer"
            style={{background:T.blueDim,border:`1px solid ${T.blue}44`,color:T.blue,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            ↗ New Tab
          </a>
          <button onClick={onClose}
            style={{background:T.redDim,border:`1px solid ${T.red}44`,color:T.red,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>
            ✕
          </button>
        </div>

        {/* ── Preview ── */}
        <div style={{flex:1,overflow:"hidden",background:T.bg,position:"relative"}}>
          {isImage ? (
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
              <img src={url} alt="Preview"
                style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8,boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}/>
            </div>
          ) : (
            <iframe
              key={embedUrl}
              src={embedUrl}
              style={{width:"100%",height:"100%",border:"none"}}
              title="File Preview"
              allow="autoplay; fullscreen"
            />
          )}
        </div>

        {/* ── Footer tip for Google Viewer ── */}
        {(isPdf)&&!isImage&&(
          <div style={{padding:"8px 16px",background:T.goldDim,borderTop:`1px solid ${T.gold}33`,fontSize:11,color:T.gold,display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            💡 If preview doesn't load, click <strong>↗ New Tab</strong> to open directly — or <strong>⬇ Download</strong> to save the file.
          </div>
        )}
      </div>
    </div>
  );
}

const Chip     = ({children,color}) => <span style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:6,padding:"2px 9px",fontSize:12,color:color||T.textSub,fontWeight:500}}>{children}</span>;
const Tag      = ({children,color}) => <span style={{background:`${color}18`,border:`1px solid ${color}33`,borderRadius:5,padding:"2px 8px",fontSize:11,color,fontWeight:700}}>{children}</span>;
const ABtn     = ({onClick,color,children}) => <button onClick={onClick} style={{width:30,height:30,borderRadius:7,border:`1px solid ${color}33`,background:`${color}18`,color,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
const FileLink = ({href, label}) => {
  if(!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
      style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:6,padding:"3px 10px",fontSize:12,color:T.blue,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>
      📎 {label||"View File"}
    </a>
  );
};
function BulkUploadModal({ subTab, projects, onClose, onImport }) {
  const [rows, setRows]       = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep]       = useState(1); // 1=upload, 2=map, 3=preview
  const [fileName, setFileName] = useState("");
  const [error, setError]     = useState("");
  const fileRef               = useRef();

  const FIELD_DEFS = {
    invoices:     [
      {key:"name",           label:"Invoice Title *", required:true},
      {key:"project",        label:"Project"},
      {key:"invoiceType",    label:"Invoice Type (Income / Advance)"},
      {key:"refNo",          label:"Invoice No."},
      {key:"dueDate",        label:"Due Date"},
      {key:"amount",         label:"Amount (SAR)"},
      {key:"paymentStatus",  label:"Payment Status"},
      {key:"remainingAmount",label:"Remaining Amount (SAR)"},
      {key:"notes",          label:"Notes"},
    ],
    certificates: [
      {key:"project",        label:"Project"},
      {key:"jobNo",          label:"Job Number"},
      {key:"refNo",          label:"Certificate No."},
      {key:"startDate",      label:"Start Date"},
      {key:"completionDate", label:"Completion Date"},
      {key:"amount",         label:"Invoice Value (SAR)"},
      {key:"notes",          label:"Notes"},
    ],
    workorders: [
      {key:"name",       label:"Title *", required:true},
      {key:"project",    label:"Project"},
      {key:"refNo",      label:"Reference No."},
      {key:"supplier",   label:"Client / Counterparty"},
      {key:"amount",     label:"Contract Value (SAR)"},
      {key:"date",       label:"Date Signed"},
      {key:"expiryDate", label:"Expiry / End Date"},
      {key:"notes",      label:"Notes"},
    ],
  };

  const fields = FIELD_DEFS[subTab] || FIELD_DEFS.invoices;

  const TAB_COLORS = { invoices: T.green, certificates: T.blue, workorders: T.purple };
  const color = TAB_COLORS[subTab] || T.blue;

  // Auto-map: match header to field by fuzzy name comparison
  const autoMap = (hdrs) => {
    const m = {};
    fields.forEach(f => {
      const match = hdrs.find(h => {
        const hn = h.toLowerCase().replace(/[^a-z]/g,"");
        const fn = f.label.toLowerCase().replace(/[^a-z]/g,"");
        const fk = f.key.toLowerCase();
        return hn.includes(fk) || fk.includes(hn) || hn.includes(fn.slice(0,5)) || fn.includes(hn.slice(0,5));
      });
      if (match) m[f.key] = match;
    });
    return m;
  };

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
          if (!lines.length) { setError("Empty CSV file"); return; }
          const hdrs = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim());
          const data = lines.slice(1).filter(l=>l.trim()).map(line => {
            const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || line.split(",");
            const row = {};
            hdrs.forEach((h,i) => { row[h] = (vals[i]||"").replace(/^"|"$/g,"").trim(); });
            return row;
          }).filter(r => Object.values(r).some(v=>v));
          setHeaders(hdrs);
          setRows(data);
          setMapping(autoMap(hdrs));
          setStep(2);
        } catch(err) { setError("Failed to parse CSV: " + err.message); }
      };
      reader.readAsText(file);
    } else {
      // Excel
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, { type:"array", cellDates:true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval:"" });
          if (!rawRows.length) { setError("No data rows found in Excel file"); return; }
          const hdrs = Object.keys(rawRows[0]);
          const data = rawRows.filter(r => Object.values(r).some(v=>v!==null&&v!==""));
          setHeaders(hdrs);
          setRows(data);
          setMapping(autoMap(hdrs));
          setStep(2);
        } catch(err) { setError("Failed to parse Excel: " + err.message); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  const buildPreviewRows = () => {
    return rows.map(row => {
      const rec = {};
      fields.forEach(f => {
        const srcCol = mapping[f.key];
        if (srcCol && row[srcCol] !== undefined) {
          let val = String(row[srcCol]).trim();
          // Normalize date values
          if (["dueDate","date","expiryDate","startDate","completionDate","issueDate"].includes(f.key)) {
            val = excelDateToStr(row[srcCol]) || val;
          }
          rec[f.key] = val;
        }
      });
      // Auto-fill project if only one option
      if (!rec.project && projects.length === 1) rec.project = pName(projects[0]);
      return rec;
    }).filter(r => fields.filter(f=>f.required).every(f => r[f.key]));
  };

  const previewRows = step >= 3 ? buildPreviewRows() : [];
  const skippedCount = rows.length - previewRows.length;

  const STEP_LABELS = ["Upload File", "Map Columns", "Review & Import"];

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{
        background: T.sidebar, border:`1px solid ${T.border}`, borderRadius:18,
        width:"100%", maxWidth:680, maxHeight:"calc(100vh - 48px)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>
                BULK UPLOAD — {subTab.toUpperCase()}
              </div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>
                Import multiple records from CSV or Excel
              </div>
            </div>
            <button onClick={onClose} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer"}}>×</button>
          </div>

          {/* Step indicator */}
          <div style={{display:"flex", alignItems:"center", gap:0, marginTop:16}}>
            {STEP_LABELS.map((label, i) => {
              const sNum = i + 1;
              const active = step === sNum;
              const done = step > sNum;
              return (
                <div key={i} style={{display:"flex", alignItems:"center", flex: i < 2 ? 1 : "none"}}>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <div style={{
                      width:28, height:28, borderRadius:"50%",
                      background: done ? color : active ? `${color}33` : T.bg,
                      border: `2px solid ${done||active ? color : T.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:800,
                      color: done ? "#000" : active ? color : T.textMuted,
                      flexShrink:0,
                    }}>
                      {done ? "✓" : sNum}
                    </div>
                    <span style={{fontSize:12, fontWeight:active?700:500, color:active?color:T.textMuted, whiteSpace:"nowrap"}}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{flex:1, height:2, background: done ? color : T.border, margin:"0 12px"}}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1, overflowY:"auto", padding:"20px 24px"}}>

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div>
              {/* Template download hint */}
              <div style={{background:T.blueDim, border:`1px solid ${T.blue}33`, borderRadius:12, padding:"14px 16px", marginBottom:20}}>
                <div style={{fontSize:13, fontWeight:700, color:T.blue, marginBottom:6}}>📋 Expected Columns</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {fields.map(f => (
                    <span key={f.key} style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:"3px 10px", fontSize:12, color:f.required ? color : T.textSub, fontWeight:f.required?700:400}}>
                      {f.label}{f.required?" *":""}
                    </span>
                  ))}
                </div>
                <div style={{fontSize:11, color:T.textMuted, marginTop:8}}>
                  * Required fields. Column names are auto-detected — fuzzy matching will map them automatically.
                </div>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border:`2px dashed ${color}44`, borderRadius:14,
                  padding:"48px 24px", textAlign:"center",
                  cursor:"pointer", transition:"all .2s",
                  background:`${color}08`,
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=`${color}14`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=`${color}44`;e.currentTarget.style.background=`${color}08`;}}
              >
                <div style={{fontSize:44, marginBottom:12}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:T.text, marginBottom:6}}>
                  Click to Select File
                </div>
                <div style={{fontSize:13, color:T.textMuted}}>Supports CSV and Excel (.xlsx, .xls)</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={handleFile}/>

              {error && (
                <div style={{marginTop:12, padding:"10px 14px", background:T.redDim, border:`1px solid ${T.red}44`, borderRadius:8, fontSize:13, color:T.red}}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Map Columns ── */}
          {step === 2 && (
            <div>
              <div style={{fontSize:13, color:T.textMuted, marginBottom:16}}>
                📄 <strong style={{color:T.text}}>{fileName}</strong> — {rows.length} rows detected. Map your spreadsheet columns to the correct fields.
              </div>

              <div style={{display:"grid", gap:10}}>
                {fields.map(f => (
                  <div key={f.key} style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}`}}>
                    <div style={{width:180, flexShrink:0}}>
                      <div style={{fontSize:13, fontWeight:600, color:f.required?color:T.text}}>{f.label}</div>
                      <div style={{fontSize:11, color:T.textMuted, marginTop:2}}>App field</div>
                    </div>
                    <div style={{fontSize:16, color:T.border, flexShrink:0}}>→</div>
                    <select
                      value={mapping[f.key] || ""}
                      onChange={e => setMapping(m => ({...m, [f.key]: e.target.value || undefined}))}
                      style={{flex:1, background:T.inputBg, border:`1px solid ${mapping[f.key] ? color+"66" : T.border}`, borderRadius:8, padding:"8px 12px", fontSize:13, color:mapping[f.key]?T.text:T.textMuted, outline:"none", colorScheme:"light"}}
                    >
                      <option value="">— Skip this field —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[f.key] && (
                      <div style={{fontSize:11, color:T.green, flexShrink:0, fontWeight:700}}>✓ Mapped</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{marginTop:16, padding:"10px 14px", background:T.goldDim, border:`1px solid ${T.gold}33`, borderRadius:8, fontSize:12, color:T.gold}}>
                💡 Fields marked with * are required. Rows missing required fields will be skipped during import.
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div>
              <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:16}}>
                <div style={{background:T.greenDim, border:`1px solid ${T.green}33`, borderRadius:8, padding:"8px 14px"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, color:T.green}}>{previewRows.length}</span>
                  <span style={{fontSize:12, color:T.textMuted, marginLeft:6}}>ready to import</span>
                </div>
                {skippedCount > 0 && (
                  <div style={{background:T.redDim, border:`1px solid ${T.red}33`, borderRadius:8, padding:"8px 14px"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, color:T.red}}>{skippedCount}</span>
                    <span style={{fontSize:12, color:T.textMuted, marginLeft:6}}>skipped (missing required)</span>
                  </div>
                )}
              </div>

              {previewRows.length === 0 ? (
                <div style={{textAlign:"center", padding:"40px", color:T.red, fontSize:14}}>
                  ⚠ No valid rows to import. Go back and check your column mapping.
                </div>
              ) : (
                <div style={{display:"grid", gap:8}}>
                  {previewRows.slice(0, 20).map((row, i) => (
                    <div key={i} style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px"}}>
                      <div style={{fontWeight:700, fontSize:14, color:T.text, marginBottom:6}}>
                        {row.name || row.jobNo || `Row ${i+1}`}
                      </div>
                      <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                        {fields.filter(f=>f.key!=="name"&&row[f.key]).map(f => (
                          <span key={f.key} style={{background:T.card, border:`1px solid ${T.borderLight}`, borderRadius:5, padding:"2px 8px", fontSize:11, color:T.textSub}}>
                            {f.label.replace(" *","")}: <strong style={{color:T.text}}>{row[f.key]}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {previewRows.length > 20 && (
                    <div style={{textAlign:"center", fontSize:13, color:T.textMuted, padding:"10px"}}>
                      … and {previewRows.length - 20} more rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{padding:"14px 24px 22px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, flexShrink:0}}>
          {step > 1 && (
            <button onClick={()=>setStep(s=>s-1)} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"12px 20px", fontSize:14, fontWeight:600, cursor:"pointer"}}>
              ← Back
            </button>
          )}
          <button onClick={onClose} style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"12px 20px", fontSize:14, fontWeight:600, cursor:"pointer"}}>
            Cancel
          </button>
          <div style={{flex:1}}/>
          {step === 1 && (
            <button onClick={()=>fileRef.current.click()} style={{background:color, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer"}}>
              Select File
            </button>
          )}
          {step === 2 && (
            <button onClick={()=>setStep(3)} style={{background:color, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer"}}>
              Preview Import →
            </button>
          )}
          {step === 3 && previewRows.length > 0 && (
            <button onClick={()=>onImport(previewRows)} style={{background:T.green, border:"none", color:"#000", borderRadius:10, padding:"12px 28px", fontSize:15, fontWeight:800, cursor:"pointer"}}>
              ✓ Import {previewRows.length} Records
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEW COMPONENT — ScorpionBulkModal (for Scorpion Documents bulk upload)
// ═══════════════════════════════════════════════════════════════════

function ScorpionBulkModal({ cats, onClose, onImport }) {
  const [rows, setRows]     = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [step, setStep]     = useState(1);
  const [fileName, setFileName] = useState("");
  const [error, setError]   = useState("");
  const fileRef             = useRef();

  const fields = [
    {key:"name",       label:"Document Name *", required:true},
    {key:"category",   label:"Category"},
    {key:"docNo",      label:"Reference / Doc No."},
    {key:"issueDate",  label:"Issue Date"},
    {key:"expiryDate", label:"Expiry Date"},
    {key:"fileLink",   label:"File Link"},
    {key:"notes",      label:"Notes"},
  ];

  const autoMap = hdrs => {
    const m = {};
    fields.forEach(f => {
      const match = hdrs.find(h => {
        const hn = h.toLowerCase().replace(/[^a-z]/g,"");
        const fk = f.key.toLowerCase();
        return hn.includes(fk) || fk.includes(hn);
      });
      if (match) m[f.key] = match;
    });
    return m;
  };

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    if (ext === "csv") {
      reader.onload = ev => {
        try {
          const lines = ev.target.result.split(/\r?\n/).filter(l=>l.trim());
          const hdrs = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
          const data = lines.slice(1).filter(l=>l.trim()).map(line => {
            const vals = line.split(",");
            const row = {};
            hdrs.forEach((h,i)=>{ row[h]=(vals[i]||"").replace(/^"|"$/g,"").trim(); });
            return row;
          }).filter(r=>Object.values(r).some(v=>v));
          setHeaders(hdrs); setRows(data); setMapping(autoMap(hdrs)); setStep(2);
        } catch(err) { setError("Failed to parse CSV"); }
      };
      reader.readAsText(file);
    } else {
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result,{type:"array",cellDates:true});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws,{defval:""});
          const hdrs = Object.keys(rawRows[0]||{});
          setHeaders(hdrs); setRows(rawRows.filter(r=>Object.values(r).some(v=>v))); setMapping(autoMap(hdrs)); setStep(2);
        } catch(err) { setError("Failed to parse Excel"); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value="";
  };

  const buildPreview = () => rows.map(row => {
    const rec = {};
    fields.forEach(f => {
      const src = mapping[f.key];
      if (src && row[src] !== undefined) {
        let val = String(row[src]).trim();
        if (["issueDate","expiryDate"].includes(f.key)) val = excelDateToStr(row[src]) || val;
        rec[f.key] = val;
      }
    });
    return rec;
  }).filter(r => r.name);

  const previewRows = step === 3 ? buildPreview() : [];

  const STEP_LABELS = ["Upload File","Map Columns","Review & Import"];

  return (
    <Overlay onClose={onClose}>
      <div className="slide-up" style={{background:T.sidebar, border:`1px solid ${T.border}`, borderRadius:18, width:"100%", maxWidth:640, maxHeight:"calc(100vh - 48px)", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>BULK UPLOAD — COMPANY DOCUMENTS</div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>Import multiple documents from CSV or Excel</div>
            </div>
            <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer"}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:0,marginTop:16}}>
            {STEP_LABELS.map((label,i)=>{
              const sNum=i+1; const active=step===sNum; const done=step>sNum;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",flex:i<2?1:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:done?T.blue:active?`${T.blue}33`:T.bg,border:`2px solid ${done||active?T.blue:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:done?"#000":active?T.blue:T.textMuted,flexShrink:0}}>
                      {done?"✓":sNum}
                    </div>
                    <span style={{fontSize:12,fontWeight:active?700:500,color:active?T.blue:T.textMuted,whiteSpace:"nowrap"}}>{label}</span>
                  </div>
                  {i<2&&<div style={{flex:1,height:2,background:done?T.blue:T.border,margin:"0 12px"}}/>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {step===1&&(
            <div>
              <div style={{background:T.blueDim,border:`1px solid ${T.blue}33`,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:T.blue,marginBottom:6}}>📋 Expected Columns</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {fields.map(f=>(
                    <span key={f.key} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 10px",fontSize:12,color:f.required?T.blue:T.textSub,fontWeight:f.required?700:400}}>{f.label}</span>
                  ))}
                </div>
              </div>
              <div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${T.blue}44`,borderRadius:14,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:`${T.blue}08`}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.blue;e.currentTarget.style.background=`${T.blue}14`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=`${T.blue}44`;e.currentTarget.style.background=`${T.blue}08`;}}>
                <div style={{fontSize:44,marginBottom:12}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:T.text,marginBottom:6}}>Click to Select File</div>
                <div style={{fontSize:13,color:T.textMuted}}>Supports CSV and Excel (.xlsx, .xls)</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={handleFile}/>
              {error&&<div style={{marginTop:12,padding:"10px 14px",background:T.redDim,border:`1px solid ${T.red}44`,borderRadius:8,fontSize:13,color:T.red}}>⚠ {error}</div>}
            </div>
          )}

          {step===2&&(
            <div>
              <div style={{fontSize:13,color:T.textMuted,marginBottom:16}}>
                📄 <strong style={{color:T.text}}>{fileName}</strong> — {rows.length} rows. Map columns to fields.
              </div>
              <div style={{display:"grid",gap:10}}>
                {fields.map(f=>(
                  <div key={f.key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.bg,borderRadius:10,border:`1px solid ${T.border}`}}>
                    <div style={{width:180,flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:f.required?T.blue:T.text}}>{f.label}</div>
                    </div>
                    <div style={{fontSize:16,color:T.border,flexShrink:0}}>→</div>
                    <select value={mapping[f.key]||""} onChange={e=>setMapping(m=>({...m,[f.key]:e.target.value||undefined}))}
                      style={{flex:1,background:T.inputBg,border:`1px solid ${mapping[f.key]?T.blue+"66":T.border}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:mapping[f.key]?T.text:T.textMuted,outline:"none",colorScheme:"light"}}>
                      <option value="">— Skip —</option>
                      {headers.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[f.key]&&<div style={{fontSize:11,color:T.green,flexShrink:0,fontWeight:700}}>✓</div>}
                  </div>
                ))}
              </div>
              {/* Category preview */}
              <div style={{marginTop:14,padding:"10px 14px",background:T.goldDim,border:`1px solid ${T.gold}33`,borderRadius:8,fontSize:12,color:T.gold}}>
                💡 Available categories: {cats.join(", ")}. If "Category" column doesn't match exactly, you can edit after import.
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{background:T.greenDim,border:`1px solid ${T.green}33`,borderRadius:8,padding:"8px 14px"}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.green}}>{previewRows.length}</span>
                  <span style={{fontSize:12,color:T.textMuted,marginLeft:6}}>ready to import</span>
                </div>
                {rows.length - previewRows.length > 0 && (
                  <div style={{background:T.redDim,border:`1px solid ${T.red}33`,borderRadius:8,padding:"8px 14px"}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:T.red}}>{rows.length-previewRows.length}</span>
                    <span style={{fontSize:12,color:T.textMuted,marginLeft:6}}>skipped</span>
                  </div>
                )}
              </div>
              {previewRows.length===0
                ?<div style={{textAlign:"center",padding:"40px",color:T.red,fontSize:14}}>⚠ No valid rows. Check column mapping.</div>
                :<div style={{display:"grid",gap:8}}>
                  {previewRows.slice(0,15).map((row,i)=>(
                    <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:6}}>{row.name}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {row.category&&<span style={{background:`${T.blue}18`,borderRadius:5,padding:"2px 8px",fontSize:11,color:T.blue,fontWeight:700}}>{row.category}</span>}
                        {row.docNo&&<Chip>Ref: {row.docNo}</Chip>}
                        {row.issueDate&&<Chip>Issued: {row.issueDate}</Chip>}
                        {row.expiryDate&&<Chip>Expires: {row.expiryDate}</Chip>}
                      </div>
                    </div>
                  ))}
                  {previewRows.length>15&&<div style={{textAlign:"center",fontSize:13,color:T.textMuted,padding:"10px"}}>… and {previewRows.length-15} more</div>}
                </div>
              }
            </div>
          )}
        </div>

        <div style={{padding:"14px 24px 22px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10,flexShrink:0}}>
          {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>← Back</button>}
          <button onClick={onClose} style={{background:T.bg,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <div style={{flex:1}}/>
          {step===1&&<button onClick={()=>fileRef.current.click()} style={{background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Select File</button>}
          {step===2&&<button onClick={()=>setStep(3)} style={{background:T.blue,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Preview →</button>}
          {step===3&&previewRows.length>0&&<button onClick={()=>onImport(previewRows)} style={{background:T.green,border:"none",color:"#000",borderRadius:10,padding:"12px 28px",fontSize:15,fontWeight:800,cursor:"pointer"}}>✓ Import {previewRows.length} Documents</button>}
        </div>
      </div>
    </Overlay>
  );
}
function MultiPdfCertUpload({ project, projects, onClose, onImport }) {
  const [files,       setFiles]       = useState([]); // [{file, name, jobNo, refNo, amount, startDate, completionDate, notes, status}]
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState({}); // {filename: "pending"|"uploading"|"done"|"error"}
  const [selProj,     setSelProj]     = useState(project || "");
  const [globalJobNo, setGlobalJobNo] = useState("");
  const dropRef                       = useRef();
  const fileInputRef                  = useRef();

  const STATUS_COLOR = {
    pending:   T.textMuted,
    uploading: T.blue,
    done:      T.green,
    error:     T.red,
  };
  const STATUS_ICON = {
    pending:   "⏳",
    uploading: "↑",
    done:      "✓",
    error:     "✕",
  };

  // Derive a clean display name from filename
  const cleanName = filename => {
    return filename
      .replace(/\.[^.]+$/, "")           // remove extension
      .replace(/[_-]+/g, " ")            // underscores/dashes → spaces
      .replace(/\b\w/g, c => c.toUpperCase()); // title case
  };

  const addFiles = newFiles => {
    const pdfs = Array.from(newFiles).filter(f =>
      /\.(pdf|png|jpg|jpeg|webp|doc|docx)$/i.test(f.name)
    );
    if (!pdfs.length) return;
    const entries = pdfs.map(f => ({
      id:              uid(),
      file:            f,
      displayName:     cleanName(f.name),
      jobNo:           "",
      refNo:           "",
      amount:          "",
      startDate:       "",
      completionDate:  "",
      notes:           "",
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

  const updateField = (id, key, val) => {
    setFiles(prev => prev.map(f => f.id === id ? {...f, [key]: val} : f));
  };

  // Drag & drop
  const onDragOver  = e => { e.preventDefault(); dropRef.current.style.borderColor = T.blue; };
  const onDragLeave = e => { dropRef.current.style.borderColor = `${T.blue}44`; };
  const onDrop      = e => {
    e.preventDefault();
    dropRef.current.style.borderColor = `${T.blue}44`;
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
        const url = await uploadFile(entry.file, `certificates/${selProj.replace(/\s+/g,"_")}`);
        setProgress(prev => ({...prev, [entry.id]: "done"}));
        results.push({
          project:        selProj,
          jobNo:          entry.jobNo || globalJobNo || "",
          refNo:          entry.refNo || "",
          amount:         entry.amount || "",
          startDate:      entry.startDate || "",
          completionDate: entry.completionDate || "",
          notes:          entry.notes || "",
          fileLink:       url,
          // name used for display (not a required field in CertificateModal)
          _fileName:      entry.displayName,
        });
      } catch (err) {
        setProgress(prev => ({...prev, [entry.id]: "error"}));
        console.error("Upload failed for", entry.file.name, err);
      }
    }

    setUploading(false);

    if (results.length) {
      onImport(results);
    } else {
      alert("All uploads failed. Check your Cloudflare Worker configuration.");
    }
  };

  const doneCount    = Object.values(progress).filter(s => s === "done").length;
  const errorCount   = Object.values(progress).filter(s => s === "error").length;
  const pendingCount = Object.values(progress).filter(s => s === "pending").length;
  const allDone      = uploading && doneCount + errorCount === files.length && files.length > 0;

  return (
    <Overlay onClose={onClose}>
      <div
        className="slide-up"
        style={{
          background:     T.sidebar,
          border:         `1px solid ${T.border}`,
          borderRadius:   18,
          width:          "100%",
          maxWidth:       680,
          maxHeight:      "calc(100vh - 48px)",
          display:        "flex",
          flexDirection:  "column",
          overflow:       "hidden",
          boxShadow:      "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── Header ── */}
        <div style={{padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color:T.text}}>
                UPLOAD JOB COMPLETION CERTIFICATES
              </div>
              <div style={{fontSize:12, color:T.textMuted, marginTop:3}}>
                Select multiple PDFs — one certificate record will be created per file
              </div>
            </div>
            <button
              onClick={onClose}
              style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:8, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, cursor:"pointer"}}
            >×</button>
          </div>

          {/* Project selector */}
          <div style={{marginTop:14, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
            <div style={{flex:1, minWidth:200}}>
              <label style={{display:"block", fontSize:11, fontWeight:700, color:T.textMuted, marginBottom:5, letterSpacing:".5px"}}>PROJECT *</label>
              <select
                value={selProj}
                onChange={e => setSelProj(e.target.value)}
                style={{width:"100%", background:T.inputBg, border:`1px solid ${selProj ? T.blue+"66" : T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:selProj ? T.text : T.textMuted, outline:"none", colorScheme:"light"}}
              >
                <option value="">Select project…</option>
                {renderProjectOptions(projects)}
              </select>
            </div>
            <div style={{flex:1, minWidth:160}}>
              <label style={{display:"block", fontSize:11, fontWeight:700, color:T.textMuted, marginBottom:5, letterSpacing:".5px"}}>JOB NO. (apply to all)</label>
              <input
                value={globalJobNo}
                onChange={e => setGlobalJobNo(e.target.value)}
                placeholder="e.g. JOB-2025-001"
                style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:T.text, outline:"none", colorScheme:"light"}}
                onFocus={e=>e.target.style.borderColor=T.blue}
                onBlur={e=>e.target.style.borderColor=T.border}
              />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{flex:1, overflowY:"auto", padding:"16px 24px"}}>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onClick={() => !uploading && fileInputRef.current.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={!uploading ? onDrop : undefined}
            style={{
              border:        `2px dashed ${T.blue}44`,
              borderRadius:  12,
              padding:       files.length ? "16px" : "36px 24px",
              textAlign:     "center",
              cursor:        uploading ? "not-allowed" : "pointer",
              transition:    "all .2s",
              background:    `${T.blue}06`,
              marginBottom:  14,
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor=T.blue; e.currentTarget.style.background=`${T.blue}12`; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${T.blue}44`; e.currentTarget.style.background=`${T.blue}06`; }}
          >
            {files.length === 0 ? (
              <>
                <div style={{fontSize:40, marginBottom:8}}>📂</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color:T.text, marginBottom:4}}>
                  Drag & drop PDFs here, or click to browse
                </div>
                <div style={{fontSize:12, color:T.textMuted}}>
                  PDF, Word, PNG, JPG — select as many as you need
                </div>
              </>
            ) : (
              <div style={{fontSize:13, color:T.blue, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                <span>+</span> Click or drop more files to add ({files.length} selected)
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            style={{display:"none"}}
            onChange={e => { addFiles(e.target.files); e.target.value=""; }}
          />

          {/* Progress summary bar — shown during upload */}
          {uploading && (
            <div style={{background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:14}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                <span style={{fontSize:13, fontWeight:700, color:T.text}}>Uploading…</span>
                <span style={{fontSize:13, color:T.textMuted}}>{doneCount + errorCount} / {files.length}</span>
              </div>
              <div style={{height:6, background:T.border, borderRadius:999, overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  width: `${files.length ? ((doneCount + errorCount) / files.length * 100) : 0}%`,
                  background: `linear-gradient(90deg, ${T.green}, ${T.blue})`,
                  borderRadius:999,
                  transition:"width .3s ease",
                }}/>
              </div>
              <div style={{display:"flex", gap:14, marginTop:8, fontSize:12}}>
                <span style={{color:T.green}}>✓ {doneCount} done</span>
                {errorCount > 0 && <span style={{color:T.red}}>✕ {errorCount} failed</span>}
                <span style={{color:T.textMuted}}>{pendingCount} remaining</span>
              </div>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div style={{display:"grid", gap:10}}>
              {files.map((entry, i) => {
                const st = progress[entry.id] || "pending";
                const stColor = STATUS_COLOR[st];
                const stIcon  = STATUS_ICON[st];
                const isExpanded = st === "pending" || st === "error";

                return (
                  <div
                    key={entry.id}
                    className="fade-up"
                    style={{
                      background:   T.bg,
                      border:       `1px solid ${st==="done" ? T.green+"44" : st==="error" ? T.red+"44" : T.border}`,
                      borderLeft:   `4px solid ${stColor}`,
                      borderRadius: 10,
                      padding:      "12px 14px",
                      animationDelay: `${i * 0.03}s`,
                    }}
                  >
                    {/* File header row */}
                    <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: isExpanded ? 10 : 0}}>
                      <span style={{fontSize:18, flexShrink:0}}>
                        {/\.pdf$/i.test(entry.file.name) ? "📄" : /\.(png|jpg|jpeg|webp)$/i.test(entry.file.name) ? "🖼️" : "📝"}
                      </span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13, fontWeight:700, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                          {entry.displayName}
                        </div>
                        <div style={{fontSize:11, color:T.textMuted, marginTop:1}}>
                          {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      {/* Status badge */}
                      <div style={{background:`${stColor}18`, border:`1px solid ${stColor}44`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, color:stColor, flexShrink:0, display:"flex", alignItems:"center", gap:5}}>
                        <span>{stIcon}</span>
                        <span style={{textTransform:"capitalize"}}>{st}</span>
                      </div>
                      {/* Remove button — only if not uploading */}
                      {!uploading && (
                        <button
                          onClick={() => removeFile(entry.id)}
                          style={{background:T.redDim, border:`1px solid ${T.red}33`, color:T.red, borderRadius:6, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, cursor:"pointer", flexShrink:0}}
                        >✕</button>
                      )}
                    </div>

                    {/* Editable detail fields — shown when pending */}
                    {isExpanded && !uploading && (
                      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, paddingTop:8, borderTop:`1px solid ${T.border}`}}>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>JOB NO.</label>
                          <input
                            value={entry.jobNo}
                            onChange={e => updateField(entry.id, "jobNo", e.target.value)}
                            placeholder={globalJobNo || "JOB-001"}
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>CERT / REF NO.</label>
                          <input
                            value={entry.refNo}
                            onChange={e => updateField(entry.id, "refNo", e.target.value)}
                            placeholder="e.g. CERT-2025-01"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>AMOUNT (SAR)</label>
                          <input
                            type="number"
                            value={entry.amount}
                            onChange={e => updateField(entry.id, "amount", e.target.value)}
                            placeholder="0"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>COMPLETION DATE</label>
                          <input
                            type="date"
                            value={entry.completionDate}
                            onChange={e => updateField(entry.id, "completionDate", e.target.value)}
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                        <div style={{gridColumn:"1 / -1"}}>
                          <label style={{display:"block", fontSize:10, fontWeight:700, color:T.textMuted, marginBottom:4, letterSpacing:".5px"}}>NOTES</label>
                          <input
                            value={entry.notes}
                            onChange={e => updateField(entry.id, "notes", e.target.value)}
                            placeholder="Optional notes…"
                            style={{width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:7, padding:"7px 10px", fontSize:12, color:T.text, outline:"none", colorScheme:"light"}}
                            onFocus={e=>e.target.style.borderColor=T.blue}
                            onBlur={e=>e.target.style.borderColor=T.border}
                          />
                        </div>
                      </div>
                    )}

                    {/* Uploaded URL preview */}
                    {st === "done" && (
                      <div style={{marginTop:6, fontSize:11, color:T.green, display:"flex", alignItems:"center", gap:6}}>
                        <span>✓ Uploaded successfully</span>
                      </div>
                    )}
                    {st === "error" && (
                      <div style={{marginTop:6, fontSize:11, color:T.red}}>
                        ✕ Upload failed — check Cloudflare Worker config or file size
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{padding:"14px 24px 22px", borderTop:`1px solid ${T.border}`, flexShrink:0, display:"flex", gap:10, alignItems:"center"}}>
          <div style={{flex:1, fontSize:12, color:T.textMuted}}>
            {files.length > 0
              ? `${files.length} file${files.length!==1?"s":""} selected — each becomes one certificate record`
              : "No files selected yet"}
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{background:T.bg, border:`1px solid ${T.border}`, color:T.textSub, borderRadius:10, padding:"11px 20px", fontSize:14, fontWeight:600, cursor:uploading?"not-allowed":"pointer", opacity:uploading?0.5:1}}
          >
            {allDone ? "Close" : "Cancel"}
          </button>
          {!uploading && files.length > 0 && (
            <button
              onClick={handleUploadAll}
              style={{
                background:   `linear-gradient(135deg, ${T.blue}, #2563eb)`,
                border:       "none",
                color:        "#fff",
                borderRadius: 10,
                padding:      "11px 28px",
                fontSize:     14,
                fontWeight:   800,
                cursor:       "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                boxShadow:    `0 4px 16px ${T.blue}44`,
              }}
            >
              ⬆ Upload {files.length} File{files.length!==1?"s":""}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
const Btn      = ({children,onClick,color,solid}) => <button onClick={onClick} style={{background:solid?color:T.bg,border:`1px solid ${solid?color:T.border}`,color:solid?"#000":color||T.textSub,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,transition:"all .15s"}}>{children}</button>;

export { pName, renderProjectOptions, PageHeader, Empty, Overlay, FormModal, CatManagerModal, FieldRow, SectionDivider, FInput, FTextarea, FSelect, FLink, FileLink, FilePreviewModal, ABtn, Btn, Chip, Tag, BulkUploadModal, ScorpionBulkModal, MultiPdfCertUpload, ProjectsModal, daysLeft, pctColor, deriveProjectStats, InvoiceMetricCard, darkenTextShadow };

// ── ProjectsModal ──────────────────────────────────────────────────────────
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
