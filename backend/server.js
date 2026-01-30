require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const { createProxyMiddleware } = require("http-proxy-middleware");

const { buildPool } = require("./db");
const { signToken, requireAuth } = require("./auth");
const boundaryDatasets = require("./constants/boundaryDatasets");
const {
  pollDownloadUrl,
  fetchGeoJsonFromSignedUrl,
} = require("./services/dataGov");

const app = express();
const pool = buildPool();
app.use(cookieParser());
// --- Reverse proxy: mount Dash under /dash ---
app.use(
  "/dash",
  createProxyMiddleware({
    target: "http://127.0.0.1:8050",
    changeOrigin: true,
    ws: true,
    xfwd: true,

    // IMPORTANT: Express strips "/dash" before the middleware sees it.
    // Dash is configured to serve under "/dash/", so we must add it back.
    pathRewrite: function (path, req) {
      const rewritten = "/dash" + path;
      console.log("[proxy] req.originalUrl:", req.originalUrl);
      console.log("[proxy] req.url:", req.url);
      console.log("[proxy] incoming path:", path);
      console.log("[proxy] rewritten path:", rewritten);
      return rewritten;
    },

    onProxyReq: function (proxyReq, req, res) {
      const cookieHeader = req.headers.cookie || "";
      console.log("[proxy] forwarding cookies (first 200):", cookieHeader.slice(0, 200));

      if (req.headers.cookie) {
        proxyReq.setHeader("cookie", req.headers.cookie);
      }
    },

    onProxyRes: function (proxyRes, req, res) {
      console.log("[proxy] dash response status:", proxyRes.statusCode);
    },

    onError: function (err, req, res) {
      console.log("[proxy] ERROR:", err && err.message ? err.message : err);
    },
  }),
);


app.use(express.json());


app.use(function (req, res, next) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const referer = req.headers.referer;

  console.log("---- INCOMING REQUEST ----");
  console.log("time:", new Date().toISOString());
  console.log("method:", req.method);
  console.log("url:", req.originalUrl);
  console.log("host:", host);
  console.log("origin:", origin);
  console.log("referer:", referer);

  const cookieHeader = req.headers.cookie || "";
  console.log("cookie header (first 200):", cookieHeader.slice(0, 200));
  console.log("parsed cookies keys:", Object.keys(req.cookies || {}));
  console.log("has token cookie:", Boolean(req.cookies && req.cookies.token));

  res.on("finish", function () {
    console.log("status:", res.statusCode);
    console.log("---- END REQUEST ----");
  });

  next();
});

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4000",
  "http://127.0.0.1:4000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow tools like curl / server-to-server calls (no Origin header)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.set("etag", false);
// --- Auth: login ---
app.post("/api/auth/login", async (req, res) => {
  try {
    let username = String(req.body.username || "").trim();
    let password = String(req.body.password || "");

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required." });
      return;
    }

    const [rows] = await pool.query(
      "SELECT id, username, password_hash, role_name, area FROM users WHERE username = ?",
      [username],
    );

    if (rows.length === 0) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const token = signToken(user);

    const isProd = process.env.NODE_ENV === "production";

res.cookie("token", token, {
  httpOnly: true,
  sameSite: "lax",
  path: "/", // IMPORTANT so it applies to /dash too
});


    res.json({
      username: user.username,
      role_name: user.role_name,
      area: user.area,
    });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// --- Auth: logout ---
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", {
    path: "/",
    sameSite: "none",
    secure: false,
  });

  res.json({ message: "Logged out." });
});

// --- Auth: whoami (Dash and React can use this) ---
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/proxy", async function (req, res) {
  try {
    const url = String(req.query.url || "");
    if (!url) {
      res.status(400).json({ message: "url is required" });
      return;
    }

    // basic safety: only allow the expected host
const allowedPrefixes = [
  "https://s3.ap-southeast-1.amazonaws.com/blobs.data.gov.sg/",
  "https://s3.",
  "https://s3.ap-southeast-1.amazonaws.com/table-downloads-ingest.data.gov.sg/",
];

const ok = allowedPrefixes.some((p) => url.startsWith(p));
if (!ok) {
  res.status(400).json({ message: "invalid proxy target" });
  return;
}

    const upstream = await fetch(url);
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(502).send(text);
      return;
    }

    res.setHeader("Content-Type", "application/geo+json");
    const body = await upstream.text();
    res.send(body);
  } catch (err) {
    res.status(500).json({ message: String(err && err.message ? err.message : err) });
  }
});

