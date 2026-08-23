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

import { brl, motorPadrao } from "../orcamento";
import type { Etapa, PedidoEmMontagem } from "./etapas";
import { saudacaoDaHora } from "./falas-do-cliente";

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
/**
 * TOPO E PAPEL DE ARROZ, UMA PERGUNTA DE CADA VEZ.
 *
 * O WhatsApp so deixa mandar tres botoes por mensagem, e as opcoes de verdade
 * sao quatro: os dois, so o topo, so o papel, nenhum. O dono escolheu resolver
 * com duas perguntas de sim e nao em vez de uma lista de quatro linhas, porque
 * a lista esconde as opcoes atras de um toque e ele conhece a clientela.
 *
 * Duas perguntas cobrem as quatro combinacoes e deixam tudo visivel na tela.
 *
 * E O NOME E A IDADE DO ANIVERSARIANTE
 *
 * So quando o topo for sim, porque so o topo precisa deles: a peca e fabricada
 * com o tema, o nome e o numero. A pergunta sai numa frase so, que e como uma
 * atendente perguntaria, e o CODIGO confere se vieram os dois. Se faltar um, ele
 * cobra o que faltou.
 *
 * Foi o medo do dono que desenhou isso: "numa pergunta so e mais real, mas meu
 * medo e ela errar". Perguntar junto e cobrar no codigo resolve os dois lados.
 */
function falaDasPecas(p: PedidoEmMontagem): Fala {
  const topo = p.pecas?.topo ?? null;
  const papel = p.pecas?.papelDeArroz ?? null;

  if (topo === null) {
    return {
      texto: "O bolo vai com topo?",
      botoes: [
        { id: "topo_sim", titulo: "Sim" },
        { id: "topo_nao", titulo: "Não" },
      ],
      cardapio: null,
      podeReescrever: true,
    };
  }

  if (papel === null) {
    // O VALOR SAI DO MOTOR, NAO DA MINHA MEMORIA.
    //
    // Papel de arroz e o unico adicional do bolo com preco de tabela. Escrever
    // "R$ 12" aqui na mao seria mais um numero pra divergir do cardapio no dia
    // em que a dona mudar. Por ter valor, esta fala nao passa pela reescrita.
    const cot = motorPadrao.cotarPorItens([{ item: "papel de arroz", qtd: 1 }]);
    const preco = Number(cot.linhas?.[0]?.subtotal ?? 0);
    return {
      texto:
        "E papel de arroz, com a foto impressa no bolo?" +
        (preco > 0 ? " Fica " + brl(preco) + "." : ""),
      botoes: [
        { id: "papel_sim", titulo: "Sim" },
        { id: "papel_nao", titulo: "Não" },
      ],
      cardapio: null,
      podeReescrever: preco <= 0,
    };
  }

  // O topo e feito com o nome e a idade. Sem os dois, a cozinha nao tem o que
  // escrever na peca.
  if (topo === true && (!p.topoNome || !p.topoIdade)) {
    const falta =
      !p.topoNome && !p.topoIdade
        ? "O topo vai com qual nome e qual idade?"
        : !p.topoNome
          ? "O topo vai no nome de quem?"
          : "E quantos anos ele faz?";
    return { texto: falta, botoes: [], cardapio: null, podeReescrever: true };
  }

  // Tudo respondido: quem escolhe a proxima etapa e a lista, nao esta fala.
  return { texto: "", botoes: [], cardapio: null, podeReescrever: true };
}

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
    "*Total: " + brl(totalCentavos / 100) + "*" +
    // O TOPO NAO ENTRA NO TOTAL, E O CLIENTE PRECISA SABER DISSO ANTES.
    //
    // Ele e o unico item da casa sem preco de tabela: cada peca e fabricada com
    // o tema, o nome e a idade, e quem lanca o valor e a equipe, na tela do
    // painel. Dizer "em torno de R$ 30" e ancora, nao estimativa: o cliente le
    // 30, a equipe lanca 45, e a diferenca vira discussao no balcao com a dona.
    // Uma companhia aerea ja foi obrigada por tribunal a honrar o numero que o
    // robo dela inventou.
    //
    // Entao o resumo avisa que falta o topo, e nao diz quanto.
    (p.pecas?.topo === true
      ? "\n\n_O topo entra à parte: a equipe faz o orçamento dele e confirma com você._"
      : "")
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
      return falaDasPecas(p);

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
      // A PRIMEIRA FALA DA PADARIA COMECA COM O CUMPRIMENTO. SEMPRE.
      //
      // Regra do dono, em 23/08/2026: "nem boa noite ela me deu, que e o basico
      // de todo atendimento; a primeira fala dela vai ser dizendo bom dia,
      // tarde ou noite e tudo bem".
      //
      // Ele esta certo, e isso nao pode depender de a IA lembrar. A saudacao
      // sai do RELOGIO e vem escrita daqui: quem manda "boa noite" as duas da
      // tarde recebe "boa tarde", que e o certo, e quem nao cumprimentou
      // recebe do mesmo jeito, porque quem atende cumprimenta primeiro.
      // A PRIMEIRA MENSAGEM DA PADARIA.
      //
      // Voltava vazia, e por isso quem mandou "boa noite" recebeu "Quantas
      // pessoas vao na festa?": sem fala propria, o fluxo caia direto na etapa
      // seguinte. Ninguem chega numa padaria e ouve uma pergunta sobre uma
      // festa que ele nao mencionou.
      //
      // Aqui a pergunta e aberta de proposito: quem chega pode querer uma
      // festa, dez paes ou so o preco da torta, e e ele quem diz.
      return {
        texto: saudacaoDaHora() + ", tudo bem? O que você precisa?",
        botoes: [],
        cardapio: null,
        podeReescrever: true,
      };

    default:
      return { texto: "", botoes: [], cardapio: null, podeReescrever: true };
  }
}
