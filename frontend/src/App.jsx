import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import AuthCallback from "./pages/AuthCallback";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// small JWT parser to read payload without extra libraries
function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );
  const logoutTimerRef = useRef(null);

  // helper: clear any existing logout timer
  function clearLogoutTimer() {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }

  // logout helper
  function handleLogout() {
    clearLogoutTimer();
    localStorage.removeItem("token");
    setToken(null);
  }

  // login helper: store token and setup auto-logout timer
  function handleLogin(newToken) {
    if (!newToken) return;
    localStorage.setItem("token", newToken);
    setToken(newToken);

    // set up auto-logout based on token exp
    const payload = parseJwt(newToken);
    if (payload && payload.exp) {
      const expiresMs = payload.exp * 1000;
      const now = Date.now();
      const ttl = expiresMs - now;
      if (ttl <= 0) {
        // already expired (rare) — immediately logout
        handleLogout();
      } else {
        clearLogoutTimer();
        // set timer to fire when token expires
        logoutTimerRef.current = setTimeout(() => {
          // optional: show alert then logout
          alert("Session expired — please log in again.");
          handleLogout();
        }, ttl);
      }
    }
  }

  // on page load: if token exists, validate expiry and set timer
  useEffect(() => {
    if (!token) return;
    const payload = parseJwt(token);
    if (!payload || !payload.exp) {
      // invalid token shape — force logout
      handleLogout();
      return;
    }
    const expiresMs = payload.exp * 1000;
    const now = Date.now();
    const ttl = expiresMs - now;
    if (ttl <= 0) {
      handleLogout();
    } else {
      // setup timer
      clearLogoutTimer();
      logoutTimerRef.current = setTimeout(() => {
        alert("Session expired — please log in again.");
        handleLogout();
      }, ttl);
    }

    // cleanup on unmount
    return () => clearLogoutTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // keep localStorage in sync across tabs
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "token") setToken(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public pages */}
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* OAuth callback route */}
        <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />

        {/* Protected chat route */}
        <Route
          path="/chat"
          element={
            token ? (
              <Chat token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Protected settings route */}
        <Route
          path="/settings"
          element={
            token ? (
              <Settings />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Root and fallback */}
        <Route
          path="/"
          element={<Navigate to={token ? "/chat" : "/login"} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={token ? "/chat" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}
