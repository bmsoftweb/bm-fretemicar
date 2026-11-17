/**
 * DACTE (Documento Auxiliar do CT-e) em PDF, gerado do XML guardado, com pdfkit.
 * Mesmo jeito de desenhar do DANFE do bm-nfe (`server/nfe/danfe.ts`): quadros com rótulo pequeno e valor em negrito.
 * Quadros do DACTE retrato do Manual do CT-e: comprovante de entrega, emitente, chave com código de barras e QR-Code,
 * identificação, participantes, tomador, carga, componentes da prestação, imposto, documentos originários,
 * observações e modal rodoviário. É para consulta e impressão interna: o documento fiscal é o XML.
 */
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';
import { XMLParser } from 'fast-xml-parser';
import { textoXml } from './cte.js';

const MM = 2.834645669; // 1 mm em pontos
const CINZA = '#444444';
const LINHA = 0.25;
const RAIO = 2;
const ALTURA_MAIUSCULA = 0.72; // altura das maiúsculas da Helvetica em relação ao tamanho da fonte

const LISTAS = new Set(['infNFe', 'infNF', 'infOutros', 'Comp', 'infQ', 'ObsCont', 'ObsFisco']);
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, isArray: (n) => LISTAS.has(n) });

function t(n: any, caminho: string): string {
  let x = n;
  for (const p of caminho.split('/')) x = x?.[p];
  if (x != null && typeof x === 'object') x = x['#text'];
  return x == null ? '' : String(x).trim();
}
const lista = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const moeda = (v: string, casas = 2) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
/** '2026-10-21T06:46:00-03:00' -> '21/10/2026 06:46' (hora como está no XML, sem converter fuso) */
const dataHora = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '');
const docDe = (p: any) => t(p, 'CNPJ') || t(p, 'CPF');
function docFmt(d: string): string {
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
const cepFmt = (c: string) => (c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);
const foneFmt = (f: string) => (f.length >= 10 ? `(${f.slice(0, 2)}) ${f.slice(2, -4)}-${f.slice(-4)}` : f);
const chaveFmt = (c: string) => (c.match(/.{1,4}/g) || []).join(' ');

const MODAL: Record<string, string> = { '01': 'RODOVIÁRIO', '02': 'AÉREO', '03': 'AQUAVIÁRIO', '04': 'FERROVIÁRIO', '05': 'DUTOVIÁRIO', '06': 'MULTIMODAL' };
const TIPO_CTE: Record<string, string> = { '0': 'NORMAL', '1': 'COMPLEMENTO DE VALORES', '2': 'ANULAÇÃO', '3': 'SUBSTITUTO' };
const TIPO_SERVICO: Record<string, string> = { '0': 'NORMAL', '1': 'SUBCONTRATAÇÃO', '2': 'REDESPACHO', '3': 'REDESPACHO INTERMEDIÁRIO', '4': 'SERVIÇO VINCULADO A MULTIMODAL' };
const UNIDADE: Record<string, string> = { '00': 'M3', '01': 'KG', '02': 'TON', '03': 'UNIDADE', '04': 'LITROS', '05': 'MMBTU' };
/** Descrição da situação tributária do ICMS (só exibição, pelo grupo do XML) */
const SITUACAO_ICMS: Record<string, string> = {
  '00': 'TRIBUTAÇÃO NORMAL DO ICMS', '20': 'TRIBUTAÇÃO COM BC REDUZIDA DO ICMS', '40': 'ICMS ISENÇÃO', '41': 'ICMS NÃO TRIBUTADA',
  '51': 'ICMS DIFERIDO', '60': 'ICMS COBRADO POR SUBSTITUIÇÃO TRIBUTÁRIA', '90': 'ICMS OUTROS',
};
/** Participantes que o toma3 pode apontar, com a tag do endereço de cada um */
const PARTICIPANTES = [['rem', 'enderReme', 'REMETENTE'], ['exped', 'enderExped', 'EXPEDIDOR'], ['receb', 'enderReceb', 'RECEBEDOR'], ['dest', 'enderDest', 'DESTINATÁRIO']];

/** PDF do DACTE; erro quando o XML não é CT-e */
export async function gerarDacte(xml: string | Uint8Array): Promise<Buffer> {
  const raiz = parser.parse(typeof xml === 'string' ? xml : textoXml(xml));
  const proc = raiz?.cteProc;
  const cte = proc ? proc.CTe : raiz?.CTe;
  const inf = cte?.infCte;
  if (!inf) throw new Error('O XML não contém um CT-e.');

  const chave = String(inf['@_Id'] ?? '').replace(/\D/g, '');
  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const norm = inf.infCTeNorm ?? {};
  const prot = proc?.protCTe?.infProt;

  // bufferPages: a tarja de homologação volta em cada página no fim
  const pdf = new PDFDocument({ size: 'A4', margin: 5 * MM, bufferPages: true, info: { Title: `DACTE ${t(ide, 'nCT')}`, Author: t(emit, 'xNome') } });
  const pedacos: Buffer[] = [];
  pdf.on('data', (d) => pedacos.push(d));
  const pronto = new Promise<Buffer>((resolve) => pdf.on('end', () => resolve(Buffer.concat(pedacos))));

  const esq = pdf.page.margins.left;
  const larg = pdf.page.width - esq - pdf.page.margins.right;
  const fim = pdf.page.height - pdf.page.margins.bottom;
  let y = pdf.page.margins.top;

  // ---- Desenho ----
  const quadro = (x: number, yy: number, w: number, h: number) => pdf.lineWidth(LINHA).strokeColor(CINZA).roundedRect(x, yy, w, h, RAIO).stroke();
  /** Uma linha de texto; o que passa da largura vira "…" */
  const linha = (texto: string, x: number, yy: number, w: number, tamanho: number, o: { negrito?: boolean; cor?: string; alinhar?: 'left' | 'center' | 'right' } = {}) =>
    pdf.fontSize(tamanho).font(o.negrito ? 'Helvetica-Bold' : 'Helvetica').fillColor(o.cor ?? '#000')
      .text(texto, x, yy, { width: w, height: tamanho * 1.3, ellipsis: true, align: o.alinhar ?? 'left' });
  const rotulo = (texto: string, x: number, yy: number, w: number) => linha(texto.toUpperCase(), x + 2, yy + 1.5, w - 4, 4.6, { cor: CINZA });
  const campo = (x: number, yy: number, w: number, h: number, nome: string, valor: string, alinhar: 'left' | 'center' | 'right' = 'left', tamanho = 7) => {
    quadro(x, yy, w, h);
    rotulo(nome, x, yy, w);
    const topo = yy + 1.5 + 4.6 * ALTURA_MAIUSCULA;
    linha(valor, x + 2, topo + (yy + h - topo - tamanho * ALTURA_MAIUSCULA) / 2, w - 4, tamanho, { negrito: true, alinhar });
  };
  /** Campos lado a lado numa linha: [fração da largura, rótulo, valor, alinhamento] */
  const linhaCampos = (h: number, campos: [number, string, string, ('left' | 'center' | 'right')?][]) => {
    espaco(h);
    let x = esq;
    for (const [f, nome, valor, alinhar] of campos) {
      campo(x, y, larg * f, h, nome, valor, alinhar);
      x += larg * f;
    }
    y += h;
  };
  const secao = (texto: string, h: number) => {
    espaco(h + 4 * MM);
    y += 1 * MM;
    linha(texto, esq, y, larg, 6, { negrito: true });
    y += 3 * MM;
  };
  /** Página nova quando o próximo bloco não cabe */
  function espaco(h: number) {
    if (y + h <= fim) return;
    pdf.addPage();
    y = pdf.page.margins.top;
  }
  const pessoa = (x: number, yy: number, w: number, h: number, titulo: string, p: any, tagEnd: string) => {
    quadro(x, yy, w, h);
    rotulo(titulo, x, yy, w);
    if (!p) return;
    const e = p[tagEnd] ?? {};
    const lh = 3.3 * MM;
    let l = yy + 4 * MM;
    linha(t(p, 'xNome'), x + 2, l, w - 4, 7, { negrito: true });
    const endereco = [`${t(e, 'xLgr')}, ${t(e, 'nro')}`, t(e, 'xCpl'), t(e, 'xBairro')].filter(Boolean).join(' - ');
    const municipio = `${t(e, 'xMun')} - ${t(e, 'UF')}${t(e, 'CEP') ? `   CEP ${cepFmt(t(e, 'CEP'))}` : ''}`;
    const documento = `CNPJ/CPF ${docFmt(docDe(p))}${t(p, 'IE') ? `   IE ${t(p, 'IE')}` : ''}${t(p, 'fone') ? `   FONE ${foneFmt(t(p, 'fone'))}` : ''}`;
    // Quadro na largura toda (tomador): endereço e município na mesma linha
    for (const s of w > larg * 0.75 ? [`${endereco}  -  ${municipio}`, documento] : [endereco, municipio, documento]) {
      l += lh;
      linha(s, x + 2, l, w - 4, 6);
    }
  };

  // ---- Comprovante de entrega ----
  const hComp = 13 * MM;
  quadro(esq, y, larg * 0.78, hComp);
  linha('DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO, PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE',
    esq + 2, y + 1.5, larg * 0.78 - 4, 5);
  const xAss = [0, 0.3, 0.55].map((f) => esq + 2 + larg * 0.78 * f);
  ['NOME / RG', 'ASSINATURA / CARIMBO', 'CHEGADA DATA/HORA  /  SAÍDA DATA/HORA'].forEach((s, i) => linha(s, xAss[i], y + hComp - 4 * MM, larg * 0.78 * 0.3, 4.6, { cor: CINZA }));
  pdf.moveTo(esq + 2, y + hComp - 5 * MM).lineTo(esq + larg * 0.78 - 2, y + hComp - 5 * MM).lineWidth(LINHA).strokeColor(CINZA).stroke();
  quadro(esq + larg * 0.78, y, larg * 0.22, hComp);
  linha('CT-e', esq + larg * 0.78, y + 2, larg * 0.22, 8, { negrito: true, alinhar: 'center' });
  linha(`Nº ${t(ide, 'nCT').padStart(9, '0')}`, esq + larg * 0.78, y + 5 * MM, larg * 0.22, 7, { negrito: true, alinhar: 'center' });
  linha(`SÉRIE ${t(ide, 'serie').padStart(3, '0')}`, esq + larg * 0.78, y + 8.5 * MM, larg * 0.22, 7, { negrito: true, alinhar: 'center' });
  y += hComp + 2 * MM;

  // ---- Cabeçalho: emitente | DACTE | código de barras, chave e protocolo | QR-Code ----
  const hCab = 30 * MM;
  const wEmit = larg * 0.36;
  const wTit = larg * 0.17;
  const wQr = hCab;
  const wBar = larg - wEmit - wTit - wQr;
  quadro(esq, y, wEmit, hCab);
  pdf.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(t(emit, 'xNome'), esq + 3, y + 3, { width: wEmit - 6, height: 22, ellipsis: true });
  const ee = emit.enderEmit ?? {};
  pdf.fontSize(6).font('Helvetica').text(
    [
      [`${t(ee, 'xLgr')}, ${t(ee, 'nro')}`, t(ee, 'xCpl')].filter(Boolean).join(' - '),
      `${t(ee, 'xBairro')} - ${t(ee, 'xMun')}/${t(ee, 'UF')}   CEP ${cepFmt(t(ee, 'CEP'))}`,
      `CNPJ ${docFmt(docDe(emit))}   IE ${t(emit, 'IE')}`,
      t(ee, 'fone') ? `FONE ${foneFmt(t(ee, 'fone'))}` : '',
    ].filter(Boolean).join('\n'),
    esq + 3, pdf.y + 3, { width: wEmit - 6, height: hCab - (pdf.y - y) - 6, ellipsis: true },
  );

  const xTit = esq + wEmit;
  quadro(xTit, y, wTit, hCab);
  linha('DACTE', xTit, y + 3 * MM, wTit, 12, { negrito: true, alinhar: 'center' });
  pdf.fontSize(5.5).font('Helvetica').text('Documento Auxiliar do Conhecimento de Transporte Eletrônico', xTit + 3, y + 9 * MM, { width: wTit - 6, align: 'center' });
  linha('MODAL', xTit, y + 18 * MM, wTit, 5, { cor: CINZA, alinhar: 'center' });
  linha(MODAL[t(ide, 'modal')] ?? t(ide, 'modal'), xTit, y + 21 * MM, wTit, 8, { negrito: true, alinhar: 'center' });

  const xBar = xTit + wTit;
  quadro(xBar, y, wBar, hCab * 0.42);
  try {
    const barras = await bwipjs.toBuffer({ bcid: 'code128', text: chave, scale: 3, height: 10, includetext: false });
    pdf.image(barras, xBar + 4, y + 3, { width: wBar - 8, height: hCab * 0.42 - 6 });
  } catch {
    linha(chave, xBar + 4, y + 10, wBar - 8, 6);
  }
  campo(xBar, y + hCab * 0.42, wBar, hCab * 0.29, 'Chave de acesso', chaveFmt(chave), 'center', 6);
  campo(xBar, y + hCab * 0.71, wBar, hCab * 0.29, 'Protocolo de autorização de uso',
    t(prot, 'nProt') ? `${t(prot, 'nProt')} - ${dataHora(t(prot, 'dhRecbto'))}` : 'SEM PROTOCOLO DE AUTORIZAÇÃO', 'center', 6);

  quadro(xBar + wBar, y, wQr, hCab);
  const qr = t(cte?.infCTeSupl, 'qrCodCTe');
  if (qr) {
    try {
      pdf.image(await bwipjs.toBuffer({ bcid: 'qrcode', text: qr, scale: 4, includetext: false }), xBar + wBar + 2 * MM, y + 2 * MM, { fit: [wQr - 4 * MM, hCab - 4 * MM] });
    } catch {
      // sem QR-Code: o quadro fica vazio
    }
  }
  y += hCab;

  // ---- Identificação ----
  let toma: any = null;
  let tagToma = 'enderToma';
  if (ide.toma3) {
    const quem = PARTICIPANTES[Number(t(ide, 'toma3/toma'))];
    if (quem) [toma, tagToma] = [inf[quem[0]], quem[1]];
  } else toma = ide.toma4;
  const nomeToma = ide.toma3 ? PARTICIPANTES[Number(t(ide, 'toma3/toma'))]?.[2] ?? '' : 'OUTROS';

  linhaCampos(7 * MM, [
    [0.07, 'Modelo', t(ide, 'mod'), 'center'],
    [0.07, 'Série', t(ide, 'serie'), 'center'],
    [0.12, 'Número', t(ide, 'nCT'), 'center'],
    [0.18, 'Data e hora de emissão', dataHora(t(ide, 'dhEmi')), 'center'],
    [0.17, 'Tipo do CT-e', TIPO_CTE[t(ide, 'tpCTe')] ?? t(ide, 'tpCTe')],
    [0.19, 'Tipo do serviço', TIPO_SERVICO[t(ide, 'tpServ')] ?? t(ide, 'tpServ')],
    [0.2, 'Tomador do serviço', nomeToma],
  ]);
  linhaCampos(7 * MM, [
    [0.5, 'CFOP - Natureza da operação', `${t(ide, 'CFOP')} - ${t(ide, 'natOp')}`],
    [0.25, 'Início da prestação', `${t(ide, 'xMunIni')} - ${t(ide, 'UFIni')}`],
    [0.25, 'Término da prestação', `${t(ide, 'xMunFim')} - ${t(ide, 'UFFim')}`],
  ]);

  // ---- Participantes ----
  const hPessoa = 18 * MM;
  espaco(hPessoa * 2 + 15 * MM);
  y += 1 * MM;
  pessoa(esq, y, larg / 2, hPessoa, 'Remetente', inf.rem, 'enderReme');
  pessoa(esq + larg / 2, y, larg / 2, hPessoa, 'Destinatário', inf.dest, 'enderDest');
  y += hPessoa;
  pessoa(esq, y, larg / 2, hPessoa, 'Expedidor', inf.exped, 'enderExped');
  pessoa(esq + larg / 2, y, larg / 2, hPessoa, 'Recebedor', inf.receb, 'enderReceb');
  y += hPessoa;
  pessoa(esq, y, larg, 14 * MM, `Tomador do serviço (${nomeToma.toLowerCase()})`, toma, tagToma);
  y += 14 * MM;

  // ---- Carga ----
  const carga = norm.infCarga ?? {};
  if (norm.infCarga) {
    linhaCampos(7 * MM, [
      [0.5, 'Produto predominante', t(carga, 'proPred')],
      [0.25, 'Outras características da carga', t(carga, 'xOutCat')],
      [0.25, 'Valor total da carga', moeda(t(carga, 'vCarga')), 'right'],
    ]);
    const qs = lista(carga.infQ).slice(0, 5);
    if (qs.length) linhaCampos(7 * MM, qs.map((q) => [1 / qs.length, `${t(q, 'tpMed')} (${UNIDADE[t(q, 'cUnid')] ?? t(q, 'cUnid')})`, moeda(t(q, 'qCarga'), 4), 'right'] as [number, string, string, 'right']));
  }

  // ---- Componentes do valor da prestação ----
  const comps = lista(inf.vPrest?.Comp);
  const colunas = 3;
  const hLinhaComp = 3.6 * MM;
  const hComps = 5 * MM + Math.max(2, Math.ceil(comps.length / colunas)) * hLinhaComp;
  secao('COMPONENTES DO VALOR DA PRESTAÇÃO DO SERVIÇO', hComps);
  const wComps = larg * 0.75;
  const wCol = wComps / colunas;
  quadro(esq, y, wComps, hComps);
  for (let c = 0; c < colunas; c++) {
    const x = esq + c * wCol;
    linha('NOME', x + 2, y + 1.5, wCol * 0.6, 4.6, { cor: CINZA });
    linha('VALOR', x + wCol * 0.6, y + 1.5, wCol * 0.4 - 4, 4.6, { cor: CINZA, alinhar: 'right' });
  }
  comps.forEach((cp, i) => {
    const x = esq + (i % colunas) * wCol;
    const l = y + 5 * MM + Math.floor(i / colunas) * hLinhaComp;
    linha(t(cp, 'xNome'), x + 2, l, wCol * 0.62, 6.5);
    linha(moeda(t(cp, 'vComp')), x + wCol * 0.6, l, wCol * 0.4 - 4, 6.5, { negrito: true, alinhar: 'right' });
  });
  campo(esq + wComps, y, larg - wComps, hComps / 2, 'Valor total do serviço', moeda(t(inf, 'vPrest/vTPrest')), 'right', 8);
  campo(esq + wComps, y + hComps / 2, larg - wComps, hComps / 2, 'Valor a receber', moeda(t(inf, 'vPrest/vRec')), 'right', 8);
  y += hComps;

  // ---- Imposto ----
  const icms = inf.imp?.ICMS ?? {};
  const grupo = Object.keys(icms).find((k) => !k.startsWith('@_') && k !== '#text') ?? '';
  const g = icms[grupo] ?? {};
  const suf = grupo === 'ICMSOutraUF' ? 'OutraUF' : '';
  const situacao =
    grupo === 'ICMSSN' ? 'SIMPLES NACIONAL'
      : grupo === 'ICMSOutraUF' ? '90 - ICMS DEVIDO À UF DE ORIGEM DA PRESTAÇÃO'
        : t(g, 'CST') ? `${t(g, 'CST')} - ${SITUACAO_ICMS[t(g, 'CST')] ?? ''}` : '';
  secao('INFORMAÇÕES RELATIVAS AO IMPOSTO', 7 * MM);
  linhaCampos(7 * MM, [
    [0.4, 'Situação tributária', situacao],
    [0.15, 'Base de cálculo', moeda(t(g, 'vBC' + suf) || t(g, 'vBCSTRet')), 'right'],
    [0.15, 'Alíquota do ICMS', moeda(t(g, 'pICMS' + suf) || t(g, 'pICMSSTRet')), 'right'],
    [0.15, 'Valor do ICMS', moeda(t(g, 'vICMS' + suf) || t(g, 'vICMSSTRet')), 'right'],
    [0.15, '% Redução da BC', moeda(t(g, 'pRedBC' + suf)), 'right'],
  ]);
  const ibs = inf.imp?.IBSCBS;
  if (ibs) {
    linhaCampos(7 * MM, [
      [0.25, 'CST IBS/CBS - Classificação', `${t(ibs, 'CST')} - ${t(ibs, 'cClassTrib')}`],
      [0.1875, 'Base de cálculo IBS/CBS', moeda(t(ibs, 'gIBSCBS/vBC')), 'right'],
      [0.1875, 'Valor do IBS', moeda(t(ibs, 'gIBSCBS/vIBS')), 'right'],
      [0.1875, 'Valor da CBS', moeda(t(ibs, 'gIBSCBS/gCBS/vCBS')), 'right'],
      [0.1875, 'Valor total do DF-e', moeda(t(inf, 'imp/vTotDFe')), 'right'],
    ]);
  }

  // ---- Documentos originários ----
  const docs = [
    ...lista(norm.infDoc?.infNFe).map((n) => `NF-e   ${chaveFmt(t(n, 'chave'))}`),
    ...lista(norm.infDoc?.infNF).map((n) => `NF   SÉRIE ${t(n, 'serie')}   Nº ${t(n, 'nDoc')}   ${moeda(t(n, 'vNF'))}`),
    ...lista(norm.infDoc?.infOutros).map((n) => `${t(n, 'descOutros') || 'OUTROS'}   Nº ${t(n, 'nDoc')}`),
  ];
  if (docs.length) {
    const hLinhaDoc = 3.6 * MM;
    secao('DOCUMENTOS ORIGINÁRIOS', 2 * MM + hLinhaDoc);
    // Em blocos que cabem na página: muitos documentos continuam na seguinte
    for (let i = 0; i < docs.length; ) {
      const cabem = Math.max(2, Math.floor((fim - y - 2 * MM) / hLinhaDoc) * 2);
      const bloco = docs.slice(i, i + cabem);
      const h = 2 * MM + Math.ceil(bloco.length / 2) * hLinhaDoc;
      espaco(h);
      quadro(esq, y, larg, h);
      bloco.forEach((d, j) => linha(d, esq + 2 + (j % 2) * (larg / 2), y + 1.5 * MM + Math.floor(j / 2) * hLinhaDoc, larg / 2 - 4, 6.5));
      y += h;
      i += bloco.length;
    }
  }

  // ---- Observações ----
  const obs = [
    t(inf, 'compl/xObs'),
    ...lista(inf.compl?.ObsCont).map((o) => `${o['@_xCampo'] ?? ''}: ${t(o, 'xTexto')}`),
    ...lista(inf.compl?.ObsFisco).map((o) => `${o['@_xCampo'] ?? ''}: ${t(o, 'xTexto')}`),
  ].filter(Boolean).join('\n');
  if (obs) {
    pdf.fontSize(6).font('Helvetica');
    const hObs = Math.max(10 * MM, pdf.heightOfString(obs, { width: larg - 4 }) + 3 * MM);
    secao('OBSERVAÇÕES', Math.min(hObs, fim - pdf.page.margins.top - 5 * MM));
    const h = Math.min(hObs, fim - y);
    quadro(esq, y, larg, h);
    pdf.fontSize(6).font('Helvetica').fillColor('#000').text(obs, esq + 2, y + 1.5 * MM, { width: larg - 4, height: h - 2 * MM, ellipsis: true });
    y += h;
  }

  // ---- Modal rodoviário ----
  const rntrc = t(norm, 'infModal/rodo/RNTRC');
  if (rntrc) {
    secao('INFORMAÇÕES ESPECÍFICAS DO MODAL RODOVIÁRIO', 7 * MM);
    linhaCampos(7 * MM, [
      [0.25, 'RNTRC da empresa', rntrc, 'center'],
      [0.75, '', 'ESTE CONHECIMENTO DE TRANSPORTE ATENDE À LEGISLAÇÃO DE TRANSPORTE RODOVIÁRIO EM VIGOR', 'center'],
    ]);
  }

  // Homologação: tarja em todas as páginas
  if (t(ide, 'tpAmb') === '2') {
    const { start, count } = pdf.bufferedPageRange();
    for (let p = start; p < start + count; p++) {
      pdf.switchToPage(p);
      pdf.save().rotate(-35, { origin: [pdf.page.width / 2, pdf.page.height / 2] }).fillOpacity(0.18)
        .fontSize(46).font('Helvetica-Bold').fillColor('#c00000')
        .text('SEM VALOR FISCAL', 0, pdf.page.height / 2 - 23, { width: pdf.page.width, align: 'center', lineBreak: false })
        .restore();
    }
  }

  pdf.end();
  return pronto;
}
