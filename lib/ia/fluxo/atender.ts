// ============================================================================
//  O FLUXO NOVO ATENDENDO DE VERDADE
//
//  Junta tudo e responde uma mensagem do WhatsApp: le o que ja estava gravado,
//  passa pelo fluxo, grava o que mudou, fecha o pedido quando for a hora, e
//  devolve o texto e os botoes.
//
//  ELE ATENDE TODO MUNDO. NAO HA LISTA, E NAO HA VERSAO ANTIGA.
//
//  Estava escrito aqui que este arquivo atendia "so os numeros de
//  FLUXO_NOVO_PARA" e que "sem a variavel preenchida, ninguem cai aqui". As
//  duas frases eram falsas em 27/08/2026, e a segunda era o contrario do que o
//  codigo faz: `ehDoFluxoNovo` devolve TRUE por padrao.
//
//  O cabecalho contradizia a funcao vinte linhas abaixo dele, que ja dizia
//  "QUEM CAI NO FLUXO NOVO: TODO MUNDO". Cabecalho velho e pior que cabecalho
//  nenhum: quem le comeca por ele e sai com a ideia errada de como o sistema
//  funciona.
//
//  A versao antiga foi apagada em 26/08/2026. O que resta e o interruptor de
//  emergencia, documentado na funcao logo abaixo.
// ============================================================================

import type OpenAI from "openai";
import { responder, type Estado } from "./fluxo";
import { pensarComOpenAI } from "./pensar-openai";
import { dizerComJeito } from "./dizer";
import { lerEstadoDoBanco, gravarEstado, zerar } from "./gravar";
import { fecharPedido } from "./fechar";
import { falaDaEtapa } from "./pergunta";
import { roteiroDoPedido } from "./etapas";
import { mandouRecomecar, comCumprimento, tirarCumprimento, semEmoji, respostaAoValor } from "./falas-do-cliente";
import {
  temPedidoAguardandoCliente,
  registrarAceiteCliente,
  devolverPedidoParaEquipe,
} from "@/lib/banco/pedidos";

export type RespostaDoFluxo = {
  texto: string;
  botoes: { id: string; titulo: string }[];
  cardapio: string | null;
  etapa: string;
  pedidoId?: string;
  /** A conversa precisa de gente. So isto acende o aviso no painel da dona. */
  precisaHumano?: boolean;
  rastro: string[];
  uso: { tokensIn: number; tokensOut: number; cacheRead: number; chamadas: number };
};

/**
 * QUEM CAI NO FLUXO NOVO: TODO MUNDO.
 *
 * A padaria ainda nao esta atendendo cliente de verdade, entao nao ha o que
 * migrar aos poucos. Manter dois sistemas ligados ao mesmo tempo seria trabalho
 * de convivencia que ninguem precisa: o fluxo novo E o sistema.
 *
 * A CHAVE DE DESLIGAR CONTINUA EXISTINDO, e so ela.
 *
 * FLUXO_NOVO_PARA=nao (ou "off", "antigo") desliga a IA em segundos, sem deploy
 * e sem git. Ela fica aqui pro dia em que houver cliente comprando e alguma
 * coisa der errado: nesse dia ninguem vai querer esperar build.
 *
 * O QUE ELA FAZ E SIMPLES: CALA A IA.
 *
 * Estava escrito aqui que desligar "volta pra Dora antiga". A Dora antiga foi
 * APAGADA em 26/08/2026. O valor `off` nao escolhe outro cerebro, nao chama o
 * modelo e nao manda resposta automatica. A mensagem do cliente continua salva
 * no painel para a equipe ver.
 */
export function ehDoFluxoNovo(_telefone: string): boolean {
  const bruto = String(process.env.FLUXO_NOVO_PARA ?? "").trim();
  if (/^(nao|não|off|0|false|antigo|desligado)$/i.test(bruto)) return false;
  return true;
}

