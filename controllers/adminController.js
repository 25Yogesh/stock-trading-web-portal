// adminController.js
const bcrypt = require("bcrypt");
const passport = require("passport");

module.exports = (pool) => {
  return {
    // Render login page
    getLogin: (req, res) => {
      res.render("admin/login", {
        user: req.user || null,
        message: req.flash("error"),
      });
    },
    // Handle login authentication
    postLogin: passport.authenticate("local", {
      successRedirect: "/admin/dashboard",
      failureRedirect: "/admin/login",
      failureFlash: true,
    }),
    // Render admin dashboard with counts
    getDashboard: async (req, res) => {
      try {
        const trades = await pool.query("SELECT COUNT(*) FROM trades");
        const lots = await pool.query("SELECT COUNT(*) FROM lots");
        res.render("admin/dashboard", {
          user: req.user || null,
          totalTrades: trades.rows[0].count || 0,
          totalLots: lots.rows[0].count || 0,
        });
      } catch (err) {
        console.error(err);
        res.redirect("/");
      }
    },
    // Logout the user and redirect to home
    logout: (req, res, next) => {
      req.logout(function (err) {
        if (err) {
          return next(err);
        }
        res.redirect("/");
      });
    },
  };
};
