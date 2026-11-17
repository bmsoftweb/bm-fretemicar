# Histórico de versões

Mais recente primeiro. PATCH a cada envio ao GitHub; MAJOR/MINOR só quando pedido.

## 0.1.2 — 2026-11-16

- Leitura direta da SEFAZ (CTeDistribuicaoDFe) com certificado A1 guardado no banco (senha cifrada); é a fonte
  padrão. E-mail passa a ser opcional (liga/desliga em Configuração).
- UF da empresa guardada no banco (e editável), para ler a SEFAZ mesmo com a BMapi fora do ar; NSU editável para
  buscar CT-e mais antigos.
- Busca automática de hora em hora (Vercel Cron, `/api/cron/leitura`, protegida por `CRON_SECRET`).
- Leitura da SEFAZ com a BMapi fora do ar não tenta lançar (guarda com erro, para relançar) e confere o tempo a
  cada CT-e, sem estourar o limite da função; CT-e já guardado (mesma chave) não é gravado de novo.
- Indicador de BMapi on-line/fora do ar; coluna "Emitido em" na lista de recebidos.
- Correções no modo escuro (sobreposição nas colunas fixas da grade, barra de rolagem, itens dos selects).
- Migrações novas: `sql/002` a `sql/005`.

## 0.1.1 — 2026-11-11

- Primeiro envio do projeto ao repositório GitHub bm-fretemicar.
- Leitura manual das contas de e-mail (IMAP), reconhecimento do XML de CT-e e lançamento no BMsoft pela BMapi
  (EntradasM, EntradasCFOP, EntradasReferenciadas, DpPPrincipal, XML_Lista).
- Cadastro de transportadora nova com confirmação dos dados; telas de contas de e-mail e configuração.
- Login pela tabela usuarios do banco cteauto.
