import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createApp } from './server/app.js';

/** Servidor local: as rotas /api e, por cima, o Vite (desenvolvimento) ou a pasta dist (produção). Na Vercel é o api/index.ts. */
async function main() {
  const app = createApp();
  const servidor = http.createServer(app);
  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, hmr: { server: servidor } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const porta = Number(process.env.PORT) || 3000;
  servidor.listen(porta, '0.0.0.0', () => console.log(`freteMicar em http://localhost:${porta}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
