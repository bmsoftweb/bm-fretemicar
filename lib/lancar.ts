import { apiExec, apiRows, apiValue, sqlData } from './bmapi.js';
import { cfopEntrada, type CTe, type PessoaXml } from './cte.js';
import { agoraBR, hojeBR, somarDias } from './hora.js';

// Lançamento do CT-e no BMsoft pela BMapi, no padrão das entradas de CT-e do BMsoft (EntradasM CFOP 1.353/2.353).
// Mesma regra do app Delphi (uLancar.pas).

export interface ConfigBMsoft {
  empresaId: number; // Empresas.ID no BMsoft
  usuarioId: number;
  bancoId: number; // banco da conta a pagar
}

/** L lançado, D já lançado, I ignorado (tomador não é a empresa), P falta cadastrar a transportadora, E erro */
export type Situacao = 'L' | 'D' | 'I' | 'P' | 'E';
export interface Resultado {
  situacao: Situacao;
  mensagem: string;
  entradaId: number;
}

const DIAS_VENCIMENTO = 30;
const r = (situacao: Situacao, mensagem = '', entradaId = 0): Resultado => ({ situacao, mensagem, entradaId });

/** Texto com os mesmos bytes do XML: o memo do DBISAM é ANSI e o BMsoft grava o XML (UTF-8) assim */
const xmlComoAnsi = (xml: Uint8Array) => new TextDecoder('windows-1252').decode(xml);

async function cadastrar(p: PessoaXml, cfg: ConfigBMsoft): Promise<number> {
  const fantasia = p.fantasia || p.nome;
  await apiExec(
    'INSERT INTO Pessoas (JuridicaFisica, EnteGov, Nome, Fantasia, Endereco, Numero, Complemento, Bairro, ' +
      'CEP, Cod_Cidade, Cidade, UF, Cod_Pais, Fone1, CPFCNPJ, IE, Tipo_Contribuinte, PracaPgtoEnd, PracaPgtoNum, ' +
      'PracaPgtoCom, PracaPgtoBai, PracaPgtoCid, PracaPgtoUF, PracaPgtoCEP, Crediario, Liberado, DescontoMax_Liberado, ' +
      'desconto_cliente_os, Ativo, Data_Cadastro, ID_Emp_Cad, ID_User_Cad, ST_Calc, Simples, Tipo_Imposto, IPI_Calc, ' +
      'Classificacao, Cons_Generico, Cons_Final, NFSe_Especial, Juros_Especial, INSS_Calc, Perfil_Cli, Perfil_For, ' +
      "Perfil_Tra) VALUES (:JF, '0', :Nome, :Fantasia, :Lgr, :Nro, :Cpl, :Bairro, :CEP, :CMun, :CMun, :UF, '1058', " +
      ":Fone, :CNPJ, :IE, 'N', :Lgr, :Nro, :Cpl, :Bairro, :CMun, :UF, :CEP, 'S', 'N', 'N', 'N', 'S', " +
      `${sqlData(hojeBR())}, :Emp, :Usu, 'N', 'N', 'A', 'N', 'T', 'N', 'S', 'N', -1, 'N', TRUE, TRUE, TRUE)`,
    {
      JF: p.cnpj.length === 11 ? 'F' : 'J', Nome: p.nome.slice(0, 60), Fantasia: fantasia.slice(0, 40),
      Lgr: p.lgr.slice(0, 60), Nro: p.nro.slice(0, 5), Cpl: p.cpl.slice(0, 30), Bairro: p.bairro.slice(0, 25),
      CEP: p.cep, CMun: p.cmun, UF: p.uf, Fone: p.fone.slice(0, 15), CNPJ: p.cnpj, IE: p.ie,
      Emp: cfg.empresaId, Usu: cfg.usuarioId,
    },
  );
  const id = Number(await apiValue('SELECT ID FROM Pessoas WHERE CPFCNPJ = :C ORDER BY ID DESC', { C: p.cnpj }));
  if (!id) throw new Error('Transportadora gravada mas não encontrada em Pessoas');
  return id;
}

