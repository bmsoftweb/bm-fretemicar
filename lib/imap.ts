import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { unzipSync } from 'fflate';

// Leitura das caixas por IMAP. Não marca como lida nem move: o controle é o UID (cte_contas_email.ultimo_uid).
// Na primeira leitura (ultimo_uid = 0) só olha os últimos 30 dias.

export interface ContaImap {
  host: string;
  porta: number;
  ssl: boolean;
  usuario: string;
  senha: string;
  pasta: string;
  ultimo_uid: number;
}

export interface Anexo {
  nome: string;
  dados: Uint8Array;
}

function conectar(c: ContaImap) {
  return new ImapFlow({
    host: c.host,
    port: c.porta,
    secure: c.ssl,
    auth: { user: c.usuario, pass: c.senha },
    logger: false,
    connectionTimeout: 20_000,
  });
}

export async function testarConta(c: ContaImap) {
  const cli = conectar(c);
  await cli.connect();
  try {
    const lock = await cli.getMailboxLock(c.pasta || 'INBOX');
    lock.release();
  } finally {
    await cli.logout().catch(() => {});
  }
}

/** XMLs anexados (soltos ou dentro de .zip) */
function anexos(lista: { filename?: string; contentType: string; content: Buffer }[]): Anexo[] {
  const out: Anexo[] = [];
  for (const a of lista) {
    const nome = a.filename || '';
    if (/\.zip$/i.test(nome) || /zip/i.test(a.contentType)) {
      try {
        for (const [n, d] of Object.entries(unzipSync(a.content))) if (/\.xml$/i.test(n)) out.push({ nome: n.split('/').pop()!, dados: d });
      } catch {
        // zip corrompido: ignora
      }
    } else if (/\.xml$/i.test(nome) || /xml/i.test(a.contentType)) out.push({ nome: nome || 'anexo.xml', dados: a.content });
  }
  return out;
}

/**
 * Lê as mensagens novas em ordem de UID e chama `porMensagem` para cada uma (depois dela o UID já pode ser gravado).
 * Para quando passar de `prazo` (Date.now()): devolve true se ficou mensagem para a próxima chamada.
 */
export async function lerConta(
  c: ContaImap,
  porMensagem: (uid: number, de: string, assunto: string, anexos: Anexo[]) => Promise<void>,
  prazo: number,
): Promise<boolean> {
  const cli = conectar(c);
  await cli.connect();
  try {
    const lock = await cli.getMailboxLock(c.pasta || 'INBOX');
    try {
      const busca = c.ultimo_uid > 0 ? { uid: `${c.ultimo_uid + 1}:*` } : { since: new Date(Date.now() - 30 * 86_400_000) };
      // "n:*" sempre devolve a última mensagem, mesmo com UID menor que n
      const uids = ((await cli.search(busca, { uid: true })) || []).filter((u) => u > c.ultimo_uid).sort((a, b) => a - b);
      for (const uid of uids) {
        if (Date.now() > prazo) return true;
        const msg = await cli.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) throw new Error(`Falha ao baixar a mensagem UID ${uid}`);
        const m = await simpleParser(msg.source);
        await porMensagem(uid, m.from?.value[0]?.address || '', m.subject || '', anexos(m.attachments));
      }
      return false;
    } finally {
      lock.release();
    }
  } finally {
    await cli.logout().catch(() => {});
  }
}
