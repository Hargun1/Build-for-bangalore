import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bell, CalendarDays, FileText, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAppointments, getLabReports } from "../../services/healthService";
import { getReminders } from "../../services/pushClient";

function AgendaSection({ title, to, icon: Icon, children }) {
  return <section className="agenda-section">
    <div className="agenda-heading"><h3><Icon />{title}</h3><Link to={to} title={`Open ${title.toLowerCase()}`} aria-label={`Open ${title.toLowerCase()}`}><ArrowUpRight /></Link></div>
    {children}
  </section>;
}

function Status({ state, empty }) {
  return <p className="agenda-empty" role={state === "error" ? "alert" : undefined}>{state === "loading" ? "Loading..." : state === "error" ? "Could not load this section." : empty}</p>;
}

export default function DashboardAgenda() {
  const { user } = useAuth();
  const [sections, setSections] = useState(null);
  useEffect(() => {
    let active = true;
    setSections(null);
    Promise.allSettled([getReminders(), getAppointments(), getLabReports()]).then((results) => {
      if (active) setSections(results.map((result) => result.status === "fulfilled" ? { state: "ready", data: result.value.data } : { state: "error" }));
    });
    return () => { active = false; };
  }, [user?.id]);
  const [reminderSection, visitSection, reportSection] = sections || [{ state: "loading" }, { state: "loading" }, { state: "loading" }];
  const reminders = (reminderSection.data || []).filter((r) => r.enabled).slice(0, 3);
  const visits = (visitSection.data?.upcoming || []).slice(0, 2);
  const reports = (reportSection.data || []).slice(0, 2);
  return <aside className="dashboard-agenda" aria-label="Your care and schedule">
    <div className="agenda-title"><span className="agenda-eyebrow">YOUR CARE</span><h2>A little planning ahead.</h2></div>
    <AgendaSection title="Reminders" to="/reminders" icon={Bell}>
      {reminders.length ? <ul className="agenda-list">{reminders.map((r) => <li key={r._id}><Link to="/reminders"><span className="agenda-marker mint"><Bell /></span><span><strong>{r.title}</strong><small>{r.times.join(" / ")} IST</small></span></Link></li>)}</ul> : <Status state={reminderSection.state} empty="No active reminders." />}
      <Link className="agenda-add" to="/reminders"><Plus />Add a reminder</Link>
    </AgendaSection>
    <AgendaSection title="Upcoming visits" to="/appointments" icon={CalendarDays}>
      {visits.length ? <ul className="agenda-list">{visits.map((v) => <li key={v._id}><Link to="/appointments"><span className="agenda-marker lilac"><CalendarDays /></span><span><strong>{v.place.name}</strong><small>{new Date(v.startsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST</small>{v.specialty && <small>{v.specialty}</small>}</span></Link></li>)}</ul> : <Status state={visitSection.state} empty="No upcoming visits." />}
      <Link className="agenda-add" to="/appointments"><Plus />Plan a visit</Link>
    </AgendaSection>
    <AgendaSection title="Recent reports" to="/labs" icon={FileText}>
      {reports.length ? <ul className="agenda-list">{reports.map((r) => <li key={r._id}><Link to="/labs"><span className="agenda-marker peach"><FileText /></span><span><strong>{r.labName || "Lab report"}</strong><small>{new Date(`${r.reportDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></span></Link></li>)}</ul> : <Status state={reportSection.state} empty="No reports uploaded yet." />}
      <Link className="agenda-add" to="/labs"><Plus />Add a report</Link>
    </AgendaSection>
    <Link className="agenda-profile" to="/profile"><span>Profile & health details</span><ArrowUpRight /></Link>
  </aside>;
}
