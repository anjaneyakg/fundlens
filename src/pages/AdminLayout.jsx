// src/pages/AdminLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  {
    group: "Data Pipeline",
    items: [
      { to: "/admin/portfolio-upload", label: "Portfolio Upload", icon: "⬆", live: true  },
      { to: "/admin/pipeline-logs",    label: "Pipeline Logs",    icon: "◈", live: false },
      { to: "/admin/amc-directory",    label: "AMC Directory",    icon: "◎", live: false },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/admin/security-master",  label: "Security Master",  icon: "◆", live: false },
      { to: "/admin/settings",         label: "Settings",         icon: "◇", live: false },
    ],
  },
];

export default function AdminLayout() {
  return (
    <div style={s.shell}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .al-link { text-decoration: none; display: block; }
        .al-link .al-inner {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; border-radius: 10px;
          font-size: 13.5px; font-weight: 500; color: #6b7280;
          transition: all 0.15s; cursor: pointer;
        }
        .al-link:hover .al-inner { background: rgba(99,102,241,0.07); color: #4f46e5; }
        .al-link.active .al-inner {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          color: #4f46e5;
          box-shadow: 0 1px 6px rgba(99,102,241,0.15);
        }
        .al-link.active .al-icon { color: #7c3aed; }
      `}</style>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logoWrap}>
          <div style={s.logoBox}><span style={s.logoText}>FL</span></div>
          <div>
            <div style={s.logoName}>FundLens</div>
            <div style={s.logoTag}>Admin Console</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "0 0.75rem" }}>
          {NAV_ITEMS.map((group) => (
            <div key={group.group} style={s.group}>
              <span style={s.groupLabel}>{group.group}</span>
              {group.items.map((item) =>
                item.live ? (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => isActive ? "al-link active" : "al-link"}
                  >
                    <div className="al-inner">
                      <span className="al-icon" style={s.icon}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={s.liveDot} />
                    </div>
                  </NavLink>
                ) : (
                  <div key={item.to} style={s.disabledItem}>
                    <span style={s.icon}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={s.soonPill}>soon</span>
                  </div>
                )
              )}
            </div>
          ))}
        </nav>

        <div style={s.footerWrap}>
          <div style={s.footerCard}>
            <div style={s.footerTitle}>FundInsight v1.0</div>
            <div style={s.footerSub}>● Pipeline live · Feb 2026</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell: {
    display: "flex", minHeight: "100vh",
    background: "linear-gradient(140deg, #f8f7ff 0%, #f0f9ff 50%, #f0fdf4 100%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  sidebar: {
    width: 252, minHeight: "100vh", flexShrink: 0,
    background: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(16px)",
    borderRight: "1px solid rgba(99,102,241,0.1)",
    boxShadow: "2px 0 20px rgba(99,102,241,0.07)",
    display: "flex", flexDirection: "column",
    padding: "1.5rem 0",
  },
  logoWrap: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "0 1.25rem 1.5rem",
    borderBottom: "1px solid rgba(99,102,241,0.08)",
    marginBottom: "1.25rem",
  },
  logoBox: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
  },
  logoText: { fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" },
  logoName: { fontSize: 15, fontWeight: 700, color: "#1e1b4b", lineHeight: 1.2 },
  logoTag:  { fontSize: 11, fontWeight: 600, color: "#8b5cf6", letterSpacing: "0.04em" },
  group:    { marginBottom: "1.5rem" },
  groupLabel: {
    display: "block", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#c4b5fd", padding: "0 12px", marginBottom: "0.35rem",
  },
  icon: { fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 },
  liveDot: {
    width: 6, height: 6, borderRadius: "50%",
    background: "#10b981", boxShadow: "0 0 0 2px #d1fae5",
    display: "inline-block", flexShrink: 0,
  },
  disabledItem: {
    display: "flex", alignItems: "center", gap: 9,
    padding: "9px 12px", borderRadius: 10,
    fontSize: 13.5, fontWeight: 500, color: "#d1d5db", cursor: "default",
  },
  soonPill: {
    fontSize: 10, fontWeight: 600, color: "#c4b5fd",
    background: "#f5f3ff", border: "1px solid #e9d5ff",
    borderRadius: 20, padding: "2px 8px",
  },
  footerWrap: { padding: "0 0.75rem", marginTop: "auto" },
  footerCard: {
    background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
    border: "1px solid #ddd6fe", borderRadius: 12, padding: "12px 14px",
  },
  footerTitle: { fontSize: 12, fontWeight: 700, color: "#5b21b6" },
  footerSub:   { fontSize: 11, color: "#8b5cf6", marginTop: 3 },
  main: { flex: 1, padding: "2.5rem 3rem", overflowY: "auto" },
};
