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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Get counts in parallel
        const [tradesRes, lotsRes] = await Promise.all([
          client.query("SELECT COUNT(*) FROM trades"),
          client.query("SELECT COUNT(*) FROM lots"),
        ]);

        await client.query("COMMIT");

        res.render("admin/dashboard", {
          user: req.user || null,
          totalTrades: tradesRes.rows[0].count || 0,
          totalLots: lotsRes.rows[0].count || 0,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Dashboard error:", err);
        req.flash("error", "Failed to load dashboard");
        res.redirect("/admin/dashboard");
      } finally {
        client.release();
      }
    },

    // Logout the user and redirect to home
    logout: (req, res, next) => {
      req.logout(function (err) {
        if (err) {
          console.error("Logout error:", err);
          return next(err);
        }

        res.redirect("/");
      });
    },

    // Additional method: Create admin user
    createAdmin: async (username, password, email) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const { rows } = await client.query(
          `INSERT INTO admins (username, password_hash, email) 
           VALUES ($1, $2, $3) 
           RETURNING admin_id`,
          [username, passwordHash, email]
        );

        await client.query("COMMIT");
        return rows[0];
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Admin creation error:", err);
        throw err;
      } finally {
        client.release();
      }
    },
  };
};
