import { Navigate, Route, Routes } from "react-router-dom";
import DashboardShell from "./components/DashboardShell";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";

import {
  DevicesPage,
  FilesPage,
  OverviewPage,
  RemoteControlPage,
  SessionsPage,
} from "./pages/DashboardPages";

import LandingPage from "./pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/auth/:mode"
        element={<AuthPage />}
      />

      <Route
        path="/login"
        element={
          <Navigate
            to="/auth/login"
            replace
          />
        }
      />

      <Route
        path="/register"
        element={
          <Navigate
            to="/auth/register"
            replace
          />
        }
      />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardShell />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="overview"
              replace
            />
          }
        />

        <Route
          path="overview"
          element={<OverviewPage />}
        />

        <Route
          path="devices"
          element={<DevicesPage />}
        />

        <Route
          path="control/:id"
          element={<RemoteControlPage />}
        />

        <Route
          path="files"
          element={<FilesPage />}
        />

        <Route
          path="sessions"
          element={<SessionsPage />}
        />

        <Route
          path="settings"
          element={
            <Navigate
              to="/app/overview"
              replace
            />
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}
