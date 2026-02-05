// src/pages/LoginPage.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost, apiGet } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";

function parseApiError(err) {
  const raw = String(err && err.message ? err.message : err || "").trim();

  let message = raw;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      if (typeof obj.message === "string") {
        message = obj.message;
      } else if (typeof obj.error === "string") {
        message = obj.error;
      }
    }
  } catch (_e) {
    // keep raw
  }

  const lower = String(message || "").toLowerCase();

  if (lower.includes("invalid credentials")) {
    return "Your username or password is incorrect. Please try again.";
  }

  if (lower.includes("not authenticated") || lower.includes("unauthorized")) {
    return "You are not signed in. Please sign in again.";
  }

  if (!message) {
    return "Request failed. Please try again.";
  }

  return message;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, loading } = useAuth();

  const [username, setUsername] = React.useState("diana");
  const [password, setPassword] = React.useState("Password123!");
  const [errorText, setErrorText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const redirectTo = React.useMemo(() => {
    const from = location.state && location.state.from;
    return from || "/map";
  }, [location.state]);

  React.useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, redirectTo]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrorText("");
    setSubmitting(true);

    try {
      await apiPost("/api/auth/login", { username, password });
      const me = await apiGet("/api/auth/me");
      setUser(me.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setErrorText(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <div>
            <h1 className="title">Sign in</h1>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>

          {errorText ? <div className="login-error">{errorText}</div> : null}
        </form>
      </div>
    </div>
  );
}
