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
//  Eram vinte e quatro linhas quando isto foi escrito. Hoje sao 357: o arquivo
//  virou a casa de tudo que o codigo le da fala sem gastar modelo. Copiar
//  continua saindo mais barato que a corda, mas a conta mudou e o comentario
//  dizia o numero de antes.
// ============================================================================

// O mesmo normalizador de todo mundo. Este arquivo tinha DUAS copias dele, a
// segunda escondida dentro do leitor de dia da semana com um `-?feira` a mais.
import { semAcento, afirmouOuNegou, cercaDaPalavra , numerosEscritos } from "../texto";

const semAcMin = semAcento;

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
  // A NEGACAO SAI DO LEITOR UNICO, E NAO DE UMA REGRA PROPRIA DAQUI.
  //
  // A regra daqui exigia a forma exata "(nao|sem) (quero|precisa|vamos)?
  // (reiniciar|recomecar|zerar|apagar)", e por isso deixava passar o jeito mais
  // comum de dizer a mesma coisa. Medido em 28/08/2026:
  //
  //   "nao, nao apaga tudo"  ->  APAGAVA O PEDIDO
  //
  // Porque a lista tem "apagar" e o cliente escreveu "apaga". Apagar o pedido de
  // quem pediu pra NAO apagar e o pior erro que esta funcao pode cometer, e ela
  // mesma diz isso no comentario acima.
  //
  // `afirmouOuNegou` e quem ja responde essa pergunta no sistema inteiro, e sabe
  // "sem", "nao", "nem", "nada de", "tirar" e o sim ou nao que vem DEPOIS.
  const negou = ["reiniciar", "recomecar", "comecar de novo", "do zero", "zerar",
    "apagar tudo", "apaga tudo", "cancelar tudo", "esquece tudo", "esquecer tudo",
    "desconsidera tudo"]
    .some((termo) => afirmouOuNegou(t, cercaDaPalavra(termo)) === false);
  if (negou) return false;
  return true;
}

/**
 * ELE PEDIU GENTE, COM TODAS AS LETRAS.
 *
 * Chamar a equipe e ultimo recurso: entrega, restricao que a cozinha decide,
 * o interruptor FLUXO_NOVO_PARA, e ESTE caso. Nao e o destino de modelo vazio,
 * de etapa repetida, nem de "oi" no chat de teste.
 *
 * Nao e lista de produto: e um ato de fala, o mesmo tipo de recomecar. A
 * regex descreve o pedido de pessoa, nao um catalogo paralelo.
 */
export function pediuPraFalarComGente(fala: string): boolean {
  const t = semAcMin(fala);
  if (!t.trim()) return false;
  const pediu =
    /falar com (a |o )?(dona|equipe|atendente|gente|alguem|uma pessoa)|chama[r]? (a |o )?(dona|equipe|atendente)|quero (um |uma )?(atendente|humano)|passar pra (dona|equipe|atendente)/;
  if (!pediu.test(t)) return false;
  // A cerca de palavra inteira engolia a virgula e lia o "quero 50 coxinha"
  // que vinha DEPOIS como um sim pra falar com a dona. O termo curto e o
  // mesmo leitor de sim/nao do resto do sistema.
  if (afirmouOuNegou(t, /falar com|chama[r]? (a |o )?(dona|equipe|atendente)/) === false) {
    return false;
  }
  return true;
}

/**
 * COMO A GENTE CUMPRIMENTA, NUMA LISTA SO.
 *
 * Havia duas, uma em cada funcao, e elas ja discordavam: "como vai" era
 * cumprimento pra quem TIRA e nao era pra quem POE. Medido em 28/08/2026:
 *
 *   cliente >> Como vai, quero coxinha
 *   padaria >> Boa tarde, tudo bem? Como vai, quero coxinha
 *
 * Dois cumprimentos na mesma frase, que e exatamente o tique de robo que a
 * regra do dono manda evitar.
 */
