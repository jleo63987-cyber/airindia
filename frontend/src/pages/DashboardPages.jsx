import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BatteryCharging,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Download,
  File,
  FileText,
  Filter,
  Fullscreen,
  HardDrive,
  House,
  Keyboard,
  Laptop2,
  LockKeyhole,
  Mic,
  MicOff,
  MonitorSmartphone,
  MoreHorizontal,
  MousePointer2,
  PanelsTopLeft,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Signal,
  Smartphone,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PhoneMockup from "../components/PhoneMockup";
import RemoteScreenStream from "../components/RemoteScreenStream";
import { useAuth } from "../context/AuthContext";
import { subscribeToSession } from "../services/realtime";
import {
  deleteWorkspaceFile,
  downloadWorkspaceFile,
  endRemoteSession,
  getDevice,
  getOpenSessionForDevice,
  getSession,
  getWorkspaceSettings,
  listDevices,
  listFileTransfers,
  listSessionEvents,
  listSessionMessages,
  listSessions,
  requestRemoteSession,
  removeDevice,
  sendSessionMessage,
  sendRemoteInput,
  updateWorkspaceSettings,
  uploadWorkspaceFile,
} from "../services/backend";

function StatCard({ icon: Icon, label, value, note, trend, className = "" }) {
  return <div className={`stat-card ${className}`}><div className="stat-icon"><Icon size={20}/></div><div className="stat-copy"><span>{label}</span><b>{value}</b><small className={trend === "down" ? "negative" : ""}>{note}</small></div><MoreHorizontal size={18} className="stat-more"/></div>;
}

function DeviceIcon({ status = "offline" }) {
  return <div className={`device-icon device-${status}`}><Smartphone size={24}/><i/></div>;
}

function formatPlatform(device) {
  return device?.android_version ? `Android ${String(device.android_version).replace(/^Android\s*/i, "")}` : "Android";
}

