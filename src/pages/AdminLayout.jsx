// src/pages/AdminLayout.jsx
// The Admin section shell — sidebar on the left, page content on the right.
// Every admin page lives inside this layout via React Router's <Outlet />.

import { NavLink, Outlet, useNavigate } from "react-router-dom";

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
    <div style={styles.shell}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        <div style={styles.wordmark}>
          <span style={styles.wordmarkFL}>FL</span>
          <span style={styles.wordmarkAdmin}>ADMIN</span>
        </div>

        {NAV_ITEMS.map((group) => (
          <div key={group.group} style={styles.navGroup}>
            <span style={styles.groupLabel}>{group.group}</span>
            {group.items.map((item) =>
              item.live ? (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  })}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ) : (
                <div key={item.to} style={{ ...styles.navItem, ...styles.navItemDisabled }}>
                  <span style={styles.navIcon}>{item.icon}</span>
                  {item.label}
                  <span style={styles.soonBadge}>soon</span>
                </div>
              )
            )}
          </div>
        ))}

        <div style={styles.sidebarFooter}>
          <span style={styles.footerDot} />
          FundInsight v1.0
        </div>
      </aside>

      {/* ── Main content area — each admin page renders here ── */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0b0d11",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  },
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: "#0d1017",
    borderRight: "1px solid #1e2430",
    display: "flex",
    flexDirection: "column",
    padding: "2rem 0 1.5rem",
    flexShrink: 0,
  },
  wordmark: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "0 1.5rem 2rem",
    borderBottom: "1px solid #1e2430",
    marginBottom: "1.5rem",
  },
  wordmarkFL: {
    fontSize: 20,
    fontWeight: 700,
    color: "#e8f4f8",
    letterSpacing: "-0.5px",
  },
  wordmarkAdmin: {
    fontSize: 10,
    color: "#4a9eca",
    letterSpacing: "0.2em",
    fontWeight: 500,
  },
  navGroup: {
    marginBottom: "1.75rem",
    padding: "0 1rem",
  },
  groupLabel: {
    display: "block",
    fontSize: 9,
    letterSpacing: "0.18em",
    color: "#3a4558",
    textTransform: "uppercase",
    padding: "0 0.5rem",
    marginBottom: "0.5rem",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 10px",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 12.5,
    color: "#6b7a94",
    marginBottom: 1,
    transition: "background 0.15s, color 0.15s",
    cursor: "pointer",
  },
  navItemActive: {
    background: "#162035",
    color: "#4a9eca",
  },
  navItemDisabled: {
    opacity: 0.4,
    cursor: "default",
  },
  navIcon: {
    fontSize: 11,
    width: 14,
    textAlign: "center",
    flexShrink: 0,
  },
  soonBadge: {
    marginLeft: "auto",
    fontSize: 9,
    color: "#2e3a4e",
  },
  sidebarFooter: {
    marginTop: "auto",
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    color: "#2e3a4e",
  },
  footerDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#1e8a3c",
    flexShrink: 0,
    display: "inline-block",
  },
  main: {
    flex: 1,
    padding: "2.5rem 3rem",
    overflowY: "auto",
    color: "#c8d8e8",
  },
};