const CUMPRIMENTOS = ["bom dia", "boa tarde", "boa noite", "ola", "oi", "opa"];
/** Exportada porque a reescrita da fala tambem precisa saber o que e saudacao. */
export const COMO_VAI = ["tudo bem", "tudo bom", "como vai"];

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

  // SO CONTA NO COMECO, e o comentario sempre prometeu isso sem cumprir.
  //
  // A regra antiga procurava "boa tarde" em qualquer lugar dos 40 primeiros
  // caracteres, entao:
  //
  //   "retirar boa tarde nao, as 14h"  ->  a padaria nao cumprimentava
  //
  // O cliente falava de horario e ficava sem o bom dia que a regra do dono
  // manda dar. Ancorar no comeco e o que o proprio comentario dizia: "boa
  // tarde" no meio de uma frase sobre retirada nao e cumprimento.
  const comeco = semAcMin(t);
  const jaCumprimentou = [...CUMPRIMENTOS, ...COMO_VAI].some((c) => comeco.startsWith(c));
  if (jaCumprimentou) return t;

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
  const tira = (texto: string, quais: string[]) => {
    const semAc = semAcMin(texto);
    const achou = quais.find((c) => semAc.startsWith(c));
    if (!achou) return texto;
    return texto.slice(achou.length).replace(/^[\s,!.?]*/, "");
  };
  const limpo = tira(tira(t, CUMPRIMENTOS), COMO_VAI).trim();

  if (!limpo) return t; // era so cumprimento: melhor repetir que mandar vazio
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/**
 * SEM EMOJI E SEM TRAVESSAO, NUNCA.
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
    // A IA pode usar estes dois sinais mesmo sem eles existirem no texto do
    // codigo. A regra da casa e virgula ou ponto, nunca travessao.
    .replace(/[\u2013\u2014]/g, ",")
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
 * O NOME DO DIA DA SEMANA VIRA A PROXIMA DATA COM ESSE NOME.
 *
 * Resolve sempre no futuro. "Quarta" dita numa quarta e a quarta que vem: a
 * padaria nao produz encomenda pro mesmo dia sem o cliente pedir.
 *
 * Devolve null quando a frase nao cita dia nenhum, e null aqui e certo: quem
 * decide o que fazer com isso e `dataDeRetirada`.
 */
