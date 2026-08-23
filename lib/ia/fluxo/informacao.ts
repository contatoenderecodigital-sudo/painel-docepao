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

export type SobreOQue =
  | "preco"
  | "horario"
  | "endereco"
  | "pagamento"
  | "entrega"
  | "prazo"
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

  if (/docinh|doce|brigadeir|trufa/.test(f)) {
    const itens = (catalogo.doces?.itens ?? []) as { nome: string; preco?: number; sabores?: string[] }[];
    const tradicional = itens.find((i) => semAc(i.nome) === "brigadeiro")?.preco;
    const trufa = itens.find((i) => i.sabores?.length)?.preco;
    if (!tradicional) return null;
    return (
      "Docinho tradicional sai " + brl(tradicional) + " a unidade e a trufa " + brl(trufa ?? 0) +
      ". O mínimo é 20 de cada sabor."
    );
  }

  if (/bolo/.test(f)) {
    const faixas = (catalogo.bolos_recheados?.faixas ?? []) as { preco: number }[];
    if (!faixas.length) return null;
    const menor = Math.min(...faixas.map((x) => Number(x.preco)));
    const maior = Math.max(...faixas.map((x) => Number(x.preco)));
    return (
      "Bolo de festa sai de " + brl(menor) + " a " + brl(maior) + " o quilo, conforme o sabor. " +
      "Um quilo serve umas 10 pessoas."
    );
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
