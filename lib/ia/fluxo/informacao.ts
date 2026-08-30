// ============================================================================
//  QUANDO ELE SO QUER SABER
//
//  Terceiro roteiro, junto com a festa e o pedido comum: o cliente pergunta o
//  preco, o horario, o endereco, a forma de pagamento, e NAO esta pedindo nada.
//
//  PERGUNTAR NAO E PEDIR
//
//  Esta e a regra que faz a diferenca, e ela vem de defeito real do sistema
//  antigo: a cliente perguntou "0% lactose nao e sem acucar ne?" e ganhou um
//  bolo 0% lactose no pedido. Ela nao pediu bolo nenhum, fez uma pergunta.
//
//  Aqui a resposta sai do CODIGO, com o dado da casa, e nada e anotado.
//
//  E O PRECO SAI DO MOTOR, COMO EM TODO LUGAR
//
//  "Quanto e o cento de salgado?" e a pergunta mais comum da padaria e a mais
//  facil de errar valor. O numero vem do cardapio, que e a mesma fonte do preco
//  do pedido: se mudar la, muda aqui junto.
//
//  O QUE ELA NAO RESPONDE SOZINHA
//
//  Entrega. Audio da dona: "sempre pedir ajuda pro humano quando e entrega, e
//  dai a gente responde". Depende do entregador e do dia, e prometer entrega
//  que nao acontece e pior que nao ter entrega.
// ============================================================================

import { brl } from "../orcamento";
import { semAcento } from "../texto";
import { DOCE_PAO } from "../persona";
import { produtoPorNome, produtosDaCasa } from "../dados/produtos";
import { opcoesDaFamilia } from "./generico";
import { minimoPorSabor } from "./base";

// O TIPO MORA NUM LUGAR SO, E ELE E O QUE A IA DEVOLVE.
//
// Havia DOIS `SobreOQue`: este e um que eu criei no `leitura.ts` em 28/08/2026
// pra poder CONFERIR em tempo de execucao o que o modelo manda (uniao de tipo o
// compilador apaga; o que chega do modelo e texto). Dois tipos com o mesmo nome
// pro mesmo assunto e como as duas listas de cumprimento: nascem iguais e
// divergem depois.
//
// A lista vive la, junto do array que confere. Os motivos de cada caixa ficam
// aqui, que e onde a resposta e escrita.
export type { SobreOQue } from "./leitura";
import type { SobreOQue } from "./leitura";

/* As razoes de cada caixa, que nao cabem num tipo:

  | "preco"
  | "horario"
  | "endereco"
  | "pagamento"
  | "entrega"
  | "prazo"
  
   DESCONTO, PREÇO BENEFICENTE, "DÁ UMA AJUDA?".
  
   Áudio da dona, 29/07/2026: *"quando a pessoa pedir um desconto, ou então
   falar que é beneficente, ou até pedir uma ajuda, a gente já cobra unidade.
   O cachorro-quente R$ 1,20 e o pão de X R$ 1,40."*
  
   Esses dois valores existem no catálogo como anotação e a IA **não pode
   dizer nenhum dos dois**. Quem decide desconto é quem paga a conta, e a
   própria dona deu a frase logo em seguida:
  
     *"aí ela pode sempre falar assim: ah, então deixa eu ver a possibilidade
     de um desconto, eu já te retorno."*
  
   Soltar o valor por unidade transforma uma negociação em tabela. Quem ouviu
   R$ 1,20 uma vez vai cobrar esse preço na próxima, e a padaria perde a
   margem sem ter decidido nada.
   
  | "desconto"
  
   ALGUMA COISA QUE A PADARIA NAO GUARDA AQUI.
  
   Teste da Kemilly, 23/08/2026: ela pediu o CNPJ e recebeu o ENDERECO. O
   modelo empurrou a pergunta pra caixa mais parecida que existia, porque nao
   havia uma caixa pra "nao sei".
  
   CNPJ, nota fiscal, dados bancarios, cardapio de coisa que a casa nao faz:
   quem responde e a equipe. Responder perto e pior que nao responder.
   
  | "outro";
*/

export type Pergunta = { sobre: SobreOQue; familia?: string };

// O mesmo normalizador de todo mundo.
const semAc = semAcento;

/**
 * O PRECO DE UMA FAMILIA, PELO CARDAPIO.
 *
 * Devolve a frase pronta, ou null quando a familia nao foi reconhecida: dizer
 * "nao entendi qual produto" e melhor que chutar preco de outro.
 */
