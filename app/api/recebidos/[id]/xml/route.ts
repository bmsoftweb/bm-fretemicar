import { NextRequest } from '../../../../../server/next-server.js';
import { sessao } from '../../../../../lib/auth.js';
import { masterPool as db } from '../../../../../lib/db.js';

/** Download do XML guardado, com o nome da chave */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  const { id } = await params;
  const [rows]: any = await db.execute('SELECT chave, xml FROM cte_recebidos WHERE id = ? AND empresa_id = ?', [id, s.empresaId]);
  if (!rows[0]) return new Response('Não encontrado', { status: 404 });
  return new Response(rows[0].xml, {
    headers: { 'Content-Type': 'application/xml', 'Content-Disposition': `attachment; filename="${rows[0].chave}.xml"` },
  });
}
