import Papa from "papaparse";

function upperTrim(value) {
  return String(value || "").trim().toUpperCase();
}

function pick(row, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return row[k];
    }
  }
  return "";
}

export function parseResultsCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message}`);
  }

  return parsed.data;
}

// Build a per-year map keyed by constituency name:
// {
//   "ANG MO KIO": {
//      type: "GRC",
//      parties: {
//        "PAP": { votes: 123, votePct: 78.95, candidates: ["..."] },
//        ...
//      },
//      winnerParty: "PAP",
//      marginPct: 7.04,
//      topParties: ["PAP","WP",...]
//   }
// }
export function buildSummaryForYear(rows, yearNumber) {
  const targetYear = Number(yearNumber);

  const byConst = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];

    const year = Number(pick(r, ["year", "Year", "election_year", "Election Year"]));
    if (!Number.isFinite(year) || year !== targetYear) {
      continue;
    }

    const constituencyRaw = pick(r, ["constituency", "Constituency", "electoral_division", "Electoral Division"]);
    const constituency = upperTrim(constituencyRaw);
    if (!constituency) {
      continue;
    }

    const partyRaw = pick(r, ["party", "Party", "party_name", "Party Name"]);
    const party = String(partyRaw || "").trim();
    if (!party) {
      continue;
    }

    const typeRaw = pick(r, ["constituency_type", "Constituency Type", "type", "Type"]);
    const type = String(typeRaw || "").trim();

    const votesRaw = pick(r, ["votes", "Votes", "vote_count", "Vote Count"]);
    const votes = Number(String(votesRaw || "").replace(/,/g, ""));
    const votePctRaw = pick(r, ["vote_percentage", "Vote Percentage", "vote_pct", "Vote %"]);
    const votePct = Number(String(votePctRaw || "").replace("%", ""));

    const candidatesRaw = pick(r, ["candidates", "Candidates", "candidate", "Candidate", "candidate_names", "Candidate Names"]);
    const candidates = String(candidatesRaw || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });

    if (!byConst.has(constituency)) {
      byConst.set(constituency, {
        constituency: constituency,
        type: type,
        parties: {},
        winnerParty: "",
        marginPct: null,
        topParties: [],
      });
    }

    const entry = byConst.get(constituency);

    entry.type = entry.type || type;

    entry.parties[party] = {
      votes: Number.isFinite(votes) ? votes : null,
      votePct: Number.isFinite(votePct) ? votePct : null,
      candidates: candidates,
    };
  }

  // compute winner, margin, top parties
  const out = new Map();

  byConst.forEach(function (entry, key) {
    const parties = Object.keys(entry.parties);

    const ranked = parties
      .map(function (p) {
        const v = entry.parties[p];
        const pct = Number.isFinite(v.votePct) ? v.votePct : -1;
        const votes = Number.isFinite(v.votes) ? v.votes : -1;

        return { party: p, pct: pct, votes: votes };
      })
      .sort(function (a, b) {
        // Prefer pct if available; otherwise votes
        if (a.pct !== b.pct) {
          return b.pct - a.pct;
        }
        return b.votes - a.votes;
      });

    if (ranked.length > 0) {
      entry.winnerParty = ranked[0].party;
      entry.topParties = ranked.slice(0, 3).map(function (x) { return x.party; });

      if (ranked.length > 1 && Number.isFinite(ranked[0].pct) && Number.isFinite(ranked[1].pct)) {
        entry.marginPct = ranked[0].pct - ranked[1].pct;
      } else {
        entry.marginPct = null;
      }
    }

    out.set(key, entry);
  });

  return out;
}

export function listParties(summaryMap) {
  const set = new Set();
  summaryMap.forEach(function (entry) {
    Object.keys(entry.parties).forEach(function (p) {
      set.add(p);
    });
  });

  return Array.from(set).sort(function (a, b) {
    return a.localeCompare(b);
  });
}
