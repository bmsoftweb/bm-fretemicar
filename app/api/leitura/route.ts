import { NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { lerEmails } from '../../../lib/processo.js';

/** Lê os e-mails (comandado pelo usuário). Com `pendente`, a tela chama de novo até acabar. */
export async function POST() {
  const s = await sessao();
  return NextResponse.json(await lerEmails(s.empresaId));
}