function relativeTime(value) {
  if (!value) return "Never";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

function dateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function durationText(session) {
  const start = session.started_at || session.approved_at || session.created_at;
  const end = session.ended_at || (session.status === "active" ? new Date().toISOString() : null);
  if (!start || !end) return "—";
  const seconds = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

function normalizedStatus(status) {
  if (status === "approved") return "Approved";
  if (status === "requested") return "Requested";
  if (status === "active") return "Active";
  if (status === "declined") return "Declined";
  if (status === "terminated") return "Terminated";
  return "Completed";
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><MonitorSmartphone size={28}/><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function OverviewPage() {
  const { workspace, profile } = useAuth();
  const [devices, setDevices] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    setLoading(true);
    Promise.all([listDevices(workspace.id), listSessions(workspace.id, 100)])
      .then(([deviceRows, sessionRows]) => {
        setDevices(deviceRows);
        setSessions(sessionRows);
      })
      .finally(() => setLoading(false));
  }, [workspace?.id]);

  const online = devices.filter((device) => device.status === "online").length;
  const activeSessions = sessions.filter((session) => session.status === "active").length;
  const approved = sessions.filter((session) => Boolean(session.approved_at)).length;
  const consentRate = sessions.length ? Math.round((approved / sessions.length) * 100) : 100;
  const displayName = profile?.full_name?.split(" ")[0] || "there";

  const sevenDayCounts = useMemo(() => {
    const result = Array(7).fill(0);
    const now = new Date();
    sessions.forEach((session) => {
      const created = new Date(session.created_at);
      const diff = Math.floor((new Date(now.toDateString()) - new Date(created.toDateString())) / 86400000);
      if (diff >= 0 && diff < 7) result[6 - diff] += 1;
    });
    const max = Math.max(1, ...result);
    return result.map((count) => Math.max(8, Math.round((count / max) * 92)));
  }, [sessions]);

  return (
    <>
      <div className="welcome-banner"><div><span className="welcome-kicker"><Zap size={15}/> Supabase connected</span><h2>Welcome, {displayName}.</h2><p>{loading ? "Loading workspace activity…" : `${online} device${online === 1 ? "" : "s"} currently reachable and ${activeSessions} active support session${activeSessions === 1 ? "" : "s"}.`}</p></div><Link to="/app/devices" className="btn btn-primary"><Smartphone size={17}/> View devices</Link><div className="banner-orb"/></div>
      <div className="stats-grid"><StatCard icon={MonitorSmartphone} label="Total devices" value={String(devices.length).padStart(2, "0")} note={`${online} currently reachable`}/><StatCard icon={Activity} label="Active sessions" value={String(activeSessions).padStart(2, "0")} note={`${sessions.length} total recorded`}/><StatCard icon={Clock3} label="Session records" value={String(sessions.length).padStart(2, "0")} note="Stored in Supabase"/><StatCard icon={ShieldCheck} label="Consent rate" value={`${consentRate}%`} note="Approval activity audited"/></div>
      <div className="dashboard-grid">
        <section className="panel devices-panel"><div className="panel-head"><div><h3>Connected devices</h3><p>Live data from your workspace</p></div><Link to="/app/devices">View all <ArrowRight size={15}/></Link></div>{devices.length ? <div className="device-list compact-list">{devices.slice(0, 3).map((device) => <div className="device-row" key={device.id}><DeviceIcon status={device.status}/><div className="device-info"><b>{device.name}</b><span>{device.owner_label || "Device owner"} · {formatPlatform(device)}</span></div><div className="device-meta"><span className={`status-badge ${device.status}`}><i/>{device.status}</span><small><BatteryCharging size={14}/>{device.battery_percent ?? 0}%</small></div><Link className={`connect-btn ${device.status === "offline" ? "disabled" : ""}`} to={`/app/control/${device.id}`}>{device.status === "offline" ? "Unavailable" : "Connect"}</Link></div>)}</div> : <EmptyState title="No registered devices" text="Install AirLink on an Android phone and sign in. The phone appears here automatically." action={<Link to="/app/devices" className="btn btn-primary btn-small">View devices</Link>}/>}</section>
        <section className="panel activity-panel"><div className="panel-head"><div><h3>Session activity</h3><p>Last seven days</p></div><span className="data-source-badge">Database</span></div><div className="bar-chart">{sevenDayCounts.map((height, index) => <div key={index}><span style={{ height: `${height}%` }}/><small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</small></div>)}</div><div className="chart-summary"><span><i className="dot-purple"/> Recorded sessions <b>{sessions.length}</b></span><span><i className="dot-blue"/> Active now <b>{activeSessions}</b></span></div></section>
        <section className="panel quick-panel"><div className="panel-head"><div><h3>Quick actions</h3><p>Common workspace tasks</p></div></div><div className="quick-grid"><Link to="/app/devices"><span><Smartphone size={20}/></span><b>Devices</b><small>Automatic Android enrollment</small></Link><Link to="/app/files"><span><UploadCloud size={20}/></span><b>Send a file</b><small>Store in private bucket</small></Link><Link to="/app/sessions"><span><FileText size={20}/></span><b>Audit logs</b><small>Review session history</small></Link><Link to="/app/settings"><span><Settings size={20}/></span><b>Permissions</b><small>Configure workspace</small></Link></div></section>
        <section className="panel security-panel"><div className="security-score"><div><ShieldCheck size={36}/><span className="score-ring">RLS</span></div><section><span>Backend security</span><h3>Row-level isolation enabled</h3><p>Workspace data is scoped by authenticated membership and device identity.</p></section></div><div className="security-progress"><span style={{ width: "100%" }}/></div><Link to="/app/settings">Review security settings <ChevronRight size={16}/></Link></section>
      </div>
    </>
  );
}

export function DevicesPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [requestingId, setRequestingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!workspace?.id) return;
    setError("");
    try {
      setDevices(await listDevices(workspace.id));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [workspace?.id]);

  const filtered = useMemo(
    () => devices.filter((device) =>
      (filter === "all" || device.status === filter) &&
      `${device.name} ${device.owner_label || ""}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [devices, filter, query],
  );

  const requestFromDeviceList = async (device) => {
    if (!device?.id || device.status === "offline" || requestingId) return;
    setRequestingId(device.id);
    setError("");
    try {
      await requestRemoteSession(device.id);
      navigate(`/app/control/${device.id}`);
    } catch (requestError) {
      // If an open request/session already exists, the control page can resume it.
      if (/already|open|duplicate/i.test(requestError.message || "")) {
        navigate(`/app/control/${device.id}`);
      } else {
        setError(requestError.message || "Unable to request support session.");
      }
    } finally {
      setRequestingId("");
    }
  };

  const removeFromDeviceList = async (device) => {
    if (!workspace?.id || !device?.id || removingId) return;
    const confirmed = window.confirm(`Remove ${device.name} from AirLink? The phone will lose its device identity and any open session will terminate.`);
    if (!confirmed) return;

    setRemovingId(device.id);
    setError("");
    try {
      await removeDevice(workspace.id, device.id);
      setDevices((current) => current.filter((item) => item.id !== device.id));
    } catch (removeError) {
      setError(removeError.message || "Unable to remove device.");
    } finally {
      setRemovingId("");
    }
  };

  return <>
    <div className="toolbar">
      <div className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by device or owner"/></div>
      <div className="filter-pills">{["all", "online", "idle", "offline"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <button className="btn btn-ghost" onClick={load}><RefreshCw size={17}/> Refresh</button>
    </div>
    <div className="backend-note"><ShieldCheck size={16}/> Android phones register here automatically after the user signs in. No pairing code is required.</div>
    {error && <div className="inline-error">{error}</div>}
    {loading && !devices.length ? <div className="pair-loading">Loading devices…</div> : null}
    {filtered.length ? <div className="device-card-grid">{filtered.map((device) => <article className="device-card" key={device.id}>
      <div className="device-card-head"><DeviceIcon status={device.status}/><span className={`status-badge ${device.status}`}><i/>{device.status}</span><button type="button" className="plain-icon device-remove-icon" disabled={removingId === device.id} onClick={() => removeFromDeviceList(device)} title="Remove device"><Trash2 size={18}/></button></div>
      <h3>{device.name}</h3>
      <p>{device.owner_label || "Device owner"} · {formatPlatform(device)}</p>
      <div className="device-health"><div><span><BatteryCharging size={15}/> Battery</span><b>{device.battery_percent ?? 0}%</b><i><em style={{ width: `${device.battery_percent ?? 0}%` }}/></i></div><div><span><HardDrive size={15}/> Storage</span><b>{device.storage_percent ?? 0}%</b><i><em style={{ width: `${device.storage_percent ?? 0}%` }}/></i></div></div>
      <div className="device-details"><span><Wifi size={15}/>{device.network_type || "Unknown"}</span><span><Signal size={15}/>{device.signal_percent ?? 0}%</span><span><Clock3 size={15}/>{relativeTime(device.last_seen_at)}</span></div>
      <button type="button" disabled={device.status === "offline" || Boolean(requestingId)} onClick={() => requestFromDeviceList(device)} className={`btn ${device.status === "offline" ? "btn-disabled" : "btn-primary"}`}>{device.status === "offline" ? "Device offline" : requestingId === device.id ? "Sending request…" : "Request support session"}<ArrowRight size={16}/></button>
    </article>)}</div> : !loading ? <EmptyState title="No devices found" text={devices.length ? "No device matches this filter." : "Install AirLink on an Android phone and sign in. It will appear here automatically."}/> : null}
  </>;
}

export function RemoteControlPage() {
  const { id } = useParams();
  const { workspace, user } = useAuth();
  const [device, setDevice] = useState(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [orientation, setOrientation] = useState("portrait");
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("info");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace?.id || !id) return;
    Promise.all([getDevice(workspace.id, id), getOpenSessionForDevice(workspace.id, id)])
      .then(([deviceRow, openSession]) => {
        setDevice(deviceRow);
        setSession(openSession);
      })
      .catch((loadError) => setError(loadError.message));
  }, [id, workspace?.id]);

  useEffect(() => {
    if (!session?.id) return undefined;
    let unsubscribe = () => {};
    let cancelled = false;

    const refreshRelated = () => {
      listSessionEvents(session.id).then(setEvents).catch(() => {});
      listSessionMessages(session.id).then(setMessages).catch(() => {});
      getSession(session.id)
        .then((nextSession) => {
          if (!cancelled && nextSession) setSession(nextSession);
        })
        .catch(() => {});
    };

    refreshRelated();
    subscribeToSession(session.id, {
      onChanged: refreshRelated,
      onMessage: refreshRelated,
      onError: (socketError) => setError(socketError.message),
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unsubscribe = cleanup;
    }).catch((socketError) => setError(socketError.message));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session?.id, workspace?.id, id]);

  useEffect(() => {
    if (!session?.id) return undefined;
    const timer = window.setInterval(() => {
      getSession(session.id)
        .then((nextSession) => nextSession && setSession(nextSession))
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [session?.id]);

  const notify = (text) => {
    setToast(text);
    window.clearTimeout(window.__airlinkToast);
    window.__airlinkToast = window.setTimeout(() => setToast(""), 2200);
  };

  const requestSession = async () => {
    setBusy(true);
    setError("");
    try {
      const sessionId = await requestRemoteSession(id);
      const rows = await listSessions(workspace.id, 50);
      setSession(rows.find((row) => row.id === sessionId) || { id: sessionId, device_id: id, status: "requested", created_at: new Date().toISOString() });
      notify("Support request sent to device");
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setBusy(false);
    }
  };

  const finishSession = async () => {
    if (!session?.id) return;
    setBusy(true);
    try {
      await endRemoteSession(session.id);
      setSession((current) => ({ ...current, status: "terminated", ended_at: new Date().toISOString() }));
      notify("Session ended");
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const body = message.trim();
    if (!body || !session?.id) return;
    setMessage("");
    try {
      await sendSessionMessage(session.id, body);
      setMessages(await listSessionMessages(session.id));
    } catch (messageError) {
      setError(messageError.message);
    }
  };

  const sendNavigation = async (type) => {
    if (!session?.id || session.status !== "active" || session.approved_permissions?.remote_input !== true) return;
    try {
      await sendRemoteInput(session.id, { type });
    } catch (controlError) {
      setError(controlError.message);
    }
  };

  if (!device) return <div className="app-loader inline-loader"><span className="loader-ring"/><p>{error || "Loading device…"}</p></div>;

  const status = session?.status || "not_requested";
  const active = status === "active";
  const approved = status === "approved";
  const terminal = ["completed", "declined", "terminated"].includes(status);

  return <div className="control-layout"><section className="control-stage"><div className="session-bar"><div><span className={`live-dot ${active ? "" : "paused"}`}/><b>{active ? "Remote session active" : status === "requested" ? "Waiting for device approval" : approved ? "Device approved" : terminal ? `Session ${normalizedStatus(status).toLowerCase()}` : "No active session"}</b><small>{active || approved ? "Consent recorded" : "Remote input stays disabled until approval"} · {device.owner_label || device.name}</small></div><div><span><Signal size={15}/> {device.signal_percent ?? 0}%</span><span><Zap size={15}/> Realtime</span>{(!session || terminal) && <button disabled={busy || device.status === "offline"} onClick={requestSession}><Play size={16}/> Request</button>}{status === "requested" && <button disabled={busy} onClick={finishSession}><Power size={16}/> Cancel</button>}{(approved || active) && <button className="end-session" disabled={busy} onClick={finishSession}><Power size={16}/> Terminate</button>}</div></div>{error && <div className="control-error">{error}</div>}<div className={`remote-canvas orientation-${orientation} ${active ? "" : "canvas-paused"}`}><div className="canvas-grid"/>{approved || active ? <RemoteScreenStream sessionId={session.id} localUserId={user?.id} controlEnabled={active && session.approved_permissions?.remote_input === true} onError={(streamError) => setError(streamError.message)} /> : <div className="pause-overlay"><LockKeyhole size={30}/><b>{status === "requested" ? "Approval required" : approved ? "Connecting automatically" : device.status === "offline" ? "Device offline" : "Request a support session"}</b><span>{status === "requested" ? "The Android owner must approve this request on-device." : approved ? "Consent is recorded. AirLink is activating the session automatically." : "The WebRTC stream will attach here after Android integration."}</span>{(!session || terminal) && device.status !== "offline" && <button className="btn btn-primary btn-small" disabled={busy} onClick={requestSession}>Request access</button>}</div>}</div><div className="control-dock"><button disabled={!active} onClick={() => notify("Screenshot command queued for WebRTC integration")}><Camera size={19}/><span>Screenshot</span></button><button disabled={!active} onClick={() => setOrientation(orientation === "portrait" ? "landscape" : "portrait")}><RotateCw size={19}/><span>Rotate</span></button><button disabled={!active} onClick={() => document.getElementById("airlink-live-screen")?.requestFullscreen?.()}><Fullscreen size={19}/><span>Fullscreen</span></button><button disabled={!active} onClick={() => setMuted(!muted)}>{muted ? <MicOff size={19}/> : <Mic size={19}/>}<span>{muted ? "Unmute" : "Audio"}</span></button><button disabled={!active || session?.approved_permissions?.remote_input !== true} onClick={() => sendNavigation("back")}><ArrowLeft size={19}/><span>Back</span></button><button disabled={!active || session?.approved_permissions?.remote_input !== true} onClick={() => sendNavigation("home")}><House size={19}/><span>Home</span></button><button disabled={!active || session?.approved_permissions?.remote_input !== true} onClick={() => sendNavigation("recents")}><PanelsTopLeft size={19}/><span>Recents</span></button></div></section><aside className="control-sidebar"><div className="control-tabs"><button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>Device</button><button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>Chat</button><button className={tab === "events" ? "active" : ""} onClick={() => setTab("events")}>Events</button></div>{tab === "info" && <div className="control-side-content"><div className="device-identity"><DeviceIcon status={device.status}/><div><h3>{device.name}</h3><p>{formatPlatform(device)}</p></div></div>{["approved", "active", "completed", "terminated"].includes(status) ? <div className="consent-box"><UserRoundCheck size={20}/><span><b>Owner consent recorded</b><small>{dateTime(session?.approved_at)}</small></span></div> : <div className="danger-note"><LockKeyhole size={18}/><span>Consent has not been granted for this session.</span></div>}<dl className="info-list"><div><dt>Battery</dt><dd><BatteryCharging size={15}/>{device.battery_percent ?? 0}%</dd></div><div><dt>Network</dt><dd><Wifi size={15}/>{device.network_type || "Unknown"}</dd></div><div><dt>Location label</dt><dd>{device.location_label || "Not shared"}</dd></div><div><dt>Last seen</dt><dd>{relativeTime(device.last_seen_at)}</dd></div><div><dt>Session ID</dt><dd>{session?.id ? `#${session.id.slice(0, 8)}` : "—"}</dd></div></dl><div className="permission-list"><h4>Requested permissions</h4><span><Check/> Screen viewing</span><span><Check/> Remote gestures</span>{session?.requested_permissions?.keyboard ? <span><Check/> Keyboard input</span> : null}{session?.requested_permissions?.file_exchange ? <span><Check/> File exchange</span> : null}</div><div className="danger-note"><AlertTriangle size={18}/><span>The Android owner can decline or disconnect at any time.</span></div></div>}{tab === "chat" && <div className="chat-panel"><div className="chat-messages">{messages.length ? messages.map((item) => <div key={item.id} className={item.sender_user_id === user?.id ? "chat-sent" : "chat-received"}>{item.body}<small>{dateTime(item.created_at)}</small></div>) : <span className="chat-time">Messages are stored with the consented session.</span>}</div><div className="chat-input"><input disabled={!session?.id} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Write a message..."/><button disabled={!session?.id} onClick={sendMessage}><Send size={17}/></button></div></div>}{tab === "events" && <div className="event-list">{events.length ? events.map((event) => <div key={event.id}><i/><span><b>{event.event_type.replaceAll("_", " ")}</b><small>{dateTime(event.created_at)}</small></span></div>) : <div className="event-empty">Session events will appear here.</div>}</div>}</aside>{toast && <div className="toast"><Check size={17}/>{toast}</div>}</div>;
}

function VideoBadge() {
  return <div className="video-badge"><MonitorSmartphone size={14}/> WebRTC stream slot</div>;
}

export function FilesPage() {
  const inputRef = useRef(null);
  const { workspace } = useAuth();
  const [files, setFiles] = useState([]);
  const [devices, setDevices] = useState([]);
  const [targetDevice, setTargetDevice] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!workspace?.id) return;
    try {
      const [transferRows, deviceRows] = await Promise.all([listFileTransfers(workspace.id), listDevices(workspace.id)]);
      setFiles(transferRows);
      setDevices(deviceRows);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const addFile = async (file) => {
    if (!file || !workspace?.id) return;
    if (file.size > 100 * 1024 * 1024) {
      setError("Maximum file size is 100 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await uploadWorkspaceFile({ workspaceId: workspace.id, deviceId: targetDevice || null, file });
      await load();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (file) => {
    try {
      await deleteWorkspaceFile(file);
      setFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return <>{error && <div className="inline-error">{error}</div>}<div className="file-target-row"><label>Send to<select value={targetDevice} onChange={(event) => setTargetDevice(event.target.value)}><option value="">Workspace storage only</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label><span>Node.js API → private Supabase Storage · RLS protected</span></div><div className="file-top-grid"><section className={`upload-panel ${drag ? "drag-active" : ""} ${busy ? "upload-busy" : ""}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); addFile(event.dataTransfer.files[0]); }} onClick={() => !busy && inputRef.current?.click()}><input ref={inputRef} type="file" hidden onChange={(event) => addFile(event.target.files[0])}/><span><UploadCloud size={29}/></span><h3>{busy ? "Uploading securely…" : "Drop a file to send"}</h3><p>or click to browse from your computer</p><small>Maximum size: 100 MB</small></section><section className="storage-card"><div className="panel-head"><div><h3>Backend storage</h3><p>Supabase private bucket</p></div><HardDrive size={21}/></div><div className="storage-ring"><span><b>{files.length}</b><small>records</small></span></div><div className="storage-legend"><span><i/>Stored metadata <b>{files.length}</b></span><span><i/>Registered devices <b>{devices.length}</b></span><span><i/>Access <b>Private</b></span></div></section></div><section className="panel file-list-panel"><div className="panel-head"><div><h3>Recent transfers</h3><p>Files stored and tracked across your workspace</p></div><div className="file-actions"><button onClick={load}><RefreshCw size={16}/> Refresh</button><button><Filter size={16}/> RLS protected</button></div></div>{files.length ? <div className="file-table"><div className="file-table-head"><span>Name</span><span>Direction</span><span>Size</span><span>Time</span><span/></div>{files.map((file) => <div className="file-table-row" key={file.id}><span className="file-name"><i><File size={18}/></i><b>{file.original_name}</b><small>{file.mime_type || "FILE"}</small></span><span className="direction-cell">{file.direction === "web_to_device" ? <ArrowUpFromLine size={15}/> : <ArrowDownToLine size={15}/>} {file.device?.name || (file.direction === "web_to_device" ? "Workspace" : "Browser")}</span><span>{Math.max(0.1, (file.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB</span><span>{relativeTime(file.created_at)}</span><span><button title="Download" onClick={() => downloadWorkspaceFile(file)}><Download size={16}/></button><button title="Delete" onClick={() => removeFile(file)}><Trash2 size={16}/></button></span></div>)}</div> : <EmptyState title="No file transfers" text="Upload a support file to create the first storage record."/>}</section></>;
}

export function SessionsPage() {
  const { workspace } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    if (!workspace?.id) return;
    try {
      setSessions(await listSessions(workspace.id, 250));
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const active = sessions.filter((session) => session.status === "active").length;
  const approved = sessions.filter((session) => Boolean(session.approved_at)).length;
  const interrupted = sessions.filter((session) => ["declined", "terminated"].includes(session.status)).length;
  const consentRate = sessions.length ? Math.round((approved / sessions.length) * 100) : 100;

  const exportCsv = () => {
    const rows = [
      ["Device", "Operator", "Started", "Status", "End reason"],
      ...sessions.map((session) => [session.device?.name || "Device", session.operator?.full_name || "Operator", session.created_at, session.status, session.end_reason || ""]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "airlink-session-audit.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <>{error && <div className="inline-error">{error}</div>}<div className="stats-grid session-stats"><StatCard icon={Activity} label="Total sessions" value={String(sessions.length).padStart(2, "0")} note={`${active} active now`}/><StatCard icon={Clock3} label="Database" value="Live" note="Supabase records"/><StatCard icon={UserRoundCheck} label="Consent rate" value={`${consentRate}%`} note="Approvals audited"/><StatCard icon={AlertTriangle} label="Interrupted" value={String(interrupted).padStart(2, "0")} note="Declined or terminated" trend={interrupted ? "down" : undefined}/></div><section className="panel session-panel"><div className="panel-head"><div><h3>Remote session history</h3><p>Operator, device and consent activity</p></div><button className="outline-button" onClick={exportCsv}><Download size={16}/> Export report</button></div>{sessions.length ? <div className="session-table"><div className="session-row session-head"><span>Device</span><span>Operator</span><span>Started</span><span>Duration</span><span>Status</span><span/></div>{sessions.map((session) => <div className="session-row" key={session.id}><span className="session-device"><DeviceIcon status={session.status === "active" ? "online" : "idle"}/><b>{session.device?.name || "Unknown device"}</b></span><span>{session.operator?.full_name || "Workspace operator"}</span><span>{dateTime(session.created_at)}</span><span>{durationText(session)}</span><span><em className={`session-status ${session.status}`}>{normalizedStatus(session.status)}</em></span><span><Link to={`/app/control/${session.device_id}`}><MoreHorizontal size={18}/></Link></span></div>)}</div> : <EmptyState title="No sessions yet" text="Approved support requests and session lifecycle events will appear here."/>}</section><section className="audit-note"><ShieldCheck size={24}/><div><h3>Consent audit is database-backed</h3><p>Requests, approvals, starts, disconnects and device responses are recorded as immutable session events.</p></div><button onClick={load}>Refresh <RefreshCw size={16}/></button></section></>;
}

function Toggle({ enabled, onChange, disabled = false }) {
  return <button disabled={disabled} className={`toggle ${enabled ? "toggle-on" : ""}`} onClick={() => onChange(!enabled)}><span/></button>;
}

export function SettingsPage() {
  const { workspace } = useAuth();
  const [settings, setSettings] = useState({ explicit_consent: true, idle_lock_minutes: 5, allow_clipboard: false, allow_recording: false, connection_notifications: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = ["owner", "admin"].includes(workspace?.membershipRole);

  useEffect(() => {
    if (!workspace?.id) return;
    getWorkspaceSettings(workspace.id).then((data) => data && setSettings(data)).catch((loadError) => setError(loadError.message));
  }, [workspace?.id]);

  const update = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (!workspace?.id || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      const saved = await updateWorkspaceSettings(workspace.id, { [key]: value });
      setSettings(saved);
    } catch (saveError) {
      setError(saveError.message);
      setSettings(settings);
    } finally {
      setBusy(false);
    }
  };

  return <div className="settings-layout"><aside className="settings-nav"><button className="active"><Settings size={17}/> General</button><button><ShieldCheck size={17}/> Security</button><button><Bell size={17}/> Notifications</button><button><UserRoundCheck size={17}/> Team members</button><button><Laptop2 size={17}/> Remote sessions</button></aside><div className="settings-content">{error && <div className="inline-error">{error}</div>}{!canEdit && <div className="backend-note">Your role is <b>{workspace?.membershipRole || "member"}</b>. Only workspace owners and admins can change shared settings.</div>}<section className="settings-card"><div className="settings-title"><span><ShieldCheck size={22}/></span><div><h3>Security and consent</h3><p>These values are stored in <code>workspace_settings</code> and protected by RLS.</p></div></div><div className="setting-row"><div><b>Explicit device consent</b><p>Every new support session must be approved on the Android device. This cannot be disabled.</p></div><span className="always-on-badge"><ShieldCheck size={14}/> Always on</span></div><div className="setting-row"><div><b>Auto-lock idle sessions</b><p>Pause input after the configured inactivity window.</p></div><select disabled={!canEdit || busy} value={settings.idle_lock_minutes} onChange={(event) => update("idle_lock_minutes", Number(event.target.value))}><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option></select></div></section><section className="settings-card"><div className="settings-title"><span><Laptop2 size={22}/></span><div><h3>Remote session defaults</h3><p>Choose which optional tools can be requested during consented support.</p></div></div><div className="setting-row"><div><b>Clipboard synchronization</b><p>Allow clipboard permission to be requested from the Android owner.</p></div><Toggle disabled={!canEdit || busy} enabled={settings.allow_clipboard} onChange={(value) => update("allow_clipboard", value)}/></div><div className="setting-row"><div><b>Session recording</b><p>Recording remains off unless the Android owner separately approves capture.</p></div><Toggle disabled={!canEdit || busy} enabled={settings.allow_recording} onChange={(value) => update("allow_recording", value)}/></div><div className="setting-row"><div><b>Connection notifications</b><p>Enable backend notification hooks for session start and end events.</p></div><Toggle disabled={!canEdit || busy} enabled={settings.connection_notifications} onChange={(value) => update("connection_notifications", value)}/></div></section><section className="settings-card danger-card"><div><h3>Backend ready</h3><p>Node.js API, Supabase Auth/database/RLS/private storage and Socket.IO signaling are wired. Live screen/input still requires the Android WebRTC client.</p></div><ShieldCheck size={28}/></section></div></div>;
}
