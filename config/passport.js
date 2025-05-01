// passport.js
const passport = require("passport");
const bcrypt = require("bcrypt");
const LocalStrategy = require("passport-local").Strategy;

module.exports = function (passport, pool) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT * FROM admins WHERE username = $1",
          [username]
        );

        if (result.rows.length === 0) {
          return done(null, false, { message: "Incorrect username." });
        }

        const admin = result.rows[0];

        // Check password match
        if (password === admin.password_hash) {
          return done(null, admin);
        } else {
          return done(null, false, { message: "Incorrect password." });
        }
      } catch (err) {
        console.error("Passport error:", err);
        return done(err);
      } finally {
        client.release();
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.admin_id);
  });

  passport.deserializeUser(async (id, done) => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM admins WHERE admin_id = $1",
        [id]
      );
      if (result.rows.length > 0) {
        done(null, result.rows[0]);
      } else {
        done(new Error("Admin not found"));
      }
    } catch (err) {
      done(err);
    } finally {
      client.release();
    }
  });
};
