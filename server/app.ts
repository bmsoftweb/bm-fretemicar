import express, { Request, Response } from 'express';
import { NextRequest } from './next-server.js';
import { contextoRequisicao } from './next-headers.js';
import * as login from '../app/api/login/route.js';
import * as logout from '../app/api/logout/route.js';
import * as user from '../app/api/user/route.js';
import * as configListas from '../app/api/user/config-listas/route.js';
import * as config from '../app/api/config/route.js';
import * as configTestar from '../app/api/config/testar/route.js';
import * as contas from '../app/api/contas/route.js';
import * as contasTestar from '../app/api/contas/testar/route.js';
import * as conta from '../app/api/contas/[id]/route.js';
import * as recebidos from '../app/api/recebidos/route.js';
import * as recebidoXml from '../app/api/recebidos/[id]/xml/route.js';
import * as recebidoLancar from '../app/api/recebidos/[id]/lancar/route.js';
import * as leitura from '../app/api/leitura/route.js';

/**
 * App Express com as rotas /api. Lista fixa (e não varredura da pasta app/) para a Vercel empacotar tudo:
 * caminhos fixos antes dos que têm :parâmetro.
 */
const ROTAS: [string, Record<string, unknown>][] = [
  ['/api/login', login],
  ['/api/logout', logout],
  ['/api/user', user],
  ['/api/user/config-listas', configListas],
  ['/api/config', config],
  ['/api/config/testar', configTestar],
  ['/api/contas', contas],
  ['/api/contas/testar', contasTestar],
  ['/api/contas/:id', conta],
  ['/api/recebidos', recebidos],
  ['/api/recebidos/:id/xml', recebidoXml],
  ['/api/recebidos/:id/lancar', recebidoLancar],
  ['/api/leitura', leitura],
];
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  for (const [caminho, mod] of ROTAS) {
    for (const m of METODOS) {
      const handler = mod[m];
      if (typeof handler !== 'function') continue;
      app[m.toLowerCase() as 'get'](caminho, async (req: Request, res: Response) => {
        try {
          const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const nreq = new NextRequest(url, { body: req.body, headers: req.headers });
          const out: globalThis.Response = await contextoRequisicao.run({ req, res }, () => handler(nreq, { params: Promise.resolve(req.params) }));
          res.status(out.status);
          out.headers.forEach((v, k) => k !== 'content-length' && res.setHeader(k, v));
          res.send(Buffer.from(await out.arrayBuffer()));
        } catch (err: any) {
          // Erro com status (ErroAcesso): a mensagem é para o usuário; os demais vão para o log também
          if (!err?.status) console.error(`${m} ${req.originalUrl}:`, err);
          if (!res.headersSent) res.status(err?.status || 500).json({ error: err?.message || 'Erro interno do servidor' });
        }
      });
    }
  }
  // API desconhecida: 404 em JSON em vez de cair no index.html
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
  return app;
}
