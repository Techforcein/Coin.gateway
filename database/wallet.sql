-- ============================================================
-- Coin Wallet System - Database Schema (Updated)
-- ============================================================
-- Usage:  mysql -u root -p < database/wallet.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS wallet_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE wallet_system;

-- ------------------------------------------------------------
-- Users table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  coins         BIGINT       NOT NULL DEFAULT 0,
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  is_frozen     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_coins_non_negative CHECK (coins >= 0)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Transactions table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  type          ENUM('credit', 'debit') NOT NULL,
  amount        BIGINT       NOT NULL,
  balance_after BIGINT       NOT NULL,
  reason        VARCHAR(255) NOT NULL,
  status        ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Notices table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notices (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  message       TEXT         NOT NULL,
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Marketplace items table  (admin-created digital products)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  price         INT UNSIGNED NOT NULL,            -- cost in coins
  stock         INT          NOT NULL DEFAULT -1, -- -1 = unlimited
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Digital codes table
-- Format: 12-char alphanumeric, LAST 3 CHARS ALWAYS = "1AS"
-- Example: "ABC123DE41AS" - first 9 chars random alphanum + "1AS"
-- Each code belongs to one item and is issued to one purchase.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digital_codes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id       INT UNSIGNED NOT NULL,
  code          CHAR(12)     NOT NULL UNIQUE,      -- exactly 12 chars, ends in 1AS
  is_used       TINYINT(1)   NOT NULL DEFAULT 0,
  used_by       INT UNSIGNED NULL,
  purchase_id   BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at       TIMESTAMP    NULL,
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_item_unused (item_id, is_used)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Purchases table  (each user purchase of a marketplace item)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  item_id       INT UNSIGNED NOT NULL,
  code_id       BIGINT UNSIGNED NOT NULL,
  coins_spent   INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id)              ON DELETE CASCADE,
  FOREIGN KEY (item_id)  REFERENCES marketplace_items(id)  ON DELETE CASCADE,
  FOREIGN KEY (code_id)  REFERENCES digital_codes(id)      ON DELETE CASCADE,
  INDEX idx_user_purchases (user_id, created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Run: npm run seed:admin   to create admin account
-- -----------------------------------------------
