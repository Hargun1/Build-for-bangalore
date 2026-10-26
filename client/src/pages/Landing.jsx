import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="ui-page ui-loading" style={{ justifyContent: "center" }}><span className="ui-spinner" /> Opening your account...</div>;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
