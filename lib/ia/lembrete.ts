// ============================================================================
//  O LEMBRETE DA RETIRADA: avisar antes, e uma vez só.
//
//  Pedido dele em 02/09/2026: *"colocar um tempo ali de avisar 10 horas antes
//  do horário que eles agendaram para buscar o produto deles"*.
//
//  Isto aqui é SÓ A DECISÃO, e de propósito: quem manda mensagem, quem lê banco
//  e quem fala com a Meta mora fora. Assim a regra que decide quando escrever
//  pro cliente pode ser medida em milissegundos, sem rede e sem token, que é o
//  que faz este arquivo ter teste de verdade.
//
//  MENSAGEM PRO CLIENTE É COISA SÉRIA. Errar aqui não é errar um preço: é a
//  padaria escrevendo de madrugada, ou escrevendo duas vezes, ou lembrando de
//  um pedido que a pessoa acabou de combinar. Por isso cada guarda abaixo tem
//  um caso no teste com o nome do estrago que ela evita.
// ============================================================================

/** Quantas horas antes da retirada o cliente é lembrado. Pedido dele. */
export const HORAS_ANTES = 10;

/**
 * A PADARIA NÃO ESCREVE DE MADRUGADA.
 *
 * Dez horas antes de uma retirada às 13:00 é 03:00. Ninguém manda mensagem de
 * padaria às três da manhã, e quem recebe acorda com o celular. A faixa de
 * silêncio vai das 21:00 às 07:00.
 */
export const SILENCIO = { comeca: 21, termina: 7 };

export type PedidoPraLembrar = {
  id: string;
  telefone: string | null;
  clienteNome: string | null;
  /** "YYYY-MM-DD" ou "DD/MM/YYYY". */
  retiradaData: string | null;
  /** "18:30", "18h30", "18:30:00". */
  retiradaHora: string | null;
  /** Quando a equipe aprovou, no relógio de parede: "YYYY-MM-DDTHH:MM". */
  aprovadoEm: string | null;
  /** Quando o lembrete já saiu. Preenchido = não sai de novo. */
  lembreteEm: string | null;
};

/**
 * O RELÓGIO DE PAREDE VIRA UM NÚMERO, e a conta de fuso some.
 *
 * A retirada é combinada em horário de São Paulo e guardada como data e hora
 * soltas, sem fuso. Quem lê também está em São Paulo. Então comparar os dois
 * como parede contra parede é o certo, e converter pra UTC no meio só criaria
 * uma chance de errar uma hora duas vezes por ano no horário de verão.
 */
export function minutosDaParede(data: unknown, hora: unknown): number | null {
  const d = String(data ?? "").trim();
  const h = String(hora ?? "").trim();
  if (!d) return null;

  let ano: number, mes: number, dia: number;
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (br) {
    dia = Number(br[1]);
    mes = Number(br[2]);
    ano = Number(br[3]);
  } else return null;

  // "18:30", "18h30", "18:30:00", "T18:30". Sem hora, meia-noite.
  const mh = h.match(/(\d{1,2})\s*[h:.]\s*(\d{1,2})/) ?? h.match(/(\d{1,2})\s*h(?!\d)/);
  const horas = mh ? Number(mh[1]) : 0;
  const minutos = mh && mh[2] !== undefined ? Number(mh[2]) : 0;
  if (horas > 23 || minutos > 59) return null;

  return Date.UTC(ano, mes - 1, dia, horas, minutos) / 60000;
}

/** A hora do dia (0 a 23) de um instante de parede. */
function horaDe(minuto: number): number {
  return new Date(minuto * 60000).getUTCHours();
}

/** As 21:00 do dia deste instante, em minutos de parede. */
function asVinteEUmaDe(minuto: number): number {
  const d = new Date(minuto * 60000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), SILENCIO.comeca, 0) / 60000;
}

/**
 * QUANDO ESTE PEDIDO DEVE SER LEMBRADO, em minutos de parede.
 *
 * Dez horas antes da retirada, e nunca dentro da madrugada: caindo lá, ANTECIPA
 * pra última 21:00 antes dela. Antecipar e nunca adiar é decisão, e a razão é
 * que lembrete atrasado não serve pra nada: quem ia buscar às 13:00 já saiu de
 * casa. Chegar cedo demais só faz o cliente saber antes.
 */
export function quandoAvisar(p: PedidoPraLembrar): number | null {
  const retirada = minutosDaParede(p.retiradaData, p.retiradaHora);
  if (retirada === null) return null;
  let alvo = retirada - HORAS_ANTES * 60;
  const h = horaDe(alvo);
  if (h >= SILENCIO.comeca) alvo = asVinteEUmaDe(alvo);
  else if (h < SILENCIO.termina) alvo = asVinteEUmaDe(alvo) - 24 * 60;
  return alvo;
}

