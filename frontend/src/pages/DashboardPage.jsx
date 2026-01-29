import React from "react";

export default function DashboardPage() {
  return (
    <div style={{ height: "calc(100vh - 80px)" }}>
          <div style={{ padding: 12 }}>Dashboard page mounted</div>

      <iframe
        src="http://localhost:4000/dash/"
        title="Election Dashboard"
        style={{
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "12px",
          background: "white",
        }}
      />
    </div>
  );
}
