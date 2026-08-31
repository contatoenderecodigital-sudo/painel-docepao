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

/**
 * SO TIRA O ACENTO, E PRESERVA MAIUSCULA E ESPACO.
 *
 * Existe porque o cupom da cozinha precisa disso: a impressora termica engasga
 * com acento (sai caractere trocado no meio da palavra), mas o papel e lido por
 * gente e o nome do cliente vai em maiuscula. Baixar a caixa ali estragaria o
 * papel.
 *
 * Era a decima copia do normalizador, la no `cupom-escpos.ts`, e com o MESMO
 * NOME da funcao de comparar. Nome igual e comportamento diferente e a
 * armadilha que ja apareceu no motor de preco: quem le acha que conhece.
 */
export const tiraAcento = (t: string) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Sem acento, minusculo e aparado. E o que se usa pra COMPARAR. */
export const semAcento = (t: string) => tiraAcento(String(t || "")).toLowerCase().trim();

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

/** Sem o artigo na frente: "um bolo" e "bolo". Usado por `formasDoCliente`. */
const semArtigo = (t: string) =>
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

// AQUI FICAVA `comoOCardapioEscreve`, EXPORTADA E SEM NENHUM CHAMADOR.
//
// Ela devolvia a forma MAIS REDUZIDA de uma palavra, e foi a primeira tentativa
// de entender "salgadinho". Deu errado do jeito que esta escrito no
// `formasDoCliente` logo acima: a reducao de diminutivo destroi palavra que
// nasce no diminutivo, e "docinho" virava "doco".
//
// Foi substituida pela lista de formas, e ficou exportada. Deixar de pe uma
// funcao que destroi palavra e um convite pra alguem usar ela sem saber disso.
//
// Achada lendo este arquivo em 28/08/2026, que eu mesmo escrevi nesta sessao e
// nunca tinha relido.
//
// O DETECTOR DE CODIGO FANTASMA NAO PEGOU, e o motivo virou conserto la:
// a linha de `import` contava como USO. `semArtigo` estava importada no
// `leitura.ts` sem ser chamada em lugar nenhum do corpo, e passava.



/**
 * O RECADO DE QUE CHEGOU UMA FOTO, E QUEM O ENTENDE.
 *
 * Quando o cliente manda uma imagem, o texto que vai pro cerebro ganha este
 * recado, e o cerebro usa ele pra decidir que o TEMA da peca veio pela foto
 * ("quem manda a foto do Homem Aranha ja disse o tema, e insistir depois da
 * foto e o tipo de coisa que faz o cliente achar que ninguem olhou").
 *
 * ESTAVA ESCRITO A MAO EM DOIS LUGARES, E O CEREBRO PROCURAVA POR UM TERCEIRO.
 *
 * O webhook escrevia a frase, a tela de teste escrevia a MESMA frase de novo, e
 * o `fluxo.ts` procurava por uma expressao que casava com as duas. Tres copias
 * da mesma combinacao: bastava alguem mexer numa pra as outras pararem de se
 * entender, sem erro nenhum aparecer.
 *
 * Pior: na tela de teste o recado era injetado no HISTORICO, e o cerebro le o
 * TEXTO. Entao o recado nunca chegava, e a tela de teste deixava de exercitar
 * justamente o caminho da foto. O arquivo dela diz, com todas as letras: "uma
 * tela de teste que testa outra coisa e pior do que nao ter tela de teste".
 *
 * Achado na leitura do `app/`, 28/08/2026.
 */
export const RECADO_DE_FOTO = "[o cliente enviou uma foto de referência para o pedido]";

/** O texto do cliente com o recado da foto grudado, do jeito que o cerebro le. */
export function comORecadoDaFoto(texto: string): string {
  const t = String(texto ?? "").trim();
  return t ? t + "\n" + RECADO_DE_FOTO : RECADO_DE_FOTO;
}

/**
 * Este texto avisa que veio foto?
 *
 * Aceita as formas antigas de proposito: conversa gravada ontem, e mensagem que
 * ja esta no banco, continua sendo entendida.
 */
export function falaDeFotoRecebida(texto: unknown): boolean {
  return /foto de refer|enviou uma foto|\[imagem\]/i.test(String(texto ?? ""));
}

/**
 * PALAVRAS QUE NAO APONTAM PRODUTO NENHUM: artigo, preposicao, e o verbo de
 * tirar. Sem excluir elas, "a" e "de" casariam com qualquer coisa.
 *
 * MORA AQUI, e nao no fluxo, porque dois lugares precisam da mesma lista e por
 * motivos diferentes:
 *
 *   - o fluxo, pra saber qual linha do pedido o cliente apontou;
 *   - o leitor da frase, pra saber que "de 30" e preposicao mais numero, e
 *     nao nome de produto.
 *
 * O segundo custou caro em 30/08/2026: "de 30" e apelido da pizza redonda no
 * cardapio (ela e a de 30 cm), e o leitor cacava esse apelido dentro de frase
 * livre. Quem escrevia "orcamento pra festa de aniversario de 30 pessoas"
 * recebia o PRECO DA PIZZA de volta, com o cardapio de pizza junto.
 *
 * Sao curtas de proposito, e por isso o corte nunca pode ser por tamanho:
 * "uva" tem tres letras e e sabor de trufa.
 */
