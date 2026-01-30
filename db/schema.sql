use election_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role_name ENUM('civilian', 'government') NOT NULL,
  area VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  party_name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS constituencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL,
  UNIQUE KEY uniq_year_name (year, name)
);

CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  party_id INT NOT NULL,
  constituency_id INT NOT NULL,
  FOREIGN KEY (party_id) REFERENCES parties(id),
  FOREIGN KEY (constituency_id) REFERENCES constituencies(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  year INT NOT NULL,
  constituency_id INT NOT NULL,
  party_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_year (user_id, year),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (constituency_id) REFERENCES constituencies(id),
  FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- 1) Results by candidate (drives winner/margin/top parties)
CREATE TABLE ge_candidate_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  year INT NOT NULL,
  constituency VARCHAR(128) NOT NULL,
  constituency_type VARCHAR(16) NULL,
  candidates TEXT NULL,
  party VARCHAR(64) NOT NULL,
  vote_count INT NULL,
  vote_percentage DECIMAL(10,6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_candidate_row (year, constituency, party)
);


-- 2) Elector stats (used for turnout)
CREATE TABLE IF NOT EXISTS ge_elector_stats (
  year INT NOT NULL,
  constituency VARCHAR(128) NOT NULL,
  registered_electors INT NULL,
  rejected_votes INT NULL,
  spoilt_ballots INT NULL,
  PRIMARY KEY (year, constituency)
);

-- 3) Election dates
CREATE TABLE IF NOT EXISTS ge_dates (
  year INT NOT NULL PRIMARY KEY,
  nomination_day DATE NULL,
  polling_day DATE NULL
);

-- 4) Political parties
CREATE TABLE IF NOT EXISTS political_parties (
  party VARCHAR(64) NOT NULL PRIMARY KEY,
  party_name VARCHAR(255) NULL
);

-- 5) Derived tables for dashboard
CREATE TABLE IF NOT EXISTS ge_summary (
  year INT NOT NULL,
  constituency VARCHAR(128) NOT NULL,
  constituency_type VARCHAR(16) NULL,
  winner_party VARCHAR(64) NULL,
  margin_pct DECIMAL(10,6) NULL,
  turnout_pct DECIMAL(10,6) NULL,
  PRIMARY KEY (year, constituency)
);

CREATE TABLE IF NOT EXISTS ge_top_parties (
  year INT NOT NULL,
  constituency VARCHAR(128) NOT NULL,
  party VARCHAR(64) NOT NULL,
  rank_no INT NOT NULL,
  PRIMARY KEY (year, constituency, rank_no)
);

CREATE TABLE IF NOT EXISTS electoral_boundaries_geojson (
  year INT PRIMARY KEY,
  geojson JSON NOT NULL,
  source_dataset_id VARCHAR(64) NOT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
