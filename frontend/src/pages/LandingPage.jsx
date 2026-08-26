import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CirclePlay,
  CloudCog,
  FileUp,
  Headphones,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  MousePointer2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";
import PhoneMockup from "../components/PhoneMockup";
import Reveal from "../components/Reveal";

const features = [
  { icon: MonitorSmartphone, title: "Live screen access", text: "View a permission-approved Android screen in your browser with a clean low-latency workspace." },
  { icon: MousePointer2, title: "Remote assistance", text: "Send taps and swipes only while the device owner has approved remote input for the active support session." },
  { icon: FileUp, title: "Secure file transfer", text: "Share screenshots, reports and support files with clear direction, progress and audit history." },
  { icon: CloudCog, title: "Multi-device workspace", text: "Organize online, idle and offline devices from one responsive support dashboard." },
  { icon: Smartphone, title: "Automatic device enrollment", text: "Sign in on Android and the phone appears in the support dashboard automatically — no pairing code to type." },
  { icon: ShieldCheck, title: "Consent-first security", text: "Persistent device notifications, session logs and one-tap disconnect keep every connection transparent." },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-page">
      <nav className={`landing-nav ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="container nav-inner">
          <Brand />
          <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
          </div>
          <div className="nav-actions">
            <Link className="text-link" to="/login">Sign in</Link>
            <Link className="btn btn-primary btn-small" to="/register">Get started <ArrowRight size={16} /></Link>
            <button className="icon-btn mobile-nav-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </nav>

      <header className="hero-section">
        <div className="hero-grid-bg" />
        <div className="hero-orb orb-a" /><div className="hero-orb orb-b" />
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={15} /> Consent-first Android support</div>
            <h1>Help any Android device from <span>one beautiful dashboard.</span></h1>
            <p>AirLink gives support teams a secure web workspace for screen viewing, approved remote assistance, device health and file transfer.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-large" to="/register">Create workspace <ArrowRight size={19} /></Link>
              <Link className="btn btn-ghost btn-large" to="/app/overview"><CirclePlay size={19} /> View dashboard</Link>
            </div>
            <div className="hero-trust">
              <span><Check size={15} /> No hidden access</span>
              <span><Check size={15} /> Responsive React UI</span>
              <span><Check size={15} /> Explicit consent</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="dashboard-preview-card">
              <div className="preview-topbar"><span /><span /><span /><b>airlink.app</b></div>
              <div className="preview-body">
                <div className="preview-sidebar"><i /><i /><i /><i /><i /></div>
                <div className="preview-main">
                  <div className="preview-welcome"><div><small>Good morning</small><strong>Device workspace</strong></div><span className="preview-online"><i /> 3 online</span></div>
                  <div className="preview-stats"><span><small>Devices</small><b>04</b></span><span><small>Active</small><b>01</b></span><span><small>Uptime</small><b>99.9%</b></span></div>
                  <div className="preview-device-row">
                    <div><i className="device-mini-icon" /><span><b>Pixel 8 Pro</b><small>Android 15 · Online</small></span></div>
                    <button>Connect</button>
                  </div>
                  <div className="preview-chart"><span style={{ height: "38%" }} /><span style={{ height: "64%" }} /><span style={{ height: "48%" }} /><span style={{ height: "78%" }} /><span style={{ height: "57%" }} /><span style={{ height: "90%" }} /><span style={{ height: "72%" }} /></div>
                </div>
              </div>
            </div>
            <PhoneMockup />
            <div className="floating-card floating-security"><ShieldCheck size={20} /><span><b>Consent verified</b><small>Session protected</small></span></div>
            <div className="floating-card floating-latency"><Zap size={18} /><span><b>42 ms</b><small>Live latency</small></span></div>
          </div>
        </div>
      </header>

      <section className="logo-strip">
        <div className="container"><p>Designed for modern support teams</p><div className="logo-cloud"><span>NOVA</span><span>ORBIT</span><span>STACKLAB</span><span>NEXUS</span><span>VANTAGE</span></div></div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <Reveal className="section-heading"><span className="section-kicker">Everything in one place</span><h2>Support tools that feel effortless.</h2><p>From first sign-in to final audit log, every screen is designed for clarity, speed and transparent control.</p></Reveal>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} className="feature-card" delay={index * 70}>
                <div className="feature-icon"><Icon size={23} /></div><h3>{title}</h3><p>{text}</p><span className="feature-link">Explore <ChevronRight size={15} /></span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="container workflow-layout">
          <Reveal className="workflow-copy">
            <span className="section-kicker">Simple setup</span><h2>Connected in three transparent steps.</h2><p>The phone registers automatically after sign-in, while every remote support session still begins only after visible on-device approval.</p>
            <div className="step-list">
              <div><span>01</span><section><h3>Sign in on the Android client</h3><p>The phone registers automatically in the configured support workspace. No pairing code is shown or entered.</p></section></div>
              <div><span>02</span><section><h3>Operator requests support</h3><p>The registered phone is visible in the web dashboard, where the operator can send a support request.</p></section></div>
              <div><span>03</span><section><h3>Owner approves the session</h3><p>The phone displays Accept / Decline, and remote assistance starts only after approval.</p></section></div>
            </div>
            <Link to="/register" className="btn btn-primary">Open dashboard <ArrowRight size={17} /></Link>
          </Reveal>
          <Reveal className="workflow-visual" delay={120}>
            <div className="pairing-card">
              <div className="pairing-head"><span className="pairing-icon"><Smartphone size={21} /></span><span><b>Android phone registered</b><small>Automatic after account sign-in</small></span></div>
              <div className="pin-inputs"><span>✓</span><span>A</span><span>U</span><span>T</span><span>O</span><span>✓</span></div>
              <button className="btn btn-primary full-width">Request support session</button>
              <div className="pairing-status"><i /><span><b>Waiting for owner approval</b><small>Accept / Decline appears on the phone</small></span></div>
            </div>
            <div className="connection-line"><i /><i /><i /></div>
            <div className="permission-card"><LockKeyhole size={21} /><span><b>Permission request</b><small>Ali Support wants to view your screen</small></span><div><button>Decline</button><button>Approve</button></div></div>
          </Reveal>
        </div>
      </section>

      <section className="section security-section" id="security">
        <div className="container security-layout">
          <Reveal className="security-visual">
            <div className="shield-core"><ShieldCheck size={74} /><span className="shield-ring ring-one" /><span className="shield-ring ring-two" /></div>
            <div className="security-chip chip-one"><LockKeyhole size={17} /> Encrypted transport</div>
            <div className="security-chip chip-two"><Smartphone size={17} /> Automatic enrollment</div>
            <div className="security-chip chip-three"><MonitorSmartphone size={17} /> Visible session</div>
          </Reveal>
          <Reveal className="security-copy" delay={100}>
            <span className="section-kicker">Security by design</span><h2>Remote support without hidden access.</h2><p>AirLink’s UI is intentionally designed around explicit consent, clear session indicators and accountable operator activity.</p>
            <ul className="check-list"><li><Check size={17} /> Device owner approval before screen access</li><li><Check size={17} /> Persistent foreground session notification</li><li><Check size={17} /> One-tap disconnect from either side</li><li><Check size={17} /> Operator and session audit history</li></ul>
            <Link to="/app/sessions" className="text-cta">See session auditing <ArrowRight size={17} /></Link>
          </Reveal>
        </div>
      </section>

      <section className="cta-section"><div className="container"><Reveal className="cta-card"><div><span className="section-kicker">Ready to explore?</span><h2>Your remote support workspace is ready.</h2><p>Open the interactive dashboard and connect it to your Android client and backend APIs.</p></div><div className="cta-actions"><Link to="/app/overview" className="btn btn-primary btn-large">View live UI <ArrowRight size={18}/></Link><span><Headphones size={16}/> Support-ready design</span></div></Reveal></div></section>

      <footer className="site-footer"><div className="container footer-grid"><div><Brand /><p>Consent-first Android remote support for modern teams.</p></div><div><b>Product</b><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a></div><div><b>Resources</b><a href="#workflow">Setup guide</a><Link to="/app/overview">Dashboard</Link><a href="mailto:help@example.com">Support</a></div><div><b>Legal</b><a href="#security">Privacy</a><a href="#security">Terms</a><a href="#security">Responsible use</a></div></div><div className="container footer-bottom"><span>© 2026 AirLink.</span><span>Built with React · Supabase · explicit consent</span></div></footer>
    </div>
  );
}
