import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, PlugZap, Save } from 'lucide-react';
import { AvisoErro } from '@/components/AvisoErro';
import { Campo, GradeCampos, INPUT_CLASS, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { NumberField } from '@/components/NumberField';
import { pedir } from '@/lib/utils';

interface Config {
  bmsoft_empresa_id: string;
  bmsoft_usuario_id: string;
  banco_id: string;
  bmapi_url: string;
  bmapi_token: boolean;
}

export default function ConfiguracaoPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tom: 'erro' | 'sucesso' } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const c = await pedir('/api/config');
      setCfg({ ...c, bmsoft_empresa_id: String(c.bmsoft_empresa_id), bmsoft_usuario_id: String(c.bmsoft_usuario_id), banco_id: String(c.banco_id) });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await pedir('/api/config', 'PUT', cfg);
      setAviso({ texto: 'Configuração salva.', tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    try {
      const e = await pedir('/api/config/testar', 'POST', { bmsoft_empresa_id: cfg?.bmsoft_empresa_id });
      setAviso({ texto: `BMapi OK. Empresa: ${e.nome} (${e.uf}), CNPJ ${e.cnpj}: só os CT-e com este tomador são lançados.`, tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setTestando(false);
    }
  };

  if (!cfg)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-400" size={32} />
        {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
      </div>
    );

  const set = (k: keyof Config) => (v: string) => setCfg({ ...cfg, [k]: v });
  return (
    <>
      <TelaCheia
        rodape="Vale para a filial em que você entrou"
        onVoltar={carregar}
        rotuloVoltar="Desfazer"
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
            <span>Testar BMapi</span>
          </button>
        }
      >
        <SecaoCrm titulo="Lançamento no BMsoft">
          <GradeCampos>
            <Campo rotulo="Empresa (ID no BMsoft)" dica="O CNPJ dela é o tomador aceito nos CT-e">
              <NumberField value={cfg.bmsoft_empresa_id} onChange={set('bmsoft_empresa_id')} scale={0} required className={INPUT_CLASS} />
            </Campo>
            <Campo rotulo="Usuário (ID no BMsoft)" dica="Gravado como autor das entradas">
              <NumberField value={cfg.bmsoft_usuario_id} onChange={set('bmsoft_usuario_id')} scale={0} className={INPUT_CLASS} />
            </Campo>
            <Campo rotulo="Banco da conta a pagar (ID)" dica="Vencimento: data do lançamento + 30 dias">
              <NumberField value={cfg.banco_id} onChange={set('banco_id')} scale={0} className={INPUT_CLASS} />
            </Campo>
          </GradeCampos>
        </SecaoCrm>
        <SecaoCrm titulo="BMapi">
          <GradeCampos>
            <Campo rotulo="Endereço" span={2} dica="BMAPI_URL e BMAPI_TOKEN nas variáveis de ambiente (Vercel)">
              <input readOnly value={cfg.bmapi_url || '(não configurado)'} className={INPUT_CLASS} />
            </Campo>
            <Campo rotulo="Token">
              <input readOnly value={cfg.bmapi_token ? 'Configurado' : '(não configurado)'} className={INPUT_CLASS} />
            </Campo>
          </GradeCampos>
        </SecaoCrm>
      </TelaCheia>
      {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
    </>
  );
}