export const PALAVRAS_VAZIAS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "com", "sem", "e", "ou", "que", "quero", "queria", "tira", "tirar", "tire", "tirando",
  "pode", "por", "favor", "na", "no", "nas", "nos", "pra", "para", "ai", "la",
  "essa", "esse", "aquela", "aquele", "aquilo", "isso", "ja", "nao", "mais",
]);

/**
 * NUMERO ESCRITO POR EXTENSO, e o valor de cada um.
 *
 * MORA AQUI PORQUE DOIS LUGARES PRECISAM DELA, e ate 30/08/2026 eram duas
 * listas em dois arquivos, que e o padrao que este projeto ja pagou caro varias
 * vezes: elas nao nascem diferentes, elas divergem depois, caladas.
 *
 *   - `disseQuantidade` (falas-do-cliente) pergunta "ele disse ALGUM numero?"
 *   - `itensNaFrase` (leitor-da-frase) pergunta "QUANTOS ele pediu?"
 *
 * "UM" E "UMA" SO VALEM PRA SEGUNDA, e a diferenca e de proposito. Como pergunta
 * solta, "uma" apareceria em quase toda frase ("queria uma informacao") e faria
 * o rateio da festa achar que o cliente deu a quantidade. Como resposta colada
 * no nome do produto, "uma torta fria" e uma torta fria, e ignorar isso deixava
 * a linha com quantidade ZERO no fechamento.
 *
 * Quem usa uma delas escolhe a lista pelo `com` do parametro, e a escolha fica
 * escrita na chamada, nao escondida numa copia.
 */
const UM_E_UMA: [string, number][] = [["uma", 1], ["um", 1]];

const NUMEROS_ESCRITOS: [string, number][] = [
  ["meia duzia", 6], ["meia-duzia", 6], ["uma duzia", 12], ["duzias", 12], ["duzia", 12],
  ["um cento", 100], ["centos", 100], ["cento", 100],
  ["duas", 2], ["dois", 2], ["tres", 3], ["quatro", 4], ["cinco", 5], ["seis", 6],
  ["sete", 7], ["oito", 8], ["nove", 9], ["dez", 10], ["onze", 11], ["doze", 12],
  ["treze", 13], ["quatorze", 14], ["catorze", 14], ["quinze", 15], ["dezesseis", 16],
  ["dezessete", 17], ["dezoito", 18], ["dezenove", 19], ["vinte", 20], ["trinta", 30],
  ["quarenta", 40], ["cinquenta", 50], ["sessenta", 60], ["setenta", 70],
  ["oitenta", 80], ["noventa", 90], ["cem", 100], ["duzentos", 200],
  ["trezentos", 300], ["quatrocentos", 400], ["quinhentos", 500], ["mil", 1000],
];

/** A lista, com ou sem o "um/uma". Ver o porque logo acima. */
export function numerosEscritos(com: { umEUma: boolean }): [string, number][] {
  return com.umEUma ? [...NUMEROS_ESCRITOS, ...UM_E_UMA] : NUMEROS_ESCRITOS;
}

/**
 * A LISTA DO JEITO QUE SE FALA, E NAO DO JEITO QUE O CODIGO JUNTA.
 *
 * "carne, frango" e lista de sistema. "carne e frango" e uma pessoa falando, e
 * a padaria e uma pessoa falando. Do pedido de festa de 30/08/2026, em que o
 * dono leu as respostas da Dora uma por uma e apontou justamente o que soava a
 * robo.
 */
export function listaEmPortugues(itens: (string | null | undefined)[]): string {
  const xs = itens.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? "";
  return xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1];
}

/**
 * OS PEDACOS DA OBSERVACAO QUE NAO REPETEM O NOME DO ITEM.
 *
 * "bolinha de queijo (queijo)" e "esfirra de carne (carne)": o sabor esta no
 * nome do produto e sair de novo entre parenteses e ruido. No pedido de festa
 * de 30/08/2026 o cliente leu "50 bolinha de queijo (queijo) R$ 1,00 cada".
 *
 * O cupom da cozinha ja fazia esse corte desde sempre, e por isso a comanda saiu
 * limpa e o resumo do cliente nao. Regra em dois lugares e regra que discorda:
 * agora e uma so, e os dois chamam daqui.
 *
 * Corta na virgula E na barra, que sao os dois separadores que o fluxo usa.
 */
export function pedacosDaObs(obs: unknown, produto: unknown): string[] {
  const chave = (t: string) =>
    semAcento(String(t)).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const nome = chave(String(produto ?? ""));
  return String(obs ?? "")
    .split(/[,|]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => {
      const f = chave(x);
      return f.length > 2 && !nome.includes(f);
    });
}
