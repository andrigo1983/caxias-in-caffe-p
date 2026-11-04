-- =====================================================================
-- Caxias in Caffè 2026 — 01_estrutura.sql
-- Cria o banco, as tabelas e as views. NÃO contém dados pessoais nem senhas.
-- Compatível: MySQL 8.0+ / MariaDB 10.5+
-- ATENÇÃO: recria tudo do zero (apaga dados existentes do banco caxias_coffee).
-- Ordem de execução: 01_estrutura.sql → 02_cafeterias.sql → (privado) 03_dados_privados_e_acessos.sql
-- =====================================================================
CREATE DATABASE IF NOT EXISTS caxias_coffee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE caxias_coffee;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS vw_ranking_conclusao, vw_clientes_por_cidade, vw_checkins_por_cliente, vw_checkins_por_cafeteria, vw_checkins_por_dia;
DROP TABLE IF EXISTS checkins, staff, users, audit_log, rate_limits, cafes;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE cafes (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug               VARCHAR(60)   NOT NULL,
  name               VARCHAR(160)  NOT NULL,
  responsible        VARCHAR(160)  NULL COMMENT 'Dado pessoal - carregado só pelo script privado',
  email              VARCHAR(160)  NULL COMMENT 'Dado pessoal - carregado só pelo script privado',
  phone              VARCHAR(60)   NULL COMMENT 'Dado pessoal - carregado só pelo script privado',
  address            VARCHAR(400)  NULL,
  city               VARCHAR(80)   NOT NULL DEFAULT 'Caxias do Sul',
  products           TEXT          NULL,
  combo_name         VARCHAR(160)  NULL,
  combo_description  VARCHAR(600)  NULL,
  logo_file          VARCHAR(80)   NULL,
  combo_photo_file   VARCHAR(80)   NULL,
  lat                DECIMAL(10,7) NULL,
  lng                DECIMAL(10,7) NULL,
  maps_url           VARCHAR(600)  NULL,
  whatsapp_url       VARCHAR(120)  NULL,
  instagram_url      VARCHAR(200)  NULL,
  cadastur           VARCHAR(5)    NULL,
  alvara             VARCHAR(5)    NULL,
  qr_token           CHAR(32)      NOT NULL COMMENT 'Token do QR da placa (gerado no banco)',
  qr_seed            CHAR(64)      NOT NULL COMMENT 'Segredo do QR dinâmico (gerado no banco)',
  active             TINYINT       NOT NULL DEFAULT 1,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cafes_slug (slug), KEY ix_cafes_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username              VARCHAR(60)  NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  role                  ENUM('admin','cafe') NOT NULL,
  cafe_id               INT UNSIGNED NULL,
  must_change_password  TINYINT      NOT NULL DEFAULT 1,
  active                TINYINT      NOT NULL DEFAULT 1,
  failed_attempts       INT          NOT NULL DEFAULT 0,
  locked_until          DATETIME     NULL,
  last_login            DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_username (username), KEY ix_staff_cafe (cafe_id),
  CONSTRAINT fk_staff_cafe FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_sub         VARCHAR(64)  NOT NULL,
  email              VARCHAR(190) NOT NULL,
  name               VARCHAR(160) NULL,
  city               VARCHAR(100) NOT NULL,
  state              CHAR(2)      NOT NULL,
  consent_terms_at   DATETIME     NOT NULL,
  consent_version    VARCHAR(10)  NOT NULL,
  consent_marketing  TINYINT      NOT NULL DEFAULT 0,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login         DATETIME     NULL,
  UNIQUE KEY uq_users_google (google_sub), KEY ix_users_email (email), KEY ix_users_city (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checkins (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  cafe_id     INT UNSIGNED NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method      ENUM('placa','tela') NOT NULL DEFAULT 'placa',
  distance_m  INT UNSIGNED NULL COMMENT 'Distância até a cafeteria (não guarda localização)',
  ip_hash     CHAR(64)     NULL,
  status      ENUM('valid','revoked') NOT NULL DEFAULT 'valid',
  UNIQUE KEY uq_checkin_user_cafe (user_id, cafe_id), KEY ix_checkin_cafe (cafe_id, status), KEY ix_checkin_data (created_at),
  CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_cafe FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor VARCHAR(80) NULL, action VARCHAR(80) NULL,
  detail VARCHAR(500) NULL, ip_hash CHAR(64) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_data (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  k VARCHAR(120) NOT NULL PRIMARY KEY, hits INT NOT NULL, window_start INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE VIEW vw_checkins_por_cliente AS
SELECT u.id, u.name, u.email, u.city, u.state, COUNT(c.id) AS total_checkins, MAX(k.created_at) AS ultimo_checkin
FROM users u
LEFT JOIN checkins k ON k.user_id = u.id AND k.status = 'valid'
LEFT JOIN cafes c    ON c.id = k.cafe_id AND c.active = 1
GROUP BY u.id, u.name, u.email, u.city, u.state;

CREATE VIEW vw_checkins_por_cafeteria AS
SELECT c.id, c.name, COUNT(k.id) AS total_checkins
FROM cafes c LEFT JOIN checkins k ON k.cafe_id = c.id AND k.status = 'valid'
GROUP BY c.id, c.name;

CREATE VIEW vw_checkins_por_dia AS
SELECT DATE(created_at) AS dia, COUNT(*) AS total_checkins FROM checkins WHERE status = 'valid' GROUP BY DATE(created_at);

CREATE VIEW vw_clientes_por_cidade AS
SELECT u.city AS cidade, u.state AS uf, COUNT(DISTINCT u.id) AS clientes, COUNT(k.id) AS checkins
FROM users u LEFT JOIN checkins k ON k.user_id = u.id AND k.status = 'valid'
GROUP BY u.city, u.state;

CREATE VIEW vw_ranking_conclusao AS
SELECT ROW_NUMBER() OVER (ORDER BY t.concluido_em, t.user_id) AS posicao, t.*
FROM (
  SELECT u.id AS user_id, u.name, u.email, u.city, u.state, COUNT(*) AS total_checkins, MAX(k.created_at) AS concluido_em
  FROM users u
  JOIN checkins k ON k.user_id = u.id AND k.status = 'valid'
  JOIN cafes c    ON c.id = k.cafe_id AND c.active = 1
  GROUP BY u.id, u.name, u.email, u.city, u.state
  HAVING COUNT(*) >= (SELECT COUNT(*) FROM cafes WHERE active = 1)
) t;

-- Produção: crie um usuário próprio (troque a senha) e use-o no config.php
-- CREATE USER IF NOT EXISTS 'cic_app'@'localhost' IDENTIFIED BY 'TROCAR_SENHA_FORTE';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON caxias_coffee.* TO 'cic_app'@'localhost';
