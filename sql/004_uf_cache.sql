-- freteMicar web: guarda a UF da empresa (consultada na BMapi) para não depender dela a cada leitura da SEFAZ.
USE cteauto;

ALTER TABLE cte_config
  ADD COLUMN uf_empresa CHAR(2) NULL
    COMMENT 'UF da empresa no BMsoft (cUFAutor do pedido à SEFAZ); atualizada sempre que a BMapi responde, usada como reserva quando ela está fora do ar';

/* Reversão:
ALTER TABLE cte_config DROP COLUMN uf_empresa;
*/
