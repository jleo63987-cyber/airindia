import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="config-screen">
        <div className="config-card">
          <h2>Connect Supabase first</h2>
          <p>Copy <code>.env.example</code> to <code>.env</code> and add your Supabase project URL and publishable key.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="app-loader"><span className="loader-ring"/><p>Loading workspace…</p></div>;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
