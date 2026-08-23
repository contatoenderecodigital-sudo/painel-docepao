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

/**
 * A RETIRADA E SEMPRE NO FUTURO.
 *
 * Teste do dono em 23/08/2026: ele disse "dia 05 de setembro" e o pedido foi
 * anotado pra 05/09/2024. Um ano e meio no passado, numa padaria que produz sob
 * encomenda: a comanda sairia com uma data que ja passou e ninguem saberia
 * quando assar.
 *
 * O modelo nao tem relogio, entao ele chuta o ano. A instrucao agora diz que dia
 * e hoje, e ESTA FUNCAO CONFERE DEPOIS: prompt pede, codigo garante. Data que
 * caiu pra tras ganha o ano que faz ela cair pra frente.
 *
 * Devolve null pro que nao da pra entender. Null faz a padaria perguntar de
 * novo, que e melhor que anotar uma data inventada.
 */
export function dataDeRetirada(bruto: string | null | undefined, agora = new Date()): string | null {
  const t = String(bruto ?? "").trim();
  if (!t) return null;

  const m = t.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  const hoje = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setHours(0, 0, 0, 0);

  let ano = m[3] ? Number(m[3]) : hoje.getFullYear();
  if (ano < 100) ano += 2000;

  // Ano que caiu pra tras vira o ano que faz a data cair pra frente. Vale tanto
  // pro ano chutado pelo modelo quanto pro dia 05/01 pedido em dezembro.
  let quando = new Date(ano, mes - 1, dia);
  while (quando < hoje) {
    ano += 1;
    quando = new Date(ano, mes - 1, dia);
  }

  // O dia tem que existir: 31 de fevereiro vira 3 de marco em JavaScript, e
  // anotar isso e pior que perguntar de novo.
  if (quando.getDate() !== dia || quando.getMonth() !== mes - 1) return null;

  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return dd + "/" + mm + "/" + ano;
}

/**
 * O TOPO E O PAPEL DE ARROZ SAO ENCOMENDADOS FORA, E ISSO TEM PRAZO.
 *
 * Audio da dona, 29/07/2026:
 *
 *   "Topos de bolo e papel de arroz tem que ser encomendado com DOIS DIAS de
 *   antecedencia, e no maximo ate SEXTA-FEIRA. Caso o cliente peca sabado de
 *   manha e a Dora nao souber responder, a gente investiga pra ver se a pessoa
 *   ainda pega pedido. Porque os topos e papel de arroz nao e nos que fazemos,
 *   a gente encomenda."
 *
 * Entao aqui nao se promete: quando o prazo aperta, quem responde e a equipe.
 * Aceitar sozinha um topo que a fornecedora nao vai fazer e vender o que a
 * padaria nao tem.
 *
 * Devolve o motivo escrito, ou null quando o prazo esta folgado.
 */
export function prazoDoTopoAperta(dataRetirada: string | null, agora = new Date()): string | null {
  const t = String(dataRetirada ?? "").trim();
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;

  const hoje = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setHours(0, 0, 0, 0);
  const quando = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const dias = Math.round((quando.getTime() - hoje.getTime()) / 86400000);

  if (dias < 2) return "topo ou papel de arroz com menos de dois dias de antecedência";

  // Fim de semana: quem fabrica nao pega pedido, e a encomenda so entra na
  // segunda. A dona pediu pra investigar caso a caso em vez de recusar.
  const diaDaSemana = hoje.getDay(); // 0 domingo, 6 sabado
  if (diaDaSemana === 6 || diaDaSemana === 0) {
    return "pedido de topo feito no fim de semana, quando quem fabrica não pega encomenda";
  }
  return null;
}
