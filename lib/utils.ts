export function formatCurrency(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) return 'R$ 0,00';
  
  return 'R$ ' + new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatNumber(value: number | string | undefined | null, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) {
    if (decimals === 0) return '0';
    return '0,' + '0'.repeat(decimals);
  }
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/** Só dígitos -> '00.000.000/0000-00' (exibição; o CNPJ fica gravado só com dígitos) */
export function formatarCnpj(cnpj: string | null | undefined): string {
  const d = (cnpj || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : d;
}

/** 'aaaa-mm-dd' ou ISO -> 'dd/mm/aaaa' (regra do projeto: datas sempre nesse formato) */
export function formatarDataBR(data: string | null | undefined): string {
  if (!data) return '';
  const [a, m, d] = data.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : '';
}

export function parseBankingInput(value: string, decimals: number = 2): number {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue === '') return 0;
  return parseFloat(cleanValue) / Math.pow(10, decimals);
}

/** fetch com JSON: devolve o corpo ou lança Error com a mensagem da API */
export async function pedir<T = any>(url: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) window.location.href = '/';
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}
