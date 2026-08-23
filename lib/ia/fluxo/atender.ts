// ============================================================================
//  O FLUXO NOVO ATENDENDO DE VERDADE
//
//  Junta tudo e responde uma mensagem do WhatsApp: le o que ja estava gravado,
//  passa pelo fluxo, grava o que mudou, fecha o pedido quando for a hora, e
//  devolve o texto e os botoes.
//
//  LIGADO SO PRA QUEM ESTIVER NA LISTA
//
//  Enquanto a versao antiga atende os clientes, esta atende so os numeros de
//  FLUXO_NOVO_PARA. E o unico jeito honesto de testar: o dono conversa com o
//  fluxo novo no celular dele e a padaria continua funcionando igual pra quem
//  esta comprando.
//
//  Sem a variavel preenchida, ninguem cai aqui. O padrao e nao mudar nada.
// ============================================================================

import type OpenAI from "openai";
import { responder, type Estado } from "./fluxo";
import { pensarComOpenAI } from "./pensar-openai";
import { dizerComJeito } from "./dizer";
import { lerEstadoDoBanco, gravarEstado, zerar } from "./gravar";
import { fecharPedido } from "./fechar";
import { falaDaEtapa } from "./pergunta";
import { ETAPAS_DA_FESTA } from "./etapas";
import { mandouRecomecar, comCumprimento, tirarCumprimento, semEmoji } from "./falas-do-cliente";

export type RespostaDoFluxo = {
  texto: string;
  botoes: { id: string; titulo: string }[];
  cardapio: string | null;
  etapa: string;
  pedidoId?: string;
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
 * FLUXO_NOVO_PARA=nao (ou "off", "antigo") volta pra Dora antiga em segundos,
 * sem deploy e sem git. Ela fica aqui pro dia em que houver cliente comprando e
 * alguma coisa der errado: nesse dia ninguem vai querer esperar build.
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
  forminha: null,
  prato: null,
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
    await zerar(negocioId, clienteId);
    return {
      texto:
        "Apaguei tudo o que a gente tinha combinado e comecei do zero. " +
        "Me diz o que voce precisa que eu anoto de novo.",
      botoes: [],
      cardapio: null,
      etapa: "abertura",
      rastro: ["recomecar: zerei o pedido em montagem"],
      uso,
    };
  }

  // O que ja estava gravado manda: a dona pode ter editado na tela entre uma
  // mensagem e outra do cliente, e o que ela mexeu vale mais que a memoria.
  const doBanco = await lerEstadoDoBanco(negocioId, clienteId);
  const antes: Estado = { ...VAZIO, ...doBanco } as Estado;

  const r = await responder(antes, mensagem, pensarComOpenAI(cliente, contar), ETAPAS_DA_FESTA);

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
    const fechado = await fecharPedido(negocioId, clienteId, r.estado);
    if (fechado) {
      pedidoId = fechado.pedidoId;
      r.rastro.push("pedido fechado: " + fechado.pedidoId + " (R$ " + (fechado.totalCentavos / 100).toFixed(2) + ")");
      const fim = falaDaEtapa(ETAPAS_DA_FESTA[ETAPAS_DA_FESTA.length - 1], r.estado);
      return { texto: semEmoji(fim.texto), botoes: [], cardapio: null, etapa: "registrado", pedidoId, rastro: r.rastro, uso };
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
    rastro: r.rastro,
    uso,
  };
}
