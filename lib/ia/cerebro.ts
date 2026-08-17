// ============================================================================
//  CÉREBRO DA IA — o atendimento que conversa no WhatsApp.
//  Padrão OpenAI (function calling): conversa com a voz da Doce Pão e, pra
//  qualquer conta, chama a ferramenta de orçamento (código puro). Sabe quando
//  chamar humano.
//
//  Modelo: GPT-4o-mini por padrão (CUSTO + tool use confiável — atendimento é
//  alto volume). Trocável por env MODELO_IA.
//  Portabilidade: OPENAI_BASE_URL permite apontar pra outro provedor compatível
//  (Gemini, DeepSeek, OpenRouter...) sem reescrever nada.
// ============================================================================

import OpenAI from "openai";
import { CARDAPIOS, type CardapioId } from "@/lib/whatsapp/api";
import { montarSystemPrompt, DOCE_PAO, type ConfigNegocio } from "./persona";
import { motorPadrao, formatarOrcamento, brl, type Motor, type LinhaCotacao } from "./orcamento";
import { registrarUsoIA, type UsoTurno } from "./uso";
import catalogo from "./dados/catalogo.json";

const MODELO = process.env.MODELO_IA || "gpt-4o-mini";

// Formata quantidade + unidade pro resumo. Itens por quilo (bolo, tortas, empadão...)
// saem como "2 kg" / "1,5 kg"; por unidade como "20 un". A unidade vem do motor
// (fonte da verdade), a IA NUNCA decide isso de cabeça — evita o bug de bolo "2 un".
function fmtQtd(qtd: number, unidade?: "un" | "kg"): string {
  const u = unidade ?? "un";
  const n = u === "kg" ? String(qtd).replace(".", ",") : String(Math.round(qtd));
  return `${n} ${u}`;
}

// Um tenant = a persona (voz/regras) + o motor de orçamento (cardápio) do negócio.
// avisoDoDia: "cérebro temporário" do dia (já filtrado: só vem preenchido se for de hoje).
// sistemaCustom: cérebro PRÓPRIO do tenant (texto livre no config). Quando setado,
// o tenant NÃO é padaria: usa esse prompt e só a ferramenta de passar pro humano
// (nada de orçamento/comanda). É o que torna o sistema multi-nicho de verdade.
export type Tenant = {
  persona: ConfigNegocio;
  motor: Motor;
  // Id do negócio (para creditar o consumo de tokens em public.uso_ia). Vem do
  // carregarTenant(negocioId). Sem ele (tenant padrão de demo) a medição é pulada.
  negocioId?: string | null;
  avisoDoDia?: string | null;
  sistemaCustom?: string | null;
  // Provedor de IA ESCOLHIDO por este tenant (config): 'claude' | 'openai' | 'gemini'.
  // Assim um cliente usa Claude, outro ChatGPT, outro Gemini. Cai na cadeia global se falhar.
  provedorIa?: string | null;
  modeloIa?: string | null;
};

