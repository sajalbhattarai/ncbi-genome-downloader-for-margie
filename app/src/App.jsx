import { useState, useEffect, useCallback } from "react";
import Setup from "./pages/Setup.jsx";
import GenomeBrowser from "./pages/GenomeBrowser.jsx";
import DownloadManager from "./pages/DownloadManager.jsx";
import Verification from "./pages/Verification.jsx";
import Logs from "./pages/Logs.jsx";
import Processing from "./pages/Processing.jsx";
import Credits from "./pages/Credits.jsx";

/* ── Navigation definition ────────────────────────────────── */
const NAV_ITEMS = [
  { id: "setup", label: "Setup", icon: "CFG" },
  { id: "genome-browser", label: "Genome Browser", icon: "BRW" },
  { id: "download-manager", label: "Download Manager", icon: "DL" },
  { id: "processing", label: "Processing", icon: "PRO" },
  { id: "verification", label: "Verification", icon: "VRF" },
  { id: "logs", label: "Logs", icon: "LOG" },
  { id: "credits", label: "Credits", icon: "CRD" },
];

const TOTAL_GENOMES = 2999;

/* ── Page router ──────────────────────────────────────────── */
function PageRouter({ page, downloadStats, setDownloadStats }) {
  switch (page) {
    case "setup":
      return <Setup />;
    case "genome-browser":
      return <GenomeBrowser />;
    case "download-manager":
      return (
        <DownloadManager
          downloadStats={downloadStats}
          setDownloadStats={setDownloadStats}
        />
      );
    case "processing":
      return <Processing />;
    case "verification":
      return <Verification downloadStats={downloadStats} />;
    case "logs":
      return <Logs />;
    case "credits":
      return <Credits />;

    default:
      return <Setup />;
  }
}

