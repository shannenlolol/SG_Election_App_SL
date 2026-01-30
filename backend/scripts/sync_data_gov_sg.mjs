import "dotenv/config";
import mysql from "mysql2/promise";

// 1. List of Political Parties
// abbreviation, political_party
const DATASET_PARTIES = "d_ef163fd9ebc3c2f21032c29da3bd3f77";

// 2. Registered Electors, Rejected Votes and Spoilt Ballots
// year, constituency, no_of_registered_electors, no_of_rejected_votes, no_of_spoilt_ballot_papers
const DATASET_ELECTORS = "d_fdfb854fcb7428b29734d2e0c0674220";

// 3. Election Dates
// year, nomination_day, polling_day
const DATASET_DATES = "d_00d89e5d100a612e36432d91493785bd";

// 4. Results by Candidate
// year, constituency, constituency_type, candidates, party, vote_count, vote_percentage
const DATASET_RESULTS = "d_581a30bee57fa7d8383d6bc94739ad00";

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function fetchJsonWithRetry(url, options) {
  const maxAttempts = 6;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;

    const res = await fetch(url, options);

    if (res.ok) {
      return await res.json();
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      let waitMs = 800 * Math.pow(2, attempt - 1);

      if (retryAfter) {
        const asNumber = Number(retryAfter);
        if (Number.isFinite(asNumber) && asNumber > 0) {
          waitMs = asNumber * 1000;
        }
      }

      await sleep(waitMs);
      continue;
    }

    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  throw new Error(`HTTP 429 persisted after retries for ${url}`);
}

async function fetchAllRows(datasetId) {
  const base = "https://data.gov.sg/api/action/datastore_search";
  const limit = 5000;
  let offset = 0;
  let all = [];

  while (true) {
    const url = new URL(base);
    url.searchParams.set("resource_id", datasetId);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const json = await fetchJsonWithRetry(url.toString(), { method: "GET" });

    const records =
      json && json.result && Array.isArray(json.result.records)
        ? json.result.records
        : [];
    all = all.concat(records);

    const total = Number(json && json.result ? json.result.total : 0);
    offset += records.length;

    if (records.length === 0 || offset >= total) {
      break;
    }
  }

  return all;
}

