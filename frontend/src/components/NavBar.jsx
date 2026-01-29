import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { apiPost } from "../api.js";

export default function NavBar() {
  const navigate = useNavigate();
  const { user, setUser, loading } = useAuth();

  async function onLogout() {
    await apiPost("/api/auth/logout", {});
    setUser(null);
    navigate("/login");
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

  if (!user) {
    return null;
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
            <Link className="topbar-link" to="/map">Map</Link>
            <Link className="topbar-link" to="/dashboard">Dashboard</Link>
          </nav>
        </div>

        <div className="topbar-right">
          <div className="topbar-meta">
            {user.username} ({user.role_name})
          </div>
          <button className="topbar-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
