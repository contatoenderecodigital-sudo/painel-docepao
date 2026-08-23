// ============================================================================
//  O MOTOR DO FLUXO
//
//  Junta as tres pecas: sabe a etapa, le a mensagem dentro dela, aplica o que
//  mudou e devolve o que a padaria vai dizer.
//
//  E UMA FUNCAO, NAO UM LACO
//
//  Recebe (estado, mensagem) e devolve (estado novo, fala). Sem laco de
//  ferramentas, sem a IA decidindo quantas voltas dar. A versao antiga tinha um
//  laco em que o modelo chamava ferramenta, lia a recusa, chamava de novo, e
//  numa conversa real ele chamou registrar_pedido CINCO vezes seguidas levando
//  a mesma negativa, ate a conversa morrer num "deixa eu chamar alguem da
//  equipe".
//
//  Aqui nao ha volta: uma mensagem entra, uma resposta sai.
//
//  BOTAO NAO CUSTA NADA
//
//  Quando a resposta e um botao, o id ja diz tudo e a IA nem e chamada. Em uma
//  festa inteira sao seis ou sete toques que deixam de virar chamada paga.
//
//  A CHAMADA DA IA VEM DE FORA
//
//  `pensar` e injetado por quem chama. Em producao e a OpenAI; no teste e uma
//  resposta gravada. E assim que o fluxo inteiro se testa sem gastar credito, e
//  foi por nao ter isso que a versao antiga so podia ser testada conversando
//  com o robo de verdade.
// ============================================================================

import catalogo from "../dados/catalogo.json";
import { ETAPAS_DA_FESTA, etapaDaVez, type Etapa, type EtapaId, type PedidoEmMontagem } from "./etapas";
import { falaDaEtapa, type Fala } from "./pergunta";
import { instrucaoDaEtapa, leituraQueCabeNaEtapa, type Leitura } from "./leitura";
import { calcularBase, baseVirandoItens } from "./base";

/** O estado da conversa. E tudo que existe: nao ha memoria escondida. */
export type Estado = PedidoEmMontagem & {
  /**
   * A etapa pra onde voltar depois de resolver um desvio.
   *
   * "na verdade quero trocar o bolo" no meio dos docinhos: o fluxo vai pro
   * bolo, resolve, e volta pro docinho. Decidido com o dono em 23/08/2026,
   * porque resolver de longe e o que fazia a IA mexer no item errado.
   */
  retomarEm?: EtapaId | null;

  /**
   * A ETAPA QUE O CLIENTE POS NA MESA.
   *
   * Print do dono, 23/08/2026: ele perguntou "vcs fazem bolo?" e recebeu "O que
   * voce gostaria?". Perguntou de novo, palavra por palavra, e recebeu a mesma
   * volta. Quem pergunta duas vezes a mesma coisa nao esta insistindo, esta sem
   * resposta.
   *
   * Acontecia porque perguntar nao anota item nenhum: sem item, a abertura
   * continuava sendo a etapa da vez, e a abertura pergunta "o que voce precisa"
   * pra sempre.
   *
   * Aqui fica o que ele falou, e vale ate aquela etapa se resolver. Enquanto
   * durar, a conversa e sobre ISSO: quem pergunta de bolo ouve falar de bolo.
   */
  assunto?: EtapaId | null;
};

/** Quem chama o modelo. Injetado pra dar pra testar sem gastar. */
export type Pensar = (args: { instrucao: string; mensagem: string }) => Promise<Leitura>;

export type Resposta = {
  fala: Fala;
  estado: Estado;
  etapa: EtapaId;
  /** O que aconteceu, em linhas curtas. Vai pro log e pro painel. */
  rastro: string[];
  /** Chamou a IA? Botao nao chama, e isso e dinheiro. */
  chamouIA: boolean;
  /**
   * ELE CONFIRMOU ESCREVENDO, sem tocar no botao.
   *
   * Vale so na etapa da confirmacao: "pode fechar" no meio dos docinhos e
   * conversa, nao e ordem de fechar pedido.
   */
  confirmouEscrevendo: boolean;
};