export type PorQueNao =
  | "sem data"
  | "sem telefone"
  | "ja avisado"
  | "ainda nao e hora"
  | "a retirada ja passou"
  | "aprovado depois da hora do aviso";

/**
 * ESTE PEDIDO PRECISA DE LEMBRETE AGORA?
 *
 * Devolve o motivo quando não, porque "não mandei" sem motivo é o tipo de coisa
 * que ninguém consegue investigar depois: o dono vê que o cliente não foi
 * avisado e não tem como saber se foi data faltando, telefone faltando ou
 * relógio.
 */
export function estaNaHora(
  p: PedidoPraLembrar,
  agora: number,
): { avisar: true } | { avisar: false; porque: PorQueNao } {
  if (p.lembreteEm) return { avisar: false, porque: "ja avisado" };
  if (!String(p.telefone ?? "").trim()) return { avisar: false, porque: "sem telefone" };
  const retirada = minutosDaParede(p.retiradaData, p.retiradaHora);
  const alvo = quandoAvisar(p);
  if (retirada === null || alvo === null) return { avisar: false, porque: "sem data" };
  // A RETIRADA QUE JÁ PASSOU NÃO SE LEMBRA. Um pedido esquecido em aberto na
  // tabela ia gerar "seu pedido fica pronto hoje às 18:30" três dias depois.
  if (agora >= retirada) return { avisar: false, porque: "a retirada ja passou" };
  if (agora < alvo) return { avisar: false, porque: "ainda nao e hora" };
  // QUEM ACABOU DE COMBINAR NÃO PRECISA SER LEMBRADO.
  //
  // Pedido aprovado às 09:00 pra retirar às 12:00 do mesmo dia: a hora do aviso
  // (02:00, antecipada pras 21:00 da véspera) já passou faz tempo, e sem esta
  // guarda o lembrete sairia no segundo seguinte à aprovação. O cliente acabou
  // de falar com a padaria; ser "lembrado" ali parece robô quebrado.
  const aprovado = p.aprovadoEm ? minutosDaParede(p.aprovadoEm.slice(0, 10), p.aprovadoEm.slice(11)) : null;
  if (aprovado !== null && aprovado > alvo) {
    return { avisar: false, porque: "aprovado depois da hora do aviso" };
  }
  return { avisar: true };
}

/**
 * "hoje, às 18:30" / "amanhã, às 18:30" / "quinta, 10/09, às 18:30".
 *
 * O dia relativo existe porque é assim que gente fala. "Seu pedido fica pronto
 * dia 10/09" faz quem recebe abrir o calendário; "fica pronto amanhã" não.
 */
export function quandoEmPalavras(p: PedidoPraLembrar, agora: number): string {
  const retirada = minutosDaParede(p.retiradaData, p.retiradaHora);
  if (retirada === null) return "";
  const diaDe = (m: number) => Math.floor(m / (24 * 60));
  const dias = diaDe(retirada) - diaDe(agora);
  const d = new Date(retirada * 60000);
  const dataBr =
    String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
  const quando = dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : "dia " + dataBr;
  const hora = String(p.retiradaHora ?? "").trim()
    ? String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0")
    : null;
  return quando + (hora ? ", às " + hora : "");
}

/**
 * O QUE O CLIENTE LÊ.
 *
 * Curto de propósito: é um lembrete, não uma conversa. E não pergunta nada, pra
 * não obrigar ninguém a responder um robô às sete da manhã. Quem quiser falar
 * responde, e aí a conversa segue pelo fluxo de sempre, que já sabe do pedido
 * aprovado.
 *
 * O PRIMEIRO NOME BASTA. O cadastro guarda o nome inteiro quando o cliente diz,
 * e "Oi, Maria Aparecida da Silva!" não é como gente escreve.
 */
export function textoDoLembrete(p: PedidoPraLembrar, agora: number, padaria: string): string {
  const nome = String(p.clienteNome ?? "").trim().split(/\s+/)[0] || "";
  return (
    (nome ? "Oi, " + nome + "! " : "Oi! ") +
    "Passando pra lembrar do seu pedido " + (padaria ? "na " + padaria + " " : "") +
    "que fica pronto " + quandoEmPalavras(p, agora) + ". Qualquer coisa é só me chamar por aqui."
  );
}

/** O agora, em minutos de parede de São Paulo. */
export function agoraEmSaoPaulo(quando = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(quando);
  const p = (t: string) => Number(partes.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(p("year"), p("month") - 1, p("day"), p("hour") % 24, p("minute")) / 60000;
}
