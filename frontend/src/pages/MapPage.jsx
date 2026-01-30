import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

import { BOUNDARY_DATASET_BY_YEAR, RESULTS_BY_CANDIDATE_DATASET_ID } from "../config/electionDatasets";
import { fetchGeoJsonFromDataset, fetchTextFromDataset } from "../utils/dataGov";
import { parseResultsCsv, buildSummaryForYear, listParties } from "../utils/results";

function upperTrim(value) {
  return String(value || "").trim().toUpperCase();
}

// Different boundary years use different property keys
function getBoundaryName(properties) {
  if (properties && properties.ED_DESC_FU) return String(properties.ED_DESC_FU);
  if (properties && properties.ED_DESC) return String(properties.ED_DESC);
  if (properties && properties.Name) return String(properties.Name);
  return "Unknown";
}

function getBoundaryType(properties) {
  // Some years encode type differently; if not available, infer from name suffix.
  const name = upperTrim(getBoundaryName(properties));
  if (name.endsWith(" SMC")) return "SMC";
  if (name.endsWith(" GRC")) return "GRC";
  return "";
}

export default function MapPage() {
  const years = useMemo(function () {
    return Object.keys(BOUNDARY_DATASET_BY_YEAR)
      .map(function (y) { return Number(y); })
      .filter(function (y) { return Number.isFinite(y); })
      .sort(function (a, b) { return b - a; });
  }, []);

  const [year, setYear] = useState(years.length > 0 ? years[0] : 2025);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [labelsMode, setLabelsMode] = useState("hover"); // "hover" | "always"

  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  // caches
  const [geoByYear, setGeoByYear] = useState({});
  const [summaryByYear, setSummaryByYear] = useState({});
  const [partiesByYear, setPartiesByYear] = useState({});

  async function ensureYearData(selectedYear) {
    const y = Number(selectedYear);

    setLoading(true);
    setErrorText("");

    try {
      // boundaries
      if (!geoByYear[y]) {
        const datasetId = BOUNDARY_DATASET_BY_YEAR[y];
        if (!datasetId) {
          throw new Error(`No boundary dataset configured for ${y}.`);
        }

        const geojson = await fetchGeoJsonFromDataset(datasetId);

        setGeoByYear(function (prev) {
          const next = { ...prev };
          next[y] = geojson;
          return next;
        });
      }

      // results summary
      if (!summaryByYear[y]) {
        const csvText = await fetchTextFromDataset(RESULTS_BY_CANDIDATE_DATASET_ID);
        const rows = parseResultsCsv(csvText);

        const summary = buildSummaryForYear(rows, y);
        const parties = listParties(summary);

        setSummaryByYear(function (prev) {
          const next = { ...prev };
          next[y] = summary;
          return next;
        });

        setPartiesByYear(function (prev) {
          const next = { ...prev };
          next[y] = parties;
          return next;
        });
      }
    } catch (err) {
      setErrorText(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    if (Number.isFinite(year)) {
      ensureYearData(year);
    }
  }, [year]);

  const activeGeo = geoByYear[year] || null;
  const activeSummary = summaryByYear[year] || new Map();
  const partyOptions = partiesByYear[year] || [];

  const filteredGeo = useMemo(function () {
    if (!activeGeo || !Array.isArray(activeGeo.features)) {
      return null;
    }

    const q = upperTrim(search);

    const outFeatures = activeGeo.features.filter(function (f) {
      const props = f && f.properties ? f.properties : {};
      const nameRaw = getBoundaryName(props);
      const name = upperTrim(nameRaw);

      // text search
      if (q && name.indexOf(q) === -1) {
        return false;
      }

      // type filter
      if (typeFilter !== "ALL") {
        const t = getBoundaryType(props);
        if (t !== typeFilter) {
          return false;
        }
      }

      // party filter (based on computed winner)
      if (partyFilter !== "ALL") {
        const entry = activeSummary.get(name);
        if (!entry || entry.winnerParty !== partyFilter) {
          return false;
        }
      }

      return true;
    });

    return {
      ...activeGeo,
      features: outFeatures,
    };
  }, [activeGeo, activeSummary, search, typeFilter, partyFilter]);

  const geoStyle = useMemo(function () {
    return function (feature) {
      return {
        weight: 2,
        opacity: 1,
        fillOpacity: 0.12,
      };
    };
  }, []);

  function onEachFeature(feature, layer) {
    const props = feature && feature.properties ? feature.properties : {};
    const name = upperTrim(getBoundaryName(props));
    const displayName = getBoundaryName(props);
    const inferredType = getBoundaryType(props);

    const entry = activeSummary.get(name);

    let winnerLine = "";
    let marginLine = "";
    let topLine = "";
    let candidatesHtml = "";

    if (entry) {
      winnerLine = entry.winnerParty ? `Winner: <b>${entry.winnerParty}</b>` : "";
      if (entry.marginPct !== null && entry.marginPct !== undefined) {
        marginLine = `Margin: <b>${entry.marginPct.toFixed(2)}%</b>`;
      }

      if (entry.topParties && entry.topParties.length > 0) {
        topLine = `Top parties: ${entry.topParties.join(", ")}`;
      }

      const parties = Object.keys(entry.parties);
      if (parties.length > 0) {
        const blocks = parties.map(function (p) {
          const info = entry.parties[p];
          const pct = Number.isFinite(info.votePct) ? `${info.votePct.toFixed(2)}%` : "";
          const cands = Array.isArray(info.candidates) ? info.candidates : [];
          const candText = cands.length > 0 ? cands.join(", ") : "";

          return `<div style="margin-top:6px;">
            <div><b>${p}</b> ${pct}</div>
            <div style="opacity:0.9; font-size:12px;">${candText}</div>
          </div>`;
        });

        candidatesHtml = blocks.join("");
      }
    }

    const typeLine = inferredType ? `Type: <b>${inferredType}</b>` : "";

    const html =
      `<div style="font-weight:800; margin-bottom:4px;">${displayName}</div>
       <div style="font-size:12px; opacity:0.95;">Year: <b>${year}</b></div>
       <div style="font-size:12px; opacity:0.95;">${typeLine}</div>
       <div style="font-size:12px; margin-top:6px;">${winnerLine}</div>
       <div style="font-size:12px;">${marginLine}</div>
       <div style="font-size:12px; margin-top:4px; opacity:0.95;">${topLine}</div>
       ${candidatesHtml}`;

    if (labelsMode === "always") {
      layer.bindTooltip(html, { permanent: true, direction: "center", className: "map-label" });
    } else {
      layer.bindTooltip(html, { sticky: true, direction: "auto" });
    }

    layer.on("mouseover", function () {
      layer.setStyle({ weight: 3, fillOpacity: 0.18 });
    });

    layer.on("mouseout", function () {
      layer.setStyle({ weight: 2, fillOpacity: 0.12 });
    });
  }

  const matchedCount = filteredGeo && Array.isArray(filteredGeo.features) ? filteredGeo.features.length : 0;
  const totalCount = activeGeo && Array.isArray(activeGeo.features) ? activeGeo.features.length : 0;

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "end", marginBottom: "10px", flexWrap: "wrap" }}>
        <div style={{ minWidth: "180px" }}>
          <div className="label">Year</div>
          <select className="input" value={year} onChange={function (e) { setYear(Number(e.target.value)); }}>
            {years.map(function (y) {
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ minWidth: "180px" }}>
          <div className="label">Constituency type</div>
          <select className="input" value={typeFilter} onChange={function (e) { setTypeFilter(String(e.target.value)); }}>
            <option value="ALL">ALL</option>
            <option value="GRC">GRC</option>
            <option value="SMC">SMC</option>
          </select>
        </div>

        <div style={{ minWidth: "220px" }}>
          <div className="label">Party filter</div>
          <select className="input" value={partyFilter} onChange={function (e) { setPartyFilter(String(e.target.value)); }}>
            <option value="ALL">ALL</option>
            {partyOptions.map(function (p) {
              return (
                <option key={p} value={p}>
                  {p}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ minWidth: "260px", flex: "1 1 auto" }}>
          <div className="label">Constituency</div>
          <input
            className="input"
            value={search}
            placeholder="Start typing to filter…"
            onChange={function (e) { setSearch(String(e.target.value)); }}
          />
        </div>
{/* 
        <div style={{ minWidth: "180px" }}>
          <div className="label">Labels</div>
          <select className="input" value={labelsMode} onChange={function (e) { setLabelsMode(String(e.target.value)); }}>
            <option value="hover">Show on hover</option>
            <option value="always">Always show</option>
          </select>
        </div> */}
      </div>

      <div style={{ fontSize: "13px", opacity: 0.9, marginBottom: "10px" }}>
        {loading ? "Loading data…" : null}
        {errorText ? <span style={{ color: "crimson" }}>{errorText}</span> : null}
        {!loading && !errorText ? (
          <span>
            Showing <b>{year}</b>. Matched areas: <b>{matchedCount}</b> / <b>{totalCount}</b>.
          </span>
        ) : null}
      </div>

      <div style={{ height: "620px", borderRadius: "12px", overflow: "hidden" }}>
        <MapContainer center={[1.3521, 103.8198]} zoom={11} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredGeo ? (
            <GeoJSON data={filteredGeo} style={geoStyle} onEachFeature={onEachFeature} />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