/**
 * O QUE CADA BOTAO SIGNIFICA.
 *
 * Lista fechada: id que nao esta aqui e tratado como texto. O id vem do proprio
 * codigo (pergunta.ts), entao nao ha o que interpretar.
 */
const DO_BOTAO: Record<string, (e: Estado) => Estado> = {
  base_sim: (e) => ({ ...e, baseAceita: true }),
  base_ajustar: (e) => ({ ...e, baseAceita: false }),
  peca_os_dois: (e) => ({ ...e, pecas: { topo: true, papelDeArroz: true } }),
  peca_so_topo: (e) => ({ ...e, pecas: { topo: true, papelDeArroz: false } }),
  peca_nenhum: (e) => ({ ...e, pecas: { topo: false, papelDeArroz: false } }),
  pag_pix: (e) => ({ ...e, dados: { ...e.dados, pagamento: "pix" } }),
  pag_cartao: (e) => ({ ...e, dados: { ...e.dados, pagamento: "cartao" } }),
  pag_dinheiro: (e) => ({ ...e, dados: { ...e.dados, pagamento: "dinheiro" } }),
  // "Mudar algo", no resumo final. Nao muda nada sozinho de proposito: quem
  // sabe o que ele quer mudar e ele, e a proxima fala dele diz. O que este
  // botao faz e desmarcar o aceite da proposta, pra conversa nao ficar tentando
  // fechar enquanto ele resolve.
  fecha_mudar: (e) => ({ ...e, retomarEm: null, assunto: null }),
};

// OS BOTOES FANTASMA SAIRAM DAQUI.
//
// salgado_sim, salgado_nao, mais_sim e mais_nao estavam nesta lista e NENHUMA
// etapa oferecia eles: codigo que nao roda, mas que quem le acredita. Pior: so
// o salgado tinha recusa, e o dono pediu explicitamente que as familias
// seguissem as mesmas regras. A recusa agora e por texto e vale nas tres
// (leitura.ts), que e o jeito que funciona tambem fora da janela de 24 horas,
// quando o WhatsApp nao deixa mandar botao nenhum.

/**
 * A CATEGORIA DO ITEM VEM DA ETAPA.
 *
 * Defeito que o teste pegou antes de ir pro ar: os itens entravam sem categoria
 * e a etapa do salgado nunca se dava por cumprida, entao a conversa ficava
 * presa perguntando salgado pra sempre, mesmo com coxinha e risolis anotados.
 *
 * A etapa e justamente quem sabe: estando no passo do salgado, o item e
 * salgado. Frito ou assado sai do cardapio, que e a mesma fonte do preco.
 */
