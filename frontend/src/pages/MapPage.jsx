// pages/MapPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";

function upperTrim(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}
function fitToGeo(map, geojson, isSidebarOpen) {
  if (!map) return;
  if (
    !geojson ||
    !Array.isArray(geojson.features) ||
    geojson.features.length === 0
  ) {
    return;
  }

  const layer = L.geoJSON(geojson);
  const bounds = layer.getBounds();

  if (!bounds || !bounds.isValid || !bounds.isValid()) {
    return;
  }

  const leftPad = isSidebarOpen ? 380 : 60; // tweak if your sidebar width differs
  const pad = 40;

  map.fitBounds(bounds, {
    paddingTopLeft: [leftPad, pad],
    paddingBottomRight: [pad, pad],
    animate: false,
    maxZoom: 12,
  });
}

function normaliseConstituencyKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-") // normalise dash types to "-"
    .replace(/\s+/g, " "); // collapse whitespace
}

// Different boundary years use different property keys
function getBoundaryName(properties) {
  if (properties && properties.ED_DESC_FU) return String(properties.ED_DESC_FU);
  if (properties && properties.ED_DESC) return String(properties.ED_DESC);
  if (properties && properties.Name) return String(properties.Name);
  return "Unknown";
}

function getBoundaryTypeFromName(properties) {
  const name = upperTrim(getBoundaryName(properties));
  if (name.endsWith(" SMC")) return "SMC";
  if (name.endsWith(" GRC")) return "GRC";
  return "";
}

// Party colours (extend as you like)
const PARTY_META = {
  PAP: { colour: "#E53935", name: "People's Action Party" },
  WP: { colour: "#1E88E5", name: "Workers' Party" },

  PSP: { colour: "#FB8C00", name: "Progress Singapore Party" },
  SDP: { colour: "#43A047", name: "Singapore Democratic Party" },
  NSP: { colour: "#00897B", name: "National Solidarity Party" },
  SPP: { colour: "#8E24AA", name: "Singapore People's Party" },
  PPP: { colour: "#D81B60", name: "People's Power Party" },

  RDU: { colour: "#5E35B1", name: "Red Dot United" },
  SDA: { colour: "#3949AB", name: "Singapore Democratic Alliance" },

  PAR: { colour: "#6D4C41", name: "People's Alliance for Reform" },
  SUP: { colour: "#FDD835", name: "Singapore United Party" },
  INDEPENDENT: { colour: "#546E7A", name: "Independent" },
};

function partyLabel(partyCode) {
  const key = upperTrim(partyCode);
  const meta = PARTY_META[key];
  return meta && meta.name ? meta.name : key;
}

