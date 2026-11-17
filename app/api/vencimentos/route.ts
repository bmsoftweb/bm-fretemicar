import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { configDa } from '../../../lib/processo.js';
import { apiExec, apiRows, sqlData } from '../../../lib/bmapi.js';
import { ErroAcesso } from '../../../lib/acesso.js';

// Contas a pagar em aberto (DpPPrincipal, Status 'A') das transportadoras, no BMsoft, para trocar o vencimento.

/** Só inteiros positivos: a lista vai no texto do SQL (a BMapi não tem parâmetro de lista) */
const listaIds = (v: unknown[]): number[] => v.map(Number).filter((n) => Number.isInteger(n) && n > 0);

/**
 * Sem ?fornecedores: transportadoras (Pessoas.Perfil_Tra) com conta em aberto na empresa.
 * Com ?fornecedores=ID,ID,...: as contas em aberto delas, por vencimento.
 */
export async function GET(req: NextRequest) {
  const s = await sessao();
  const { empresaId } = await configDa(s.empresaId);
  const fornecedores = listaIds((req.nextUrl.searchParams.get('fornecedores') || '').split(','));
  if (!fornecedores.length) {
    const rows = await apiRows(
      'SELECT p.ID, p.Nome, p.CPFCNPJ, COUNT(*) AS Abertos FROM DpPPrincipal d JOIN Pessoas p ON p.ID = d.ID_Fornecedor ' +
        "WHERE d.ID_Empresa = :Emp AND d.Status = 'A' AND p.Perfil_Tra = TRUE GROUP BY p.ID, p.Nome, p.CPFCNPJ ORDER BY p.Nome",
      { Emp: empresaId },
    );
    return NextResponse.json(rows.map((r) => ({ id: r.ID, nome: r.Nome, cnpj: r.CPFCNPJ, abertos: r.Abertos })));
  }
  const rows = await apiRows(
    'SELECT d.ID, d.Doc_Serie, d.Doc_Num, d.Seq, d.Seq_Tot, d.Data_Geracao, d.Vencimento, d.Valor, d.Valor_Pago, d.ID_NF, ' +
      'p.Nome, p.CPFCNPJ FROM DpPPrincipal d JOIN Pessoas p ON p.ID = d.ID_Fornecedor ' +
      `WHERE d.ID_Empresa = :Emp AND d.Status = 'A' AND d.ID_Fornecedor IN (${fornecedores.join(',')}) ORDER BY d.Vencimento, d.ID`,
    { Emp: empresaId },
  );
  return NextResponse.json(
    rows.map((r) => ({
      id: r.ID, transportadora: r.Nome, cnpj: r.CPFCNPJ,
      documento: [r.Doc_Serie, r.Doc_Num].filter(Boolean).join('-'), parcela: `${r.Seq}/${r.Seq_Tot}`,
      geracao: r.Data_Geracao, vencimento: r.Vencimento, valor: r.Valor, pago: r.Valor_Pago || 0, entrada: r.ID_NF,
    })),
  );
}

/** Corpo { ids: number[], vencimento: 'aaaa-mm-dd' }: troca o vencimento das contas marcadas (só as em aberto) */
export async function PUT(req: NextRequest) {
  const s = await sessao();
  const { empresaId } = await configDa(s.empresaId);
  const b = (await req.json()) || {};
  const ids = listaIds(Array.isArray(b.ids) ? b.ids : []);
  if (!ids.length) throw new ErroAcesso(400, 'Marque ao menos uma conta.');
  const venc = String(b.vencimento || '');
  const d = new Date(`${venc}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc) || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== venc)
    throw new ErroAcesso(400, 'Data de vencimento inválida.');
  const alteradas = await apiExec(
    `UPDATE DpPPrincipal SET Vencimento = ${sqlData(venc)} WHERE ID_Empresa = :Emp AND Status = 'A' AND ID IN (${ids.join(',')})`,
    { Emp: empresaId },
  );
  return NextResponse.json({ alteradas });
}
