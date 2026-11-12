import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { masterPool as db } from '../../../lib/db.js';

// Configuração da filial: em qual empresa do BMsoft lançar, com qual usuário e banco. A BMapi vem do ambiente.
export async function GET() {
  const s = await sessao();
  const [rows]: any = await db.execute('SELECT bmsoft_empresa_id, bmsoft_usuario_id, banco_id FROM cte_config WHERE empresa_id = ?', [s.empresaId]);
  return NextResponse.json({
    bmsoft_empresa_id: 1,
    bmsoft_usuario_id: 1,
    banco_id: 0,
    ...rows[0],
    bmapi_url: process.env.BMAPI_URL || '',
    bmapi_token: !!process.env.BMAPI_TOKEN,
  });
}

export async function PUT(req: NextRequest) {
  const s = await sessao();
  const b = await req.json();
  const n = (v: unknown) => Math.max(0, parseInt(String(v)) || 0);
  if (!n(b.bmsoft_empresa_id)) return NextResponse.json({ error: 'Informe a empresa do BMsoft.' }, { status: 400 });
  await db.execute(
    'INSERT INTO cte_config (empresa_id, bmsoft_empresa_id, bmsoft_usuario_id, banco_id) VALUES (?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE bmsoft_empresa_id = VALUES(bmsoft_empresa_id), bmsoft_usuario_id = VALUES(bmsoft_usuario_id), banco_id = VALUES(banco_id)',
    [s.empresaId, n(b.bmsoft_empresa_id), n(b.bmsoft_usuario_id), n(b.banco_id)],
  );
  return NextResponse.json({ success: true });
}