async function desfazer(id: number) {
  try {
    await apiExec('DELETE FROM DpPPrincipal WHERE ID_NF = :ID', { ID: id });
    await apiExec('DELETE FROM EntradasReferenciadas WHERE ID_NF = :ID', { ID: id });
    await apiExec('DELETE FROM EntradasCFOP WHERE ID_NF = :ID', { ID: id });
    await apiExec('DELETE FROM EntradasM WHERE ID = :ID', { ID: id });
  } catch {
    // o erro original é o que importa; o que sobrar aparece como "já lançado" na próxima vez
  }
}

/**
 * Lança o CT-e. Transportadora fora do cadastro: sem `transportadora` (dados confirmados pelo usuário) devolve 'P';
 * com ela, cadastra em Pessoas e lança.
 */
export async function lancar(c: CTe, xml: Uint8Array, cfg: ConfigBMsoft, transportadora?: PessoaXml): Promise<Resultado> {
  if (c.tpAmb !== '1') return r('E', 'CT-e de homologação');
  if (c.cstat !== '100') return r('E', `CT-e sem autorização de uso (cStat ${c.cstat})`);

  let id = Number(await apiValue('SELECT ID FROM EntradasM WHERE Chave_NFe = :C', { C: c.chave }));
  if (id) return r('D', 'Já lançado', id);

  const emp = (await apiRows('SELECT UF, CGCMF FROM Empresas WHERE ID = :ID', { ID: cfg.empresaId }))[0];
  if (!emp) return r('E', `Empresa ${cfg.empresaId} não encontrada no BMsoft`);
  if (c.tomaCnpj !== String(emp.CGCMF ?? '')) return r('I', `Tomador ${c.tomaCnpj} não é a empresa`);

  let idFor = Number(await apiValue('SELECT ID FROM Pessoas WHERE CPFCNPJ = :C ORDER BY ID', { C: c.emit.cnpj }));
  if (!idFor) {
    if (!transportadora) return r('P', `Transportadora ${c.emit.cnpj} não cadastrada: confirme os dados para lançar`);
    idFor = await cadastrar({ ...transportadora, cnpj: c.emit.cnpj }, cfg);
  }

  // Cabeçalho, no padrão das entradas de CT-e importadas pelo BMsoft (Tipo 'X', Emitente 'T' terceiros)
  const hoje = hojeBR();
  const cfop = cfopEntrada(c.ufIni, String(emp.UF ?? ''));
  await apiExec(
    'INSERT INTO EntradasM (ID_Empresa, Tipo, Modelo, Serie, Numero, Data_Emissao, Data_Entrada, Natureza, ' +
      'ID_Fornec, Cod_Sit, Tipo_CTe, CFOP, EntradaSaida, Emitente, ICMS_Base, ICMS_Valor, Total_Servicos, Total_Nota, ' +
      'Transp_Frete, Cancelado, Chave_NFe, TotalProdTodasNFeRef, ID_Usuario, ID_Usuario_Criou, Cod_Mun_Origem, ' +
      `Cod_Mun_Destino) VALUES (:Emp, 'X', :Modelo, :Serie, :Numero, ${sqlData(c.dhEmi)}, ${sqlData(hoje)}, ` +
      ":Natureza, :For, '00', :TpCTe, :CFOP, 'E', 'T', :VBC, :VICMS, :Total, :Total, '9', 'N', :Chave, " +
      ':VCarga, :Usu, :Usu, :Origem, :Destino)',
    {
      Emp: cfg.empresaId, Modelo: c.modelo, Serie: c.serie, Numero: c.numero, Natureza: c.natOp.slice(0, 50),
      For: idFor, TpCTe: c.tpCTe, CFOP: cfop, VBC: c.vBC, VICMS: c.vICMS, Total: c.vTPrest, Chave: c.chave,
      VCarga: c.vCarga, Usu: cfg.usuarioId, Origem: c.cMunIni, Destino: c.cMunFim,
    },
  );
  id = Number(await apiValue('SELECT ID FROM EntradasM WHERE Chave_NFe = :C', { C: c.chave }));
  if (!id) return r('E', 'Entrada gravada mas não encontrada pela chave');

  try {
    // CST com 3 dígitos como no BMsoft: 00 -> 000, 90 -> 090
    await apiExec(
      'INSERT INTO EntradasCFOP (ID_NF, CST, CFOP, ICMS_Aliq, Valor_Contabil, ICMS_Base, ICMS_Valor) ' +
        'VALUES (:ID, :CST, :CFOP, :Aliq, :Total, :VBC, :VICMS)',
      { ID: id, CST: '0' + c.cst, CFOP: cfop, Aliq: c.pICMS, Total: c.vTPrest, VBC: c.vBC, VICMS: c.vICMS },
    );

    // NF-e transportadas: série (3) e número (9) saem da chave
    for (const nfe of c.nfes)
      await apiExec(
        'INSERT INTO EntradasReferenciadas (ID_NF, ID_Fornec, Serie, Subserie, Numero, ChaveNFe) VALUES (:ID, 0, :Serie, 0, :Numero, :Chave)',
        { ID: id, Serie: nfe.slice(22, 25), Numero: parseInt(nfe.slice(25, 34)) || 0, Chave: nfe },
      );

    await apiExec(
      'INSERT INTO DpPPrincipal (ID_Empresa, ID_Fornecedor, ID_NF, ID_Banco, Seq, Seq_Tot, Doc_Serie, Doc_Num, ' +
        'Valor, Data_Geracao, Vencimento, Status, boleto_recebido, Link_Tp, Link_ID) VALUES (:Emp, :For, :ID, :Banco, ' +
        `1, 1, :Serie, :Num, :Valor, ${sqlData(hoje)}, ${sqlData(somarDias(hoje, DIAS_VENCIMENTO))}, 'A', 'N', 'CO', :ID)`,
      { Emp: cfg.empresaId, For: idFor, ID: id, Banco: cfg.bancoId, Serie: c.serie, Num: String(c.numero).padStart(9, '0'), Valor: c.vTPrest },
    );

    // XML_Lista: a tela de importação do BMsoft passa a ver o CT-e como já lançado
    if (await apiValue('SELECT ID FROM XML_Lista WHERE Chave = :C', { C: c.chave }))
      await apiExec('UPDATE XML_Lista SET OK = TRUE WHERE Chave = :C', { C: c.chave });
    else
      await apiExec(
        'INSERT INTO XML_Lista (IDEmpresa, DH, OK, Chave, Tipo, Ambiente, Serie, Numero, DataEmissao, ' +
          'Natureza, ValorTotal, Emit_CNPJ, Emit_Nome, Emit_Fantasia, Emit_Cidade, Emit_UF, XML, XML_Dados) VALUES ' +
          `(:Emp, ${sqlData(agoraBR())}, TRUE, :Chave, 'T', 'P', :Serie, :Numero, ${sqlData(c.dhEmi)}, ` +
          ':Natureza, :Total, :CNPJ, :Nome, :Fantasia, :Cidade, :UF, TRUE, :Xml)',
        {
          Emp: cfg.empresaId, Chave: c.chave, Serie: c.serie, Numero: c.numero, Natureza: c.natOp.slice(0, 80),
          Total: c.vTPrest, CNPJ: c.emit.cnpj, Nome: c.emit.nome.slice(0, 80),
          Fantasia: (c.emit.fantasia || c.emit.nome).slice(0, 50), Cidade: c.emit.xmun.slice(0, 40), UF: c.emit.uf,
          Xml: xmlComoAnsi(xml),
        },
      );
  } catch (e: any) {
    await desfazer(id);
    return r('E', e.message);
  }
  return r('L', '', id);
}
