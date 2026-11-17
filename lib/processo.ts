import { masterPool as db } from './db.js';
import { decifrar } from './cripto.js';
import { parseCTe, type PessoaXml } from './cte.js';
import { lerConta } from './imap.js';
import { apiRows, bmapiOnline } from './bmapi.js';
import { lancar, type ConfigBMsoft, type Resultado } from './lancar.js';
import { ErroAcesso } from './acesso.js';
import { certificadoDaEmpresa, nsuAtual, passoSefaz } from './sefaz.js';

// Leitura das contas de e-mail (comandada pelo usuário) e o registro em cte_recebidos.

export async function configDa(empresaId: number): Promise<ConfigBMsoft> {
  const [rows]: any = await db.execute('SELECT bmsoft_empresa_id, bmsoft_usuario_id, banco_id, transp_frete FROM cte_config WHERE empresa_id = ?', [empresaId]);
  const c = rows[0];
  if (!c?.bmsoft_empresa_id) throw new ErroAcesso(400, 'Configure a empresa do BMsoft antes de ler os e-mails (menu Configuração).');
  return {
    empresaId: Number(c.bmsoft_empresa_id), usuarioId: Number(c.bmsoft_usuario_id) || 0, bancoId: Number(c.banco_id) || 0,
    transpFrete: c.transp_frete || '2',
  };
}

async function lancarSeguro(...args: Parameters<typeof lancar>): Promise<Resultado> {
  try {
    return await lancar(...args);
  } catch (e: any) {
    return { situacao: 'E', mensagem: e.message, entradaId: 0 };
  }
}

// A busca só baixa e guarda (situação N): o usuário marca na tela o que lançar e com ou sem financeiro
const AGUARDANDO = 'Aguardando lançamento';

export interface ResumoLeitura {
  mensagens: number;
  ctes: number;
  /** Erro por conta (uma conta com erro não para as outras) */
  erros: string[];
  /** Acabou o tempo com mensagem por ler: o front chama de novo */
  pendente: boolean;
}

const juntar = (a: ResumoLeitura, b: ResumoLeitura): ResumoLeitura => ({
  mensagens: a.mensagens + b.mensagens,
  ctes: a.ctes + b.ctes,
  erros: [...a.erros, ...b.erros],
  pendente: a.pendente || b.pendente,
});

/** Lê e-mails (se ligado em Configuração; padrão desligado) e SEFAZ, dividindo o tempo entre os dois */
export async function buscarCTe(empresaId: number, segundos = 40): Promise<ResumoLeitura> {
  const [rows]: any = await db.execute('SELECT ler_email FROM cte_config WHERE empresa_id = ?', [empresaId]);
  if (!rows[0]?.ler_email) return lerSefaz(empresaId, segundos);
  const a = await lerEmails(empresaId, segundos * 0.6);
  const b = await lerSefaz(empresaId, segundos * 0.4);
  return juntar(a, b);
}

/** Lê as contas ativas da filial e guarda os CT-e novos, até `segundos` (limite da função na Vercel) */
export async function lerEmails(empresaId: number, segundos = 40): Promise<ResumoLeitura> {
  const prazo = Date.now() + segundos * 1000;
  const res: ResumoLeitura = { mensagens: 0, ctes: 0, erros: [], pendente: false };
  const [contas]: any = await db.execute('SELECT * FROM cte_contas_email WHERE empresa_id = ? AND ativo = 1 ORDER BY descricao', [empresaId]);
  for (const conta of contas) {
    if (Date.now() > prazo) {
      res.pendente = true;
      break;
    }
    try {
      const senha = decifrar(conta.senha || '');
      if (!senha) throw new Error('senha não abre (SESSION_SECRET trocado?); informe de novo no cadastro da conta');
      const faltou = await lerConta(
        { ...conta, senha, ssl: !!conta.ssl, ultimo_uid: Number(conta.ultimo_uid) || 0 },
        async (uid, de, assunto, anexos) => {
          res.mensagens++;
          for (const a of anexos) {
            const c = parseCTe(a.dados);
            if (!c) continue;
            res.ctes++;
            await db.execute(
              'INSERT INTO cte_recebidos (empresa_id, conta_id, recebido_em, data_emissao, remetente, assunto, arquivo, chave, emitente, valor, ' +
                "situacao, entrada_id, mensagem, xml) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 'N', NULL, ?, ?)",
              [empresaId, conta.id, c.dhEmi || null, de.slice(0, 120), assunto.slice(0, 200), a.nome.slice(0, 120), c.chave,
                (c.emit.fantasia || c.emit.nome).slice(0, 60), c.vTPrest, AGUARDANDO, Buffer.from(a.dados)],
            );
          }
          await db.execute('UPDATE cte_contas_email SET ultimo_uid = ? WHERE id = ?', [uid, conta.id]);
        },
        prazo,
      );
      if (faltou) res.pendente = true;
    } catch (e: any) {
      res.erros.push(`${conta.descricao}: ${e.message}`);
    }
  }
  return res;
}

/** Guarda a UF da empresa, lida da BMapi (chamado daqui e de app/api/config/testar) */
export async function cacheUf(empresaId: number, uf: string) {
  if (uf) await db.execute('UPDATE cte_config SET uf_empresa = ? WHERE empresa_id = ?', [uf, empresaId]).catch(() => {});
}

/**
 * UF da empresa (cUFAutor do pedido à SEFAZ). Busca na BMapi e guarda em cte_config.uf_empresa; se a BMapi
 * estiver fora do ar, usa a última guardada (sem isso, uma BMapi fora do ar impediria até baixar e guardar os
 * CT-e novos — eles ficam com erro de lançamento, prontos para relançar assim que ela voltar).
 */
