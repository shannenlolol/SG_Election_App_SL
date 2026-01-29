import "dotenv/config";
import mysql from "mysql2/promise";

const DATASET_PARTIES = "d_ef163fd9ebc3c2f21032c29da3bd3f77";
const DATASET_ELECTORS = "d_fdfb854fcb7428b29734d2e0c0674220";
const DATASET_DATES = "d_00d89e5d100a612e36432d91493785bd";
const DATASET_RESULTS = "d_581a30bee57fa7d8383d6bc94739ad00";

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

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${datasetId}`);
    const json = await res.json();

    const records = json?.result?.records || [];
    all = all.concat(records);

    const total = Number(json?.result?.total || 0);
    offset += records.length;

    if (records.length === 0 || offset >= total) break;
  }

  return all;
}

function toInt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toFloat(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
  }
  return undefined;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "app_user",
    password: process.env.DB_PASSWORD || "app_password",
    database: process.env.DB_NAME || "election_db",
  });

  // 1) Results by candidate
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
    const year = toInt(pick(r, ["Year", "year"]));
    const constituency = String(pick(r, ["Constituency", "constituency"]) || "").trim();
    const ctype = String(pick(r, ["Constituency Type", "constituency_type"]) || "").trim() || null;
    const candidates = String(pick(r, ["Candidates", "candidates"]) || "").trim() || null;
    const party = String(pick(r, ["Party", "party"]) || "").trim();
    const voteCount = toInt(pick(r, ["Vote Count", "vote_count"]));
    const votePct = toFloat(pick(r, ["Vote Percentage", "vote_percentage"]));

    if (!year || !constituency || !party) continue;
    await db.execute(insertResultsSql, [year, constituency, ctype, candidates, party, voteCount, votePct]);
  }

  // 2) Elector stats
  console.log("Fetching elector stats...");
  const electors = await fetchAllRows(DATASET_ELECTORS);

  console.log("Upserting ge_elector_stats...");
  const insertElectorsSql = `
    INSERT INTO ge_elector_stats
      (year, constituency, registered_electors, rejected_votes, spoilt_ballots)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      registered_electors = VALUES(registered_electors),
      rejected_votes = VALUES(rejected_votes),
      spoilt_ballots = VALUES(spoilt_ballots)
  `;

  // Keys in this dataset can vary slightly; we match common variants defensively:
  for (const r of electors) {
    const year = toInt(pick(r, ["Year", "year"]));
    const constituency = String(pick(r, ["Constituency", "constituency"]) || "").trim();

    const registered = toInt(pick(r, ["Registered Electors", "registered_electors", "registered_elector"]));
    const rejected = toInt(pick(r, ["Rejected Votes", "rejected_votes", "rejected_vote"]));
    const spoilt = toInt(pick(r, ["Spoilt Ballots", "spoilt_ballots", "spoilt_ballot"]));

    if (!year || !constituency) continue;
    await db.execute(insertElectorsSql, [year, constituency, registered, rejected, spoilt]);
  }

  // 3) Election dates
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

  function toDate(v) {
    const s = String(v || "").trim();
    if (!s) return null;
    // Expecting YYYY-MM-DD or similar from dataset; if not, store null and fix later
    return s.slice(0, 10);
  }

  for (const r of dates) {
    const year = toInt(pick(r, ["Year", "year"]));
    const nomination = toDate(pick(r, ["Nomination Day", "nomination_day"]));
    const polling = toDate(pick(r, ["Polling Day", "polling_day"]));

    if (!year) continue;
    await db.execute(insertDatesSql, [year, nomination, polling]);
  }

  // 4) Parties list
  console.log("Fetching parties list...");
  const parties = await fetchAllRows(DATASET_PARTIES);

  console.log("Upserting political_parties...");
  const insertPartiesSql = `
    INSERT INTO political_parties (party, party_name)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      party_name = VALUES(party_name)
  `;

  for (const r of parties) {
    const party = String(pick(r, ["Party", "party", "Abbreviation", "abbreviation"]) || "").trim();
    const name = String(pick(r, ["Party Name", "party_name", "Name", "name"]) || "").trim() || null;
    if (!party) continue;
    await db.execute(insertPartiesSql, [party, name]);
  }

  console.log("Refreshing derived summary tables...");
  await db.query("DELETE FROM ge_top_parties");
  await db.query("DELETE FROM ge_summary");

  // Build winner, margin, top3 parties and turnout
const refreshSql = `
  INSERT INTO ge_summary (year, constituency, constituency_type, winner_party, margin_pct, turnout_pct)
  SELECT
    t.year,
    t.constituency,
    t.constituency_type,
    t.winner_party,
    (t.winner_pct - t.runnerup_pct) AS margin_pct,
    CASE
      WHEN e.registered_electors IS NULL OR e.registered_electors = 0 THEN NULL
      ELSE ((t.total_valid_votes + COALESCE(e.rejected_votes,0)) / e.registered_electors) * 100
    END AS turnout_pct
  FROM (
    SELECT
      r.year,
      r.constituency,
      MAX(r.constituency_type) AS constituency_type,

      -- total votes for turnout
      SUM(COALESCE(r.vote_count, 0)) AS total_valid_votes,

      -- winner = party with max vote_percentage
      SUBSTRING_INDEX(
        GROUP_CONCAT(r.party ORDER BY r.vote_percentage DESC SEPARATOR ','),
        ',', 1
      ) AS winner_party,

      -- winner pct = max
      MAX(r.vote_percentage) AS winner_pct,

      -- runner-up pct = 2nd highest
      SUBSTRING_INDEX(
        SUBSTRING_INDEX(
          GROUP_CONCAT(r.vote_percentage ORDER BY r.vote_percentage DESC SEPARATOR ','),
          ',', 2
        ),
        ',', -1
      ) AS runnerup_pct
    FROM ge_candidate_results r
    WHERE r.vote_percentage IS NOT NULL
    GROUP BY r.year, r.constituency
  ) t
  LEFT JOIN ge_elector_stats e
    ON e.year = t.year AND e.constituency = t.constituency
`;
await db.query(refreshSql);


const topSql = `
  INSERT INTO ge_top_parties (year, constituency, party, rank_no)
  SELECT
    r1.year,
    r1.constituency,
    r1.party,
    (
      SELECT COUNT(*)
      FROM ge_candidate_results r2
      WHERE r2.year = r1.year
        AND r2.constituency = r1.constituency
        AND r2.vote_percentage IS NOT NULL
        AND r2.vote_percentage > r1.vote_percentage
    ) + 1 AS rank_no
  FROM ge_candidate_results r1
  WHERE r1.vote_percentage IS NOT NULL
  HAVING rank_no <= 3
`;
await db.query(topSql);


  await db.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
