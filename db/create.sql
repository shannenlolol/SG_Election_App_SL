CREATE DATABASE IF NOT EXISTS election_db;
CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'app_password';
GRANT ALL PRIVILEGES ON election_db.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;

