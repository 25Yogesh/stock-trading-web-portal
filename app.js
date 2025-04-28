// app.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const passport = require("passport");
const path = require("path");
const ejs = require("ejs");
const expressLayouts = require("express-ejs-layouts");
const flash = require("connect-flash");
const { pool } = require("./config/db");
const {
  setupDatabaseAndAdmin,
  clearDatabase,
  updateAdminInfo,
} = require("./setupDatabase");
require("./config/passport")(passport, pool);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Session
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      // maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Routes
app.use("/admin", require("./routes/adminRoutes")(pool));
app.use("/trades", require("./routes/tradeRoutes")(pool));
app.use("/lots", require("./routes/lotRoutes")(pool));

// Home route
app.get("/", (req, res) => {
  res.render("index", { user: req.user || null });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    message: "Something went wrong!",
    user: req.user || null,
  });
});

const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// Clear database
// clearDatabase();

// Update admin
// updateAdminInfo(1, "admin", "admin@123", "admin@example.com");

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing connections...");
  await pool.end(); // This will close all connections in the pool
  console.log("All connections closed.");
  process.exit(0); // Exit the process gracefully
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Closing connections...");
  await pool.end(); // Close connections on termination signal
  console.log("All connections closed.");
  process.exit(0);
});

// Create database and run the project
setupDatabaseAndAdmin()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database setup failed:", err);
    process.exit(1);
  });

// Add connection cleanup on process exit
process.on("exit", () => {
  pool.end(() => {
    console.log("Pool has ended");
  });
});

// Handle other shutdown signals
["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) => {
  process.on(signal, () => {
    if (pool) pool.end();
    process.exit();
  });
});
