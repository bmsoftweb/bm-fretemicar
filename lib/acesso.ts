import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sessionOptions, SessionData } from './session.js';
import { masterPool, dbConfig } from './db.js';
import { cookies } from '../server/next-headers.js';

// Login pela tabela usuarios (login + senha_hash), no mesmo esquema do ERP: bcrypt; aceita legado texto/md5/sha e
// converte; senha vazia = primeiro acesso (a senha digitada passa a valer).
// ponytail: sem filiais/grupos por enquanto; tudo fica na empresa ID_EMPRESA do .env (cte_*.empresa_id)
const EMPRESA = Number(process.env.ID_EMPRESA) || 1;

const ehBcrypt = (hash: string) => /^\$2[aby]\$/.test(hash);

function senhaConfere(digitada: string, gravada: string): boolean {
  if (ehBcrypt(gravada)) {
    try {
      if (bcrypt.compareSync(digitada, gravada)) return true;
    } catch {
      // segue para os demais formatos
    }
  }
  if (digitada === gravada) return true;
  return ['md5', 'sha256', 'sha1'].some((alg) => crypto.createHash(alg).update(digitada).digest('hex') === gravada.toLowerCase());
}

/** Erro de acesso: a mensagem vai para o usuário */
export class ErroAcesso extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Confere usuário e senha (grava a senha no primeiro acesso) e devolve o usuário */
export async function autenticar(login: string, senha: string): Promise<any> {
  if (!login) throw new ErroAcesso(400, 'Informe o seu usuário.');
  const [rows]: any = await masterPool.query('SELECT id, login, nome, senha_hash FROM usuarios WHERE ativo = 1 AND LOWER(TRIM(login)) = ? LIMIT 1', [
    login.toLowerCase(),
  ]);
  if (!rows.length) throw new ErroAcesso(401, `O usuário "${login}" não foi localizado ou está inativo.`);

  const u = rows[0];
  const gravada = String(u.senha_hash ?? '').trim();
  if (!gravada) {
    if (senha.trim().length < 4) throw new ErroAcesso(401, 'Primeiro acesso: defina uma senha com pelo menos 4 caracteres.');
    await masterPool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [bcrypt.hashSync(senha, 10), u.id]);
  } else {
    if (!senhaConfere(senha, gravada)) throw new ErroAcesso(401, 'Usuário/senha inválido(s).');
    // Senha em formato legado passa para bcrypt
    if (!ehBcrypt(gravada)) await masterPool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [bcrypt.hashSync(senha, 10), u.id]).catch(() => {});
  }
  return u;
}

export async function abrirSessao(u: any) {
  await masterPool.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?', [u.id]).catch(() => {});
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = Number(u.id);
  session.userName = String(u.nome || u.login);
  session.empresaId = EMPRESA;
  session.role = 'admin';
  session.isLoggedIn = true;
  session.dbConfig = dbConfig;
  await session.save();
  return session;
}
