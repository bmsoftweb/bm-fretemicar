import crypto from 'node:crypto';

// Senhas das contas de e-mail no banco: AES-256-GCM com chave derivada do SESSION_SECRET.
// Trocar o SESSION_SECRET exige informar as senhas de novo.
const chave = () => crypto.createHash('sha256').update(`fretemicar:${process.env.SESSION_SECRET}`).digest();

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}

/** '' quando não abre (cifrada com outro segredo) */
export function decifrar(b64: string): string {
  try {
    const b = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', chave(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}
