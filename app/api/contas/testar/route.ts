import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { masterPool as db } from '../../../../lib/db.js';
import { decifrar } from '../../../../lib/cripto.js';
import { testarConta } from '../../../../lib/imap.js';
import { lerConta } from '../route.js';

/** Conecta com os dados da tela (senha em branco = a gravada da conta `id`) e abre a pasta */
export async function POST(req: NextRequest) {
  const s = await sessao();
  const b = await req.json();
  const c = lerConta(b);
  let senha = String(b.senha || '');
  if (!senha && b.id) {
    const [rows]: any = await db.execute('SELECT senha FROM cte_contas_email WHERE id = ? AND empresa_id = ?', [b.id, s.empresaId]);
    senha = decifrar(rows[0]?.senha || '');
  }
  if (!senha) return NextResponse.json({ error: 'Informe a senha.' }, { status: 400 });
  try {
    await testarConta({ ...c, ssl: !!c.ssl, senha, ultimo_uid: 0 });
  } catch (e: any) {
    return NextResponse.json({ error: `Falha na conexão: ${e.responseText || e.message}` }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
