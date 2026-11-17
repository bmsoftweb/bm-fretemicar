# Histórico de versões

Mais recente primeiro. PATCH a cada envio ao GitHub; MAJOR/MINOR só quando pedido.

## 0.1.6 — 2026-11-17

- Tela nova "Vencimentos": contas a pagar em aberto (`DpPPrincipal`, Status `A`) das transportadoras no BMsoft,
  por vencimento. Escolha de várias transportadoras, com as filiais da mesma raiz de CNPJ agrupadas (marca o grupo
  de uma vez); marca as contas (checkbox no cabeçalho marca todas as que a busca mostra) e "Alterar Vencimento
  para..." troca o vencimento de todas as marcadas.
- Busca da lista acha as datas também em dd/mm/aaaa. `ListaCrm` aceita conteúdo próprio no cabeçalho da coluna
  (`cabecalho`) e avisa a tela das linhas filtradas (`onFiltrar`).

## 0.1.5 — 2026-11-17

- Modalidade do frete (`EntradasM.Transp_Frete`) escolhida em Configuração (0 remetente, 1 destinatário,
  2 terceiros, 9 sem frete; padrão 2). Antes ia sempre 9; no BMsoft o usuário escolhe na importação do CT-e
  (migração nova: `sql/007_transp_frete.sql`, rodar antes de publicar).

## 0.1.4 — 2026-11-17

- Indicador da BMapi dava "fora do ar" com ela no ar: a consulta de teste (`SELECT 1 AS X`) não é aceita pelo DBISAM.
  Agora usa `SELECT ID FROM Empresas WHERE ID = 0`. A mesma verificação decide se a leitura da SEFAZ lança os CT-e,
  que vinham ficando com erro "BMapi fora do ar"; esses podem ser relançados.

## 0.1.3 — 2026-11-16

- Busca automática passa de hora em hora para 90 em 90 min (duas agendas no `vercel.json`), para respeitar o
  intervalo mínimo de 1 h da SEFAZ depois de uma consulta sem novidade (senão bloqueia com 656).
- Lista de recebidos mostra a data/hora da última busca automática, ao lado da contagem
  (migração nova: `sql/006_captura_auto.sql`).

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
