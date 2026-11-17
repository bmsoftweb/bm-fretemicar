import { NextRequest, NextResponse } from '../../../../../server/next-server.js';
import { sessao } from '../../../../../lib/auth.js';
import { masterPool as db } from '../../../../../lib/db.js';

/**
 * O usuário decidiu não lançar este CT-e: situação Ignorado (só os ainda pendentes: não lançado, erro, transportadora).
 * Com { desfazer: true }, um Ignorado volta a Não lançado, para poder lançar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  const { id } = await params;
  const b = (await req.json().catch(() => null)) || {};
  await db.execute(
    b.desfazer === true
      ? "UPDATE cte_recebidos SET situacao = 'N', mensagem = '' WHERE id = ? AND empresa_id = ? AND situacao = 'I'"
      : "UPDATE cte_recebidos SET situacao = 'I', mensagem = 'Ignorado pelo usuário' WHERE id = ? AND empresa_id = ? AND situacao IN ('N', 'E', 'P')",
    [Number(id), s.empresaId],
  );
  return NextResponse.json({ ok: true });
}