function precoDaFamilia(familia: string): string | null {
  const f = semAc(familia);

  // O SALGADO TAMBEM SAI DA LISTA UNICA.
  //
  // Ele era o unico galho aqui que ainda lia o `catalogo.json` cru, num arquivo
  // onde o docinho, o bolo e todo o resto ja perguntavam pra lista. E e a
  // pergunta mais feita da padaria: "quanto e o cento de salgado?".
  //
  // Conferido em 28/08/2026 antes de trocar: os dois caminhos dao o mesmo
  // numero, R$ 1,00 o frito e R$ 1,25 o assado, e o cento e o preco vezes cem
  // nos dois. Trocar nao mexe em nenhum valor.
  // O NOME EXATO GANHA DA FAMILIA, QUANDO ELE NAO E AMBIGUO.
  //
  // As familias abaixo sao procuradas por PEDACO de palavra
  // (`/docinh|doce|brigadeir|trufa/`), e pedaco sequestra nome de outra
  // familia. Medido em 28/08/2026:
  //
  //   "torta doce"  custa R$ 33,90  ->  a padaria respondia R$ 1,25 a R$ 2,25
  //   "pao doce"    custa R$ 22,90  ->  a mesma coisa
  //   "brigadeiro com maracuja" e bolo de R$ 46,90 o quilo  ->  R$ 1,25
  //
  // Tres precos errados na cara do cliente, e todos pra baixo: ele ouve R$ 1,25
  // por um bolo de quarenta e sete reais.
  //
  // A REGRA E A AMBIGUIDADE, E NAO A ORDEM. Quando o que ele escreveu resolve
  // pra UM grupo so do catalogo, esse grupo responde. Quando resolve pra dois
  // ("brigadeiro" e docinho E sabor de bolo), a familia decide, que e o mesmo
  // desempate que `identificarProduto` ja usa em todo lugar.
  const doGrupo = (): ReturnType<typeof produtosDaCasa> => {
    const alvo = semAc(f);
    if (!alvo) return [];
    const nomes = (x: ReturnType<typeof produtosDaCasa>[number]) =>
      [x.grupo.replace(/[-_]/g, " "), x.nome, x.nomeCurto].map(semAc).filter(Boolean);

    // SAO DUAS PERGUNTAS DIFERENTES, E MISTURAR AS DUAS ERRA NOS DOIS SENTIDOS.
    //
    // "empadao" e mais AMPLO que "empadao com palmito": ele quer saber da
    // familia, e a resposta e a faixa dos dois (R$ 34,90 a R$ 39,90).
    //
    // "brigadeiro com maracuja" e mais ESTREITO que "brigadeiro": ele nomeou uma
    // coisa so, e a resposta e a dela (R$ 46,90 o quilo, que e bolo).
    //
    // Eu tentei resolver as duas com "ganha o nome mais longo" e errei os dois
    // lados de uma vez: "empadao" passou a responder so o com palmito, e antes
    // "brigadeiro com maracuja" respondia o docinho de R$ 1,25.
    const amplos = produtosDaCasa().filter((x) => nomes(x).some((n) => n.startsWith(alvo)));
    if (amplos.length) return amplos;

    // Ele escreveu mais do que o nome: vale o produto que cobre mais da frase.
    const contidos = produtosDaCasa()
      .map((x) => ({ x, nota: Math.max(0, ...nomes(x).filter((n) => alvo.startsWith(n)).map((n) => n.length)) }))
      .filter((c) => c.nota > 0);
    if (!contidos.length) return [];
    const melhor = Math.max(...contidos.map((c) => c.nota));
    return contidos.filter((c) => c.nota === melhor).map((c) => c.x);
  };

  const exato = doGrupo();
  if (exato.length && new Set(exato.map((x) => x.grupo)).size === 1) {
    return fraseDaLista(exato, familia);
  }

  if (/salgad/.test(f)) {
    const doTipo = (cat: string) =>
      opcoesDaFamilia("salgado").map(produtoPorNome).filter((x) => x?.categoria === cat);
    const fritos = doTipo("salgado_frito");
    const assados = doTipo("salgado_assado");
    if (!fritos.length) return null;
    const unidade = (lista: typeof fritos) => Math.min(...lista.map((x) => x!.preco));
    const frase = (rotulo: string, lista: typeof fritos) =>
      rotulo + " sai " + brl(unidade(lista)) + " a unidade, " + brl(unidade(lista) * 100) + " o cento.";
    return (
      frase("Salgado frito", fritos) +
      (assados.length ? " O assado" + frase("", assados).replace(" sai", " sai") : "")
    );
  }

  // O DOCINHO E O BOLO SAEM DA LISTA UNICA, E NAO DE ADIVINHACAO.
  //
  // Aqui havia duas derivacoes escritas a mao, e a segunda era uma bomba
  // relogio: a trufa era achada como "o PRIMEIRO doce que tem sabores".
  //
  //   itens.find((i) => i.sabores?.length)?.preco
  //
  // Funciona hoje por acidente de ordem. No dia em que a dona der sabores a
  // outro docinho na tela, a padaria passa a cotar o preco desse outro como se
  // fosse a trufa, numa resposta que o CLIENTE le. Medido em 27/08/2026: hoje
  // bate, R$ 2,25 nos dois lados.
  //
  // E o bolo respondia so pelo de FESTA. Quem perguntava "quanto e o bolo?"
  // nunca ouvia falar dos quinze bolos caseiros, de R$ 30,90 a R$ 35,90 a
  // unidade. Nao e preco errado: e venda que nem chega a ser oferecida.
  if (/docinh|doce|brigadeir|trufa/.test(f)) {
    const doces = opcoesDaFamilia("docinho").map(produtoPorNome).filter(Boolean);
    if (!doces.length) return null;
    const barato = Math.min(...doces.map((d) => d!.preco));
    const caro = Math.max(...doces.map((d) => d!.preco));
    // O minimo por sabor tambem sai do catalogo: ele estava escrito "20" dentro
    // desta frase, e o catalogo ja o guardava em `_minimo_por_sabor.sugerir`.
    const { sugerir } = minimoPorSabor();
    return (
      "Docinho sai de " + brl(barato) + " a " + brl(caro) + " a unidade, conforme o sabor." +
      (sugerir ? " O ideal é pelo menos " + sugerir + " de cada sabor." : "")
    );
  }

  if (/bolo/.test(f)) {
    const daFamilia = opcoesDaFamilia("bolo").map(produtoPorNome).filter(Boolean);
    const festa = daFamilia.filter((b) => b!.categoria === "bolo_festa");
    const caseiro = daFamilia.filter((b) => b!.categoria === "bolo_caseiro");
    if (!festa.length && !caseiro.length) return null;
    const faixa = (lista: typeof festa) =>
      brl(Math.min(...lista.map((b) => b!.preco))) + " a " + brl(Math.max(...lista.map((b) => b!.preco)));
    const partes: string[] = [];
    if (festa.length) partes.push("Bolo de festa sai de " + faixa(festa) + " o quilo, conforme o sabor");
    if (caseiro.length) partes.push("e o caseiro de " + faixa(caseiro) + " a unidade");
    return partes.join(" ") + ". Um quilo serve umas 10 pessoas.";
  }

  // E QUALQUER OUTRA FAMILIA QUE O CARDAPIO CONHECA.
  //
  // Antes, quem perguntasse o preco de qualquer coisa fora de salgado, docinho e
  // bolo nao recebia resposta nenhuma: a padaria caia na saudacao. A PIZZA
  // estava nesse buraco, e ela tem tres produtos de R$ 41,90 a R$ 120,00.
  //
  // Aqui nao ha lista: `opcoesDaFamilia` sai da lista unica, entao a familia que
  // a dona cadastrar amanha ja e respondida sozinha.
  // E QUALQUER PRODUTO OU GRUPO QUE O CARDAPIO CONHECA.
  //
  // O comentario acima prometia que "a familia que a dona cadastrar amanha ja e
  // respondida sozinha", e nao era verdade: `opcoesDaFamilia` le a lista de
  // nomes de familia do `generico.ts`, que tem cinco entradas. Medido em
  // 28/08/2026, perguntando o preco de cada palavra de familia e de produto do
  // catalogo: 36 de 43 nao tinham resposta nenhuma.
  //
  //   "quanto e a cuca?"        ->  nada
  //   "quanto e o cupcake?"     ->  nada
  //   "quanto e a coxinha?"     ->  nada
  //
  // A padaria caia na saudacao, e a pergunta de preco e a mais feita que existe.
  //
  // Agora ela procura pelo GRUPO do catalogo e pelo PRODUTO, o que ja aconteceu
  // la em cima (`doGrupo`). Os dois saem da lista unica, entao o que a dona
  // cadastrar amanha responde sozinho de verdade.
  const daFamilia = opcoesDaFamilia(f).map(produtoPorNome).filter(Boolean);
  const lista = (daFamilia.length ? daFamilia : exato).filter(Boolean) as ReturnType<typeof produtosDaCasa>;
  if (lista.length) return fraseDaLista(lista, familia);

  return null;
}

