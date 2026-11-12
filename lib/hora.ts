// Horário de Brasília (UTC-3), qualquer que seja o fuso do servidor (a Vercel roda em UTC)
const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

/** 'aaaa-mm-dd hh:mm:ss' agora, em Brasília */
export const agoraBR = () => fmt.format(new Date()).replace('T', ' ');

/** 'aaaa-mm-dd' hoje, em Brasília */
export const hojeBR = () => agoraBR().slice(0, 10);

/** 'aaaa-mm-dd' + n dias */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
