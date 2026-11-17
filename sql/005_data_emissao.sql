-- freteMicar web: mostra a data de emissão do CT-e (não a data que chegou) na lista de recebidos.
USE cteauto;

ALTER TABLE cte_recebidos
  ADD COLUMN data_emissao DATE NULL COMMENT 'Data de emissão do CT-e (dhEmi do XML)' AFTER recebido_em;

/* Reversão:
ALTER TABLE cte_recebidos DROP COLUMN data_emissao;
*/