function categoriaDaEtapa(etapa: EtapaId, produto: string): string {
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const nome = semAc(produto);
  if (etapa === "salgado") {
    const assados = ((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => semAc(i.nome));
    return assados.some((a) => nome === a || nome.startsWith(a + " ")) ? "salgado_assado" : "salgado_frito";
  }
  if (etapa === "docinho") return "docinho";
  if (etapa === "bolo") return "bolo_festa";
  return "outro";
}

/** Aplica no estado o que a IA leu. Nada entra sem passar por aqui. */
function aplicar(e: Estado, l: Leitura, etapa: EtapaId): Estado {
  let novo: Estado = { ...e };

  if (l.ehFesta === true) novo.ehFesta = true;
  // Numero de pessoas E festa, mesmo que ele nao tenha usado a palavra: quem
  // diz "somos 20" esta organizando alguma coisa.
  if (typeof l.pessoas === "number" && l.pessoas > 0) {
    novo.pessoas = l.pessoas;
    novo.ehFesta = true;
  }
  if (l.aceitouBase === true) novo.baseAceita = true;
  if (l.pecas) novo.pecas = l.pecas;
  if (l.naoQuer?.length) novo.naoQuer = [...novo.naoQuer, ...l.naoQuer];

  if (l.dados) {
    novo.dados = {
      nome: l.dados.nome ?? novo.dados.nome,
      data: l.dados.data ?? novo.dados.data,
      hora: l.dados.hora ?? novo.dados.hora,
      pagamento: l.dados.pagamento ?? novo.dados.pagamento,
    };
  }

  if (l.itens?.length) {
    const itens = [...novo.itens];
    for (const i of l.itens) {
      const mesmo = (x: { produto: string }) =>
        x.produto.toLowerCase().trim() === String(i.produto).toLowerCase().trim();
      const achou = itens.findIndex(mesmo);
      const linha = {
        produto: String(i.produto),
        categoria: categoriaDaEtapa(etapa, String(i.produto)),
        qtd: Number(i.qtd) || 0,
        obs: i.obs ?? null,
      };
      // Repetir o mesmo item SUBSTITUI, nao soma: "na verdade quero 200" e
      // correcao, nao pedido de mais 200. Somar ja dobrou pedido de festa.
      if (achou >= 0) itens[achou] = { ...itens[achou], ...linha };
      else itens.push(linha);
    }
    novo.itens = itens;
  }

  return novo;
}

/**
 * UMA MENSAGEM ENTRA, UMA RESPOSTA SAI.
 */
export async function responder(
  estadoAtual: Estado,
  mensagem: { texto: string; botaoId?: string | null },
  pensar: Pensar,
  etapas: Etapa[] = ETAPAS_DA_FESTA,
): Promise<Resposta> {
  const rastro: string[] = [];
  let estado: Estado = { ...estadoAtual };
  let chamouIA = false;
  let naoTemos: string[] = [];
  let confirmouEscrevendo = false;

  const etapaAgora = etapaDaVez(estado, etapas);
  rastro.push("etapa: " + etapaAgora.id);

  // ---------------------------------------------------------------- botao
  if (mensagem.botaoId && DO_BOTAO[mensagem.botaoId]) {
    estado = DO_BOTAO[mensagem.botaoId](estado);
    rastro.push("botao: " + mensagem.botaoId + " (sem chamar a IA)");
  } else if (mensagem.texto.trim()) {
    // ----------------------------------------------------------- texto livre
    const instrucao = instrucaoDaEtapa(etapaAgora.id, estado);
    const crua = await pensar({ instrucao, mensagem: mensagem.texto });
    chamouIA = true;

    const { limpa, barrados } = leituraQueCabeNaEtapa(etapaAgora.id, crua);
    if (barrados.length) rastro.push("barrado nesta etapa: " + barrados.join(", "));
    // O que foi barrado por NAO EXISTIR no cardapio vira aviso pro cliente. O
    // que foi barrado por ser de outra familia nao: aquele a conversa resolve
    // indo pra etapa certa, e dizer "a gente nao faz brigadeiro" seria mentira.
    naoTemos = barrados.filter((b) => !/e docinho, nao bolo/.test(b));

    // ELE FALOU DE OUTRA ETAPA: VAI PRA LA E VOLTA DEPOIS.
    if (limpa.falouDeOutraEtapa && limpa.falouDeOutraEtapa !== etapaAgora.id) {
      // So marca a volta se a etapa de agora ainda nao estava resolvida: quem
      // termina o docinho e vai pro bolo nao precisa "voltar" pro docinho.
      const voltar = !etapaAgora.cumprida(estado) ? etapaAgora.id : estado.retomarEm ?? null;
      // O que ele trouxe vira o assunto, e o assunto sobrevive a mensagem: no
      // WhatsApp a proxima chega numa chamada nova, com o estado lido do banco.
      estado = { ...estado, retomarEm: voltar, assunto: limpa.falouDeOutraEtapa };
      rastro.push("falou de " + limpa.falouDeOutraEtapa + "; retomo em " + (voltar ?? "nada"));
    }

    // SO NA ETAPA DA CONFIRMACAO, E COM O PEDIDO NA TELA DELE.
    //
    // "pode ser" no meio dos docinhos e conversa; "pode ser" embaixo do resumo
    // de R$ 543,00 e ordem de fechar. O que separa os dois e a etapa, e por isso
    // isto e conferido aqui e nao no prompt.
    if (limpa.confirmou && etapaAgora.id === "confirmacao") {
      confirmouEscrevendo = true;
      rastro.push("confirmou escrevendo, sem tocar no botao");
    }

    estado = aplicar(estado, limpa, etapaAgora.id);
  }

  // ------------------------------------------- a base, calculada e aceita
  //
  // Duas coisas que o primeiro teste com conversa real mostrou faltando:
  //
  //   a base saia com "0 docinhos e 0 kg de bolo" porque eu pedia ao motor sem
  //   dizer quais familias entram;
  //
  //   e aceitar a base nao anotava nada, entao o pedido continuava vazio
  //   depois de um aceite de R$ 418,80 (a conversa do Sandro, de 22/08).
  if (estado.pessoas && !estado.base) {
    estado = { ...estado, base: calcularBase(estado) };
    if (estado.base) {
      rastro.push(
        "base: " + estado.base.salgados + " salgados, " + estado.base.docinhos +
          " docinhos, " + estado.base.boloKg + " kg de bolo",
      );
    }
  }
  if (estado.baseAceita && estado.base && !estado.itens.length) {
    const novos = baseVirandoItens(estado.base, estado);
    if (novos.length) {
      estado = { ...estado, itens: [...estado.itens, ...novos] };
      rastro.push("base aceita virou pedido: " + novos.map((i) => i.qtd + " " + i.produto).join(", "));
    }
  }

  // ------------------------------------------------- a etapa seguinte
  let proxima = etapaDaVez(estado, etapas);

  // A volta so acontece quando o desvio ja se resolveu, senao a conversa fica
  // pulando entre duas etapas sem terminar nenhuma.
  if (estado.retomarEm && estado.retomarEm !== proxima.id) {
    const alvo = etapas.find((x) => x.id === estado.retomarEm);
    if (alvo && !alvo.cumprida(estado) && !alvo.pulavel?.(estado)) {
      proxima = alvo;
      rastro.push("retomando em " + alvo.id);
    }
    if (alvo?.cumprida(estado)) estado = { ...estado, retomarEm: null };
  }
  if (proxima.id === estado.retomarEm) estado = { ...estado, retomarEm: null };

  // ------------------------------------- O ASSUNTO E DELE, NAO DA MINHA LISTA
  //
  // "vcs fazem bolo?" nao anota item nenhum, entao a lista de etapas continuava
  // apontando pra abertura e ele ouvia "o que voce precisa?" de novo. Duas
  // vezes, no print de 23/08/2026.
  //
  // Etapa pulavel quer dizer "nao pergunto por conta propria", e nunca quis
  // dizer "nao falo disso nem se ele pedir": pedido simples nao ouve falar de
  // bolo por iniciativa da padaria, mas quem PERGUNTA de bolo tem que ouvir
  // falar de bolo. Por isso aqui o pulavel nao vale, e a etapa cumprida sim:
  // assunto ja resolvido nao volta pra mesa.
  if (estado.assunto && estado.assunto !== proxima.id) {
    const alvo = etapas.find((x) => x.id === estado.assunto);
    if (alvo && !alvo.cumprida(estado)) {
      proxima = alvo;
      rastro.push("o assunto e " + alvo.id + " (foi ele quem trouxe)");
    } else {
      estado = { ...estado, assunto: null };
    }
  } else if (estado.assunto === proxima.id && proxima.cumprida(estado)) {
    estado = { ...estado, assunto: null };
  }

  // O aviso so vale se a conversa continuar na MESMA etapa: se ela ja andou, o
  // cliente resolveu e o "a gente nao faz" chegaria fora de hora.
  const fala = falaDaEtapa(proxima, estado, 0, proxima.id === etapaAgora.id ? naoTemos : []);
  rastro.push("proxima: " + proxima.id);

  return { fala, estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo };
}
