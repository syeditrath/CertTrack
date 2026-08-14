import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { T } from "../theme.js";
import { uid, daysUntil, fmtDate, formatSarCompact, useViewport, printPage, getInvoiceRemainingAmount, getInvoiceCollectedAmount, getInvoiceStream, getMetricTypeTheme } from "../utils.js";
import { getStatus, ExportBtn, DEFAULT_MANPOWER_CATS, DEFAULT_SCORPION_CATS, MP_CERT_MAP, MP_HEADER_ROW, EQ_CERT_MAP, EQ_HEADER_ROW, parseExcelWithHeaderRow, loadNotifySettings, saveNotifySettings, buildEmailPayload, buildMaintenanceEmailPayload, sendMaintenanceEmail, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, NOTIFY_LAST_SENT_KEY, COMPANY_PASSWORD, AUTH_KEY, FINANCE_PASSWORD, ANALYSIS_PASSWORD, COST_PASSWORD, ADMIN_PASSWORD, ADMIN_KEY, isAuthenticated, EMPTY_DATA } from "../constants.js";
import { uploadFile, saveAppData, getPreviewUrl } from "../cloudflare.js";
import { pName, renderProjectOptions, Btn, Chip, Tag, ABtn, Overlay, FormModal, FieldRow, SectionDivider, FInput, FSelect, PageHeader, Empty, CatManagerModal } from "./UI.jsx";

function RigDetailsPage({ rig, equipment, onBack }) {
  const today = new Date();

  const openMaintenance = equipment.reduce(
    (count, eq) =>
      count + (eq.maintenance || []).filter(t => t.status !== "Closed").length,
    0
  );

  const expiringCerts = equipment.reduce((count, eq) => {
    return (
      count +
      (eq.certifications || []).filter(cert => {
        if (!cert.expiryDate) return false;
        const diff = (new Date(cert.expiryDate) - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
      }).length
    );
  }, 0);

  const statusColor = status => {
    switch (status) {
      case "Active":      return T.green;
      case "Standby":     return T.gold;
      case "Maintenance": return T.red;
      default:            return T.blue;
    }
  };

  return (
    <div
      style={{
        maxWidth: "min(1600px, 95vw)",
        margin: "0 auto",
        animation: "rigFadeIn 0.35s ease"
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.textMuted,
            cursor: "pointer",
            padding: "6px 14px",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.18s"
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.gold; e.currentTarget.style.borderColor = T.gold; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
        >
          ← Back to Rigs
        </button>

        <div>
  <div
    style={{
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 30,
      fontWeight: 800,
      color: T.text,
      lineHeight: 1
    }}
  >
    {rig.name}
  </div>
  {rig.project && (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      background: T.blueDim,
      border: `1px solid ${T.blue}44`,
      borderRadius: 20,
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 700,
      color: T.blue,
    }}>
      ◆ {rig.project}
    </div>
  )}
  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
    Rig details, equipment & maintenance
  </div>
</div>

        {rig.status && (
          <div
            style={{
              marginLeft: "auto",
              background: statusColor(rig.status) + "22",
              color: statusColor(rig.status),
              border: `1px solid ${statusColor(rig.status)}55`,
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 13,
              fontWeight: 700
            }}
          >
            {rig.status}
          </div>
        )}
      </div>

      {/* ── Hero image + stats row ── */}
      {/* ── Hero image + stats row ── */}
<div style={{
  display: "grid",
  gridTemplateColumns: "1fr 300px",   // slightly narrower stats col
  gap: 18,
  marginBottom: 18
}}>
  {/* Hero */}
  <div
    style={{
      borderRadius: 14,
      overflow: "hidden",
      border: `1px solid ${T.border}`,
      height: 320,
      position: "relative",
      background: "#0a0a0a"           // ✅ dark bg so image doesn't float
    }}
  >
    <img
      src={rig.image || "/rig-placeholder.webp"}
      alt={rig.name}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",         // ✅ was "cover" — shows full rig
        objectPosition: "center"
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, #00000099 0%, transparent 55%)"
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 20,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 36,
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 2px 12px #0008"
      }}
    >
      {rig.name}
    </div>
  </div>

  {/* Stat cards — add minWidth so grid doesn't collapse on small screens */}
  <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
    {[
      { label: "Equipment Attached",  value: equipment.length,   icon: "🔧", color: T.blue },
      { label: "Open Maintenance",    value: openMaintenance,    icon: "⚠️", color: openMaintenance > 0 ? T.red  : T.green },
      { label: "Certs Expiring (30d)",value: expiringCerts,      icon: "📋", color: expiringCerts  > 0 ? T.gold : T.green },
    ].map(stat => (
      <div
        key={stat.label}
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flex: 1
        }}
      >
        <div style={{ fontSize: 28 }}>{stat.icon}</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{stat.label}</div>
        </div>
      </div>
    ))}
  </div>
