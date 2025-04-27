// tradeRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

module.exports = (pool) => {
  const tradeController = require("../controllers/tradeController")(pool);

  router.get("/", ensureAuthenticated, tradeController.getAllTradesView);
  router.get("/new", ensureAuthenticated, tradeController.getCreateTradeForm);
  router.post("/", ensureAuthenticated, tradeController.createTrade);
  router.get("/bulk", ensureAuthenticated, tradeController.getBulkUploadForm);
  router.post(
    "/bulk",
    ensureAuthenticated,
    upload.single("tradesFile"),
    tradeController.bulkUploadTrades
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
