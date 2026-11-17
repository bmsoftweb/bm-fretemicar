import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { sessao } from '../../../lib/auth.js';
import { masterPool as db } from '../../../lib/db.js';
import { UF_CODIGO } from '../../../lib/sefaz.js';
import { TRANSP_FRETE } from '../../../lib/lancar.js';

// Configuração da filial: em qual empresa do BMsoft lançar, com qual usuário e banco. A BMapi vem do ambiente.
export async function GET() {
  const s = await sessao();
  const [rows]: any = await db.execute(
    'SELECT bmsoft_empresa_id, bmsoft_usuario_id, banco_id, transp_frete, ler_email, uf_empresa, sefaz_ultimo_nsu, sefaz_cert_cnpj, ' +
      'sefaz_cert_razao_social, sefaz_cert_numero_serie, sefaz_cert_emissor, sefaz_cert_valido_de, sefaz_cert_valido_ate ' +
      'FROM cte_config WHERE empresa_id = ?',
    [s.empresaId],
  );
  const c = rows[0];
  let certificado = null;
  if (c?.sefaz_cert_valido_ate) {
    const dias = Math.floor((new Date(c.sefaz_cert_valido_ate).getTime() - Date.now()) / 86_400_000);
    certificado = {
      cnpj: c.sefaz_cert_cnpj, razaoSocial: c.sefaz_cert_razao_social, numeroSerie: c.sefaz_cert_numero_serie,
      emissor: c.sefaz_cert_emissor, validoDe: c.sefaz_cert_valido_de, validoAte: c.sefaz_cert_valido_ate,
      diasParaVencer: dias, vencido: dias < 0,
    };
  }
  return NextResponse.json({
    bmsoft_empresa_id: 1,
    bmsoft_usuario_id: 1,
    banco_id: 0,
    transp_frete: '2',
    ler_email: false, // padrão: só a SEFAZ lê
    uf_empresa: '',
    sefaz_ultimo_nsu: c?.sefaz_ultimo_nsu == null ? '' : String(c.sefaz_ultimo_nsu),
    ...(c
      ? {
          bmsoft_empresa_id: c.bmsoft_empresa_id, bmsoft_usuario_id: c.bmsoft_usuario_id, banco_id: c.banco_id,
          transp_frete: c.transp_frete || '2', ler_email: !!c.ler_email, uf_empresa: c.uf_empresa || '',
        }
      : {}),
    ufs: Object.keys(UF_CODIGO).sort(),
    transp_fretes: TRANSP_FRETE,
    bmapi_url: process.env.BMAPI_URL || '',
    bmapi_token: !!process.env.BMAPI_TOKEN,
    certificado,
  });
}

export async function PUT(req: NextRequest) {
  const s = await sessao();
  const b = await req.json();
  const n = (v: unknown) => Math.max(0, parseInt(String(v)) || 0);
  if (!n(b.bmsoft_empresa_id)) return NextResponse.json({ error: 'Informe a empresa do BMsoft.' }, { status: 400 });
  const uf = String(b.uf_empresa || '').toUpperCase();
  if (uf && !(uf in UF_CODIGO)) return NextResponse.json({ error: `UF "${uf}" não existe.` }, { status: 400 });
  const nsuTexto = String(b.sefaz_ultimo_nsu ?? '').replace(/\D/g, '');
  if (nsuTexto && nsuTexto.length > 15) return NextResponse.json({ error: 'NSU inválido.' }, { status: 400 });
  const transpFrete = String(b.transp_frete ?? '2');
  if (!(transpFrete in TRANSP_FRETE)) return NextResponse.json({ error: 'Modalidade do frete inválida.' }, { status: 400 });
  await db.execute(
    'INSERT INTO cte_config (empresa_id, bmsoft_empresa_id, bmsoft_usuario_id, banco_id, transp_frete, ler_email, uf_empresa, sefaz_ultimo_nsu) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE bmsoft_empresa_id = VALUES(bmsoft_empresa_id), bmsoft_usuario_id = VALUES(bmsoft_usuario_id), banco_id = VALUES(banco_id), transp_frete = VALUES(transp_frete), ler_email = VALUES(ler_email), uf_empresa = VALUES(uf_empresa), sefaz_ultimo_nsu = VALUES(sefaz_ultimo_nsu)',
    [s.empresaId, n(b.bmsoft_empresa_id), n(b.bmsoft_usuario_id), n(b.banco_id), transpFrete, b.ler_email ? 1 : 0, uf || null, nsuTexto || null],
  );
  return NextResponse.json({ success: true });
}
