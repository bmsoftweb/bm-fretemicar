import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { ListaCrm } from '@/components/ListaCrm';
import { AvisoErro } from '@/components/AvisoErro';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Campo } from '@/components/FormCrm';
import { DateField } from '@/components/DateField';
import { formatarCnpj, formatarDataBR, formatNumber, pedir } from '@/lib/utils';

interface Transportadora {
  id: number;
  nome: string;
  cnpj: string;
  abertos: number;
}

interface Conta {
  id: number;
  transportadora: string;
  cnpj: string;
  documento: string;
  parcela: string;
  geracao: string;
  vencimento: string;
  valor: number;
  pago: number;
  entrada: number | null;
}

const BOTAO = 'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap';

/** Contas a pagar em aberto de uma ou mais transportadoras, no BMsoft: marca as linhas e troca o vencimento de todas de uma vez */
export default function VencimentosPage() {
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [fornecedores, setFornecedores] = useState<number[]>([]);
  // Posição (fixed) do painel de transportadoras: a barra da lista corta o que passa da borda dela
  const [escolhendo, setEscolhendo] = useState<{ top: number; right: number } | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [linhas, setLinhas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [filtradas, setFiltradas] = useState<Conta[]>([]); // as que passam pela busca da lista
  const [novoVenc, setNovoVenc] = useState<string | null>(null); // null = modal fechado
  const [aviso, setAviso] = useState<{ texto: string; tom: 'erro' | 'sucesso' } | null>(null);

  const carregarTransportadoras = useCallback(async () => {
    try {
      setTransportadoras(await pedir('/api/vencimentos'));
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    }
  }, []);

  const carregar = useCallback(async () => {
    setMarcadas(new Set());
    if (!fornecedores.length) return setLinhas([]);
    setCarregando(true);
    try {
      const contas: Conta[] = await pedir(`/api/vencimentos?fornecedores=${fornecedores.join(',')}`);
      // Datas também como na tela, para a busca achar "17/12/2026"
      setLinhas(contas.map((c) => ({ ...c, vencimentoBR: formatarDataBR(c.vencimento), geracaoBR: formatarDataBR(c.geracao) })));
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setCarregando(false);
    }
  }, [fornecedores]);

  useEffect(() => {
    carregarTransportadoras();
  }, [carregarTransportadoras]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useRefreshDaTela(carregar);

  // Lista de transportadoras aberta: fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!escolhendo) return;
    const fora = (e: MouseEvent) => !caixaRef.current?.contains(e.target as Node) && setEscolhendo(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setEscolhendo(null);
    const fechar = () => setEscolhendo(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', fechar);
    };
  }, [escolhendo]);

  const abrirEscolha = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (escolhendo) return setEscolhendo(null);
    const r = e.currentTarget.getBoundingClientRect();
    setEscolhendo({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  // Data em branco ao abrir: o foco já vai para ela
  useEffect(() => {
    if (novoVenc !== null) setTimeout(() => document.getElementById('novo-vencimento')?.focus(), 0);
  }, [novoVenc !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternarFornecedor = (id: number) => setFornecedores((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  // Filiais da mesma raiz de CNPJ (8 primeiros dígitos) ficam num grupo, marcado de uma vez
  const grupos = useMemo(() => {
    const m = new Map<string, Transportadora[]>();
    for (const t of transportadoras) {
      const raiz = t.cnpj?.length === 14 ? t.cnpj.slice(0, 8) : String(t.id);
      m.set(raiz, [...(m.get(raiz) ?? []), t]);
    }
    return [...m.entries()];
  }, [transportadoras]);
  const alternarGrupo = (ts: Transportadora[]) => {
    const ids = ts.map((t) => t.id);
    const todos = ids.every((id) => fornecedores.includes(id));
    setFornecedores((f) => (todos ? f.filter((x) => !ids.includes(x)) : [...new Set([...f, ...ids])]));
  };
  const alternar = (id: number) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  // "Marcar todas" vale só para as que a busca mostra; as marcadas antes continuam marcadas
  const todasMarcadas = filtradas.length > 0 && filtradas.every((l) => marcadas.has(l.id));
  const marcarFiltradas = () =>
    setMarcadas((m) => {
      const n = new Set(m);
      for (const l of filtradas) todasMarcadas ? n.delete(l.id) : n.add(l.id);
      return n;
    });

  const totalMarcado = useMemo(
    () => linhas.reduce((t, l) => (marcadas.has(l.id) ? t + Math.round(l.valor * 100) : t), 0) / 100,
    [linhas, marcadas],
  );

  const rotuloEscolha =
    fornecedores.length === 0
      ? 'Escolha as transportadoras…'
      : fornecedores.length === 1
        ? transportadoras.find((t) => t.id === fornecedores[0])?.nome ?? '1 transportadora'
        : `${fornecedores.length} transportadoras`;

  const alterar = async () => {
    if (!novoVenc) throw new Error('Informe a nova data de vencimento.');
    const r = await pedir<{ alteradas: number }>('/api/vencimentos', 'PUT', { ids: [...marcadas], vencimento: novoVenc });
    setNovoVenc(null);
    setAviso({ texto: `${r.alteradas} conta(s) com vencimento em ${formatarDataBR(novoVenc)}.`, tom: 'sucesso' });
    await carregar();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <ListaCrm
        className="flex-1"
        id="vencimentos"
        chave={(l: Conta) => l.id}
        linhas={linhas}
        carregando={carregando}
        vazio={fornecedores.length ? 'Nenhuma conta em aberto para estas transportadoras.' : 'Escolha as transportadoras para ver as contas a pagar em aberto.'}
        info={marcadas.size ? `${marcadas.size} marcada(s), total ${formatNumber(totalMarcado)}` : undefined}
        onFiltrar={setFiltradas}
        barraExtra={
          <div className="flex items-center gap-2">
            <div ref={caixaRef}>
              <button
                type="button"
                onClick={abrirEscolha}
                title="Transportadoras"
                className="campo-botao h-[34px] w-[20rem] flex items-center justify-between gap-2 px-3 bg-stone-50 dark:bg-stone-800/80 text-xs font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
                data-obrigatorio="true"
              >
                <span className="truncate">{rotuloEscolha}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-stone-400" />
              </button>
              {escolhendo && (
                <div style={escolhendo} className="fixed z-40 w-[30rem] max-w-[90vw] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl">
                  <div className="max-h-80 overflow-y-auto py-1">
                    {grupos.map(([raiz, ts]) => {
                      const item = (t: Transportadora, filial: boolean) => (
                        <label key={t.id} className={`flex items-center gap-2.5 ${filial ? 'pl-8' : 'pl-3'} pr-3 py-1.5 text-xs cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800`}>
                          <input type="checkbox" checked={fornecedores.includes(t.id)} onChange={() => alternarFornecedor(t.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                          <span className="flex-1 min-w-0 truncate text-stone-800 dark:text-stone-100">{t.nome}</span>
                          <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">{formatarCnpj(t.cnpj)}</span>
                          <span className="w-20 text-right whitespace-nowrap text-stone-500 dark:text-stone-400">{t.abertos} aberta(s)</span>
                        </label>
                      );
                      if (ts.length === 1) return item(ts[0], false);
                      const abertos = ts.reduce((s, t) => s + t.abertos, 0);
                      return (
                        <div key={raiz}>
                          <label className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800" title="Marca ou desmarca todas as filiais deste CNPJ">
                            <input type="checkbox" checked={ts.every((t) => fornecedores.includes(t.id))} onChange={() => alternarGrupo(ts)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                            <span className="flex-1 min-w-0 truncate text-stone-800 dark:text-stone-100">{ts[0].nome} — todas as {ts.length} filiais</span>
                            <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">{`${raiz.slice(0, 2)}.${raiz.slice(2, 5)}.${raiz.slice(5)}`}</span>
                            <span className="w-20 text-right whitespace-nowrap text-stone-500 dark:text-stone-400">{abertos} aberta(s)</span>
                          </label>
                          {ts.map((t) => item(t, true))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-stone-200 dark:border-stone-700 px-3 py-1.5 flex justify-end gap-4">
                    <button type="button" onClick={() => setFornecedores(transportadoras.map((t) => t.id))} className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer">
                      Marcar todas
                    </button>
                    {fornecedores.length > 0 && (
                      <button type="button" onClick={() => setFornecedores([])} className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer">
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!marcadas.size}
              onClick={() => setNovoVenc('')}
              className={`${BOTAO} bg-blue-600 hover:bg-blue-700 text-white`}
            >
              <CalendarClock className="w-4 h-4" />
              <span>Alterar Vencimento para...</span>
            </button>
          </div>
        }
        colunas={[
          {
            key: 'marcar', label: 'Marcar', alinhar: 'centro', largura: 40,
            cabecalho: (
              <input
                type="checkbox"
                checked={todasMarcadas}
                disabled={!filtradas.length}
                onChange={marcarFiltradas}
                className="w-4 h-4 align-middle cursor-pointer accent-blue-600 disabled:cursor-default"
                title={filtradas.length < linhas.length ? `Marcar/desmarcar as ${filtradas.length} que a busca mostra` : 'Marcar/desmarcar todas'}
              />
            ),
            render: (l: Conta) => (
              <input type="checkbox" checked={marcadas.has(l.id)} onChange={() => alternar(l.id)} className="w-4 h-4 cursor-pointer accent-blue-600" title="Marcar para alterar o vencimento" />
            ),
          },
          { key: 'vencimento', label: 'Vencimento', alinhar: 'centro', largura: 100, render: (l: Conta) => formatarDataBR(l.vencimento) },
          { key: 'transportadora', label: 'Transportadora', largura: 220 },
          { key: 'cnpj', label: 'CNPJ', largura: 140, render: (l: Conta) => formatarCnpj(l.cnpj) },
          { key: 'documento', label: 'Documento', largura: 140 },
          { key: 'parcela', label: 'Parcela', alinhar: 'centro', largura: 70 },
          { key: 'valor', label: 'Valor', alinhar: 'numero', largura: 100, render: (l: Conta) => formatNumber(l.valor) },
          { key: 'pago', label: 'Pago', alinhar: 'numero', largura: 100, render: (l: Conta) => (l.pago ? formatNumber(l.pago) : '') },
          { key: 'geracao', label: 'Gerada em', alinhar: 'centro', largura: 100, render: (l: Conta) => formatarDataBR(l.geracao) },
          { key: 'entrada', label: 'Entrada', alinhar: 'numero', largura: 80, render: (l: Conta) => (l.entrada ? String(l.entrada) : '') },
        ]}
      />

      {novoVenc !== null && (
        <ConfirmDialog
          titulo="Alterar vencimento"
          mensagem={`${marcadas.size} conta(s) marcada(s), total ${formatNumber(totalMarcado)}. O vencimento de todas passa a ser a data abaixo.`}
          confirmar="Alterar"
          tom="normal"
          onConfirmar={alterar}
          onCancelar={() => setNovoVenc(null)}
        >
          <Campo rotulo="Novo vencimento">
            <DateField id="novo-vencimento" value={novoVenc} onChange={setNovoVenc} required />
          </Campo>
        </ConfirmDialog>
      )}

      {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
    </div>
  );
}
