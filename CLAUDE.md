# freteMicar web

@../../_claude/web.md

Versão web do freteMicar, no padrão do bm-estoque (Vite + React + Express, login pela tabela `usuarios`, banco `cteauto`,
ListaCrm/FormCrm). Roda na Vercel (`api/index.ts` + `vercel.json`); local com `npm run dev`.

- Leitura pelo botão "Buscar CT-e" (a função para em ~40 s e devolve `pendente`; a tela chama de novo até acabar)
  e também automática de hora em hora, via Vercel Cron (`vercel.json` → `/api/cron/leitura`, 55 s de orçamento;
  `CRON_SECRET` autentica a chamada — a própria Vercel manda o cabeçalho sozinha). Cron de hora em hora exige
  plano pago na Vercel (Hobby só deixa 1x/dia); sem isso, um serviço externo (cron-job.org etc.) chamando a
  mesma URL com `Authorization: Bearer <CRON_SECRET>` funciona em qualquer plano.
- Duas fontes de CT-e (`lib/processo.ts`, `buscarCTe`): direto da SEFAZ (`lib/sefaz.ts`, webservice
  CTeDistribuicaoDFe — pega todo CT-e contra o CNPJ, mesmo o que a transportadora não mandou por e-mail; é a
  fonte padrão) e e-mail (IMAP, `lib/imap.ts`), **desligado por padrão** — liga em Configuração
  (`cte_config.ler_email`). Com o e-mail ligado, as duas rodam uma do lado da outra, dividindo o tempo. Na
  primeira vez que a SEFAZ é configurada, só marca a posição atual (NSU), sem lançar o que já existia antes
  (decisão do cliente: não processar o acumulado).
- Certificado digital A1 (.pfx) enviado pela tela Configuração, não por variável de ambiente: fica no banco
  (`cte_config`), com a senha cifrada (mesmo padrão das senhas das contas de e-mail). `lib/certificado.ts` abre
  o .pfx com node-forge (puro JS: o OpenSSL do Node recusa o RC2-40 que boa parte das ACs ainda usa) — mesma
  lógica do `bm-nfe` (`server/nfe/certificado.ts`), só muda onde a senha fica guardada.
- Lançamento no BMsoft pela BMapi (`lib/lancar.ts`), mesma regra do `uLancar.pas` do app Delphi; a chave do CT-e
  evita duplicar quando o mesmo documento chega pelos dois caminhos.
- A leitura pela SEFAZ também precisa da UF da empresa (`cUFAutor` do pedido): `cte_config.uf_empresa`, gravada
  sozinha sempre que a BMapi responde (`lib/processo.ts` → `ufDaEmpresa`/`cacheUf`) e também editável à mão em
  Configuração (`select` com a lista de `lib/sefaz.ts` → `UF_CODIGO`) — para já funcionar mesmo com a BMapi
  fora do ar, inclusive na primeira vez. Assim, uma BMapi fora do ar não impede baixar e guardar os CT-e novos
  (só o lançamento deles falha, individualmente, pronto para relançar depois).
- Rotas da API: lista fixa em `server/app.ts` (a Vercel não acha arquivos por varredura). Rota nova = entrada nova lá.
- Imports do lado do servidor: relativos com `.js` (sem `@/`).
- `cte_recebidos.data_emissao`: data de emissão do CT-e (do XML, `dhEmi`), não a data em que chegou
  (`recebido_em`); gravada no INSERT, nos dois caminhos (e-mail e SEFAZ).
- Tabelas: `sql/000_banco_e_usuarios.sql` (banco + usuarios), `sql/001_tabelas_mysql.sql` (cte_*),
  `sql/002_sefaz.sql` (colunas da leitura e do certificado pela SEFAZ), `sql/003_ler_email.sql`
  (liga/desliga o e-mail), `sql/004_uf_cache.sql` (cache da UF) e `sql/005_data_emissao.sql`
  (data de emissão); eu crio/altero no banco.
- Testes: `npm test` (parser do CT-e com os XMLs de `../tests`; resposta da SEFAZ com fixture sintética, sem
  dado real de cliente — o repositório é público).