const VAZIO: Estado = {
  // NAO NASCE FESTA.
  //
  // Estava true aqui, e por isso quem mandava "boa noite" recebia "Quantas
  // pessoas vao na festa?" na cara. O dono viu isso na primeira mensagem que
  // mandou pro fluxo novo, e com razao: ninguem chega numa padaria e ouve uma
  // pergunta sobre festa que ele nao mencionou.
  //
  // Festa e uma conclusao, nao um ponto de partida: so vira festa quando a
  // pessoa fala de festa, de aniversario ou de um numero de gente.
  ehFesta: false,
  pessoas: null,
  base: null,
  baseAceita: false,
  itens: [],
  naoQuer: [],
  dados: { nome: null, data: null, hora: null, pagamento: null },
  pecas: null,
  topoNome: null,
  topoIdade: null,
  tema: null,
  escrito: null,
  forminha: null,
  prato: null,
  ofereceu: false,
  ultimaFala: null,
  insistiu: 0,
  retomarEm: null,
  assunto: null,
};

export async function atenderComFluxoNovo(
  cliente: OpenAI,
  negocioId: string,
  clienteId: string,
  mensagem: { texto: string; botaoId?: string | null },
  // A PADARIA JA FALOU COM ESTE CLIENTE NESTA CONVERSA?
  //
  // So serve pro cumprimento: quem chega e cumprimentado, quem ja esta na
  // conversa nao ouve "boa noite" de novo a cada mensagem.
  jaAtendeu = false,
): Promise<RespostaDoFluxo> {
  const uso = { tokensIn: 0, tokensOut: 0, cacheRead: 0, chamadas: 0 };
  const contar = (u: { tokensIn: number; tokensOut: number; cacheRead?: number }) => {
    uso.tokensIn += u.tokensIn;
    uso.tokensOut += u.tokensOut;
    uso.cacheRead += u.cacheRead ?? 0;
    uso.chamadas++;
  };

  // O CLIENTE MANDOU RECOMECAR: apaga tudo e sai, sem passar pelo modelo.
  // Apagar o pedido de alguem nao e decisao de redacao, e de quebra sai de
  // graca.
  if (mandouRecomecar(mensagem.texto)) {
    const rastro = ["recomecar: zerei o pedido em montagem"];

    // RECOMECAR APAGAVA O RASCUNHO E DEIXAVA O PEDIDO DE PE.
    //
    // `zerar` limpa o pedido EM MONTAGEM, que e a conversa. O pedido ja
    // REGISTRADO, esperando o cliente aceitar o valor da equipe, continuava
    // vivo na fila.
    //
    // Entao o cliente mandava "cancela tudo", ouvia "apaguei tudo o que a gente
    // tinha combinado", e a equipe seguia com um pedido pra aprovar e produzir.
    // Alguem ia assar o que ele acabou de cancelar.
    //
    // Achado lendo o arquivo inteiro em 27/08/2026. Nao da pra a Dora cancelar
    // sozinha um pedido que ja esta com a equipe: quem decide isso e gente. Ela
    // devolve pra equipe com o motivo, que e o mesmo caminho de quando o cliente
    // recusa o valor.
    try {
      if (await temPedidoAguardandoCliente(negocioId, clienteId)) {
        await devolverPedidoParaEquipe(
          negocioId,
          clienteId,
          "O cliente pediu pra recomecar do zero: " + String(mensagem.texto).slice(0, 200),
        );
        rastro.push("havia pedido esperando ele; devolvi pra equipe com o motivo");
      }
    } catch (e) {
      console.error("[fluxo-novo] falha ao devolver o pedido no recomecar:", e);
    }

    await zerar(negocioId, clienteId);
    return {
      texto:
        "Apaguei tudo o que a gente tinha combinado e comecei do zero. " +
        "Me diz o que voce precisa que eu anoto de novo.",
      botoes: [],
      cardapio: null,
      etapa: "abertura",
      // Se havia pedido com a equipe, alguem precisa olhar: o rastro conta.
      precisaHumano: rastro.length > 1,
      rastro,
      uso,
    };
  }

  // ================================================================
  //  O PEDIDO ESTA ESPERANDO A RESPOSTA DELE SOBRE O VALOR
  //
  //  A equipe lancou o valor do topo, a Dora mandou o total novo, e o pedido
  //  ficou parado esperando ele dizer se aceita. Ate 23/08/2026 esse "sim" caia
  //  no vazio: o pedido nao saia do lugar e o dono teve que aprovar na mao. Pior,
  //  a Dora respondia "pronto, seu pedido foi pra fila da equipe", que era
  //  mentira.
  //
  //  Aqui a conversa nem chega no fluxo: e resposta a uma pergunta de dinheiro,
  //  com duas saidas conhecidas, e quem decide e o codigo.
  // ================================================================
  try {
    if (await temPedidoAguardandoCliente(negocioId, clienteId)) {
      // O TOQUE NO BOTAO VALE COMO RESPOSTA, E VALE ANTES DA PALAVRA.
      //
      // Sem isto o botao que a padaria manda logo abaixo seria enfeite: o
      // cliente tocaria em "Ta certo" e a leitura por texto tentaria adivinhar
      // "Ta certo" de novo. Regra do dono, 23/08/2026, sobre outro botao que
      // fazia isso: "os botoes tem uns que ta la pra bonito".
      const resposta =
        mensagem.botaoId === "valor_sim"
          ? "aceitou"
          : mensagem.botaoId === "valor_nao"
            ? "recusou"
            : respostaAoValor(mensagem.texto);

      if (resposta === "aceitou") {
        const foi = await registrarAceiteCliente(negocioId, clienteId);
        // O "NAO CONSEGUI ANOTAR" PRECISA CHAMAR ALGUEM.
        //
        // `registrarAceiteCliente` devolve se conseguiu. Quando NAO conseguia, a
        // padaria dizia "Anotei aqui, obrigado. Assim que a equipe confirmar eu
        // te aviso" e ninguem era avisado de nada: o pedido nao andava, o painel
        // nao acendia, e o cliente ficava esperando uma confirmacao que nunca ia
        // chegar.
        //
        // E o aceite de um VALOR: o cliente ja disse sim pro dinheiro. Perder
        // isso em silencio e o pior tipo de falha que este sistema tem.
        //
        // Achado na segunda leitura de 27/08/2026. Na primeira eu li estas
        // linhas e nao vi.
        return {
          texto: semEmoji(
            foi
              ? "Perfeito, obrigado. Seu pedido foi pra fila de aprovação da equipe e eu te aviso assim que confirmarem."
              : "Perfeito, obrigado. Já avisei a equipe da padaria e eles confirmam com você por aqui.",
          ),
          botoes: [],
          cardapio: null,
          etapa: "registrado",
          precisaHumano: !foi,
          rastro: foi
            ? ["ele aceitou o valor da equipe; o pedido foi pra fila de aprovacao"]
            : ["ele aceitou o valor mas o registro do aceite falhou; chamei a equipe"],
          uso,
        };
      }

      if (resposta === "recusou") {
        await devolverPedidoParaEquipe(
          negocioId,
          clienteId,
          "O cliente nao aceitou o valor: " + String(mensagem.texto).slice(0, 200),
        );
        return {
          texto:
            "Entendi. Vou passar pra equipe da padaria pra eles verem o que dá pra fazer, e te respondo por aqui.",
          botoes: [],
          cardapio: null,
          etapa: "registrado",
          precisaHumano: true,
          rastro: ["ele nao aceitou o valor; devolvi o pedido pra equipe"],
          uso,
        };
      }

      // Nao deu pra entender se foi sim ou nao. Perguntar de novo e melhor que
      // decidir por ele: e dinheiro, e a resposta muda o que vai pra producao.
      //
      // MAS PERGUNTAR IGUAL PRA SEMPRE E UM BECO, E ESTE TRECHO NAO TINHA SAIDA.
      //
      // Ele roda ANTES do fluxo, entao o contador de insistencia do fluxo nunca
      // chega aqui: quem respondesse qualquer coisa que nao fosse um sim ou um
      // nao claro ouvia exatamente esta frase em TODA mensagem, sem fim e sem
      // ninguem ser chamado.
      //
      // A resposta aqui so tem duas saidas, entao ela e caso de BOTAO: o cliente
      // toca em vez de escrever e nao ha o que interpretar. E a mesma decisao do
      // dono pro resto do sistema, e ela vale mais ainda onde tem dinheiro.
      //
      // Achado na segunda leitura de 27/08/2026.
      return {
        texto: "Só pra eu não errar: esse valor tá certo pra você?",
        botoes: [
          { id: "valor_sim", titulo: "Tá certo" },
          { id: "valor_nao", titulo: "Quero falar" },
        ],
        cardapio: null,
        etapa: "registrado",
        rastro: ["nao entendi se ele aceitou o valor; perguntei com botao"],
        uso,
      };
    }
  } catch (e) {
    console.error("[fluxo-novo] falha ao checar pedido aguardando o cliente:", e);
  }

  // O que ja estava gravado manda: a dona pode ter editado na tela entre uma
  // mensagem e outra do cliente, e o que ela mexeu vale mais que a memoria.
  const doBanco = await lerEstadoDoBanco(negocioId, clienteId);
  const antes: Estado = { ...VAZIO, ...doBanco } as Estado;

  // Sem roteiro fixo: quem escolhe e o tipo do pedido, e a escolha se refaz a
  // cada mensagem. Quem so cumprimentou segue o roteiro comum, que e curto, e
  // troca pro da festa no instante em que falar de festa.
  const r = await responder(antes, mensagem, pensarComOpenAI(cliente, contar));

  await gravarEstado(negocioId, clienteId, antes, r.estado);

  // ---------------------------------------------------------- fechamento
  //
  // FECHA PELO BOTAO OU PELA PALAVRA, PORQUE O BOTAO NEM SEMPRE EXISTE.
  //
  // Antes so o toque em Confirmar fechava, e isso era um beco: quem escreve
  // "pode fechar" nao fechava nada, e quem volta depois de 24 horas nem recebe
  // botao, porque o WhatsApp so deixa mandar botao dentro da janela de conversa.
  // O cliente ficava olhando o mesmo resumo pra sempre.
  //
  // A palavra so vale na etapa da confirmacao, e quem confere isso e o fluxo:
  // "pode ser" no meio dos docinhos e conversa, embaixo do resumo e ordem.
  let pedidoId: string | undefined;
  if (mensagem.botaoId === "fecha_sim" || r.confirmouEscrevendo) {
    // A EQUIPE JA MEXEU NO PEDIDO: ISSO NAO E UM ERRO, E UMA NOTICIA.
    //
    // `registrarPedido` recusa sobrescrever pedido que a equipe ajustou, e com
    // razao: num teste o topo de R$ 33 que a dona tinha lancado sumiu quando a
    // IA registrou de novo. A recusa e um `throw`, e o throw subia ate o webhook,
    // que trata qualquer excecao do mesmo jeito:
    //
    //     "Deu um probleminha aqui do meu lado."
    //
    // Nada quebrou. A equipe esta com o pedido dele, que e exatamente o que ele
    // queria saber, e a padaria respondia pedindo desculpa por um problema que
    // nao existe. Achado lendo o `conversas.ts` em 28/08/2026.
    //
    // O handoff continua: quem fala com ele agora e gente, porque o pedido mudou
    // de mao. O que muda e a frase, que passa a ser verdade.
    let fechado: Awaited<ReturnType<typeof fecharPedido>> = null;
    try {
      fechado = await fecharPedido(negocioId, clienteId, r.estado);
    } catch (e) {
      const motivo = String((e as Error)?.message ?? e);
      if (!/equipe ja ajustou/.test(motivo)) throw e;
      r.rastro.push("a equipe ja ajustou este pedido; nao sobrescrevo e passo pra ela");
      const aviso =
        "Seu pedido já está com a equipe da padaria, e eles ajustaram alguma coisa nele. " +
        "Vou chamar alguém pra te confirmar certinho antes de fechar.";
      return {
        texto: semEmoji(aviso),
        botoes: [],
        cardapio: null,
        etapa: "confirmacao",
        precisaHumano: true,
        rastro: r.rastro,
        uso,
      };
    }
    if (fechado) {
      pedidoId = fechado.pedidoId;
      r.rastro.push("pedido fechado: " + fechado.pedidoId + " (R$ " + (fechado.totalCentavos / 100).toFixed(2) + ")");
      const lista = roteiroDoPedido(r.estado);
      const fim = falaDaEtapa(lista[lista.length - 1], r.estado);
      return {
        texto: semEmoji(fim.texto),
        botoes: [],
        cardapio: null,
        etapa: "registrado",
        pedidoId,
        // O CHAMADO DA EQUIPE NAO PODE SUMIR JUNTO COM O FECHAMENTO.
        //
        // Este `return` nao levava o `precisaHumano`, e ele e o unico sinal que
        // acende o aviso no painel da dona. Quem pedisse "bolo sem lactose" e
        // fechasse o pedido na mesma mensagem entrava na fila SEM ninguem ser
        // avisado de que havia algo pra resolver, e a restricao ja tinha saido
        // da observacao pra nao virar promessa. Ninguem ficava sabendo de nada.
        //
        // Achado lendo o arquivo inteiro em 27/08/2026.
        precisaHumano: r.precisaHumano,
        rastro: r.rastro,
        uso,
      };
    }
    r.rastro.push("tocou em confirmar mas o pedido ainda nao podia fechar");
  }

  // "MUDAR ALGO" PERGUNTA O QUE MUDAR.
  //
  // Tocar em Mudar algo devolvia o mesmo resumo com os mesmos dois botoes, o
  // que da no mesmo que nao ter botao. Aqui a padaria faz a pergunta obvia, sem
  // chamar a IA: nao ha o que interpretar num toque de botao, e a resposta dele
  // ("quero trocar o bolo") o fluxo ja sabe atender pela etapa certa.
  // "QUERO AJUSTAR" PRECISA FAZER ALGUMA COISA.
  //
  // Teste do dono em 23/08/2026: ele tocou em "Quero ajustar" e recebeu a mesma
  // proposta de R$ 628,20 de volta, palavra por palavra. O botao so desmarcava o
  // aceite por dentro e nao dizia nada, entao pra quem estava do outro lado ele
  // era enfeite. Palavras dele: "os botoes tem uns que ta la pra bonito".
  //
  // Aqui a padaria faz a pergunta obvia, e de graca: nao ha o que interpretar
  // num toque de botao. A resposta dele ("quero 200 salgados", "sem docinho") o
  // fluxo ja sabe atender na etapa da proposta.
  if (mensagem.botaoId === "base_ajustar") {
    return {
      texto:
        "Claro, é só dizer o que muda. Pode falar a quantidade que você quer " +
        "de cada coisa, ou tirar alguma delas.",
      botoes: [],
      cardapio: null,
      etapa: r.etapa,
      // Os dois botoes que respondem sem chamar a IA tambem levam o chamado da
      // equipe: a saida curta nao pode apagar o que a conversa ja tinha
      // decidido. Mesmo defeito do fechamento, na mesma leitura de 27/08/2026.
      precisaHumano: r.precisaHumano,
      rastro: [...r.rastro, "tocou em ajustar; perguntei o que muda (sem chamar a IA)"],
      uso,
    };
  }

  if (mensagem.botaoId === "fecha_mudar") {
    return {
      texto: "Claro. O que você quer mudar no pedido?",
      botoes: [],
      cardapio: null,
      etapa: r.etapa,
      precisaHumano: r.precisaHumano,
      rastro: [...r.rastro, "tocou em mudar algo; perguntei o que (sem chamar a IA)"],
      uso,
    };
  }

  // O jeito de falar vem por ultimo, e nao encosta onde tem dinheiro.
  let texto = await dizerComJeito(cliente, r.fala, mensagem.texto, contar);

  // O CUMPRIMENTO E DA PRIMEIRA FALA, E SO DELA.
  //
  // Na primeira ele entra mesmo que a reescrita tenha comido, porque quem
  // atende cumprimenta primeiro, e segue o RELOGIO de Sao Paulo e nao a palavra
  // do cliente: quem manda "bom dia" as duas da tarde recebe "boa tarde".
  //
  // Da segunda em diante ele SAI, venha do codigo ou da reescrita. O dono
  // recebeu "Boa noite, tudo bem?" tres mensagens seguidas, e isso nao e
  // educacao, e tique de robo.
  try {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    texto = jaAtendeu ? tirarCumprimento(texto) : comCumprimento(texto, agora);
  } catch (e) {
    console.error("[fluxo-novo] falha ao ajustar o cumprimento:", e);
  }

  return {
    // Emoji nao passa por aqui, nem o que a reescrita inventar. A peneira e a
    // ultima coisa a rodar de proposito: caminho novo nao precisa lembrar dela.
    texto: semEmoji(texto),
    botoes: r.fala.botoes,
    cardapio: r.fala.cardapio,
    etapa: r.etapa,
    precisaHumano: r.precisaHumano,
    rastro: r.rastro,
    uso,
  };
}
