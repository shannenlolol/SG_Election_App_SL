const { buildPool } = require("../db");
const pool = buildPool();

/**
 * GET /api/boundaries?year=2025
 * Returns the full FeatureCollection stored in ge_boundaries.geojson
 */
async function getBoundariesByYear(req, res) {
  try {
    const year = Number(req.query.year);

    if (!Number.isFinite(year)) {
      res.status(400).json({ message: "year is required (number)." });
      return;
    }

    const [rows] = await pool.execute(
      `
      SELECT geojson
      FROM ge_boundaries
      WHERE year = ?
      LIMIT 1
      `,
      [year],
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({
        message: `No boundaries found for year ${year}. Run sync_data_gov_sg.mjs to populate ge_boundaries.`,
      });
      return;
    }

    const raw = rows[0].geojson;
    const geojson = typeof raw === "string" ? JSON.parse(raw) : raw;

    res.json(geojson);
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

/**
 * GET /api/boundaries/feature?year=2025&constituency=ALJUNIED
 * Reads pre-extracted feature from ge_boundary_features (optional table).
 * If you don't want this endpoint, you can remove it.
 */
async function getBoundaryFeature(req, res) {
  try {
    const year = Number(req.query.year);
    const constituency = String(req.query.constituency || "").trim();

    if (!Number.isFinite(year) || !constituency) {
      res.status(400).json({ message: "year and constituency are required." });
      return;
    }

    const [rows] = await pool.execute(
      `
      SELECT constituency, constituency_type, properties, geometry,
             min_lng, min_lat, max_lng, max_lat
      FROM ge_boundary_features
      WHERE year = ? AND constituency = ?
      LIMIT 1
      `,
      [year, constituency],
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: "Feature not found." });
      return;
    }

    const r = rows[0];
    const props = typeof r.properties === "string" ? JSON.parse(r.properties) : (r.properties || {});
    const geom = typeof r.geometry === "string" ? JSON.parse(r.geometry) : r.geometry;

    res.json({
      type: "Feature",
      properties: props,
      geometry: geom,
      bbox:
        r.min_lng !== null
          ? [r.min_lng, r.min_lat, r.max_lng, r.max_lat]
          : null,
      meta: {
        year,
        constituency: r.constituency,
        constituency_type: r.constituency_type || null,
      },
    });
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

/**
 * GET /api/boundaries/summary?year=2025
 *
 * This replaces your frontend CSV parsing.
 * It returns everything MapPage needs for:
 * - winner party
 * - margin %
 * - top parties
 * - per-party candidates + vote %
 *
 * Output format matches what your MapPage expects (easy to adapt into a Map()).
 */
async function getMapSummaryByYear(req, res) {
  try {
    const year = Number(req.query.year);

    if (!Number.isFinite(year)) {
      res.status(400).json({ message: "year is required (number)." });
      return;
    }

    // 1) Per-constituency party breakdown + candidates
    //    We compute vote_share from vote_count totals within each constituency.
    const [partyRows] = await pool.execute(
      `
      SELECT
        t.constituency,
        t.party,
        t.vote_count,
        CASE
          WHEN SUM(t.vote_count) OVER (PARTITION BY t.constituency) = 0 THEN NULL
          ELSE t.vote_count / SUM(t.vote_count) OVER (PARTITION BY t.constituency)
        END AS vote_share,
        t.candidates
      FROM (
        SELECT
          r.constituency,
          r.party,
          SUM(COALESCE(r.vote_count, 0)) AS vote_count,
          GROUP_CONCAT(DISTINCT r.candidates ORDER BY r.candidates SEPARATOR "; ") AS candidates
        FROM ge_candidate_results r
        WHERE r.year = ?
        GROUP BY r.constituency, r.party
      ) t
      ORDER BY t.constituency ASC, t.vote_count DESC
      `,
      [year],
    );

    // 2) Winner + margin + constituency_type (from your derived table ge_summary)
    const [summaryRows] = await pool.execute(
      `
      SELECT
        year,
        constituency,
        constituency_type,
        winner_party,
        margin_pct
      FROM ge_summary
      WHERE year = ?
      `,
      [year],
    );

    // 3) Top 3 parties per constituency (from ge_top_parties)
    const [topRows] = await pool.execute(
      `
      SELECT
        constituency,
        party,
        rank_no
      FROM ge_top_parties
      WHERE year = ?
      ORDER BY constituency ASC, rank_no ASC
      `,
      [year],
    );

    // Build: constituency -> entry
    const byConst = new Map();

    for (const s of summaryRows) {
      byConst.set(String(s.constituency || "").trim().toUpperCase(), {
        constituency: s.constituency,
        constituencyType: s.constituency_type || "",
        winnerParty: s.winner_party || "",
        marginPct: s.margin_pct === null ? null : Number(s.margin_pct),
        topParties: [],
        parties: {}, // party -> { votePct, candidates[] }
      });
    }

    // Attach top parties
    for (const r of topRows) {
      const key = String(r.constituency || "").trim().toUpperCase();
      const entry = byConst.get(key);
      if (!entry) continue;

      if (r.party) {
        entry.topParties.push(String(r.party));
      }
    }

    // Attach party breakdown
    for (const r of partyRows) {
      const key = String(r.constituency || "").trim().toUpperCase();
      let entry = byConst.get(key);

      // In case ge_summary doesn't have this constituency (edge cases), create a fallback entry.
      if (!entry) {
        entry = {
          constituency: r.constituency,
          constituencyType: "",
          winnerParty: "",
          marginPct: null,
          topParties: [],
          parties: {},
        };
        byConst.set(key, entry);
      }

      const party = String(r.party || "").trim();
      const voteShare = r.vote_share === null ? null : Number(r.vote_share);
      const votePct = voteShare === null ? null : voteShare * 100;

      const candStr = String(r.candidates || "").trim();
      const candList = candStr
        ? candStr
            .split(";")
            .map((x) => String(x).trim())
            .filter((x) => x.length > 0)
        : [];

      entry.parties[party] = {
        votePct: votePct,
        candidates: candList,
      };
    }

    // Parties list for filter dropdown
    const [partyListRows] = await pool.execute(
      `
      SELECT DISTINCT party
      FROM ge_candidate_results
      WHERE year = ?
      ORDER BY party ASC
      `,
      [year],
    );

    res.json({
      year,
      parties: partyListRows.map((r) => String(r.party)),
      entries: Array.from(byConst.values()),
    });
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

module.exports = {
  getBoundariesByYear,
  getBoundaryFeature,
  getMapSummaryByYear,
};
