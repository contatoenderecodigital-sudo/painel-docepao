// ============================================================================
//  O TEXTO REDUZIDO AO JEITO QUE O SISTEMA COMPARA.
//
//  Sem acento, minusculo, aparado. Uma linha de codigo, e mesmo assim ela
//  estava escrita DEZESSEIS vezes espalhadas pelo cerebro. Contadas em
//  28/08/2026:
//
//      lib/ia/fluxo/fluxo.ts        7
//      lib/ia/fluxo/leitura.ts      4
//      e mais dez arquivos          1 cada
//
//  Copia nao fica igual. Elas ja divergiam:
//
//      duas nao chamavam .trim()          -> nome com espaco atras nao casava
//      uma usava ?? "" e as outras || ""  -> zero e falso viravam coisas
//                                            diferentes
//      uma trocava a ordem do toLowerCase
//
//  E o mesmo defeito do `ESPERA_MS` do webhook, que tinha 12 segundos num lugar
//  e 10 no outro. Valor decidido em mais de um lugar so fica igual enquanto
//  ninguem mexe.
//
//  A FAIXA DE ACENTOS VAI EM ESCAPE, E NAO NOS CARACTERES LITERAIS.
//
//  Os quinze lugares antigos escreviam os combinantes U+0300 a U+036F com os
//  proprios caracteres dentro da expressao. Funciona, e foi conferido nos
//  bytes. Mas sao caracteres invisiveis num editor, e qualquer ferramenta que
//  reescreva o arquivo noutra codificacao apaga a defesa sem deixar rastro.
// ============================================================================

/** Sem acento, minusculo e aparado. */
export const semAcento = (t: string) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * O termo apareceu na frase, e ele estava afirmando ou negando?
 *
 * Olha o pedaço da frase ANTES do termo, curto de propósito: um "sem" lá no
 * começo não pode negar uma coisa citada no fim.
 *
 * EXPORTADA EM 27/08/2026 porque o fluxo precisava da mesma pergunta, e MUDADA
 * PRA CA em 28/08/2026, quando a terceira precisou (a trava do sabor em
 * aberto). Ela morava no leitor da frase, e o leitor da frase importa do
 * `sabor.ts`: a terceira usuaria fechava um ciclo de import entre os dois.
 *
 * Ciclo de import nao quebra hoje porque as duas so se chamam DENTRO de funcao.
 * Quebra no dia em que alguem chamar no topo do modulo, e ai o erro e
 * `undefined is not a function` em producao, longe daqui.
 *
 * Lá o sabor solto era grudado no item que estava esperando sabor, e a checagem
 * era só "a palavra está na frase?". Quem dissesse "sem calabresa" ganhava
 * calabresa na comanda: a palavra estava lá, e ninguém olhava o "sem" na frente
 * dela.
 *
 * Escrever uma segunda negação lá seria repetir o erro que este projeto mais
 * cometeu: duas listas do mesmo assunto, que nascem iguais e divergem depois.
 */
export function afirmouOuNegou(t: string, termo: RegExp): boolean | null {
  const m = termo.exec(t);
  if (m == null) return null;

  // O SIM E O NAO TAMBEM VEM DEPOIS DA PALAVRA.
  //
  // "papel nao" e "topo sim" e como gente responde uma pergunta que juntou
  // varias, e isso nao era lido: o leitor olhava so o que vinha ANTES.
  //
  // Medido em 26/08/2026, e o erro era do tipo que cobra do cliente:
  //
  //     "quero topo sim, papel nao, prato aberto"  ->  papel = SIM
  //
  // O "quero" de trinta caracteres atras valia pro papel, e o "nao" colado nele
  // era ignorado. Sao R$ 12 cobrados de quem recusou com todas as letras.
  //
  // O depois GANHA do antes, porque esta mais perto e e mais explicito.
  const fim = m.index + m[0].length;
  const depois = t.slice(fim, fim + 14);
  if (/^ *(nao|nem|nenhum)([^a-z]|$)/.test(depois)) return false;
  if (/^ *(sim|pode|quero)([^a-z]|$)/.test(depois)) return true;

  const antes = t.slice(Math.max(0, m.index - 22), m.index);
  // TIRAR TAMBEM E NEGAR, e isto veio da outra implementacao.
  //
  // O motor de orcamento tinha a SUA propria leitura de negacao, com a sua
  // propria lista, e as duas discordavam em quatro de nove frases medidas em
  // 28/08/2026. Tres discordancias cobravam R$ 12 de quem tinha recusado:
  //
  //   "nao quero papel de arroz"      o motor cobrava
  //   "topo sim, papel de arroz nao"  o motor cobrava
  //   "papel de arroz nao"            o motor cobrava
  //
  // E uma ia pro outro lado: "tirar o papel de arroz" o motor entendia e esta
  // aqui nao. Juntar as duas listas numa so e o conserto: cada uma sabia uma
  // parte do portugues que a outra nao sabia.
  if (/(^|[^a-z])(sem|nao|nem|nada de|tirar?( o| a)?|retirar?( o| a)?)([^a-z][^.,;]*)?$/.test(antes)) return false;
  if (/(^|[^a-z])(com|quero|vai com|pode por|poe|bota|sim|so o|so a|apenas o|apenas a)([^a-z][^.,;]*)?$/.test(antes)) return true;
  return null;
}


