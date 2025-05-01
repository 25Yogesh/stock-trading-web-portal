// adminRoutes.js
const express = require("express");
const passport = require("passport");
const router = express.Router();

module.exports = (pool) => {
  const adminController = require("../controllers/adminController")(pool);

  router.get("/login", adminController.getLogin);
  router.post("/login", adminController.postLogin);
  router.get("/dashboard", ensureAuthenticated, adminController.getDashboard);
  router.get("/clear-db", ensureAuthenticated, adminController.dbClear);
  router.get("/logout", adminController.logout);

  return router;
};

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/admin/login");
}
