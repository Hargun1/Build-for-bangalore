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

// Route Guard
import ProtectedRoute from "./components/Shared/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/glass-body"
        element={
          <ProtectedRoute>
            <GlassBody />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exposome"
        element={
          <ProtectedRoute>
            <Exposome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grocery"
        element={
          <ProtectedRoute>
            <Grocery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <GoalPlanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wearable"
        element={
          <ProtectedRoute>
            <Wearable />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emergency"
        element={
          <ProtectedRoute>
            <Emergency />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <HealthChat />
          </ProtectedRoute>
        }
      />

      {/* Gracefully handle unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

