import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  userName?: string;
  userEmail?: string;
  /** Empresa dos registros cte_* (ID_EMPRESA do .env) */
  empresaId?: number;
  empresaNome?: string;
  perfil?: string;
  role?: string;
  isLoggedIn: boolean;
  /** Só o que as telas precisam saber do banco; a senha nunca vai para a sessão */
  dbConfig?: {
    host: string;
    port: number;
    user: string;
    database: string;
  };
}

// Sem segredo no .env o app não sobe: um valor padrão no código permitiria forjar o cookie de sessão
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET não definido (ou com menos de 32 caracteres) no .env.');
}

export const sessionOptions: SessionOptions = {
  password: secret,
  // Nome trocado quando a sessão ganhou o grupo: as sessões antigas (sem grupoId) pedem login de novo
  cookieName: 'fretemicar_sessao',
  cookieOptions: {
    secure: true, // MUST be true for SameSite=None
    sameSite: 'none', // Required for cross-origin iframe in AI Studio
    httpOnly: true,
    path: '/',
  },
};