function colourForParty(partyCode) {
  const key = upperTrim(partyCode);
  const meta = PARTY_META[key];
  if (meta && meta.colour) return meta.colour;

  // deterministic fallback for unexpected party codes
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 75% 50%)`;
}
function TypeaheadSelectBox({
  value,
  options,
  onSelect,
  placeholder,
  direction, // "up" | "down"
  maxItems,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const rootRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const selectedKey = String(value || "ALL")
    .trim()
    .toUpperCase();

  const selectedLabel = React.useMemo(
    function () {
      const hit = options.find(function (o) {
        return (
          String(o.key || "")
            .trim()
            .toUpperCase() === selectedKey
        );
      });
      return hit ? String(hit.label) : placeholder || "ALL";
    },
    [options, selectedKey, placeholder],
  );

  const limit = Number.isFinite(Number(maxItems)) ? Number(maxItems) : 120;

  const filtered = React.useMemo(
    function () {
      const q = String(query || "")
        .trim()
        .toUpperCase();

      const allOpt = options.find(function (o) {
        return String(o.key || "").toUpperCase() === "ALL";
      });

      const rest = options.filter(function (o) {
        return String(o.key || "").toUpperCase() !== "ALL";
      });

      if (!q) {
        return (allOpt ? [allOpt] : []).concat(rest.slice(0, limit));
      }

      const starts = [];
      const includes = [];

      for (const opt of rest) {
        const label = String(opt.label || "");
        const key = String(opt.key || "").toUpperCase();
        const labelUpper = label.toUpperCase();

        if (key.startsWith(q) || labelUpper.startsWith(q)) {
          starts.push(opt);
        } else if (key.indexOf(q) !== -1 || labelUpper.indexOf(q) !== -1) {
          includes.push(opt);
        }
      }

      starts.sort(function (a, b) {
        return String(a.label).localeCompare(String(b.label));
      });
      includes.sort(function (a, b) {
        return String(a.label).localeCompare(String(b.label));
      });

      const combined = starts.concat(includes).slice(0, limit);
      return (allOpt ? [allOpt] : []).concat(combined);
    },
    [options, query, limit],
  );

  React.useEffect(function () {
    function onDocDown(e) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) {
        setIsOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onDocDown);
    return function () {
      document.removeEventListener("mousedown", onDocDown);
    };
  }, []);

  function openMenu() {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(-1);
  }

  function closeMenu() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function commitSelect(item) {
    if (!item) return;
    if (typeof onSelect === "function") {
      onSelect(String(item.key));
    }
    closeMenu();
  }

  const inputValue = isOpen ? query : selectedLabel;

  return (
    <div ref={rootRef} className="selectbox-root">
      <input
        ref={inputRef}
        className="input selectbox-input"
        value={inputValue}
        placeholder={placeholder || "ALL"}
        onFocus={function () {
          openMenu();
        }}
        onClick={function () {
          if (!isOpen) openMenu();
        }}
        onChange={function (e) {
          if (!isOpen) setIsOpen(true);
          setQuery(String(e.target.value));
          setActiveIndex(-1);
        }}
        onKeyDown={function (e) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) {
              openMenu();
              return;
            }
            setActiveIndex(function (prev) {
              const next = prev + 1;
              return next >= filtered.length ? 0 : next;
            });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) {
              openMenu();
              return;
            }
            setActiveIndex(function (prev) {
              const next = prev - 1;
              return next < 0 ? filtered.length - 1 : next;
            });
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (!isOpen) {
              openMenu();
              return;
            }
            const item = filtered[activeIndex] || filtered[0] || null;
            commitSelect(item);
          } else if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
            if (inputRef.current) inputRef.current.blur();
          }
        }}
      />

      {isOpen ? (
        <div
          className={
            direction === "down"
              ? "selectbox-menu selectbox-menu--down"
              : "selectbox-menu selectbox-menu--up"
          }
          role="listbox"
        >
          <div className="selectbox-items">
            {filtered.map(function (item, idx) {
              const isActive = idx === activeIndex;
              const isSelected =
                String(item.key || "").toUpperCase() === selectedKey;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={
                    isActive
                      ? "selectbox-item active"
                      : isSelected
                        ? "selectbox-item selected"
                        : "selectbox-item"
                  }
                  onMouseEnter={function () {
                    setActiveIndex(idx);
                  }}
                  onMouseDown={function (e) {
                    e.preventDefault();
                  }}
                  onClick={function () {
                    commitSelect(item);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MapPage() {
  const years = useMemo(function () {
    return [2025, 2020, 2015, 2011, 2006];
  }, []);

  const [year, setYear] = useState(years.length > 0 ? years[0] : 2025);

  // Filters
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | GRC | SMC
  const [partyContestedFilter, setPartyContestedFilter] = useState("ALL");
  const [partyWinnerFilter, setPartyWinnerFilter] = useState("ALL");
  const [search, setSearch] = useState("ALL");

  // UI/State
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  // caches
  const [geoByYear, setGeoByYear] = useState({});
  const [summaryByYear, setSummaryByYear] = useState({}); // Map keyed by UPPER constituency
  const [partiesByYear, setPartiesByYear] = useState({}); // array

  // sidebar + map instance (for invalidateSize)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);
  const savedViewRef = useRef(null);
  const lastFitKeyRef = useRef("");
  const sidebarRef = useRef(null);
  const geoLayerRef = useRef(null); // optional, if you want access later

  const DEFAULT_YEAR = years.length > 0 ? years[0] : 2025;

  const DEFAULT_TYPE = "ALL";
  const DEFAULT_CONTESTED = "ALL";
  const DEFAULT_WINNER = "ALL";
  const DEFAULT_CONSTITUENCY = "ALL";

  function resetFilters() {
    setYear(DEFAULT_YEAR);
    setTypeFilter(DEFAULT_TYPE);
    setPartyContestedFilter(DEFAULT_CONTESTED);
    setPartyWinnerFilter(DEFAULT_WINNER);
    setSearch(DEFAULT_CONSTITUENCY);
  }

  async function ensureYearData(selectedYear) {
    const y = Number(selectedYear);

    setLoading(true);
    setErrorText("");

    try {
      // boundaries from MySQL via backend
      if (!geoByYear[y]) {
        const res = await fetch(
          `/api/boundaries?year=${encodeURIComponent(y)}`,
          {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          },
        );

        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            `Failed to load boundaries (${res.status}): ${text.slice(0, 200)}`,
          );
        }

        const geojson = JSON.parse(text);

        setGeoByYear(function (prev) {
          const next = { ...prev };
          next[y] = geojson;
          return next;
        });
      }

      // summary from MySQL via backend
      if (!summaryByYear[y]) {
        const res = await fetch(
          `/api/boundaries/summary?year=${encodeURIComponent(y)}`,
          {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          },
        );

        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            `Failed to load summary (${res.status}): ${text.slice(0, 200)}`,
          );
        }

        const json = JSON.parse(text);
        const summaryObj = json && json.summary ? json.summary : {};
        const parties = json && Array.isArray(json.parties) ? json.parties : [];

        // Map() keyed by UPPER constituency name:
        // normalise ALL summary keys too
        const summaryMap = new Map(
          Object.entries(summaryObj).map(function ([k, v]) {
            return [normaliseConstituencyKey(k), v];
          }),
        );
        setSummaryByYear(function (prev) {
          const next = { ...prev };
          next[y] = summaryMap;
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

  const activeGeo = geoByYear[year] || null;
  const activeSummary = summaryByYear[year] || new Map();
  const partyOptions = partiesByYear[year] || [];
  const legendParties = useMemo(
    function () {
      const list = Array.isArray(partyOptions) ? partyOptions.slice() : [];

      // normalise + de-dupe
      const seen = new Set();
      const cleaned = [];
      for (const p of list) {
        const k = upperTrim(p);
        if (!k) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        cleaned.push(k);
      }

      // PAP + WP first, then the rest alphabetical
      const head = [];
      const tail = [];

      for (const p of cleaned) {
        if (p === "PAP" || p === "WP") {
          head.push(p);
        } else {
          tail.push(p);
        }
      }

      head.sort(function (a, b) {
        const order = { PAP: 0, WP: 1 };
        return (order[a] ?? 99) - (order[b] ?? 99);
      });

      tail.sort(function (a, b) {
        return a.localeCompare(b);
      });

      return head.concat(tail);
    },
    [partyOptions],
  );
  const constituencyOptions = React.useMemo(
    function () {
      if (!activeGeo || !Array.isArray(activeGeo.features)) {
        return [];
      }

      const seen = new Set();
      const out = [];

      for (const f of activeGeo.features) {
        const props = f && f.properties ? f.properties : {};
        const label = getBoundaryName(props);
        const key = normaliseConstituencyKey(label);

        if (!key) continue;
        if (seen.has(key)) continue;

        seen.add(key);
        out.push({ key: key, label: String(label) });
      }

      out.sort(function (a, b) {
        return String(a.label).localeCompare(String(b.label));
      });

      return [{ key: "ALL", label: "ALL" }].concat(out);
    },
    [activeGeo],
  );
  const yearOptions = useMemo(function () {
    return years.map(function (y) {
      return { key: String(y), label: String(y) };
    });
  }, [years]);

  const typeOptions = React.useMemo(function () {
    return [
      { key: "ALL", label: "ALL" },
      { key: "GRC", label: "GRC" },
      { key: "SMC", label: "SMC" },
    ];
  }, []);

  const partySelectOptions = React.useMemo(
    function () {
      const list = Array.isArray(partyOptions) ? partyOptions.slice() : [];
      const cleaned = [];
      const seen = new Set();

      for (const p of list) {
        const k = upperTrim(p);
        if (!k) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        cleaned.push(k);
      }

      cleaned.sort(function (a, b) {
        return a.localeCompare(b);
      });

      return [{ key: "ALL", label: "ALL" }].concat(
        cleaned.map(function (p) {
          return { key: p, label: p };
        }),
      );
    },
    [partyOptions],
  );

  // Filtered boundaries: ONLY draw those that pass filters
  const filteredGeo = useMemo(
    function () {
      if (!activeGeo || !Array.isArray(activeGeo.features)) {
        return null;
      }

      const qRaw = upperTrim(search);
      const q = qRaw === "ALL" ? "" : qRaw;

      const outFeatures = activeGeo.features.filter(function (f) {
        const props = f && f.properties ? f.properties : {};
        const displayName = getBoundaryName(props);
        const nameKey = normaliseConstituencyKey(displayName);
        const inferredType = getBoundaryTypeFromName(props);

        const entry = activeSummary.get(nameKey) || null;

        // Constituency search filter
        if (q && nameKey.indexOf(q) === -1) {
          return false;
        }

        // Constituency type filter
        if (typeFilter !== "ALL") {
          if (inferredType !== typeFilter) {
            return false;
          }
        }

        // Party contested filter: show constituencies where party appears in contested list
        if (partyContestedFilter !== "ALL") {
          const pKey = normaliseConstituencyKey(partyContestedFilter);
          if (!entry || !entry.parties || !entry.parties[pKey]) {
            return false;
          }
        }

        // Party winner filter
        if (partyWinnerFilter !== "ALL") {
          const wKey = normaliseConstituencyKey(partyWinnerFilter);
          if (!entry || upperTrim(entry.winnerParty) !== wKey) {
            return false;
          }
        }

        return true;
      });
      if (outFeatures.length === 0) {
        return null;
      }
      return {
        ...activeGeo,
        features: outFeatures,
      };
    },
    [
      activeGeo,
      activeSummary,
      search,
      typeFilter,
      partyContestedFilter,
      partyWinnerFilter,
    ],
  );
  // IMPORTANT: when sidebar toggles, Leaflet needs a resize invalidate after the CSS transition
  useEffect(
    function () {
      if (!mapInstance) return;

      const timer = window.setTimeout(function () {
        try {
          mapInstance.invalidateSize();

          const geoToFit =
            filteredGeo &&
            Array.isArray(filteredGeo.features) &&
            filteredGeo.features.length > 0
              ? filteredGeo
              : activeGeo;

          fitToGeo(mapInstance, geoToFit, isSidebarOpen);
        } catch (e) {
          // ignore
        }
      }, 320);

      return function () {
        window.clearTimeout(timer);
      };
    },
    [isSidebarOpen, mapInstance, filteredGeo, activeGeo],
  );

  // Styles: by default, winner party colour;
  const geoStyle = useMemo(
    function () {
      return function (feature) {
        const props = feature && feature.properties ? feature.properties : {};
        const nameKey = upperTrim(getBoundaryName(props));

        const entry = activeSummary.get(nameKey) || null;
        const winner =
          entry && entry.winnerParty ? String(entry.winnerParty) : "";

        const baseFill = winner ? colourForParty(winner) : "#ffffff";
        const baseStroke = winner ? colourForParty(winner) : "#ffffff";

        return {
          color: baseStroke, // border
          weight: 2,
          opacity: 1,
          fillColor: baseFill,
          fillOpacity: 0.35,
        };
      };
    },
    [activeSummary],
  );

  function onEachFeature(feature, layer) {
    const props = feature && feature.properties ? feature.properties : {};
    const displayName = getBoundaryName(props);
    const nameKey = upperTrim(displayName);
    const inferredType = getBoundaryTypeFromName(props);

    const entry = activeSummary.get(nameKey) || null;

    const winner =
      entry && entry.winnerParty ? String(entry.winnerParty) : "Unknown";

    // Build party lines like:
    // 80% PAP
    // 20% WP
    let partyLinesHtml = "";

    if (entry && entry.parties) {
      const parties = Object.keys(entry.parties);

      parties.sort(function (a, b) {
        const av = Number(entry.parties[a]?.votePct ?? -1);
        const bv = Number(entry.parties[b]?.votePct ?? -1);
        return bv - av;
      });

      partyLinesHtml = parties
        .map(function (p) {
          const pctVal = Number(entry.parties[p]?.votePct);
          const pctText = Number.isFinite(pctVal)
            ? `${pctVal.toFixed(2)}%`
            : "";
          return `<div style="font-size:12px; margin-top:2px;"><b>${pctText}</b> ${p}</div>`;
        })
        .join("");
    }

    const html = `<div style="font-weight:800; margin-bottom:6px;">${displayName}</div>
      <div style="font-size:12px;">Year: <b>${year}</b></div>
      <div style="font-size:12px;">Type: <b>${inferredType || "Unknown"}</b></div>
      <div style="font-size:12px; margin-top:6px;">Winner: <b>${winner}</b></div>
      <div style="margin-top:6px;">${partyLinesHtml}</div>`;

    layer.bindTooltip(html, { sticky: true, direction: "auto" });

    layer.on("mouseover", function () {
      layer.setStyle({ weight: 4, fillOpacity: 0.85 });
    });

    layer.on("mouseout", function () {
      layer.setStyle({ weight: 2, fillOpacity: 0.35 });
    });
  }
  useEffect(
    function () {
      if (!mapInstance) return;

      // Prefer fitting to filtered boundaries when filters are active.
      // If filtered is empty, fall back to full year boundaries.
      const geoToFit =
        filteredGeo &&
        Array.isArray(filteredGeo.features) &&
        filteredGeo.features.length > 0
          ? filteredGeo
          : activeGeo;

      // Fit only when the "meaningful view" changes (prevents constant refitting).
      const fitKey = JSON.stringify({
        year,
        typeFilter,
        partyContestedFilter,
        partyWinnerFilter,
        search,
        sidebar: isSidebarOpen ? 1 : 0,
        geoCount:
          geoToFit && Array.isArray(geoToFit.features)
            ? geoToFit.features.length
            : 0,
      });

      if (fitKey === lastFitKeyRef.current) {
        return;
      }

      lastFitKeyRef.current = fitKey;

      // Let Leaflet finish drawing layers before fitting.
      window.setTimeout(function () {
        try {
          mapInstance.invalidateSize();
          fitToGeo(mapInstance, geoToFit, isSidebarOpen);
        } catch (e) {
          // ignore
        }
      }, 0);
    },
    [
      mapInstance,
      year,
      typeFilter,
      partyContestedFilter,
      partyWinnerFilter,
      search,
      isSidebarOpen,
      filteredGeo,
      activeGeo,
    ],
  );
  function getGeoJsonBounds(geojson) {
    try {
      const layer = L.geoJSON(geojson);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid && bounds.isValid()) {
        return bounds;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  useEffect(
    function () {
      if (!mapInstance) return;

      // Use filtered boundaries if any; otherwise fall back to full year boundaries
      const geoToFit =
        filteredGeo &&
        Array.isArray(filteredGeo.features) &&
        filteredGeo.features.length > 0
          ? filteredGeo
          : activeGeo;

      const bounds = geoToFit ? getGeoJsonBounds(geoToFit) : null;

      // Sidebar padding: keep features visually centred in the remaining map viewport
      const sidebarWidth =
        isSidebarOpen && sidebarRef.current
          ? sidebarRef.current.getBoundingClientRect().width
          : 0;

      const pad = 24;
      const paddingTopLeft = [sidebarWidth + pad, pad];
      const paddingBottomRight = [pad, pad];

      // If we have valid bounds, fit to them; else hard centre on SG
      if (bounds) {
        mapInstance.fitBounds(bounds, {
          paddingTopLeft,
          paddingBottomRight,
          animate: false,
        });
      } else {
        mapInstance.setView([1.3521, 103.8198], 11, { animate: false });
      }
    },
    [
      mapInstance,
      isSidebarOpen,
      // re-fit whenever filters/year/search change the displayed shapes
      year,
      typeFilter,
      partyContestedFilter,
      partyWinnerFilter,
      search,
      // re-fit after data arrives
      activeGeo,
      filteredGeo,
    ],
  );

  const matchedCount =
    filteredGeo && Array.isArray(filteredGeo.features)
      ? filteredGeo.features.length
      : 0;
  const totalCount =
    activeGeo && Array.isArray(activeGeo.features)
      ? activeGeo.features.length
      : 0;
  const geoJsonKey = useMemo(
    function () {
      const q = upperTrim(search);
      const summarySize = activeSummary ? activeSummary.size : 0;

      // This forces a remount whenever filters/search/year/summary changes
      return [
        year,
        typeFilter,
        upperTrim(partyContestedFilter),
        upperTrim(partyWinnerFilter),
        q,
        summarySize,
        matchedCount, // optional but helps when geometry set changes
      ].join("|");
    },
    [
      year,
      typeFilter,
      partyContestedFilter,
      partyWinnerFilter,
      search,
      activeSummary,
      matchedCount,
    ],
  );
  const navBarHeight = 70;

  return (
    <div
      className={
        isSidebarOpen ? "map-shell sidebar-open" : "map-shell sidebar-collapsed"
      }
      style={{ height: `calc(100vh - ${navBarHeight}px)` }}
    >
      <button
        type="button"
        className="sidebar-edge-toggle"
        onClick={handleToggleSidebar}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        title={isSidebarOpen ? "Collapse" : "Expand"}
      >
        {isSidebarOpen ? "‹" : "›"}
      </button>

      <aside
        ref={sidebarRef}
        className={isSidebarOpen ? "map-sidebar open" : "map-sidebar collapsed"}
      >
        <div className="map-sidebar-top">
          <div className="map-sidebar-top-row">
            <div className="map-sidebar-title">Filters</div>

            <button
              type="button"
              className="filters-reset-btn"
              onClick={resetFilters}
              title="Reset filters"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="map-sidebar-body">
          <div className="field">
            <div className="label">Year</div>
            <TypeaheadSelectBox
              value={String(year)}
              options={yearOptions}
              placeholder={String(year)}
              direction="down"
              onSelect={function (picked) {
                // allow typing exact year, but keep it safe
                const n = Number(picked);
                if (Number.isFinite(n)) {
                  setYear(n);
                }
              }}
            />
          </div>

          <div className="field">
            <div className="label">Constituency type</div>
            <TypeaheadSelectBox
              value={typeFilter}
              options={typeOptions}
              placeholder="ALL"
              direction="down"
              onSelect={function (picked) {
                setTypeFilter(String(picked));
              }}
            />
          </div>

          <div className="field">
            <div className="label">Contested Party</div>
            <TypeaheadSelectBox
              value={partyContestedFilter}
              options={partySelectOptions}
              placeholder="ALL"
              direction="up"
              onSelect={function (picked) {
                setPartyContestedFilter(String(picked));
              }}
            />
          </div>

          <div className="field">
            <div className="label">Winner Party</div>
            <TypeaheadSelectBox
              value={partyWinnerFilter}
              options={partySelectOptions}
              placeholder="ALL"
              direction="up"
              onSelect={function (picked) {
                setPartyWinnerFilter(String(picked));
              }}
            />
          </div>

          <div className="field">
            <div className="label">Constituency</div>
            <TypeaheadSelectBox
              value={search}
              options={constituencyOptions}
              placeholder="ALL"
              direction="up"
              onSelect={function (pickedKey) {
                setSearch(String(pickedKey));
              }}
            />
          </div>

          <div className="map-sidebar-status" style={{ marginTop: 12 }}>
            {loading ? <div>Loading data…</div> : null}
            {errorText ? (
              <div style={{ color: "crimson" }}>{errorText}</div>
            ) : null}

            {!loading && !errorText ? (
              <div>
                Matched areas: <b>{matchedCount}</b> / <b>{totalCount}</b>.
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="map-pane">
        <MapContainer
          center={[1.32, 103.8198]}
          zoom={10.5}
          style={{ height: "100%", width: "100%" }}
          whenCreated={function (map) {
            setMapInstance(map);
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredGeo ? (
            <GeoJSON
              key={geoJsonKey}
              data={filteredGeo}
              style={geoStyle}
              onEachFeature={onEachFeature}
            />
          ) : null}
        </MapContainer>
        <div className="map-legend" aria-label="Party legend">
          <div className="map-legend-title">Party colours</div>

          <div className="map-legend-grid">
            {legendParties.map(function (p) {
              return (
                <div key={p} className="map-legend-item" title={partyLabel(p)}>
                  <span
                    className="map-legend-dot"
                    style={{ background: colourForParty(p) }}
                  />
                  <span className="map-legend-code">{p}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
