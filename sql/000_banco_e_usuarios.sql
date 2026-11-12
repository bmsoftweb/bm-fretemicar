-- freteMicar web: banco cteauto e a tabela de login. Depois, rodar o 001_tabelas_mysql.sql (tabelas cte_*).

CREATE DATABASE cteauto DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cteauto;

CREATE TABLE usuarios (
  id             INT NOT NULL AUTO_INCREMENT,
  login          VARCHAR(60) NOT NULL,
  nome           VARCHAR(100) NULL,
  senha_hash     VARCHAR(255) NOT NULL DEFAULT '',  -- bcrypt; vazia = a senha digitada no primeiro acesso passa a valer
  ativo          TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acesso  DATETIME NULL,
  config_listas  MEDIUMTEXT NULL,                   -- preferências das listas (larguras, ordem das colunas...)
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Primeiro usuário (senha em branco: definida no primeiro acesso)
-- INSERT INTO usuarios (login, nome) VALUES ('<login>', '<nome>');

/* Reversão:
DROP DATABASE IF EXISTS cteauto;
*/
