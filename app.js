// app.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const ejs = require("ejs");
const expressLayouts = require("express-ejs-layouts");
const flash = require("connect-flash");
const { pool } = require("./config/db");
require("./config/passport");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

app.use(flash());

// Passport
app.use(passport.initialize());
app.use(passport.session());

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
