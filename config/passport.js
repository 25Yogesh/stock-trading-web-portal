// passport.js
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const { pool } = require("./db");

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const result = await pool.query(
        "SELECT * FROM admins WHERE username = $1",
        [username]
      );
      if (result.rows.length === 0) {
        return done(null, false, { message: "Incorrect username." });
      }

      const admin = result.rows[0];
      const isValidPassword = await bcrypt.compare(
        password,
        admin.password_hash
      );

      if (!isValidPassword) {
        return done(null, false, { message: "Incorrect password." });
      }

      return done(null, admin);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((admin, done) => {
  done(null, admin.admin_id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query(
      "SELECT * FROM admins WHERE admin_id = $1",
      [id]
    );
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
