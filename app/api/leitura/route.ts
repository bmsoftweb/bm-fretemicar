import { NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { buscarCTe } from '../../../lib/processo.js';

/** Lê e-mails e SEFAZ (comandado pelo usuário). Com `pendente`, a tela chama de novo até acabar. */
export async function POST() {
  const s = await sessao();
  return NextResponse.json(await buscarCTe(s.empresaId));
}
