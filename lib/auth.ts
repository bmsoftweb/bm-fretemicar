import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './session.js';
import { cookies } from '../server/next-headers.js';
import { ErroAcesso } from './acesso.js';

/** Sessão logada (401 sem login): as rotas novas lançam e o server/app.ts responde com o status */
export async function sessao(): Promise<SessionData & { empresaId: number }> {
  const s = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!s.isLoggedIn) throw new ErroAcesso(401, 'Não autorizado');
  return Object.assign(s, { empresaId: Number(s.empresaId ?? 1) });
}
