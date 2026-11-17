import { NextRequest, NextResponse } from '../../../../server/next-server.js';
import { sessao } from '../../../../lib/auth.js';
import { masterPool as db } from '../../../../lib/db.js';
import { cifrar } from '../../../../lib/cripto.js';
import { carregarPfx } from '../../../../lib/certificado.js';
import { esquecerCertificado } from '../../../../lib/sefaz.js';
import { ErroAcesso } from '../../../../lib/acesso.js';

const data = (d: Date) => d.toISOString().slice(0, 10);

/** Envia (ou substitui) o certificado digital A1 usado para ler CT-e direto da SEFAZ */
export async function POST(req: NextRequest) {
  const s = await sessao();
  const { pfx_base64, senha } = await req.json();
  if (!pfx_base64) throw new ErroAcesso(400, 'Envie o arquivo .pfx do certificado.');
  if (!senha) throw new ErroAcesso(400, 'Informe a senha do certificado.');

  const pfx = Buffer.from(String(pfx_base64).replace(/^data:[^,]+,/, ''), 'base64');
  let info;
  try {
    ({ info } = carregarPfx(pfx, senha)); // falha aqui (senha errada, arquivo inválido) não grava nada
  } catch (e: any) {
    throw new ErroAcesso(400, e.message);
  }

  const [r]: any = await db.execute(
    'UPDATE cte_config SET sefaz_cert_pfx = ?, sefaz_cert_senha = ?, sefaz_cert_cnpj = ?, sefaz_cert_razao_social = ?, ' +
      'sefaz_cert_numero_serie = ?, sefaz_cert_emissor = ?, sefaz_cert_valido_de = ?, sefaz_cert_valido_ate = ? WHERE empresa_id = ?',
    [pfx, cifrar(senha), info.cnpj, info.razaoSocial.slice(0, 160), info.numeroSerie.slice(0, 80), info.emissor.slice(0, 255), data(info.validoDe), data(info.validoAte), s.empresaId],
  );
  if (!r.affectedRows) throw new ErroAcesso(400, 'Salve primeiro a empresa do BMsoft, em Configuração.');

  esquecerCertificado(s.empresaId);
  const dias = Math.floor((info.validoAte.getTime() - Date.now()) / 86_400_000);
  return NextResponse.json({
    certificado: {
      cnpj: info.cnpj, razaoSocial: info.razaoSocial, numeroSerie: info.numeroSerie, emissor: info.emissor,
      validoDe: data(info.validoDe), validoAte: data(info.validoAte), diasParaVencer: dias, vencido: dias < 0,
    },
  });
}

/** Remove o certificado (a leitura pela SEFAZ fica desligada; o que já foi lido continua no histórico) */
export async function DELETE() {
  const s = await sessao();
  await db.execute(
    'UPDATE cte_config SET sefaz_cert_pfx = NULL, sefaz_cert_senha = NULL, sefaz_cert_cnpj = NULL, ' +
      'sefaz_cert_razao_social = NULL, sefaz_cert_numero_serie = NULL, sefaz_cert_emissor = NULL, ' +
      'sefaz_cert_valido_de = NULL, sefaz_cert_valido_ate = NULL WHERE empresa_id = ?',
    [s.empresaId],
  );
  esquecerCertificado(s.empresaId);
  return NextResponse.json({ success: true });
}
