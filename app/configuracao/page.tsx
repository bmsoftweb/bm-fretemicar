import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, PlugZap, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { AvisoErro } from '@/components/AvisoErro';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Campo, GradeCampos, INPUT_CLASS, SecaoCrm, TelaCheia } from '@/components/FormCrm';
import { NumberField } from '@/components/NumberField';
import { Toggle } from '@/components/Toggle';
import { formatarCnpj, formatarDataBR, pedir } from '@/lib/utils';

interface Config {
  bmsoft_empresa_id: string;
  bmsoft_usuario_id: string;
  banco_id: string;
  transp_frete: string;
  ler_email: boolean;
  uf_empresa: string;
  sefaz_ultimo_nsu: string;
  bmapi_url: string;
  bmapi_token: boolean;
}

interface Certificado {
  cnpj: string;
  razaoSocial: string;
  numeroSerie: string;
  emissor: string;
  validoDe: string;
  validoAte: string;
  diasParaVencer: number;
  vencido: boolean;
}

/** lê o arquivo como base64 (sem o prefixo "data:...;base64,") */
function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',').pop() || '');
    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

export default function ConfiguracaoPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [ufs, setUfs] = useState<string[]>([]);
  const [transpFretes, setTranspFretes] = useState<Record<string, string>>({});
  const [certificado, setCertificado] = useState<Certificado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tom: 'erro' | 'sucesso' } | null>(null);

  const [arquivoCert, setArquivoCert] = useState<File | null>(null);
  const [senhaCert, setSenhaCert] = useState('');
  const [enviandoCert, setEnviandoCert] = useState(false);
  const [removerCert, setRemoverCert] = useState(false);
  const arquivoCertRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const c = await pedir('/api/config');
      setCfg({ ...c, bmsoft_empresa_id: String(c.bmsoft_empresa_id), bmsoft_usuario_id: String(c.bmsoft_usuario_id), banco_id: String(c.banco_id) });
      setUfs(c.ufs || []);
      setTranspFretes(c.transp_fretes || {});
      setCertificado(c.certificado);
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviarCertificado = async () => {
    if (!arquivoCert || !senhaCert) return;
    setEnviandoCert(true);
    try {
      const base64 = await lerComoBase64(arquivoCert);
      const r = await pedir('/api/config/certificado', 'POST', { pfx_base64: base64, senha: senhaCert });
      setCertificado(r.certificado);
      setArquivoCert(null);
      setSenhaCert('');
      if (arquivoCertRef.current) arquivoCertRef.current.value = '';
      setAviso({ texto: 'Certificado configurado.', tom: 'sucesso' });
    } catch (e: any) {
      setAviso({ texto: e.message, tom: 'erro' });
    } finally {
      setEnviandoCert(false);
    }
  };

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
            <Campo rotulo="Modalidade do frete" dica="Gravada em Transp_Frete da entrada (no BMsoft é escolhida na importação do CT-e)">
              <select value={cfg.transp_frete} onChange={(e) => setCfg({ ...cfg, transp_frete: e.target.value })} required className={INPUT_CLASS}>
                {Object.entries(transpFretes).map(([k, nome]) => (
                  <option key={k} value={k}>{k} - {nome}</option>
                ))}
              </select>
            </Campo>
          </GradeCampos>
        </SecaoCrm>
        <SecaoCrm titulo="Fontes de CT-e">
          <GradeCampos>
            <Campo rotulo="UF da empresa" dica="Preenchida sozinha quando a BMapi responde (usada no pedido à SEFAZ). Informe aqui para já poder ler da SEFAZ mesmo com a BMapi fora do ar.">
              <select value={cfg.uf_empresa} onChange={(e) => setCfg({ ...cfg, uf_empresa: e.target.value })} className={INPUT_CLASS}>
                <option value="">(nenhuma)</option>
                {ufs.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Ler e-mail também" dica="Desligado por padrão: a SEFAZ já traz todo CT-e contra o CNPJ da empresa. Ligue para somar o e-mail como fonte (por exemplo, antes de configurar o certificado).">
              <Toggle checked={cfg.ler_email} onChange={(v) => setCfg({ ...cfg, ler_email: v })} />
            </Campo>
            <Campo
              rotulo="NSU da SEFAZ (avançado)"
              span={2}
              dica="Posição de onde a próxima busca continua. Baixe para reler CT-e mais antigos (ela tenta lançar tudo que achar a partir daqui; o que já foi lançado só aparece como «Já lançado»). Deixe em branco para a próxima busca refazer a primeira leitura, sem lançar o que já existia."
            >
              <input
                value={cfg.sefaz_ultimo_nsu}
                onChange={(e) => setCfg({ ...cfg, sefaz_ultimo_nsu: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                placeholder="(nunca configurado)"
                className={INPUT_CLASS}
              />
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
        <SecaoCrm titulo="Certificado digital A1 (SEFAZ)">
          <p className="text-[11px] font-medium text-stone-400 dark:text-stone-500 -mt-1 mb-3">
            Arquivo .pfx/.p12 usado para ler CT-e direto da SEFAZ — a fonte padrão. Fica guardado aqui, com a
            senha cifrada. Sem ele, e sem o e-mail ligado acima, "Buscar CT-e" não encontra nada.
          </p>

          {certificado && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
              {([
                ['Titular', certificado.razaoSocial],
                ['CNPJ', formatarCnpj(certificado.cnpj)],
                ['Número de série', certificado.numeroSerie],
                ['Emissor', certificado.emissor],
                ['Válido de', formatarDataBR(certificado.validoDe)],
                ['Válido até', formatarDataBR(certificado.validoAte)],
              ] as const).map(([rotulo, valor]) => (
                <div key={rotulo} className="flex flex-col">
                  <span className="text-[10px] font-semibold uppercase text-stone-400">{rotulo}</span>
                  <span className="text-stone-800 dark:text-stone-100 break-all">{valor || '—'}</span>
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
                <span
                  className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    certificado.vencido
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      : certificado.diasParaVencer <= 30
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  }`}
                >
                  {certificado.vencido ? 'Vencido' : `Vence em ${certificado.diasParaVencer} dia(s)`}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoverCert(true)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover certificado</span>
                </button>
              </div>
            </div>
          )}

          <div className={certificado ? 'border-t border-stone-200 dark:border-stone-800 pt-4' : ''}>
            <GradeCampos>
              <input ref={arquivoCertRef} type="file" accept=".pfx,.p12" className="hidden" onChange={(e) => setArquivoCert(e.target.files?.[0] || null)} />
              <Campo rotulo="Arquivo do certificado" span={2}>
                <div className="flex gap-2">
                  <div className="campo-botao flex-1 min-w-0 h-[34px] flex items-center px-3 bg-stone-50 dark:bg-stone-800/80 text-xs truncate" data-obrigatorio="true">
                    {arquivoCert?.name || 'Nenhum arquivo escolhido'}
                  </div>
                  <button
                    type="button"
                    onClick={() => arquivoCertRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Escolher</span>
                  </button>
                </div>
              </Campo>
              <Campo rotulo="Senha do certificado" span={1}>
                <input type="password" autoComplete="new-password" value={senhaCert} onChange={(e) => setSenhaCert(e.target.value)} onFocus={(e) => e.target.select()} className={INPUT_CLASS} />
              </Campo>
              <Campo rotulo=" " span={1}>
                <button
                  type="button"
                  disabled={!arquivoCert || !senhaCert || enviandoCert}
                  onClick={enviarCertificado}
                  className="w-full flex items-center justify-center gap-2 px-4 h-[34px] rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {enviandoCert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Enviar certificado</span>
                </button>
              </Campo>
            </GradeCampos>
          </div>
        </SecaoCrm>
      </TelaCheia>

      {removerCert && (
        <ConfirmDialog
          titulo="Remover o certificado?"
          mensagem="Sem o certificado, a leitura pela SEFAZ fica desligada (o e-mail continua funcionando). O histórico já lançado não muda."
          onConfirmar={async () => {
            await pedir('/api/config/certificado', 'DELETE');
            setCertificado(null);
            setRemoverCert(false);
            setAviso({ texto: 'Certificado removido.', tom: 'sucesso' });
          }}
          onCancelar={() => setRemoverCert(false)}
        />
      )}
      {aviso && <AvisoErro mensagem={aviso.texto} tom={aviso.tom} onFechar={() => setAviso(null)} />}
    </>
  );
}
