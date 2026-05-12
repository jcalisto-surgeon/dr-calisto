import { useState, useEffect } from "react";

const STORAGE_KEY = "dr_calisto_data_v2";

const defaultBookingChecklist = [
  { id: "b1", text: "Is the diagnosis correct", done: false },
  { id: "b2", text: "Do you need additional tests", done: false },
  { id: "b3", text: "Can surgery wait", done: false },
  { id: "b4", text: "Is the approach the necessary", done: false },
  { id: "b5", text: "Pathology — review", done: false },
];

const defaultEODChecklist = [
  { id: "e1", text: "Indications — Review all cases for the week", done: false },
  { id: "e2", text: "Surgical checklist", done: false },
  { id: "e3", text: "Called pediatricians", done: false },
  { id: "e4", text: "Emails", done: false },
  { id: "e5", text: "No risky cases", done: false },
  { id: "e6", text: "PCPLC involvement", done: false },
  { id: "e7", text: "Risky cases — More communication", done: false },
  { id: "e8", text: "Medical records", done: false },
  { id: "e9", text: "Clear communication", done: false },
  { id: "e10", text: "Special cases — neonatal and infant lines, CV, ECMO", done: false },
];

const defaultData = {
  prep: [
    { id: 1, text: "Review tomorrow's surgical cases", done: false },
    { id: 2, text: "Confirm OR team and instruments", done: false },
    { id: 3, text: "Prepare patient family briefings", done: false },
    { id: 4, text: "Lay out attire the night before", done: false },
    { id: 5, text: "Set alarm 90 minutes before first case", done: false },
  ],
  arrivalTime: "06:00",
  calls: [],
  reflection: "",
  article: null,
  articleLoading: false,
  safety: {
    cases: [],
    eodChecklist: defaultEODChecklist,
  },
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultData,
        ...parsed,
        safety: {
          ...defaultData.safety,
          ...(parsed.safety || {}),
          eodChecklist: parsed.safety?.eodChecklist || defaultEODChecklist,
          cases: parsed.safety?.cases || [],
        },
      };
    }
    return defaultData;
  } catch {
    return defaultData;
  }
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const tabs = [
  { id: "prep", label: "Preparation", icon: "✦" },
  { id: "arrival", label: "Arrival", icon: "◎" },
  { id: "calls", label: "Calls", icon: "⟳" },
  { id: "safety", label: "Safety", icon: "⊕" },
  { id: "reflect", label: "Reflection", icon: "◈" },
  { id: "article", label: "Research", icon: "❋" },
];

const emptyCase = () => ({
  id: Date.now(),
  patientName: "",
  diagnosis: "",
  additionalDiagnostics: "",
  timingOfSurgery: "",
  approach: "",
  pathologyAndLabs: "",
  bookingChecklist: defaultBookingChecklist.map((i) => ({ ...i, done: false })),
  sealed: false,
  createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
});

