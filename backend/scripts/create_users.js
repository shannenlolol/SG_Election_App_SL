require("dotenv").config();

const bcrypt = require("bcrypt");
const { buildPool } = require("../db");

async function upsertUser(pool, username, plainPassword, roleName, area) {
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  await pool.query(
    `
    INSERT INTO users (username, password_hash, role_name, area)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      role_name = VALUES(role_name),
      area = VALUES(area)
    `,
    [username, passwordHash, roleName, area]
  );
}

async function main() {
  const pool = buildPool();

  try {
    await upsertUser(pool, "diana", "Password123!", "civilian", "PIONEER");
    await upsertUser(pool, "eve", "Password123!", "government", "ANG MO KIO");

    console.log("Users ready:");
    console.log("diana / Password123! (civilian)");
    console.log("eve   / Password123! (government)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
