import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { masterPool as db } from '../../../lib/db.js';
import { cifrar } from '../../../lib/cripto.js';

// Contas de e-mail lidas pela filial. A senha nunca volta para a tela.
export const CAMPOS = 'id, descricao, host, porta, `ssl`, usuario, pasta, ultimo_uid, ativo';

/** Campos do corpo, validados; senha só quando informada */
export function lerConta(b: any) {
  const c = {
    descricao: String(b.descricao || '').trim().slice(0, 60),
    host: String(b.host || '').trim().slice(0, 120),
    porta: parseInt(b.porta) || 993,
    ssl: b.ssl ? 1 : 0,
    usuario: String(b.usuario || '').trim().slice(0, 120),
    pasta: String(b.pasta || '').trim().slice(0, 60) || 'INBOX',
    ativo: b.ativo === false ? 0 : 1,
  };
  if (!c.descricao || !c.host || !c.usuario) throw Object.assign(new Error('Informe descrição, servidor e usuário.'), { status: 400 });
  return c;
}

export async function GET() {
  const s = await sessao();
  const [rows] = await db.execute(`SELECT ${CAMPOS} FROM cte_contas_email WHERE empresa_id = ? ORDER BY descricao`, [s.empresaId]);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const s = await sessao();
  const b = await req.json();
  const c = lerConta(b);
  if (!b.senha) return NextResponse.json({ error: 'Informe a senha.' }, { status: 400 });
  const [r]: any = await db.execute(
    'INSERT INTO cte_contas_email (empresa_id, descricao, host, porta, `ssl`, usuario, senha, pasta, ativo, ultimo_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [s.empresaId, c.descricao, c.host, c.porta, c.ssl, c.usuario, cifrar(String(b.senha)), c.pasta, c.ativo],
  );
  return NextResponse.json({ id: r.insertId });
}