export default function App() {
  const [data, setData] = useState(loadData);
  const [activeTab, setActiveTab] = useState("prep");
  const [newCall, setNewCall] = useState({ name: "", number: "", note: "" });
  const [addingCall, setAddingCall] = useState(false);
  const [now, setNow] = useState(new Date());
  const [newPrepItem, setNewPrepItem] = useState("");
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [safetyView, setSafetyView] = useState("list");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { saveData(data); }, [data]);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const updateSafety = (patch) => setData((d) => ({ ...d, safety: { ...d.safety, ...patch } }));

  const getCountdown = () => {
    const [h, m] = data.arrivalTime.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target - now;
    return { hours: Math.floor(diff / 3600000), mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) };
  };

  const countdown = getCountdown();
  const prepDone = data.prep.filter((p) => p.done).length;
  const prepPct = Math.round((prepDone / data.prep.length) * 100);

  const activeCase = data.safety.cases.find((c) => c.id === activeCaseId);

  const updateCase = (id, patch) =>
    updateSafety({ cases: data.safety.cases.map((c) => c.id === id ? { ...c, ...patch } : c) });

  const toggleCaseCheck = (caseId, checkId) => {
    const c = data.safety.cases.find((x) => x.id === caseId);
    if (!c) return;
    updateCase(caseId, { bookingChecklist: c.bookingChecklist.map((i) => i.id === checkId ? { ...i, done: !i.done } : i) });
  };

  const sealCase = (id) => {
    const c = data.safety.cases.find((x) => x.id === id);
    if (!c || !c.bookingChecklist.every((i) => i.done)) {
      alert("Complete all booking checklist items before sealing this case.");
      return;
    }
    updateCase(id, { sealed: true });
  };

  const eodDone = data.safety.eodChecklist.filter((i) => i.done).length;
  const eodPct = Math.round((eodDone / data.safety.eodChecklist.length) * 100);

  const fetchArticle = async () => {
    update({ articleLoading: true, article: null });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: "Search for the single most recent and important pediatric surgery journal article or clinical breakthrough from 2025 or 2026. Return a JSON object ONLY (no markdown) with: title, journal, date, summary (2-3 sentences on clinical significance), keyTakeaway (one sentence action point for a pediatric surgeon), and url. No preamble." }],
        }),
      });
      const json = await res.json();
      const text = json.content.map((b) => b.text || "").join("");
      update({ article: JSON.parse(text.replace(/```json|```/g, "").trim()), articleLoading: false });
    } catch {
      update({ article: { error: "Could not load article. Please try again." }, articleLoading: false });
    }
  };

  // ─── COLOR TOKENS ───
  const gold = "#C9A84C", goldLight = "#E8C96A", dark = "#0D0F14", surface = "#13161E",
    surface2 = "#1A1E2A", border = "#252A38", textPrimary = "#F0EDE6",
    textMuted = "#7A8099", green = "#4CAF82", amber = "#E8A838", red = "#E05A5A";

  const S = {
    root: { fontFamily: "'DM Mono', monospace", background: dark, color: textPrimary, minHeight: "100vh", display: "flex", flexDirection: "column" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 14px", borderBottom: `1px solid ${border}`, background: surface },
    headerLeft: { display: "flex", alignItems: "center", gap: 12 },
    monogram: { width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg, ${gold}, #8B5E1A)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: dark, flexShrink: 0 },
    name: { fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 600, letterSpacing: 0.5 },
    subtitle: { fontSize: 9, color: textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 },
    clock: { fontSize: 12, color: gold, letterSpacing: 2 },
    tabBar: { display: "flex", overflowX: "auto", borderBottom: `1px solid ${border}`, background: surface, padding: "0 10px" },
    tab: { background: "none", border: "none", color: textMuted, padding: "11px 11px", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", borderBottom: "2px solid transparent", transition: "all 0.2s", fontFamily: "'DM Mono', monospace" },
    tabActive: { color: gold, borderBottomColor: gold },
    content: { flex: 1, padding: "22px 18px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" },
    panel: { display: "flex", flexDirection: "column", gap: 14 },
    panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
    panelTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, margin: 0 },
    panelSub: { color: textMuted, fontSize: 10, margin: "3px 0 0", letterSpacing: 0.5 },
    badge: { background: `linear-gradient(135deg, ${gold}, #8B5E1A)`, color: dark, borderRadius: 20, padding: "4px 13px", fontSize: 12, fontWeight: 600 },
    progressBar: { height: 3, background: border, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: "100%", background: `linear-gradient(90deg, ${gold}, ${goldLight})`, transition: "width 0.4s ease", borderRadius: 2 },
    list: { display: "flex", flexDirection: "column", gap: 7 },
    listItem: { display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", background: surface2, borderRadius: 8, cursor: "pointer", border: `1px solid ${border}`, fontSize: 12, letterSpacing: 0.3, transition: "opacity 0.2s" },
    listItemDone: { opacity: 0.38 },
    checkbox: { width: 19, height: 19, borderRadius: 4, border: `1.5px solid ${textMuted}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" },
    checkboxDone: { background: gold, borderColor: gold },
    checkmark: { color: dark, fontSize: 10, fontWeight: 700 },
    strikeText: { textDecoration: "line-through", color: textMuted },
    addRow: { display: "flex", gap: 8 },
    input: { flex: 1, background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 13px", color: textPrimary, fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none" },
    successBanner: { background: `rgba(201,168,76,0.08)`, border: `1px solid ${gold}`, borderRadius: 8, padding: "13px 16px", color: gold, fontSize: 11, letterSpacing: 0.8, textAlign: "center" },
    empty: { textAlign: "center", color: textMuted, padding: "44px 20px", fontSize: 11, border: `1px dashed ${border}`, borderRadius: 10 },
    // Arrival
    countdownBox: { background: surface2, border: `1px solid ${border}`, borderRadius: 12, padding: "28px 20px", textAlign: "center" },
    countdownLabel: { color: textMuted, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 },
    countdownTime: { display: "flex", justifyContent: "center", alignItems: "center", gap: 6 },
    countUnit: { fontFamily: "'Cormorant Garamond', serif", fontSize: 58, fontWeight: 700, color: gold, lineHeight: 1, minWidth: 74, display: "inline-block" },
    countSep: { fontFamily: "'Cormorant Garamond', serif", fontSize: 44, color: textMuted, lineHeight: 1, marginBottom: 6 },
    countdownSubs: { display: "flex", justifyContent: "center", gap: "62px", marginTop: 10, fontSize: 8, letterSpacing: 3, color: textMuted, textTransform: "uppercase" },
    timeSetRow: { display: "flex", flexDirection: "column", gap: 7 },
    fieldLabel2: { fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: textMuted },
    timeInput: { background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "11px 15px", color: textPrimary, fontSize: 17, fontFamily: "'DM Mono', monospace", outline: "none", width: "fit-content" },
    tipsBox: { background: surface2, border: `1px solid ${border}`, borderRadius: 12, padding: "18px", display: "flex", flexDirection: "column", gap: 11 },
    tipsTitle: { color: gold, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 },
    tip: { display: "flex", gap: 11, alignItems: "flex-start", fontSize: 11, lineHeight: 1.5 },
    tipNum: { color: gold, fontWeight: 600, flexShrink: 0, fontSize: 10 },
    // Calls
    callForm: { background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 9 },
    callItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 15px", background: surface2, borderRadius: 8, border: `1px solid ${border}`, gap: 10 },
    callInfo: { flex: 1 },
    callName: { fontSize: 13, color: textPrimary, fontFamily: "'Cormorant Garamond', serif" },
    callNumber: { fontSize: 10, color: gold, marginTop: 2, letterSpacing: 1 },
    callNote: { fontSize: 10, color: textMuted, marginTop: 3 },
    callActions: { display: "flex", gap: 7, flexShrink: 0 },
    // Safety
    safetyHero: { background: `linear-gradient(135deg, #0F1520, #1C2340)`, border: `1px solid rgba(201,168,76,0.35)`, borderRadius: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    safetyHeroLeft: { display: "flex", alignItems: "center", gap: 13 },
    safetyIcon: { fontSize: 26, color: gold },
    safetyHeroTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 700, letterSpacing: 0.5 },
    safetyHeroSub: { fontSize: 9, color: textMuted, letterSpacing: 1, marginTop: 3 },
    sealedCount: { textAlign: "center" },
    sealedNum: { fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 700, color: gold, lineHeight: 1 },
    sealedLabel: { fontSize: 8, color: textMuted, letterSpacing: 2, textTransform: "uppercase", marginTop: 3 },
    safetyWarning: { background: `rgba(232,168,56,0.07)`, border: `1px solid rgba(232,168,56,0.2)`, borderRadius: 8, padding: "10px 14px", color: amber, fontSize: 11, display: "flex", alignItems: "center", gap: 9, letterSpacing: 0.3, lineHeight: 1.5 },
    warningIcon: { fontSize: 13, flexShrink: 0 },
    safetyNav: { display: "flex", gap: 7 },
    safetyNavBtn: { background: surface2, border: `1px solid ${border}`, color: textMuted, borderRadius: 8, padding: "8px 16px", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8 },
    safetyNavActive: { background: `rgba(201,168,76,0.1)`, border: `1px solid rgba(201,168,76,0.4)`, color: gold },
    caseCard: { background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: "15px", cursor: "pointer" },
    caseCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 },
    caseName: { fontSize: 15, color: textPrimary, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    caseDate: { fontSize: 9, color: textMuted, marginTop: 2, letterSpacing: 0.5 },
    caseDx: { fontSize: 10, color: gold, marginTop: 4 },
    sealBadge: { background: `rgba(76,175,130,0.1)`, border: `1px solid rgba(76,175,130,0.3)`, color: green, borderRadius: 20, padding: "3px 9px", fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 },
    pctBadge: { background: `rgba(201,168,76,0.08)`, border: `1px solid rgba(201,168,76,0.25)`, color: gold, borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 600 },
    miniProgress: { height: 2, background: border, borderRadius: 2, overflow: "hidden" },
    miniProgressFill: { height: "100%", transition: "width 0.4s", borderRadius: 2 },
    caseDetailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    btnBack: { background: "none", border: "none", color: gold, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, padding: 0 },
    sealedBanner: { background: `rgba(76,175,130,0.07)`, border: `1px solid rgba(76,175,130,0.3)`, borderRadius: 10, padding: "15px 17px", display: "flex", alignItems: "center", gap: 13 },
    sealedBannerIcon: { fontSize: 22, color: green, flexShrink: 0 },
    sealedBannerTitle: { color: green, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 },
    sealedBannerSub: { color: textMuted, fontSize: 10, marginTop: 3, lineHeight: 1.5 },
    sectionLabel: { fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase", color: textMuted, borderBottom: `1px solid ${border}`, paddingBottom: 7, marginTop: 4 },
    fieldGroup: { display: "flex", flexDirection: "column", gap: 11 },
    fieldRow: { display: "flex", flexDirection: "column", gap: 4 },
    fieldLabel: { fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: gold },
    fieldInput: { background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "9px 13px", color: textPrimary, fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none", resize: "none", lineHeight: 1.6, width: "100%", boxSizing: "border-box" },
    fieldReadonly: { background: surface, color: textMuted, cursor: "default" },
    btnSeal: { background: `linear-gradient(135deg, ${green}, #2A7A55)`, color: dark, border: "none", borderRadius: 10, padding: "13px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: 1, textTransform: "uppercase" },
    btnSealDisabled: { opacity: 0.32, cursor: "not-allowed" },
    // Reflection
    reflectPrompts: { background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 },
    prompt: { display: "flex", gap: 9, alignItems: "center" },
    promptQ: { fontSize: 10, color: textMuted, letterSpacing: 0.3, lineHeight: 1.6 },
    textarea: { background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: "14px", color: textPrimary, fontSize: 12, fontFamily: "'DM Mono', monospace", lineHeight: 1.7, resize: "vertical", minHeight: 150, outline: "none", width: "100%", boxSizing: "border-box" },
    reflectFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    charCount: { fontSize: 9, color: textMuted, letterSpacing: 0.5 },
    quoteBox: { borderLeft: `3px solid ${gold}`, paddingLeft: 14, marginTop: 2 },
    quoteText: { fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: textMuted, fontStyle: "italic", lineHeight: 1.6 },
    // Article
    articleEmpty: { textAlign: "center", padding: "56px 20px", border: `1px dashed ${border}`, borderRadius: 12 },
    articleEmptyIcon: { fontSize: 34, color: gold, marginBottom: 14, opacity: 0.45 },
    articleEmptyText: { color: textMuted, fontSize: 11, lineHeight: 1.7 },
    loading: { textAlign: "center", padding: "56px 20px" },
    spinner: { width: 34, height: 34, border: `2px solid ${border}`, borderTop: `2px solid ${gold}`, borderRadius: "50%", margin: "0 auto 14px", animation: "spin 1s linear infinite" },
    loadingText: { color: textMuted, fontSize: 10, letterSpacing: 1 },
    articleCard: { background: surface2, border: `1px solid ${border}`, borderRadius: 12, padding: "22px", display: "flex", flexDirection: "column", gap: 13 },
    articleMeta: { display: "flex", gap: 7, flexWrap: "wrap" },
    journalBadge: { background: `rgba(201,168,76,0.1)`, border: `1px solid rgba(201,168,76,0.3)`, color: gold, borderRadius: 20, padding: "3px 11px", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
    dateBadge: { background: surface, border: `1px solid ${border}`, color: textMuted, borderRadius: 20, padding: "3px 11px", fontSize: 9 },
    articleTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 600, color: textPrimary, margin: 0, lineHeight: 1.4 },
    articleSummary: { fontSize: 11, color: textMuted, lineHeight: 1.7, margin: 0 },
    takeawayBox: { background: `rgba(201,168,76,0.06)`, border: `1px solid rgba(201,168,76,0.18)`, borderRadius: 8, padding: "13px 15px" },
    takeawayLabel: { color: gold, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 },
    takeawayText: { fontSize: 11, color: textPrimary, lineHeight: 1.6 },
    articleLink: { color: gold, fontSize: 10, letterSpacing: 0.5, textDecoration: "none" },
    error: { color: red, fontSize: 11, textAlign: "center", padding: 20 },
    // Buttons
    btnGold: { background: `linear-gradient(135deg, ${gold}, #8B5E1A)`, color: dark, border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, cursor: "pointer", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" },
    btnOutline: { background: "none", color: textMuted, border: `1px solid ${border}`, borderRadius: 8, padding: "9px 16px", fontSize: 10, letterSpacing: 0.8, cursor: "pointer", fontFamily: "'DM Mono', monospace" },
    btnDone: { background: `rgba(76,175,130,0.12)`, color: green, border: `1px solid rgba(76,175,130,0.3)`, borderRadius: 8, padding: "7px 13px", fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono', monospace" },
    btnDelete: { background: "none", color: textMuted, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 11px", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace" },
  };

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.monogram}>C</div>
          <div>
            <div style={S.name}>Dr. Calisto</div>
            <div style={S.subtitle}>Pediatric Surgery · Leadership Dashboard</div>
          </div>
        </div>
        <div style={S.clock}>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ ...S.tab, ...(activeTab === t.id ? S.tabActive : {}) }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* ── PREPARATION ── */}
        {activeTab === "prep" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>Night Before Preparation</h2>
                <p style={S.panelSub}>Champions prepare before the day begins.</p>
              </div>
              <div style={S.badge}>{prepPct}%</div>
            </div>
            <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${prepPct}%` }} /></div>
            <div style={S.list}>
              {data.prep.map((item) => (
                <div key={item.id}
                  onClick={() => update({ prep: data.prep.map((p) => p.id === item.id ? { ...p, done: !p.done } : p) })}
                  style={{ ...S.listItem, ...(item.done ? S.listItemDone : {}) }}>
                  <div style={{ ...S.checkbox, ...(item.done ? S.checkboxDone : {}) }}>
                    {item.done && <span style={S.checkmark}>✓</span>}
                  </div>
                  <span style={item.done ? S.strikeText : {}}>{item.text}</span>
                </div>
              ))}
            </div>
            <div style={S.addRow}>
              <input style={S.input} placeholder="Add custom prep item..." value={newPrepItem}
                onChange={(e) => setNewPrepItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newPrepItem.trim()) { update({ prep: [...data.prep, { id: Date.now(), text: newPrepItem.trim(), done: false }] }); setNewPrepItem(""); } }} />
              <button style={S.btnGold} onClick={() => { if (!newPrepItem.trim()) return; update({ prep: [...data.prep, { id: Date.now(), text: newPrepItem.trim(), done: false }] }); setNewPrepItem(""); }}>Add</button>
            </div>
            {prepPct === 100 && <div style={S.successBanner}>✦ &nbsp;You are fully prepared, Dr. Calisto. Rest well.</div>}
          </div>
        )}

        {/* ── ARRIVAL ── */}
        {activeTab === "arrival" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div><h2 style={S.panelTitle}>Early Arrival Target</h2><p style={S.panelSub}>Be there before they expect you.</p></div>
            </div>
            <div style={S.countdownBox}>
              <div style={S.countdownLabel}>Time until arrival</div>
              <div style={S.countdownTime}>
                <span style={S.countUnit}>{String(countdown.hours).padStart(2, "0")}</span>
                <span style={S.countSep}>:</span>
                <span style={S.countUnit}>{String(countdown.mins).padStart(2, "0")}</span>
                <span style={S.countSep}>:</span>
                <span style={S.countUnit}>{String(countdown.secs).padStart(2, "0")}</span>
              </div>
              <div style={S.countdownSubs}><span>HRS</span><span>MIN</span><span>SEC</span></div>
            </div>
            <div style={S.timeSetRow}>
              <label style={S.fieldLabel2}>Set arrival time for tomorrow</label>
              <input type="time" value={data.arrivalTime} onChange={(e) => update({ arrivalTime: e.target.value })} style={S.timeInput} />
            </div>
            <div style={S.tipsBox}>
              <div style={S.tipsTitle}>Early Arrival Protocol</div>
              {["Arrive 15 min before the OR team to center yourself", "Review patient charts before the first handshake", "Use the quiet time to visualize the procedure", "Greet every team member by name as they arrive"].map((tip, i) => (
                <div key={i} style={S.tip}><span style={S.tipNum}>{String(i + 1).padStart(2, "0")}</span><span>{tip}</span></div>
              ))}
            </div>
          </div>
        )}

        {/* ── CALLS ── */}
        {activeTab === "calls" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div><h2 style={S.panelTitle}>Calls to Return</h2><p style={S.panelSub}>Every unreturned call is a trust deficit.</p></div>
              <button style={S.btnGold} onClick={() => setAddingCall(true)}>+ Add</button>
            </div>
            {addingCall && (
              <div style={S.callForm}>
                <input style={S.input} placeholder="Name / Patient / Colleague" value={newCall.name} onChange={(e) => setNewCall({ ...newCall, name: e.target.value })} />
                <input style={S.input} placeholder="Phone number" value={newCall.number} onChange={(e) => setNewCall({ ...newCall, number: e.target.value })} />
                <input style={S.input} placeholder="Note (reason / urgency)" value={newCall.note} onChange={(e) => setNewCall({ ...newCall, note: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btnGold} onClick={() => { if (!newCall.name) return; update({ calls: [...data.calls, { ...newCall, id: Date.now(), done: false }] }); setNewCall({ name: "", number: "", note: "" }); setAddingCall(false); }}>Save</button>
                  <button style={S.btnOutline} onClick={() => setAddingCall(false)}>Cancel</button>
                </div>
              </div>
            )}
            {data.calls.length === 0 && !addingCall && <div style={S.empty}>No pending calls. Inbox clear, Doctor.</div>}
            <div style={S.list}>
              {data.calls.map((c) => (
                <div key={c.id} style={{ ...S.callItem, ...(c.done ? S.listItemDone : {}) }}>
                  <div style={S.callInfo}>
                    <div style={S.callName}>{c.name}</div>
                    {c.number && <div style={S.callNumber}>{c.number}</div>}
                    {c.note && <div style={S.callNote}>{c.note}</div>}
                  </div>
                  <div style={S.callActions}>
                    <button style={c.done ? S.btnDone : S.btnGold} onClick={() => update({ calls: data.calls.map((x) => x.id === c.id ? { ...x, done: !x.done } : x) })}>{c.done ? "✓ Done" : "Mark Done"}</button>
                    <button style={S.btnDelete} onClick={() => update({ calls: data.calls.filter((x) => x.id !== c.id) })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SAFETY ── */}
        {activeTab === "safety" && (
          <div style={S.panel}>

            {/* Hero */}
            <div style={S.safetyHero}>
              <div style={S.safetyHeroLeft}>
                <div style={S.safetyIcon}>⊕</div>
                <div>
                  <div style={S.safetyHeroTitle}>Safety Template</div>
                  <div style={S.safetyHeroSub}>All booked cases receive this seal</div>
                </div>
              </div>
              <div style={S.sealedCount}>
                <div style={S.sealedNum}>{data.safety.cases.filter((c) => c.sealed).length}</div>
                <div style={S.sealedLabel}>Cases Sealed</div>
              </div>
            </div>

            {/* Warning */}
            <div style={S.safetyWarning}>
              <span style={S.warningIcon}>⚠</span>
              <span>Don't wait until something bad happens to become the safest surgeon in the room.</span>
            </div>

            {/* Sub-nav */}
            <div style={S.safetyNav}>
              {[{ id: "list", label: "Booked Cases" }, { id: "eod", label: "End of Day" }].map((n) => (
                <button key={n.id} onClick={() => setSafetyView(n.id)}
                  style={{ ...S.safetyNavBtn, ...(safetyView === n.id && safetyView !== "case" ? S.safetyNavActive : {}) }}>
                  {n.label}
                </button>
              ))}
            </div>

            {/* ── Case List ── */}
            {safetyView === "list" && (
              <div style={S.panel}>
                <button style={S.btnGold} onClick={() => {
                  const nc = emptyCase();
                  updateSafety({ cases: [nc, ...data.safety.cases] });
                  setActiveCaseId(nc.id);
                  setSafetyView("case");
                }}>+ New Booked Case</button>

                {data.safety.cases.length === 0 && <div style={S.empty}>No cases yet. Add your first booked case to begin the safety review.</div>}

                {data.safety.cases.map((c) => {
                  const done = c.bookingChecklist.filter((i) => i.done).length;
                  const pct = Math.round((done / c.bookingChecklist.length) * 100);
                  return (
                    <div key={c.id} style={S.caseCard} onClick={() => { setActiveCaseId(c.id); setSafetyView("case"); }}>
                      <div style={S.caseCardTop}>
                        <div>
                          <div style={S.caseName}>{c.patientName || "Unnamed Case"}</div>
                          <div style={S.caseDate}>{c.createdAt}</div>
                          {c.diagnosis && <div style={S.caseDx}>{c.diagnosis}</div>}
                        </div>
                        <div>
                          {c.sealed
                            ? <div style={S.sealBadge}>⊕ Sealed</div>
                            : <div style={S.pctBadge}>{pct}%</div>}
                        </div>
                      </div>
                      <div style={S.miniProgress}>
                        <div style={{ ...S.miniProgressFill, width: `${pct}%`, background: c.sealed ? "#4CAF82" : "#C9A84C" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Case Detail ── */}
            {safetyView === "case" && activeCase && (
              <div style={S.panel}>
                <div style={S.caseDetailHeader}>
                  <button style={S.btnBack} onClick={() => setSafetyView("list")}>← All Cases</button>
                  {!activeCase.sealed && (
                    <button style={S.btnDelete} onClick={() => { updateSafety({ cases: data.safety.cases.filter((c) => c.id !== activeCaseId) }); setSafetyView("list"); }}>Delete</button>
                  )}
                </div>

                {activeCase.sealed && (
                  <div style={S.sealedBanner}>
                    <span style={S.sealedBannerIcon}>⊕</span>
                    <div>
                      <div style={S.sealedBannerTitle}>Safety Seal Applied</div>
                      <div style={S.sealedBannerSub}>This case has been fully reviewed and cleared for surgery.</div>
                    </div>
                  </div>
                )}

                {/* Case Info */}
                <div style={S.sectionLabel}>Case Information</div>
                <div style={S.fieldGroup}>
                  {[
                    { key: "patientName", label: "Patient / Case Name", rows: 1 },
                    { key: "diagnosis", label: "Diagnosis", rows: 2 },
                    { key: "additionalDiagnostics", label: "Additional Diagnostics", rows: 2 },
                    { key: "timingOfSurgery", label: "Timing of Surgery", rows: 2 },
                    { key: "approach", label: "Approach", rows: 2 },
                    { key: "pathologyAndLabs", label: "Pathology & Labs", rows: 2 },
                  ].map((f) => (
                    <div key={f.key} style={S.fieldRow}>
                      <label style={S.fieldLabel}>{f.label}</label>
                      <textarea
                        style={{ ...S.fieldInput, ...(activeCase.sealed ? S.fieldReadonly : {}) }}
                        value={activeCase[f.key]}
                        onChange={(e) => !activeCase.sealed && updateCase(activeCase.id, { [f.key]: e.target.value })}
                        placeholder={activeCase.sealed ? "—" : `Enter ${f.label.toLowerCase()}...`}
                        rows={f.rows}
                        readOnly={activeCase.sealed}
                      />
                    </div>
                  ))}
                </div>

                {/* Booking Checklist */}
                <div style={S.sectionLabel}>Booking Checklist</div>
                <div style={S.list}>
                  {activeCase.bookingChecklist.map((item) => (
                    <div key={item.id}
                      onClick={() => !activeCase.sealed && toggleCaseCheck(activeCase.id, item.id)}
                      style={{ ...S.listItem, ...(item.done ? S.listItemDone : {}), cursor: activeCase.sealed ? "default" : "pointer" }}>
                      <div style={{ ...S.checkbox, ...(item.done ? S.checkboxDone : {}) }}>
                        {item.done && <span style={S.checkmark}>✓</span>}
                      </div>
                      <span style={item.done ? S.strikeText : {}}>{item.text}</span>
                    </div>
                  ))}
                </div>

                {!activeCase.sealed && (
                  <button
                    style={{ ...S.btnSeal, ...(activeCase.bookingChecklist.every((i) => i.done) ? {} : S.btnSealDisabled) }}
                    onClick={() => sealCase(activeCase.id)}>
                    ⊕ &nbsp;Apply Safety Seal
                  </button>
                )}
              </div>
            )}

            {/* ── End of Day ── */}
            {safetyView === "eod" && (
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div>
                    <h2 style={{ ...S.panelTitle, fontSize: 20 }}>End of Day Checklist</h2>
                    <p style={S.panelSub}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                  </div>
                  <div style={S.badge}>{eodPct}%</div>
                </div>
                <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${eodPct}%` }} /></div>
                <div style={S.list}>
                  {data.safety.eodChecklist.map((item) => (
                    <div key={item.id}
                      onClick={() => updateSafety({ eodChecklist: data.safety.eodChecklist.map((i) => i.id === item.id ? { ...i, done: !i.done } : i) })}
                      style={{ ...S.listItem, ...(item.done ? S.listItemDone : {}) }}>
                      <div style={{ ...S.checkbox, ...(item.done ? S.checkboxDone : {}) }}>
                        {item.done && <span style={S.checkmark}>✓</span>}
                      </div>
                      <span style={item.done ? S.strikeText : {}}>{item.text}</span>
                    </div>
                  ))}
                </div>
                {eodPct === 100 && <div style={S.successBanner}>⊕ &nbsp;Day complete. Every box checked. Well done, Dr. Calisto.</div>}
                <button style={S.btnOutline} onClick={() => { if (window.confirm("Reset end of day checklist for tomorrow?")) updateSafety({ eodChecklist: defaultEODChecklist }); }}>
                  Reset for Tomorrow
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── REFLECTION ── */}
        {activeTab === "reflect" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>Daily Reflection</h2>
                <p style={S.panelSub}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
            </div>
            <div style={S.reflectPrompts}>
              {["What went exceptionally well today?", "Where did I fall short of my own standard?", "What will I do differently tomorrow?", "Who on my team deserves recognition?"].map((q, i) => (
                <div key={i} style={S.prompt}><span style={S.promptQ}>{q}</span></div>
              ))}
            </div>
            <textarea style={S.textarea} placeholder="Write your reflection here, Dr. Calisto. This is your private space to grow..." value={data.reflection} onChange={(e) => update({ reflection: e.target.value })} />
            <div style={S.reflectFooter}>
              <span style={S.charCount}>{data.reflection.length} characters</span>
              <button style={S.btnOutline} onClick={() => { if (window.confirm("Clear today's reflection?")) update({ reflection: "" }); }}>Clear</button>
            </div>
            <div style={S.quoteBox}>
              <div style={S.quoteText}>"The surgeon who reflects is the surgeon who improves. The one who doesn't — repeats."</div>
            </div>
          </div>
        )}

        {/* ── ARTICLE ── */}
        {activeTab === "article" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div><h2 style={S.panelTitle}>Latest Research</h2><p style={S.panelSub}>Stay at the frontier of pediatric surgery.</p></div>
              <button style={S.btnGold} onClick={fetchArticle} disabled={data.articleLoading}>{data.articleLoading ? "Searching..." : "Fetch Latest"}</button>
            </div>
            {!data.article && !data.articleLoading && (
              <div style={S.articleEmpty}>
                <div style={S.articleEmptyIcon}>❋</div>
                <div style={S.articleEmptyText}>Press <strong>Fetch Latest</strong> to retrieve the most recent<br />pediatric surgery research for you.</div>
              </div>
            )}
            {data.articleLoading && (
              <div style={S.loading}>
                <div style={S.spinner} />
                <div style={S.loadingText}>Searching medical literature...</div>
              </div>
            )}
            {data.article && !data.article.error && (
              <div style={S.articleCard}>
                <div style={S.articleMeta}>
                  {data.article.journal && <span style={S.journalBadge}>{data.article.journal}</span>}
                  {data.article.date && <span style={S.dateBadge}>{data.article.date}</span>}
                </div>
                <h3 style={S.articleTitle}>{data.article.title}</h3>
                <p style={S.articleSummary}>{data.article.summary}</p>
                <div style={S.takeawayBox}>
                  <div style={S.takeawayLabel}>◈ &nbsp;Key Takeaway for Practice</div>
                  <div style={S.takeawayText}>{data.article.keyTakeaway}</div>
                </div>
                {data.article.url && <a href={data.article.url} target="_blank" rel="noreferrer" style={S.articleLink}>Read Full Article →</a>}
              </div>
            )}
            {data.article?.error && <div style={S.error}>{data.article.error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleTag);
