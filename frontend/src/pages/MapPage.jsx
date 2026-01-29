import React, { useEffect, useState } from "react";
import { apiGet } from "../api.js";

export default function MapPage() {
  const [errorText, setErrorText] = useState("");
  const [boundaries, setBoundaries] = useState(null);

  useEffect(() => {
    async function run() {
      try {
        const data = await apiGet(`/api/boundaries?year=2020`);
        setBoundaries(data);
      } catch (err) {
        setErrorText(err.message);
      }
    }

    run();
  }, []);

  return (
    <div>
      <h2>Map</h2>

      {errorText ? (
        <div style={{ color: "crimson" }}>{errorText}</div>
      ) : null}

      <pre style={{ background: "#f7f7f7", padding: "12px", borderRadius: "8px" }}>
        {JSON.stringify(boundaries, null, 2)}
      </pre>
    </div>
  );
}
