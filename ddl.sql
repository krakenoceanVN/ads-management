-- ============================================================
-- AD MANAGEMENT SYSTEM - MySQL DDL
-- ============================================================

CREATE DATABASE IF NOT EXISTS ad_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ad_management;

-- ============================================================
-- TABLE 1: ad_type
-- ============================================================
CREATE TABLE ad_type (
  id           TINYINT      NOT NULL PRIMARY KEY,
  code         VARCHAR(20) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB;

-- Seed
INSERT INTO ad_type (id, code, name) VALUES
  (1, 'SM',      'GS-SM'),
  (2, '360',     '360'),
  (3, 'BAIDU_JS','Baidu JS');

-- ============================================================
-- TABLE 2: upstream
-- ============================================================
CREATE TABLE upstream (
  id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ad_type_id   TINYINT      NOT NULL,
  name         VARCHAR(100) NOT NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_upstream_adtype FOREIGN KEY (ad_type_id)
    REFERENCES ad_type(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_up_type (ad_type_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 3: ad_site
-- ============================================================
CREATE TABLE ad_site (
  id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upstream_id       BIGINT       NOT NULL,
  name              VARCHAR(200) NOT NULL,
  billing_method    ENUM('CPM','RATIO') NOT NULL,
  current_unit_price DECIMAL(18,6)  DEFAULT NULL,   -- SM: CPM billing
  current_ratio     DECIMAL(8,6)   DEFAULT NULL,    -- 360/Baidu: RATIO billing
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_adsite_upstream FOREIGN KEY (upstream_id)
    REFERENCES upstream(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_site_upstream (upstream_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 4: daily_input
-- ============================================================
CREATE TABLE daily_input (
  id                 BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_date        DATE         NOT NULL,
  ad_site_id         BIGINT       NOT NULL,
  qty                BIGINT       NOT NULL DEFAULT 0,            -- SM: CPM qty
  unit_price_snapshot DECIMAL(18,6)  DEFAULT NULL,              -- SM: CPM unit price
  amount1            DECIMAL(18,6) NOT NULL DEFAULT 0,           -- 360/Baidu: amount before ratio
  amount2            DECIMAL(18,6) NOT NULL DEFAULT 0,           -- 360/Baidu: amount before ratio
  ratio_snapshot     DECIMAL(8,6)   DEFAULT NULL,               -- 360/Baidu: ratio snapshot
  revenue            DECIMAL(18,6) NOT NULL DEFAULT 0,
  status             ENUM('unconfirmed','confirmed') NOT NULL DEFAULT 'unconfirmed',
  note               VARCHAR(500)  DEFAULT NULL,
  created_by         BIGINT        DEFAULT NULL,
  created_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_di_adsite FOREIGN KEY (ad_site_id)
    REFERENCES ad_site(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  UNIQUE KEY uq_date_site (record_date, ad_site_id),
  INDEX idx_di_date (record_date),
  INDEX idx_di_site (ad_site_id),
  INDEX idx_di_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 5: downstream
-- ============================================================
CREATE TABLE downstream (
  id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ad_type_id      TINYINT      NOT NULL,
  downstream_type ENUM('ML','LE','YIYI') NOT NULL,
  payout_rate     DECIMAL(5,4) NOT NULL DEFAULT 0.8000,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_ds_adtype FOREIGN KEY (ad_type_id)
    REFERENCES ad_type(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 6: downstream_period
-- ============================================================
CREATE TABLE downstream_period (
  id             BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  downstream_id  BIGINT        NOT NULL,
  pct_hal        DECIMAL(8,6)  NOT NULL DEFAULT 1.000000,  -- tỷ lệ UV/quantity tính ML
  unit_price     DECIMAL(18,6) DEFAULT NULL,                -- đơn giá payout (LE=16, ML=95 ...)
  start_date     DATE          NOT NULL,
  end_date       DATE          DEFAULT NULL,                 -- NULL = đang hiệu lực
  note           VARCHAR(500)  DEFAULT NULL,
  created_by     BIGINT        DEFAULT NULL,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dp_downstream FOREIGN KEY (downstream_id)
    REFERENCES downstream(id) ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_dp_ds_date (downstream_id, start_date)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 7: user
-- ============================================================
CREATE TABLE `user` (
  id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  perm_data_input TINYINT(1)   NOT NULL DEFAULT 0,
  perm_data_confirm TINYINT(1) NOT NULL DEFAULT 0,
  perm_admin     TINYINT(1)    NOT NULL DEFAULT 0,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at  DATETIME     DEFAULT NULL,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB;
