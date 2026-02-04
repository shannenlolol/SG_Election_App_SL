const express = require("express");
const router = express.Router();

const {
  getBoundariesByYear,
  getBoundariesSummaryByYear,
} = require("../controllers/boundaries.controller");

// GET /api/boundaries?year=2025
router.get("/", getBoundariesByYear);

// GET /api/boundaries/summary?year=2025
router.get("/summary", getBoundariesSummaryByYear);

module.exports = router;
