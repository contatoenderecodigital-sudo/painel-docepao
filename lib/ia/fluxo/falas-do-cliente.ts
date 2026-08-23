// ============================================================================
//  O QUE O CLIENTE FALOU, LIDO SEM MODELO
//
//  Duas coisas que nao precisam de IA nenhuma pra entender, e que por isso
//  moram aqui: sao regra, nao interpretacao.
//
//  POR QUE ESTAO NESTE ARQUIVO, E NAO NO ANTIGO
//
//  As duas ja existiam em `guardas.ts`, que tem 1.956 linhas. O fluxo novo
//  importava de la, e isso amarrava o novo no velho: enquanto essa corda
//  existir, apagar o antigo quebra o novo.
//
//  Sao vinte e quatro linhas. Copiar sai mais barato que a corda.
// ============================================================================

const semAcMin = (t: string) =>
  String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * QUEM MANDA RECOMECAR, RECOMECA.
 *
 * Teste do dono no celular dele, 23/08/2026:
 *
 *   cliente: vamos reiniciar nossa conversa. ok?
 *   Dora:    Fechou, Suelen, ja anotei seu nome, data, hora e o pix.
 *
 * Ela disse "fechou" e nao reiniciou nada, porque nao havia o que reiniciar: o
 * pedido em montagem guarda os dados de proposito e nao tinha porta de saida.
 *
 * Sai daqui sem passar pelo modelo. Apagar o pedido de alguem nao e decisao de
 * redacao, e a volta pelo modelo so acrescentaria a chance de ele responder
 * "fechou" sem apagar — que foi exatamente o que aconteceu. De quebra,
 * recomecar deixa de custar dinheiro.
 */
export function mandouRecomecar(fala: string): boolean {
  const t = semAcMin(fala);
  if (!t.trim()) return false;
  const recomecar =
    /(reiniciar|recomecar|comecar de novo|do zero|comeca de novo|zerar|apagar tudo|cancelar tudo|esquece tudo|esquecer tudo|apaga tudo|desconsidera tudo)/;
  if (!recomecar.test(t)) return false;
  // "nao quero recomecar" e o contrario: quem escreve isso esta pedindo pra NAO
  // apagar, e apagar por engano e pior que nao apagar.
  if (/(nao |sem )(quero |precisa |vamos )?(reiniciar|recomecar|zerar|apagar)/.test(t)) return false;
  return true;
}

/**
 * QUEM ATENDE CUMPRIMENTA PRIMEIRO.
 *
 * Regra do dono, 23/08/2026: "nem boa noite ela me deu, que e o basico de todo
 * atendimento; a primeira fala dela vai ser dizendo bom dia, tarde ou noite e
 * tudo bem".
 *
 * Ele mandou um "Boa noite" e recebeu "Quantas pessoas vao na festa?".
 *
 * A saudacao segue o RELOGIO, nao a palavra do cliente: quem manda "bom dia" as
 * duas da tarde recebe "boa tarde", que e o certo. E nao se cumprimenta duas
 * vezes: se o texto ja comeca com saudacao, fica como esta.
 */
export function comCumprimento(texto: string, agora: Date): string {
  const t = String(texto ?? "").trim();
  if (!t) return t;

  // Ja cumprimentou? Olha so o comeco: "boa tarde" no meio de uma frase sobre
  // horario de retirada nao e cumprimento.
  const comeco = semAcMin(t).slice(0, 40);
  if (/(bom dia|boa tarde|boa noite|^ola|^oi|^opa|tudo bem|tudo bom)/.test(comeco)) return t;

  return saudacaoDaHora(agora) + ", tudo bem? " + t;
}

/** Bom dia, boa tarde ou boa noite, pelo relogio da padaria (Sao Paulo). */
export function saudacaoDaHora(agora = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(agora),
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
