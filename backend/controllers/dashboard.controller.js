const { buildPool } = require("../db");
const pool = buildPool();

function splitCsvParam(value) {
  const s = String(value || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map(function (x) {
      return String(x).trim();
    })
    .filter(function (x) {
      return x.length > 0;
    });
}

function buildInClause(values, params) {
  if (!values || values.length === 0) {
    return { sql: "", params };
  }

  const placeholders = values.map(function () {
    return "?";
  });

  for (const v of values) {
    params.push(v);
  }

  return { sql: `(${placeholders.join(",")})`, params };
}

async function getDashboardOptions(req, res) {
  try {
    const [yearsRows] = await pool.query(`
      SELECT DISTINCT year
      FROM ge_summary
      ORDER BY year DESC
    `);

    const [partyRows] = await pool.query(`
      SELECT
        abbreviation,
        political_party AS full_name
      FROM political_parties
      ORDER BY abbreviation ASC
    `);

    const [constRows] = await pool.query(`
      SELECT DISTINCT
        year,
        constituency,
        constituency_type
      FROM ge_summary
      ORDER BY year DESC, constituency ASC
    `);

    res.json({
      years: yearsRows.map(function (r) {
        return Number(r.year);
      }),
      parties: partyRows.map(function (r) {
        return {
          abbreviation: r.abbreviation,
          full_name: r.full_name,
        };
      }),
      constituencies: constRows.map(function (r) {
        return {
          year: Number(r.year),
          constituency: r.constituency,
          constituency_type: r.constituency_type,
        };
      }),
    });
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

async function searchDashboardRows(req, res) {
  try {
    const years = splitCsvParam(req.query.years);
    const winnerParties = splitCsvParam(req.query.winners);
    const types = splitCsvParam(req.query.types);
    const constituencies = splitCsvParam(req.query.constituencies);
    const q = String(req.query.q || "").trim();

    let sql = `
      SELECT
        s.year,
        s.constituency,
        s.constituency_type,
        s.winner_party,
        s.margin_pct,
        s.turnout_pct
      FROM ge_summary s
      WHERE 1 = 1
    `;
    const params = [];

    if (years.length > 0) {
      const built = buildInClause(years, params);
      sql += ` AND s.year IN ${built.sql}`;
    }

    if (winnerParties.length > 0) {
      const built = buildInClause(winnerParties, params);
      sql += ` AND s.winner_party IN ${built.sql}`;
    }

    if (types.length > 0) {
      const built = buildInClause(types, params);
      sql += ` AND s.constituency_type IN ${built.sql}`;
    }

    if (constituencies.length > 0) {
      const built = buildInClause(constituencies, params);
      sql += ` AND s.constituency IN ${built.sql}`;
    }

    if (q) {
      sql += ` AND s.constituency LIKE ?`;
      params.push(`%${q}%`);
    }

    sql += `
      ORDER BY s.year DESC, s.constituency ASC
      LIMIT 800
    `;

    const [rows] = await pool.execute(sql, params);

    res.json({
      rows: rows.map(function (r) {
        return {
          year: Number(r.year),
          constituency: r.constituency,
          constituency_type: r.constituency_type,
          winner_party: r.winner_party,
          margin_pct: r.margin_pct === null ? null : Number(r.margin_pct),
          turnout_pct: r.turnout_pct === null ? null : Number(r.turnout_pct),
        };
      }),
    });
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

async function getDashboardDetails(req, res) {
  try {
    const year = Number(req.query.year);
    const constituency = String(req.query.constituency || "").trim();

    if (!Number.isFinite(year) || !constituency) {
      res.status(400).json({ message: "Missing or invalid year / constituency." });
      return;
    }

    // Party -> full name mapping for tooltip
    const [partyMapRows] = await pool.query(`
      SELECT abbreviation, political_party AS full_name
      FROM political_parties
    `);

    const partyNameMap = {};
    for (const r of partyMapRows) {
      partyNameMap[String(r.abbreviation)] = r.full_name;
    }

    // Party vote breakdown + candidates (party-level aggregate)
    const [partyRows] = await pool.execute(
      `
      SELECT
        r.party,
        SUM(COALESCE(r.vote_count, 0)) AS vote_count,
        CASE
          WHEN SUM(SUM(COALESCE(r.vote_count, 0))) OVER (PARTITION BY r.year, r.constituency) = 0 THEN NULL
          ELSE SUM(COALESCE(r.vote_count, 0)) / SUM(SUM(COALESCE(r.vote_count, 0))) OVER (PARTITION BY r.year, r.constituency)
        END AS vote_share,
        GROUP_CONCAT(DISTINCT r.candidates ORDER BY r.candidates SEPARATOR "; ") AS candidates
      FROM ge_candidate_results r
      WHERE r.year = ?
        AND r.constituency = ?
      GROUP BY r.party
      ORDER BY vote_count DESC
      `,
      [year, constituency],
    );

    // Elector stats (columns per your schema)
    const [electorRows] = await pool.execute(
      `
      SELECT
        year,
        constituency,
        no_of_registered_electors,
        no_of_rejected_votes,
        no_of_spoilt_ballot_papers
      FROM ge_elector_stats
      WHERE year = ?
        AND constituency = ?
      LIMIT 1
      `,
      [year, constituency],
    );

    res.json({
      year,
      constituency,
      parties: partyRows.map(function (r) {
        return {
          party: r.party,
          party_full_name: partyNameMap[String(r.party)] || null,
          vote_count: r.vote_count === null ? null : Number(r.vote_count),
          vote_share: r.vote_share === null ? null : Number(r.vote_share),
          candidates: r.candidates || "",
        };
      }),
      elector: electorRows.length > 0 ? electorRows[0] : null,
    });
  } catch (e) {
    res.status(500).json({ message: String(e && e.message ? e.message : e) });
  }
}

module.exports = {
  getDashboardOptions,
  searchDashboardRows,
  getDashboardDetails,
};
