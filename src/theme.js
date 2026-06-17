/* ─── Theme ──────────────────────────────────────────────────────────────── */
export const LIGHT = {
  bg:"#f0e6d3", sidebar:"#080b10", card:"#fdf8f0", card2:"#f7f0e6", cardHover:"#f0e6d3",
  border:"#e8d5b7", borderLight:"#dcc9a0", text:"#1a0a00", textSub:"#5c3d1e", textMuted:"#a07850",
  blue:"#38bdf8", green:"#34d399", gold:"#fbbf24", red:"#f87171", purple:"#a78bfa", teal:"#2dd4bf", orange:"#fb923c",
  blueDim:"rgba(56,189,248,0.12)", greenDim:"rgba(52,211,153,0.12)", goldDim:"rgba(251,191,36,0.12)",
  redDim:"rgba(248,113,113,0.12)", purpleDim:"rgba(167,139,250,0.12)", tealDim:"rgba(45,212,191,0.12)", orangeDim:"rgba(251,146,60,0.12)",
  inputBg:"#fdf8f0", shadow:"0 2px 12px rgba(26,10,0,0.08), 0 0 0 1px rgba(232,213,183,0.6)",
};

export const DARK = {
  bg:"#0d1117", sidebar:"#0a0e14", card:"#161b22", card2:"#1c2333", cardHover:"#21262d",
  border:"#30363d", borderLight:"#3d444d", text:"#ffffff", textSub:"#e6edf3", textMuted:"#b1bac4",
  blue:"#38bdf8", green:"#34d399", gold:"#fbbf24", red:"#f87171", purple:"#a78bfa", teal:"#2dd4bf", orange:"#fb923c",
  blueDim:"rgba(56,189,248,0.12)", greenDim:"rgba(52,211,153,0.12)", goldDim:"rgba(251,191,36,0.12)",
  redDim:"rgba(248,113,113,0.12)", purpleDim:"rgba(167,139,250,0.12)", tealDim:"rgba(45,212,191,0.12)", orangeDim:"rgba(251,146,60,0.12)",
  inputBg:"#0d1117", shadow:"0 4px 16px rgba(0,0,0,0.4)",
};

/* ─── T: shared mutable theme proxy — all files import this same object ── */
// We use Object.assign so all importers share the SAME reference.
// App calls setTheme(dark) and every component sees the update instantly.
export const T = Object.assign({}, LIGHT);
export function setTheme(dark) { Object.assign(T, dark ? DARK : LIGHT); }
