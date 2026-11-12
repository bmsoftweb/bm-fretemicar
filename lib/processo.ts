import { masterPool as db } from './db.js';
import { decifrar } from './cripto.js';
import { parseCTe, type PessoaXml } from './cte.js';
import { lerConta } from './imap.js';
import { lancar, type ConfigBMsoft, type Resultado } from './lancar.js';
import { ErroAcesso } from './acesso.js';

// Leitura das contas de e-mail (comandada pelo usuário) e o registro em cte_recebidos.

export async function configDa(empresaId: number): Promise<ConfigBMsoft> {
  const [rows]: any = await db.execute('SELECT bmsoft_empresa_id, bmsoft_usuario_id, banco_id FROM cte_config WHERE empresa_id = ?', [empresaId]);
  const c = rows[0];
  if (!c?.bmsoft_empresa_id) throw new ErroAcesso(400, 'Configure a empresa do BMsoft antes de ler os e-mails (menu Configuração).');
  return { empresaId: Number(c.bmsoft_empresa_id), usuarioId: Number(c.bmsoft_usuario_id) || 0, bancoId: Number(c.banco_id) || 0 };
}

async function lancarSeguro(...args: Parameters<typeof lancar>): Promise<Resultado> {
  try {
    return await lancar(...args);
  } catch (e: any) {
    return { situacao: 'E', mensagem: e.message, entradaId: 0 };
  }
}

export interface ResumoLeitura {
  mensagens: number;
  ctes: number;
  lancados: number;
  /** Erro por conta (uma conta com erro não para as outras) */
  erros: string[];
  /** Acabou o tempo com mensagem por ler: o front chama de novo */
  pendente: boolean;
}

/** Lê as contas ativas da filial e lança os CT-e novos, até `segundos` (limite da função na Vercel) */
export async function lerEmails(empresaId: number, segundos = 40): Promise<ResumoLeitura> {
  const prazo = Date.now() + segundos * 1000;
  const cfg = await configDa(empresaId);
  const res: ResumoLeitura = { mensagens: 0, ctes: 0, lancados: 0, erros: [], pendente: false };
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
            const r = await lancarSeguro(c, a.dados, cfg);
            if (r.situacao === 'L') res.lancados++;
            await db.execute(
              'INSERT INTO cte_recebidos (empresa_id, conta_id, recebido_em, remetente, assunto, arquivo, chave, emitente, valor, ' +
                'situacao, entrada_id, mensagem, xml) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [empresaId, conta.id, de.slice(0, 120), assunto.slice(0, 200), a.nome.slice(0, 120), c.chave,
                (c.emit.fantasia || c.emit.nome).slice(0, 60), c.vTPrest, r.situacao, r.entradaId || null, r.mensagem.slice(0, 250), Buffer.from(a.dados)],
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

/** Lança de novo o XML guardado (erro, transportadora pendente); `transportadora` = dados confirmados na tela */
export async function relancar(id: number, empresaId: number, transportadora?: PessoaXml): Promise<Resultado & { emit?: PessoaXml }> {
  const [rows]: any = await db.execute('SELECT xml FROM cte_recebidos WHERE id = ? AND empresa_id = ?', [id, empresaId]);
  if (!rows[0]) throw new ErroAcesso(404, 'Registro não encontrado.');
  const xml: Buffer = rows[0].xml;
  const c = parseCTe(xml);
  if (!c) throw new ErroAcesso(400, 'O XML guardado não é um CT-e.');
  const r = await lancarSeguro(c, xml, await configDa(empresaId), transportadora);
  await db.execute('UPDATE cte_recebidos SET situacao = ?, entrada_id = ?, mensagem = ? WHERE id = ?', [r.situacao, r.entradaId || null, r.mensagem.slice(0, 250), id]);
  // Pendente: a tela abre a confirmação com os dados do XML
  return r.situacao === 'P' ? { ...r, emit: c.emit } : r;
}
