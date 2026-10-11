import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/Shared/ProtectedRoute";
import Landing from "./pages/Landing";

// Each page is its own chunk: the 3D body viewer and charts only load when visited.
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const GlassBody = lazy(() => import("./pages/GlassBody"));
const Exposome = lazy(() => import("./pages/Exposome"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Grocery = lazy(() => import("./pages/Grocery"));
const GoalPlanner = lazy(() => import("./pages/GoalPlanner"));
const Wearable = lazy(() => import("./pages/Wearable"));
const Emergency = lazy(() => import("./pages/Emergency"));
const HealthChat = lazy(() => import("./pages/HealthChat"));
const Labs = lazy(() => import("./pages/Labs"));
const Reminders = lazy(() => import("./pages/Reminders"));

function PageLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#080a0f", color: "#9aa3b5" }}>
      <span>Loading…</span>
    </div>
  );
}

const guard = (el) => <ProtectedRoute>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/dashboard" element={guard(<Dashboard />)} />
        <Route path="/profile" element={guard(<Profile />)} />
        <Route path="/glass-body" element={guard(<GlassBody />)} />
        <Route path="/exposome" element={guard(<Exposome />)} />
        <Route path="/appointments" element={guard(<Appointments />)} />
        <Route path="/grocery" element={guard(<Grocery />)} />
        <Route path="/goals" element={guard(<GoalPlanner />)} />
        <Route path="/wearable" element={guard(<Wearable />)} />
        <Route path="/emergency" element={guard(<Emergency />)} />
        <Route path="/chat" element={guard(<HealthChat />)} />
        <Route path="/labs" element={guard(<Labs />)} />
        <Route path="/reminders" element={guard(<Reminders />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
