import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Files,
  Gauge,
  HelpCircle,
  Laptop2,
  LogOut,
  Menu,
  MonitorSmartphone,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Brand from "./Brand";

const navItems = [
  { label: "Overview", path: "/app/overview", icon: Gauge },
  { label: "My devices", path: "/app/devices", icon: MonitorSmartphone },
  { label: "Remote control", path: "/app/devices", icon: Laptop2 },
  { label: "Files", path: "/app/files", icon: Files },
  { label: "Sessions", path: "/app/sessions", icon: ShieldCheck },
  { label: "Settings", path: "/app/settings", icon: Settings },
];

const titleMap = {
  "/app/overview": ["Overview", "Everything happening across your support workspace."],
  "/app/devices": ["My devices", "Connect, inspect and manage consent-enabled Android devices."],
  "/app/files": ["File transfer", "Move support files between your browser and connected devices."],
  "/app/sessions": ["Session history", "Review remote sessions, operators and consent records."],
  "/app/settings": ["Workspace settings", "Configure security, notifications and remote session behavior."],
};

function initials(value = "AirLink") {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function DashboardShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("airlink-theme") || "dark");
  const { profile, workspace, deviceCount, user, signOut, backendError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isControl = location.pathname.startsWith("/app/control/");
  const [title, subtitle] = isControl
    ? ["Remote control", "Consent-based remote session workspace"]
    : titleMap[location.pathname] || ["AirLink", "Remote support workspace"];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("airlink-theme", theme);
  }, [theme]);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const logout = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch {
      // Auth listener will preserve the session if sign-out fails.
    }
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Administrator";
  const workspaceName = workspace?.name || "AirLink Workspace";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Brand />
          <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={20} /></button>
        </div>

        <div className="workspace-card">
          <span className="workspace-avatar">{initials(workspaceName)}</span>
          <span><b>{workspaceName}</b><small>{workspace?.membershipRole || "member"} workspace</small></span>
          <ChevronDown size={16} />
        </div>

        <nav className="side-nav">
          <span className="nav-label">Workspace</span>
          {navItems.map(({ label, path, icon: Icon }, index) => (
            <NavLink key={`${label}-${index}`} to={path} className={({ isActive }) => `side-link ${isActive && !(label === "Remote control" && location.pathname === "/app/devices") ? "active" : ""}`}>
              <Icon size={19} />
              <span>{label}</span>
              {label === "My devices" && <em>{deviceCount}</em>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="side-link"><HelpCircle size={19} /><span>Help center</span></button>
          <div className="security-mini">
            <ShieldCheck size={21} />
            <span><b>Protected sessions</b><small>Consent and audit enabled</small></span>
          </div>
          <button className="profile-row" onClick={logout}>
            <span className="profile-avatar">{initials(displayName)}</span>
            <span><b>{displayName}</b><small>{user?.email || "Administrator"}</small></span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

      <main className="app-main">
        <header className="app-header">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="page-heading"><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="header-actions">
            <div className="header-search"><Search size={17} /><input placeholder="Search devices..." /></div>
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button className="icon-btn notification-btn" aria-label="Notifications"><Bell size={19} />{backendError && <i />}</button>
          </div>
        </header>
        {backendError && <div className="backend-banner">{backendError}</div>}
        <div className={`app-content ${isControl ? "control-content" : ""}`}><Outlet /></div>
      </main>
    </div>
  );
}
