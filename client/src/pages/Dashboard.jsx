import { Link } from "react-router-dom";
import { ArrowUpRight, Accessibility, FilePlus2, Utensils, CalendarDays } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/Shared/AppShell";
import HealthOverview from "../components/Dashboard/HealthOverview";
import DashboardAgenda from "../components/Dashboard/DashboardAgenda";
import "./Dashboard.css";

const ACTIONS = [
  { to: "/grocery?tab=meal", label: "Log a meal", detail: "Food & nutrition", icon: Utensils, tone: "mint" },
  { to: "/labs", label: "Add a report", detail: "Lab results", icon: FilePlus2, tone: "blue" },
  { to: "/glass-body", label: "Explore your body", detail: "Your health in context", icon: Accessibility, tone: "rose" },
  { to: "/appointments", label: "Plan a doctor visit", detail: "Find care nearby", icon: CalendarDays, tone: "gold" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return <AppShell className="dashboard-page" title={`${greeting}${user?.isGuest ? "" : `, ${user?.name?.split(" ")[0] || "there"}`}.`} subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}>
    <div className="dashboard-layout">
      <div className="dashboard-primary">
        <nav className="dashboard-actions" aria-label="Quick actions">{ACTIONS.map(({ to, label, detail, icon: Icon, tone }) => <Link to={to} key={to} className="dashboard-action"><span className={`dashboard-action-icon ${tone}`}><Icon /></span><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight /></Link>)}</nav>
        <HealthOverview />
      </div>
      <DashboardAgenda />
    </div>
  </AppShell>;
}
