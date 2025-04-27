// lotRoutes.js
const express = require("express");
const router = express.Router();

module.exports = (pool) => {
  const lotController = require("../controllers/lotController")(pool);

  router.get(
    "/:method",
    ensureAuthenticated,
    lotController.getLotsByMethodView
  );
  router.get(
    "/:method/:stock_name",
    ensureAuthenticated,
    lotController.getLotsByStockAndMethodView
  );
  router.get(
    "/api/:method",
    ensureAuthenticated,
    lotController.getLotsByMethod
  );

  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash("error", "Please login to access this feature");
    res.redirect("/admin/login");
  }

  return router;
};
