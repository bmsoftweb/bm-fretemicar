// Cliente da BMapi (POST /sql): um comando por chamada, sem transação. Datas vão no texto do SQL ('aaaa-mm-dd').
export type Params = Record<string, string | number | boolean | null>;

export async function bmapi(sql: string, params: Params = {}, timeoutMs = 60_000): Promise<{ rows: any[]; rowsAffected: number }> {
  const url = (process.env.BMAPI_URL || '').replace(/\/+$/, '');
  const token = process.env.BMAPI_TOKEN;
  if (!url || !token) throw new Error('BMAPI_URL / BMAPI_TOKEN não configurados.');
  let resp: globalThis.Response;
  try {
    resp = await fetch(`${url}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': token },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    throw new Error(`BMapi fora do ar (${url}): ${e.message}`);
  }
  const j: any = await resp.json().catch(() => null);
  if (!j) throw new Error(`Resposta inválida da BMapi (HTTP ${resp.status})`);
  if (!j.success) throw new Error(j.error || 'erro desconhecido na BMapi');
  return { rows: j.rows ?? [], rowsAffected: j.rowsAffected ?? 0 };
}

export const apiRows = async (sql: string, params?: Params) => (await bmapi(sql, params)).rows;

/** Primeiro campo da primeira linha, como texto ('' sem linha) */
export async function apiValue(sql: string, params?: Params): Promise<string> {
  const r = (await apiRows(sql, params))[0];
  const v = r ? Object.values(r)[0] : null;
  return v == null ? '' : String(v);
}

export const apiExec = async (sql: string, params?: Params) => (await bmapi(sql, params)).rowsAffected;

/** Literal de data para o SQL da BMapi */
export const sqlData = (d: string) => `'${d.replace(/[^0-9: -]/g, '')}'`;

/** Verificação rápida (5 s) para o indicador de status, sem lançar erro */
export async function bmapiOnline(): Promise<boolean> {
  try {
    // DBISAM não aceita SELECT sem FROM nem TOP: consulta válida que não devolve linha
    await bmapi('SELECT ID FROM Empresas WHERE ID = 0', {}, 5_000);
    return true;
  } catch {
    return false;
  }
}
