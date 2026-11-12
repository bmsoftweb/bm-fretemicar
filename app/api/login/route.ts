import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { abrirSessao, autenticar, ErroAcesso } from '../../../lib/acesso.js';

// Login pela tabela usuarios (lib/acesso.ts)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const u = await autenticar(String(body?.login || '').trim(), typeof body?.senha === 'string' ? body.senha : '');
    const session = await abrirSessao(u);
    return NextResponse.json({ success: true, role: session.role });
  } catch (error: any) {
    if (error instanceof ErroAcesso) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor: ' + error.message }, { status: 500 });
  }
}
