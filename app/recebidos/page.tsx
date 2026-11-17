import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Download, FileText, Loader2, RefreshCw, Send, Undo2 } from 'lucide-react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { ListaCrm } from '@/components/ListaCrm';
import { BotaoAcao } from '@/components/MenuAcoes';
import { AvisoErro } from '@/components/AvisoErro';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Campo, GradeCampos, INPUT_CLASS } from '@/components/FormCrm';
import { formatNumber, pedir } from '@/lib/utils';

interface Recebido {
  id: number;
  recebido: string;
  emissao: string | null;
  conta: string | null;
  remetente: string;
  assunto: string;
  arquivo: string;
  chave: string;
  emitente: string;
  valor: string;
  origem: 'email' | 'sefaz';
  situacao: 'L' | 'E' | 'I' | 'D' | 'P' | 'N';
  entrada_id: number | null;
  mensagem: string;
  /** Última escolha de Lançar/Financeiro da transportadora (null = nunca escolheu: usa o padrão) */
  marca_lancar: number | null;
  marca_financeiro: number | null;
}

type Pessoa = Record<'cnpj' | 'ie' | 'nome' | 'fantasia' | 'lgr' | 'nro' | 'cpl' | 'bairro' | 'cmun' | 'xmun' | 'cep' | 'uf' | 'fone', string>;

