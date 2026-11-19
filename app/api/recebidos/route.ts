import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { masterPool as db } from '../../../lib/db.js';

/** Histórico dos CT-e recebidos (os 500 mais recentes), filtro opcional ?situacao=L|E|I|D|P|N */
export async function GET(req: NextRequest) {
  const s = await sessao();
  const sit = req.nextUrl.searchParams.get('situacao') || '';
  const [rows] = await db.execute(
    "SELECT r.id, DATE_FORMAT(r.recebido_em, '%d/%m/%Y %H:%i') AS recebido, DATE_FORMAT(r.data_emissao, '%d/%m/%Y') AS emissao, " +
      "IF(r.origem = 'sefaz', 'SEFAZ', c.descricao) AS conta, r.origem, r.remetente, r.assunto, r.arquivo, " +
      // Número do CT-e: posições 26 a 34 da chave (nCT)
      'r.chave, CAST(SUBSTRING(r.chave, 26, 9) AS UNSIGNED) AS numero, r.emitente, r.valor, r.situacao, r.entrada_id, r.mensagem, m.lancar AS marca_lancar, m.financeiro AS marca_financeiro ' +
      'FROM cte_recebidos r LEFT JOIN cte_contas_email c ON c.id = r.conta_id ' +
      // Última escolha de Lançar/Financeiro da transportadora (raiz do CNPJ, posições 7 a 14 da chave)
      'LEFT JOIN cte_transportadora_marca m ON m.empresa_id = r.empresa_id AND m.cnpj_raiz = SUBSTRING(r.chave, 7, 8) ' +
      `WHERE r.empresa_id = ?${/^[LEIDPN]$/.test(sit) ? ' AND r.situacao = ?' : ''} ORDER BY r.id DESC LIMIT 500`,
    /^[LEIDPN]$/.test(sit) ? [s.empresaId, sit] : [s.empresaId],
  );
  return NextResponse.json(rows);
}
