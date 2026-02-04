import React, { useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

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
  const name = upperTrim(getBoundaryName(properties));
  if (name.endsWith(" SMC")) return "SMC";
  if (name.endsWith(" GRC")) return "GRC";
  return "";
}

export default function MapPage() {
const years = useMemo(function () {
  return [2025, 2020, 2015, 2011, 2006];
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

  // selection highlight (orange)
  const [selectedName, setSelectedName] = useState("");

  // NEW: sidebar + map instance (for invalidateSize)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);

async function ensureYearData(selectedYear) {
  const y = Number(selectedYear);

  setLoading(true);
  setErrorText("");

  try {
    // boundaries from MySQL
    if (!geoByYear[y]) {
      const res = await fetch(`/api/boundaries?year=${encodeURIComponent(y)}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to load boundaries (${res.status}): ${text.slice(0, 200)}`);
      }

      const geojson = JSON.parse(text);

      setGeoByYear(function (prev) {
        const next = { ...prev };
        next[y] = geojson;
        return next;
      });
    }

    // summary from MySQL
    if (!summaryByYear[y]) {
      const res = await fetch(`/api/boundaries/summary?year=${encodeURIComponent(y)}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to load summary (${res.status}): ${text.slice(0, 200)}`);
      }

      const json = JSON.parse(text);
      const summaryObj = json && json.summary ? json.summary : {};

      // MapPage expects a Map() keyed by UPPER constituency name:
      const summaryMap = new Map(Object.entries(summaryObj));

      // party options: union of winner parties from summary
      const partySet = new Set();
      for (const [_k, v] of summaryMap.entries()) {
        if (v && v.winnerParty) {
          partySet.add(String(v.winnerParty));
        }
      }

      setSummaryByYear(function (prev) {
        const next = { ...prev };
        next[y] = summaryMap;
        return next;
      });

      setPartiesByYear(function (prev) {
        const next = { ...prev };
        next[y] = Array.from(partySet).sort();
        return next;
      });
    }
  } catch (err) {
    setErrorText(String(err && err.message ? err.message : err));
  } finally {
    setLoading(false);
  }
}

const savedViewRef = useRef(null);
function handleToggleSidebar() {
  if (mapInstance) {
    savedViewRef.current = {
      center: mapInstance.getCenter(),
      zoom: mapInstance.getZoom(),
    };
  }

  setIsSidebarOpen(function (v) {
    return !v;
  });
}

  useEffect(
    function () {
      if (Number.isFinite(year)) {
        ensureYearData(year);
      }
    },
    [year],
  );

  // clear selection when changing filters/year
  useEffect(
    function () {
      setSelectedName("");
    },
    [year, typeFilter, partyFilter, search],
  );

  // IMPORTANT: when sidebar toggles, Leaflet needs a resize invalidate after the CSS transition
useEffect(
  function () {
    if (!mapInstance) return;

    const timer = window.setTimeout(function () {
      try {
        mapInstance.invalidateSize();

        const saved = savedViewRef.current;
        if (saved && saved.center && Number.isFinite(saved.zoom)) {
          mapInstance.setView(saved.center, saved.zoom, { animate: false });
        }

        savedViewRef.current = null;
      } catch (e) {
        // ignore
      }
    }, 320);

    return function () {
      window.clearTimeout(timer);
    };
  },
  [isSidebarOpen, mapInstance],
);


  const activeGeo = geoByYear[year] || null;
  const activeSummary = summaryByYear[year] || new Map();
  const partyOptions = partiesByYear[year] || [];

  const filteredGeo = useMemo(
    function () {
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
    },
    [activeGeo, activeSummary, search, typeFilter, partyFilter],
  );

  const geoStyle = useMemo(
    function () {
      return function (feature) {
        const props = feature && feature.properties ? feature.properties : {};
        const name = upperTrim(getBoundaryName(props));
        const isSelected = selectedName && name === selectedName;

        return {
          color: isSelected ? "#f97316" : "#3b82f6",
          weight: isSelected ? 3 : 2,
          opacity: 1,
          fillColor: isSelected ? "#f97316" : "#60a5fa",
          fillOpacity: isSelected ? 0.22 : 0.12,
        };
      };
    },
    [selectedName],
  );

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

    layer.on("click", function () {
      setSelectedName(name);
    });
  }

  const matchedCount = filteredGeo && Array.isArray(filteredGeo.features) ? filteredGeo.features.length : 0;
  const totalCount = activeGeo && Array.isArray(activeGeo.features) ? activeGeo.features.length : 0;

  const navBarHeight = 70; // keep your existing assumption

  return (
  <div
    className={isSidebarOpen ? "map-shell sidebar-open" : "map-shell sidebar-collapsed"}
    style={{ height: `calc(100vh - ${navBarHeight}px)` }}
  >
    {/* EDGE BUTTON (always visible) */}
    <button
      type="button"
      className="sidebar-edge-toggle"
      onClick={handleToggleSidebar}
      aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      title={isSidebarOpen ? "Collapse" : "Expand"}
    >
      {isSidebarOpen ? "‹" : "›"}
    </button>

    {/* SIDEBAR */}
    <aside className={isSidebarOpen ? "map-sidebar open" : "map-sidebar collapsed"}>
      <div className="map-sidebar-top">
        <div className="map-sidebar-title">Filters</div>
      </div>

      <div className="map-sidebar-body">
            <div className="field">
              <div className="label">Year</div>
              <select
                className="input"
                value={year}
                onChange={function (e) {
                  setYear(Number(e.target.value));
                }}
              >
                {years.map(function (y) {
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="field">
              <div className="label">Constituency type</div>
              <select
                className="input"
                value={typeFilter}
                onChange={function (e) {
                  setTypeFilter(String(e.target.value));
                }}
              >
                <option value="ALL">ALL</option>
                <option value="GRC">GRC</option>
                <option value="SMC">SMC</option>
              </select>
            </div>

            <div className="field">
              <div className="label">Party filter</div>
              <select
                className="input"
                value={partyFilter}
                onChange={function (e) {
                  setPartyFilter(String(e.target.value));
                }}
              >
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

            <div className="field">
              <div className="label">Constituency</div>
              <input
                className="input"
                value={search}
                placeholder="Start typing to filter…"
                onChange={function (e) {
                  setSearch(String(e.target.value));
                }}
              />
            </div>

            {/* <div className="field"> */}
              {/* <div className="label">Labels</div>
              <select
                className="input"
                value={labelsMode}
                onChange={function (e) {
                  setLabelsMode(String(e.target.value));
                }}
              >
                <option value="hover">On hover</option>
                <option value="always">Always</option>
              </select>
            </div> */}

            <div className="map-sidebar-status">
              {loading ? <div>Loading data…</div> : null}
              {errorText ? <div style={{ color: "crimson" }}>{errorText}</div> : null}

              {!loading && !errorText ? (
                <div>
                  Showing <b>{year}</b>. Matched areas: <b>{matchedCount}</b> / <b>{totalCount}</b>.
                  {selectedName ? (
                    <span>
                      {" "}
                      Selected: <b>{selectedName}</b>.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
      </aside>

    <main className="map-pane">
      <MapContainer
        center={[1.3521, 103.8198]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        whenCreated={function (map) {
          setMapInstance(map);
        }}
      >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredGeo ? <GeoJSON data={filteredGeo} style={geoStyle} onEachFeature={onEachFeature} /> : null}
        </MapContainer>
      </main>
    </div>
  );
}
