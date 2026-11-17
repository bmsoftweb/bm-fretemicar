import { NextRequest, NextResponse } from '../../../../../server/next-server.js';
import { sessao } from '../../../../../lib/auth.js';
import { masterPool as db } from '../../../../../lib/db.js';

/**
 * Guarda a escolha { lancar, financeiro } feita na linha como a da transportadora (raiz do CNPJ, da chave do CT-e):
 * o próximo CT-e dela já vem marcado assim
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  const { id } = await params;
  const b = (await req.json().catch(() => null)) || {};
  await db.execute(
    'INSERT INTO cte_transportadora_marca (empresa_id, cnpj_raiz, lancar, financeiro) ' +
      'SELECT empresa_id, SUBSTRING(chave, 7, 8), ?, ? FROM cte_recebidos WHERE id = ? AND empresa_id = ? ' +
      'ON DUPLICATE KEY UPDATE lancar = VALUES(lancar), financeiro = VALUES(financeiro)',
    [b.lancar === false ? 0 : 1, b.lancar !== false && b.financeiro === true ? 1 : 0, Number(id), s.empresaId],
  );
  return NextResponse.json({ ok: true });
}
