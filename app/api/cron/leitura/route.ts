import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { buscarCTe } from '../../../../lib/processo.js';
import { masterPool as db } from '../../../../lib/db.js';

// Empresa fixa (ID_EMPRESA do .env): esta rota não tem sessão de usuário, é chamada pelo cron.
const EMPRESA_ID = Number(process.env.ID_EMPRESA) || 1;

/**
 * Buscar CT-e automático (Vercel Cron, vercel.json). Autenticado por CRON_SECRET: a Vercel manda sozinha o
 * cabeçalho Authorization quando a variável existe; sem ela, a rota fica aberta (só para rodar local sem configurar).
 * Mesma função da tela ("Buscar CT-e"), só que sem usuário: baixa e guarda o que achar como "Não lançado", para o
 * usuário marcar na tela o que lançar.
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  // 45 s de 60 (maxDuration): sobra para o passo que já começou (um lote da SEFAZ ou um lançamento)
  const res = await buscarCTe(EMPRESA_ID, 45);
  // Mostrada na lista de recebidos; sem a coluna (sql/006 ainda não rodado) não derruba a leitura
  await db.execute('UPDATE cte_config SET captura_auto_em = NOW() WHERE empresa_id = ?', [EMPRESA_ID]).catch(() => {});
  return NextResponse.json(res);
}