app.get("/api/boundaries", requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year);
    if (!Number.isFinite(year)) {
      res.status(400).json({ message: "year is required (number)." });
      return;
    }

    const datasetId = boundaryDatasets[year];
    if (!datasetId) {
      res
        .status(400)
        .json({ message: `No boundary dataset configured for year ${year}.` });
      return;
    }

    const signedUrl = await pollDownloadUrl(datasetId);
    const geojson = await fetchGeoJsonFromSignedUrl(signedUrl);

    // Role restriction:
    // - government: return all
    // - civilian: filter features to their area
    const roleName = req.user.role_name;
    const userArea = String(req.user.area || "")
      .trim()
      .toUpperCase();

    if (roleName === "civilian") {
      const features = Array.isArray(geojson.features) ? geojson.features : [];
      const filtered = features.filter((f) => {
        const props = f && f.properties ? f.properties : {};
        const name = String(props.Name || props.ED_DESC || "")
          .trim()
          .toUpperCase();
        return name === userArea;
      });

      res.json({
        ...geojson,
        features: filtered,
      });
      return;
    }

    res.json(geojson);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch boundaries." });
  }
});

app.get("/api/public/collections/ge-results", requireAuth, async (req, res) => {
  try {
    const url =
      "https://api-production.data.gov.sg/v2/public/api/collections/1531/metadata";
    const upstream = await fetch(url, { method: "GET" });

    if (!upstream.ok) {
      const text = await upstream.text();
      res
        .status(502)
        .json({ message: `metadata fetch failed: ${upstream.status} ${text}` });
      return;
    }

    const json = await upstream.json();
    res.json(json);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch collection metadata." });
  }
});

// --- Example API: election results (for dashboard) ---
app.get("/api/results", requireAuth, async (req, res) => {
  const year = Number(req.query.year);
  const constituency = String(req.query.constituency || "").trim();

  if (!Number.isFinite(year)) {
    res.status(400).json({ message: "year is required." });
    return;
  }

  // Simple example: count votes by party
  let sql = `
    SELECT p.party_name AS party, COUNT(v.id) AS vote_count
    FROM votes v
    JOIN parties p ON p.id = v.party_id
    JOIN constituencies c ON c.id = v.constituency_id
    WHERE v.year = ?
  `;
  const params = [year];

  if (constituency) {
    sql += " AND c.name = ? ";
    params.push(constituency);
  }

  sql += " GROUP BY p.party_name ORDER BY vote_count DESC ";

  const [rows] = await pool.query(sql, params);
  res.json({ rows });
});
app.get("/api/dashboard/constituencies", requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year);
    if (!Number.isFinite(year)) {
      res.status(400).json({ message: "year is required (number)." });
      return;
    }

    const [rows] = await pool.query(
      "SELECT DISTINCT constituency FROM ge_summary WHERE year = ? ORDER BY constituency ASC",
      [year]
    );

    res.json({
      constituencies: rows.map((r) => String(r.constituency)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load constituencies." });
  }
});

app.get("/api/auth/probe", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: req.user,
    cookies: Object.keys(req.cookies || {}),
  });
});




app.get("/", (req, res) => {
  res.send("Backend is running.");
});

app.listen(Number(process.env.PORT), () => {
  console.log(`Backend listening on port ${process.env.PORT}`);
});

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
});

app.get("/api/dashboard/years", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT year FROM ge_summary ORDER BY year DESC",
    );
    res.json({ years: rows.map((r) => Number(r.year)) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load years." });
  }
});

app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year);
    const party = String(req.query.party || "All");
    const q = String(req.query.q || "").trim();

    const params = [year];
    let where = "WHERE year = ?";

    if (party && party !== "All") {
      where += " AND winner_party = ?";
      params.push(party);
    }
    if (q) {
      where += " AND constituency LIKE ?";
      params.push(`%${q}%`);
    }

    const [[row]] = await pool.query(
      `
      SELECT
        COUNT(*) AS electionsCount,
        AVG(turnout_pct) AS turnoutPct
      FROM ge_summary
      ${where}
      `,
      params,
    );

    res.json({
      electionsCount: Number(row.electionsCount || 0),
      turnoutPct: Number(row.turnoutPct || 0),
      year,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load summary." });
  }
});

app.get("/api/dashboard/rows", requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year);
    const party = String(req.query.party || "All");
    const q = String(req.query.q || "").trim();

    const params = [year];
    let where = "WHERE year = ?";

    if (party && party !== "All") {
      where += " AND winner_party = ?";
      params.push(party);
    }
    if (q) {
      where += " AND constituency LIKE ?";
      params.push(`%${q}%`);
    }

    const [rows] = await pool.query(
      `
      SELECT
        constituency,
        constituency_type AS type,
        winner_party AS winner,
        margin_pct AS marginPct
      FROM ge_summary
      ${where}
      ORDER BY constituency ASC
      `,
      params,
    );

    const [topRows] = await pool.query(
      `
      SELECT constituency, party, rank_no
      FROM ge_top_parties
      WHERE year = ?
      ORDER BY constituency ASC, rank_no ASC
      `,
      [year],
    );

    const topMap = new Map();
    for (const tr of topRows) {
      const key = tr.constituency;
      if (!topMap.has(key)) topMap.set(key, []);
      if (topMap.get(key).length < 3) topMap.get(key).push(tr.party);
    }

    res.json({
      rows: rows.map((r) => ({
        constituency: r.constituency,
        type: r.type,
        winner: r.winner,
        marginPct: Number(r.marginPct || 0),
        topParties: topMap.get(r.constituency) || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load rows." });
  }
});
