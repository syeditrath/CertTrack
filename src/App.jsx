import { useState, useEffect, useRef } from "react";
import { GLOBAL_CSS } from "./utils.js";
import { T, DARK, LIGHT, setTheme } from "./theme.js";
import { AUTH_KEY, ADMIN_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, EMPTY_DATA, loadNotifySettings, saveNotifySettings, buildEmailPayload, NOTIFY_LAST_SENT_KEY, isAuthenticated, COMPANY_PASSWORD } from "./constants.js";
import { fetchAppData, saveAppData } from "./cloudflare.js";
import { WelcomeScreen } from "./components/WelcomeScreen.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Dashboard, NotificationSettingsModal } from "./components/Dashboard.jsx";
import { ProjectDocs } from "./components/ProjectDocs.jsx";
import { ScorpionDocs } from "./components/ScorpionDocs.jsx";
import { ManpowerPage } from "./components/ManpowerPage.jsx";
import { EquipmentPage } from "./components/EquipmentPage.jsx";
import { MaintenancePage } from "./components/MaintenancePage.jsx";
import { RigsPage } from "./components/RigsPage.jsx";
import { CostControlPage } from "./components/CostControlPage.jsx";
import { FinancePage, LoginPage, FinanceLoginPage } from "./components/FinancePage.jsx";
import { ProjectAnalysisPage } from "./components/ProjectAnalysis.jsx";
import { Btn, ProjectsModal } from "./components/UI.jsx";

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loadingData, setLoadingData] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [projMod, setProjMod] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [isAdmin, setIsAdmin] = useState(() => { try { return sessionStorage.getItem(ADMIN_KEY)==="true"; } catch { return false; } });
  const loginAdmin = (pw) => { if (pw===ADMIN_PASSWORD) { try{sessionStorage.setItem(ADMIN_KEY,"true");}catch{} setIsAdmin(true); return true; } return false; };
  const [financeAuthed,  setFinanceAuthed]  = useState(false);
  const [analysisAuthed, setAnalysisAuthed] = useState(false);
  const [costAuthed,     setCostAuthed]     = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("cta_dark") === "true"; }
    catch { return false; }
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedInvoiceYear, setSelectedInvoiceYear] = useState("All");
  const { width: viewportWidth } = useViewport();
  const [deepLink, setDeepLink] = useState(null);

  // ✅ FIX 1: handleDeepLink was missing its closing }
  const handleDeepLink = (page, id) => {
    setDeepLink({ page, id });
    setPage(page);
  };

  useEffect(() => {
    if (!document.getElementById("ct-g")) {
      const s = document.createElement("style");
      s.id = "ct-g";
      s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
  (async () => {
    try {
      const appData = await fetchAppData();
      setData(appData);
      setLoadingData(false);
    } catch (err) {
      console.error("Cloudflare Worker load failed:", err);
      setDbError(true);
    }
  })();
}, []);

  const [notifySettings, setNotifySettings] = useState(() => loadNotifySettings());
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyTestResult, setNotifyTestResult] = useState(null);

  const BACKUP_KEY = "cta_last_backup";
  const [backupStatus, setBackupStatus] = useState(() => {
    try { return localStorage.getItem(BACKUP_KEY) || null; } catch { return null; }
  });
  const [backingUp, setBackingUp] = useState(false);

  const backupToDrive = async (silent = false) => {
    if (backingUp) return;
    setBackingUp(true);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const now = new Date();
      const pad = n => String(n).padStart(2,"0");
      const filename = `ScorpionPortal_Backup_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;

      const metadata = JSON.stringify({ name: filename, parents: [] });
      const form = new FormData();
      form.append("metadata", new Blob([metadata], { type: "application/json" }));
      form.append("file", blob);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const ts = now.toLocaleString();
      try { localStorage.setItem(BACKUP_KEY, ts); } catch {}
      setBackupStatus(ts);
      if (!silent) showToast("✅ Backup downloaded successfully");
    } catch (e) {
      if (!silent) showToast("Backup failed", "error");
    }
    setBackingUp(false);
  };

  useEffect(() => {
    if (loadingData) return;
    const isEmpty = !data.manpower?.length && !data.equipment?.length && !data.projects?.length
      && !data.scorpionDocs?.length && !data.projectDocs?.length && !data.invoices?.length;
    if (isEmpty) return;

    const last = backupStatus ? new Date(backupStatus).getTime() : 0;
    const hoursSince = (Date.now() - last) / (1000 * 60 * 60);
    if (hoursSince >= 24) {
      backupToDrive(true);
    }
  }, [loadingData]);

  useEffect(() => {
    if (window.emailjs) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.onload = () => { try { window.emailjs.init(EMAILJS_PUBLIC_KEY); } catch {} };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.body.style.background = T.bg;
    try { localStorage.setItem("cta_dark", darkMode); } catch {}
  }, [darkMode]);

  // ✅ FIX 2: saveAppData useEffect had a misplaced }; that broke the effect body
  useEffect(() => {
    if (loadingData) return;
    const hasRealData = (data.manpower?.length > 0)
      || (data.equipment?.length > 0)
      || (data.scorpionDocs?.length > 0)
      || (data.projectDocs?.length > 0)
      || (data.invoices?.length > 0)
      || (data.workOrders?.length > 0)
      || (data.costSheets?.length > 0)
      || (data.rigs?.length > 0)
      || (data.projectAnalysis?.some(p => p.poValue || p.dailyReports?.length > 0));
    if (!hasRealData) return;

    const t = setTimeout(() => {
      saveAppData(data).catch(err => { console.error("Save failed:", err); });
    }, 400);

    return () => clearTimeout(t);
  }, [data, loadingData]);

  const allExpiriesRef = useRef([]);
  useEffect(() => {
    if (!notifySettings.enabled) return;
    const recipients = notifySettings.emails || [];
    if (recipients.length === 0) return;
    if (!window.emailjs) return;
    const lastSent = localStorage.getItem(NOTIFY_LAST_SENT_KEY);
    const today = new Date().toDateString();
    if (lastSent === today) return;
    const threshold = Number(notifySettings.thresholdDays) || 90;
    const alertsToSend = allExpiriesRef.current.filter(a => a.days <= threshold);
    if (alertsToSend.length === 0) return;
    Promise.all(
      recipients.map(email =>
        window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailPayload(alertsToSend, email, false))
      )
    ).then(() => {
      localStorage.setItem(NOTIFY_LAST_SENT_KEY, today);
    }).catch(err => console.warn("EmailJS daily send failed:", err));
  }, [notifySettings, data]);

  setTheme(darkMode);

  if (loadingData) {
    return (
      <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.bg,color:T.text,fontFamily:"'Barlow Condensed',sans-serif",gap:16,padding:24}}>
        {dbError ? (
          <>
            <div style={{fontSize:48}}>⚠️</div>
            <div style={{fontSize:28,fontWeight:800,color:"#ef4444"}}>DATABASE CONNECTION ERROR</div>
            <div style={{fontSize:15,color:T.textMuted,textAlign:"center",maxWidth:480,lineHeight:1.6}}>
              Unable to connect to the database. Your data is safe — this is a connection issue.<br/>
              Please check your internet connection and try again.
            </div>
            <button onClick={()=>window.location.reload()} style={{background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"12px 28px",fontSize:16,fontWeight:800,cursor:"pointer",marginTop:8}}>
              🔄 Retry Connection
            </button>
            <div style={{fontSize:12,color:T.textMuted,marginTop:4}}>
              If this persists, contact your system administrator.
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:32,fontWeight:800}}>SCORPION PORTAL</div>
            <div style={{fontSize:16,color:T.textMuted}}>Connecting to database...</div>
          </>
        )}
      </div>
    );
  }

  const logout = () => {
    try { sessionStorage.removeItem(AUTH_KEY); } catch {}
    setAuthed(false);
    setFinanceAuthed(false);
    setAnalysisAuthed(false);
    setCostAuthed(false);
  };

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(() => setToast(null), 3200); };

  const go = p => { setPage(p); setSideOpen(false); if (p !== "finance") setFinanceAuthed(false); if (p !== "analysis") setAnalysisAuthed(false); if (p !== "costs") setCostAuthed(false); };

  const saveProjects = projects => setData(prev=>({...prev,projects}));

  const allExpiries = [
    ...data.scorpionDocs.filter(d=>d.expiryDate).map(d=>({
      label:d.name, src:"Company Doc", days:daysUntil(d.expiryDate), page:"scorpion", id:d.id
    })),
    ...(data.projectDocs||[]).filter(d=>d.expiryDate).map(d=>({
      label:d.name, src:"Project Doc", days:daysUntil(d.expiryDate), page:"projects", id:d.id
    })),
    ...data.manpower.flatMap(p=>[
      p.passportExpiry && {label:p.name, src:"Passport",  days:daysUntil(p.passportExpiry), page:"manpower", id:p.id},
      p.visaExpiry     && {label:p.name, src:"Visa",      days:daysUntil(p.visaExpiry),     page:"manpower", id:p.id},
      p.iqamaExpiry    && {label:p.name, src:"Iqama",     days:daysUntil(p.iqamaExpiry),    page:"manpower", id:p.id},
      p.muqeemExpiry   && {label:p.name, src:"Muqeem",    days:daysUntil(p.muqeemExpiry),   page:"manpower", id:p.id},
      ...(p.certs||[]).map(c=>({label:`${p.name} — ${c.name}`, src:"Cert", days:daysUntil(c.expiryDate), page:"manpower", id:p.id})),
    ].filter(Boolean)),
    ...data.equipment.flatMap(e=>[
      ...(e.certifications||[]).map(c=>({label:`${e.name} — ${c.certNo||"Cert"}`, src:"Eq Cert",  days:daysUntil(c.expiryDate), page:"equipment", id:e.id})),
      ...(e.insurance||[]).map(c=>({label:`${e.name} — Insurance`,                src:"Insurance", days:daysUntil(c.expiryDate), page:"equipment", id:e.id})),
      ...(e.permits||[]).map(c=>({label:`${e.name} — ${c.type||"Permit"}`,        src:"Permit",    days:daysUntil(c.expiryDate), page:"equipment", id:e.id})),
    ]),
  ].filter(x=>x.days!==null&&x.days<=90).sort((a,b)=>a.days-b.days);
  allExpiriesRef.current = allExpiries;

  const searchResults = globalSearch.length > 1 ? (() => {
    const q = globalSearch.toLowerCase();
    const results = [];
    data.scorpionDocs.forEach(d=>{ if(Object.values(d).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Company Doc",label:d.name,sub:d.category,page:"scorpion"}); });
    (data.projectDocs||[]).forEach(d=>{ if(Object.values(d).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Project Doc",label:d.name,sub:d.project,page:"projects"}); });
    data.manpower.forEach(p=>{ if(Object.values(p).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Person",label:p.name,sub:p.designation,page:"manpower"}); });
    data.equipment.forEach(e=>{ if(Object.values(e).some(v=>String(v).toLowerCase().includes(q))) results.push({type:"Equipment",label:e.name,sub:e.serialNo,page:"equipment"}); });
    return results.slice(0,12);
  })() : [];

  if (!authed) {
    return <LoginPage onLogin={(pw) => {
      if (pw === COMPANY_PASSWORD) { try{sessionStorage.setItem(AUTH_KEY,"true");}catch{} setAuthed(true); return true; }
      return false;
    }} />;
  }

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:T.bg}}>
      {showWelcome && <WelcomeScreen onEnter={()=>setShowWelcome(false)}/>}
      {notifyModal && (
        <NotificationSettingsModal
          settings={notifySettings}
          allExpiries={allExpiries}
          sending={notifySending}
          testResult={notifyTestResult}
          onSave={s => { setNotifySettings(s); saveNotifySettings(s); setNotifyModal(false); setNotifyTestResult(null); }}
          onClose={() => { setNotifyModal(false); setNotifyTestResult(null); }}
          onTest={async (s) => {
            const recipients = s.emails || [];
            if (recipients.length === 0) return;
            setNotifySending(true); setNotifyTestResult(null);
            const threshold = Number(s.thresholdDays) || 90;
            const alertsToSend = allExpiries.filter(a => a.days <= threshold);
            try {
              await Promise.all(
                recipients.map(email =>
                  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailPayload(alertsToSend, email, true))
                )
              );
              setNotifyTestResult({ok:true, msg:`✅ Test email sent to ${recipients.length} recipient${recipients.length!==1?"s":""}: ${recipients.join(", ")}`});
            } catch (err) {
              setNotifyTestResult({ok:false, msg:`❌ Failed: ${err?.text || err?.message || "Unknown error"}`});
            }
            setNotifySending(false);
          }}
        />
      )}
      {sideOpen && <div className="fade-in" onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(13,31,53,0.45)",zIndex:49}}/>}

      <Sidebar page={page} go={go} sideOpen={sideOpen} alerts={allExpiries.length} data={data} viewportWidth={viewportWidth} isAdmin={isAdmin} onManageProjects={()=>{setSideOpen(false);setProjMod(true);}} darkMode={darkMode} onToggleDark={()=>setDarkMode(d=>!d)} onLogout={logout} financeAuthed={financeAuthed} analysisAuthed={analysisAuthed} costAuthed={costAuthed}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <header style={{background:T.sidebar,borderBottom:"2px solid transparent",backgroundImage:`linear-gradient(${T.sidebar},${T.sidebar}), linear-gradient(90deg,#fbbf24,#38bdf8,#34d399,#fbbf24)`,backgroundOrigin:"border-box",backgroundClip:"padding-box, border-box",padding:`0 ${viewportWidth < 600 ? "10px" : "20px"}`,flexShrink:0,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",height:viewportWidth < 600 ? 50 : 56,position:"relative",gap:viewportWidth < 480 ? 6 : 0}}>
            {viewportWidth < 1200 && (
              <button
                onClick={() => setSideOpen(true)}
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#ffffff",borderRadius:8,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,zIndex:1}}>
                ☰
              </button>
            )}
            {viewportWidth >= 500 ? (
              <div style={{position:"absolute",left:0,right:0,textAlign:"center",pointerEvents:"none"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:24,letterSpacing:"2px",color:"#f59e0b",textTransform:"uppercase"}}>SCORPION ARABIA</div>
                <div style={{fontSize:11,color:"#93c5fd",letterSpacing:"1.5px",marginTop:1}}>ENTERPRISE RESOURCE PLANNING</div>
              </div>
            ) : (
              <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:15,letterSpacing:"1px",color:"#f59e0b",textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>SCORPION ARABIA</div>
              </div>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:viewportWidth < 480 ? 4 : 8,alignItems:"center",zIndex:1,flexShrink:0}}>
              <div style={{position:"relative"}}>
                {showSearch
                  ? <input autoFocus value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
                      onBlur={()=>{if(!globalSearch)setShowSearch(false);}}
                      placeholder="Search…"
                      style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,padding:"7px 10px",fontSize:13,color:"#fff",outline:"none",width:viewportWidth < 480 ? 140 : 200}}/>
                  : <button onClick={()=>setShowSearch(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⌕</button>
                }
                {searchResults.length>0&&showSearch&&(
                  <div style={{position:"absolute",top:42,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,width:viewportWidth < 480 ? "90vw" : 320,maxHeight:380,overflowY:"auto",boxShadow:T.shadow,zIndex:200}}>
                    {searchResults.map((r,i)=>(
                      <div key={i} onClick={()=>{go(r.page);setShowSearch(false);setGlobalSearch("");}}
                        style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${darkMode?DARK.border:T.border}`,transition:"background .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=darkMode?DARK.cardHover:T.cardHover}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{fontSize:13,fontWeight:600,color:T.text}}>{r.label}</div>
                        <div style={{fontSize:11,color:T.textMuted,marginTop:2,display:"flex",gap:6}}>
                          <span style={{background:T.blueDim,color:T.blue,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{r.type}</span>
                          <span>{r.sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {allExpiries.length>0 && (
                <div style={{background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.5)",color:"#fca5a5",borderRadius:8,padding:viewportWidth < 480 ? "5px 8px" : "6px 12px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                  ▲ <span style={{background:"#dc2626",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:11,fontWeight:700}}>{allExpiries.length}</span>
                </div>
              )}
              <button
                onClick={()=>{
                  if (isAdmin) { try{sessionStorage.removeItem(ADMIN_KEY);}catch{} setIsAdmin(false); showToast("Admin mode off"); }
                  else { const pw=window.prompt("Enter admin password:"); if(pw && loginAdmin(pw)) showToast("Admin mode on — delete enabled"); else if(pw) showToast("Wrong password","error"); }
                }}
                title={isAdmin ? "Admin mode ON — click to lock" : "Unlock admin (delete) access"}
                style={{background:isAdmin?"rgba(239,68,68,0.12)":"transparent",border:`1px solid ${isAdmin?"#ef4444":T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:13,color:isAdmin?"#ef4444":T.textMuted,display:"flex",alignItems:"center",gap:4,transition:"all .15s",flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=isAdmin?"#ef4444":T.textMuted}
                onMouseLeave={e=>e.currentTarget.style.borderColor=isAdmin?"#ef4444":T.border}>
                {isAdmin ? (viewportWidth < 480 ? "🔓" : "🔓 Admin") : "🔒"}
              </button>
              {viewportWidth >= 400 && <>
              <input id="restore-input" type="file" accept=".json" style={{display:"none"}} onChange={e=>{
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
                    const restored = { ...EMPTY_DATA, ...parsed };
                    setData(restored);
                    saveAppData(restored).then(()=>showToast("✅ Data restored successfully")).catch(()=>showToast("Restored locally — Worker sync failed","error"));
                  } catch(err) { showToast("Failed to restore: invalid backup file","error"); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}/>
              <button onClick={()=>document.getElementById("restore-input").click()}
                title="Restore data from backup JSON file"
                style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14,color:T.textMuted,display:"flex",alignItems:"center",gap:5,transition:"all .15s",flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.blue}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                📂
              </button>
              <button onClick={() => backupToDrive(false)} disabled={backingUp || loadingData} title={backupStatus ? `Last backup: ${backupStatus}` : "No backup yet"}
                style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14,color:T.textMuted,display:"flex",alignItems:"center",gap:4,transition:"all .15s",opacity:backingUp?0.5:1,flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.green}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                {backingUp ? "⏳" : "💾"}
                {backupStatus && viewportWidth >= 640 && <span style={{fontSize:9,fontWeight:700,color:T.green,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {backupStatus.split(",")[0]}
                </span>}
              </button>
              </>}
              <button onClick={() => setNotifyModal(true)} title="Email Notification Settings"
                style={{background:notifySettings.enabled?"rgba(251,191,36,0.15)":"transparent",border:`1px solid ${notifySettings.enabled?T.gold:T.border}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:15,color:notifySettings.enabled?T.gold:T.textMuted,display:"flex",alignItems:"center",gap:4,transition:"all .15s",flexShrink:0}}>
                🔔{notifySettings.enabled && viewportWidth >= 480 && <span style={{fontSize:10,fontWeight:700,color:T.gold}}>ON</span>}
              </button>
            </div>
          </div>
        </header>

        <main style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"clamp(10px,2vw,28px) clamp(10px,2.5vw,32px)"}}>
          {page==="dashboard" && (
            <div className="fade-in" key="dashboard">
              <Dashboard
                data={data}
                alerts={allExpiries}
                go={setPage}
                onDeepLink={handleDeepLink}
              />
            </div>
          )}
          {page==="scorpion" && <div className="fade-in" key="scorpion"><ScorpionDocs data={data} setData={setData} showToast={showToast} isAdmin={isAdmin} deepLinkId={deepLink?.page==="scorpion" ? deepLink.id : null} onDeepLinkConsumed={()=>setDeepLink(null)} /></div>}
          {page==="projects" && <div className="fade-in" key="projects"><ProjectDocs data={data} setData={setData} showToast={showToast} onManageProjects={()=>setProjMod(true)} isAdmin={isAdmin}/></div>}
          {page==="analysis" && (
            analysisAuthed
              ? <div className="fade-in" key="analysis"><ProjectAnalysisPage data={data} setData={setData} showToast={showToast} go={go} isAdmin={isAdmin}/></div>
              : <FinanceLoginPage title="PROJECT ANALYSIS ACCESS" subtitle="This section is restricted. Enter the analysis password to continue." passwordLabel="ANALYSIS PASSWORD" placeholder="Enter analysis password…" onLogin={(pw) => {
                  if (pw === ANALYSIS_PASSWORD) { setAnalysisAuthed(true); return true; }
                  return false;
                }}/>
          )}
          {page==="equipment" && <div className="fade-in" key="equipment"><EquipmentPage data={data} setData={setData} showToast={showToast} isAdmin={isAdmin} deepLinkId={deepLink?.page==="equipment" ? deepLink.id : null} onDeepLinkConsumed={()=>setDeepLink(null)}/></div>}
          {page==="manpower" && <div className="fade-in" key="manpower"><ManpowerPage data={data} setData={setData} showToast={showToast} isAdmin={isAdmin} deepLinkId={deepLink?.page==="manpower" ? deepLink.id : null} onDeepLinkConsumed={()=>setDeepLink(null)}/></div>}
          {page==="rigs" && (
            <div className="fade-in">
              <RigsPage
                data={data}
                setData={setData}
                showToast={showToast}
                isAdmin={isAdmin}
              />
            </div>
          )}
          {page==="maintenance" && <div className="fade-in" key="maintenance"><MaintenancePage data={data} setData={setData} showToast={showToast} isAdmin={isAdmin}/></div>}
          {page==="costs" && (
            costAuthed
              ? <div className="fade-in" key="costs"><CostControlPage data={data} setData={setData} showToast={showToast} go={go} isAdmin={isAdmin}/></div>
              : <FinanceLoginPage title="COST CONTROL ACCESS" subtitle="This section contains sensitive financial data.\nEnter the cost control password to continue." passwordLabel="COST CONTROL PASSWORD" placeholder="Enter password…" onLogin={(pw) => {
                  if (pw === COST_PASSWORD) { setCostAuthed(true); return true; }
                  return false;
                }}/>
          )}
          {page==="finance" && (
            financeAuthed
              ? <div className="fade-in" key="finance"><FinancePage data={data} setData={setData} showToast={showToast} selectedInvoiceYear={selectedInvoiceYear} setSelectedInvoiceYear={setSelectedInvoiceYear} isAdmin={isAdmin}/></div>
              : <FinanceLoginPage onLogin={(pw) => {
                  if (pw === FINANCE_PASSWORD) {
                    setFinanceAuthed(true);
                    return true;
                  }
                  return false;
                }}/>
          )}
        </main>
      </div>

      {projMod && <ProjectsModal projects={data.projects||[]} onSave={saveProjects} onClose={()=>setProjMod(false)} isAdmin={isAdmin}/>}

      {toast && (
        <div className="pop-in" style={{position:"fixed",bottom:viewportWidth < 600 ? 16 : 24,right:viewportWidth < 600 ? 12 : 24,left:viewportWidth < 600 ? 12 : "auto",zIndex:999,background:toast.type==="del"?"#fee2e2":"#d1fae5",border:`1px solid ${toast.type==="del"?T.red:T.green}`,color:toast.type==="del"?T.red:T.green,borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10}}>
          {toast.type==="del"?"✕":"✓"} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════════════════════ */
