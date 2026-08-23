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

/**
 * SO SE CUMPRIMENTA UMA VEZ.
 *
 * Print do dono, 23/08/2026, quatro mensagens seguidas:
 *
 *   cliente: Boa noite, tudo bem?   Dora: Boa noite, tudo bem? Como posso ajudar?
 *   cliente: vcs fazem bolo?        Dora: Boa noite, tudo bem? O que voce gostaria?
 *   cliente: vcs fazem bolo?        Dora: Boa noite, tudo bem? Qual bolo voce quer?
 *
 * Cumprimentar e educacao na primeira fala e tique de robo da segunda em
 * diante. Ninguem diz "boa noite" tres vezes pra mesma pessoa em dois minutos.
 *
 * Entao a partir da segunda resposta o cumprimento sai fora, venha ele do
 * codigo ou da reescrita.
 */
export function tirarCumprimento(texto: string): string {
  const t = String(texto ?? "").trim();
  if (!t) return t;

  // Come o cumprimento e o "tudo bem?" que vier grudado nele, uma vez so e so
  // no comeco: "boa tarde" falando de horario de retirada continua inteiro.
  const limpo = t
    .replace(/^(bom dia|boa tarde|boa noite|ola|oi|opa)[\s,!.]*/i, "")
    .replace(/^(tudo bem|tudo bom|como vai)[\s,!.?]*/i, "")
    .trim();

  if (!limpo) return t; // era so cumprimento: melhor repetir que mandar vazio
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/**
 * SEM EMOJI, NUNCA.
 *
 * Regra do dono desde o primeiro dia, e mesmo assim escapou um "🙂" no print de
 * 23/08/2026: a instrucao "sem emoji" estava no prompt da reescrita, e prompt
 * pede, nao garante. O que garante e isto aqui, que roda depois e nao pergunta.
 *
 * Passa em TUDO que sai pro cliente, inclusive no texto que o proprio codigo
 * escreveu: assim nenhum caminho novo precisa lembrar da regra.
 */
export function semEmoji(texto: string): string {
  return String(texto ?? "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[️⃣]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .trim();
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
