-- freteMicar web: tabelas cte_* no banco cteauto (rodar depois do 000_banco_e_usuarios.sql).
USE cteauto;

CREATE TABLE cte_config (
  empresa_id         BIGINT UNSIGNED NOT NULL,          -- ID_EMPRESA do .env (fixo por enquanto)
  bmsoft_empresa_id  INT NOT NULL,             -- Empresas.ID no BMsoft (DBISAM)
  bmsoft_usuario_id  INT NOT NULL DEFAULT 0,   -- ID_Usuario gravado nas entradas
  banco_id           INT NOT NULL DEFAULT 0,   -- DpPPrincipal.ID_Banco
  criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cte_contas_email (
  id             INT NOT NULL AUTO_INCREMENT,
  empresa_id     BIGINT UNSIGNED NOT NULL,
  descricao      VARCHAR(60) NOT NULL,
  host           VARCHAR(120) NOT NULL,
  porta          INT NOT NULL DEFAULT 993,
  `ssl`          TINYINT(1) NOT NULL DEFAULT 1,
  usuario        VARCHAR(120) NOT NULL,
  senha          VARCHAR(500) NOT NULL,      -- cifrada (AES-256-GCM com o SESSION_SECRET)
  pasta          VARCHAR(60) NOT NULL DEFAULT 'INBOX',
  ultimo_uid     BIGINT NOT NULL DEFAULT 0,  -- UID IMAP da última mensagem processada
  ativo          TINYINT(1) NOT NULL DEFAULT 1,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_cte_contas_email_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cte_recebidos (
  id             INT NOT NULL AUTO_INCREMENT,
  empresa_id     BIGINT UNSIGNED NOT NULL,
  conta_id       INT NULL,                   -- cte_contas_email.id (NULL se a conta foi excluída)
  recebido_em    DATETIME NOT NULL,
  remetente      VARCHAR(120) NULL,
  assunto        VARCHAR(200) NULL,
  arquivo        VARCHAR(120) NULL,
  chave          CHAR(44) NOT NULL,
  emitente       VARCHAR(60) NULL,           -- transportadora
  valor          DECIMAL(15,2) NOT NULL DEFAULT 0,
  situacao       CHAR(1) NOT NULL,           -- L lançado, D já lançado, I ignorado, P transportadora a cadastrar, E erro
  entrada_id     INT NULL,                   -- EntradasM.ID no BMsoft
  mensagem       VARCHAR(250) NULL,
  xml            MEDIUMBLOB NOT NULL,        -- bytes originais do XML (lançar de novo e baixar)
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_cte_recebidos_empresa (empresa_id, situacao),
  KEY ix_cte_recebidos_chave (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Reversão:
DROP TABLE IF EXISTS cte_recebidos;
DROP TABLE IF EXISTS cte_contas_email;
DROP TABLE IF EXISTS cte_config;
*/