function toInt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toFloat(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function toDate(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  return s.slice(0, 10);
}

async function getTableColumns(db, tableName) {
  const sql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `;
  const [rows] = await db.execute(sql, [tableName]);

  const set = new Set();
  for (const r of rows) {
    if (r && r.COLUMN_NAME) {
      set.add(String(r.COLUMN_NAME));
    }
  }
  return set;
}

function chooseElectorColumnMap(columns) {
  // Prefer the API-aligned names if your table has them.
  // Otherwise fall back to the older names your current script used.
  const map = {
    registered: null,
    rejected: null,
    spoilt: null,
  };

  if (columns.has("no_of_registered_electors")) {
    map.registered = "no_of_registered_electors";
  } else if (columns.has("registered_electors")) {
    map.registered = "registered_electors";
  }

  if (columns.has("no_of_rejected_votes")) {
    map.rejected = "no_of_rejected_votes";
  } else if (columns.has("rejected_votes")) {
    map.rejected = "rejected_votes";
  }

  if (columns.has("no_of_spoilt_ballot_papers")) {
    map.spoilt = "no_of_spoilt_ballot_papers";
  } else if (columns.has("spoilt_ballots")) {
    map.spoilt = "spoilt_ballots";
  }

  return map;
}

function choosePartiesColumnMap(columns) {
  const map = { abbr: null, name: null };

  if (columns.has("abbreviation")) {
    map.abbr = "abbreviation";
  } else if (columns.has("party")) {
    map.abbr = "party";
  }

  if (columns.has("political_party")) {
    map.name = "political_party";
  } else if (columns.has("party_name")) {
    map.name = "party_name";
  }

  return map;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "app_user",
    password: process.env.DB_PASSWORD || "app_password",
    database: process.env.DB_NAME || "election_db",
  });

  // ---- Introspect current table schemas (so we insert into the correct columns) ----
  const electorCols = await getTableColumns(db, "ge_elector_stats");
  const partiesCols = await getTableColumns(db, "political_parties");

  const electorMap = chooseElectorColumnMap(electorCols);
  const partiesMap = choosePartiesColumnMap(partiesCols);

  if (!electorMap.registered || !electorMap.rejected || !electorMap.spoilt) {
    console.log(
      "Warning: Could not fully resolve ge_elector_stats column mapping:",
      electorMap,
    );
  }

  if (!partiesMap.abbr || !partiesMap.name) {
    console.log(
      "Warning: Could not fully resolve political_parties column mapping:",
      partiesMap,
    );
  }

  // 1) Results by candidate (API headers are snake_case as per your comment)
  console.log("Fetching results by candidate...");
  const results = await fetchAllRows(DATASET_RESULTS);

  console.log("Upserting ge_candidate_results...");
  const insertResultsSql = `
    INSERT INTO ge_candidate_results
      (year, constituency, constituency_type, candidates, party, vote_count, vote_percentage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      constituency_type = VALUES(constituency_type),
      candidates = VALUES(candidates),
      vote_count = VALUES(vote_count),
      vote_percentage = VALUES(vote_percentage)
  `;

  for (const r of results) {
    const year = toInt(r.year);
    const constituency = String(r.constituency || "").trim();
    const ctype = String(r.constituency_type || "").trim() || null;
    const candidates = String(r.candidates || "").trim() || null;
    const party = String(r.party || "").trim();
    const voteCount = toInt(r.vote_count);
    const votePct = toFloat(r.vote_percentage);

    if (!year || !constituency || !party) {
      continue;
    }

    await db.execute(insertResultsSql, [
      year,
      constituency,
      ctype,
      candidates,
      party,
      voteCount,
      votePct,
    ]);
  }

  // 2) Elector stats (API headers are snake_case as per your comment)
  console.log("Fetching elector stats...");
  const electors = await fetchAllRows(DATASET_ELECTORS);

  console.log("Upserting ge_elector_stats...");
  const registeredCol = electorMap.registered || "registered_electors";
  const rejectedCol = electorMap.rejected || "rejected_votes";
  const spoiltCol = electorMap.spoilt || "spoilt_ballots";

  const insertElectorsSql = `
    INSERT INTO ge_elector_stats
      (year, constituency, ${registeredCol}, ${rejectedCol}, ${spoiltCol})
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ${registeredCol} = VALUES(${registeredCol}),
      ${rejectedCol} = VALUES(${rejectedCol}),
      ${spoiltCol} = VALUES(${spoiltCol})
  `;

  for (const r of electors) {
    const year = toInt(r.year);
    const constituency = String(r.constituency || "").trim();

    const registered = toInt(r.no_of_registered_electors);
    const rejected = toInt(r.no_of_rejected_votes);
    const spoilt = toInt(r.no_of_spoilt_ballot_papers);

    if (!year || !constituency) {
      continue;
    }

    await db.execute(insertElectorsSql, [
      year,
      constituency,
      registered,
      rejected,
      spoilt,
    ]);
  }

  // 3) Election dates (API headers are snake_case as per your comment)
  console.log("Fetching election dates...");
  const dates = await fetchAllRows(DATASET_DATES);

  console.log("Upserting ge_dates...");
  const insertDatesSql = `
    INSERT INTO ge_dates (year, nomination_day, polling_day)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      nomination_day = VALUES(nomination_day),
      polling_day = VALUES(polling_day)
  `;

  for (const r of dates) {
    const year = toInt(r.year);
    const nomination = toDate(r.nomination_day);
    const polling = toDate(r.polling_day);

    if (!year) {
      continue;
    }

    await db.execute(insertDatesSql, [year, nomination, polling]);
  }

  // 4) Parties list (API headers are snake_case as per your comment)
  console.log("Fetching parties list...");
  const parties = await fetchAllRows(DATASET_PARTIES);

  console.log("Upserting political_parties...");
  const abbrCol = partiesMap.abbr || "party";
  const nameCol = partiesMap.name || "party_name";

  const insertPartiesSql = `
    INSERT INTO political_parties (${abbrCol}, ${nameCol})
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      ${nameCol} = VALUES(${nameCol})
  `;

  for (const r of parties) {
    const abbr = String(r.abbreviation || "").trim();
    const fullName = String(r.political_party || "").trim() || null;

    if (!abbr) {
      continue;
    }

    await db.execute(insertPartiesSql, [abbr, fullName]);
  }

  // ---- Derived summary tables for dashboard (winner + margin + turnout) ----
  console.log("Refreshing derived summary tables...");
  await db.query("DELETE FROM ge_top_parties");
  await db.query("DELETE FROM ge_summary");

  // Turnout uses: valid votes + rejected + spoilt, divided by registered.
  // vote_percentage in dataset is a fraction (0..1), so margin stored as percentage points here.
  const refreshSql = `
  INSERT INTO ge_summary (year, constituency, constituency_type, winner_party, margin_pct, turnout_pct)
  SELECT
    s.year,
    s.constituency,
    s.constituency_type,
    s.winner_party,
    (s.winner_share - s.runnerup_share) * 100 AS margin_pct,
    CASE
      WHEN e.${registeredCol} IS NULL OR e.${registeredCol} = 0 THEN NULL
      ELSE (
        (
          s.total_valid_votes
          + COALESCE(e.${rejectedCol}, 0)
          + COALESCE(e.${spoiltCol}, 0)
        ) / e.${registeredCol}
      ) * 100
    END AS turnout_pct
  FROM (
    SELECT
      x.year,
      x.constituency,
      MAX(x.constituency_type) AS constituency_type,
      SUM(x.party_votes) AS total_valid_votes,

      SUBSTRING_INDEX(
        GROUP_CONCAT(x.party ORDER BY x.party_votes DESC SEPARATOR ','),
        ',', 1
      ) AS winner_party,

      -- shares computed off party vote totals
      MAX(x.party_votes / NULLIF(x.total_votes, 0)) AS winner_share,

      CAST(
        SUBSTRING_INDEX(
          SUBSTRING_INDEX(
            GROUP_CONCAT(x.party_votes / NULLIF(x.total_votes, 0) ORDER BY x.party_votes DESC SEPARATOR ','),
            ',', 2
          ),
          ',', -1
        ) AS DECIMAL(10, 6)
      ) AS runnerup_share
    FROM (
      SELECT
        p.year,
        p.constituency,
        p.party,
        MAX(p.constituency_type) AS constituency_type,
        SUM(COALESCE(p.vote_count, 0)) AS party_votes,
        SUM(SUM(COALESCE(p.vote_count, 0))) OVER (PARTITION BY p.year, p.constituency) AS total_votes
      FROM ge_candidate_results p
      GROUP BY p.year, p.constituency, p.party
    ) x
    GROUP BY x.year, x.constituency
  ) s
  LEFT JOIN ge_elector_stats e
    ON e.year = s.year AND e.constituency = s.constituency
`;
  await db.query(refreshSql);

  const topSql = `
  INSERT INTO ge_top_parties (year, constituency, party, rank_no)
  SELECT
    x.year,
    x.constituency,
    x.party,
    x.rank_no
  FROM (
    SELECT
      r.year,
      r.constituency,
      r.party,
      DENSE_RANK() OVER (
        PARTITION BY r.year, r.constituency
        ORDER BY SUM(COALESCE(r.vote_count, 0)) DESC
      ) AS rank_no
    FROM ge_candidate_results r
    GROUP BY r.year, r.constituency, r.party
  ) x
  WHERE x.rank_no <= 3
`;
  await db.query(topSql);

  await db.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
