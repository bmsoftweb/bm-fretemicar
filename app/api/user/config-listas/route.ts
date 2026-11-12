import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../../../../lib/session.js';
import { lerConfigListas, salvarConfigListas } from '../../../../lib/config-grid.js';
import { cookies } from '../../../../server/next-headers.js';

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json(await lerConfigListas(session.userId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const corpo = await req.json();
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 });
    await salvarConfigListas(session.userId, corpo);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
