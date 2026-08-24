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
import { etapaDaVez, roteiroDoPedido, type Etapa, type EtapaId, type PedidoEmMontagem } from "./etapas";
import { falaDaEtapa, type Fala } from "./pergunta";
import { instrucaoDaEtapa, leituraQueCabeNaEtapa, type Leitura } from "./leitura";
import { calcularBase } from "./base";
import { motorPadrao, brl } from "../orcamento";
import { dataDeRetirada, disseQuantidade } from "./falas-do-cliente";
import { retiradaForaDoExpediente } from "@/lib/padaria-aberta";
import { coresDaForminha } from "./sabor";
import { respostaDeInformacao } from "./informacao";

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
  /**
   * A ULTIMA PERGUNTA QUE A PADARIA FEZ, e quantas vezes ela ja insistiu nela.
   *
   * Teste da Kemilly, 23/08/2026: a mesma pergunta do tema saiu TRES vezes
   * seguidas, quase igual, porque as respostas dela (uma foto sem legenda e
   * "escrito trintei em rosa") nao viravam dado. Do lado do cliente isso e o
   * sinal mais claro de que ninguem esta lendo.
   *
   * Repetir e sinal de que a pergunta nao esta funcionando: quem insiste tem
   * que mudar de tatica, nao aumentar o volume.
   */
  ultimaFala?: string | null;
  insistiu?: number;
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
  /**
   * A conversa precisa de gente.
   *
   * Hoje so acontece quando a padaria ja insistiu na mesma pergunta e nao saiu
   * do lugar. E o unico caminho que acende o aviso no painel da dona: ate
   * 23/08/2026 o aviso aparecia sem a IA ter chamado ninguem, por causa de
   * cliente de teste esquecido no banco.
   */
  precisaHumano: boolean;
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
  // Um de cada vez, e sem apagar a resposta do outro: quem responde do topo
  // ainda nao respondeu do papel, e vice-versa.
  topo_sim: (e) => ({ ...e, pecas: { topo: true, papelDeArroz: e.pecas?.papelDeArroz ?? null } }),
  topo_nao: (e) => ({ ...e, pecas: { topo: false, papelDeArroz: e.pecas?.papelDeArroz ?? null } }),
  papel_sim: (e) => ({ ...e, pecas: { topo: e.pecas?.topo ?? null, papelDeArroz: true } }),
  papel_nao: (e) => ({ ...e, pecas: { topo: e.pecas?.topo ?? null, papelDeArroz: false } }),
  pag_pix: (e) => ({ ...e, dados: { ...e.dados, pagamento: "pix" } }),
  pag_cartao: (e) => ({ ...e, dados: { ...e.dados, pagamento: "cartao" } }),
  pag_dinheiro: (e) => ({ ...e, dados: { ...e.dados, pagamento: "dinheiro" } }),
  // Como o bolo vai embalado. A dona pergunta sempre, e sao duas opcoes exatas.
  prato_aberto: (e) => ({ ...e, prato: "aberto" }),
  prato_tampa: (e) => ({ ...e, prato: "tampa" }),

  // A oferta: aceitar leva pra etapa da familia, recusar segue pros dados. Nos
  // tres casos ela fica marcada como feita, porque oferta repetida vira empurra.
  oferta_docinho: (e) => ({ ...e, ofereceu: true, assunto: "docinho" }),
  oferta_bolo: (e) => ({ ...e, ofereceu: true, assunto: "bolo" }),
  oferta_nao: (e) => ({ ...e, ofereceu: true }),

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

  // FORA DAS ETAPAS DE FAMILIA, QUEM DIZ A CATEGORIA E O CATALOGO.
  //
  // Teste da Kemilly, 23/08/2026: ela abriu com "quero encomendar bolo,
  // beijinhos e cajuzinhos pra minha festa de 30 anos". Os tres foram lidos
  // certo pela IA e entraram como "outro", porque a etapa era a abertura e eu
  // so sabia dar categoria dentro da etapa da familia. No painel da dona
  // apareceu "Outro / bolo / 0 quilos", e o dono viu na hora: "a IA nao pode
  // fazer isso".
  //
  // O nome do produto ja diz de que familia ele e, e essa informacao mora no
  // catalogo. Nao havia motivo pra depender da etapa.
  return categoriaDoCatalogo(nome);
}