export async function ufDaEmpresa(empresaId: number, bmsoftEmpresaId: number, online = true): Promise<string> {
  try {
    // Fora do ar, nem tenta: a chamada só desiste no timeout (60 s), o tempo todo da função na Vercel
    if (!online) throw new Error('BMapi fora do ar');
    const emp = (await apiRows('SELECT UF FROM Empresas WHERE ID = :ID', { ID: bmsoftEmpresaId }))[0];
    if (!emp) throw new Error(`Empresa ${bmsoftEmpresaId} não encontrada no BMsoft`);
    const uf = String(emp.UF ?? '');
    await cacheUf(empresaId, uf);
    return uf;
  } catch (e: any) {
    const [rows]: any = await db.execute('SELECT uf_empresa FROM cte_config WHERE empresa_id = ?', [empresaId]);
    const uf = rows[0]?.uf_empresa;
    if (!uf) throw e; // nunca conseguiu falar com a BMapi: sem UF guardada, não tem como continuar
    return uf;
  }
}

/**
 * Busca CT-e direto da SEFAZ (CTeDistribuicaoDFe), ao lado da leitura por e-mail: pega todo CT-e contra o CNPJ da
 * empresa, mesmo o que a transportadora não mandou por e-mail. Opcional (certificado enviado na tela de
 * Configuração); sem ele, não faz nada (sem erro). Na primeira vez só marca a posição atual (NSU), sem lançar o
 * que já existia antes.
 */
export async function lerSefaz(empresaId: number, segundos = 40): Promise<ResumoLeitura> {
  const res: ResumoLeitura = { mensagens: 0, ctes: 0, erros: [], pendente: false };
  const prazo = Date.now() + segundos * 1000;
  try {
    const cert = await certificadoDaEmpresa(empresaId);
    if (!cert) return res; // recurso não configurado: sem erro

    const cfg = await configDa(empresaId);
    // BMapi fora do ar: usa a UF guardada, sem esperar o timeout
    const online = await bmapiOnline();
    const uf = await ufDaEmpresa(empresaId, cfg.empresaId, online);

    const [rows]: any = await db.execute('SELECT sefaz_ultimo_nsu FROM cte_config WHERE empresa_id = ?', [empresaId]);
    let nsu = rows[0]?.sefaz_ultimo_nsu;
    if (nsu == null) {
      // Primeira vez: marca a posição atual (sem baixar o acumulado) e para por aqui.
      const atual = await nsuAtual(cert, uf);
      await db.execute('UPDATE cte_config SET sefaz_ultimo_nsu = ? WHERE empresa_id = ?', [atual, empresaId]);
      return res;
    }

    nsu = String(nsu);
    lotes: for (;;) {
      if (Date.now() > prazo) {
        res.pendente = true;
        break;
      }
      const passo = await passoSefaz(cert, uf, nsu);
      for (const xml of passo.ctes) {
        // O NSU só avança no fim do lote: se o tempo acabar no meio, a próxima chamada pede o mesmo lote de
        // novo e pula (pela chave) o que já ficou guardado aqui
        if (Date.now() > prazo) {
          res.pendente = true;
          break lotes;
        }
        const c = parseCTe(xml);
        if (!c) continue;
        const [ja]: any = await db.execute('SELECT 1 FROM cte_recebidos WHERE empresa_id = ? AND chave = ? LIMIT 1', [empresaId, c.chave]);
        if (ja.length) continue;
        res.mensagens++;
        res.ctes++;
        await db.execute(
          'INSERT INTO cte_recebidos (empresa_id, conta_id, origem, recebido_em, data_emissao, remetente, assunto, arquivo, chave, emitente, valor, ' +
            "situacao, entrada_id, mensagem, xml) VALUES (?, NULL, 'sefaz', NOW(), ?, NULL, NULL, NULL, ?, ?, ?, 'N', NULL, ?, ?)",
          [empresaId, c.dhEmi || null, c.chave, (c.emit.fantasia || c.emit.nome).slice(0, 60), c.vTPrest, AGUARDANDO, Buffer.from(xml)],
        );
      }
      if (passo.proximoNsu == null) break;
      nsu = passo.proximoNsu;
      await db.execute('UPDATE cte_config SET sefaz_ultimo_nsu = ? WHERE empresa_id = ?', [nsu, empresaId]);
    }
  } catch (e: any) {
    res.erros.push(`SEFAZ: ${e.message}`);
  }
  return res;
}

/**
 * Lança o XML guardado (erro, transportadora pendente, não lançado); `transportadora` = dados confirmados na tela;
 * `financeiro` = gera também a conta a pagar
 */
export async function relancar(id: number, empresaId: number, transportadora?: PessoaXml, financeiro = false): Promise<Resultado & { emit?: PessoaXml }> {
  const [rows]: any = await db.execute('SELECT xml FROM cte_recebidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
  if (!rows[0]) throw new ErroAcesso(404, 'Registro não encontrado.');
  const xml: Buffer = rows[0].xml;
  const c = parseCTe(xml);
  if (!c) throw new ErroAcesso(400, 'O XML guardado não é um CT-e.');
  const r = await lancarSeguro(c, xml, await configDa(empresaId), transportadora, financeiro);
  await db.execute('UPDATE cte_recebidos SET situacao = ?, entrada_id = ?, mensagem = ? WHERE id = ?', [r.situacao, r.entradaId || null, r.mensagem.slice(0, 250), id]);
  // Pendente: a tela abre a confirmação com os dados do XML
  return r.situacao === 'P' ? { ...r, emit: c.emit } : r;
}
