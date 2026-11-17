import { NextRequest, NextResponse } from '../../../../../server/next-server.js';
import { sessao } from '../../../../../lib/auth.js';
import { relancar } from '../../../../../lib/processo.js';

/**
 * Lança o XML guardado; corpo { transportadora } com os dados confirmados quando ela não está cadastrada no BMsoft,
 * e { financeiro } para gerar também a conta a pagar
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  const { id } = await params;
  const b = (await req.json()) || {};
  return NextResponse.json(await relancar(Number(id), s.empresaId, b.transportadora || undefined, b.financeiro === true));
}
