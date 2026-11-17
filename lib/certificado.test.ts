import { test } from 'node:test';
import assert from 'node:assert/strict';
import forge from 'node-forge';
import { carregarPfx } from './certificado.js';

// Certificado autoassinado, gerado na hora (chave pequena, só para o teste ser rápido) — nenhum dado real.
function pfxDeTeste(cn: string, senha: string): Buffer {
  const chaves = forge.pki.rsa.generateKeyPair(512);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01');
  cert.validity.notAfter = new Date('2027-01-01');
  const attrs = [{ name: 'commonName', value: cn }, { name: 'countryName', value: 'BR' }];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: 'commonName', value: 'AC de teste' }]);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, cert, senha, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

test('lê CNPJ, razão social e validade do CN ("EMPRESA:cnpj")', () => {
  const pfx = pfxDeTeste('EMPRESA DE TESTE LTDA:12345678000199', 'segredo123');
  const { info, chavePrivadaPem, certificadoPem } = carregarPfx(pfx, 'segredo123');
  assert.equal(info.cnpj, '12345678000199');
  assert.equal(info.razaoSocial, 'EMPRESA DE TESTE LTDA');
  assert.equal(info.validoDe.getUTCFullYear(), 2026);
  assert.equal(info.validoAte.getUTCFullYear(), 2027);
  assert.match(chavePrivadaPem, /BEGIN( RSA)? PRIVATE KEY/);
  assert.match(certificadoPem, /BEGIN CERTIFICATE/);
});

test('senha errada: mensagem clara, não o erro cru do forge', () => {
  const pfx = pfxDeTeste('OUTRA EMPRESA LTDA:98765432000111', 'certa');
  assert.throws(() => carregarPfx(pfx, 'errada'), /senha.*incorreta/i);
});

test('arquivo que não é PKCS#12', () => {
  assert.throws(() => carregarPfx(Buffer.from('não é um certificado'), 'qualquer'), /não foi possível ler/i);
});
