// setupDatabase.js
// setupDatabase.js
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

// Initialize Pool with improved configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Corrected SQL for table creation
const setupSQL = `
CREATE TABLE IF NOT EXISTS trades (
  trade_id SERIAL PRIMARY KEY,
  stock_name VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  broker_name VARCHAR(100) NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lots (
  lot_id SERIAL PRIMARY KEY,
  trade_id INTEGER REFERENCES trades (trade_id),
  stock_name VARCHAR(100) NOT NULL,
  lot_quantity INTEGER NOT NULL,
  realized_quantity INTEGER DEFAULT 0 CHECK (realized_quantity >= 0 AND realized_quantity <= lot_quantity),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0 AND remaining_quantity <= lot_quantity),
  lot_status VARCHAR(20) CHECK (
    (lot_status = 'OPEN' AND remaining_quantity = lot_quantity) OR
    (lot_status = 'PARTIALLY_REALIZED' AND remaining_quantity > 0 AND remaining_quantity < lot_quantity) OR
    (lot_status = 'FULLY_REALIZED' AND remaining_quantity = 0)
  ),
  method VARCHAR(4) CHECK (method IN ('FIFO', 'LIFO')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lot_realizations (
  realization_id SERIAL PRIMARY KEY,
  lot_id INTEGER REFERENCES lots (lot_id) ON DELETE CASCADE,
  trade_id INTEGER REFERENCES trades (trade_id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  admin_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_stock_name ON trades (stock_name);
CREATE INDEX IF NOT EXISTS idx_lots_stock_name_method ON lots (stock_name, method);
`;

async function setupDatabaseAndAdmin() {
  let client;
  try {
    client = await pool.connect();
    console.log("Connected to database");

    // Check if 'admins' table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'admins'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("Tables not found. Creating tables...");
      await client.query(setupSQL);
      console.log("Tables created successfully!");
    } else {
      console.log("Tables already exist. Skipping creation.");
    }

    // Check if default admin exists
    const adminCheck = await client.query(
      `SELECT * FROM admins WHERE username = 'admin' LIMIT 1`
    );
    if (adminCheck.rows.length > 0) {
      console.log("Default admin already exists. Skipping admin creation.");
      return;
    }

    // Create default admin
    console.log("Creating default admin account...");
    const defaultUsername = "admin";
    const defaultPassword = "admin@123";
    const defaultEmail = "admin@example.com";

    // const saltRounds = 10;
    // const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
    const passwordHash = defaultPassword;

    await client.query(
      "INSERT INTO admins (username, password_hash, email) VALUES ($1, $2, $3)",
      [defaultUsername, passwordHash, defaultEmail]
    );

    console.log("✅ Default admin created successfully!");
    console.log("🧑 Username: admin");
    console.log("🔑 Password: admin@123");
    console.log("⚠️ Please change these credentials after first login!");
  } catch (err) {
    console.error("Database setup error:", err);
    throw err; // Re-throw the error to handle it in the calling code
  } finally {
    if (client) client.release();
  }
}

// 🧹 Function to clear all tables and reset IDs
async function clearDatabase() {
  let client;
  try {
    client = await pool.connect();
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
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Error clearing database:", err);
    throw err;
  } finally {
    if (client) client.release();
  }
}

// ✏️ Function to update admin information
async function updateAdminInfo(adminId, newUsername, newPassword, newEmail) {
  let client;
  try {
    client = await pool.connect();
    // const saltRounds = 10;
    // const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    const newPasswordHash = newPassword;

    const updateQuery = `
        UPDATE admins
        SET username = $1,
            password_hash = $2,
            email = $3
        WHERE admin_id = $4
      `;

    const values = [newUsername, newPasswordHash, newEmail, adminId];

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      console.log("⚠️ Admin not found for update.");
      throw new Error("Admin not found.");
    }

    console.log("✅ Admin information updated successfully!");
  } catch (err) {
    console.error("❌ Error updating admin:", err);
    throw err;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  setupDatabaseAndAdmin,
  clearDatabase,
  updateAdminInfo,
  pool,
};
