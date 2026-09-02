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

import { abertaNoInstante } from "../padaria-aberta";

/**
 * QUANTAS HORAS ANTES DA RETIRADA O CLIENTE É LEMBRADO.
 *
 * Começou em 10, que foi o primeiro número dele, e virou 24 na mesma tarde de
 * 02/09/2026, quando ele perguntou: *"não é melhor então 24 horas antes? nos
 * horários de funcionamento da padaria?"*.
 *
 * É melhor, e por duas razões que o de 10 não tinha:
 *
 *   1. DEZ HORAS ANTES É O MESMO DIA. Pra uma retirada às 18:30, o aviso saía
 *      às 08:30 daquela manhã. Quem quer mudar a hora, ou avisar que não vai
 *      poder buscar, descobre com o bolo já na produção. Vinte e quatro horas
 *      dão um dia inteiro pros dois lados.
 *   2. VINTE E QUATRO HORAS CAI NA MESMA HORA DO DIA. Retirada às 18:30 avisa
 *      às 18:30 da véspera, que é horário de padaria por construção. O aviso de
 *      dez horas caía na madrugada sozinho (retirada às 13:00 avisava às 03:00)
 *      e precisava de uma regra de silêncio só pra consertar isso.
 */
export const HORAS_ANTES = 24;

/**
 * O PEDIDO QUE ACABOU DE SER COMBINADO NÃO PRECISA DE LEMBRETE.
 *
 * Quem encomenda pra daqui a dezoito horas passou da hora do aviso antes mesmo
 * de a equipe aprovar. Sem folga, o lembrete sairia no segundo seguinte à
 * aprovação, e o cliente acabou de falar com a padaria: ser "lembrado" ali
 * parece robô quebrado.
 *
 * Três horas, e não "não avisa nunca": a encomenda da tarde pra manhã seguinte
 * merece o aviso da noite, e é a que mais precisa dele.
 */
export const FOLGA_DEPOIS_DE_APROVAR = 3;

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

/**
 * A PARTIR DE QUANDO ESTE PEDIDO PODE SER LEMBRADO, em minutos de parede.
 *
 * É o instante da retirada menos as vinte e quatro horas, e mais nada: quem
 * decide se dá pra escrever AGORA é o expediente da padaria, logo abaixo. Não
 * antecipar nem adiar aqui é o que deixa esta conta ser uma subtração, em vez
 * de uma regra de calendário que ninguém consegue conferir de cabeça.
 */
export function quandoAvisar(p: PedidoPraLembrar): number | null {
  const retirada = minutosDaParede(p.retiradaData, p.retiradaHora);
  if (retirada === null) return null;
  return retirada - HORAS_ANTES * 60;
}

export type PorQueNao =
  | "sem data"
  | "sem telefone"
  | "ja avisado"
  | "ainda nao e hora"
  | "a retirada ja passou"
  | "a padaria esta fechada agora"
  | "combinado agora ha pouco";

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
  // A PADARIA SÓ ESCREVE COM ALGUÉM LÁ DENTRO.
  //
  // Pedido dele em 02/09/2026: *"nos horários de funcionamento da padaria?"*. E
  // o motivo não é só não acordar ninguém: o lembrete convida a responder ("é
  // hoje mesmo?", "dá pra buscar mais tarde?"), e responder pro vazio é pior que
  // não ter recebido. Com a padaria aberta, tem gente pra atender.
  //
  // O HORÁRIO SAI DE `padaria-aberta.ts`, que é o mesmo que a Dora fala pro
  // cliente e o mesmo que barra retirada fora do expediente. Uma segunda lista
  // aqui viraria duas verdades sobre a mesma coisa, que é o defeito que mais se
  // repetiu neste sistema.
  if (!abertaNoInstante(agora)) return { avisar: false, porque: "a padaria esta fechada agora" };
  const aprovado = p.aprovadoEm ? minutosDaParede(p.aprovadoEm.slice(0, 10), p.aprovadoEm.slice(11)) : null;
  if (aprovado !== null && agora - aprovado < FOLGA_DEPOIS_DE_APROVAR * 60) {
    return { avisar: false, porque: "combinado agora ha pouco" };
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

// O "agora" e o expediente moram em `padaria-aberta.ts`, que já era a fonte
// única do horário da casa. Reexportados aqui só pra quem usa o lembrete não
// precisar importar de dois lugares.
export { instanteDeParede } from "../padaria-aberta";