const SITUACOES: Record<string, { nome: string; cor: string }> = {
  L: { nome: 'Lançado', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  N: { nome: 'Não lançado', cor: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  P: { nome: 'Transportadora', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  E: { nome: 'Erro', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  I: { nome: 'Ignorado', cor: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  D: { nome: 'Já lançado', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
};

const SELECT = `${INPUT_CLASS} !w-auto`;

// Situações que ainda podem ser lançadas: não lançado, erro, transportadora a cadastrar
const PENDENTES = 'NEP';
interface Marca { lancar: boolean; financeiro: boolean }
const MARCA_PADRAO: Marca = { lancar: true, financeiro: false };

// Campos da transportadora confirmados antes de cadastrar em Pessoas (tamanhos do BMsoft)
const CAMPOS_PESSOA: { k: keyof Pessoa; rotulo: string; max: number; span?: 1 | 2 | 3 | 4; digitos?: boolean }[] = [
  { k: 'nome', rotulo: 'Nome', max: 60, span: 4 },
  { k: 'fantasia', rotulo: 'Fantasia', max: 40, span: 2 },
  { k: 'ie', rotulo: 'IE', max: 20, span: 2 },
  { k: 'lgr', rotulo: 'Endereço', max: 60, span: 3 },
  { k: 'nro', rotulo: 'Número', max: 5 },
  { k: 'cpl', rotulo: 'Complemento', max: 30, span: 2 },
  { k: 'bairro', rotulo: 'Bairro', max: 25, span: 2 },
  { k: 'cep', rotulo: 'CEP', max: 8, digitos: true },
  { k: 'cmun', rotulo: 'Município (IBGE)', max: 7, digitos: true },
  { k: 'uf', rotulo: 'UF', max: 2 },
  { k: 'fone', rotulo: 'Telefone', max: 15, digitos: true },
];

export default function RecebidosPage() {
  const [linhas, setLinhas] = useState<Recebido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [situacao, setSituacao] = useState('');
  const [lendo, setLendo] = useState('');
  const [lancando, setLancando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tom: 'erro' | 'alerta' | 'sucesso' } | null>(null);
  const [transp, setTransp] = useState<{ id: number; p: Pessoa } | null>(null);
  const [bmapiOn, setBmapiOn] = useState<boolean | null>(null); // null = ainda não checou
  const [capturaAuto, setCapturaAuto] = useState<string | null>(null);
  // Por CT-e pendente: Lançar = grava a entrada (EntradasM...), padrão marcado; Financeiro = gera também a conta a
  // pagar (DpPPrincipal), padrão desmarcado. Sem mexer na linha, vale a última escolha da transportadora (gravada
  // no servidor a cada mudança) ou, sem ela, o padrão.
  const [marcas, setMarcas] = useState<Record<number, Marca>>({});
  const daTransportadora = useMemo(
    () => new Map(linhas.filter((l) => l.marca_lancar != null).map((l) => [l.id, { lancar: !!l.marca_lancar, financeiro: !!l.marca_lancar && !!l.marca_financeiro }])),
    [linhas],
  );
  const [filtradas, setFiltradas] = useState<Recebido[]>([]);
  const [confirmarLote, setConfirmarLote] = useState(false);
  const marca = (id: number): Marca => marcas[id] ?? daTransportadora.get(id) ?? MARCA_PADRAO;
  const mudar = (id: number, k: keyof Marca, v: boolean) => {
    const nova = { ...marca(id), [k]: v };
    setMarcas((m) => ({ ...m, [id]: nova }));
    pedir(`/api/recebidos/${id}/marca`, 'POST', nova).catch((e: any) => setAviso({ texto: `Não gravou a escolha da transportadora: ${e.message}`, tom: 'erro' }));
  };
  // Só as que a busca mostra: o padrão vem marcado, então lançar "tudo" pegaria até o que está fora da tela
  const aLancar = filtradas.filter((l) => PENDENTES.includes(l.situacao) && marca(l.id).lancar);

  const checarBmapi = useCallback(() => {
    pedir<{ online: boolean; capturaAuto: string | null }>('/api/config/bmapi-status')
      .then((r) => {
        setBmapiOn(r.online);
        setCapturaAuto(r.capturaAuto);
      })
      .catch(() => setBmapiOn(false));
  }, []);
  useEffect(() => {
    checarBmapi();
    const t = setInterval(checarBmapi, 30_000); // acompanha sem precisar recarregar a tela
    return () => clearInterval(t);
  }, [checarBmapi]);

  const carregar = useCallback(async () => {
    try {
      setLinhas(await pedir(`/api/recebidos?situacao=${situacao}`));
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setCarregando(false);
    }
  }, [situacao]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useRefreshDaTela(carregar);

  // A função na Vercel tem tempo limitado: o servidor para no prazo e devolve `pendente`, e a tela chama de novo
  const buscarCTe = async () => {
    const total = { mensagens: 0, ctes: 0, erros: [] as string[] };
    try {
      for (let rodada = 1; ; rodada++) {
        setLendo(rodada > 1 ? `Lendo (parte ${rodada})…` : 'Lendo…');
        const r = await pedir('/api/leitura', 'POST');
        total.mensagens += r.mensagens;
        total.ctes += r.ctes;
        total.erros.push(...r.erros);
        await carregar();
        if (!r.pendente || rodada >= 20) break;
      }
      const resumo = `${total.mensagens} novidade(s), ${total.ctes} CT-e novo(s)${total.ctes ? ': marque o que lançar e clique em Lançar marcados' : ''}.`;
      setAviso(total.erros.length ? { texto: `${resumo}\n${total.erros.join('\n')}`, tom: 'erro' } : { texto: resumo, tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setLendo('');
      checarBmapi(); // a leitura acabou de usar a BMapi: aproveita para atualizar o indicador
    }
  };

  const lancar = async (id: number, transportadora?: Pessoa) => {
    const r = await pedir(`/api/recebidos/${id}/lancar`, 'POST', { transportadora, financeiro: marca(id).financeiro });
    await carregar();
    if (r.situacao === 'P') setTransp({ id, p: r.emit });
    else if (r.situacao === 'L') setAviso({ texto: `Lançado: entrada ${r.entradaId}.`, tom: 'sucesso' });
    else setAviso({ texto: `${SITUACOES[r.situacao]?.nome}: ${r.mensagem}`, tom: r.situacao === 'E' ? 'erro' : 'alerta' });
  };

  const relancar = async (l: Recebido) => {
    if (l.situacao === 'L') return setAviso({ texto: 'Este CT-e já foi lançado.', tom: 'alerta' });
    setLancando(l.id);
    try {
      await lancar(l.id);
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setLancando(null);
    }
  };

  // Sem confirmação: um engano se desfaz com o Des-Ignorar
  const ignorar = async (l: Recebido, desfazer = false) => {
    try {
      await pedir(`/api/recebidos/${l.id}/ignorar`, 'POST', { desfazer });
      await carregar();
      setAviso({ texto: desfazer ? 'CT-e voltou para Não lançado.' : 'CT-e ignorado.', tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    }
  };

  // Como o abrirDanfe do bm-nfe: o PDF vira blob e abre na aba (o navegador mostra em vez de baixar).
  // A aba abre já no clique: depois do await o bloqueador de pop-up barraria.
  const verDacte = async (l: Recebido) => {
    const aba = window.open('', '_blank');
    try {
      const r = await fetch(`/api/recebidos/${l.id}/dacte`);
      if (!r.ok) {
        const t = await r.text();
        let msg = t;
        try {
          msg = JSON.parse(t).error;
        } catch {}
        throw new Error(msg || 'Não foi possível gerar o DACTE.');
      }
      const url = URL.createObjectURL(await r.blob());
      if (aba) aba.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000); // só depois que a aba carregou
    } catch (e: any) {
      aba?.close();
      setAviso({ texto: e.message, tom: 'erro' });
    }
  };

  // Um por vez (cada lançamento são várias chamadas à BMapi); transportadora nova fica pendente, para confirmar na linha
  const lancarMarcados = async () => {
    setConfirmarLote(false);
    const lista = aLancar;
    const conta: Record<string, number> = {};
    try {
      for (const [i, l] of lista.entries()) {
        setLendo(`Lançando ${i + 1} de ${lista.length}…`);
        const r = await pedir(`/api/recebidos/${l.id}/lancar`, 'POST', { financeiro: marca(l.id).financeiro }).catch((e: any) => ({ situacao: 'E', mensagem: e.message }));
        conta[r.situacao] = (conta[r.situacao] || 0) + 1;
      }
      const resumo = Object.entries(conta).map(([k, n]) => `${n} ${SITUACOES[k]?.nome.toLowerCase() ?? k}`).join(', ');
      const pendente = conta.P ? '\nTransportadora não cadastrada: use o botão Lançar da linha para confirmar os dados.' : '';
      setAviso({ texto: `${resumo}.${pendente}`, tom: conta.E ? 'erro' : conta.P || conta.I || conta.D ? 'alerta' : 'sucesso' });
    } finally {
      setLendo('');
      await carregar();
    }
  };

  const confirmarTransp = async () => {
    if (!transp) return;
    const p = { ...transp.p, nome: transp.p.nome.trim(), fantasia: transp.p.fantasia.trim() || transp.p.nome.trim().slice(0, 40) };
    if (!p.nome) throw new Error('Informe o nome.');
    if (!/^\d{7}$/.test(p.cmun)) throw new Error('O código do município (IBGE) tem 7 dígitos.');
    setTransp(null);
    await lancar(transp.id, p);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <ListaCrm
        className="flex-1"
        id="recebidos"
        chave={(l: Recebido) => l.id}
        linhas={linhas}
        carregando={carregando}
        vazio="Nenhum CT-e recebido. Use Buscar CT-e para ler as contas de e-mail e a SEFAZ."
        info={`Última busca automática: ${capturaAuto ?? 'ainda não rodou'}`}
        barraExtra={
          <div className="flex items-center gap-2">
            <span
              title={bmapiOn == null ? 'Verificando a BMapi…' : bmapiOn ? 'BMapi on-line' : 'BMapi fora do ar: Buscar CT-e e Lançar não vão funcionar'}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                bmapiOn == null
                  ? 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                  : bmapiOn
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${bmapiOn == null ? 'bg-stone-400 animate-pulse' : bmapiOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>BMapi {bmapiOn == null ? '…' : bmapiOn ? 'on-line' : 'fora do ar'}</span>
            </span>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={SELECT} title="Filtrar pela situação">
              <option value="">Todas as situações</option>
              {Object.entries(SITUACOES).map(([k, s]) => (
                <option key={k} value={k}>{s.nome}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setConfirmarLote(true)}
              disabled={!!lendo || !aLancar.length}
              title="Lança no BMsoft os CT-e com Lançar marcado (entre os que a busca mostra)"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-60 disabled:cursor-default whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>Lançar marcados{aLancar.length ? ` (${aLancar.length})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={buscarCTe}
              disabled={!!lendo}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {lendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{lendo || 'Buscar CT-e'}</span>
            </button>
          </div>
        }
        onFiltrar={setFiltradas}
        colunas={[
          {
            key: 'lancar', label: 'Lançar', alinhar: 'centro', largura: 60,
            render: (l: Recebido) =>
              PENDENTES.includes(l.situacao) && (
                <input
                  type="checkbox"
                  checked={marca(l.id).lancar}
                  onChange={(e) => mudar(l.id, 'lancar', e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-emerald-600"
                  title="Grava a entrada do CT-e no BMsoft (EntradasM) ao clicar em Lançar marcados"
                />
              ),
          },
          {
            key: 'financeiro', label: 'Financeiro', alinhar: 'centro', largura: 75,
            render: (l: Recebido) =>
              PENDENTES.includes(l.situacao) && (
                <input
                  type="checkbox"
                  checked={marca(l.id).lancar && marca(l.id).financeiro}
                  disabled={!marca(l.id).lancar}
                  onChange={(e) => mudar(l.id, 'financeiro', e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-emerald-600 disabled:cursor-default disabled:opacity-40"
                  title="Gera também a conta a pagar (DpPPrincipal). Só com Lançar marcado"
                />
              ),
          },
          { key: 'recebido', label: 'Recebido em', alinhar: 'centro', largura: 120 },
          { key: 'emissao', label: 'Emitido em', alinhar: 'centro', largura: 100 },
          { key: 'conta', label: 'Conta', largura: 110 },
          { key: 'emitente', label: 'Transportadora', largura: 200 },
          { key: 'valor', label: 'Valor', alinhar: 'numero', largura: 100, render: (l: Recebido) => formatNumber(l.valor) },
          {
            key: 'situacao', label: 'Situação', alinhar: 'centro', largura: 110,
            render: (l: Recebido) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${SITUACOES[l.situacao]?.cor}`}>{SITUACOES[l.situacao]?.nome ?? l.situacao}</span>,
          },
          { key: 'entrada_id', label: 'Entrada', alinhar: 'numero', largura: 80, render: (l: Recebido) => (l.entrada_id ? String(l.entrada_id) : '') },
          { key: 'mensagem', label: 'Mensagem', largura: 260 },
          { key: 'chave', label: 'Chave do CT-e', largura: 310, render: (l: Recebido) => <span className="font-mono">{l.chave}</span> },
          { key: 'remetente', label: 'Remetente', largura: 180 },
          { key: 'arquivo', label: 'Arquivo', largura: 200 },
        ]}
        // Posições fixas (Lançar | Ignorar ou Des-Ignorar | DACTE | XML): a ação que não vale para a linha vira um
        // espaço do tamanho do ícone, para cada ícone ficar sempre na mesma coluna, um embaixo do outro
        acoes={(l: Recebido) => {
          const pendente = PENDENTES.includes(l.situacao);
          const vazio = <span aria-hidden className="w-[22px] h-[22px]" />;
          return (
            <>
              {pendente ? (
                <BotaoAcao
                  icone={Send}
                  titulo="Lançar"
                  descricao={`Lança só este CT-e no BMsoft${marca(l.id).financeiro ? ', com a conta a pagar' : ', sem a conta a pagar (Financeiro desmarcado)'}`}
                  tom="verde"
                  carregando={lancando === l.id}
                  onClick={() => relancar(l)}
                />
              ) : vazio}
              {pendente ? (
                <BotaoAcao icone={Ban} titulo="Ignorar" descricao="Marca este CT-e como Ignorado: ele sai dos pendentes e não é lançado" onClick={() => ignorar(l)} />
              ) : l.situacao === 'I' ? (
                <BotaoAcao icone={Undo2} titulo="Des-Ignorar" descricao="Volta este CT-e para Não lançado, para poder lançar" onClick={() => ignorar(l, true)} />
              ) : vazio}
              <BotaoAcao icone={FileText} titulo="Ver DACTE" descricao="Abre o DACTE (PDF do CT-e) numa aba nova" onClick={() => verDacte(l)} />
              <BotaoAcao icone={Download} titulo="Baixar XML" descricao="Baixa o XML do CT-e" onClick={() => window.open(`/api/recebidos/${l.id}/xml`, '_blank')} />
            </>
          );
        }}
      />

      {confirmarLote && (
        <ConfirmDialog
          titulo="Lançar marcados"
          mensagem={`Lançar ${aLancar.length} CT-e no BMsoft, ${aLancar.filter((l) => marca(l.id).financeiro).length} com conta a pagar (Financeiro)?`}
          confirmar="Lançar"
          tom="normal"
          onConfirmar={lancarMarcados}
          onCancelar={() => setConfirmarLote(false)}
        />
      )}

      {transp && (
        <ConfirmDialog
          titulo="Transportadora não cadastrada"
          mensagem={`O CT-e é de uma transportadora (CNPJ/CPF ${transp.p.cnpj}, ${transp.p.xmun}) que não está no BMsoft. Confira os dados para cadastrar.`}
          confirmar="Cadastrar e lançar"
          tom="normal"
          largo
          onConfirmar={confirmarTransp}
          onCancelar={() => setTransp(null)}
        >
          <GradeCampos>
            {CAMPOS_PESSOA.map((c, i) => (
              <Campo key={c.k} rotulo={c.rotulo} span={c.span}>
                <input
                  autoFocus={i === 0}
                  required={c.k === 'nome' || c.k === 'cmun'}
                  maxLength={c.max}
                  value={transp.p[c.k] || ''}
                  inputMode={c.digitos ? 'numeric' : undefined}
                  onChange={(e) => {
                    const v = c.digitos ? e.target.value.replace(/\D/g, '') : c.k === 'uf' ? e.target.value.toUpperCase() : e.target.value;
                    setTransp({ ...transp, p: { ...transp.p, [c.k]: v } });
                  }}
                  onFocus={(e) => e.target.select()}
                  className={INPUT_CLASS}
                />
              </Campo>
            ))}
          </GradeCampos>
        </ConfirmDialog>
      )}

      {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
    </div>
  );
}
