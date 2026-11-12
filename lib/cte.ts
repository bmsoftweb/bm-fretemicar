import { XMLParser } from 'fast-xml-parser';

// Leitura do XML de CT-e (cteProc ou CTe), pelo conteúdo e não pelo nome do arquivo.
export interface PessoaXml {
  cnpj: string; ie: string; nome: string; fantasia: string; lgr: string; nro: string; cpl: string;
  bairro: string; cmun: string; xmun: string; cep: string; uf: string; fone: string;
}

export interface CTe {
  chave: string; cstat: string; tpAmb: string; modelo: string; serie: string; numero: number;
  dhEmi: string; // aaaa-mm-dd
  natOp: string; tpCTe: string; ufIni: string; cMunIni: string; cMunFim: string;
  emit: PessoaXml;
  tomaCnpj: string; // quem paga o frete
  cst: string; vTPrest: number; vBC: number; pICMS: number; vICMS: number; vCarga: number;
  nfes: string[]; // chaves das NF-e transportadas
}

const NS_CTE = 'http://www.portalfiscal.inf.br/cte';
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, isArray: (n) => n === 'infNFe' });

function txt(n: any, caminho: string): string {
  let x = n;
  for (const p of caminho.split('/')) x = x?.[p];
  if (x != null && typeof x === 'object') x = x['#text'];
  return x == null ? '' : String(x).trim();
}
const num = (n: any, caminho: string) => Number(txt(n, caminho)) || 0;
const doc = (n: any) => txt(n, 'CNPJ') || txt(n, 'CPF');

/** Texto do XML pela codificação declarada (quase sempre UTF-8) */
export function textoXml(bytes: Uint8Array): string {
  const cab = Buffer.from(bytes.subarray(0, 100)).toString('latin1');
  const latin = /encoding=["']\s*(iso-8859-1|windows-1252|latin1)/i.test(cab);
  return new TextDecoder(latin ? 'windows-1252' : 'utf-8').decode(bytes);
}

/** null quando não é CT-e (NF-e, evento, XML inválido...) */
export function parseCTe(bytes: Uint8Array): CTe | null {
  const texto = textoXml(bytes);
  if (!texto.includes(NS_CTE)) return null;
  let raiz: any;
  try {
    raiz = parser.parse(texto);
  } catch {
    return null;
  }
  const proc = raiz?.cteProc;
  const inf = (proc ? proc.CTe : raiz?.CTe)?.infCte; // procEventoCTe, retorno de consulta... ficam de fora
  if (!inf) return null;
  const chave = String(inf['@_Id'] ?? '').replace(/^CTe/, '');
  if (chave.length !== 44) return null;

  const ide = inf.ide ?? {};
  // Tomador: toma3 aponta um dos participantes; toma4 traz o próprio documento
  let tomaCnpj = '';
  if (ide.toma3) {
    const quem = ['rem', 'exped', 'receb', 'dest'][Number(txt(ide, 'toma3/toma'))];
    tomaCnpj = quem ? doc(inf[quem]) : '';
  } else tomaCnpj = doc(ide.toma4);

  const e = inf.emit ?? {};
  const end = e.enderEmit ?? {};
  // imp/ICMS tem um só filho: ICMS00, ICMS20, ICMS45, ICMS60, ICMS90, ICMSOutraUF ou ICMSSN
  const icms = inf.imp?.ICMS ?? {};
  const grupo = Object.keys(icms).find((k) => !k.startsWith('@_') && k !== '#text');
  const g = grupo ? icms[grupo] : {};
  const sufixo = grupo === 'ICMSOutraUF' ? 'OutraUF' : '';

  return {
    chave,
    cstat: txt(proc, 'protCTe/infProt/cStat'),
    tpAmb: txt(ide, 'tpAmb'),
    modelo: txt(ide, 'mod'),
    serie: txt(ide, 'serie'),
    numero: parseInt(txt(ide, 'nCT')) || 0,
    dhEmi: txt(ide, 'dhEmi').slice(0, 10),
    natOp: txt(ide, 'natOp'),
    tpCTe: txt(ide, 'tpCTe'),
    ufIni: txt(ide, 'UFIni'),
    cMunIni: txt(ide, 'cMunIni'),
    cMunFim: txt(ide, 'cMunFim'),
    emit: {
      cnpj: doc(e), ie: txt(e, 'IE'), nome: txt(e, 'xNome'), fantasia: txt(e, 'xFant'),
      lgr: txt(end, 'xLgr'), nro: txt(end, 'nro'), cpl: txt(end, 'xCpl'), bairro: txt(end, 'xBairro'),
      cmun: txt(end, 'cMun'), xmun: txt(end, 'xMun'), cep: txt(end, 'CEP'), uf: txt(end, 'UF'), fone: txt(end, 'fone'),
    },
    tomaCnpj,
    cst: txt(g, 'CST'),
    vTPrest: num(inf, 'vPrest/vTPrest'),
    vBC: num(g, 'vBC' + sufixo),
    pICMS: num(g, 'pICMS' + sufixo),
    vICMS: num(g, 'vICMS' + sufixo),
    vCarga: num(inf, 'infCTeNorm/infCarga/vCarga'),
    nfes: (inf.infCTeNorm?.infDoc?.infNFe ?? []).map((n: any) => txt(n, 'chave')),
  };
}

/** CFOP de entrada pela UF de início da prestação: na UF da empresa 1.353, fora 2.353 */
export const cfopEntrada = (ufIni: string, ufEmpresa: string) => (ufIni.toUpperCase() === ufEmpresa.toUpperCase() ? '1.353' : '2.353');
