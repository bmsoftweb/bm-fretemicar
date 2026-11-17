-- freteMicar web: data/hora da última busca automática (cron de hora em hora), mostrada na lista de recebidos.
USE cteauto;

ALTER TABLE cte_config
  ADD COLUMN captura_auto_em DATETIME NULL COMMENT 'Última busca automática de CT-e (cron)';

/* Reversão:
ALTER TABLE cte_config DROP COLUMN captura_auto_em;
*/
