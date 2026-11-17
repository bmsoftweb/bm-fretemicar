-- freteMicar web: liga/desliga a varredura por e-mail (padrão: desligada, só a SEFAZ lê).
USE cteauto;

ALTER TABLE cte_config
  ADD COLUMN ler_email TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Varredura das contas de e-mail em Buscar CT-e; 0 = desligada (padrão, só a SEFAZ lê)';

/* Reversão:
ALTER TABLE cte_config DROP COLUMN ler_email;
*/
