-- freteMicar web: última escolha de "Lançar" e "Financeiro" por transportadora (CT-e recebidos). O CT-e novo dela já
-- vem marcado assim. Pela raiz do CNPJ (8 primeiros dígitos, tirados da chave do CT-e): vale para todas as filiais.
USE cteauto;

CREATE TABLE cte_transportadora_marca (
  id             INT NOT NULL AUTO_INCREMENT,
  empresa_id     BIGINT UNSIGNED NOT NULL,
  cnpj_raiz      CHAR(8) NOT NULL,
  lancar         TINYINT(1) NOT NULL DEFAULT 1,
  financeiro     TINYINT(1) NOT NULL DEFAULT 0,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_cte_transportadora_marca (empresa_id, cnpj_raiz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Reversão:
DROP TABLE cte_transportadora_marca;
*/
