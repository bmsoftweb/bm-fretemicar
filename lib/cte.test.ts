import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCTe, cfopEntrada } from './cte.js';
import { somarDias } from './hora.js';

// Mesmos XMLs reais dos testes do app Delphi (..\tests). Ficam fora do repositório (dados de clientes):
// sem a pasta, esses testes são pulados.
const pasta = new URL('../../tests/', import.meta.url);
const ler = (n: string) => fs.readFileSync(new URL(n, pasta));
const semXml = { skip: fs.existsSync(pasta) ? false : 'XMLs de teste (../tests) não encontrados' };

test('CT-e CST 90, tomador = destinatário, 1 NF-e', semXml, () => {
  const c = parseCTe(ler('cte_cst90.xml'))!;
  assert.equal(c.chave, '42261056873344000160570010000001061438891696');
  assert.equal(c.cstat, '100');
  assert.equal(c.tpAmb, '1');
  assert.deepEqual([c.modelo, c.serie, c.numero], ['57', '1', 106]);
  assert.equal(c.dhEmi, '2026-10-29');
  assert.equal(c.vTPrest, 2970);
  assert.equal(c.vCarga, 89586);
  assert.equal(c.cst, '90');
  assert.equal(c.tomaCnpj, '07359609000109');
  assert.equal(c.emit.cnpj, '56873344000160');
  assert.deepEqual([c.emit.cmun, c.emit.uf, c.emit.nro], ['4208500', 'SC', '149']);
  assert.deepEqual(c.nfes, ['42261090810706002589550010001428471894445941']);
  assert.equal(c.ufIni, 'SC');
});

test('CT-e CST 00 com ICMS (o CST 000 do IBSCBS não confunde)', semXml, () => {
  const c = parseCTe(ler('cte_cst00.xml'))!;
  assert.equal(c.cst, '00');
  assert.deepEqual([c.vBC, c.pICMS, c.vICMS], [1327.8, 17, 225.73]);
  assert.equal(Math.round(c.vBC * c.pICMS) / 100, c.vICMS); // 1.327,80 x 17% = 225,73
  assert.equal(c.nfes.length, 2);
});

test('NF-e e lixo não são CT-e', semXml, () => {
  assert.equal(parseCTe(ler('nfe.xml')), null);
  assert.equal(parseCTe(Buffer.from('não é xml')), null);
});

test('CFOP pela UF de início e vencimento', () => {
  assert.equal(cfopEntrada('SC', 'SC'), '1.353');
  assert.equal(cfopEntrada('PR', 'SC'), '2.353');
  assert.equal(somarDias('2026-11-11', 30), '2026-12-11');
  assert.equal(somarDias('2026-12-15', 30), '2027-01-14');
});
