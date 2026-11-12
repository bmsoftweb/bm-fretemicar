# freteMicar web

@../../_claude/web.md

Versão web do freteMicar, no padrão do bm-estoque (Vite + React + Express, login pela tabela `usuarios`, banco `cteauto`,
ListaCrm/FormCrm). Roda na Vercel (`api/index.ts` + `vercel.json`); local com `npm run dev`.

- Leitura dos e-mails só manual (botão "Ler e-mails"): sem cron. A função para em ~40 s e devolve `pendente`;
  a tela chama de novo até acabar.
- Lançamento no BMsoft pela BMapi (`lib/lancar.ts`), mesma regra do `uLancar.pas` do app Delphi.
- Rotas da API: lista fixa em `server/app.ts` (a Vercel não acha arquivos por varredura). Rota nova = entrada nova lá.
- Imports do lado do servidor: relativos com `.js` (sem `@/`).
- Tabelas: `sql/000_banco_e_usuarios.sql` (banco + usuarios) e `sql/001_tabelas_mysql.sql` (cte_*); eu crio no banco.
- Testes: `npm test` (parser do CT-e com os XMLs de `../tests`).