function diaDaSemanaViraData(texto: string, agora: Date): string | null {
  const NOMES: Record<string, number> = {
    domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
  };
  const limpo = semAcMin(texto).replace(/-?feira/g, " ").trim();
  // Fronteira escrita com classe de caracter, e nao com o limite de palavra:
  // o shell come a barra invertida e a regra para de casar sem dar erro.
  const alvo = Object.keys(NOMES).find((d) =>
    new RegExp("(^|[^a-z0-9])" + d + "([^a-z0-9]|$)").test(limpo),
  );
  if (!alvo) return null;

  const hoje = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let passos = (NOMES[alvo] - hoje.getDay() + 7) % 7;
  if (passos === 0) passos = 7;
  hoje.setDate(hoje.getDate() + passos);

  const dd = String(hoje.getDate()).padStart(2, "0");
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm + "/" + hoje.getFullYear();
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
/**
 * "DIA 12" E UMA DATA, E QUALQUER PESSOA ENTENDE QUAL.
 *
 * Do pedido de festa de 30/08/2026:
 *
 *   padaria >> Para que dia você quer buscar?
 *   cliente >> dia 12
 *   padaria >> Para que dia você quer buscar?     (a MESMA frase, de novo)
 *   cliente >> 12 do mes que vem
 *
 * O leitor exigia dia E mes ("12/09") ou nome de dia da semana. "dia 12" caia
 * fora dos dois e voltava null, entao a padaria repetiu a pergunta palavra por
 * palavra, sem dizer o que faltava. Quem le a mesma pergunta duas vezes acha
 * que esta falando com robo quebrado, e ele estava.
 *
 * O dia 12 seguinte nao e ambiguo pra ninguem: e este mes se ainda nao passou,
 * e o mes que vem se passou. Sempre pra frente, que e a mesma regra do dia da
 * semana logo abaixo.
 *
 * SO ONDE O ASSUNTO JA E DATA. Isto roda no campo `data` da leitura, ou seja,
 * o modelo ja classificou a frase como data. Um numero solto no meio de uma
 * conversa de quantidade nao chega aqui.
 */
function soODiaViraData(texto: string, agora: Date): string | null {
  const t = String(texto ?? "").trim().toLowerCase();
  // Hora nao e data: "as 18" e "18h" falam de horario, e o campo errado ja
  // custou pedido neste projeto.
  if (/\d\s*(h|hs|horas?|:)/.test(t)) return null;
  const m = t.match(/(?:^|\bdia\s+|\bno\s+dia\s+|\bpro\s+dia\s+)(\d{1,2})(?!\s*\d)(?![/\-.:])/);
  if (!m) return null;
  const dia = Number(m[1]);
  if (dia < 1 || dia > 31) return null;

  const hoje = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setHours(0, 0, 0, 0);

  // Este mes se ainda nao passou, senao o proximo em que o dia exista: quem
  // pede dia 31 em fevereiro esta falando de marco.
  for (let salto = 0; salto <= 12; salto++) {
    const quando = new Date(hoje.getFullYear(), hoje.getMonth() + salto, dia);
    if (quando.getDate() !== dia) continue;
    if (quando < hoje) continue;
    return (
      String(dia).padStart(2, "0") + "/" +
      String(quando.getMonth() + 1).padStart(2, "0") + "/" +
      quando.getFullYear()
    );
  }
  return null;
}

export function dataDeRetirada(bruto: string | null | undefined, agora = new Date()): string | null {
  const t = String(bruto ?? "").trim();
  if (!t) return null;

  // "SEXTA" E "SABADO QUE VEM" E COMO SE MARCA ENCOMENDA NUMA PADARIA.
  //
  // Exigir 12/09 de quem fala assim transforma a atendente em formulario, que e
  // exatamente o que a persona proibe.
  //
  // Isto existia no cerebro antigo e o fluxo nao tinha. Achado em 26/08/2026,
  // no levantamento feito antes de apagar o antigo: quem escrevia "quero pra
  // quarta-feira" recebia null, e a padaria perguntava a data de novo, de
  // alguem que ja tinha respondido.
  //
  // Sempre pra frente: quem diz sexta numa sexta quer a sexta que vem, e marcar
  // pra hoje sem ele pedir e erro que a cozinha paga.
  //
  // MAS O NUMERO GANHA DO NOME, SEMPRE.
  //
  // "quarta-feira, dia 27/08" tem os dois, e e assim que gente escreve. Eu
  // tinha posto o nome na frente e o 27/08 era ignorado: a padaria anotava a
  // proxima quarta em vez do dia que o cliente escreveu. Quebrou o
  // `qa-pedido-completo` na hora, antes de chegar em qualquer cliente.
  //
  // O nome so vale quando numero nao ha.
  const m = t.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (!m) return soODiaViraData(t, agora) ?? diaDaSemanaViraData(t, agora);

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

/**
 * ELE DISSE UMA QUANTIDADE NESTA MENSAGEM?
 *
 * Serve pra decidir de quem e o numero do item: dele, ou da proposta que ele
 * aceitou. Quando ele nao diz numero, a quantidade vem da proposta; quando ele
 * diz, a dele manda.
 *
 * POR QUE NAO BASTA PROCURAR DIGITO
 *
 * Pergunta do dono, 23/08/2026: "vc corrigiu pra agora funcionar ou pra todos os
 * casos, pq cada cliente eh de um jeito ne mano". Ele estava certo: procurando
 * so digito, "quero cinquenta coxinhas" virava 200 coxinhas, porque o codigo
 * achava que ele nao tinha dito numero e jogava a proposta por cima.
 *
 * Meia padaria escreve por extenso, e "cento", "duzia" e "meio cento" sao
 * numero tanto quanto 100.
 *
 * "UM" E "UMA" FICAM DE FORA, DE PROPOSITO
 *
 * Sao palavra de conversa antes de serem numero: "quero um bolo de morango"
 * numa festa de 20 pessoas nao quer dizer 1 quilo, quer dizer o bolo da
 * proposta. Ninguem encomenda uma coxinha pra festa.
 */
export function disseQuantidade(fala: string): boolean {
  const t = semAcMin(fala);
  if (/[0-9]/.test(t)) return true;

  // SEM BARRA INVERTIDA NENHUMA NESTA REGRA, DE PROPOSITO.
  //
  // A primeira versao usava a borda de palavra do regex e ela virou byte de
  // backspace no caminho ate o arquivo: a regra nunca casava e "quero cinquenta
  // coxinhas" continuava virando 200 coxinhas. Ja aconteceu antes neste projeto,
  // e custou horas nas duas vezes.
  //
  // Aqui as palavras sao separadas na mao: qualquer coisa que nao seja letra
  // conta como fronteira, e assim "cem" casa em "cem coxinhas" e nao casa em
  // "centopeia".
  const palavras = t.split(/[^a-z]+/);
  // SEM o "um/uma", de proposito: como pergunta solta, "uma" apareceria em
  // quase toda frase e faria o rateio da festa achar que ele deu a quantidade.
  // A lista mora no `texto.ts`, junto com quem tambem precisa dela.
  const numeros = new Set(numerosEscritos({ umEUma: false }).map(([palavra]) => palavra));
  return palavras.some((p) => numeros.has(p));
}


/**
 * ELE ACEITOU O VALOR QUE A EQUIPE LANCOU?
 *
 * Teste do dono, 23/08/2026: a equipe lancou o valor do topo, a Dora mandou o
 * total novo, ele respondeu "sim", e o pedido NAO foi pra fila de aprovacao. Ele
 * teve que aprovar na mao. A Dora ainda respondeu "pronto, seu pedido foi pra
 * fila" tres vezes, que era mentira: ele continuava esperando.
 *
 * ISTO NAO PASSA PELO MODELO, DE PROPOSITO
 *
 * E resposta a uma pergunta de dinheiro, com duas saidas conhecidas, e o preco
 * de errar e alto dos dois lados: um "sim" perdido deixa o pedido no limbo, e
 * um "nao" lido como sim manda pra producao um valor que o cliente recusou.
 *
 * Na duvida devolve null, e ai a padaria pergunta de novo em vez de decidir por
 * ele.
 */
export function respostaAoValor(fala: string): "aceitou" | "recusou" | null {
  const t = semAcMin(fala).trim();
  if (!t) return null;

  const RECUSA = ["nao", "nao quero", "nao da", "nao vai dar", "muito caro", "caro demais",
    "deixa", "deixa pra la", "desisti", "cancela", "nem", "ta caro", "esquece"];
  const ACEITE = ["sim", "isso", "pode ser", "pode", "ok", "okay", "beleza", "fechado",
    "fechou", "combinado", "aceito", "ta bom", "tudo bem", "perfeito", "certo",
    "confirma", "manda", "bora", "show", "otimo", "maravilha"];

  // GANHA QUEM VEM PRIMEIRO NA FRASE, E COM PALAVRA INTEIRA.
  //
  // O comentario antigo dizia "quem diz nao PRIMEIRO esta recusando", e o codigo
  // fazia outra coisa: testava a recusa inteira antes, entao "nao" em qualquer
  // lugar ganhava. Medido em 28/08/2026:
  //
  //   "sim, mas nao esquece do topo"  ->  RECUSOU
  //
  // O cliente aceitou o valor e o pedido ficava no limbo, que e o defeito que
  // esta funcao existe pra impedir -- esta escrito no comentario dela.
  //
  // E sem fronteira de palavra "certo" casava dentro de "incerto":
  //
  //   "incerto ainda"  ->  ACEITOU
  //
  // Alguem em duvida aprovando um valor. Agora cada palavra e procurada inteira,
  // e vence a que aparecer antes.
  const ondeEsta = (quais: string[]) => {
    let melhor = -1;
    for (const p of quais) {
      const m = cercaDaPalavra(p).exec(t);
      if (!m) continue;
      // O casamento inclui a letra da fronteira: o comeco da palavra e um a mais.
      const onde = m.index + (m[1] ? m[1].length : 0);
      if (melhor < 0 || onde < melhor) melhor = onde;
    }
    return melhor;
  };

  const naoQuer = ondeEsta(RECUSA);
  const quer = ondeEsta(ACEITE);
  if (naoQuer < 0 && quer < 0) return null;
  if (naoQuer < 0) return "aceitou";
  if (quer < 0) return "recusou";
  return naoQuer <= quer ? "recusou" : "aceitou";
}
