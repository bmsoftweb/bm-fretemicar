import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { masterPool as db } from '../../../lib/db.js';

/** Histórico dos CT-e recebidos (os 500 mais recentes), filtro opcional ?situacao=L|E|I|D|P */
export async function GET(req: NextRequest) {
  const s = await sessao();
  const sit = req.nextUrl.searchParams.get('situacao') || '';
  const [rows] = await db.execute(
    "SELECT r.id, DATE_FORMAT(r.recebido_em, '%d/%m/%Y %H:%i') AS recebido, c.descricao AS conta, r.remetente, r.assunto, r.arquivo, " +
      'r.chave, r.emitente, r.valor, r.situacao, r.entrada_id, r.mensagem ' +
      'FROM cte_recebidos r LEFT JOIN cte_contas_email c ON c.id = r.conta_id ' +
      `WHERE r.empresa_id = ?${/^[LEIDP]$/.test(sit) ? ' AND r.situacao = ?' : ''} ORDER BY r.id DESC LIMIT 500`,
    /^[LEIDP]$/.test(sit) ? [s.empresaId, sit] : [s.empresaId],
  );
  return NextResponse.json(rows);
}
