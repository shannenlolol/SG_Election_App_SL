const express = require("express");
const router = express.Router();

const {
  getBoundariesByYear,
  getBoundaryFeature,
  getMapSummaryByYear,
} = require("../controllers/boundaries.controller");

// GET /api/boundaries?year=2025
router.get("/", getBoundariesByYear);

// GET /api/boundaries/feature?year=2025&constituency=ALJUNIED
router.get("/feature", getBoundaryFeature);

// GET /api/boundaries/summary?year=2025
router.get("/summary", getMapSummaryByYear);

module.exports = router;