/** "Cuca sai de R$ 22,90 a R$ 26,90 o quilo." Sai da lista, com o preco dela. */
function fraseDaLista(
  lista: { preco: number; unidade: "un" | "kg"; valorTipico?: [number, number] }[],
  familia: string,
): string | null {
  // A unidade muda a frase, e um mesmo grupo pode ter as duas: a pizza redonda
  // e por quilo e a de forma e por peca.
  const porUnidade = (u: "kg" | "un") => lista.filter((x) => x.unidade === u);
  const faixa = (quais: typeof lista) => {
    const precos = quais.map((x) => x.preco);
    const menor = Math.min(...precos);
    const maior = Math.max(...precos);
    return menor === maior ? brl(menor) : "de " + brl(menor) + " a " + brl(maior);
  };
  const partes: string[] = [];
  if (porUnidade("kg").length) partes.push(faixa(porUnidade("kg")) + " o quilo");
  if (porUnidade("un").length) partes.push(faixa(porUnidade("un")) + " a unidade");
  if (!partes.length) return null;
  const nome = String(familia).trim();
  let texto = nome.charAt(0).toUpperCase() + nome.slice(1) + " sai " + partes.join(", e ") + ".";
  // A REDONDA E POR PESO, E O CLIENTE NAO TEM BALANCA. O catalogo guarda a faixa
  // que costuma sair; sem isto ele ouve so o quilo e nao sabe se cabe no bolso.
  // Vale tambem quando a familia tem mais de um produto (forma + redonda): a
  // faixa do que e por peso entra na mesma frase, sem pedir o nome exato.
  const jaDisse = new Set<string>();
  for (const x of lista) {
    if (!x.valorTipico) continue;
    const [a, b] = x.valorTipico;
    const chave = a + "-" + b;
    if (jaDisse.has(chave)) continue;
    jaDisse.add(chave);
    texto += " Costuma sair entre " + brl(a) + " e " + brl(b) + ".";
  }
  return texto;
}

