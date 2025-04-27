const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "stock_trading_portal",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
});

async function createAdmin() {
  try {
    // Prompt for username
    readline.question("Enter username: ", async (username) => {
      // Prompt for password
      readline.question("Enter password: ", async (password) => {
        // Prompt for email
        readline.question("Enter email: ", async (email) => {
          const saltRounds = 10;
          const passwordHash = await bcrypt.hash(password, saltRounds);

          try {
            // Check if username already exists
            const existing = await pool.query(
              "SELECT * FROM admins WHERE username = $1",
              [username]
            );
            if (existing.rows.length > 0) {
              console.log(
                "Username already exists! Please choose a different username."
              );
              readline.close();
              await pool.end();
              return;
            }

            // Insert new admin into database
            await pool.query(
              "INSERT INTO admins (username, password_hash, email) VALUES ($1, $2, $3)",
              [username, passwordHash, email]
            );
            console.log("Admin user created successfully!");
          } catch (err) {
            console.error("Error creating admin:", err);
          } finally {
            // Always close connections
            readline.close();
            await pool.end();
          }
        });
      });
    });
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

createAdmin();
