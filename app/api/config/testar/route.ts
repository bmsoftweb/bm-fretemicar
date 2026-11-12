import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { apiRows } from '../../../../lib/bmapi.js';

/** Confere a BMapi e a empresa informada: devolve nome, UF e CNPJ (o CNPJ é o tomador aceito nos CT-e) */
export async function POST(req: NextRequest) {
  await sessao();
  const { bmsoft_empresa_id } = await req.json();
  const e = (await apiRows('SELECT NomeContribuinte, UF, CGCMF FROM Empresas WHERE ID = :ID', { ID: Number(bmsoft_empresa_id) || 0 }))[0];
  if (!e) return NextResponse.json({ error: `BMapi respondeu, mas a empresa ${bmsoft_empresa_id} não existe no BMsoft.` }, { status: 400 });
  return NextResponse.json({ nome: e.NomeContribuinte, uf: e.UF, cnpj: e.CGCMF });
}
