// ============================================================================
//  A PERGUNTA DA ETAPA
//
//  Dada a etapa da vez e o que ja foi combinado, monta o que a padaria vai
//  dizer: o texto, os botoes e o cardapio que vai junto.
//
//  QUEM ESCREVE O NUMERO E O CODIGO, NUNCA A IA.
//
//  Na versao antiga a IA escrevia o valor e o codigo corria atras conferindo.
//  Ela chegou a responder "R$ 44,90 o quilo" pra uma torta de R$ 36,90, e a
//  guarda de preco inventado nasceu disso. Aqui o numero sai do motor de preco
//  (orcamento.ts), o mesmo que faz a conta do pedido: se o motor errar, erram
//  os dois juntos, e nao ha divergencia possivel entre o que ela fala e o que
//  a padaria cobra.
//
//  A IA entra depois, e so pra reescrever com o jeito dela de falar. O numero
//  ja esta fechado quando chega nela.
// ============================================================================

import { brl } from "../orcamento";
import type { Etapa, PedidoEmMontagem } from "./etapas";

export type Fala = {
  /** O que a padaria diz. Uma pergunta so, sempre. */
  texto: string;
  /** Botoes de resposta: ate tres, 20 caracteres cada (limite da Meta). */
  botoes: { id: string; titulo: string }[];
  /** Peca de cardapio que vai junto, quando a etapa pede escolha. */
  cardapio: string | null;
  /**
   * A IA pode reescrever este texto com o jeito dela?
   *
   * Onde tem numero, NAO pode: e o unico jeito de garantir que o valor que o
   * cliente le e o valor que a padaria cobra.
   */
  podeReescrever: boolean;
};

/**
 * A BASE DA FESTA, ESCRITA COM OS NUMEROS DO MOTOR.
 *
 * "Pra 20 pessoas, uma base boa e 200 salgados no total, 100 docinhos e 2 kg de
 * bolo. Da R$ 418,80 no total."
 */
function falaDaBase(p: PedidoEmMontagem): string {
  const b = p.base;
  if (!b) return "Quantas pessoas vão na festa?";
  const kg = String(b.boloKg).replace(".", ",");
  return (
    "Pra " + p.pessoas + " pessoas, uma base boa é " + b.salgados + " salgados no total, " +
    b.docinhos + " docinhos e " + kg + " kg de bolo." + "\n\n" +
    "Dá " + brl(b.totalCentavos / 100) + " no total, e dá pra ajustar o que você quiser."
  );
}

/**
 * O QUE FALTA NOS DADOS, UMA COISA POR VEZ.
 *
 * Perguntar nome, dia, hora e pagamento na mesma frase e formulario, e ja fez
 * cliente responder so a primeira e ignorar o resto. A ordem aqui e a que
 * importa pra padaria: sem dia e hora ela nem sabe se consegue fazer.
 */
function falaDosDados(p: PedidoEmMontagem): { texto: string; botoes: Fala["botoes"] } {
  const d = p.dados;
  if (!d.data) return { texto: "Pra que dia você quer retirar?", botoes: [] };
  if (!d.hora) return { texto: "Que horas você vai buscar?", botoes: [] };
  if (!d.nome) return { texto: "O pedido fica no nome de quem?", botoes: [] };
  return {
    texto: "Como você prefere pagar?",
    botoes: [
      { id: "pag_pix", titulo: "Pix" },
      { id: "pag_cartao", titulo: "Cartão" },
      { id: "pag_dinheiro", titulo: "Dinheiro" },
    ],
  };
}

/** O resumo que vai antes de confirmar: item por item, com a conta fechada. */
function falaDaConfirmacao(p: PedidoEmMontagem, totalCentavos: number): string {
  const linhas = p.itens.map(
    (i) => "- " + i.qtd + (i.categoria.startsWith("bolo") ? " kg de " : " ") + i.produto +
      (i.obs ? " (" + i.obs + ")" : ""),
  );
  const d = p.dados;
  return (
    "Fechando o pedido:" + "\n" + linhas.join("\n") + "\n\n" +
    "Retirada " + (d.data ?? "") + (d.hora ? " às " + d.hora : "") + "\n" +
    "No nome de " + (d.nome ?? "") + ", pagamento " + (d.pagamento ?? "") + "\n" +
    "*Total: " + brl(totalCentavos / 100) + "*"
  );
}

/**
 * MONTA A FALA DA ETAPA.
 *
 * Funcao pura: mesma entrada, mesma saida. Nao le banco, nao chama modelo, nao
 * manda mensagem. Por isso o fluxo inteiro se testa de graca.
 */
export function falaDaEtapa(
  etapa: Etapa,
  p: PedidoEmMontagem,
  totalCentavos = 0,
  /**
   * O QUE A PADARIA NAO FAZ, ELA DIZ.
   *
   * Sem isto o fluxo repete a mesma pergunta pra sempre. Aconteceu no teste: o
   * cliente pediu "bolo de ninho", que a Doce Pao nao faz, o codigo barrou
   * certo e a resposta foi de novo "E o bolo, qual sabor?". Quem barra tem que
   * explicar, senao o cliente acha que ela nao entendeu e repete igual.
   */
  naoTemos: string[] = [],
): Fala {
  const aviso = naoTemos.length
    ? "A gente não faz " + naoTemos.join(" nem ") + ". "
    : "";
  switch (etapa.id) {
    case "quantas_pessoas":
      return { texto: "Quantas pessoas vão na festa?", botoes: [], cardapio: null, podeReescrever: true };

    case "base_da_festa":
      return {
        texto: falaDaBase(p),
        botoes: [
          { id: "base_sim", titulo: "Pode ser" },
          { id: "base_ajustar", titulo: "Quero ajustar" },
        ],
        cardapio: null,
        // Tem dinheiro no texto: nao se reescreve.
        podeReescrever: false,
      };

    case "salgado":
      return {
        texto: aviso + "Quais salgados você quer? Te mandei o cardápio aqui.",
        botoes: [],
        cardapio: "salgados",
        podeReescrever: true,
      };

    case "docinho":
      return {
        texto: aviso + "Agora os docinhos: quais você quer?",
        botoes: [],
        cardapio: "docinhos",
        podeReescrever: true,
      };

    case "bolo":
      return {
        texto: aviso + "E o bolo, qual sabor?",
        botoes: [],
        cardapio: "bolos-festa",
        podeReescrever: true,
      };

    case "pecas_do_bolo":
      return {
        texto: "O bolo vai com topo e papel de arroz?",
        botoes: [
          { id: "peca_os_dois", titulo: "Os dois" },
          { id: "peca_so_topo", titulo: "Só o topo" },
          { id: "peca_nenhum", titulo: "Nenhum" },
        ],
        cardapio: null,
        podeReescrever: true,
      };

    case "dados": {
      const d = falaDosDados(p);
      return { texto: d.texto, botoes: d.botoes, cardapio: null, podeReescrever: true };
    }

    case "confirmacao":
      return {
        texto: falaDaConfirmacao(p, totalCentavos),
        botoes: [
          { id: "fecha_sim", titulo: "Confirmar" },
          { id: "fecha_mudar", titulo: "Mudar algo" },
        ],
        cardapio: null,
        // O resumo e a conta: nao se reescreve nem uma virgula.
        podeReescrever: false,
      };

    case "registrado":
      return {
        texto: "Já passei pra equipe da padaria. Assim que confirmarem, eu te aviso por aqui.",
        botoes: [],
        cardapio: null,
        podeReescrever: true,
      };

    case "abertura":
    default:
      return { texto: "", botoes: [], cardapio: null, podeReescrever: true };
  }
}