/* ── Status bar ───────────────────────────────────────────── */
function StatusBar({ downloadStats }) {
  const { downloaded = 0, failed = 0, running = false } = downloadStats;
  const remaining = TOTAL_GENOMES - downloaded - failed;
  const pct = Math.round((downloaded / TOTAL_GENOMES) * 100);

  return (
    <div style={styles.statusBar}>
      {/* Left: progress bar + label */}
      <div style={styles.statusLeft}>
        <div style={styles.statusProgressTrack}>
          <div
            style={{
              ...styles.statusProgressFill,
              width: `${pct}%`,
            }}
          />
        </div>
        <span style={styles.statusPct}>{pct}%</span>
      </div>

      {/* Centre: pill stats */}
      <div style={styles.statusPills}>
        <StatusPill
          label="Total"
          value={TOTAL_GENOMES.toLocaleString()}
          color="var(--text-secondary)"
        />
        <StatusPill
          label="Downloaded"
          value={downloaded.toLocaleString()}
          color="var(--accent-green)"
        />
        <StatusPill
          label="Failed"
          value={failed.toLocaleString()}
          color={failed > 0 ? "var(--accent-red)" : "var(--text-muted)"}
        />
        <StatusPill
          label="Remaining"
          value={remaining.toLocaleString()}
          color="var(--text-secondary)"
        />
      </div>

      {/* Right: activity indicator */}
      <div style={styles.statusRight}>
        {running ? (
          <span style={styles.statusRunning}>
            <span style={styles.statusDot} />
            Downloading…
          </span>
        ) : downloaded === TOTAL_GENOMES ? (
          <span
            style={{
              color: "var(--accent-green)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Complete
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Idle</span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }) {
  return (
    <div style={styles.pill}>
      <span style={{ ...styles.pillLabel }}>{label}</span>
      <span style={{ ...styles.pillValue, color }}>{value}</span>
    </div>
  );
}

/* ── Sidebar nav item ─────────────────────────────────────── */
function NavItem({ item, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={{
        ...styles.navItem,
        ...(isActive
          ? styles.navItemActive
          : hovered
            ? styles.navItemHover
            : {}),
      }}
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.label}
    >
      {/* Active indicator bar */}
      <span
        style={{
          ...styles.navIndicator,
          opacity: isActive ? 1 : 0,
        }}
      />
      <span style={styles.navIcon}>{item.icon}</span>
      <span
        style={{
          ...styles.navLabel,
          color: isActive
            ? "var(--accent-blue)"
            : hovered
              ? "var(--text-primary)"
              : "var(--text-secondary)",
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

/* ── Theme selector ──────────────────────────────────────── */
const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "eink", label: "E-ink" },
];

function ThemeSelector({ current, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 10px" }}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          title={t.label + " theme"}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: "5px 4px",
            border:
              current === t.id
                ? "1px solid var(--accent-blue)"
                : "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background:
              current === t.id ? "var(--accent-blue-10)" : "var(--bg-hover)",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            color:
              current === t.id ? "var(--accent-blue)" : "var(--text-muted)",
            letterSpacing: "0.03em",
            fontFamily: "var(--font-ui)",
            transition: "var(--transition)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────────── */
export default function App() {
  const [activePage, setActivePage] = useState("setup");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("ui-theme") || "dark",
  );
  const [downloadStats, setDownloadStats] = useState({
    downloaded: 0,
    failed: 0,
    running: false,
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ui-theme", theme);
  }, [theme]);

  /* Listen for genome-status events from main process */
  useEffect(() => {
    if (!window.electronAPI) return;

    const handler = (data) => {
      setDownloadStats((prev) => {
        if (data.status === "done") {
          return { ...prev, downloaded: prev.downloaded + 1 };
        }
        if (data.status === "failed") {
          return { ...prev, failed: prev.failed + 1 };
        }
        return prev;
      });
    };

    window.electronAPI.onGenomeStatus(handler);
    return () => window.electronAPI.removeAllListeners("genome-status");
  }, []);

  /* Listen for downloads-done event */
  useEffect(() => {
    if (!window.electronAPI) return;

    const handler = () => {
      setDownloadStats((prev) => ({ ...prev, running: false }));
    };

    window.electronAPI.onDownloadsDone(handler);
    return () => window.electronAPI.removeAllListeners("downloads-done");
  }, []);

  const handleNav = useCallback((pageId) => {
    setActivePage(pageId);
  }, []);

  return (
    <div style={styles.root}>
      {/* ── macOS title bar drag region ── */}
      <div style={styles.titleBar}>
        <div style={styles.titleBarSpacer} />
        {/* Traffic lights sit at ~8px from left; leave them alone */}
        <span style={styles.titleBarText}>Microbial Genome Downloader</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flex: 1,
            paddingRight: 10,
            WebkitAppRegion: "no-drag",
          }}
        >
          <button
            onClick={() => window.location.reload()}
            title="Reload application (Cmd+R)"
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 10px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              transition: "var(--transition)",
              WebkitAppRegion: "no-drag",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.borderColor = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            Reload
          </button>
        </div>
      </div>

      {/* ── Main body (sidebar + content) ── */}
      <div style={styles.body}>
        {/* ── Sidebar ── */}
        <aside style={styles.sidebar}>
          {/* Logo / brand */}
          <div style={styles.brand}>
            <span style={styles.brandIcon}>MGD</span>
            <div style={styles.brandText}>
              <span style={styles.brandName}>Genome Downloader</span>
              <span style={styles.brandVersion}>v1.0.0</span>
            </div>
          </div>

          <div style={styles.sidebarDivider} />

          {/* Navigation */}
          <nav style={styles.nav}>
            <span style={styles.navSectionLabel}>Navigation</span>
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={activePage === item.id}
                onClick={handleNav}
              />
            ))}
          </nav>

          {/* Theme selector */}
          <div style={styles.sidebarTheme}>
            <ThemeSelector current={theme} onChange={setTheme} />
          </div>

          {/* Sidebar footer */}
          <div style={styles.sidebarFooter}>
            <div style={styles.footerRow}>
              <span style={styles.footerDot} />
              <span style={styles.footerText}>
                NCBI RefSeq · {TOTAL_GENOMES.toLocaleString()} genomes
              </span>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={styles.content}>
          <PageRouter
            page={activePage}
            downloadStats={downloadStats}
            setDownloadStats={setDownloadStats}
          />
        </main>
      </div>

      {/* ── Status bar ── */}
      <StatusBar downloadStats={downloadStats} />
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────── */
const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    overflow: "hidden",
  },

  /* ── Title bar ── */
  titleBar: {
    height: 28,
    minHeight: 28,
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 80 /* room for traffic lights */,
    paddingRight: 16,
    WebkitAppRegion: "drag",
    userSelect: "none",
    flexShrink: 0,
  },
  titleBarSpacer: {
    flex: 1,
  },
  titleBarText: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    letterSpacing: "0.02em",
    WebkitAppRegion: "drag",
    pointerEvents: "none",
  },

  /* ── Body ── */
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  /* ── Sidebar ── */
  sidebar: {
    width: 220,
    minWidth: 220,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flexShrink: 0,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px 12px",
    flexShrink: 0,
  },
  brandIcon: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "var(--accent-blue)",
    background: "var(--accent-blue-10)",
    border: "1px solid var(--accent-blue-20)",
    borderRadius: 4,
    padding: "3px 5px",
    flexShrink: 0,
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--accent-blue)",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  brandVersion: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontWeight: 500,
    letterSpacing: "0.04em",
  },

  sidebarDivider: {
    height: 1,
    background: "var(--border)",
    marginBottom: 8,
    flexShrink: 0,
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0 8px",
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },

  navSectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "8px 8px 6px",
    display: "block",
  },

  navItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "7px 10px 7px 14px",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 120ms ease",
    flexShrink: 0,
    outline: "none",
  },
  navItemActive: {
    background: "rgba(56, 139, 253, 0.10)",
  },
  navItemHover: {
    background: "var(--bg-hover)",
  },
  navIndicator: {
    position: "absolute",
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    width: 3,
    height: 18,
    borderRadius: "0 3px 3px 0",
    background: "var(--accent-blue)",
    transition: "opacity 120ms ease",
  },
  navIcon: {
    fontSize: 9,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    letterSpacing: "0.03em",
    color: "var(--text-muted)",
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "1px 4px",
    lineHeight: 1.6,
    flexShrink: 0,
    minWidth: 28,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 13,
    fontWeight: 500,
    transition: "color 120ms ease",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  sidebarTheme: {
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  sidebarFooter: {
    padding: "10px 16px 14px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  footerRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--accent-blue)",
    flexShrink: 0,
    boxShadow: "0 0 4px var(--accent-blue)",
  },
  footerText: {
    fontSize: 11,
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* ── Content ── */
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    background: "var(--bg-primary)",
  },

  /* ── Status bar ── */
  statusBar: {
    height: 32,
    minHeight: 32,
    background: "var(--bg-secondary)",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "0 16px",
    flexShrink: 0,
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  statusProgressTrack: {
    width: 80,
    height: 4,
    background: "var(--bg-hover)",
    borderRadius: 2,
    overflow: "hidden",
  },
  statusProgressFill: {
    height: "100%",
    borderRadius: 2,
    background: "var(--accent-blue)",
    transition: "width 400ms ease",
  },
  statusPct: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
    minWidth: 30,
  },
  statusPills: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pillValue: {
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  statusRight: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  statusRunning: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent-blue)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--accent-blue)",
    animation: "pulse 1.4s ease-in-out infinite",
  },
};
