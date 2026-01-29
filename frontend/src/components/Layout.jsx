import React from "react";
import { useLocation } from "react-router-dom";
import NavBar from "./NavBar.jsx";

export default function Layout({ children }) {
  const location = useLocation();
  const hideNav = location.pathname === "/login";

  return (
    <div className="app-shell">
      {!hideNav ? <NavBar /> : null}
      <div className="app-content">
        {children}
      </div>
    </div>
  );
}
