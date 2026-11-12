import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { masterPool as db } from '../../../../lib/db.js';
import { cifrar } from '../../../../lib/cripto.js';
import { lerConta } from '../route.js';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const s = await sessao();
  const { id } = await params;
  const b = await req.json();
  const c = lerConta(b);
  // Senha em branco = mantém a gravada; ultimo_uid = 0 relê os últimos 30 dias
  const extra = (b.senha ? ', senha = ?' : '') + (b.reler ? ', ultimo_uid = 0' : '');
  const [r]: any = await db.execute(
    `UPDATE cte_contas_email SET descricao = ?, host = ?, porta = ?, \`ssl\` = ?, usuario = ?, pasta = ?, ativo = ?${extra} WHERE id = ? AND empresa_id = ?`,
    [c.descricao, c.host, c.porta, c.ssl, c.usuario, c.pasta, c.ativo, ...(b.senha ? [cifrar(String(b.senha))] : []), id, s.empresaId],
  );
  if (!r.affectedRows) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const s = await sessao();
  const { id } = await params;
  // Os recebidos ficam (histórico); só deixam de apontar para a conta
  await db.execute('UPDATE cte_recebidos SET conta_id = NULL WHERE conta_id = ? AND empresa_id = ?', [id, s.empresaId]);
  await db.execute('DELETE FROM cte_contas_email WHERE id = ? AND empresa_id = ?', [id, s.empresaId]);
  return NextResponse.json({ success: true });
}
