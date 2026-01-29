import React from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, apiGet } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [username, setUsername] = React.useState("diana");
  const [password, setPassword] = React.useState("Password123!");
  const [errorText, setErrorText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      navigate("/map");
    }
  }, [user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrorText("");
    setSubmitting(true);

    try {
      await apiPost("/api/auth/login", { username, password });
      const me = await apiGet("/api/auth/me");
      setUser(me.user);
      navigate("/map");
    } catch (err) {
      setErrorText(String(err && err.message ? err.message : "Request failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          {/* <div className="badge" /> */}
          <div>
            <h1 className="title">Sign in</h1>
            {/* <p className="subtitle">Use your assigned voter or admin account.</p> */}
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
        </form>

        {errorText ? <div className="error">{errorText}</div> : null}

        {/* <div className="hint">
          <div>Demo credentials:</div>
          <div style={{ marginTop: "6px" }}>
            <div><strong>diana</strong> / Password123! (civilian)</div>
            <div><strong>eve</strong> / Password123! (government)</div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
