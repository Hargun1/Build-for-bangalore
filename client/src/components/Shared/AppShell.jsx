import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Activity, ArrowRight, Bell, CalendarDays, ChevronRight, CircleUserRound, HeartPulse, LayoutDashboard, Menu, MessageCircle, Search, Settings2, ShieldAlert, Target, Utensils, Wind, FileText, Accessibility, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Modal from "./Modal";
import "../../styles/ui.css";

const GROUPS = [
  { label: "Your health", links: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/glass-body", label: "Body explorer", icon: Accessibility },
    { to: "/labs", label: "Lab reports", icon: FileText },
    { to: "/wearable", label: "Vitals", icon: Activity },
  ] },
  { label: "Every day", links: [
    { to: "/grocery", label: "Food & nutrition", icon: Utensils },
    { to: "/goals", label: "Goals", icon: Target },
    { to: "/reminders", label: "Reminders", icon: Bell },
    { to: "/exposome", label: "Environment", icon: Wind },
  ] },
  { label: "Care", links: [
    { to: "/chat", label: "Health chat", icon: MessageCircle },
    { to: "/appointments", label: "Doctors & visits", icon: CalendarDays },
    { to: "/emergency", label: "Emergency", icon: ShieldAlert },
  ] },
];
const LINKS = [...GROUPS.flatMap((g) => g.links), { to: "/profile", label: "Profile & settings", icon: Settings2 }];
const MOBILE = [LINKS[0], LINKS[4], LINKS[2], LINKS[8]];

export function Brand() {
  return <Link to="/dashboard" className="ui-brand"><span className="ui-brand-mark"><HeartPulse aria-hidden="true" /></span>Pranexus<span className="ui-faint">AI</span></Link>;
}

export default function AppShell({ title, subtitle, actions, children, className = "" }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const sidebar = useRef(null);
  const current = LINKS.find((l) => l.to === pathname);
  useEffect(() => { setMenu(false); setSearch(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current.querySelector("button").focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const items = [...sidebar.current.querySelectorAll("a, button")].filter((el) => el.getClientRects().length);
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
      if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [menu]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setSearch((s) => !s); }
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const results = LINKS.filter((l) => l.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className={`ui-page app-layout ${className}`}>
      <a href="#main-content" className="ui-skip">Skip to content</a>
      {menu && <button className="app-menu-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}
      <aside ref={sidebar} className={`app-sidebar ${menu ? "open" : ""}`} aria-label="App navigation">
        <button className="ui-btn ui-btn-ghost ui-icon-btn app-menu-close" aria-label="Close menu" onClick={() => setMenu(false)}><X /></button>
        <Brand />
        <nav className="app-nav" aria-label="Main">
          {GROUPS.map((group) => <div className="app-nav-group" key={group.label}>
            <div className="app-nav-label">{group.label}</div>
            {group.links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon aria-hidden="true" />{label}</NavLink>)}
          </div>)}
        </nav>
        <Link className="app-account" to="/profile">
          <span className="app-avatar">{user?.isGuest ? <CircleUserRound /> : user?.name?.[0]?.toUpperCase() || "P"}</span>
          <span className="app-account-text"><strong>{user?.isGuest ? "Guest account" : user?.name || "Your account"}</strong><small>Profile & settings</small></span><Settings2 size={16} />
        </Link>
      </aside>
      <div className="app-workspace" inert={menu ? "" : undefined}>
        <header className="app-topbar">
          <div className="app-breadcrumb"><button className="ui-btn ui-btn-ghost ui-icon-btn app-menu-button" onClick={() => setMenu(true)} title="Open navigation" aria-label="Open navigation" aria-expanded={menu}><Menu /></button><span>My health</span><ChevronRight size={14} /><span>{current?.label || title}</span></div>
          <div className="app-topbar-actions">
            <span className="app-date">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
            <button className="ui-btn ui-btn-ghost app-search-button" title="Find a page" aria-label="Find a page" onClick={() => { setQuery(""); setSearch(true); }}><Search /><span>Find a page</span></button>
            <Link to="/reminders" className="ui-btn ui-btn-ghost ui-icon-btn" title="Reminders" aria-label="Reminders"><Bell /></Link>
          </div>
        </header>
        <main id="main-content" className="ui-container app-main">
          {(title || actions) && <div className="ui-header"><div>{title && <h1>{title}</h1>}{subtitle && <p>{subtitle}</p>}</div><div className="ui-spacer" />{actions}</div>}
          {user?.isGuest && <div className="app-guest"><CircleUserRound size={15} /><span>Guest session <span className="app-guest-mobile">(24 hours)</span></span><span className="app-guest-description">Your access expires after 24 hours.</span><Link to="/register">Create an account <ArrowRight size={12} style={{ verticalAlign: "middle" }} /></Link></div>}
          {children}
        </main>
      </div>
      <nav className="app-mobile-nav" aria-label="Quick navigation">{MOBILE.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon />{label === "Food & nutrition" ? "Food" : label === "Lab reports" ? "Reports" : label === "Health chat" ? "Chat" : label}</NavLink>)}<button onClick={() => setMenu((m) => !m)} aria-label={menu ? "Close navigation" : "More pages"} aria-expanded={menu}>{menu ? <X /> : <Menu />}More</button></nav>
      <Modal open={search} title="Go to" onClose={() => setSearch(false)}>
        <input className="ui-input" aria-label="Search pages" placeholder="Search pages..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="app-search-results">{results.map(({ to, label, icon: Icon }) => <Link to={to} key={to} onClick={() => setSearch(false)}><Icon />{label}<ArrowRight /></Link>)}{!results.length && <p className="ui-empty">No matching pages.</p>}</div>
      </Modal>
    </div>
  );
}