/**
 * A RESPOSTA DA PADARIA, ESCRITA PELO CODIGO.
 *
 * Devolve null quando a pergunta nao e de informacao ou quando falta o dado: ai
 * a conversa segue normal e ninguem inventa resposta.
 */
export function respostaDeInformacao(p: Pergunta): { texto: string; precisaHumano: boolean } | null {
  switch (p.sobre) {
    case "preco": {
      const texto = p.familia ? precoDaFamilia(p.familia) : null;
      return texto ? { texto, precisaHumano: false } : null;
    }

    case "horario":
      return { texto: DOCE_PAO.horario, precisaHumano: false };

    case "endereco":
      return DOCE_PAO.endereco
        ? { texto: "A gente fica na " + DOCE_PAO.endereco + ".", precisaHumano: false }
        : null;

    case "pagamento":
      // Audio da dona: "a gente nao costuma cobrar entrada; se o cliente quiser
      // adiantar, pode; pix, cartao ate 3x ou dinheiro na retirada".
      return {
        texto:
          "A gente aceita pix, cartão em até 3 vezes ou dinheiro na retirada. " +
          "Não cobramos entrada, mas se você quiser adiantar, pode.",
        precisaHumano: false,
      };

    case "prazo":
      // O prazo depende do que ele quer e do dia da semana. Topo e papel de
      // arroz sao encomendados fora e tem regra propria.
      return {
        texto:
          "Encomenda a gente pede uns dois dias de antecedência. Me diz o que você quer e " +
          "pra quando que eu confiro se dá tempo.",
        precisaHumano: false,
      };

    case "entrega":
      // A DONA DECIDE ENTREGA, SEMPRE.
      //
      // "Sempre pedir ajuda pro humano quando e entrega, e dai a gente
      // responde." Depende do entregador e do dia, e tem horario proprio.
      return {
        texto:
          "Sobre entrega quem te responde melhor é a equipe, porque depende do dia e do endereço. " +
          "Já vou chamar alguém pra falar com você.",
        precisaHumano: true,
      };

    case "desconto":
      // DESCONTO É DE QUEM PAGA A CONTA, E A DONA DEU A FRASE.
      //
      // Áudio de 29/07/2026: "quando a pessoa pedir um desconto, ou então falar
      // que é beneficente, ou até pedir uma ajuda, a gente já cobra unidade. O
      // cachorro-quente R$ 1,20 e o pão de X R$ 1,40."
      //
      // Os dois valores estão no catálogo como anotação, e a IA NÃO pode dizer
      // nenhum deles: soltar o preço por unidade transforma negociação em
      // tabela, e quem ouviu R$ 1,20 uma vez vai cobrar isso na próxima.
      //
      // A frase é a dela, logo em seguida no mesmo áudio: "deixa eu ver a
      // possibilidade de um desconto, eu já te retorno".
      return {
        texto:
          "Deixa eu ver a possibilidade de um desconto com a equipe e já te retorno por aqui.",
        precisaHumano: true,
      };

    case "outro":
      return {
        texto:
          "Essa eu não sei te responder de cabeça. Já vou chamar alguém da equipe pra te passar certinho.",
        precisaHumano: true,
      };

    default:
      return null;
  }
}
