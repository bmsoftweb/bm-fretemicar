-- freteMicar web: modalidade do frete gravada em EntradasM.Transp_Frete do BMsoft (lá o usuário escolhe na importação).
USE cteauto;

ALTER TABLE cte_config
  ADD COLUMN transp_frete CHAR(1) NOT NULL DEFAULT '2'
    COMMENT 'EntradasM.Transp_Frete dos CT-e lançados: 0 remetente, 1 destinatário, 2 terceiros, 9 sem frete';

/* Reversão:
ALTER TABLE cte_config DROP COLUMN transp_frete;
*/
