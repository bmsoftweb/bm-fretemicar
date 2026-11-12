import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, MailSearch, Send } from 'lucide-react';
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
  conta: string | null;
  remetente: string;
  assunto: string;
  arquivo: string;
  chave: string;
  emitente: string;
  valor: string;
  situacao: 'L' | 'E' | 'I' | 'D' | 'P';
  entrada_id: number | null;
  mensagem: string;
}

type Pessoa = Record<'cnpj' | 'ie' | 'nome' | 'fantasia' | 'lgr' | 'nro' | 'cpl' | 'bairro' | 'cmun' | 'xmun' | 'cep' | 'uf' | 'fone', string>;

const SITUACOES: Record<string, { nome: string; cor: string }> = {
  L: { nome: 'Lançado', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  P: { nome: 'Transportadora', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  E: { nome: 'Erro', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  I: { nome: 'Ignorado', cor: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  D: { nome: 'Já lançado', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
};

const SELECT = `${INPUT_CLASS} !w-auto`;

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
  const lerEmails = async () => {
    const total = { mensagens: 0, ctes: 0, lancados: 0, erros: [] as string[] };
    try {
      for (let rodada = 1; ; rodada++) {
        setLendo(rodada > 1 ? `Lendo (parte ${rodada})…` : 'Lendo…');
        const r = await pedir('/api/leitura', 'POST');
        total.mensagens += r.mensagens;
        total.ctes += r.ctes;
        total.lancados += r.lancados;
        total.erros.push(...r.erros);
        await carregar();
        if (!r.pendente || rodada >= 20) break;
      }
      const resumo = `${total.mensagens} e-mail(s) novo(s), ${total.ctes} CT-e, ${total.lancados} lançado(s).`;
      setAviso(total.erros.length ? { texto: `${resumo}\n${total.erros.join('\n')}`, tom: 'erro' } : { texto: resumo, tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setLendo('');
    }
  };

  const lancar = async (id: number, transportadora?: Pessoa) => {
    const r = await pedir(`/api/recebidos/${id}/lancar`, 'POST', transportadora ? { transportadora } : {});
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
        vazio="Nenhum CT-e recebido. Use Ler e-mails para buscar nas contas cadastradas."
        barraExtra={
          <div className="flex items-center gap-2">
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={SELECT} title="Filtrar pela situação">
              <option value="">Todas as situações</option>
              {Object.entries(SITUACOES).map(([k, s]) => (
                <option key={k} value={k}>{s.nome}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={lerEmails}
              disabled={!!lendo}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {lendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailSearch className="w-4 h-4" />}
              <span>{lendo || 'Ler e-mails'}</span>
            </button>
          </div>
        }
        colunas={[
          { key: 'recebido', label: 'Recebido em', alinhar: 'centro', largura: 120 },
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
        acoes={(l: Recebido) => (
          <>
            {(l.situacao === 'E' || l.situacao === 'P') && (
              <BotaoAcao icone={Send} titulo="Lançar" descricao="Lança de novo no BMsoft o XML guardado" tom="verde" carregando={lancando === l.id} onClick={() => relancar(l)} />
            )}
            <BotaoAcao icone={Download} titulo="Baixar XML" descricao="Baixa o XML do CT-e" onClick={() => window.open(`/api/recebidos/${l.id}/xml`, '_blank')} />
          </>
        )}
      />

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
