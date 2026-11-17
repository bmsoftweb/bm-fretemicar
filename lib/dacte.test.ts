import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gerarDacte } from './dacte.js';

// Mesmos XMLs de ../tests do cte.test.ts (fora do repositório): sem a pasta, pula
const pasta = new URL('../../tests/', import.meta.url);
const ler = (n: string) => fs.readFileSync(new URL(n, pasta));
const semXml = { skip: fs.existsSync(pasta) ? false : 'XMLs de teste (../tests) não encontrados' };

test('DACTE dos CT-e de exemplo sai em PDF', semXml, async () => {
  for (const n of ['cte_cst00.xml', 'cte_cst90.xml']) {
    const pdf = await gerarDacte(ler(n));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 5000, `${n}: PDF pequeno demais (${pdf.length} bytes)`);
  }
});

test('DACTE de NF-e dá erro', semXml, async () => {
  await assert.rejects(gerarDacte(ler('nfe.xml')), /não contém um CT-e/);
});
