import { NextRequest } from '../../../../../server/next-server.js';
import { sessao } from '../../../../../lib/auth.js';
import { masterPool as db } from '../../../../../lib/db.js';
import { gerarDacte } from '../../../../../lib/dacte.js';

/** DACTE em PDF, gerado do XML guardado; abre no navegador (inline), com o nome da chave */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  const { id } = await params;
  const [rows]: any = await db.execute('SELECT chave, xml FROM cte_recebidos WHERE id = ? AND empresa_id = ?', [id, s.empresaId]);
  if (!rows[0]) return new Response('Não encontrado', { status: 404 });
  const pdf = await gerarDacte(rows[0].xml);
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${rows[0].chave}.pdf"` },
  });
}
