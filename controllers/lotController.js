// lotController.js
const { pool } = require("../config/db");

module.exports = () => {
  return {
    // View: Get lots by method (FIFO or LIFO) and render list page
    getLotsByMethodView: async (req, res) => {
      const client = await pool.connect();
      try {
        const { method } = req.params;

        if (!["FIFO", "LIFO"].includes(method)) {
          req.flash("error", "Invalid lot method");
          return res.redirect("/lots/FIFO");
        }

        await client.query("BEGIN");

        const { rows: lots } = await client.query(
          `SELECT 
            l.*,
            t.stock_name,
            COALESCE((
              SELECT SUM(lr.quantity) 
              FROM lot_realizations lr 
              WHERE lr.lot_id = l.lot_id
            ), 0) as realized_total,
            COALESCE(
              NULLIF(
                (SELECT json_agg(json_build_object(
                  'trade_id', lr.trade_id,
                  'quantity', lr.quantity,
                  'price', lr.price,
                  'created_at', lr.created_at
                ))
                FROM lot_realizations lr
                WHERE lr.lot_id = l.lot_id
              )::text, 'null'
            ), '[]') as realization_details
           FROM lots l
           JOIN trades t ON l.trade_id = t.trade_id
           WHERE l.method = $1
           ORDER BY l.created_at`,
          [method]
        );

        await client.query("COMMIT");

        const processedLots = lots.map((lot) => {
          try {
            return {
              ...lot,
              realization_details: lot.realization_details
                ? JSON.parse(lot.realization_details)
                : [],
            };
          } catch (e) {
            console.error("Error parsing realization details:", e);
            return {
              ...lot,
              realization_details: [],
            };
          }
        });

        res.render("lots/list", {
          user: req.user,
          method,
          lots: processedLots,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error fetching lots:", error);
        res.status(500).render("error", {
          message: "Failed to load lots",
          user: req.user,
        });
      } finally {
        client.release();
      }
    },

    // View: Get lots by specific stock and method, render list page
    getLotsByStockAndMethodView: async (req, res) => {
      const client = await pool.connect();
      try {
        const { method, stock_name } = req.params;

        if (!["FIFO", "LIFO"].includes(method)) {
          req.flash("error", "Invalid lot method");
          return res.redirect("/lots/FIFO");
        }

        await client.query("BEGIN");

        const { rows } = await client.query(
          `SELECT 
            l.*, 
            t.stock_name,
            (SELECT SUM(quantity) FROM lot_realizations WHERE lot_id = l.lot_id) as realized_total
           FROM lots l
           JOIN trades t ON l.trade_id = t.trade_id
           WHERE l.method = $1 AND t.stock_name = $2
           ORDER BY l.created_at`,
          [method, stock_name]
        );

        await client.query("COMMIT");

        res.render("lots/list", {
          user: req.user,
          method,
          lots: rows,
          stock_name,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error fetching stock lots:", error);
        res.status(500).render("error", {
          message: "Failed to load stock lots",
          user: req.user,
        });
      } finally {
        client.release();
      }
    },

    // API: Get lots by method (return JSON)
    getLotsByMethod: async (req, res) => {
      const client = await pool.connect();
      try {
        const { method } = req.params;

        if (!["FIFO", "LIFO"].includes(method)) {
          return res.status(400).json({ error: "Invalid method" });
        }

        await client.query("BEGIN");

        const { rows } = await client.query(
          `SELECT 
            l.*, 
            t.stock_name, 
            t.broker_name,
            (SELECT json_agg(json_build_object(
              'realized_id', lr.realization_id,
              'quantity', lr.quantity,
              'price', lr.price
            )) as realizations
           FROM lots l
           JOIN trades t ON l.trade_id = t.trade_id
           LEFT JOIN lot_realizations lr ON l.lot_id = lr.lot_id
           WHERE l.method = $1
           GROUP BY l.lot_id, t.stock_name, t.broker_name
           ORDER BY l.created_at`,
          [method]
        );

        await client.query("COMMIT");

        res.json(
          rows.map((row) => ({
            ...row,
            realizations: row.realizations || [],
          }))
        );
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error fetching lots:", error);
        res.status(500).json({ error: "Failed to load lots" });
      } finally {
        client.release();
      }
    },
  };
};