/**
 * DE QUE FAMILIA E ESTE PRODUTO, SEGUNDO O CARDAPIO.
 *
 * Casa pelo comeco do nome, sem acento: "esfirra de carne" e uma esfirra. O que
 * o cardapio nao conhece volta como "outro", que e honesto: melhor a dona ver
 * "outro" na tela e corrigir do que o sistema chutar familia errada e a comanda
 * sair no setor errado da cozinha.
 */
function categoriaDoCatalogo(nome: string): string {
  const semAc = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const bate = (lista: { nome?: string }[]) =>
    (lista ?? []).some((i) => {
      const n = semAc(i.nome ?? "");
      return n && (nome === n || nome.startsWith(n + " ") || nome.startsWith(n + ","));
    });

  if (bate((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[])) return "salgado_frito";
  if (bate((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[])) return "salgado_assado";
  if (bate((catalogo.doces?.itens ?? []) as { nome: string }[])) return "docinho";

  // Bolo de festa: o sabor E o nome do produto ("marta rocha", "4 leites").
  const saboresDeBolo = ((catalogo.bolos_recheados?.faixas ?? []) as { sabores?: string[] }[])
    .flatMap((f) => f.sabores ?? []);
  if (saboresDeBolo.some((sb) => nome === semAc(sb) || nome.startsWith(semAc(sb)))) return "bolo_festa";
  if (nome === "bolo" || nome.startsWith("bolo ")) return "bolo_festa";

  const outros = (catalogo.outros_produtos ?? []) as { nome?: string; categoria?: string }[];
  const achou = outros.find((o) => {
    const n = semAc(o.nome ?? "");
    return n && (nome === n || nome.startsWith(n + " "));
  });
  if (achou?.categoria) return String(achou.categoria);

  return "outro";
}

/** Aplica no estado o que a IA leu. Nada entra sem passar por aqui. */
/**
 * O CLIENTE ESCOLHE O SABOR; A PROPOSTA DIZ QUANTO.
 *
 * Ele escreve "quero coxinha, risoles e esfirra" e nao fala numero nenhum,
 * porque o numero ja foi combinado: sao os 300 salgados da proposta que ele
 * aceitou. Entao o codigo reparte os 300 entre os tres, com o resto na primeira
 * linha pra soma bater exatamente.
 *
 * SE ELE DISSER A QUANTIDADE, A DELE MANDA. Quem escreve "200 coxinhas" quer
 * 200 coxinhas, e a proposta era proposta, nao contrato.
 */
function repartirABase(e: Estado, rastro: string[], falaDoCliente = ""): Estado {
  if (!e.baseAceita || !e.base) return e;

  // ELE DISSE ALGUM NUMERO NESTA MENSAGEM?
  //
  // Teste da Kemilly, 23/08/2026: ela escreveu "coxinha e mini bolha de carne",
  // sem numero nenhum, e o pedido saiu com 1 coxinha e 1 mini bolha. A proposta
  // de 200 salgados que ela tinha acabado de aceitar nao foi repartida.
  //
  // A instrucao mandava o modelo devolver zero quando ele nao dissesse a
  // quantidade, e o modelo devolveu 1. Prompt pede, codigo garante: quem sabe
  // se houve numero e a MENSAGEM, nao o modelo. Sem digito na fala, a
  // quantidade e da proposta, e o que o modelo mandou nao vale.
  const disseNumero = disseQuantidade(String(falaDoCliente));

  const alvos: [string, number][] = [
    ["salgado", e.base.salgados],
    ["docinho", e.base.docinhos],
    ["bolo", e.base.boloKg],
  ];

  let itens = [...e.itens];
  for (const [familia, total] of alvos) {
    if (!total) continue;
    const daFamilia = itens
      .map((i, idx) => ({ i, idx }))
      .filter(({ i }) => String(i.categoria || "").startsWith(familia));
    if (!daFamilia.length) continue;

    // Sem numero na fala dele, TODAS as linhas da familia entram na divisao,
    // mesmo as que ja tem quantidade: aquele numero nao veio dele. Com numero na
    // fala, respeita o que ele disse e so completa quem ficou sem.
    const semQtd = disseNumero ? daFamilia.filter(({ i }) => !(Number(i.qtd) > 0)) : daFamilia;
    if (!semQtd.length) continue;

    const jaEscolhido = disseNumero
      ? daFamilia.reduce((s, { i }) => s + (Number(i.qtd) > 0 ? Number(i.qtd) : 0), 0)
      : 0;
    const sobra = Math.max(0, total - jaEscolhido);
    if (!sobra) continue;

    const cada = Math.floor(sobra / semQtd.length);
    const resto = sobra - cada * semQtd.length;
    semQtd.forEach(({ idx }, ordem) => {
      itens[idx] = { ...itens[idx], qtd: cada + (ordem === 0 ? resto : 0) };
    });
    rastro.push("reparti " + sobra + " de " + familia + " entre " + semQtd.length + " escolha(s)");
  }

  return itens === e.itens ? e : { ...e, itens };
}

/** Tira uma marca da observacao dos itens ("Topo: tema Minnie, Arthur, 5 anos"). */
function tirarMarca(itens: Estado["itens"], prefixo: string): Estado["itens"] {
  return itens.map((i) => {
    const obs = String(i.obs ?? "");
    if (!obs.includes(prefixo)) return i;
    const limpo = obs.split(" | ").filter((x) => x && !x.startsWith(prefixo)).join(" | ");
    return { ...i, obs: limpo || null };
  });
}

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
  // Escrevendo tambem se responde, e so o que ele falou entra: dizer "quero
  // topo" nao pode apagar o papel de arroz que ele ja tinha recusado.
  if (l.pecas) {
    novo.pecas = {
      topo: typeof l.pecas.topo === "boolean" ? l.pecas.topo : (novo.pecas?.topo ?? null),
      papelDeArroz:
        typeof l.pecas.papelDeArroz === "boolean"
          ? l.pecas.papelDeArroz
          : (novo.pecas?.papelDeArroz ?? null),
    };
  }
  if (l.aniversariante?.nome) novo.topoNome = String(l.aniversariante.nome).trim();
  if (l.aniversariante?.idade) novo.topoIdade = String(l.aniversariante.idade).trim();
  if (l.tema) novo.tema = String(l.tema).trim();
  if (l.forminha) novo.forminha = String(l.forminha).trim();
  // A COR VAI PARA CADA DOCINHO, NAO PARA UMA OBSERVACAO GERAL.
  //
  // "quero azul e rosa" com cajuzinho e beijinho na mesa e duas respostas, nao
  // uma frase: a primeira cor pro primeiro docinho, a segunda pro segundo. E o
  // que uma atendente faria, e e o que a comanda precisa, porque a dona monta a
  // forminha antes de rechear.
  if (l.forminha) {
    const cores = coresDaForminha(String(l.forminha));
    if (cores.length) {
      const docinhos = novo.itens
        .map((i, idx) => ({ i, idx }))
        .filter(({ i }) => String(i.categoria || "").startsWith("docinho"));
      const itens = [...novo.itens];
      docinhos.forEach(({ idx }, n) => {
        // Uma cor so vale pra todos; varias vao na ordem em que ele falou. Se
        // ele falou menos cores que docinhos, os que sobram ficam sem, e a
        // padaria pergunta a cor daquele item.
        const cor = cores.length === 1 ? cores[0] : cores[n];
        if (!cor) return;
        const obs = String(itens[idx].obs ?? "")
          .split(" | ")
          .filter((x) => x && !/^forminha /i.test(x))
          .join(" | ");
        itens[idx] = { ...itens[idx], obs: [obs, "forminha " + cor].filter(Boolean).join(" | ") };
      });
      novo.itens = itens;
    }
  }
  if (l.prato) novo.prato = l.prato;
  // ------------------------------------------------- "NAO QUERO" DESFAZ
  //
  // Toda pergunta sabia gravar sim e gravar nao, e nao sabia VOLTAR ATRAS. Foi o
  // beco do teste da Kemilly, 23/08/2026:
  //
  //   Dora:    O nome do topo vai ser qual?
  //   Kemilly: nao quero topo
  //   Dora:    Em nome de quem vai o topo?
  //   Kemilly: nao quero topo de bolo
  //   Dora:    Para quem eu coloco o nome no topo?
  //
  // Ela tinha um "sim" gravado (que nem era dela: veio de uma pergunta que a
  // reescrita trocou) e nao havia como desdizer. Agora recusa apaga o que
  // estava preso naquela resposta, e a conversa anda.
  if (l.naoQuer?.length) {
    novo.naoQuer = [...novo.naoQuer, ...l.naoQuer];
    const recusou = (o: string) => l.naoQuer!.some((x) => new RegExp(o, "i").test(String(x)));

    if (recusou("topo")) {
      novo.pecas = { topo: false, papelDeArroz: novo.pecas?.papelDeArroz ?? null };
      // O nome e a idade eram do topo. Sem topo, eles nao tem dono, a menos que
      // o papel de arroz continue de pe: ele tambem e fabricado com os dois.
      if (novo.pecas.papelDeArroz !== true) {
        novo.topoNome = null;
        novo.topoIdade = null;
      }
      novo.itens = tirarMarca(novo.itens, "Topo: ");
    }
    if (recusou("papel")) {
      novo.pecas = { topo: novo.pecas?.topo ?? null, papelDeArroz: false };
      novo.itens = novo.itens.filter((i) => !/papel de arroz/i.test(i.produto));
    }
    // Recusar uma familia tira o que ja estava anotado dela: quem diz "sem
    // docinho" depois de ter escolhido dois nao quer os dois no pedido.
    for (const [palavra, prefixo] of [["salgado", "salgado"], ["docinho|doce", "docinho"], ["bolo", "bolo"]] as const) {
      if (recusou(palavra)) {
        novo.itens = novo.itens.filter((i) => !String(i.categoria || "").startsWith(prefixo));
      }
    }
  }

  if (l.dados) {
    novo.dados = {
      nome: l.dados.nome ?? novo.dados.nome,
      // A DATA PASSA PELA CONFERENCIA DO CODIGO.
      //
      // O modelo escreveu "05/09/2024" pra quem disse "dia 05 de setembro" em
      // agosto de 2026. Data que nao da pra entender vira null, e null faz a
      // padaria perguntar de novo em vez de anotar dia inventado.
      data: dataDeRetirada(l.dados.data) ?? novo.dados.data,
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
  // O roteiro pode vir de fora (os testes passam o deles). Sem ele, quem
  // escolhe e o tipo do pedido, e a escolha e refeita DEPOIS de ler a mensagem:
  // "festa pra 20 pessoas" troca o roteiro no meio da propria mensagem.
  etapas: Etapa[] | null = null,
): Promise<Resposta> {
  const rastro: string[] = [];
  let estado: Estado = { ...estadoAtual };
  let chamouIA = false;
  let naoTemos: string[] = [];
  let confirmouEscrevendo = false;
  let precisaHumano = false;

  const roteiro = () => etapas ?? roteiroDoPedido(estado);
  const etapaAgora = etapaDaVez(estado, roteiro());
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

    // ------------------------------------------ ELE SO PERGUNTOU: RESPONDE
    //
    // Terceiro roteiro, o da informacao. A resposta sai do codigo com o dado da
    // casa (preco do cardapio, horario, endereco) e NADA e anotado no pedido:
    // perguntar nao e pedir. No sistema antigo, "0% lactose nao e sem acucar
    // ne?" virou um bolo 0% lactose no pedido da cliente.
    //
    // A conversa nao sai do lugar: ele continua na mesma etapa, e a proxima
    // mensagem dele segue de onde parou.
    if (limpa.perguntou?.sobre) {
      // "QUANTO FICA?" NO MEIO DO PEDIDO E O TOTAL DELE, NAO TABELA DE PRECO.
      //
      // Teste da Kemilly: ela perguntou "quanto fica?" com o pedido montado e a
      // padaria respondeu perguntando a forma de pagamento. A pergunta caiu no
      // vazio porque nao tinha familia junto.
      const perguntouOTotal =
        limpa.perguntou.sobre === "preco" && !limpa.perguntou.familia && estado.itens.length > 0;
      const resposta = perguntouOTotal
        ? {
            texto:
              "Do jeito que está, seu pedido fica em " +
              brl(
                Number(
                  motorPadrao.cotarPorItens(
                    estado.itens.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })),
                  ).total || 0,
                ),
              ) + ".",
            precisaHumano: false,
          }
        : respostaDeInformacao(limpa.perguntou);
      if (resposta) {
        rastro.push("ele perguntou sobre " + limpa.perguntou.sobre + "; respondi sem anotar nada");
        return {
          fala: { texto: resposta.texto, botoes: [], cardapio: null, podeReescrever: false },
          estado,
          etapa: etapaAgora.id,
          rastro,
          chamouIA,
          confirmouEscrevendo: false,
          precisaHumano: resposta.precisaHumano,
        };
      }
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
  // ACEITAR A PROPOSTA NAO ESCOLHE SABOR NENHUM.
  //
  // Ate 23/08/2026 aceitar virava pedido pronto: o codigo pegava os cinco
  // salgados e os quatro docinhos mais pedidos e dividia a conta entre eles. O
  // dono viu isso no teste dele e chamou pelo nome: "escolheu os salgadinhos e
  // os docinhos sortidos por conta propria". A conversa pulava direto pro bolo
  // e o cliente nunca via o cardapio.
  //
  // A proposta diz QUANTO (300 salgados, 150 docinhos, 3 kg de bolo). QUAL e
  // dele, e e por isso que existem as etapas do salgado e do docinho, cada uma
  // com o cardapio junto.
  //
  // O que a base faz agora e guardar o total. Quando ele escolher os sabores
  // sem dizer quantidade, o codigo reparte esse total entre o que ele escolheu.
  estado = repartirABase(estado, rastro, mensagem.texto);

  // ------------------------------------------- as pecas do bolo viram pedido
  //
  // PAPEL DE ARROZ TEM PRECO DE TABELA; TOPO NAO TEM.
  //
  // Papel de arroz e produto: o motor cota, entra na conta e sai na comanda como
  // linha. Topo nao esta no motor de proposito, porque cada peca e orcada pela
  // equipe. Se ele virasse item, a conta ficaria com um produto de valor zero e
  // a comanda imprimiria duas vezes a mesma coisa, que e um defeito que ja
  // aconteceu aqui.
  //
  // Entao topo vira OBSERVACAO do bolo, que e onde a cozinha le o que escrever
  // na peca, e o valor fica pendente pra dona lancar na tela.
  if (estado.pecas?.papelDeArroz === true && !estado.itens.some((i) => /papel de arroz/i.test(i.produto))) {
    estado = {
      ...estado,
      itens: [...estado.itens, { produto: "papel de arroz", categoria: "papel_de_arroz", qtd: 1, obs: null }],
    };
    rastro.push("papel de arroz virou item do pedido");
  }
  // Como o bolo vai embalado, na observacao do bolo.
  if (estado.prato) {
    const marca = estado.prato === "aberto" ? "prato de MDF aberto" : "embalagem com tampa";
    const i = estado.itens.findIndex((x) => String(x.categoria || "").startsWith("bolo"));
    if (i >= 0 && !/prato de MDF|embalagem com tampa/i.test(String(estado.itens[i].obs ?? ""))) {
      const itens = [...estado.itens];
      itens[i] = { ...itens[i], obs: [itens[i].obs, marca].filter(Boolean).join(" | ") };
      estado = { ...estado, itens };
      rastro.push("anotei no bolo: " + marca);
    }
  }

  // CADA PECA LEVA A SUA PROPRIA OBSERVACAO.
  //
  // O topo vira observacao do BOLO, porque nao e item; o papel de arroz vira
  // observacao da propria linha dele, que existe e tem preco. Assim cada ticket
  // impresso sai com o que aquela peca precisa, e nada aparece duas vezes, que
  // e um defeito que ja saiu no papel aqui.
  const descricao = [estado.tema ? "tema " + estado.tema : "", estado.topoNome, estado.topoIdade]
    .filter(Boolean)
    .join(", ");
  if (descricao) {
    const anotar = (acharCategoria: (c: string) => boolean, prefixo: string) => {
      const i = estado.itens.findIndex((x) => acharCategoria(String(x.categoria || "")));
      if (i < 0) return;
      const marca = prefixo + descricao;
      if (String(estado.itens[i].obs ?? "").includes(marca)) return;
      const itens = [...estado.itens];
      // Substitui a marca anterior em vez de empilhar: o cliente pode trocar o
      // tema no meio da conversa, e a comanda nao pode sair com os dois.
      const limpo = String(itens[i].obs ?? "")
        .split(" | ")
        .filter((x) => x && !x.startsWith(prefixo))
        .join(" | ");
      itens[i] = { ...itens[i], obs: [limpo, marca].filter(Boolean).join(" | ") };
      estado = { ...estado, itens };
      rastro.push("anotei na comanda: " + marca);
    };
    if (estado.pecas?.topo === true) anotar((c) => c.startsWith("bolo"), "Topo: ");
    if (estado.pecas?.papelDeArroz === true) anotar((c) => c === "papel_de_arroz", "");
  }

  // ------------------------------------------- BOLO MISTO E UM BOLO SO
  //
  // Teste da Kemilly: ela pediu "4 leites e biz" e o pedido saiu com DOIS bolos
  // de um quilo. Ela queria um bolo com os dois sabores, que e o que qualquer
  // pessoa entende por "4 leites e biz".
  //
  // Nota da dona no cardapio: "bolo misto vale o sabor mais caro". Entao o
  // pedido fica com o sabor caro na linha (pra conta sair certa) e os dois
  // escritos na observacao, que e o que a cozinha le.
  //
  // So junta quando ele NAO disse numero: "quero dois bolos de 1 kg" e outra
  // coisa, e ai sao dois mesmo.
  if (!disseQuantidade(String(mensagem.texto))) {
    // "bolo" sem sabor e marcador de lugar, nao sabor: e o que a proposta anota
    // e o que a IA le de "quero encomendar bolo". Ele sai da mistura, senao a
    // comanda pede "misto: bolo e 4 leites e biz".
    const bolos = estado.itens.filter(
      (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() !== "bolo",
    );
    const semSabor = estado.itens.filter(
      (i) => String(i.categoria || "").startsWith("bolo") && String(i.produto).trim().toLowerCase() === "bolo",
    );
    if (bolos.length > 1 || (bolos.length === 1 && semSabor.length)) {
      const preco = (nome: string) =>
        Number(motorPadrao.cotarPorItens([{ item: nome, qtd: 1 }]).total || 0);
      const caro = [...bolos].sort((a, b) => preco(b.produto) - preco(a.produto))[0];
      const sabores = bolos.map((b) => b.produto).join(" e ");
      const misto = bolos.length > 1 ? "misto: " + sabores : null;
      // O peso vem do maior dos dois, e do marcador tambem: a proposta anotou os
      // 2 kg no "bolo" sem sabor antes de ele escolher.
      const peso = [...bolos, ...semSabor].reduce((s, b) => Math.max(s, Number(b.qtd) || 0), 0);
      const outros = estado.itens.filter((i) => !String(i.categoria || "").startsWith("bolo"));
      estado = {
        ...estado,
        itens: [
          ...outros,
          { ...caro, qtd: peso, obs: [caro.obs, misto].filter(Boolean).join(" | ") || null },
        ],
      };
      rastro.push(
        misto
          ? "bolo misto: " + sabores + ", cotado pelo sabor mais caro (" + caro.produto + ")"
          : "o bolo sem sabor virou o bolo de " + caro.produto,
      );
    }
  }

  // ------------------------------------------------- a etapa seguinte
  let proxima = etapaDaVez(estado, roteiro());

  // A volta so acontece quando o desvio ja se resolveu, senao a conversa fica
  // pulando entre duas etapas sem terminar nenhuma.
  if (estado.retomarEm && estado.retomarEm !== proxima.id) {
    const alvo = roteiro().find((x) => x.id === estado.retomarEm);
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
    const lista = roteiro();
    const alvo = lista.find((x) => x.id === estado.assunto);
    // O ASSUNTO PODE VOLTAR, NAO PODE PULAR A FILA.
    //
    // Teste da Kemilly: ela abriu com "quero encomendar pra uma festa bolo e
    // docinhos e salgados" e a primeira pergunta foi o SABOR DO BOLO, antes de
    // "quantas pessoas" e antes da proposta. O assunto que ela trouxe atropelou
    // a ordem do roteiro, e ela escolheu bolo sem saber quanto ia dar.
    //
    // Voltar pra tras continua valendo ("na verdade quero trocar o docinho"), e
    // da abertura sai pra qualquer lugar, que e o caso de "vcs fazem bolo?".
    const daVez = lista.findIndex((x) => x.id === proxima.id);
    const doAssunto = lista.findIndex((x) => x.id === estado.assunto);
    const podeIr = proxima.id === "abertura" || doAssunto <= daVez;
    if (alvo && !alvo.cumprida(estado) && podeIr) {
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
  // O TOTAL SAI DO MOTOR, E EU ESTAVA MANDANDO ZERO.
  //
  // Teste do dono em 23/08/2026: o resumo do pedido dele, com onze linhas de
  // comida, terminava em "*Total: R$ 0,00*". Ele perguntou "total ficou 0
  // reais?" e recebeu o mesmo resumo de volta.
  //
  // Nao era o motor errando: era eu passando 0 no lugar do total, na unica
  // chamada que monta a fala. O numero certo estava a uma linha de distancia.
  const total = estado.itens.length
    ? Math.round(
        Number(
          motorPadrao.cotarPorItens(
            estado.itens.map((i) => ({ item: i.produto, qtd: i.qtd, obs: i.obs ?? undefined })),
          ).total || 0,
        ) * 100,
      )
    : 0;

  // A RETIRADA CABE NO EXPEDIENTE?
  //
  // Pedido do dono: hora que a padaria nao atende tem que ser DITA, nao
  // engolida. O horario sai de padaria-aberta.ts, o mesmo que a Dora usa pra
  // responder "que horas voces abrem": fonte unica, sem lista paralela.
  //
  // A hora que nao cabe e apagada, entao a etapa dos dados volta a perguntar, e
  // agora com o motivo na frente.
  const foraDoHorario = retiradaForaDoExpediente(estado.dados.data, estado.dados.hora);
  if (foraDoHorario) {
    estado = { ...estado, dados: { ...estado.dados, hora: null } };
    rastro.push("hora fora do expediente; avisei e perguntei de novo");
  }

  let fala = falaDaEtapa(proxima, estado, total, proxima.id === etapaAgora.id ? naoTemos : []);

  // ------------------------------------ A MESMA PERGUNTA NAO SAI DUAS VEZES
  //
  // Se ela vai repetir o que acabou de perguntar, alguma coisa nao funcionou: a
  // resposta do cliente nao virou dado. Repetir igual e o que faz ele achar que
  // ninguem leu, e foi o que aconteceu tres vezes com o tema.
  //
  // Na segunda vez ela mostra as opcoes, quando a pergunta tem lista. Na
  // terceira, para de insistir e chama a equipe: tem coisa que a padaria
  // resolve numa frase e a Dora nao resolve em dez.
  const mesmaPergunta = Boolean(estado.ultimaFala) && fala.texto === estado.ultimaFala;
  const insistiu = mesmaPergunta ? (estado.insistiu ?? 0) + 1 : 0;
  estado = { ...estado, ultimaFala: fala.texto || null, insistiu };

  if (insistiu === 1 && fala.opcoes?.length && !fala.texto.includes(fala.opcoes[0])) {
    fala = { ...fala, texto: fala.texto + "\n\nAs opções são: " + fala.opcoes.join(", ") + "." };
    rastro.push("repeti a pergunta; mostrei as opcoes");
  } else if (insistiu >= 2) {
    fala = {
      ...fala,
      texto:
        "Acho que não estou conseguindo entender direito por aqui. " +
        "Vou chamar uma pessoa da equipe pra te ajudar, tá bom?",
      botoes: [],
      cardapio: null,
      podeReescrever: false,
    };
    precisaHumano = true;
    rastro.push("insisti " + insistiu + " vezes na mesma pergunta; chamei a equipe");
  }

  if (foraDoHorario) {
    return {
      fala: { ...fala, texto: foraDoHorario, botoes: [], cardapio: null, podeReescrever: false },
      estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo, precisaHumano,
    };
  }
  rastro.push("proxima: " + proxima.id);

  return { fala, estado, etapa: proxima.id, rastro, chamouIA, confirmouEscrevendo, precisaHumano };
}
