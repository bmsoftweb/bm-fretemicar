import { NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { bmapiOnline } from '../../../../lib/bmapi.js';

/** Indicador rápido (até 5 s) se a BMapi está respondendo agora */
export async function GET() {
  await sessao();
  return NextResponse.json({ online: await bmapiOnline() });
}
