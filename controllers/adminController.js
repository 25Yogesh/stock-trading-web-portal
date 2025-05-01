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
    // postLogin: passport.authenticate("local", {
    //   successRedirect: "/admin/dashboard",
    //   failureRedirect: "/admin/login",
    //   failureFlash: true,
    // }),
    postLogin: (req, res, next) => {
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          req.flash("error", info.message);
          return res.redirect("/admin/login");
        }
        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }
          return res.redirect("/admin/dashboard");
        });
      })(req, res, next);
    },

    // Render admin dashboard with counts
    getDashboard: async (req, res) => {
      const client = await pool.connect(); // Get a client from the pool
      try {
        await client.query("BEGIN"); // Start a transaction

        // Get counts in parallel using separate client queries
        const [tradesRes, lotsRes] = await Promise.all([
          client.query("SELECT COUNT(*) FROM trades"),
          client.query("SELECT COUNT(*) FROM lots"),
        ]);

        await client.query("COMMIT"); // Commit the transaction

        // Render the dashboard with the counts
        res.render("admin/dashboard", {
          user: req.user || "",
          totalTrades: tradesRes.rows[0].count || 0,
          totalLots: lotsRes.rows[0].count || 0,
        });
      } catch (err) {
        await client.query("ROLLBACK"); // Rollback the transaction in case of error
        console.error("Dashboard error:", err);
        req.flash("error", "Failed to load dashboard");
        res.redirect("/admin/dashboard");
      } finally {
        client.release(); // Release the client back to the pool
      }
    },

    // Clear db data
    dbClear: async (req, res) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Truncate in proper order due to foreign key constraints
        // await client.query(
        //   "TRUNCATE TABLE lot_realizations, lots, trades, admins RESTART IDENTITY CASCADE"
        // );
        await client.query(
          "TRUNCATE TABLE lot_realizations, lots, trades RESTART IDENTITY CASCADE"
        );

        await client.query("COMMIT");
        console.log("✅ Database cleared and IDs reset successfully!");
        res.redirect("/admin/dashboard");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Error clearing database:", err);
        req.flash("error", "Failed to clearing database");
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

        // const saltRounds = 10;
        // const passwordHash = await bcrypt.hash(password, saltRounds);
        const passwordHash = password;

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
