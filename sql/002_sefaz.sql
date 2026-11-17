-- freteMicar web: leitura de CT-e direto da SEFAZ (CTeDistribuicaoDFe), ao lado da leitura por e-mail.
-- O certificado digital A1 (.pfx) é enviado na tela de Configuração e fica no banco (não precisa de arquivo
-- nem variável de ambiente no servidor): mesmo padrão do bm-nfe, com a senha cifrada, como a das contas de e-mail.
USE cteauto;

ALTER TABLE cte_config
  ADD COLUMN sefaz_cert_pfx          MEDIUMBLOB   NULL COMMENT 'Certificado digital A1 (.pfx/.p12) da empresa',
  ADD COLUMN sefaz_cert_senha        VARCHAR(500) NULL COMMENT 'Senha do certificado, cifrada (AES-256-GCM com o SESSION_SECRET)',
  ADD COLUMN sefaz_cert_cnpj         CHAR(14)     NULL COMMENT 'Extraído do certificado no envio, só para exibir',
  ADD COLUMN sefaz_cert_razao_social VARCHAR(160) NULL,
  ADD COLUMN sefaz_cert_numero_serie VARCHAR(80)  NULL,
  ADD COLUMN sefaz_cert_emissor      VARCHAR(255) NULL,
  ADD COLUMN sefaz_cert_valido_de    DATE         NULL,
  ADD COLUMN sefaz_cert_valido_ate   DATE         NULL,
  ADD COLUMN sefaz_ultimo_nsu BIGINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Último NSU já buscado no CTeDistribuicaoDFe; NULL = nunca configurado (a próxima leitura só marca a posição atual, sem lançar o que já existia antes)';

ALTER TABLE cte_recebidos
  ADD COLUMN origem ENUM('email','sefaz') NOT NULL DEFAULT 'email' AFTER conta_id;

/* Reversão:
ALTER TABLE cte_recebidos DROP COLUMN origem;
ALTER TABLE cte_config
  DROP COLUMN sefaz_cert_pfx, DROP COLUMN sefaz_cert_senha, DROP COLUMN sefaz_cert_cnpj,
  DROP COLUMN sefaz_cert_razao_social, DROP COLUMN sefaz_cert_numero_serie, DROP COLUMN sefaz_cert_emissor,
  DROP COLUMN sefaz_cert_valido_de, DROP COLUMN sefaz_cert_valido_ate, DROP COLUMN sefaz_ultimo_nsu;
*/
