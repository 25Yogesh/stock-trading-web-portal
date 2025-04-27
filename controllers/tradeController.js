// tradeContoller.js
const { pool } = require("../config/db");
const csv = require("csv-parser");
const fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

module.exports = () => {
  return {
    // View: Show create trade form
    getCreateTradeForm: (req, res) => {
      res.render("trades/create", {
        user: req.user || null,
      });
    },

    // View: List all trades
    getAllTradesView: async (req, res) => {
      const client = await pool.connect();
      try {
        const { rows } = await client.query(`
          SELECT * FROM trades 
          ORDER BY created_at ASC
        `);
        res.render("trades/list", {
          user: req.user || null,
          trades: rows,
        });
      } catch (error) {
        console.error("Error fetching trades:", error);
        res.status(500).render("error", {
          message: "Failed to load trades",
          user: req.user,
        });
      } finally {
        client.release();
      }
    },

    // API: Create a new trade
    createTrade: async (req, res) => {
      const client = await pool.connect();
      try {
        const { stock_name, quantity, broker_name, price } = req.body;
        const amount = price * quantity;

        await client.query("BEGIN");
        const { rows } = await client.query(
          `INSERT INTO trades 
           (stock_name, quantity, broker_name, price, amount) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [stock_name, quantity, broker_name, price, amount]
        );
        const trade = rows[0];

        if (trade.quantity > 0) {
          await client.query(
            `INSERT INTO lots 
             (trade_id, stock_name, lot_quantity, remaining_quantity, lot_status, method) 
             VALUES ($1, $2, $3, $4, 'OPEN', $5), 
                    ($1, $2, $3, $4, 'OPEN', $6)`,
            [
              trade.trade_id,
              trade.stock_name,
              trade.quantity,
              trade.quantity,
              "FIFO",
              "LIFO",
            ]
          );
        } else {
          await processLots(client, trade, "FIFO");
          await processLots(client, trade, "LIFO");
        }
        await client.query("COMMIT");

        req.flash("success", "Trade created successfully!");
        res.redirect("/trades");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating trade:", err);
        req.flash("error", `Failed to create trade: ${err.message}`);
        res.redirect("/trades/new");
      } finally {
        client.release();
      }
    },

    // View: Show bulk upload form
    getBulkUploadForm: (req, res) => {
      res.render("trades/bulk", { user: req.user || null });
    },

    // API: Bulk upload trades via CSV
    bulkUploadTrades: async (req, res) => {
      const client = await pool.connect();
      try {
        let trades = [];
        let errorLines = [];

        try {
          if (req.file) {
            trades = await processCSVFile(req.file.path);
            await unlink(req.file.path);
          } else if (req.body.csvData) {
            trades = await processCSVData(req.body.csvData);
          } else {
            throw new Error("No file or CSV data provided");
          }
        } catch (parseError) {
          req.flash("error", `CSV parsing error: ${parseError.message}`);
          return res.redirect("/trades/bulk");
        }

        await client.query("BEGIN");
        const createdTrades = [];

        for (const [index, tradeData] of trades.entries()) {
          try {
            const { stock_name, quantity, broker_name, price } = tradeData;
            const amount = price * quantity;

            if (
              !stock_name ||
              isNaN(quantity) ||
              !broker_name ||
              isNaN(price)
            ) {
              throw new Error("Invalid trade data");
            }

            const { rows } = await client.query(
              `INSERT INTO trades 
               (stock_name, quantity, broker_name, price, amount) 
               VALUES ($1, $2, $3, $4, $5) 
               RETURNING *`,
              [stock_name, quantity, broker_name, price, amount]
            );
            const trade = rows[0];
            createdTrades.push(trade);

            if (trade.quantity > 0) {
              await client.query(
                `INSERT INTO lots 
                 (trade_id, stock_name, lot_quantity, remaining_quantity, lot_status, method) 
                 VALUES ($1, $2, $3, $4, 'OPEN', $5), 
                        ($1, $2, $3, $4, 'OPEN', $6)`,
                [
                  trade.trade_id,
                  trade.stock_name,
                  trade.quantity,
                  trade.quantity,
                  "FIFO",
                  "LIFO",
                ]
              );
            } else {
              await processLots(client, trade, "FIFO");
              await processLots(client, trade, "LIFO");
            }
          } catch (error) {
            errorLines.push(`Line ${index + 1}: ${error.message}`);
            await client.query("ROLLBACK");
            await client.query("BEGIN");
          }
        }
        await client.query("COMMIT");

        if (errorLines.length > 0) {
          req.flash(
            "warning",
            `Uploaded ${createdTrades.length} trades successfully, but ${errorLines.length} failed: ` +
              errorLines.join("; ")
          );
        } else {
          req.flash(
            "success",
            `Successfully uploaded ${createdTrades.length} trades`
          );
        }
        res.redirect("/trades");
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Bulk upload error:", error);
        req.flash("error", `Bulk upload failed: ${error.message}`);
        res.redirect("/trades/bulk");
      } finally {
        client.release();
      }
    },
  };
};

// Helper: Process lots for a sell trade
async function processLots(client, trade, method) {
  const sellQuantity = Math.abs(trade.quantity);
  let remainingToSell = sellQuantity;
  const order = method === "FIFO" ? "ASC" : "DESC";

  const { rows: lots } = await client.query(
    `SELECT * FROM lots 
     WHERE stock_name = $1 AND method = $2 AND remaining_quantity > 0
     ORDER BY created_at ${order}
     FOR UPDATE`,
    [trade.stock_name, method]
  );

  for (const lot of lots) {
    if (remainingToSell <= 0) break;

    const sellAmount = Math.min(remainingToSell, lot.remaining_quantity);
    remainingToSell -= sellAmount;
    const newRemaining = lot.remaining_quantity - sellAmount;
    const newRealized = lot.realized_quantity + sellAmount;
    const newStatus =
      newRemaining === 0
        ? "FULLY_REALIZED"
        : sellAmount > 0
        ? "PARTIALLY_REALIZED"
        : lot.lot_status;

    await client.query(
      `UPDATE lots 
       SET realized_quantity = $1,
           remaining_quantity = $2,
           lot_status = $3
       WHERE lot_id = $4`,
      [newRealized, newRemaining, newStatus, lot.lot_id]
    );

    await client.query(
      `INSERT INTO lot_realizations 
       (lot_id, trade_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [lot.lot_id, trade.trade_id, sellAmount, trade.price]
    );
  }

  if (remainingToSell > 0) {
    console.warn(
      `Couldn't find enough shares to sell ${remainingToSell} of ${trade.stock_name}`
    );
    throw new Error(
      `Not enough shares available to sell ${sellQuantity} (only ${
        sellQuantity - remainingToSell
      } sold)`
    );
  }
}

// Helper: Process CSV file into trade data
async function processCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let lineNumber = 0;

    fs.createReadStream(filePath)
      .pipe(
        csv({
          headers: ["stock_name", "quantity", "broker_name", "price"],
          skipLines: 0,
        })
      )
      .on("data", (data) => {
        lineNumber++;
        try {
          const quantity = parseInt(data.quantity);
          const price = parseFloat(data.price);

          if (isNaN(quantity)) {
            throw new Error(
              `Invalid quantity at line ${lineNumber}: "${data.quantity}"`
            );
          }
          if (isNaN(price)) {
            throw new Error(
              `Invalid price at line ${lineNumber}: "${data.price}"`
            );
          }

          results.push({
            stock_name: data.stock_name?.trim() || "",
            quantity: quantity,
            broker_name: data.broker_name?.trim() || "",
            price: price,
          });
        } catch (error) {
          throw new Error(
            `Error processing line ${lineNumber}: ${error.message}`
          );
        }
      })
      .on("end", () => {
        if (results.length === 0) {
          reject(new Error("CSV file is empty or contains no valid data"));
        } else {
          resolve(results);
        }
      })
      .on("error", reject);
  });
}

// Helper: Process inline CSV data
async function processCSVData(csvData) {
  return new Promise((resolve) => {
    const results = [];
    const lines = csvData.split("\n");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      try {
        if (line.trim()) {
          const [stock_name, quantityStr, broker_name, priceStr] =
            line.split(",");

          if (!stock_name || !quantityStr || !broker_name || !priceStr) {
            throw new Error("Missing required fields");
          }

          const quantity = parseInt(quantityStr.trim());
          const price = parseFloat(priceStr.trim());

          if (isNaN(quantity)) {
            throw new Error(`Invalid quantity: "${quantityStr}"`);
          }
          if (isNaN(price)) {
            throw new Error(`Invalid price: "${priceStr}"`);
          }

          results.push({
            stock_name: stock_name.trim(),
            quantity: quantity,
            broker_name: broker_name.trim(),
            price: price,
          });
        }
      } catch (error) {
        throw new Error(
          `Error processing line ${lineNumber}: ${error.message}`
        );
      }
    });

    if (results.length === 0) {
      throw new Error("CSV data is empty or contains no valid data");
    }

    resolve(results);
  });
}
