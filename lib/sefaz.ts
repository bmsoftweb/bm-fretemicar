import https from 'node:https';
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import { masterPool as db } from './db.js';
import { decifrar } from './cripto.js';
import { carregarPfx } from './certificado.js';

// Leitura de CT-e direto da SEFAZ (webservice CTeDistribuicaoDFe, Ambiente Nacional), autenticado pelo certificado
// digital A1 da empresa. Complementa a leitura por e-mail: pega todo CT-e contra o CNPJ, mesmo o que a
// transportadora não mandou. Confirmado contra o ambiente de produção com o certificado real da Micar.

const URL_PRODUCAO = 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx';

// Código IBGE da UF (cUFAutor do pedido): a mesma tabela usada no restante da NF-e/CT-e.
export const UF_CODIGO: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52', MA: '21', MT: '51',
  MS: '50', MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RO: '11', RR: '14',
  RS: '43', SC: '42', SP: '35', SE: '28', TO: '17',
};

export interface CertificadoSefaz {
  key: Buffer;
  cert: Buffer;
  cnpj: string;
}

// O certificado fica no banco (cte_config), com a senha cifrada; abrir o PKCS#12 custa caro (RSA em JS puro),
// então fica em memória por empresa enquanto não for trocado (mesmo padrão de lib/db.ts para colunas).
const cache = new Map<number, { atualizadoEm: string; cert: CertificadoSefaz }>();

/** Esquece o certificado em cache (chamado ao enviar ou remover um novo, em app/api/config/certificado) */
export function esquecerCertificado(empresaId: number) {
  cache.delete(empresaId);
}

/** null = a empresa ainda não cadastrou certificado (a leitura pela SEFAZ fica desligada, sem erro) */
export async function certificadoDaEmpresa(empresaId: number): Promise<CertificadoSefaz | null> {
  const [rows]: any = await db.execute('SELECT sefaz_cert_pfx, sefaz_cert_senha, atualizado_em FROM cte_config WHERE empresa_id = ?', [empresaId]);
  const row = rows[0];
  if (!row?.sefaz_cert_pfx) return null;

  const atualizadoEm = String(row.atualizado_em ?? '');
  const emCache = cache.get(empresaId);
  if (emCache && emCache.atualizadoEm === atualizadoEm) return emCache.cert;

  const senha = decifrar(row.sefaz_cert_senha || '');
  if (!senha) throw new Error('A senha do certificado não abre (SESSION_SECRET trocado?); envie o certificado de novo na Configuração.');
  const { chavePrivadaPem, certificadoPem, info } = carregarPfx(row.sefaz_cert_pfx, senha);
  if (info.validoAte < new Date()) throw new Error(`Certificado venceu em ${info.validoAte.toLocaleDateString('pt-BR')}.`);

  const cert: CertificadoSefaz = { key: Buffer.from(chavePrivadaPem), cert: Buffer.from(certificadoPem), cnpj: info.cnpj };
  cache.set(empresaId, { atualizadoEm, cert });
  return cert;
}

export interface Lote {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  docs: { nsu: string; schema: string; xml: Buffer }[];
}

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

/** Um lote (até ~50 documentos) a partir de `ultNSU` (exclusive); cStat 137 = nada novo, 138 = achou */
async function consultarLote(c: CertificadoSefaz, uf: string, ultNSU: string): Promise<Lote> {
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body><cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">' +
    '<cteDadosMsg><distDFeInt versao="1.00" xmlns="http://www.portalfiscal.inf.br/cte">' +
    `<tpAmb>1</tpAmb><cUFAutor>${UF_CODIGO[uf.toUpperCase()] ?? uf}</cUFAutor><CNPJ>${c.cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${ultNSU.padStart(15, '0')}</ultNSU></distNSU>` +
    '</distDFeInt></cteDadosMsg></cteDistDFeInteresse></soap12:Body></soap12:Envelope>';

  const url = new URL(URL_PRODUCAO);
  const body: string = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname, path: url.pathname, method: 'POST', key: c.key, cert: c.cert,
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(envelope) },
        timeout: 25_000,
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve(b));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('SEFAZ não respondeu a tempo.'));
    });
    req.on('error', (e) => reject(new Error(`Falha ao falar com a SEFAZ: ${e.message}`)));
    req.write(envelope);
    req.end();
  });

  return interpretarResposta(body, ultNSU);
}

/** Separado de consultarLote só para dar para testar sem rede (fixture sintética em sefaz.test.ts) */
export function interpretarResposta(body: string, ultNSUPedido: string): Lote {
  const ret = parser.parse(body)?.Envelope?.Body?.cteDistDFeInteresseResponse?.cteDistDFeInteresseResult?.retDistDFeInt;
  if (!ret) throw new Error('Resposta da SEFAZ fora do padrão esperado.');
  let lote = ret.loteDistDFeInt?.docZip ?? [];
  if (!Array.isArray(lote)) lote = [lote];
  return {
    cStat: String(ret.cStat ?? ''),
    xMotivo: String(ret.xMotivo ?? ''),
    ultNSU: String(ret.ultNSU ?? ultNSUPedido).padStart(15, '0'),
    maxNSU: String(ret.maxNSU ?? '0').padStart(15, '0'),
    docs: lote.map((d: any) => ({
      nsu: String(d['@_NSU']),
      schema: String(d['@_schema']),
      xml: zlib.gunzipSync(Buffer.from(String(d['#text'] ?? ''), 'base64')),
    })),
  };
}

export interface PassoSefaz {
  /** null = acabou (nada novo ou chegou ao maxNSU); senão, o NSU para a próxima chamada */
  proximoNsu: string | null;
  /** XML dos CT-e do lote (eventos e outros documentos já saem de fora) */
  ctes: Buffer[];
}

/**
 * Um passo da leitura: busca o lote a partir de `ultimoNsu` e devolve os CT-e dele e o NSU para continuar.
 * `uf` é a UF da empresa (cUFAutor do pedido).
 */
export async function passoSefaz(c: CertificadoSefaz, uf: string, ultimoNsu: string): Promise<PassoSefaz> {
  const lote = await consultarLote(c, uf, ultimoNsu);
  if (lote.cStat === '137') return { proximoNsu: null, ctes: [] }; // nenhum documento novo
  if (lote.cStat !== '138') throw new Error(`SEFAZ: ${lote.cStat} ${lote.xMotivo}`);
  const ctes = lote.docs.filter((d) => d.schema.startsWith('procCTe')).map((d) => d.xml);
  return { proximoNsu: lote.ultNSU < lote.maxNSU ? lote.ultNSU : null, ctes };
}

/** Só para saber até onde vai hoje (maxNSU), sem baixar nada: usado para estabelecer a posição inicial */
export async function nsuAtual(c: CertificadoSefaz, uf: string): Promise<string> {
  const lote = await consultarLote(c, uf, '0');
  return lote.maxNSU;
}
