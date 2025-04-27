-- Create database
CREATE DATABASE stock_trading_portal;

-- Create tables
CREATE TABLE
    trades (
        trade_id SERIAL PRIMARY KEY,
        stock_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        broker_name VARCHAR(100) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    lots (
        lot_id SERIAL PRIMARY KEY,
        trade_id INTEGER REFERENCES trades (trade_id),
        stock_name VARCHAR(100) NOT NULL,
        lot_quantity INTEGER NOT NULL,
        realized_quantity INTEGER DEFAULT 0,
        remaining_quantity INTEGER NOT NULL,
        lot_status VARCHAR(20) CHECK (
            lot_status IN ('OPEN', 'PARTIALLY_REALIZED', 'FULLY_REALIZED')
        ),
        method VARCHAR(4) CHECK (method IN ('FIFO', 'LIFO')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    lot_realizations (
        realization_id SERIAL PRIMARY KEY,
        lot_id INTEGER REFERENCES lots (lot_id) ON DELETE CASCADE,
        trade_id INTEGER REFERENCES trades (trade_id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price DECIMAL(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    admins (
        admin_id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert initial admin user (username: admin, password: admin123)
INSERT INTO
    admins (username, password_hash, email)
VALUES
    (
        'admin',
        '$2b$10$QC2AGNVyymJ2W7nJhUdQ7exlk229k2NRl971HLet70zSbD4IGw3li',
        'admin@stockportal.com'
    );

-- Create indexes for performance
CREATE INDEX idx_trades_stock_name ON trades (stock_name);

CREATE INDEX idx_lots_stock_name_method ON lots (stock_name, method);

-- Some alter query for structure changes
ALTER TABLE lots ADD CONSTRAINT remaining_quantity_check CHECK (
    remaining_quantity >= 0
    AND remaining_quantity <= lot_quantity
);

ALTER TABLE lots ADD CONSTRAINT realized_quantity_check CHECK (
    realized_quantity >= 0
    AND realized_quantity <= lot_quantity
);

ALTER TABLE lots ADD CONSTRAINT status_check CHECK (
    (
        lot_status = 'OPEN'
        AND remaining_quantity = lot_quantity
    )
    OR (
        lot_status = 'PARTIALLY_REALIZED'
        AND remaining_quantity > 0
        AND remaining_quantity < lot_quantity
    )
    OR (
        lot_status = 'FULLY_REALIZED'
        AND remaining_quantity = 0
    )
);