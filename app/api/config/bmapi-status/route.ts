import { NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { bmapiOnline } from '../../../../lib/bmapi.js';
import { masterPool as db } from '../../../../lib/db.js';

/** Status da lista de recebidos: se a BMapi responde agora (até 5 s) e quando foi a última busca automática */
export async function GET() {
  const s = await sessao();
  const [online, capturaAuto] = await Promise.all([
    bmapiOnline(),
    db
      .execute("SELECT DATE_FORMAT(captura_auto_em, '%d/%m/%Y %H:%i') AS d FROM cte_config WHERE empresa_id = ?", [s.empresaId])
      .then(([r]: any) => (r[0]?.d as string) || null)
      .catch(() => null), // sem a coluna (sql/006 ainda não rodado): só não mostra
  ]);
  return NextResponse.json({ online, capturaAuto });
}