// As ferramentas que a IA pode chamar (formato OpenAI). Descrição prescritiva.
const FERRAMENTAS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "montar_orcamento",
      description:
        "Calcula o preço de uma encomenda. USE SEMPRE que precisar de um valor ou quantidade, nunca calcule de cabeça. Dois modos: 'itens' (o cliente disse o que quer, ex: 100 salgados assados) ou 'pessoas' (o cliente disse 'pra 50 pessoas' e você sugere a quantidade).",
      parameters: {
        type: "object",
        properties: {
          modo: { type: "string", enum: ["itens", "pessoas"] },
          itens: {
            type: "array",
            description: "Usado no modo 'itens'. Lista do que o cliente quer.",
            items: {
              type: "object",
              properties: {
                item: {
                  type: "string",
                  description:
                    "Nome do item como no cardápio: 'salgado assado', 'salgado frito', 'brigadeiro', 'trufa', 'bolo 4 leites', 'pizza inteira', etc.",
                },
                qtd: { type: "number" },
              },
              required: ["item", "qtd"],
            },
          },
          pessoas: { type: "number", description: "Usado no modo 'pessoas'." },
          quer: {
            type: "object",
            description: "Usado no modo 'pessoas': o que incluir na sugestão.",
            properties: {
              salgado: { type: "boolean" },
              doce: { type: "boolean" },
              bolo: { type: "boolean" },
            },
          },
        },
        required: ["modo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chamar_humano",
      description:
        "Passa a conversa pra equipe da padaria. USE quando: o cliente pede algo fora do cardápio ou muito específico (bolo de vários andares, decoração especial), está indeciso e precisa de conselho de verdade, ou você não sabe a resposta com certeza. Melhor passar do que inventar.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Por que está passando pra equipe (curto)." },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_cardapio",
      description:
        "Manda a FOTO do cardápio pro cliente. USE SEMPRE que ele pedir o cardápio, a lista de sabores, os tipos ou os preços de uma categoria inteira ('quais sabores de bolo?', 'me manda o cardápio', 'quanto custa os salgados?'). A imagem já tem todos os itens e preços: depois de chamar, NÃO escreva a lista em texto, só diga em uma linha que está mandando e pergunte o que a pessoa quer. Para preço de um item específico que o cliente já escolheu, use montar_orcamento em vez desta.",
      parameters: {
        type: "object",
        properties: {
          cardapios: {
            type: "array",
            description:
              "Quais peças mandar. Mande só as que respondem a pergunta (uma na maioria das vezes).",
            items: { type: "string", enum: [...CARDAPIOS] },
          },
        },
        required: ["cardapios"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cliente_aceitou_orcamento",
      description:
        "USE quando o cliente CONCORDAR com o valor atualizado que você mandou depois que a equipe informou o preço de algo (o topo de bolo, por exemplo). Vale qualquer forma de concordar: 'sim', 'ok', 'pode ser', um joinha, um 'fechou', ou qualquer coisa que signifique que ele aceitou. NÃO use se ele discordar, pedir desconto, mudar de ideia ou fizer outra pergunta: aí é conversa normal. NÃO use pra confirmar item ou quantidade no meio do pedido, só pro aceite do valor.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "anotar_item",
      description:
        "Anota UM item no pedido que está sendo montado, assim que o cliente decidir. Chame a cada item, no momento em que ele fala, sem esperar o fim. Se o item já estiver anotado, esta chamada CORRIGE (quantidade, observação): não duplica. Você não precisa lembrar do resto do pedido, ele já está guardado.",
      parameters: {
        type: "object",
        properties: {
          produto: {
            type: "string",
            description:
              "Nome do produto como está no cardápio: 'coxinha', 'pastel assado', 'brigadeiro', 'bolo brigadeiro', 'papel de arroz'.",
          },
          categoria: {
            type: "string",
            enum: ["bolo_festa", "bolo_caseiro", "docinho", "salgado_frito", "salgado_assado", "pizza", "por_quilo", "por_unidade", "cupcake", "papel_de_arroz", "outro"],
            description:
              "A família REAL do produto. É ela que separa o que tem nome igual: brigadeiro DOCINHO custa por unidade, bolo brigadeiro é bolo_festa e custa por quilo. Sem isso o bolo vira docinho. Empadinha, esfirra, croissant, pastel assado e enroladinho são salgado_assado; coxinha, risoles, bolinha e pastel frito são salgado_frito. Use por_unidade e por_quilo SÓ pro que não cabe em nenhuma família (cuca, pão doce, torta, empadão): é a cozinha que lê isso.",
          },
          qtd: { type: "number", description: "Quantidade. Em bolo_festa e por_quilo é o PESO em kg (ex 2 ou 1.5); no resto é o número de unidades." },
          obs: {
            type: ["string", "null"],
            description:
              "O que o cliente disse SOBRE ESTE item: recheio do assado, sabor da trufa, cor da forminha, e no bolo o pão de ló, tema, nome e idade do aniversariante. Use as palavras dele, nunca exemplo. Null se não houver.",
          },
        },
        required: ["produto", "categoria", "qtd", "obs"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "remover_item",
      description: "Tira um item do pedido em montagem, quando o cliente desistir dele.",
      parameters: {
        type: "object",
        properties: {
          produto: { type: "string" },
          categoria: { type: "string", enum: ["bolo_festa", "bolo_caseiro", "docinho", "salgado_frito", "salgado_assado", "pizza", "por_quilo", "por_unidade", "cupcake", "papel_de_arroz", "outro"] },
        },
        required: ["produto", "categoria"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "anotar_dados",
      description:
        "Anota os dados do pedido conforme o cliente for dizendo: nome de quem pede, data e hora da retirada, forma de pagamento, observação geral. Mande só o que ele acabou de informar; o resto continua guardado. Nunca invente: só mande o que ele disse.",
      parameters: {
        type: "object",
        properties: {
          cliente_nome: { type: ["string", "null"], description: "Nome de QUEM ESTÁ PEDINDO, não do aniversariante." },
          retirada_data: { type: ["string", "null"], description: "Como ele falou: '30/08', '1 do próximo mês', 'sábado que vem'." },
          retirada_hora: { type: ["string", "null"] },
          forma_pagamento: { type: ["string", "null"], description: "pix, cartao ou dinheiro." },
          observacoes: { type: ["string", "null"] },
        },
        required: ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento", "observacoes"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_pedido",
      description:
        "Registra o pedido pra equipe aprovar. USE só depois que o cliente confirmou o orçamento E informou o dia/hora da retirada.",
      parameters: {
        type: "object",
        properties: {
          cliente_nome: { type: ["string", "null"], description: "Nome de QUEM ESTA PEDINDO (nao o do aniversariante). null se ainda nao souber." },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: {
                  type: "string",
                  description:
                    "Nome ESPECÍFICO do item na tabela, nunca genérico. Use 'pastel assado', 'esfirra', 'coxinha', 'brigadeiro', 'trufa', 'bolo brigadeiro', 'papel de arroz'. NUNCA 'salgado assado', 'salgado frito' ou 'docinho' quando já sabe o tipo. Bolo e itens por quilo: qtd é o PESO em kg (ex 2 ou 1.5). NUNCA registre 'topo de bolo' como item (valor variável, vai só na obs + precisa_confirmacao).",
                },
                categoria: {
                  type: ["string", "null"],
                  enum: [
                    "bolo_festa",
                    "bolo_caseiro",
                    "docinho",
                    "salgado_frito",
                    "salgado_assado",
                    "pizza",
                    "por_quilo",
                    "por_unidade",
                    "cupcake",
                    "papel_de_arroz",
                    null,
                  ],
                  description:
                    "A FAMÍLIA do item, obrigatória. É ela que desfaz a ambiguidade: 'brigadeiro' com categoria bolo_festa é bolo por quilo; com categoria docinho é o docinho de unidade. bolo_festa e por_quilo têm qtd em KG; o resto em unidades.",
                },
                qtd: { type: "number" },
                obs: {
                  type: ["string", "null"],
                  description:
                    "Observação SÓ deste item, com o que O CLIENTE disse, nunca com exemplo. Formato do que costuma entrar: recheio do assado, sabor da trufa, cor da forminha do docinho, e no bolo o pão de ló, o tema, o nome e a idade do aniversariante e se tem foto. NUNCA copie tema ou nome de exemplo nenhum: já saiu pedido com 'topo da Moana, nome Vinicius, tema Toy Story' misturando exemplo com dado real, e a cozinha não sabe qual peça fazer. Cada observação no seu item.",
                },
              },
              required: ["item", "qtd", "obs", "categoria"],
              additionalProperties: false,
            },
          },
          retirada_data: { type: "string", description: "Dia da retirada, ex: 'sábado 25/07'." },
          forma_pagamento: {
            type: ["string", "null"],
            description:
              "Como o cliente disse que vai pagar: 'pix', 'cartao' ou 'dinheiro'. NUNCA invente nem assuma: se ele não falou, PERGUNTE antes de fechar.",
          },
          retirada_hora: { type: "string", description: "Hora, ex: '14:00'." },
          observacoes: { type: ["string", "null"] },
          precisa_confirmacao: {
            type: "boolean",
            description:
              "true quando o pedido está montado mas a EQUIPE precisa confirmar algo antes (pedido pra hoje/amanhã, valor de topo de bolo, item fora da tabela, bolo de vários andares). O pedido é registrado do mesmo jeito, só entra na fila com um aviso pra dona revisar.",
          },
          motivo_humano: {
            type: ["string", "null"],
            description:
              "Quando precisa_confirmacao=true, explique curto o que a equipe precisa confirmar. Ex: 'confirmar valor do topo de bolo', 'pedido pra amanhã, confirmar capacidade', 'item fora da tabela: bolo 3 andares'. Use null quando não houver.",
          },
        },
        // strict exige TODOS os campos em `required`; o que é opcional vira
        // nulável. É o que fecha a porta do "esqueci de mandar o campo": ela
        // escrevia "pix" no texto e deixava forma_pagamento vazia, e o pedido
        // chegava no painel sem forma de pagamento nenhuma.
        required: [
          "itens",
          "retirada_data",
          "cliente_nome",
          "forma_pagamento",
          "retirada_hora",
          "observacoes",
          "precisa_confirmacao",
          "motivo_humano",
        ],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

// O que já está anotado no pedido desta conversa, lido do banco pelo webhook e
// entregue ao cérebro. É a memória: sem isso, a IA teria que reconstruir o
// pedido inteiro pela leitura do histórico a cada mensagem, que é exatamente o
// que fazia o bolo virar docinho e a data virar hoje.
export type MontagemAtual = {
  itens: { produto: string; categoria: string; qtd: number; unidade: string; obs?: string | null }[];
  dados: Record<string, string | null | undefined>;
};

// Uma alteração no pedido em montagem. O executor é síncrono e o banco é I/O,
// então as mudanças são enfileiradas aqui e aplicadas pelo webhook depois do
// turno — mesmo padrão do enviar_cardapio.
export type MudancaMontagem =
  | { tipo: "item"; produto: string; categoria: string; qtd: number; obs?: string | null }
  | { tipo: "remover"; produto: string; categoria: string }
  | { tipo: "dados"; dados: Record<string, string | null> };

// Resultado de um turno da IA.
export type RespostaIA = {
  texto: string; // o que mandar de volta pro cliente
  precisaHumano: boolean; // se true, entra na fila de "precisa de você" do painel
  // Peças de cardápio que o webhook deve mandar como imagem logo depois do texto.
  cardapiosParaEnviar: CardapioId[];
  // Alterações a aplicar no pedido em montagem desta conversa.
  montagem?: MudancaMontagem[];
  // O cliente concordou com o valor atualizado (quem decide isso e a IA, que
  // entende "joinha", "fechou" e o que mais ele inventar).
  aceitouOrcamento?: boolean;
  pedidoRegistrado: null | {
    itens: { item: string; qtd: number; obs?: string }[];
    linhas: LinhaCotacao[]; // já calculado pelo motor do tenant (pro banco não recalcular)
    retiradaData: string;
    retiradaHora?: string;
    formaPagamento?: string;
    observacoes?: string;
    clienteNome?: string;
    totalCentavos: number;
    // Handoff inteligente: pedido montado mas com pendência de confirmação da equipe.
    // Cai na fila de aprovação JÁ MONTADO, com um aviso; não vira beco de humano.
    precisaConfirmacao?: boolean;
    motivoHumano?: string;
  };
};

// Formato simples de mensagem (desacoplado do SDK) — o que a persistência usa.
export type Mensagem = { role: "user" | "assistant"; content: string };

// Executa uma ferramenta e devolve o texto do resultado (o que a IA "vê").
// Usa o MOTOR do tenant (cardápio da padaria certa).
// Lê a forma de pagamento na fala do cliente. Devolve undefined quando ele não
// disse nada — e "não disse" é diferente de "disse dinheiro": a segunda é uma
// escolha, a primeira é um buraco que a equipe precisa fechar.
function detectarPagamento(fala: string): string | undefined {
  const t = fala.toLowerCase();
  if (/\bpix\b/.test(t)) return "pix";
  if (/cart[ãa]o|cr[ée]dito|d[ée]bito|parcel/.test(t)) return "cartao";
  if (/dinheiro|esp[ée]cie|\bvista\b/.test(t)) return "dinheiro";
  return undefined;
}


// Corta a pergunta a mais. A regra "uma pergunta por vez" está no prompt com
// exemplo, e ainda assim ela furou em 8 de 8 turnos num teste automatizado:
// "Anotei a data. Vamos começar pelos salgados? Prefere fritos ou assados?".
// A primeira pergunta é retórica e a segunda é a real, então guardamos a
// ÚLTIMA e jogamos fora as anteriores. O texto que não pergunta fica intacto.
// Cumprimento não conta como pergunta: "Oi, tudo bem?" é educação, e cortá-lo
// deixaria a Dora entrando seca na conversa.
const CORTESIA = /tudo bem|tudo certo|como vai|bom dia|boa tarde|boa noite/i;

// Dentro de um bloco com duas perguntas, fica a que CARREGA A INFORMAÇÃO, que
// é sempre a mais longa. Tentei antes ficar com a primeira e o resultado foi
// pior: "E dos croissants? Qual recheio prefere: carne, frango ou bacon?"
// virava só "E dos croissants?", que não diz nada. Nos outros casos a primeira
// é a longa mesmo ("quais docinhos você quer?" vs "quer que eu mande?"), então
// a regra do comprimento acerta os dois.
function perguntaQueVale(bloco: string): string {
  if ((bloco.match(/\?/g) || []).length < 2) return bloco;
  const frases = bloco.split(/(?<=\?)\s+/).filter((f) => f.trim());
  const perguntas = frases.filter((f) => f.includes("?"));
  if (perguntas.length < 2) return bloco;
  const melhor = perguntas.reduce((a, b) => (b.length > a.length ? b : a));
  const antes = frases.slice(0, frases.indexOf(perguntas[0])).join(" ");
  return (antes ? antes + " " : "") + melhor.trim();
}

function umaPerguntaSo(texto: string): string {
  const blocos = texto.split(/\n\s*\n/).map(perguntaQueVale);
  const indices = blocos
    .map((b, i) => (b.includes("?") && !CORTESIA.test(b) ? i : -1))
    .filter((i) => i >= 0);
  const manter = indices.length >= 2 ? indices[indices.length - 1] : -1;
  const limpo = manter < 0 ? blocos : blocos.filter((_, i) => !indices.includes(i) || i === manter);
  // Jargão interno vazando pro cliente: ela já escreveu "o bolo brigadeiro é
  // faixa B". Faixa é como a padaria organiza preço, não é assunto de quem
  // está pedindo bolo.
  return limpo
    .join("\n\n")
    .replace(/\s*(é|e|da|de|na)?\s*faixa\s+[abc]\b[,.]?/gi, "")
    // "anotei X na observação do bolo" é o sistema falando, não a atendente.
    // O cliente não sabe (nem quer saber) que existe um campo de observação.
    .replace(/\s*n[ao]s?\s+observa[çc][õo]es?\s+d[oa]s?\s+\w+/gi, "")
    .replace(/\s*n[ao]s?\s+observa[çc][õo]es?\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function executarFerramenta(
  nome: string,
  input: Record<string, unknown>,
  estado: { precisaHumano: boolean; pedido: RespostaIA["pedidoRegistrado"]; cardapios: CardapioId[]; resumo?: string; aceitouOrcamento?: boolean; montagem: MudancaMontagem[] },
  motor: Motor,
  falaDoCliente = "",
  montagemAtual?: MontagemAtual | null,
  pedidoAguardando = false,
): string {
  if (nome === "montar_orcamento") {
    if (input.modo === "itens") {
      const c = motor.cotarPorItens((input.itens as { item: string; qtd: number }[]) || []);
      return formatarOrcamento(c);
    }
    const c = motor.sugerirPorPessoas(
      Number(input.pessoas) || 0,
      (input.quer as { salgado?: boolean; doce?: boolean; bolo?: boolean }) || { salgado: true, doce: true },
    );
    // Nesta etapa o cliente ainda não escolheu NADA. A ferramenta precisa citar
    // um produto pra ter preço, mas anunciar "300 coxinhas e 150 brigadeiros"
    // faz a pessoa achar que já ficou decidido. Fale por categoria.
    return (
      formatarOrcamento(c, `Orçamento da festa de ${input.pessoas} pessoas`) +
      `
Ao falar esta sugestão pro cliente, use as palavras GENÉRICAS "salgados" e "docinhos" ` +
      `(ex: "300 salgados e 150 docinhos"), NUNCA o nome do produto que aparece nas linhas acima: ` +
      `ele ainda não escolheu os tipos, e citar um faz parecer que já está decidido. ` +
      `O valor e o total, esses sim, são os desta ferramenta.`
    );
  }

  if (nome === "cliente_aceitou_orcamento") {
    // Esta ferramenta e SO pro aceite do valor que a equipe ajustou depois de
    // ja existir pedido. Ela vinha sendo usada pro "pode fechar" do fim da
    // conversa: o pedido nunca era registrado e a fila ficava vazia, com o
    // cliente avisado de que estava tudo certo.
    if (!pedidoAguardando) {
      return (
        "NAO existe pedido nenhum esperando o aceite deste cliente, entao nao era esta a ferramenta. " +
        "Ele esta fechando o pedido agora: chame registrar_pedido com os dados que ja estao anotados."
      );
    }
    estado.aceitouOrcamento = true;
    return "Anotado: o cliente aceitou o valor. Responda com uma frase curta confirmando que voce ja passou pra equipe, e NAO chame registrar_pedido: o pedido ja esta montado e a equipe ja ajustou.";
  }

  if (nome === "anotar_item") {
    const produto = String(input.produto || "").trim();
    const categoria = String(input.categoria || "outro");
    const qtd = Number(input.qtd) || 0;
    if (!produto || qtd <= 0) return "Não anotei: preciso do produto e de uma quantidade maior que zero.";
    estado.montagem.push({ tipo: "item", produto, categoria, qtd, obs: input.obs ? String(input.obs) : null });
    return `Anotei ${qtd} de ${produto} no pedido. Continue a conversa normalmente; o pedido fica guardado e você não precisa repetir os itens anteriores.`;
  }

  if (nome === "remover_item") {
    estado.montagem.push({
      tipo: "remover",
      produto: String(input.produto || "").trim(),
      categoria: String(input.categoria || "outro"),
    });
    return "Tirei do pedido. O resto continua guardado.";
  }

  if (nome === "anotar_dados") {
    const dados: Record<string, string | null> = {};
    for (const k of ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento", "observacoes"]) {
      const v = input[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") dados[k] = String(v);
    }
    if (Object.keys(dados).length === 0) return "Nada pra anotar: não veio nenhum dado preenchido.";
    estado.montagem.push({ tipo: "dados", dados });
    return `Anotei: ${Object.keys(dados).join(", ")}. O resto do pedido continua guardado.`;
  }

  if (nome === "chamar_humano") {
    estado.precisaHumano = true;
    return "OK, marquei pra equipe assumir esta conversa. Avise o cliente com carinho que já já respondem.";
  }

  if (nome === "enviar_cardapio") {
    // A imagem sai depois, no webhook: aqui só marcamos qual peça mandar. O
    // executor é síncrono e o envio é I/O — misturar os dois travaria o turno.
    const pedidos = (Array.isArray(input.cardapios) ? input.cardapios : [input.cardapio])
      .map((c) => String(c || "").trim())
      .filter((c): c is CardapioId => (CARDAPIOS as readonly string[]).includes(c));
    if (!pedidos.length) return "Não conheço esse cardápio. Peça um destes: " + CARDAPIOS.join(", ");
    for (const c of pedidos) if (!estado.cardapios.includes(c)) estado.cardapios.push(c);
    return (
      `A imagem do cardápio (${pedidos.join(", ")}) já vai ser enviada logo depois da sua mensagem. ` +
      `NÃO liste os itens nem os preços em texto: só diga em uma linha curta que está mandando o cardápio ` +
      `e pergunte o que a pessoa quer.`
    );
  }

  if (nome === "registrar_pedido") {
    const daIA = (input.itens as { item: string; qtd: number; obs?: string; categoria?: string }[]) || [];

    // A LISTA VEM DO PEDIDO EM MONTAGEM, não da memória da IA.
    //
    // Enquanto o cliente falava, cada item foi anotado com a categoria certa e a
    // equipe pôde corrigir na tela. Reconstruir a lista de cabeça na hora de
    // fechar era o que apagava item, trocava bolo por docinho e perdia o papel
    // de arroz. Agora o que está anotado manda; a lista que ela mandou só
    // acrescenta o que por acaso não foi anotado.
    const anotados = (montagemAtual?.itens ?? []).map((i) => ({
      item: i.produto,
      qtd: Number(i.qtd) || 0,
      obs: i.obs ?? undefined,
      categoria: i.categoria || undefined,
    }));
    const chave = (x: { item?: string; categoria?: string }) =>
      String(x.item || "").trim().toLowerCase() + "|" + String(x.categoria || "");
    const vistos = new Set(anotados.map(chave));
    const brutos = anotados.length
      ? [...anotados, ...daIA.filter((i) => !vistos.has(chave(i)))]
      : daIA;
    // A CATEGORIA desfaz a ambiguidade antes de qualquer busca de preço.
    // "brigadeiro" sozinho é ambíguo: existe como docinho de R$ 1,25 e como
    // sabor de bolo de R$ 46,90 o quilo. Duas vezes o bolo de 2 kg virou
    // R$ 2,50 e a festa foi pra cozinha sem bolo. Agora a IA é obrigada a
    // dizer de que família é o item, e aqui o nome é normalizado com base nisso.
    const itens = brutos.map((i) => {
      const nomeItem = String(i.item || "").trim();
      const cat = String(i.categoria || "");
      const jaEhBolo = /^bolo\b/i.test(nomeItem);
      if ((cat === "bolo_festa" || cat === "bolo_caseiro") && !jaEhBolo) {
        return { ...i, item: "bolo " + nomeItem };
      }
      if (cat === "papel_de_arroz") return { ...i, item: "papel de arroz" };
      return i;
    });
    const c = motor.cotarPorItens(itens.filter((i) => Number(i.qtd) > 0));
    // PEDIDO VAZIO NÃO EXISTE.
    //
    // Depois que o cliente aceitou o orçamento com um "Ok", ela chamou
    // registrar_pedido de novo sem item nenhum e mandou "*Pedido recebido* /
    // Total: R$ 0,00" por cima do pedido real. O cliente vê o pedido dele virar
    // zero e a fila ganha um fantasma.
    if (c.linhas.length === 0) {
      return (
        "NÃO registrei: a lista de itens veio vazia e pedido sem item não existe. " +
        "Se o cliente só confirmou algo que já estava combinado, responda com uma frase curta " +
        "e NÃO chame registrar_pedido de novo. Só chame com a lista completa quando houver mudança de verdade."
      );
    }

    // O que já está anotado completa o que ela esqueceu de mandar. Sem isso ela
    // perguntava outra vez a data, o nome e o pagamento que o cliente já tinha
    // dado, e a pessoa achava que ninguém tinha anotado nada.
    const anot = montagemAtual?.dados ?? {};
    const preencher = (v: unknown, chaveAnot: string) => {
      const s = v == null ? "" : String(v).trim();
      if (s !== "") return s;
      const g = anot[chaveAnot];
      return g && String(g).trim() !== "" ? String(g).trim() : undefined;
    };
    input.cliente_nome = preencher(input.cliente_nome, "cliente_nome") ?? input.cliente_nome;
    input.retirada_data = preencher(input.retirada_data, "retirada_data") ?? input.retirada_data;
    input.retirada_hora = preencher(input.retirada_hora, "retirada_hora") ?? input.retirada_hora;
    input.forma_pagamento = preencher(input.forma_pagamento, "forma_pagamento") ?? input.forma_pagamento;

    let precisaConfirmacao = Boolean(input.precisa_confirmacao);
    const pendencias: string[] = [];

    // Ela erra dos DOIS lados: já preencheu "pix" numa conversa sem pagamento
    // nenhum, e já escreveu "pix" só no texto do resumo sem preencher o campo,
    // deixando o pedido sem forma nenhuma no painel. Por isso o valor é LIDO da
    // fala do cliente, não aceito da palavra dela.
    const formaDita = detectarPagamento(falaDoCliente);
    let formaPagamento = input.forma_pagamento ? String(input.forma_pagamento) : undefined;
    if (formaDita) {
      formaPagamento = formaDita;
    } else if (formaPagamento) {
      formaPagamento = undefined;
      precisaConfirmacao = true;
      pendencias.push("confirmar a forma de pagamento (o cliente não falou)");
    }

    // Nome do pedido igual ao nome que está na observação do bolo = ela usou o
    // do aniversariante. Quem retira e paga é outra pessoa, e o pedido sai no
    // nome errado no balcão.
    // Sem tirar o acento a comparação falha justamente nos nomes brasileiros:
    // "Joao" (como a IA digita) nunca casava com "João" (como está na obs), e o
    // pedido saía no nome da criança sem ninguém ser avisado.
    const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nomeInformado = input.cliente_nome ? String(input.cliente_nome).trim() : "";
    if (nomeInformado) {
      const primeiro = semAcento(nomeInformado.split(/\s+/)[0]);
      const obsTodas = semAcento(itens.map((i) => String(i.obs ?? "")).join(" "));
      if (primeiro.length > 2 && obsTodas.includes(primeiro)) {
        precisaConfirmacao = true;
        pendencias.push("confirmar em nome de quem fica o pedido (parece ser o do aniversariante)");
      }
    }
    // DATA IGUAL A HOJE SEM O CLIENTE TER DITO "HOJE".
    // A data de hoje está no fim do prompt (pra completar o ano), e ela usa isso
    // como retirada quando não tem certeza. O pedido sai marcado pra hoje, a
    // cozinha se organiza pro dia errado e o cliente recebe "fica pra hoje".
    const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const dataDita = String(input.retirada_data || "");
    const mHoje = hojeISO.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mHoje) {
      const diaMes = mHoje[3] + "/" + mHoje[2];
      const pareceHoje = new RegExp("\\b" + mHoje[3] + "\\s*[/-]\\s*" + mHoje[2] + "\\b").test(dataDita);
      const clienteFalouHoje = /\bhoje\b/i.test(falaDoCliente) || falaDoCliente.includes(diaMes);
      if (pareceHoje && !clienteFalouHoje) {
        precisaConfirmacao = true;
        pendencias.push("conferir a data: ficou pra hoje e o cliente não disse hoje");
      }
    }

    // BOLO QUE SUMIU. Se a conversa tem topo, papel de arroz ou pão de ló, houve
    // bolo — e se nenhuma linha é da categoria bolo, ele virou outra coisa (já
    // virou "brigadeiro: 1 un x R$ 1,25" duas vezes). Melhor a equipe conferir
    // do que a cozinha receber uma festa sem bolo.
    const falaDeBolo = /topo de bolo|papel de arroz|p[ãa]o de l[óo]|bolo/i;
    // Pelo NOME, nao pela categoria: os bolos recheados nao vivem no catalogo.json
    // e a categoria deles nao e "bolo", entao comparar categoria fazia a guarda
    // disparar em todo pedido com bolo, inclusive nos que estavam corretos.
    const temLinhaDeBolo = c.linhas.some((l) => /^bolo/i.test(l.item));
    if (!temLinhaDeBolo && (falaDeBolo.test(falaDoCliente) || itens.some((i) => falaDeBolo.test(String(i.obs ?? ""))))) {
      // RECUSA, não avisa. Sinalizar deixava o pedido ir pra cozinha sem bolo,
      // cobrando R$ 97 a menos, com um aviso que a dona teria que ler e
      // corrigir. Já aconteceu três vezes: o bolo vira "brigadeiro: 2 un x
      // R$ 1,25" porque ela manda o SABOR no lugar do nome do item.
      return (
        "NÃO registrei: o cliente pediu BOLO e nenhum item do pedido é bolo.\n" +
        "O erro é o nome do item: você mandou só o sabor (ex: \"brigadeiro\"), que no cardápio é o " +
        "docinho de R$ 1,25. Bolo tem que ir como \"bolo <sabor>\" (ex: \"bolo brigadeiro\", " +
        "\"bolo 4 leites\"), com categoria bolo_festa e a quantidade em QUILOS, não em unidades.\n" +
        "Corrija só isso e chame registrar_pedido de novo com a lista inteira. " +
        "NÃO pergunte nada ao cliente: ele já disse tudo, o problema é como você preencheu."
      );
    }

    // SABOR DO BOLO QUE O CLIENTE NUNCA DISSE.
    //
    // Num teste real ela pulou a pergunta do sabor e registrou "bolo
    // brigadeiro" — brigadeiro era o DOCINHO escolhido dois passos antes. O
    // cliente ia receber um bolo que não pediu, e nem teve como perceber,
    // porque a pergunta nunca foi feita.
    //
    // Aqui a prova é a fala dele: se o sabor do bolo não aparece em nada que o
    // cliente escreveu, a equipe confere antes de produzir.
    for (const l of c.linhas) {
      if (!/^bolo/i.test(l.item)) continue;
      const sabor = l.item.replace(/^bolo\s+/i, "").trim();
      if (sabor.length < 3) continue;
      const palavras = sabor.split(/\s+/).filter((p) => p.length > 3);
      const falado = palavras.length === 0 || palavras.some((p) => new RegExp(p, "i").test(falaDoCliente));
      if (!falado) {
        precisaConfirmacao = true;
        pendencias.push(`confirmar o sabor do bolo: "${sabor}" não foi dito pelo cliente`);
      }
    }

    // ASSADO SEM RECHEIO É PRODUÇÃO NO ESCURO.
    //
    // Pastel assado, esfirra, croissant, empadinha, quiche e mini pizza têm
    // opção de recheio: sem essa informação a cozinha faz o sabor padrão e o
    // cliente descobre na festa. A regra está no prompt e mesmo assim ela já
    // fechou pedido sem perguntar, então a equipe confere antes de produzir.
    // Mini bolha entra aqui: o cardapio diz "nos sabores carne, queijo, presunto
    // ou frango", e eu tinha classificado ela como sabor fixo por engano.
    const PEDE_RECHEIO = /^(pastel assado|esfirra|croissant|empadinha|quiche|mini pizza|mini bolha)/i;
    // RECHEIO QUE O CLIENTE NÃO PEDIU.
    //
    // Ele disse "pastel assado de palmito" e ela registrou calabresa. Palmito
    // não existe pra pastel (é de empadinha), e em vez de avisar ela trocou por
    // uma opção válida em silêncio. O cliente ia receber outro sabor sem nunca
    // ter sido corrigido.
    const RECHEIOS = /(carne|frango|calabresa|bacon|br[óo]colis|palmito|milho|queijo|presunto|catupiry)/gi;
    for (const l of c.linhas) {
      if (!PEDE_RECHEIO.test(l.item)) continue;
      const ditos = String(l.obs ?? "").match(RECHEIOS) ?? [];
      const inventado = ditos.find((r) => !new RegExp(r.replace(/[óo]/i, "[óo]"), "i").test(falaDoCliente));
      if (inventado) {
        // Devolve SEM registrar. Sinalizar não bastava: o pedido ia pra dona
        // com o sabor errado e ela teria que corrigir, que é exatamente o que
        // não pode acontecer. Enquanto dá pra perguntar, pergunta-se.
        return (
          `NÃO registrei: o ${l.item} está com recheio "${inventado}" e o cliente não pediu esse recheio. ` +
          `Se o que ele pediu não existe pra esse item, DIGA quais existem e pergunte qual ele quer. ` +
          `Nunca troque por um parecido em silêncio. Depois que ele responder, chame registrar_pedido com tudo.` + `

ATENCAO: recusar o registro NAO quer dizer recomecar a coletar. Tudo que o cliente ja respondeu continua valendo. Releia a conversa, preencha os campos com o que ele JA disse, e chame registrar_pedido de novo. Perguntar outra vez a data, o nome, o pagamento ou o recheio que ele ja deu faz ele achar que voce nao anotou nada.`
        );
      }
    }

    const semRecheio = c.linhas.filter((l) => PEDE_RECHEIO.test(l.item) && !String(l.obs ?? "").trim());
    if (semRecheio.length > 0) {
      // Devolve SEM registrar: o recheio ainda dá pra perguntar, e perguntar é
      // melhor que a equipe adivinhar depois. Avisar só no painel deixava o
      // cliente com um pedido fechado que ninguém sabe produzir.
      const faltam = semRecheio.map((l) => l.item).join(", ");
      return (
        `NÃO registrei: ${faltam} veio sem o recheio no campo obs do item.\n` +
        `PRIMEIRO releia a conversa: se o cliente JÁ disse o recheio desses itens, ele está lá. ` +
        `Só copie pro campo obs de cada item e chame registrar_pedido de novo, SEM perguntar nada. ` +
        `Perguntar de novo o que ele já respondeu faz ele achar que você não anotou nada.\n` +
        `Só pergunte se ele realmente NÃO disse (opções: carne, frango, calabresa, bacon ou brócolis; ` +
        `empadinha também tem palmito), e aí numa mensagem só.` + `

ATENCAO: recusar o registro NAO quer dizer recomecar a coletar. Tudo que o cliente ja respondeu continua valendo. Releia a conversa, preencha os campos com o que ele JA disse, e chame registrar_pedido de novo. Perguntar outra vez a data, o nome, o pagamento ou o recheio que ele ja deu faz ele achar que voce nao anotou nada.`
      );
    }

    const motivoHumano = input.motivo_humano ? String(input.motivo_humano) : undefined;
    estado.pedido = {
      itens,
      linhas: c.linhas,
      retiradaData: String(input.retirada_data || ""),
      retiradaHora: input.retirada_hora ? String(input.retirada_hora) : undefined,
      formaPagamento,
      observacoes: input.observacoes ? String(input.observacoes) : undefined,
      clienteNome: input.cliente_nome ? String(input.cliente_nome) : undefined,
      totalCentavos: Math.round(c.total * 100),
      precisaConfirmacao,
      motivoHumano: precisaConfirmacao
        ? [motivoHumano, ...pendencias].filter(Boolean).join("; ") || undefined
        : undefined,
    };
    // O RESUMO É MONTADO AQUI, não pela IA.
    //
    // Enquanto ela escrevia, cada erro dela virava um erro que o cliente lia
    // como combinado: "*Forma de pagamento:* pix" numa conversa sem pagamento,
    // o nome da criança no lugar do nome de quem paga, total que não batia com
    // a soma. Nenhuma regra de prompt corrigiu isso de forma confiável, porque
    // o resumo é o ponto onde a invenção custa dinheiro.
    //
    // Agora ela só conversa. O texto que fecha o pedido sai daqui, com os
    // números da ferramenta e só com o que a gente de fato sabe.
    // RESUMO ERRADO NÃO VAI PRO CLIENTE.
    //
    // As guardas acima já pegam bolo que sumiu, data que virou hoje e item sem
    // recheio. Só que o resumo era montado e enviado assim mesmo: o cliente
    // recebia "Data: 17/08" quando tinha dito 28/08, e um pedido de festa sem o
    // bolo. A equipe via o aviso; ele via o erro.
    //
    // Com problema grave, o pedido é registrado (não se perde a venda) mas o
    // cliente recebe um recado honesto em vez de um resumo furado.
    const GRAVE = /bolo|data/i;
    const problemaGrave = pendencias.some((p) => GRAVE.test(p));
    if (problemaGrave) {
      estado.resumo =
        "Anotei tudo aqui.\n\n" +
        "Só vou confirmar uns detalhes com a equipe antes de te passar o resumo fechado, pra não te mandar nada errado.\n\n" +
        "Já já te aviso por aqui.";
    }

    const linhaPagamento = formaPagamento ? `*Forma de pagamento:* ${formaPagamento}\n` : "";
    const nomeResumo = nomeInformado && !pendencias.some((p) => p.includes("nome")) ? `*Nome:* ${nomeInformado}\n` : "";
    const temTopo = itens.some((i) => /topo/i.test(String(i.obs ?? "")));
    estado.resumo =
      `*Pedido recebido*\n` +
      nomeResumo +
      linhaPagamento +
      `*Data:* ${String(input.retirada_data || "")}\n` +
      (input.observacoes ? `*Obs:* ${String(input.observacoes)}\n` : "") +
      c.linhas.map((l) => `${l.item}: ${fmtQtd(l.qtd, l.unidade)} x ${brl(l.unit)} = ${brl(l.subtotal)}`).join("\n") +
      `\n*Total: ${brl(c.total)}*` +
      (temTopo ? `\nA equipe vai te informar o valor do topo.` : "") +
      `\nJá passei pra nossa equipe. Assim que confirmarem, eu te aviso por aqui.` +
      // Falta nome E pagamento: pergunta UMA coisa só, senão o próprio resumo
      // quebra a regra de uma pergunta por vez. O nome vem primeiro porque é
      // ele que a padaria grita no balcão na hora da retirada.
      (!nomeResumo
        ? `\n\nSó me diz: o pedido fica no nome de quem?`
        : !formaPagamento
          ? `\n\nSó falta combinar: vai ser pix, cartão ou dinheiro na retirada?`
          : "");

    const itensFmt = c.linhas
      .map((l) => `${l.item}: ${fmtQtd(l.qtd, l.unidade)} x ${brl(l.unit)} = ${brl(l.subtotal)}`)
      .join("\n");
    const avisosFmt = c.avisos?.length
      ? `\nATENCAO: ${c.avisos.join(" ")} Registre precisa_confirmacao=true e avise que a equipe confirma esse item.`
      : "";
    // Sem forma de pagamento, o resumo NÃO pode inventar uma linha. Ela já
    // escreveu "*Forma de pagamento:* pix" numa conversa em que ninguém falou
    // de pagamento: o cliente lê como combinado, e a equipe cobra errado.
    const pagamentoFmt = formaPagamento
      ? `\nA forma de pagamento é "${formaPagamento}": use exatamente essa na linha do resumo.`
      : `\nVocê NÃO sabe a forma de pagamento: OMITA a linha *Forma de pagamento:* do resumo (não escreva pix, nem dinheiro, nem "na retirada") e, logo depois do resumo, pergunte numa frase curta como ele prefere pagar.`;
    return `Pedido salvo pra equipe. Envie o resumo no formato de FECHAMENTO DE PEDIDO copiando EXATAMENTE estas linhas de item e este total, sem recalcular, sem trocar a unidade e sem inventar um total diferente da soma:\n${itensFmt}\nTotal: ${brl(c.total)}${avisosFmt}${pagamentoFmt}\nMantenha o formato (asteriscos de negrito, sem linha em branco dentro do resumo). O total do resumo tem que ser exatamente ${brl(c.total)}.`;
  }

  return "Ferramenta desconhecida.";
}

// Ferramentas de um tenant SEM cardápio (ex: agência): só passar pro humano.
// Nada de orçamento/pedido (isso é da padaria). Reaproveita a def do chamar_humano.
const FERRAMENTAS_BASICAS: OpenAI.Chat.Completions.ChatCompletionTool[] = FERRAMENTAS.filter(
  (f) => f.type === "function" && f.function.name === "chamar_humano",
);

// Monta o system prompt com a DATA DE HOJE (fuso BR).
function montarSystemComData(tenant: Tenant): string {
  // A HORA importa tanto quanto a data: sem ela a IA chuta o período do dia e
  // dá boa tarde às 9 da manhã, que é a primeira coisa que o cliente percebe.
  const horaBR = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const hojeBR = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  // Tenant com cérebro próprio (não padaria): usa o texto do config, sem o prompt
  // da padaria. É o que evita o cardápio da Doce Pão vazar pra outro nicho.
  if (tenant.sistemaCustom && tenant.sistemaCustom.trim()) {
    return tenant.sistemaCustom.trim() + `\n\n# DATA DE HOJE\nHoje é ${hojeBR} (fuso de Brasília).`;
  }
  return (
    montarSystemPrompt(tenant.persona, tenant.motor.cardapioResumo(), tenant.avisoDoDia) +
    `\n\n# DATA E HORA DE AGORA\nHoje é ${hojeBR}, e agora são ${horaBR} (fuso de Brasília). ` +
    `Cumprimente pela HORA: até 11h59 é bom dia, de 12h às 17h59 boa tarde, de 18h em diante boa noite. ` +
    `Sem esta linha você não teria como saber a hora e chutaria o período, o que já fez você dar boa tarde às 9 da manhã. ` +
    `A data serve pra completar o ANO das retiradas: se o cliente disser só dia e mês (ex: 05/05) e essa data ainda não passou este ano, use o ano atual. Data sempre em DD/MM/AAAA. ` +
    `Nunca use a data de hoje como data de retirada por suposição.`
  );
}


// SABOR EM ABERTO E BURACO NO PEDIDO, E QUEM SABE DISSO E O CODIGO.
//
// A ordem de fechar os recheios antes de mudar de categoria estava na persona,
// e ela pulou pros docinhos com o pastel frito sem sabor, o risolis sem sabor e
// os assados sem tipo. A cozinha faz o padrao e o cliente descobre na festa.
// Aqui a pendencia e CALCULADA: cruzando o que esta anotado com o catalogo.
const semTipo = (n: string) =>
  ["salgado", "salgados", "salgado assado", "salgado frito", "docinho", "docinhos", "doce", "bolo"].includes(
    n.trim().toLowerCase(),
  );

// produto -> opcoes de sabor que existem no cardapio dele.
function mapaDeSabores(): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  const guardar = (nome: string, ops?: string[]) => {
    if (ops && ops.length) m[nome.trim().toLowerCase()] = ops;
  };
  type ItemCat = { nome: string; recheios?: string[]; sabores?: string[] };
  for (const it of (catalogo.salgados.frito.itens ?? []) as ItemCat[]) guardar(it.nome, it.recheios);
  for (const it of (catalogo.salgados.assado.itens ?? []) as ItemCat[]) guardar(it.nome, it.recheios);
  for (const it of (catalogo.doces.itens ?? []) as ItemCat[]) guardar(it.nome, it.sabores);
  for (const it of (catalogo.outros_produtos ?? []) as ItemCat[]) guardar(it.nome, it.sabores);
  // Como o cliente chama: "pastel frito" e a mini bolha, que tem sabor.
  if (m["mini bolha"]) m["pastel frito"] = m["mini bolha"];
  return m;
}
const SABORES = mapaDeSabores();

function pendenciasDeSabor(itens: MontagemAtual["itens"]): string[] {
  const p: string[] = [];
  for (const i of itens) {
    const nome = String(i.produto || "").trim();
    if (!nome) continue;
    if (semTipo(nome)) {
      p.push(`- ${i.qtd} de "${nome}": falta o cliente dizer QUAIS, um por um (o nome do salgado, do docinho ou do bolo).`);
      continue;
    }
    const ops = SABORES[nome.toLowerCase()];
    if (ops && !String(i.obs ?? "").trim()) {
      p.push(`- ${nome}: falta o sabor. As opcoes sao ${ops.join(", ")}.`);
    }
  }
  return p;
}

// O pedido anotado, em texto, pra IA ler no fim da conversa. É a memória dela:
// em vez de reconstruir o pedido inteiro pelo histórico a cada mensagem (que é
// onde ela trocava bolo por docinho e perdia item), ela lê o que está guardado.
// A equipe também mexe nisso pela tela, então o que vier aqui pode ter sido
// corrigido na mão e vale mais que a lembrança dela.
function descreverMontagem(m?: MontagemAtual | null): string {
  const itens = m?.itens ?? [];
  const rotulos: Record<string, string> = {
    cliente_nome: "Nome de quem retira",
    retirada_data: "Data da retirada",
    retirada_hora: "Hora da retirada",
    forma_pagamento: "Forma de pagamento",
    observacoes: "Observacao geral",
  };
  const dados = Object.entries(rotulos)
    .map(([k, r]) => {
      const v = m?.dados?.[k];
      return v && String(v).trim() !== "" ? `- ${r}: ${String(v).trim()}` : null;
    })
    .filter(Boolean) as string[];

  const linhas = itens.map((i) => {
    const q = i.unidade === "kg" ? `${i.qtd} kg` : `${i.qtd} un`;
    return `- ${q} de ${i.produto} (categoria: ${i.categoria})${i.obs ? ` | ${i.obs}` : ""}`;
  });

  const ordem =
    "ANTES de escrever a resposta, chame anotar_item pra cada produto que o cliente decidiu agora e anotar_dados pro que ele informou agora " +
    "(nome, data, hora, pagamento). Quantidade nova do mesmo produto e recheio escolhido depois entram com anotar_item de novo: corrigir nao duplica. " +
    "O que voce nao anotar se perde, e o pedido registrado no fim sai DESTA lista, nao da sua lembranca da conversa.";

  if (linhas.length === 0 && dados.length === 0) {
    return (
      "# PEDIDO EM MONTAGEM: NADA ANOTADO AINDA" + "\n" + ordem
    );
  }

  const pend = pendenciasDeSabor(itens);
  const cobrar = pend.length
    ? "\n\nFALTA FECHAR ISTO, E E AGORA:\n" +
      pend.join("\n") +
      "\n\nSua proxima mensagem tem que perguntar isso. NAO passe pros docinhos, pro bolo nem pro fechamento " +
      "deixando sabor em aberto: a cozinha faz o padrao e o cliente so descobre na festa. Pode juntar tudo numa " +
      "pergunta so."
    : "";

  // TEM TUDO? ENTAO FECHA.
  //
  // Ela chegou a responder "ja vou passar pra equipe, pode ser?" com o pedido
  // inteiro anotado e o cliente ja tendo dito "pode fechar". O cliente sai da
  // conversa achando que encomendou e nao existe pedido nenhum. Quando nao
  // falta nada, a ordem de fechar aparece aqui, no fim do prompt.
  const preciso = (k: string) => {
    const v = m?.dados?.[k];
    return !!v && String(v).trim() !== "";
  };
  const completo =
    pend.length === 0 &&
    linhas.length > 0 &&
    preciso("cliente_nome") &&
    preciso("retirada_data") &&
    preciso("retirada_hora") &&
    preciso("forma_pagamento");
  const fechar = completo
    ? "\n\nNAO FALTA NADA NESTE PEDIDO. Se o cliente ja mandou fechar, chame registrar_pedido AGORA, nesta mesma resposta, " +
      "com o que esta anotado aqui em cima. Nao pergunte se pode passar pra equipe: ele ja pediu. Prometer que vai passar e nao chamar a ferramenta " +
      "deixa o cliente achando que encomendou sem existir pedido nenhum."
    : "";

  return (
    "# O QUE JA ESTA ANOTADO NESTE PEDIDO" + "\n" +
    "Isto esta guardado e a equipe ja pode ter corrigido na tela. Vale mais que a sua lembranca da conversa." + "\n\n" +
    (linhas.length ? "Itens:" + "\n" + linhas.join("\n") + "\n\n" : "Nenhum item anotado ainda." + "\n\n") +
    (dados.length ? "Dados:" + "\n" + dados.join("\n") + "\n\n" : "") +
    "Nao pergunte de novo nada que ja esta aqui em cima: o cliente ja respondeu e vai achar que voce nao anotou. Falta so o que NAO aparece nesta lista." + "\n\n" +
    ordem +
    cobrar +
    fechar
  );
}

// Cadeia de provedores de IA, todos falando a API da OpenAI (ferramentas iguais).
// Tenta o 1º; se cair, vai pro próximo. Assim a queda de um provedor não deixa o
// cliente no vácuo. Configurável por env: coloque as chaves que tiver de reserva.
type Provedor = { nome: string; apiKey?: string; baseURL?: string; modelo: string };

// Cadeia GLOBAL de fallback (independente de tenant). Ordem: OpenAI, Gemini, reserva.
function cadeiaGlobal(): Provedor[] {
  const lista: Provedor[] = [];
  if (process.env.OPENAI_API_KEY || (!process.env.GEMINI_API_KEY && !process.env.IA_RESERVA_API_KEY)) {
    lista.push({
      nome: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      modelo: MODELO,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    lista.push({
      nome: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      // O 2.5-flash foi fechado pra conta nova: o Google devolvia 404 e a
      // reserva do atendimento nunca funcionou de verdade. Hoje o 3.6-flash
      // responde; falta credito na conta do AI Studio pra ela valer como reserva.
      modelo: process.env.GEMINI_MODELO || "gemini-3.6-flash",
    });
  }
  if (process.env.IA_RESERVA_API_KEY && process.env.IA_RESERVA_BASE_URL) {
    lista.push({
      nome: "reserva",
      apiKey: process.env.IA_RESERVA_API_KEY,
      baseURL: process.env.IA_RESERVA_BASE_URL,
      modelo: process.env.IA_RESERVA_MODELO || MODELO,
    });
  }
  return lista;
}

// Provedor ESCOLHIDO por este tenant (config.provedor_ia + config.modelo), com a
// chave própria no env. É o que deixa cada nicho num LLM diferente:
//   Doce Pão = claude, cliente B = openai, cliente C = gemini.
function provedorEscolhido(tenant: Tenant): Provedor | null {
  const modelo = tenant.modeloIa || undefined;
  switch ((tenant.provedorIa || "").toLowerCase()) {
    case "openai":
      return process.env.OPENAI_API_KEY
        ? { nome: "openai", apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, modelo: modelo || MODELO }
        : null;
    case "gemini":
      return process.env.GEMINI_API_KEY
        ? {
            nome: "gemini",
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
            modelo: modelo || "gemini-2.5-flash",
          }
        : null;
    case "claude":
      return process.env.CLAUDE_API_KEY
        ? {
            nome: "claude",
            apiKey: process.env.CLAUDE_API_KEY,
            baseURL: process.env.CLAUDE_BASE_URL || "https://api.anthropic.com/v1/",
            modelo: modelo || "claude-haiku-4-5",
          }
        : null;
    default:
      return null;
  }
}

// Cadeia final: o provedor DO TENANT primeiro, depois a global de fallback (sem
// repetir o mesmo). Se o provedor do tenant cair, ainda tenta os outros.
function provedores(tenant?: Tenant): Provedor[] {
  const global = cadeiaGlobal();
  const escolhido = tenant ? provedorEscolhido(tenant) : null;
  if (!escolhido) return global;
  return [escolhido, ...global.filter((p) => p.nome !== escolhido.nome)];
}

// Roda a conversa (loop de ferramentas) num provedor. LANÇA se o provedor falhar,
// pra o responder() cair pro próximo. Estado é local: se lançar no meio, nada foi
// persistido (o pedido só é salvo fora, com base no retorno), então retentar é seguro.
async function rodarConversa(
  prov: Provedor,
  system: string,
  historico: Mensagem[],
  tenant: Tenant,
  origem: string,
  clienteId?: string | null,
  montagemAtual?: MontagemAtual | null,
  pedidoAguardando = false,
  pedidoAnterior?: string | null,
): Promise<RespostaIA> {
  const client = new OpenAI({
    apiKey: prov.apiKey,
    baseURL: prov.baseURL,
    // 15s era pouco: conversa longa, com transcricao de audio e varias chamadas
    // de ferramenta no mesmo turno, estourava e o cliente recebia "tive um
    // probleminha" sem a IA ter errado nada. 30s cobre o turno pesado e ainda
    // deixa margem pro webhook (maxDuration 60).
    timeout: 30_000,
    maxRetries: 0, // a cadeia de provedores já é a nossa retentativa
  });
  const estado = { precisaHumano: false, pedido: null as RespostaIA["pedidoRegistrado"], cardapios: [] as CardapioId[], resumo: undefined as string | undefined, aceitouOrcamento: false, montagem: [] as MudancaMontagem[] };
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...historico.map((m) => ({ role: m.role, content: m.content })),
  ];

  // O que já está anotado entra DEPOIS do histórico, nunca dentro do system: o
  // system é o prefixo que a OpenAI guarda em cache, e mexer nele a cada turno
  // jogaria o cache fora (a conta triplica). No fim ele é lido do mesmo jeito.
  messages.push({ role: "system", content: descreverMontagem(montagemAtual) });

  // O pedido que ESTE cliente ja fechou, pra ela nao confundir com o de agora.
  if (pedidoAnterior) {
    messages.push({
      role: "system",
      content:
        "# PEDIDO ANTERIOR DESTE CLIENTE, JA FECHADO E ENTREGUE PRA EQUIPE\n" +
        "Nao e o pedido de agora, e nao entra no de agora.\n\n" +
        pedidoAnterior +
        "\n\nUse isto SO se ele perguntar o que pediu antes, ou se pedir a mesma coisa de novo. " +
        "Se ele quiser mexer nesse pedido, chame a equipe: a cozinha pode ja ter comecado.",
    });
  }

  // Acumula os tokens de TODAS as chamadas deste turno. Um round de tool-call
  // faz várias chamadas (uma por iteração do loop); somamos tudo e gravamos uma
  // vez só, no fim. Fire-and-forget: nunca deixa a medição travar a resposta.
  const uso: UsoTurno = { tokensIn: 0, tokensOut: 0, cacheRead: 0 };
  const somarUso = (u: OpenAI.Completions.CompletionUsage | undefined | null) => {
    if (!u) return;
    uso.tokensIn += u.prompt_tokens ?? 0;
    uso.tokensOut += u.completion_tokens ?? 0;
    // A OpenAI faz cache de prompt sozinha (prefixo >1024 tokens) e devolve
    // quanto reaproveitou. A gente nunca lia isso: a tela mostrava 0 de cache e
    // o custo era calculado como se tudo fosse entrada nova, inflando a conta.
    uso.cacheRead = (uso.cacheRead ?? 0) + (u.prompt_tokens_details?.cached_tokens ?? 0);
  };
  const gravarUso = () => {
    // modelo REAL usado = prov.modelo (o que de fato respondeu neste provedor).
    // clienteId amarra o custo à CONVERSA (custo por atendimento no painel).
    void registrarUsoIA(tenant.negocioId, prov.modelo, uso, origem, clienteId);
  };

  for (let i = 0; i < 6; i++) {
    // Modelos de raciocínio (gpt-5, o1, o3) recusam max_tokens e temperature:
    // eles usam max_completion_tokens e não aceitam ajuste de criatividade.
    // Mandar os parâmetros antigos dá 400 e o atendimento cai inteiro, então a
    // chamada se adapta ao modelo em vez de assumir um formato só.
    const ehRaciocinio = /^(gpt-5|o1|o3|o4)/i.test(prov.modelo);
    const resp = await client.chat.completions.create(
      ehRaciocinio
        ? {
            model: prov.modelo,
            // teto alto de propósito: boa parte é gasta pensando, e com pouco
            // espaço o modelo devolve a resposta vazia (já aconteceu numa
            // consulta: 4000 tokens todos no raciocínio e nada de texto).
            max_completion_tokens: 4000,
            messages,
            tools: tenant.sistemaCustom ? FERRAMENTAS_BASICAS : FERRAMENTAS,
          }
        : {
            model: prov.modelo,
            max_tokens: 350, // resposta de WhatsApp é curta; corta desperdício de token
            temperature: 0.4, // menos "criatividade" = segue mais as regras (usar a ferramenta)
            messages,
            tools: tenant.sistemaCustom ? FERRAMENTAS_BASICAS : FERRAMENTAS,
          },
    );
    somarUso(resp.usage);

    const msg = resp.choices[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      gravarUso();
      // Fechou pedido: o texto que vai pro cliente e o resumo montado em
      // codigo, nao o que ela escreveu. Ela ja tentou reescrever o total.
      const textoFinal = estado.resumo ?? umaPerguntaSo((msg.content || "").trim());
      return {
        texto: textoFinal,
        precisaHumano: estado.precisaHumano,
        pedidoRegistrado: estado.pedido,
        aceitouOrcamento: estado.aceitouOrcamento,
        montagem: estado.montagem,
        cardapiosParaEnviar: honrarCardapioPrometido(textoFinal, estado.cardapios),
      };
    }

    messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      // TUDO que o cliente escreveu na conversa serve de prova pras guardas.
      // Só a última mensagem daria falso positivo: ele pode ter falado o
      // pagamento cinco mensagens antes de fechar.
      const falaDoCliente = historico
        .filter((m) => m.role === "user" && typeof m.content === "string")
        .map((m) => m.content as string)
        .join("  ");
      const saida = executarFerramenta(tc.function.name, args, estado, tenant.motor, falaDoCliente, montagemAtual, pedidoAguardando);
      messages.push({ role: "tool", tool_call_id: tc.id, content: saida });
    }
  }

  // Saiu do loop (fim das iterações ou msg vazia): ainda houve consumo, grava.
  gravarUso();
  return {
    texto: "Deixa eu chamar alguém da equipe pra te ajudar com isso.",
    precisaHumano: true,
    pedidoRegistrado: estado.pedido,
    cardapiosParaEnviar: estado.cardapios,
  };
}


// A IA às vezes ESCREVE que mandou o cardápio sem ter chamado enviar_cardapio.
// O cliente fica olhando pra "te mandei o cardápio aqui" e nada chega; ele
// avisa, ela promete de novo, e a conversa entra em loop de desculpa (aconteceu
// três vezes seguidas num teste real com o cardápio de docinhos).
//
// O prompt sozinho não resolve isso: é comportamento, não regra. Aqui a gente
// cumpre a promessa que ela fez — se o texto anuncia uma peça e nenhuma foi
// enfileirada, a peça citada entra na fila.
function honrarCardapioPrometido(texto: string, jaNaFila: CardapioId[]): CardapioId[] {
  if (jaNaFila.length > 0) return jaNaFila;
  const t = texto.toLowerCase();
  if (!/(mandei|mandando|enviei|enviando|mandar).{0,24}card[áa]pio|card[áa]pio.{0,24}(aqui|pra voc|de novo)/.test(t)) {
    return jaNaFila;
  }
  const apelidos: [CardapioId, RegExp][] = [
    ["docinhos", /docinho|doce(s)?|brigadeiro|trufa/],
    ["salgados", /salgado|coxinha|esfirra|frito|assado/],
    ["bolos-festa", /bolo de festa|bolos de festa|bolo recheado|festa/],
    ["bolos-caseiros", /bolo caseiro|bolos caseiros|caseiro/],
    ["cucas-paes", /cuca|p[ãa]o doce/],
    ["tortas-empadao", /torta|empad[ãa]o/],
    ["pizza", /pizza/],
    ["cupcakes-franciscano", /cupcake|franciscano/],
  ];
  for (const [id, re] of apelidos) if (re.test(t)) return [id];
  return jaNaFila;
}

// O turno principal: recebe o histórico + a mensagem nova, devolve a resposta.
// Tenta os provedores em cadeia; se TODOS falharem, lança (o webhook trata).
export async function responder(
  historico: Mensagem[],
  tenant: Tenant = { persona: DOCE_PAO, motor: motorPadrao },
  origem = "whatsapp",
  clienteId?: string | null,
  montagemAtual?: MontagemAtual | null,
  pedidoAguardando = false,
  pedidoAnterior?: string | null,
): Promise<RespostaIA> {
  const system = montarSystemComData(tenant);
  const lista = provedores(tenant);
  let ultimoErro: unknown;
  // Cada provedor ganha DUAS tentativas antes de passar a vez.
  //
  // O que derrubava o atendimento nao era o modelo errar: era um soluco de rede
  // no OpenAI cair direto no proximo da fila, e o proximo (Gemini) estar
  // quebrado, devolvendo 404. Um tropeco passageiro virava "tive um probleminha"
  // pro cliente. Repetir no mesmo provedor resolve a esmagadora maioria desses
  // casos, porque a falha e de rede e nao de pedido.
  for (const prov of lista) {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        return await rodarConversa(prov, system, historico, tenant, origem, clienteId, montagemAtual, pedidoAguardando, pedidoAnterior);
      } catch (e) {
        ultimoErro = e;
        const msg = (e as Error)?.message ?? String(e);
        console.error(`[ia] provedor ${prov.nome} falhou (tentativa ${tentativa}/2):`, msg);
        if (tentativa === 1) await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw new Error("Todos os provedores de IA falharam: " + String((ultimoErro as Error)?.message ?? ultimoErro));
}
