const express = require("express");
const router = express.Router();

const {
  getDashboardOptions,
  searchDashboardRows,
  getDashboardDetails,
} = require("../controllers/dashboard.controller");

router.get("/options", getDashboardOptions);
router.get("/search", searchDashboardRows);
router.get("/details", getDashboardDetails);

module.exports = router;