</div>

      {/* ── Equipment list ── */}
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 12 }}>
        EQUIPMENT
      </div>

      {equipment.length === 0 ? (
        <Empty icon="🔩" label="No equipment on this rig" sub="Assign equipment from the Equipment page" color={T.gold} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {equipment.map((eq, i) => {
            const openTasks = (eq.maintenance || []).filter(t => t.status !== "Closed").length;
            const expiring = (eq.certifications || []).filter(cert => {
              if (!cert.expiryDate) return false;
              const diff = (new Date(cert.expiryDate) - today) / (1000 * 60 * 60 * 24);
              return diff >= 0 && diff <= 30;
            }).length;

            return (
              <div
                key={eq.id || i}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "16px 18px",
                  animation: `rigFadeIn 0.3s ease ${i * 0.05}s both`
                }}
              >
                <div style={{ fontWeight: 700, color: T.text, fontSize: 15, marginBottom: 6 }}>
                  {eq.name || eq.id}
                </div>
                {eq.type && (
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{eq.type}</div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {openTasks > 0 && (
                    <span style={{ background: T.red + "22", color: T.red, border: `1px solid ${T.red}44`, borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>
                      {openTasks} open task{openTasks > 1 ? "s" : ""}
                    </span>
                  )}
                  {expiring > 0 && (
                    <span style={{ background: T.gold + "22", color: T.gold, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>
                      {expiring} cert{expiring > 1 ? "s" : ""} expiring
                    </span>
                  )}
                  {openTasks === 0 && expiring === 0 && (
                    <span style={{ background: T.green + "22", color: T.green, border: `1px solid ${T.green}44`, borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>
                      All clear
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes rigFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}


// ─── RigsPage ─────────────────────────────────────────────────────────────────
function RigsPage({ data, setData, showToast, isAdmin }) {
  const [selectedRig, setSelectedRig] = useState(null);
  const [hoveredRig, setHoveredRig] = useState(null);

  const rigs      = data.rigs      || [];
  const equipment = data.equipment || [];

  const getRigEquipment   = rigName => equipment.filter(eq => eq.rig === rigName);

  const getOpenMaintenance = rigName =>
    equipment
      .filter(eq => eq.rig === rigName)
      .reduce(
        (count, eq) =>
          count + (eq.maintenance || []).filter(t => t.status !== "Closed").length,
        0
      );

  const getExpiringCerts = rigName => {
    const today = new Date();
    return equipment
      .filter(eq => eq.rig === rigName)
      .reduce((count, eq) => {
        return (
          count +
          (eq.certifications || []).filter(cert => {
            if (!cert.expiryDate) return false;
            const diff = (new Date(cert.expiryDate) - today) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 30;
          }).length
        );
      }, 0);
  };

  const statusColor = status => {
    switch (status) {
      case "Active":      return T.green;
      case "Standby":     return T.gold;
      case "Maintenance": return T.red;
      default:            return T.blue;
    }
  };

  // ── Navigate to detail view ──
  if (selectedRig) {
    return (
      <RigDetailsPage
        rig={selectedRig}
        equipment={equipment.filter(eq => eq.rig === selectedRig.name)}
        onBack={() => setSelectedRig(null)}
      />
    );
  }

  // ── Card grid ──
  return (
    <div style={{ maxWidth: "min(1600px, 95vw)", margin: "0 auto" }}>

      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 30,
              fontWeight: 800,
              color: T.text
            }}
          >
            RIGS
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            View all rigs and attached equipment
          </div>
        </div>
      </div>

      {/* Empty state */}
      {rigs.length === 0 ? (
        <Empty
          icon="🔩"
          label="No rigs available"
          sub="Add rigs from Project Documents"
          color={T.gold}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20
          }}
        >
          {rigs.map((rig, idx) => {
            const rigEquipment   = getRigEquipment(rig.name);
            const openMaintenance = getOpenMaintenance(rig.name);
            const expiringCerts  = getExpiringCerts(rig.name);
            const isHovered      = hoveredRig === rig.name;

            return (
              <div
                key={rig.name}
                onClick={() => setSelectedRig(rig)}
                onMouseEnter={() => setHoveredRig(rig.name)}
                onMouseLeave={() => setHoveredRig(null)}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: `1px solid ${isHovered ? T.gold + "88" : T.border}`,
                  cursor: "pointer",
                  background: T.card,
                  display: "flex",
                  flexDirection: "column",
                  height: 340,
                  transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
                  transform: isHovered ? "translateY(-4px) scale(1.012)" : "translateY(0) scale(1)",
                  boxShadow: isHovered
                    ? `0 12px 40px ${T.gold}22, 0 4px 16px #0004`
                    : "0 2px 8px #0002",
                  animation: `rigFadeIn 0.35s ease ${idx * 0.06}s both`,
                  position: "relative"
                }}
              >
                {/* ── 75%: Image ── */}
                <div style={{ height: "75%", position: "relative", overflow: "hidden" }}>
                  <img
                    src={rig.image || "/rig-placeholder.webp"}
                    alt={rig.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.45s ease",
                      transform: isHovered ? "scale(1.06)" : "scale(1)"
                    }}
                  />

                  {/* Gradient overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: isHovered
                        ? "linear-gradient(to bottom, transparent 30%, #00000066 100%)"
                        : "linear-gradient(to bottom, transparent 50%, #00000044 100%)",
                      transition: "background 0.3s ease"
                    }}
                  />

                  {/* Status badge */}
                  {rig.status && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        background: statusColor(rig.status) + "dd",
                        color: "#fff",
                        borderRadius: 20,
                        padding: "3px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase"
                      }}
                    >
                      {rig.status}
                    </div>
                  )}

                  {/* Alert badges (slide in on hover) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 12,
                      display: "flex",
                      gap: 6,
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered ? "translateY(0)" : "translateY(6px)",
                      transition: "opacity 0.25s ease, transform 0.25s ease"
                    }}
                  >
                    {openMaintenance > 0 && (
                      <span
                        style={{
                          background: "#0009",
                          backdropFilter: "blur(6px)",
                          color: T.red,
                          border: `1px solid ${T.red}66`,
                          borderRadius: 10,
                          padding: "2px 10px",
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      >
                        ⚠ {openMaintenance} open
                      </span>
                    )}
                    {expiringCerts > 0 && (
                      <span
                        style={{
                          background: "#0009",
                          backdropFilter: "blur(6px)",
                          color: T.gold,
                          border: `1px solid ${T.gold}66`,
                          borderRadius: 10,
                          padding: "2px 10px",
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      >
                        📋 {expiringCerts} expiring
                      </span>
                    )}
                  </div>
                </div>

                {/* ── 25%: Name + meta ── */}
                <div
                  style={{
                    height: "25%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 18px",
                    borderTop: `1px solid ${T.border}`,
                    background: isHovered ? T.gold + "0a" : "transparent",
                    transition: "background 0.22s ease"
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 22,
                        fontWeight: 800,
                        color: isHovered ? T.gold : T.text,
                        transition: "color 0.22s ease",
                        letterSpacing: "0.02em"
                      }}
                    >
                      {rig.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                      {rigEquipment.length} equipment item{rigEquipment.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div
                    style={{
                      color: T.gold,
                      fontSize: 18,
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered ? "translateX(0)" : "translateX(-6px)",
                      transition: "opacity 0.22s ease, transform 0.22s ease"
                    }}
                  >
                    →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes rigFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COST CONTROL PAGE
════════════════════════════════════════════════════════════════════════════ */
const COST_CATS = [
  {id:"Labour",        color:"#38bdf8", icon:"◈"},
  {id:"Equipment",     color:"#fbbf24", icon:"◎"},
  {id:"Materials",     color:"#34d399", icon:"▦"},
  {id:"Subcontractor", color:"#a78bfa", icon:"◆"},
  {id:"Transport",     color:"#f472b6", icon:"◉"},
  {id:"Tools",         color:"#4ade80", icon:"⚙"},
  {id:"Overhead",      color:"#fb923c", icon:"⊕"},
  {id:"Other",         color:"#94a3b8", icon:"·"},
];
const COST_CAT_MAP = Object.fromEntries(COST_CATS.map(c=>[c.id,c]));


export { RigsPage, RigDetailsPage };
