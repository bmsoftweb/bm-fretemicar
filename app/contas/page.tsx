import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, PlugZap, Save, Trash2 } from 'lucide-react';
import { useRefreshDaTela } from '@/components/LayoutApp';
import { ListaCrm } from '@/components/ListaCrm';
import { BotaoAcao } from '@/components/MenuAcoes';
import { AvisoErro } from '@/components/AvisoErro';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AbasCrm } from '@/components/TelaHeader';
import { Campo, GradeCampos, INPUT_CLASS, TelaCheia } from '@/components/FormCrm';
import { NumberField } from '@/components/NumberField';
import { Toggle } from '@/components/Toggle';
import { pedir } from '@/lib/utils';

interface Conta {
  id: number;
  descricao: string;
  host: string;
  porta: number;
  ssl: number;
  usuario: string;
  pasta: string;
  ultimo_uid: number;
  ativo: number;
}

const VAZIA = { descricao: '', host: '', porta: '993', ssl: true, usuario: '', senha: '', pasta: 'INBOX', ativo: true, reler: false };

export default function ContasPage() {
  const [linhas, setLinhas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Conta | null | undefined>(undefined); // undefined = lista; null = nova
  const [form, setForm] = useState(VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [excluir, setExcluir] = useState<Conta | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tom: 'erro' | 'sucesso' } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLinhas(await pedir('/api/contas'));
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  useRefreshDaTela(carregar);

  const abrir = (c: Conta | null) => {
    setForm(c ? { ...VAZIA, ...c, porta: String(c.porta), ssl: !!c.ssl, ativo: !!c.ativo, senha: '' } : VAZIA);
    setEditando(c);
  };
  const set = (k: keyof typeof VAZIA, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const corpo = () => ({ ...form, porta: Number(form.porta) || 993, id: editando?.id });

  const salvar = async () => {
    setSalvando(true);
    try {
      await pedir(editando ? `/api/contas/${editando.id}` : '/api/contas', editando ? 'PUT' : 'POST', corpo());
      await carregar();
      setEditando(undefined);
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    try {
      await pedir('/api/contas/testar', 'POST', corpo());
      setAviso({ texto: 'Conexão OK.', tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setTestando(false);
    }
  };

  const campo = (k: 'descricao' | 'host' | 'usuario' | 'pasta', props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={form[k]} onChange={(e) => set(k, e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} {...props} />
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <AbasCrm
        lista="Contas de e-mail"
        total={linhas.length}
        abas={editando !== undefined ? [{ key: 'edit', titulo: editando ? editando.descricao : 'Nova conta', novo: !editando }] : []}
        ativa={editando !== undefined ? 'edit' : null}
        onAtivar={(k) => k === null && setEditando(undefined)}
        onFechar={() => setEditando(undefined)}
      />
      {editando === undefined ? (
        <ListaCrm
          className="flex-1"
          id="contas"
          chave={(c: Conta) => c.id}
          linhas={linhas}
          carregando={carregando}
          onNovo={() => abrir(null)}
          onEditar={abrir}
          vazio="Nenhuma conta cadastrada."
          colunas={[
            { key: 'descricao', label: 'Descrição', largura: 200 },
            { key: 'usuario', label: 'Usuário', largura: 240 },
            { key: 'host', label: 'Servidor IMAP', largura: 200 },
            { key: 'porta', label: 'Porta', alinhar: 'numero', largura: 70 },
            { key: 'pasta', label: 'Pasta', largura: 100 },
            { key: 'ativo', label: 'Ativa', alinhar: 'centro', largura: 70, render: (c: Conta) => (c.ativo ? 'Sim' : 'Não') },
          ]}
          acoes={(c: Conta) => (
            <>
              <BotaoAcao icone={Pencil} titulo="Editar" descricao="Abre a conta para edição" onClick={() => abrir(c)} />
              <BotaoAcao icone={Trash2} titulo="Excluir" descricao="Exclui a conta (pede confirmação)" tom="perigo" onClick={() => setExcluir(c)} />
            </>
          )}
        />
      ) : (
        <TelaCheia
          rodape={editando ? `Conta #${editando.id}` : 'Inclusão'}
          onVoltar={() => setEditando(undefined)}
          rotuloVoltar="Cancelar"
          onSubmit={salvar}
          rotuloPrincipal={salvando ? 'Salvando…' : 'Salvar'}
          iconePrincipal={<Save className="w-4 h-4" />}
          salvando={salvando}
          acoes={
            <button
              type="button"
              onClick={testar}
              disabled={testando}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40"
            >
              {testando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
              <span>Testar conexão</span>
            </button>
          }
        >
          <GradeCampos>
            <Campo rotulo="Descrição" span={2}>{campo('descricao', { required: true, autoFocus: true, maxLength: 60 })}</Campo>
            <Campo rotulo="Usuário (e-mail)" span={2}>{campo('usuario', { required: true, maxLength: 120 })}</Campo>
            <Campo rotulo="Senha" span={2} dica={editando ? 'Em branco mantém a senha gravada' : 'Gmail/Outlook: use uma senha de app'}>
              <input type="password" required={!editando} autoComplete="new-password" value={form.senha} onChange={(e) => set('senha', e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
            </Campo>
            <Campo rotulo="Servidor IMAP" span={2}>{campo('host', { required: true, maxLength: 120, placeholder: 'imap.gmail.com' })}</Campo>
            <Campo rotulo="Porta">
              <NumberField value={form.porta} onChange={(v) => set('porta', v)} scale={0} required className={INPUT_CLASS} />
            </Campo>
            <Campo rotulo="SSL">
              <Toggle checked={form.ssl} onChange={(v) => set('ssl', v)} />
            </Campo>
            <Campo rotulo="Pasta">{campo('pasta', { maxLength: 60 })}</Campo>
            <Campo rotulo="Ativa">
              <Toggle checked={form.ativo} onChange={(v) => set('ativo', v)} />
            </Campo>
            {editando && (
              <Campo rotulo="Reler os últimos 30 dias" span={2} dica="Volta a ler os e-mails já vistos; os CT-e já lançados aparecem como Já lançado">
                <Toggle checked={form.reler} onChange={(v) => set('reler', v)} />
              </Campo>
            )}
          </GradeCampos>
        </TelaCheia>
      )}

      {excluir && (
        <ConfirmDialog
          titulo="Excluir conta"
          mensagem={`Excluir a conta "${excluir.descricao}"? Os CT-e já recebidos continuam no histórico.`}
          onConfirmar={async () => {
            await pedir(`/api/contas/${excluir.id}`, 'DELETE');
            setExcluir(null);
            await carregar();
          }}
          onCancelar={() => setExcluir(null)}
        />
      )}
      {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
    </div>
  );
}
