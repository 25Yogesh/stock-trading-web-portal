// lotRoutes.js
const express = require("express");
const router = express.Router();

module.exports = (pool) => {
  const lotController = require("../controllers/lotController")();

  router.get("/:method", ensureAuthenticated, async (req, res, next) => {
    try {
      await lotController.getLotsByMethodView(req, res);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:method/:stock_name",
    ensureAuthenticated,
    async (req, res, next) => {
      try {
        await lotController.getLotsByStockAndMethodView(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/api/:method", ensureAuthenticated, async (req, res, next) => {
    try {
      await lotController.getLotsByMethod(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Authentication middleware
  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash("error", "Please login to access this feature");
    res.redirect("/admin/login");
  }

  return router;
};