/**
 * A CERCA DE UMA PALAVRA INTEIRA, pronta pra `afirmouOuNegou`.
 *
 * "carne" nao pode casar dentro de "carnes" nem de "descarnado", e o termo vem
 * do cardapio, entao pode ter ponto, parentese ou porcento dentro ("frutas
 * (pessego e abacaxi)", "0% lactose"). Escapar e obrigatorio.
 *
 * Estava escrita duas vezes, no `fluxo.ts` e no `sabor.ts`, e a segunda copia
 * nasceu com UMA BARRA no lugar de duas: `"\$&"` em vez de `"\\$&"`. Em
 * JavaScript `"\$"` nao e escape valido e a barra some, entao a copia escapava
 * NADA. Pegou pelo olho, comparando com a que funciona.
 */
export const cercaDaPalavra = (termo: string) =>
  new RegExp("(^|[^a-z])(" + termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")($|[^a-z])", "i");

/** Sem o artigo na frente: "um bolo" e "bolo". */
export const semArtigo = (t: string) =>
  semAcento(t).replace(/^(uns |umas |um |uma |os |as |o |a )+/, "");

/**
 * OS JEITOS EM QUE O CLIENTE PODE TER ESCRITO ESTA PALAVRA.
 *
 * Devolve as formas, da mais fiel a mais reduzida, e quem chama tenta todas.
 *
 *   "uns salgadinhos"  ->  salgadinhos, salgadinho, salgado
 *   "paes"             ->  paes, pao
 *   "bolos"            ->  bolos, bolo
 *
 * TRES TRANSFORMACOES DO PORTUGUES, E NENHUMA DELAS E LISTA DE PALAVRA: artigo,
 * plural (com -aes/-oes/-aos) e diminutivo.
 *
 * POR QUE LISTA DE FORMAS, E NAO UMA REDUCAO SO
 *
 * A primeira versao devolvia UMA string, a mais reduzida. E o diminutivo comia
 * palavra de verdade, porque meia padaria se chama no diminutivo:
 *
 *   "docinho"  ->  "doco"
 *   "coxinha"  ->  "coxa"
 *   "beijinho" ->  "beijo"
 *
 * Funcionava enquanto os DOIS lados passassem pela mesma reducao, e escondia o
 * estrago. Quebrou na hora em que um lado era uma expressao fixa: a recusa da
 * familia comparava "doco" com "docinho|doce" e o cliente que dizia "nao quero
 * docinho" continuava sendo perguntado.
 *
 * Com a lista, a forma fiel vem primeiro e a reducao so entra se a fiel nao
 * achou nada. Nenhuma palavra e destruida no caminho.
 */
export function formasDoCliente(t: string): string[] {
  const fiel = semArtigo(t);
  const semPlural = fiel.replace(/(aes|oes|aos)\b/g, "ao").replace(/s\b/g, "");
  const semDiminutivo = semPlural.replace(/inh([oa])\b/g, "$1");
  return [...new Set([semAcento(t), fiel, semPlural, semDiminutivo])].filter(Boolean);
}

/**
 * A forma mais reduzida, pra quando quem chama precisa de UMA chave.
 *
 * Prefira `formasDoCliente`: esta aqui destroi palavra que nasce no diminutivo
 * ("docinho" vira "doco"), e so serve quando os dois lados da comparacao passam
 * por ela.
 */
export const comoOCardapioEscreve = (t: string) => formasDoCliente(t).slice(-1)[0] ?? "";


