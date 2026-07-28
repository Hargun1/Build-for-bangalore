import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import GlassBody from "./pages/GlassBody";
import Exposome from "./pages/Exposome";
import Appointments from "./pages/Appointments";
import Grocery from "./pages/Grocery";
import GoalPlanner from "./pages/GoalPlanner";
import Wearable from "./pages/Wearable";
import Emergency from "./pages/Emergency";
import HealthChat from "./pages/HealthChat";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/glass-body" element={<GlassBody />} />
      <Route path="/exposome" element={<Exposome />} />
      <Route path="/appointments" element={<Appointments />} />
      <Route path="/grocery" element={<Grocery />} />
      <Route path="/goals" element={<GoalPlanner />} />
      <Route path="/wearable" element={<Wearable />} />
      <Route path="/emergency" element={<Emergency />} />
      <Route path="/chat" element={<HealthChat />} />
    </Routes>
  );
}
