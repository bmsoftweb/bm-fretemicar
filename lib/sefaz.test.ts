import 'dotenv/config'; // sefaz.ts agora importa lib/db.ts (certificadoDaEmpresa), que exige o .env ao carregar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { interpretarResposta } from './sefaz.js';

// Envelope sintético (sem nenhum dado real de cliente), no formato confirmado contra o ambiente de produção
// da SEFAZ em 2026-11-16 (ver nota em sefaz.ts). docZip(s) aqui são gzip de um texto qualquer, só para provar
// o descompacta/decodifica; quem lê o CT-e de verdade é parseCTe (cte.ts), testado à parte.
const envelope = (corpo: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
  `<soap:Body><cteDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">` +
  `<cteDistDFeInteresseResult><retDistDFeInt versao="1.00" xmlns="http://www.portalfiscal.inf.br/cte">${corpo}</retDistDFeInt>` +
  `</cteDistDFeInteresseResult></cteDistDFeInteresseResponse></soap:Body></soap:Envelope>`;

const zip = (texto: string) => zlib.gzipSync(Buffer.from(texto)).toString('base64');

test('cStat 137 (nenhum documento novo): lote vazio, sem loteDistDFeInt', () => {
  const xml = envelope(
    '<tpAmb>1</tpAmb><verAplic>x</verAplic><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo>' +
      '<dhResp>2026-01-01T00:00:00</dhResp><ultNSU>000000000000010</ultNSU><maxNSU>000000000000010</maxNSU>',
  );
  const lote = interpretarResposta(xml, '000000000000010');
  assert.equal(lote.cStat, '137');
  assert.deepEqual(lote.docs, []);
});

test('cStat 138 com um único docZip: fast-xml-parser não deixa como array (vira objeto solto)', () => {
  const xml = envelope(
    '<tpAmb>1</tpAmb><verAplic>x</verAplic><cStat>138</cStat><xMotivo>documento localizado.</xMotivo>' +
      '<dhResp>2026-01-01T00:00:00</dhResp><ultNSU>000000000000011</ultNSU><maxNSU>000000000000020</maxNSU>' +
      `<loteDistDFeInt><docZip NSU="000000000000011" schema="procCTe_v4.00.xsd">${zip('conteúdo A')}</docZip></loteDistDFeInt>`,
  );
  const lote = interpretarResposta(xml, '000000000000010');
  assert.equal(lote.cStat, '138');
  assert.equal(lote.ultNSU, '000000000000011');
  assert.equal(lote.maxNSU, '000000000000020');
  assert.equal(lote.docs.length, 1);
  assert.equal(lote.docs[0].nsu, '000000000000011');
  assert.equal(lote.docs[0].schema, 'procCTe_v4.00.xsd');
  assert.equal(lote.docs[0].xml.toString(), 'conteúdo A');
});

test('cStat 138 com vários docZip (CT-e e evento misturados), na ordem', () => {
  const xml = envelope(
    '<tpAmb>1</tpAmb><verAplic>x</verAplic><cStat>138</cStat><xMotivo>documento localizado.</xMotivo>' +
      '<dhResp>2026-01-01T00:00:00</dhResp><ultNSU>000000000000013</ultNSU><maxNSU>000000000000013</maxNSU>' +
      '<loteDistDFeInt>' +
      `<docZip NSU="000000000000011" schema="procCTe_v4.00.xsd">${zip('cte 1')}</docZip>` +
      `<docZip NSU="000000000000012" schema="procEventoCTe_v4.00.xsd">${zip('evento')}</docZip>` +
      `<docZip NSU="000000000000013" schema="procCTe_v4.00.xsd">${zip('cte 2')}</docZip>` +
      '</loteDistDFeInt>',
  );
  const lote = interpretarResposta(xml, '000000000000010');
  assert.equal(lote.docs.length, 3);
  assert.deepEqual(lote.docs.map((d) => d.schema), ['procCTe_v4.00.xsd', 'procEventoCTe_v4.00.xsd', 'procCTe_v4.00.xsd']);
  assert.deepEqual(lote.docs.map((d) => d.xml.toString()), ['cte 1', 'evento', 'cte 2']);
});
