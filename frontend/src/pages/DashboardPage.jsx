import React from "react";
import { useEffect } from "react";

export default function DashboardPage() {
  const iframeRef = React.useRef(null);
  const [iframeHeight, setIframeHeight] = React.useState(900);

  useEffect(() => {
    function onMsg(e) {
      if (!e || !e.data) return;
      if (e.data.type !== "DASH_HEIGHT") return;

      const next = Number(e.data.height);
      if (!Number.isFinite(next) || next <= 0) return;

      setIframeHeight((prev) => {
        if (Math.abs(prev - next) <= 2) return prev; // ignore tiny diffs
        return next;
      });
    }

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          Search and compare outcomes across years and constituencies.
        </div>
      </div>

      <div className="card-surface">
        <iframe
          title="Dash Dashboard"
          src="http://localhost:4000/dash/"
          style={{
            width: "100%",
            height: iframeHeight, // from postMessage
            border: "0",
            display: "block",
            overflow: "hidden",
          }}
          scrolling="no"
        />
      </div>
    </div>
  );
}
