-- =========================================
-- SG Election App – Schema (MySQL 8+)
-- =========================================
USE election_db;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop derived tables first
DROP TABLE IF EXISTS ge_top_parties;
DROP TABLE IF EXISTS ge_summary;

-- Drop base tables
DROP TABLE IF EXISTS ge_candidate_results;
DROP TABLE IF EXISTS ge_elector_stats;
DROP TABLE IF EXISTS ge_dates;
DROP TABLE IF EXISTS political_parties;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------
-- 1) political_parties
-- API: abbreviation, political_party
-- -----------------------------------------
CREATE TABLE political_parties (
  abbreviation VARCHAR(32) NOT NULL,
  political_party VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (abbreviation),
  KEY idx_party_name (political_party)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------
-- 2) ge_dates
-- API: year, nomination_day, polling_day
-- -----------------------------------------
CREATE TABLE ge_dates (
  year INT NOT NULL,
  nomination_day DATE NULL,
  polling_day DATE NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------
-- 3) ge_elector_stats
-- API: year, constituency, no_of_registered_electors, no_of_rejected_votes, no_of_spoilt_ballot_papers
-- -----------------------------------------
CREATE TABLE ge_elector_stats (
  year INT NOT NULL,
  constituency VARCHAR(255) NOT NULL,

  no_of_registered_electors INT NULL,
  no_of_rejected_votes INT NULL,
  no_of_spoilt_ballot_papers INT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (year, constituency),
  KEY idx_elector_year (year),
  KEY idx_elector_constituency (constituency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------
-- 4) ge_candidate_results
-- API: year, constituency, constituency_type, candidates, party, vote_count, vote_percentage
-- Notes:
-- - vote_percentage in dataset is typically a fraction (0..1).
-- - UNIQUE includes candidates to avoid collisions for GRC where same party has multiple candidates.
-- -----------------------------------------
CREATE TABLE ge_candidate_results (
  id BIGINT NOT NULL AUTO_INCREMENT,

  year INT NOT NULL,
  constituency VARCHAR(255) NOT NULL,
  constituency_type VARCHAR(8) NULL,  -- 'GRC' or 'SMC'
  candidates VARCHAR(255) NULL,

  party VARCHAR(32) NOT NULL,         -- party abbreviation (e.g., PAP, WP)
  vote_count INT NULL,
  vote_percentage DECIMAL(10, 6) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_candidate_row (year, constituency, party, candidates),

  KEY idx_results_year (year),
  KEY idx_results_constituency (constituency),
  KEY idx_results_type (constituency_type),
  KEY idx_results_party (party),

  CONSTRAINT fk_results_party
    FOREIGN KEY (party) REFERENCES political_parties (abbreviation)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------
-- 5) ge_summary (derived)
-- Used by dashboard table: year, constituency, type, winner, margin, turnout
-- margin_pct is stored as percentage points (e.g., 12.34)
-- turnout_pct is stored as percentage (e.g., 93.21)
-- -----------------------------------------
CREATE TABLE ge_summary (
  year INT NOT NULL,
  constituency VARCHAR(255) NOT NULL,
  constituency_type VARCHAR(8) NULL,

  winner_party VARCHAR(32) NULL,
  margin_pct DECIMAL(10, 4) NULL,
  turnout_pct DECIMAL(10, 4) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (year, constituency),

  KEY idx_summary_year (year),
  KEY idx_summary_constituency (constituency),
  KEY idx_summary_type (constituency_type),
  KEY idx_summary_winner (winner_party),

  CONSTRAINT fk_summary_winner
    FOREIGN KEY (winner_party) REFERENCES political_parties (abbreviation)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------
-- 6) ge_top_parties (derived)
-- Top 3 parties per (year, constituency)
-- -----------------------------------------
CREATE TABLE ge_top_parties (
  year INT NOT NULL,
  constituency VARCHAR(255) NOT NULL,
  party VARCHAR(32) NOT NULL,
  rank_no INT NOT NULL, -- 1..3

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (year, constituency, party),

  KEY idx_top_rank (year, constituency, rank_no),
  KEY idx_top_party (party),

  CONSTRAINT fk_top_party
    FOREIGN KEY (party) REFERENCES political_parties (abbreviation)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE ge_candidate_results
  DROP FOREIGN KEY fk_results_party;

ALTER TABLE ge_top_parties
  DROP FOREIGN KEY fk_top_party;

ALTER TABLE ge_summary
  DROP FOREIGN KEY fk_summary_winner;
