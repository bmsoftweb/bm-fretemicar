import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { buscarCTe } from '../../../../lib/processo.js';

// Empresa fixa (ID_EMPRESA do .env): esta rota não tem sessão de usuário, é chamada pelo cron.
const EMPRESA_ID = Number(process.env.ID_EMPRESA) || 1;

/**
 * Buscar CT-e automático (Vercel Cron, vercel.json). Autenticado por CRON_SECRET: a Vercel manda sozinha o
 * cabeçalho Authorization quando a variável existe; sem ela, a rota fica aberta (só para rodar local sem configurar).
 * Mesma função da tela ("Buscar CT-e"), só que sem usuário: lança o que achar, sem confirmar transportadora nova
 * (fica com situação "Transportadora", para confirmar depois na tela).
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return NextResponse.json(await buscarCTe(EMPRESA_ID, 55));
}
