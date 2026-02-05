import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { apiPost } from "../api.js";

export default function NavBar() {
  const navigate = useNavigate();
  const { user, setUser, loading } = useAuth();

  async function onLogout() {
    try {
      await apiPost("/api/auth/logout", {});
    } catch (_err) {
      // even if server fails, proceed to clear local state
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }
  if (loading) {
    return (
      <div className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <div className="topbar-brand">
              <div className="topbar-dot" />
              <div className="topbar-title">SG Election App</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-meta">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  function navClass({ isActive }) {
    let className = "topbar-link";
    if (isActive) className += " is-active";
    return className;
  }

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <div className="topbar-brand">
            <img src="/icon.svg" alt="Logo" className="topbar-dot" />
            <div className="topbar-title">SG Election App</div>
          </div>

          <nav className="topbar-nav">
            <NavLink to="/dashboard" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/map" end className={navClass}>
              Map
            </NavLink>
          </nav>
        </div>

        <div className="topbar-right">
          <button className="topbar-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
