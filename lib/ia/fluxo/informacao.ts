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

import catalogo from "../dados/catalogo.json";
import { brl } from "../orcamento";
import { DOCE_PAO } from "../persona";
import { produtoPorNome } from "../dados/produtos";
import { opcoesDaFamilia } from "./generico";
import { minimoPorSabor } from "./base";

export type SobreOQue =
  | "preco"
  | "horario"
  | "endereco"
  | "pagamento"
  | "entrega"
  | "prazo"
  /**
   * DESCONTO, PREÇO BENEFICENTE, "DÁ UMA AJUDA?".
   *
   * Áudio da dona, 29/07/2026: *"quando a pessoa pedir um desconto, ou então
   * falar que é beneficente, ou até pedir uma ajuda, a gente já cobra unidade.
   * O cachorro-quente R$ 1,20 e o pão de X R$ 1,40."*
   *
   * Esses dois valores existem no catálogo como anotação e a IA **não pode
   * dizer nenhum dos dois**. Quem decide desconto é quem paga a conta, e a
   * própria dona deu a frase logo em seguida:
   *
   *   *"aí ela pode sempre falar assim: ah, então deixa eu ver a possibilidade
   *   de um desconto, eu já te retorno."*
   *
   * Soltar o valor por unidade transforma uma negociação em tabela. Quem ouviu
   * R$ 1,20 uma vez vai cobrar esse preço na próxima, e a padaria perde a
   * margem sem ter decidido nada.
   */
  | "desconto"
  /**
   * ALGUMA COISA QUE A PADARIA NAO GUARDA AQUI.
   *
   * Teste da Kemilly, 23/08/2026: ela pediu o CNPJ e recebeu o ENDERECO. O
   * modelo empurrou a pergunta pra caixa mais parecida que existia, porque nao
   * havia uma caixa pra "nao sei".
   *
   * CNPJ, nota fiscal, dados bancarios, cardapio de coisa que a casa nao faz:
   * quem responde e a equipe. Responder perto e pior que nao responder.
   */
  | "outro";

export type Pergunta = { sobre: SobreOQue; familia?: string };

const semAc = (t: string) =>
  String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * O PRECO DE UMA FAMILIA, PELO CARDAPIO.
 *
 * Devolve a frase pronta, ou null quando a familia nao foi reconhecida: dizer
 * "nao entendi qual produto" e melhor que chutar preco de outro.
 */
function precoDaFamilia(familia: string): string | null {
  const f = semAc(familia);

  if (/salgad/.test(f)) {
    const frito = catalogo.salgados?.frito as { preco?: number; preco_cento?: number } | undefined;
    const assado = catalogo.salgados?.assado as { preco?: number; preco_cento?: number } | undefined;
    if (!frito?.preco) return null;
    return (
      "Salgado frito sai " + brl(frito.preco) + " a unidade, " + brl(frito.preco_cento ?? frito.preco * 100) +
      " o cento. O assado sai " + brl(assado?.preco ?? 0) + " a unidade, " +
      brl(assado?.preco_cento ?? (assado?.preco ?? 0) * 100) + " o cento."
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
  const daFamilia = opcoesDaFamilia(f).map(produtoPorNome).filter(Boolean);
  if (daFamilia.length) {
    // A unidade muda a frase, e um mesmo grupo pode ter as duas: a pizza redonda
    // e por quilo e a de forma e por peca.
    const porUnidade = (u: "kg" | "un") => daFamilia.filter((x) => x!.unidade === u);
    const faixa = (lista: typeof daFamilia) => {
      const precos = lista.map((x) => x!.preco);
      const menor = Math.min(...precos);
      const maior = Math.max(...precos);
      return menor === maior ? brl(menor) : "de " + brl(menor) + " a " + brl(maior);
    };
    const partes: string[] = [];
    if (porUnidade("kg").length) partes.push(faixa(porUnidade("kg")) + " o quilo");
    if (porUnidade("un").length) partes.push(faixa(porUnidade("un")) + " a unidade");
    if (partes.length) {
      const nome = String(familia).trim();
      return nome.charAt(0).toUpperCase() + nome.slice(1) + " sai " + partes.join(", e ") + ".";
    }
  }

  return null;
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
