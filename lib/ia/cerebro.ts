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
import { motorPadrao, formatarOrcamento, brl, citadoDeVerdade, type Motor, type LinhaCotacao } from "./orcamento";
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
          dois_bolos: {
            type: ["boolean", "null"],
            description:
              "Só pra bolo, e só depois de CONFIRMAR com o cliente que ele quer mais de um bolo na mesma festa. true acrescenta um segundo bolo em vez de corrigir o que já está anotado. Em qualquer outro caso mande null.",
          },
          obs: {
            type: ["string", "null"],
            description:
              "O que o cliente disse SOBRE ESTE item: recheio do assado, sabor da trufa, cor da forminha, e no bolo o pão de ló, tema, nome e idade do aniversariante. Use as palavras dele, nunca exemplo. Null se não houver.",
          },
        },
        required: ["produto", "categoria", "qtd", "obs", "dois_bolos"],
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
          nao_quer: {
            type: ["string", "null"],
            description:
              "O que o cliente disse que NAO quer nesta festa: salgado, docinho ou bolo (pode ser mais de um, separado por virgula). Use quando ele dispensar: \"nao quero salgado\", \"so docinho\", \"sem bolo\". Assim eu paro de cobrar essa parte. null quando ele nao dispensou nada.",
          },
        },
        required: ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento", "observacoes", "nao_quer"],
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
  // Guardar a pergunta MAIS COMPRIDA deixava sobrar frase sem sentido: o
  // cliente recebia "Qual você prefere?" sozinho, sem as opções que estavam na
  // pergunta anterior. A que vale é a primeira que realmente pergunta alguma
  // coisa; "qual você prefere?" e "certo?" são rabicho da anterior.
  //
  // E pergunta que COMEÇA pendurada na anterior ("Se sim, ...", "E o resto?")
  // não pode ser a escolhida: sozinha ela não diz do que está falando. O
  // cliente já recebeu "Se sim, quer que eu divida igual?" sem nada antes.
  const pendurada = /^(se\s|então|entao|e\s|ou\s|certo\b|pode ser\b|qual (você|voce) prefere)/i;
  const soltas = perguntas.filter((f) => !pendurada.test(f.trim()));
  const candidatas = soltas.length ? soltas : perguntas;
  const substancial = candidatas.find((f) => / ou |quais|quantos|qual sabor|que recheio/i.test(f) && f.length >= 20);
  const melhor = substancial ?? candidatas.reduce((a, b) => (b.length > a.length ? b : a));
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

// Festa muda o roteiro: tem ordem de etapas e costuma ter bolo. Uma regra so,
// usada pelo lembrete e pelas guardas, pra nao divergirem.
export function ehFestaNaFala(t: string): boolean {
  return /festa|anivers|niver|formatura|casamento|confraterniza|batizado|ch[áa] de/i.test(t || "");
}

// Texto normalizado pra comparar sabor dito com sabor anotado.
const marca = (t?: string | null) => String(t ?? "").trim().toLowerCase();

function executarFerramenta(
  nome: string,
  input: Record<string, unknown>,
  estado: { precisaHumano: boolean; pedido: RespostaIA["pedidoRegistrado"]; cardapios: CardapioId[]; resumo?: string; sugestao?: string; aceitouOrcamento?: boolean; montagem: MudancaMontagem[] },
  motor: Motor,
  falaDoCliente = "",
  montagemAtual?: MontagemAtual | null,
  pedidoAguardando = false,
  ultimaFala = "",
  ultimaFalaDela = "",
  // As ultimas falas DELA: e assim que o codigo sabe que a mesma pergunta ja
  // foi feita tres vezes sem resposta.
  falasDela: string[] = [],
): string {
  if (nome === "montar_orcamento") {
    if (input.modo !== "itens") {
      // Numero de pessoas tem que ter saido da conversa, nao da cabeca dela.
      const pedidas = Number(input.pessoas) || 0;
      const ditos = new Set<number>();
      // Numero com unidade colada nao e convidado: idade, hora, peso, data e
      // ano saem antes da conta. "8 anos" ja virou festa pra 8 pessoas.
      const semUnidade = (t: string) =>
        String(t || "")
          .replace(/(\d{1,2})[\/.-](\d{1,2})([\/.-](\d{2,4}))?/g, " ")
          .replace(/(\d+)\s*(anos?|aninhos?|h|hs|horas?|kg|quilos?|g|gramas?|reais|r\$)/gi, " ")
          .replace(/(as|às|as)\s+(\d+)/gi, " ");
      for (const n of semUnidade(falaDoCliente).match(/[0-9]+/g) ?? []) ditos.add(Number(n));
      for (const n of semUnidade(ultimaFalaDela).match(/[0-9]+/g) ?? []) ditos.add(Number(n));
      if (pedidas > 0 && ditos.size > 0 && !ditos.has(pedidas)) {
        return (
          "NAO orcei: o cliente nunca falou em " + pedidas + " pessoas. Convidado que ele nao citou vira o dobro de " +
          "salgado e um total que assusta. Use o numero que ELE deu, ou pergunte quantas pessoas vao, e chame de novo."
        );
      }
    }
    if (input.modo === "itens") {
      const c = motor.cotarPorItens((input.itens as { item: string; qtd: number }[]) || []);
      return formatarOrcamento(c);
    }
    const c = motor.sugerirPorPessoas(
      Number(input.pessoas) || 0,
      (input.quer as { salgado?: boolean; doce?: boolean; bolo?: boolean }) || { salgado: true, doce: true },
    );

    // A FRASE DA SUGESTAO E ESCRITA AQUI, nao por ela. Os numeros sao os do
    // motor, na ordem da festa, e o total e o mesmo do orcamento.
    const pessoas = Number(input.pessoas) || 0;
    const somaDe = (pref: string) =>
      c.linhas.filter((l) => l.categoria.toLowerCase().startsWith(pref)).reduce((t, l) => t + l.qtd, 0);
    const salg = somaDe("salgado");
    const doce = somaDe("doce");
    const bolo = c.linhas.filter((l) => l.categoria.toLowerCase().startsWith("bolo")).reduce((t, l) => t + l.qtd, 0);
    const partes: string[] = [];
    if (salg > 0) partes.push(salg + " salgados no total");
    if (doce > 0) partes.push(doce + " docinhos");
    if (bolo > 0) partes.push(String(bolo).replace(".", ",") + " kg de bolo");
    if (partes.length && pessoas > 0) {
      const lista =
        partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0];
      estado.sugestao =
        "Pra " + pessoas + " pessoas, uma base boa é " + lista + "." +
        String.fromCharCode(10) + String.fromCharCode(10) +
        "Dá " + brl(c.total) + " no total, e dá pra ajustar o que você quiser.";
    }
    // Nesta etapa o cliente ainda não escolheu NADA. A ferramenta precisa citar
    // um produto pra ter preço, mas anunciar "300 coxinhas e 150 brigadeiros"
    // faz a pessoa achar que já ficou decidido. Fale por categoria.
    return (
      formatarOrcamento(c, `Orçamento da festa de ${input.pessoas} pessoas`) +
      `
Ao falar esta sugestão pro cliente, use as palavras GENÉRICAS "salgados" e "docinhos" ` +
      `(ex: "300 salgados e 150 docinhos"), NUNCA o nome do produto que aparece nas linhas acima: ` +
      `ele ainda não escolheu os tipos, e citar um faz parecer que já está decidido. ` +
      `O valor e o total, esses sim, são os desta ferramenta. ` +
      `E o numero de salgados e o TOTAL da festa, nao por tipo: se ele quiser fritos e assados, esse total se DIVIDE ` +
      `entre os dois ("300 no total, metade frito e metade assado"). Falar "300 fritos e 300 assados" dobra a festa e ` +
      `dobra a conta do cliente.`
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

  // O pedido como esta AGORA: o que veio do banco mais o que ja foi anotado
  // neste turno (ela chama a ferramenta varias vezes na mesma resposta).
  const itensAgora = (): MontagemAtual["itens"] => {
    const base = [...(montagemAtual?.itens ?? [])];
    for (const mud of estado.montagem) {
      if (mud.tipo !== "item") continue;
      const i = base.findIndex(
        (x) =>
          String(x.produto ?? "").trim().toLowerCase() === String(mud.produto ?? "").trim().toLowerCase() &&
          x.categoria === mud.categoria,
      );
      const novo = {
        produto: mud.produto,
        categoria: mud.categoria,
        qtd: mud.qtd,
        // A unidade sai do cardapio, igual ao preco: por categoria, 1,5 kg de
        // empadao anotado neste turno virava "un" na leitura do proprio turno.
        unidade: unidadeDoProduto(mud.produto, mud.categoria),
        obs: mud.obs ?? null,
      };
      if (i >= 0) base[i] = { ...base[i], ...novo };
      else base.push(novo);
    }
    return base;
  };

  if (nome === "anotar_item") {
    // Como o cliente chama x como a cozinha le: "pastel frito" e a mini bolha.
    // Sem isso a linha casava com o generico "salgado frito" e a producao
    // recebia "salgado frito de carne", que nao diz que peca fazer.
    const APELIDOS: Record<string, string> = { "pastel frito": "mini bolha", "pastel": "mini bolha" };
    // Ela chegou a mandar o nome da CATEGORIA no lugar do produto
    // ("salgado_frito"), e isso nao e nome de nada: nao casa com a tabela de
    // preco, nao e absorvido pelo generico e sobra fantasma no pedido.
    const cru = String(input.produto || "").trim().replace(/_/g, " ");
    const anotado = APELIDOS[cru.toLowerCase()] ?? cru;
    // Nome completo do cardapio na fala do cliente manda: a variante com
    // palmito e outro produto, com outro preco.
    let produto = (() => {
      const semAc = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const naFala = semAc(falaDoCliente);
      const curto = semAc(anotado);
      if (!curto) return anotado;
      const variantes = ((catalogo.outros_produtos ?? []) as { nome: string }[])
        .map((i) => String(i.nome))
        .filter((n) => {
          const x = semAc(n);
          return x.length > curto.length && x.startsWith(curto) && naFala.includes(x);
        })
        .sort((a, b) => b.length - a.length);
      return variantes[0] ?? anotado;
    })();
    const categoria = String(input.categoria || "outro");
    // A divisao entre tipos pode corrigir esse numero antes de anotar.
    let qtd = Number(input.qtd) || 0;
    let avisoDivisao = "";
    let avisoSabor = "";
    if (!produto || qtd <= 0) return "Não anotei: preciso do produto e de uma quantidade maior que zero.";
    // "sem sabor especificado", "a definir": ela preenche o campo pra nao deixar
    // vazio, e isso desce pra comanda como se fosse instrucao da cozinha.
    // Observacao de enfeite nao e observacao: melhor vazia e cobrada.
    const ENFEITE = /^(sem +(sabor|recheio)|a +definir|nao +informad|n[ãa]o +especificad|indefinid|a +combinar)/i;
    const obsBruta = input.obs ? String(input.obs).trim() : "";
    // Pode ser zerada adiante quando vier a lista de opcoes no lugar da escolha.
    let obsItem = obsBruta && !ENFEITE.test(obsBruta) ? obsBruta : null;

    // DOIS BOLOS NA MESMA FESTA SO SE O CLIENTE PEDIR DOIS.
    //
    // Ela anotou um "bolo 4 leites" que ninguem pediu, do lado do bolo de
    // brigadeiro com morango que o cliente escolheu: o 4 leites e o primeiro da
    // peca do cardapio, e ela copiou de la. Dois bolos anotados viram dois bolos
    // cobrados e dois bolos assados.
    const boloJaAnotado = itensAgora().find(
      (x) => x.categoria === "bolo_festa" || x.categoria === "bolo_caseiro",
    );
    // Nome que cresce e o MESMO bolo ficando completo ("bolo bombom" virando
    // "bolo bombom com morango"), nao um bolo novo. Sem isso os dois guardas
    // brigavam: um mandava refazer com os dois sabores e o outro barrava por ja
    // existir bolo.
    const mesmoBolo =
      !!boloJaAnotado &&
      (boloJaAnotado.produto.trim().toLowerCase().includes(produto.trim().toLowerCase()) ||
        produto.trim().toLowerCase().includes(boloJaAnotado.produto.trim().toLowerCase()));
    if (
      (categoria === "bolo_festa" || categoria === "bolo_caseiro") &&
      boloJaAnotado &&
      !mesmoBolo &&
      boloJaAnotado.produto.trim().toLowerCase() !== produto.trim().toLowerCase()
    ) {
      if (!input.dois_bolos) {
        return (
          `NAO anotei ainda: ja existe um bolo neste pedido, o "${boloJaAnotado.produto}". ` +
          `Se o cliente TROCOU o sabor, chame anotar_item com o nome "${boloJaAnotado.produto}" corrigido pro sabor ` +
          `novo, que ai eu substituo. Se ele quer DOIS bolos mesmo (acontece em festa grande), CONFIRME com ele e ` +
          `chame de novo com dois_bolos=true. Nunca acrescente por conta propria um bolo que ele nao pediu.`
        );
      }
    }

    // RECHEIO QUE O CLIENTE NAO FALOU NAO EXISTE.
    //
    // Pedido de 100 esfirras e 100 empadinhas, sem recheio nenhum dito, e ela
    // anotou "esfirra de carne" e "empadinha de palmito". A cozinha produz o que
    // esta escrito, e o cliente descobre na festa. A prova e simples: se o sabor
    // e uma opcao do cardapio, ele tem que aparecer na fala do cliente.
    const opcoesDoProduto = SABORES[produto.toLowerCase()] ?? [];
    if (opcoesDoProduto.length && marca(obsItem)) {
      const escolhido = opcoesDoProduto.find((o) => marca(obsItem).includes(o.trim().toLowerCase()));
      // Vale o que o cliente falou E o que ELA propos e ele aceitou: a indicacao
      // ("100 mini bolha de carne... pode ser assim?") tem o sabor na fala dela,
      // e sem isso o "pode ser" do cliente nao anotava nada.
      const cliente = (falaDoCliente + " " + (ultimaFalaDela || "")).toLowerCase();
      // Ja esta no pedido com esse mesmo recheio: e a mesma linha sendo
      // reescrita, e o recheio ja passou por aqui quando entrou.
      const jaTemEsseRecheio = itensAgora().some((x) => {
        const mesmoProduto = String(x.produto ?? "").trim().toLowerCase() === produto.trim().toLowerCase();
        return mesmoProduto && escolhido ? String(x.obs ?? "").toLowerCase().includes(escolhido.trim().toLowerCase()) : false;
      });
      if (escolhido && !jaTemEsseRecheio && !cliente.includes(escolhido.trim().toLowerCase())) {
        return (
          `NAO anotei: o cliente nunca falou "${escolhido}" pra ${produto}. Escolher o recheio por ele faz a cozinha ` +
          `produzir o sabor errado e ele so descobrir na festa. PERGUNTE agora qual ele quer, entre ${opcoesDoProduto.join(", ")}, ` +
          `e anote o que ele responder.`
        );
      }
    }

    // SABOR DE BOLO TAMBEM PRECISA TER SIDO DITO.
    //
    // No bolo o sabor esta no NOME, entao a guarda de cima nao pega. Ela anotou
    // um "bolo brigadeiro" de 4 kg tirado da SUGESTAO de tamanho da festa, com o
    // cliente ainda nem tendo visto o cardapio de bolos.
    if (categoria === "bolo_festa" || categoria === "bolo_caseiro") {
      const sabor = produto.replace(/^bolo (caseiro )?/i, "").split(/ com /i)[0].trim();
      // Bolo que JA esta no pedido nao entra aqui de novo: acrescentar tema,
      // topo ou papel de arroz e edicao, e o sabor ja foi conferido na entrada.
      const boloJaNoPedido = (montagemAtual?.itens ?? []).some((x) => {
        const a = String(x.produto ?? "").trim().toLowerCase();
        const b = produto.trim().toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      // Sem acento: o cliente escreve "prestigio", "pessego", "maracuja", e o
      // cardapio guarda com acento. Recusar por acento e recusar o que ele pediu.
      const semAcentoSabor = (t: string) =>
        String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (
        !boloJaNoPedido &&
        sabor &&
        sabor.length > 3 &&
        !semAcentoSabor(falaDoCliente).includes(semAcentoSabor(sabor))
      ) {
        return (
          `NAO anotei: o cliente nunca falou em bolo de ${sabor}. Bolo de festa e escolha dele, nunca sua nem da ` +
          `sugestao de tamanho da festa. Mande o cardapio de bolos ou pergunte qual sabor ele quer, e anote o que ele responder.`
        );
      }
    }


    // PAO DE LO TAMBEM E ESCOLHA DELE.
    //
    // Ela perguntou "branco ou chocolate?", o cliente respondeu outra coisa (o
    // tema do bolo) e ela anotou "pao de lo branco" assim mesmo. Diferente do
    // recheio, aqui nao vale o que ELA falou: a pergunta dela estava justamente
    // esperando resposta, entao so a fala do cliente conta.
    const PAO_DE_LO = /p[ãa]o de l[óo] (branco|chocolate|mesclado)/i;
    const achouPao = PAO_DE_LO.exec(String(obsBruta || ""));
    if (achouPao) {
      const tipo = achouPao[1].toLowerCase();
      const jaTinha = (montagemAtual?.itens ?? []).some((x) =>
        String(x.obs ?? "").toLowerCase().includes("pão de ló " + tipo) ||
        String(x.obs ?? "").toLowerCase().includes("pao de lo " + tipo),
      );
      if (!jaTinha && !falaDoCliente.toLowerCase().includes(tipo)) {
        return (
          "NAO anotei: o cliente nunca falou em pao de lo " + tipo + ". Ele nao respondeu a sua pergunta, e escolher " +
            "por ele faz a cozinha assar a massa errada. Pergunte de novo, numa frase, e anote o que ele responder. " +
            "O resto do bolo voce pode anotar agora, sem essa parte."
        );
      }
    }

    // TEMA DE TOPO NAO E SABOR: quem pediu topo de unicornio nao pediu bolo de
    // unicornio, e dizer que a casa nao faz esse bolo trava a conversa.
    const temaDeTopo = String(falaDoCliente).match(/(?:topo|papel de arroz|tema)\s+(?:de\s+|do\s+|da\s+)?([\wáàâãéêíóôõúç -]{3,30})/i);
    const soTema =
      !!temaDeTopo &&
      produto.toLowerCase().includes(String(temaDeTopo[1]).trim().toLowerCase().split(" ")[0]) &&
      !/topo|papel de arroz/i.test(String(obsItem ?? ""));
    if (soTema) {
      console.warn("[ia] tema do topo veio como sabor de bolo: " + produto);
      return (
        "NAO anotei: \"" + String(temaDeTopo[1]).trim() + "\" e o TEMA do topo, nao o sabor do bolo. Anote o topo na " +
        "observacao do bolo (ex: obs \"topo de " + String(temaDeTopo[1]).trim() + "\") e pergunte, separado, qual SABOR de " +
        "bolo ele quer. Dizer que a padaria nao faz bolo desse tema derruba a venda por engano."
      );
    }

    // SABOR DE BOLO DE FESTA TEM QUE EXISTIR NO CARDAPIO.
    //
    // Aceitar um sabor que a casa nao faz nao para na conversa: na hora de
    // cobrar, o motor casa com o produto parecido que existe e o pedido fecha
    // com outro bolo, outro preco e outra unidade.
    if (categoria === "bolo_festa") {
      const doCardapio: string[] = [];
      for (const f of (catalogo.bolos_recheados?.faixas ?? []) as { sabores?: string[] }[]) {
        for (const sab of f.sabores ?? []) doCardapio.push(String(sab).toLowerCase());
      }
      const pedido = produto.replace(/^bolo (de |do |da )?/i, "").trim().toLowerCase();
      // Sem acento dos dois lados: o cliente escreve "prestigio", "pessego",
      // "maracuja". Recusar por acento e dizer que nao faz o que esta no cardapio.
      const limpo = (t: string) =>
        String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const combina = (x: string) => doCardapio.some((d) => {
        const a = limpo(d);
        const b = limpo(x);
        return a === b || a.includes(b) || b.includes(a);
      });
      // Bolo misto: cada metade tem que existir.
      const partes = pedido.split(/ com | e /).map((x) => x.trim()).filter(Boolean);
      const existe = combina(pedido) || (partes.length > 1 && partes.every(combina));
      if (pedido && !existe) {
        return (
          "NAO anotei: a padaria nao faz bolo de festa de " + pedido + ". Fechar um sabor que a casa nao tem faz o pedido sair com outro bolo e outro preco. Mande a peca do cardapio de bolos de festa (enviar_cardapio) e diga que temos: " + doCardapio.slice(0, 8).join(", ") + ". Anote o que ele escolher."
        );
      }
    }

    // BOLO DE DOIS SABORES: os dois tem que estar no NOME.
    //
    // O cliente pediu brigadeiro com morango e ela anotou so "bolo brigadeiro",
    // com o pao de lo e o tema na observacao. O motor cobra o sabor mais caro
    // quando ve os dois, entao o bolo saiu a R$ 46,90 o quilo em vez de R$ 49,90
    // e a padaria perdeu R$ 12 no bolo de 4 kg.
    if ((categoria === "bolo_festa" || categoria === "bolo_caseiro") && !/ com /i.test(produto)) {
      // Os sabores que o cliente acabou de citar. Dois ou mais e bolo misto:
      // o nome precisa trazer os dois, senao a padaria cobra a menos e a
      // cozinha faz um sabor so.
      const ditos = SABORES_DE_BOLO.filter((sab) => new RegExp(sab, "i").test(ultimaFala));
      const noNome = ditos.filter((sab) => new RegExp(sab, "i").test(produto));
      if (ditos.length >= 2 && noNome.length < 2) {
        return (
          `NAO anotei: o cliente falou em ${ditos.join(" e ")} no mesmo bolo, e voce mandou so "${produto}". ` +
          `Chame anotar_item de novo com os DOIS sabores no nome, assim: "bolo ${ditos[0]} com ${ditos[1]}". ` +
          `Bolo misto vale o preco do sabor mais caro; com um sabor so no nome a padaria cobra a menos e a cozinha ` +
          `faz o bolo errado.`
        );
      }
    }
    // PRODUTO NOVO SO ENTRA COM O NUMERO DA MENSAGEM EM QUE ELE FOI CITADO.
    //
    // "e cachorro quente voces fazem?" virou 2 kg de cachorro-quente, numero
    // emprestado dos 2 kg de torta fria pedidos antes. Pergunta nao e pedido.
    const jaNoPedido = (montagemAtual?.itens ?? []).some(
      (x) => String(x.produto ?? "").trim().toLowerCase() === produto.trim().toLowerCase(),
    );
    if (!jaNoPedido && qtd > 0) {
      const naUltima = /[0-9]/.test(String(ultimaFala ?? ""));
      const soPergunta =
        /voc[êe]s? (fazem|tem|t[êe]m|vendem)|tem\s|faz\s|existe/i.test(String(ultimaFala ?? "")) &&
        !naUltima;
      if (soPergunta) {
        console.warn("[ia] pergunta virando pedido: " + qtd + " de " + produto + "; recusado");
        return (
          "NAO anotei: nesta mensagem o cliente so PERGUNTOU se a padaria faz " + produto + ", sem dizer quantidade. " +
          "Responda que faz, diga como e vendido, e pergunte quanto ele quer. Numero de outro produto nao vale pra este."
        );
      }
    }

    // QUANTIDADE QUE O CLIENTE NAO FALOU NAO ENTRA.
    //
    // Ele escolheu tres tipos sem dizer quantos e ela anotou 100 de cada,
    // dividindo a sugestao por conta propria. Numero so entra se veio dele,
    // em algarismo ou por extenso, ou se ele mandou dividir.
    const POR_EXTENSO: Record<string, number> = {
      um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
      oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40,
      cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
      duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, duzia: 12, meia: 6,
    };
    // "metade frito metade assado" e "meio a meio" tambem sao ordem de dividir:
    // o cliente deu o total e mandou repartir.
    const mandouDividir = /divid|igual|sortido|metade|meio a meio|meio-a-meio|voce que sabe|voce escolhe|do seu jeito|como voce achar|o que voce sugerir/i.test(
      falaDoCliente,
    );
    // Nomes separados por tipo: e assim que da pra saber quantos tipos ele
    // citou dentro da metade frita e dentro da assada.
    const NOMES_FRITO = ((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) =>
      String(i.nome).toLowerCase(),
    );
    const NOMES_ASSADO = ((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) =>
      String(i.nome).toLowerCase(),
    );
    // Os nomes de salgado do cardapio, pra saber quantos tipos o cliente citou
    // numa mesma frase.
    const SALGADOS_CONHECIDOS = [
      ...(((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome).toLowerCase())),
      ...(((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome).toLowerCase())),
    ];

    // PRODUTO QUE NINGUEM CITOU NAO ENTRA.
    //
    // Vale o que o cliente escreveu e o que ELA propos e ele aceitou (a
    // indicacao da festa). Fora isso e producao que ninguem pediu.
    const familiaEscolhida = categoria === "docinho" || String(categoria).startsWith("salgado");
    if (familiaEscolhida) {
      // Sem acento e sem plural: o cliente escreve "risoles", "esfirras",
      // "coxinhas", e o cardapio guarda "risólis", "esfirra", "coxinha".
      const semAcento = (t: string) =>
        String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const dito = semAcento(falaDoCliente + " " + (ultimaFalaDela || ""));
      const nome = semAcento(produto).trim();
      const raiz = (t: string) => t.replace(/(es|s)$/, "");
      const primeiraPalavra = nome.split(/\s+/)[0];
      const pedacos = [nome, raiz(nome), primeiraPalavra, raiz(primeiraPalavra)].filter((x) => x.length > 3);
      // Compara pelo comeco da palavra: risoles x risolis, croquete x croquetes.
      const citado = pedacos.some((x) => dito.includes(x) || dito.includes(x.slice(0, Math.max(4, x.length - 2))));
      const jaEstava = itensAgora().some(
        (x) => String(x.produto ?? "").trim().toLowerCase() === nome,
      );
      if (!citado && !jaEstava) {
        return (
          "NAO anotei: ninguem falou em " + produto + " nesta conversa. Salgado ou docinho que aparece do nada vira producao que o cliente nao pediu e nao vai pagar. Anote so o que ele escolheu, e se faltar escolher, pergunte."
        );
      }
    }

    // A SOMA DA FAMILIA NAO PASSA DO TOTAL QUE ELE DISSE.
    //
    // "600 salgados, metade frito metade assado" com quatro tipos anotados a
    // 300 cada vira 1200. O cliente le o total no fim e desiste, ou a padaria
    // produz o dobro.
    if (familiaEscolhida) {
      const alvo = categoria === "docinho" ? /([0-9]+) *(docinho|doce)/i : /([0-9]+) *salgado/i;
      let pedidoTotal = Number((String(falaDoCliente).match(alvo) ?? [])[1] ?? 0);
      // Ele disse 'metade de cada' sem numero: o total e o que ELA acabou de
      // propor. Sem isto, cada tipo levava o total inteiro e a festa triplicava.
      if (!pedidoTotal) {
        const daSugestao = Number((String(ultimaFalaDela).match(alvo) ?? [])[1] ?? 0);
        const dividindo = /de cada|meio a meio|metade|igual|divid/i.test(String(falaDoCliente));
        if (daSugestao > 0 && dividindo) pedidoTotal = daSugestao;
      }
      // "metade frito metade assado": cada metade e um balde separado, senao a
      // conta fecha no total e estoura dentro de uma das duas.
      // So e meio a meio quando ele cita OS DOIS tipos: "metade frito metade
      // assado". "Metade de cada" entre dois produtos escolhidos e outra coisa,
      // e ler como metade/metade dividia o pedido duas vezes.
      const citouFrito = /frito|fritos/i.test(falaDoCliente);
      const citouAssado = /assado|assados/i.test(falaDoCliente);
      const meioAMeio =
        citouFrito &&
        citouAssado &&
        /(metade|meio a meio|50 ?%)/i.test(falaDoCliente);
      const soDoTipo = meioAMeio && String(categoria).startsWith("salgado");
      if (soDoTipo) pedidoTotal = Math.round(pedidoTotal / 2);
      if (pedidoTotal > 0) {
        const mesmaFamilia = itensAgora().filter((x) =>
          categoria === "docinho"
            ? x.categoria === "docinho"
            : soDoTipo
              ? x.categoria === categoria
              : String(x.categoria ?? "").startsWith("salgado"),
        );
        const jaTem = mesmaFamilia
          .filter((x) => String(x.produto ?? "").trim().toLowerCase() !== produto.trim().toLowerCase())
          .reduce((t, x) => t + (Number(x.qtd) || 0), 0);
        // Ele citou mais de um tipo pra essa metade e nao deu o numero de cada:
        // a divisao e feita aqui, senao o primeiro tipo leva tudo.
        const listaDoTipo = categoria === "salgado_frito" ? NOMES_FRITO : categoria === "salgado_assado" ? NOMES_ASSADO : [];
        // Os numeros que ELE escreveu: se a quantidade veio dele, respeita.
        const numerosDaFala = new Set<number>(
          (String(falaDoCliente).match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []).map((x) => Number(x.replace(",", "."))),
        );
        if (listaDoTipo.length && !numerosDaFala.has(qtd)) {
          const semAcento2 = (t: string) =>
            String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const falaLimpa = semAcento2(falaDoCliente);
          const citados = listaDoTipo.filter((n) => {
            const x = semAcento2(n);
            return falaLimpa.includes(x) || falaLimpa.includes(x.slice(0, Math.max(4, x.length - 2)));
          }).length;
          const cabe = Math.floor(pedidoTotal / Math.max(1, citados));
          if (citados > 1 && qtd > cabe && cabe > 0) {
            // Recusar fazia o item sumir do pedido: ela corrigia um tipo e
            // esquecia o outro. Corrigir aqui garante que nada se perde.
            qtd = cabe;
            avisoDivisao =
              " Dividi os " + pedidoTotal + " entre os " + citados + " tipos que ele citou: " + cabe +
              " de cada. Anote AGORA os outros " + (citados - 1) + " tipo(s) com " + cabe +
              " cada, na mesma resposta, senao eles ficam de fora do pedido.";
          }
        }
        if (jaTem + qtd > pedidoTotal) {
          const resta = Math.max(0, pedidoTotal - jaTem);
          // Quantos tipos dessa metade o cliente citou nesta fala: e por eles
          // que o resto se divide.
          const tiposCitados = (SALGADOS_CONHECIDOS as string[]).filter((n) =>
            falaDoCliente.toLowerCase().includes(n),
          ).length;
          const cada = tiposCitados > 1 ? Math.floor(resta / tiposCitados) : resta;
          return (
            "NAO anotei: cabem " + pedidoTotal + " nessa parte do pedido e ja tem " + jaTem + ". Somando " + qtd + " de " + produto + " passa do que o cliente pediu. Sobram " + resta + ", e ele citou " + Math.max(1, tiposCitados) + " tipo(s) aqui: anote " + cada + " de cada um e as contas fecham. Nao pergunte de novo o que ele ja escolheu."
          );
        }
      }
    }

    // Quantidade com virgula tambem conta: bolo e vendido em kg e "2,5 kg" e
    // o jeito normal de pedir. Lendo so inteiro, 2,5 virava 2 e 5 e a trava
    // recusava a quantidade que o proprio cliente acabou de falar.
    const numerosDitos = new Set<number>();
    for (const n of falaDoCliente.match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []) numerosDitos.add(((x) => Number(String(x).replace(",", ".")))(n));
    // Numero que ela propos e o cliente respondeu em cima: vale. Sem isso, o
    // cliente que aceita a sugestao ("pode ser assim") travava o pedido.
    for (const n of (ultimaFalaDela || "").match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []) numerosDitos.add(((x) => Number(String(x).replace(",", ".")))(n));
    // Palavra INTEIRA, nao pedaco: "umas 30" contem "um" e liberava qualquer
    // quantidade 1 que ela inventasse.
    const palavrasDitas = new Set((falaDoCliente.toLowerCase().match(/[0-9a-zà-úçãõâêôáéíóú]+/g) ?? []));
    for (const [palavra, valor] of Object.entries(POR_EXTENSO)) {
      if (palavrasDitas.has(palavra)) numerosDitos.add(valor);
    }
    // Papel de arroz e topo de bolo sao um por bolo: ninguem diz "quero 1 topo",
    // diz "quero topo". Cobrar o numero deles trava a conversa a toa.
    const unicoPorNatureza = /papel de arroz|topo de bolo|topo/i.test(produto) || categoria === "papel_de_arroz";
    // Item que JA esta no pedido com essa mesma quantidade nao esta pedindo
    // quantidade nenhuma: ela so esta mexendo na observacao (topo, tema, nome).
    // Sem isso a trava barrava a propria atualizacao do bolo.
    const mesmaQtdJaAnotada = (montagemAtual?.itens ?? []).some(
      (x) =>
        x.produto.trim().toLowerCase() === produto.trim().toLowerCase() &&
        x.categoria === categoria &&
        Number(x.qtd) === qtd,
    );
    if (!unicoPorNatureza && !mesmaQtdJaAnotada && !mandouDividir && !numerosDitos.has(qtd)) {
      return (
        `NAO anotei: o cliente nunca falou em ${qtd} de ${produto}. Quantidade e escolha dele, nao sua. ` +
        `Pergunte QUANTOS de cada ele quer. Se ele mandar voce dividir o total, ai sim pode dividir e anotar.`
      );
    }

    // TOPO E PAPEL DE ARROZ SAO DO BOLO, NAO ITEM SOLTO.
    //
    // Viraram linha propria no pedido e a arte do bolo (tema, nome, idade)
    // acabou espalhada neles. Quem monta o bolo precisa ler tudo junto, num
    // lugar so. O preco nao se perde: o motor cobra o papel de arroz que estiver
    // na observacao do bolo, e o topo vai pra equipe confirmar.
    if (/^(topo de bolo|topo|papel de arroz)$/i.test(produto)) {
      // Tem bolo no pedido? Entao isso vai PRA DENTRO dele, aqui mesmo, sem
      // depender de ela chamar de novo.
      const boloDoPedido = (montagemAtual?.itens ?? []).find((x) =>
        String(x.categoria || "").startsWith("bolo"),
      );
      if (boloDoPedido) {
        const juntos = [String(boloDoPedido.obs ?? "").trim(), produto, String(obsBruta || "").trim()]
          .filter(Boolean)
          .join(", ");
        estado.montagem.push({
          tipo: "item",
          produto: boloDoPedido.produto,
          categoria: boloDoPedido.categoria,
          qtd: boloDoPedido.qtd,
          obs: juntos,
        });
        return (
          `Coloquei o ${produto} dentro do bolo, que e onde a cozinha le. O bolo agora esta assim: "${juntos}". ` +
          `Nao precisa anotar de novo; siga a conversa e confirme pro cliente numa frase.`
        );
      }
      return (
        `NAO anotei "${produto}" como item: isso faz parte do BOLO. Chame anotar_item do bolo de novo com isso na ` +
        `observacao, junto do resto (ex: "pao de lo branco, topo de bolo, papel de arroz, tema homem aranha, nome ` +
        `Theo, 8 anos, prato aberto"). Assim a cozinha le o bolo inteiro numa linha so.`
      );
    }

    // GENERICO NAO ENTRA NO PEDIDO.
    //
    // Ela anotava "250 salgados fritos" e seguia a conversa, e aquilo ficava no
    // pedido como se fosse item. Salgado nao se produz: coxinha se produz. O
    // cliente TEM que escolher os tipos, e e pra isso que a festa tem etapas.
    if (semTipo(produto)) {
      const tipos = TIPOS_DA_FAMILIA[produto.toLowerCase()] ?? TIPOS_DA_FAMILIA[categoria] ?? [];
      return (
        `NAO anotei "${produto}": isso e categoria, nao produto, e a cozinha nao produz categoria. ` +
        (tipos.length ? `Pergunte QUAIS ele quer, entre ${tipos.join(", ")}, e quantos de cada. ` : `Pergunte QUAIS ele quer e quantos de cada. `) +
        `E pergunte QUANTOS DE CADA: quem divide o total e o cliente, nunca voce. Nao ofereca "dividir igual" nem ` +
        `"sortido" por conta propria, porque quase ninguem quer a mesma quantidade de tudo. Anote so depois que ele escolher.`
      );
    }
    // O ITEM ENTRA AQUI, depois de passar por todas as recusas acima.
    // Recusa que enfileira o item antes de verificar nao recusa nada: era por
    // isso que o painel mostrava justamente o que a guarda dizia ter barrado.
    // A observacao nova COMPLETA a que ja existe quando nao briga com ela: a
    // trufa tinha a forminha e recebeu o sabor, e virava uma segunda trufa.
    // Lista inteira de opcoes na observacao e a pergunta copiada, nao a
    // escolha: entra vazia e o sabor segue pendente.
    if (obsEhAListaInteira(produto, obsItem)) {
      console.warn("[ia] a lista de sabores veio como observacao de " + produto + "; descartada");
      obsItem = null;
    }

    // NOME DO CARDAPIO MANDA, E O RESTO DO NOME VIRA OBSERVACAO.
    {
      const semAcN = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const todosDoCardapio: string[] = [
        ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome)),
        ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome)),
        ...((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome)),
        ...((catalogo.outros_produtos ?? []) as { nome: string }[]).map((i) => String(i.nome)),
      ];
      const alvoN = semAcN(produto);
      // O mais longo primeiro: 'torta fria com palmito' ganha de 'torta fria'.
      const base = todosDoCardapio
        .filter((n) => {
          const x = semAcN(n);
          if (!x || alvoN === x) return alvoN === x;
          return alvoN.startsWith(x + " ");
        })
        .sort((a, b) => semAcN(b).length - semAcN(a).length)[0];
      if (base && semAcN(base) !== alvoN) {
        const sobra = produto
          .slice(base.length)
          .trim()
          .replace(/^(de|do|da|com|sabor)\s+/i, "")
          .trim();
        console.warn("[ia] nome com sabor colado: \"" + produto + "\" virou \"" + base + "\" + obs \"" + sobra + "\"");
        produto = base;
        if (sobra) {
          const jaTem = obsItem && semAcN(obsItem).includes(semAcN(sobra));
          obsItem = jaTem ? obsItem : [String(obsItem ?? "").trim(), sobra].filter(Boolean).join(", ");
        }
      } else if (base) {
        // Mesmo produto, grafia diferente (empadão x empadao): vale a do
        // cardapio, que e a que casa com a tabela de preco.
        produto = base;
      }
    }

    // SABOR EM PRODUTO QUE NAO TEM SABOR: E O IRMAO RECHEADO QUE ELE QUER.
    //
    // "cuca" com observacao "banana" fechou pedido depois de "cuca recheada de
    // banana" ter sido recusada. Produto sem lista nao vira atalho.
    if (obsItem && String(obsItem).trim() && opcoesDeSabor(produto).length === 0) {
      const semAc0 = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const base = semAc0(produto);
      const irmaos = ((catalogo.outros_produtos ?? []) as { nome: string; sabores?: string[] }[]).filter(
        (i) =>
          Array.isArray(i.sabores) &&
          i.sabores.length > 0 &&
          semAc0(i.nome) !== base &&
          semAc0(i.nome).startsWith(base),
      );
      if (irmaos.length) {
        const ops = irmaos[0].sabores as string[];
        const combina = ops.some((o) => semAc0(obsItem as string).includes(semAc0(o)));
        if (!combina) {
          console.warn("[ia] sabor entrando por " + produto + " (sem lista): " + obsItem);
          return (
            "NAO anotei: " + produto + " nao tem recheio, e \"" + String(obsItem).trim() + "\" nao e sabor de " +
            irmaos[0].nome + ". As opcoes de " + irmaos[0].nome + " sao: " + ops.join(", ") + ". " +
            "Pergunte qual ele quer, ou confirme que e o produto sem recheio mesmo, e anote sem observacao de sabor."
          );
        }
        // O sabor e do irmao recheado: e ele que entra, com o preco dele.
        console.warn("[ia] sabor de " + irmaos[0].nome + " anotado em " + produto + "; produto corrigido");
        produto = irmaos[0].nome;
      }
    }

    // QUANTIDADE DE PECA EM PRODUTO DE QUILO NAO VIRA QUILO.
    if (unidadeDoProduto(produto, categoria) === "kg") {
      const falaAgora = String(ultimaFala ?? "");
      const temPeso = /[0-9]+([.,][0-9]+)? *(kg|quilos?|k)\b|meio quilo|meia duzia de quilo/i.test(falaAgora);
      // "3 cucas", "duas cucas", "uma torta": contagem de peca, nao peso.
      const nomeCurto = produto.split(" ")[0];
      const contando = new RegExp(
        "(^|[^0-9])([0-9]{1,3}|uma?|dois|duas|tres|três|quatro|cinco|meia|meio) *" + nomeCurto,
        "i",
      ).test(falaAgora);
      if (!temPeso && contando) {
        console.warn("[ia] " + produto + " pedido por quantidade; e vendido por quilo");
        return (
          "NAO anotei: " + produto + " e vendido POR QUILO, e ele falou em quantidade de peca. Numero de peca virando quilo cobra o valor errado nos dois sentidos. Explique numa frase que " + produto + " sai por quilo, diga quanto e o quilo, e pergunte quantos quilos ele quer. Anote so depois que ele disser o peso."
        );
      }
    }

    // O SABOR QUE ELE ESCREVEU COLADO NO PRODUTO NAO SE PERDE.
    //
    // Vale tambem quando a observacao veio preenchida com outra coisa (tema,
    // "a definir", o pedido inteiro repetido): o que conta e ter um sabor da
    // lista do produto. Olhando so a observacao vazia, esta regra disparou zero
    // vezes numa bateria inteira.
    {
      const opsDele = opcoesDeSabor(produto);
      const semAcJa = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const jaTemSabor = opsDele.some((o) => semAcJa(obsItem ?? "").includes(semAcJa(o)));
      if (opsDele.length && !jaTemSabor) {
        const semAcF = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const falaLimpa = semAcF(falaDoCliente);
        const alvoNome = semAcF(produto);
        // Procura '<produto> de <sabor>' ou '<produto> com <sabor>' na fala.
        const achado = opsDele.find((o) => {
          const sab = semAcF(o);
          const re = new RegExp(alvoNome + "[a-z ]{0,12}(de|com|sabor) " + sab.replace(/[.*+?^${}()|[\\]\\\\]/g, ""), "i");
          return re.test(falaLimpa);
        });
        if (achado) {
          console.warn("[ia] sabor " + achado + " estava na fala do cliente pra " + produto + "; anotado pelo codigo");
          obsItem = [String(obsItem ?? "").trim(), achado].filter(Boolean).join(", ");
        }
      }
    }

    // SABOR QUE O CLIENTE NAO ESCREVEU NAO E ESCOLHA DELE.
    const opsFechadas = opcoesDeSabor(produto);
    if (opsFechadas.length && obsItem && String(obsItem).trim()) {
      const semAc = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // A observacao pode ser zerada logo abaixo, entao a leitura fica presa
      // numa variavel propria.
      const obsAgora = String(obsItem ?? "");
      const naObs = opsFechadas.filter((o) => semAc(obsAgora).includes(semAc(o)));
      const doCliente = naObs.filter((o) => semAc(falaDoCliente).includes(semAc(o)));
      if (naObs.length && !doCliente.length) {
        console.warn("[ia] sabor inventado pra " + produto + ": " + naObs.join(", ") + "; item entra sem sabor");
        // O item fica, o sabor sai: e o item sem sabor que segura o pedido.
        obsItem = null;
        avisoSabor =
          " O sabor NAO foi anotado: o cliente nunca falou em " + naObs.join(" nem em ") + ". Pergunte qual ele quer, citando as opcoes (" + opsFechadas.join(", ") + "). O item ficou no pedido esperando essa resposta.";
      }
    }

    // SABOR FORA DA LISTA DO CARDAPIO: ANOTA E AVISA, NUNCA ACEITA CALADO.
    const listaFechada = ((catalogo.outros_produtos ?? []) as { nome: string; sabores?: string[] }[]).find(
      (i) =>
        Array.isArray(i.sabores) &&
        i.sabores.length > 0 &&
        String(i.nome).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
          produto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
    if (listaFechada && obsItem && String(obsItem).trim()) {
      const dito = String(obsItem).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const conhecido = (listaFechada.sabores ?? []).some((sab) => {
        const x = String(sab).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return dito.includes(x) || x.includes(dito);
      });
      if (!conhecido) {
        console.warn("[ia] sabor fora do cardapio em " + produto + ": " + obsItem + "; item entra sem sabor");
        // Fica guardado no pedido: o historico da conversa continua com a
        // banana escrita, e sem isto ela volta a propor banana a cada turno.
        const jaRecusados = String(montagemAtual?.dados?.sabor_recusado ?? "");
        const novoRecusado = produto + " de " + String(obsItem).trim();
        if (!jaRecusados.toLowerCase().includes(novoRecusado.toLowerCase())) {
          estado.montagem.push({
            tipo: "dados",
            dados: { sabor_recusado: [jaRecusados, novoRecusado].filter(Boolean).join("; ") },
          });
        }
        // Recusar o item inteiro fazia a encomenda sumir. O item entra sem o
        // sabor invalido e cobra a escolha ate o fim.
        avisoSabor =
          " A padaria NAO faz " + produto + " de " + String(obsItem).trim() + ". Diga isso ao cliente, cite os sabores (" + (listaFechada.sabores ?? []).join(", ") + ") e pergunte qual ele quer. O item ficou no pedido esperando essa resposta, entao nao repita a recusa toda mensagem.";
        obsItem = null;
      }
    }

    // PIZZA: O NOME E O TAMANHO, O SABOR E OBSERVACAO.
    //
    // "pizza inteira calabresa" nao existe na tabela e sai por R$ 0. Aqui o
    // nome volta pra 'pizza inteira' ou 'pizza meia' e o sabor desce pra obs,
    // onde a cozinha le e o preco fecha.
    let produtoPizza = produto;
    let obsPizza = obsItem;
    if (categoria === "pizza" || /^pizza/i.test(produto)) {
      const meia = /meia|metade/i.test(produto) || /meia|metade/i.test(String(falaDoCliente));
      const base = meia ? "pizza meia" : "pizza inteira";
      const sabor = produto
        .replace(/^pizza/i, "")
        .replace(/inteira|meia|de forma|forma|redonda/gi, "")
        .replace(/^\s*(de|com)\s+/i, "")
        .trim();
      if (sabor) {
        const jaNaObs = String(obsItem ?? "").toLowerCase().includes(sabor.toLowerCase());
        obsPizza = jaNaObs ? obsItem : [String(obsItem ?? "").trim(), sabor].filter(Boolean).join(", ");
      }
      produtoPizza = base;
    }

    // Sabor diferente do mesmo produto continua sendo linha nova.
    const jaTem = (montagemAtual?.itens ?? []).find(
      (x) => x.categoria === categoria && x.produto.trim().toLowerCase() === produtoPizza.trim().toLowerCase(),
    );
    let obsFinal = obsPizza;
    if (jaTem && obsPizza) {
      const antiga = String(jaTem.obs ?? "").trim();
      const nova = String(obsPizza).trim();
      const ops = SABORES[produto.toLowerCase()] ?? [];
      const saborDe = (t: string) => ops.find((o) => t.toLowerCase().includes(o.trim().toLowerCase())) ?? "";
      const brigam = !!saborDe(antiga) && !!saborDe(nova) && saborDe(antiga) !== saborDe(nova);
      const contida = antiga.toLowerCase().includes(nova.toLowerCase()) || nova.toLowerCase().includes(antiga.toLowerCase());
      if (antiga && !brigam && !contida) obsFinal = antiga + ", " + nova;
    }
    // Produto de quilo com peso dito na fala: o peso e a quantidade. Ela ja
    // anotou "1" pra quem pediu 1,5 kg, e a padaria cobraria meio quilo a menos.
    if (unidadeDoProduto(produto, categoria) === "kg") {
      // Um peso so na fala: sem isso, "3 kg de bolo e 2 kg de torta" colocaria
      // 3 kg nos dois. Com dois pesos na frase quem decide continua sendo ela.
      const pesos = [...String(falaDoCliente).matchAll(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|quilos?)/gi)];
      if (pesos.length === 1) {
        const peso = Number(pesos[0][1].replace(",", "."));
        if (peso > 0 && peso !== qtd) {
          console.warn("[ia] peso do cliente vale: " + qtd + " -> " + peso + " kg de " + produto);
          qtd = peso;
        }
      }
    }
    estado.montagem.push({ tipo: "item", produto: produtoPizza, categoria, qtd, obs: obsFinal });

    // Topo ou papel de arroz sem foto do tema: peca uma vez, sem insistir. A
    // peca e fabricada em cima do tema, e com a foto a producao acerta melhor.
    // Nao trava o pedido: muita gente nao tem foto nenhuma.
    const pedeArte =
      citadoDeVerdade(String(obsItem ?? ""), "topo") || citadoDeVerdade(String(obsItem ?? ""), "papel de arroz");
    const temFoto = /foto/i.test(String(obsItem ?? ""));
    if ((categoria === "bolo_festa" || categoria === "bolo_caseiro") && pedeArte && !temFoto) {
      return (
        `Anotei ${qtd} kg de ${produto}. Como tem topo ou papel de arroz, peca a foto do tema UMA vez, numa frase ` +
        `("se tiver uma foto do tema, me manda que ajuda bastante"). Se ele nao tiver, tudo bem, siga o pedido.` + avisoDivisao
      );
    }

    // O aviso de sabor faltando vem AQUI, no mesmo turno. A lista de pendências
    // do fim do prompt é montada antes da resposta, então ela só enxergaria a
    // falta na mensagem seguinte: foi assim que ela anotou 50 trufas e foi
    // perguntar a cor da forminha sem perguntar o sabor da trufa.

    const opcoes = SABORES[produto.toLowerCase()];
    if (opcoes && faltaSabor(obsItem, opcoes)) {
      return (
        `Anotei ${qtd} de ${produto}, mas FALTA O SABOR. Pergunte AGORA citando as opcoes na propria mensagem, ` +
        `assim: "Qual o sabor d${produto.endsWith("a") ? "a" : "o"} ${produto}: ${opcoes.join(", ")}?". ` +
        `Perguntar "qual voce prefere?" sem dizer as opcoes deixa o cliente sem saber o que responder. ` +
        `Se ele ja disse o sabor na conversa, chame anotar_item de novo com ele na observacao em vez de perguntar.` + avisoDivisao
      );
    }
    return `Anotei ${qtd} de ${produto} no pedido.${avisoDivisao}${avisoSabor} Continue a conversa normalmente; o pedido fica guardado e você não precisa repetir os itens anteriores.`;
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
    for (const k of ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento", "observacoes", "nao_quer"]) {
      const v = input[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") dados[k] = String(v);
    }
    if (Object.keys(dados).length === 0) return "Nada pra anotar: não veio nenhum dado preenchido.";
    estado.montagem.push({ tipo: "dados", dados });

    // FECHOU O ULTIMO DADO? ENTAO E AGORA.
    //
    // A ordem de registrar so aparece no lembrete do TURNO SEGUINTE, e foi assim
    // que ela recebeu o nome e o pagamento, respondeu "ja passei pra equipe" e
    // nao registrou nada: o cliente saiu achando que encomendou.
    const juntos: Record<string, unknown> = { ...(montagemAtual?.dados ?? {}), ...dados };
    const temTudo = ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento"].every(
      (k) => juntos[k] && String(juntos[k]).trim() !== "",
    );
    const itensAnotados = montagemAtual?.itens ?? [];
    const pendentes = pendenciasDeSabor(
      itensAnotados,
      ehFestaNaFala(falaDoCliente),
      /bolo/i.test(falaDoCliente),
      String(montagemAtual?.dados?.nao_quer ?? ""),
    );
    if (temTudo && itensAnotados.length > 0 && pendentes.length === 0) {
      return (
        `Anotei: ${Object.keys(dados).join(", ")}. AGORA NAO FALTA MAIS NADA NESTE PEDIDO. ` +
        `Chame registrar_pedido nesta mesma resposta e mande a confirmacao com os itens e o total. ` +
        `Dizer que passou pra equipe sem chamar a ferramenta deixa o cliente achando que encomendou sem existir pedido.`
      );
    }
    if (temTudo && pendentes.length > 0) {
      return (
        `Anotei: ${Object.keys(dados).join(", ")}. Ainda NAO da pra fechar, falta isto:` +
        "\n" +
        pendentes.join("\n") +
        "\nPergunte isso antes de falar em passar pra equipe."
      );
    }
    return `Anotei: ${Object.keys(dados).join(", ")}. O resto do pedido continua guardado.`;
  }

  if (nome === "chamar_humano") {
    // PEDIDO PRONTO NAO VIRA HANDOFF.
    //
    // Com o pedido inteiro montado e o cliente mandando fechar, ela respondeu
    // "deixa eu chamar alguem da equipe" duas vezes seguidas, so porque o topo
    // de bolo nao tem preco. A festa ficava fora da fila. Topo sem preco e caso
    // de registrar com precisa_confirmacao, que e como sempre funcionou.
    const d = montagemAtual?.dados ?? {};
    const completo =
      (montagemAtual?.itens?.length ?? 0) > 0 &&
      ["cliente_nome", "retirada_data", "retirada_hora", "forma_pagamento"].every(
        (k) => d[k] && String(d[k]).trim() !== "",
      );
    const pediuGente = /falar com (alguem|algu[ée]m|uma pessoa|atendente|humano|voc[êe]s)|quero falar com/i.test(falaDoCliente);
    if (completo && !estado.pedido && !pediuGente) {
      return (
        "NAO chamei a equipe: este pedido esta completo e o cliente quer fechar. Valor que voce nao sabe (o topo de " +
        "bolo) nao e motivo pra passar a conversa: chame registrar_pedido com precisa_confirmacao=true e o motivo, " +
        "que a equipe informa o valor depois. Passar a conversa em vez de registrar deixa a festa fora da fila."
      );
    }
    estado.precisaHumano = true;
    // Ela registrou um pedido de R$ 904 e respondeu ao cliente so "deixa eu
    // chamar alguem da equipe": ele saiu da conversa sem saber que tinha
    // encomendado. Avisar a equipe nao substitui confirmar o pedido.
    if (estado.pedido) {
      return (
        "OK, a equipe foi avisada. MAS o pedido acabou de ser registrado neste mesmo turno: " +
        "mande pro cliente a confirmacao do pedido, com os itens e o total, e nao so um 'vou chamar a equipe'. " +
        "Sem isso ele sai da conversa sem saber que encomendou."
      );
    }
    return "OK, marquei pra equipe assumir esta conversa. Avise o cliente com carinho que já já respondem.";
  }

  if (nome === "enviar_cardapio") {
    // A imagem sai depois, no webhook: aqui só marcamos qual peça mandar. O
    // executor é síncrono e o envio é I/O — misturar os dois travaria o turno.
    const pedidos = (Array.isArray(input.cardapios) ? input.cardapios : [input.cardapio])
      .map((c) => String(c || "").trim())
      .filter((c): c is CardapioId => (CARDAPIOS as readonly string[]).includes(c));
    if (!pedidos.length) return "Não conheço esse cardápio. Peça um destes: " + CARDAPIOS.join(", ");

    // O que ele ja dispensou nao volta como imagem. Vale a recusa anotada no
    // pedido e a que ele acabou de escrever.
    const dispensou = (String(montagemAtual?.dados?.nao_quer ?? "") + " " + String(falaDoCliente || "")).toLowerCase();
    const RECUSA: [string, RegExp][] = [
      ["salgados", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}salgad/],
      ["docinhos", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}(docinho|doce)/],
      ["bolos-festa", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}bolo/],
    ];
    const recusados = RECUSA.filter(([, r]) => r.test(dispensou)).map(([peca]) => peca);
    // A nao ser que ele mesmo peca a peca agora, com todas as letras.
    const pediuAgora = /card[áa]pio|me manda|quais|que tipos|op[çc][õo]es/i.test(String(falaDoCliente || ""));
    const permitidos = pediuAgora ? pedidos : pedidos.filter((c) => !recusados.includes(c));
    if (!permitidos.length) {
      return (
        "NAO mandei o cardapio: o cliente disse que nao quer isso. Siga pra proxima etapa do pedido em vez de oferecer de novo o que ele acabou de dispensar."
      );
    }

    // FESTA TEM ORDEM: SALGADO, DOCINHO, BOLO.
    //
    // O cliente disse "manda tudo que voces tem" e ela despejou OITO imagens de
    // uma vez, sem uma palavra junto: cardapio de pizza, de cuca, de torta, tudo
    // no meio de um orcamento de festa. Ninguem escolhe nada assim. Vai uma peca
    // por vez, na ordem, e o resto depois que ele fechar a etapa.
    const pedidosFiltrados = permitidos;
    const ORDEM: string[] = [
      "salgados",
      "docinhos",
      "bolos-festa",
      "bolos-caseiros",
      "cucas-paes",
      "tortas-empadao",
      "pizza",
      "cupcakes-franciscano",
    ];
    // Conta o que ela acabou de anotar: o cliente que manda tudo numa mensagem
    // ja escolheu salgado e docinho, e receber o cardapio de salgados depois
    // disso e sinal de que ninguem leu o que ele escreveu.
    const itensJa = itensAgora();
    const tem = (pref: string) => itensJa.some((i) => String(i.categoria || "").startsWith(pref));
    // Parte dispensada nao e etapa: o cliente disse que nao quer salgado, pediu o
    // cardapio de docinhos e recebeu o de salgados "porque e a etapa certa".
    const dispensado = String(montagemAtual?.dados?.nao_quer ?? "");
    const fora = (o: string) => new RegExp(o, "i").test(dispensado);
    const etapa =
      !tem("salgado") && !fora("salgado")
        ? "salgados"
        : !tem("docinho") && !fora("docinho|doce")
          ? "docinhos"
          : !tem("bolo") && !fora("bolo")
            ? "bolos-festa"
            : null;

    const naOrdem = [...pedidosFiltrados].sort((a, b) => {
      const ia = ORDEM.indexOf(a) < 0 ? 99 : ORDEM.indexOf(a);
      const ib = ORDEM.indexOf(b) < 0 ? 99 : ORDEM.indexOf(b);
      if (etapa) {
        if (a === etapa) return -1;
        if (b === etapa) return 1;
      }
      return ia - ib;
    });
    // Peca de etapa futura vira a peca da etapa de agora: cardapio de docinho no
    // meio dos salgados faz o cliente escolher docinho antes de fechar salgado.
    const SEQUENCIA = ["salgados", "docinhos", "bolos-festa"];
    // O cliente PEDIU essa familia agora? Entao nao existe redirecionamento:
    // trocar a peca que ele pediu por outra e responder outra pergunta.
    const ULTIMA_FALA = String(falaDoCliente || "").split("  ").pop() || "";
    const pediuNaFala: Record<string, RegExp> = {
      salgados: /salgad|frito|assado|coxinha|esfirra|empadinha|ris[óo]lis/i,
      docinhos: /docinho|doce|brigadeiro|beijinho|trufa/i,
      "bolos-festa": /bolo/i,
      "bolos-caseiros": /bolo caseiro/i,
      "cucas-paes": /cuca|p[ãa]o/i,
      "tortas-empadao": /torta|empad[ãa]o/i,
      pizza: /pizza/i,
      "cupcakes-franciscano": /cupcake|franciscano/i,
    };
    const clientePediu = naOrdem.some((c) => pediuNaFala[c]?.test(ULTIMA_FALA));
    const posEtapa = clientePediu ? -1 : etapa ? SEQUENCIA.indexOf(etapa) : -1;
    let redirecionou = "";
    let alvo = naOrdem;
    if (posEtapa >= 0) {
      const adiantadas = naOrdem.filter((c) => {
        const i = SEQUENCIA.indexOf(c);
        return i >= 0 && i > posEtapa;
      });
      if (adiantadas.length && !naOrdem.includes(etapa as CardapioId)) {
        alvo = [etapa as CardapioId, ...naOrdem.filter((c) => !adiantadas.includes(c))];
        redirecionou =
          ` A festa esta na etapa de ${etapa}, entao mandei essa peca no lugar de ${adiantadas.join(", ")}: ` +
          `o cliente escolhe uma etapa por vez.`;
      }
    }

    // UMA PECA POR VEZ QUANDO A FESTA TEM ETAPA.
    //
    // Ela mandou salgados e docinhos na mesma mensagem: o cliente abre duas
    // imagens, escolhe as duas coisas juntas e a ordem morre ali. Fora de festa
    // (sem etapa) ainda cabem duas, porque ai nao existe sequencia.
    const limite = etapa ? 1 : 2;
    const enviar = alvo.slice(0, limite);
    const sobrou = alvo.slice(limite);

    for (const c of enviar) if (!estado.cardapios.includes(c)) estado.cardapios.push(c);
    if (sobrou.length) {
      return (
        redirecionou +
      `Mandei so ${enviar.join(" e ")}. Peca de cardapio vai uma de cada vez, na ordem da festa: primeiro os ` +
        `salgados, depois os docinhos, depois o bolo. Fale sobre a que acabou de ir e pergunte o que ele quer dela. ` +
        `Quando ele fechar essa etapa, ai sim mande a proxima (${sobrou.join(", ")}). NAO liste itens nem precos em texto.`
      );
    }
    return (
      redirecionou +
      `A imagem do cardápio (${enviar.join(", ")}) já vai ser enviada logo depois da sua mensagem. ` +
      `NÃO liste os itens nem os preços em texto: só diga em uma linha curta que está mandando o cardápio ` +
      `e pergunte o que a pessoa quer.`
    );
  }

  if (nome === "registrar_pedido") {
    // DIA E HORA DA RETIRADA SAO OBRIGATORIOS NO FECHAMENTO.
    //
    // E o que a producao le primeiro na comanda. Pedido sem isso vira papel
    // solto na bancada e alguem tendo que ligar pro cliente pra perguntar.
    const dataRetirada =
      String(input.retirada_data ?? "").trim() || String(montagemAtual?.dados?.retirada_data ?? "").trim();
    const horaRetirada =
      String(input.retirada_hora ?? "").trim() || String(montagemAtual?.dados?.retirada_hora ?? "").trim();
    if (!dataRetirada || !horaRetirada) {
      const falta = [!dataRetirada ? "o DIA da retirada" : "", !horaRetirada ? "a HORA da retirada" : ""]
        .filter(Boolean)
        .join(" e ");
      return (
        "NAO registrei: falta " + falta + ". A cozinha produz pela data e pela hora que estao na comanda, entao pedido sem isso nao pode fechar. Pergunte agora, numa frase, e registre depois que ele responder."
      );
    }
    // ITEM SEM SABOR NAO SE PERDE NO CAMINHO.
    //
    // A IA perguntou o sabor da cuca cinco vezes, o cliente nunca respondeu, e
    // ela fechou o pedido sem as tres cucas. O item some do pedido mas nao some
    // da cabeca do cliente.
    const perguntasDeSabor = falasDela
      .slice(-8)
      .filter((t) => /qual (o )?sabor|que sabor|qual recheio|que recheio/i.test(String(t)))
      .length;

    // SABOR DE PRODUTO COM LISTA FECHADA E OBRIGATORIO NO FECHAMENTO.
    //
    // "3 cucas recheadas" com a lista de sete sabores na observacao ja foi pra
    // cozinha. Sem escolha nao ha o que assar.
    // itensAgora() e o pedido COM o que foi anotado neste turno. Lendo o
    // estado antigo, o sabor que o cliente acabou de escolher nao existia e o
    // pedido travava pra sempre.
    const semSabor = itensAgora().filter((i) => {
      const ops = opcoesDeSabor(String(i.produto));
      if (!ops.length) return false;
      if (obsEhAListaInteira(String(i.produto), i.obs)) return true;
      const t = String(i.obs ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return !ops.some((o) => t.includes(String(o).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    });
    if (semSabor.length) {
      const i = semSabor[0];
      const ops = opcoesDeSabor(String(i.produto));
      // Ja perguntou tres vezes: insistir vira loop e some com o item. A
      // equipe resolve isso numa ligacao.
      // Se ele respondeu agora, nao e caso de equipe: e caso de anotar.
      const respondeuAgora = opcoesDeSabor(String(i.produto)).some((o) =>
        String(ultimaFala ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .includes(String(o).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
      );
      if (perguntasDeSabor >= 3 && !respondeuAgora) {
        estado.precisaHumano = true;
        return (
          "NAO registrei, e ja perguntei o sabor d" + (String(i.produto).endsWith("a") ? "a " : "o ") + i.produto +
          " tres vezes sem resposta. NAO feche o pedido sem esse item e NAO o tire da lista: diga ao cliente que " +
          "alguem da equipe vai falar com ele pra acertar o sabor, e pare de perguntar."
        );
      }
      return (
        "NAO registrei: falta o sabor d" + (String(i.produto).endsWith("a") ? "a" : "o") + " " + i.produto +
        ". As opcoes sao: " + ops.join(", ") + ". Pergunte qual ele quer e registre depois que ele responder; " +
        "a lista de opcoes NAO e a escolha dele, e a cozinha nao produz sete sabores de uma vez."
      );
    }
    const daIA = (input.itens as { item: string; qtd: number; obs?: string; categoria?: string }[]) || [];

    // A LISTA VEM DO PEDIDO EM MONTAGEM, não da memória da IA.
    //
    // Enquanto o cliente falava, cada item foi anotado com a categoria certa e a
    // equipe pôde corrigir na tela. Reconstruir a lista de cabeça na hora de
    // fechar era o que apagava item, trocava bolo por docinho e perdia o papel
    // de arroz. Agora o que está anotado manda; a lista que ela mandou só
    // acrescenta o que por acaso não foi anotado.
    // itensAgora() = o que estava anotado MAIS o que foi anotado neste turno.
    // Com montagemAtual sozinho, o sabor que o cliente acabou de escolher
    // ficava de fora do pedido que vai pra cozinha.
    const anotados = itensAgora().map((i) => ({
      item: i.produto,
      qtd: Number(i.qtd) || 0,
      obs: i.obs ?? undefined,
      categoria: i.categoria || undefined,
    }));
    const chave = (x: { item?: string; categoria?: string }) =>
      String(x.item || "").trim().toLowerCase() + "|" + String(x.categoria || "");
    void chave;
    // Quando existe pedido anotado, ele manda SOZINHO. Deixar a lista dela
    // acrescentar o que "faltava" fez o bolo entrar duas vezes: uma certa, de
    // 4 kg a R$ 49,90, e outra como docinho brigadeiro de R$ 1,25, porque ela
    // reescreveu o bolo de cabeca na hora de fechar.
    const brutos = anotados.length ? anotados : daIA;
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
    // Negacao conta: quem escreveu "nao quero bolo" nao pediu bolo, e exigir a
    // linha trava o pedido pra sempre.
    const dispensouBolo = /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}bolo/i.test(falaDoCliente) ||
      /bolo/i.test(String(montagemAtual?.dados?.nao_quer ?? ""));
    const pediuBoloDeVerdade =
      !dispensouBolo &&
      (falaDeBolo.test(falaDoCliente) || itens.some((i) => falaDeBolo.test(String(i.obs ?? ""))));
    if (!temLinhaDeBolo && pediuBoloDeVerdade) {
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
      // Bolo que veio do pedido montado ja foi conferido quando entrou (e pode
      // ter vindo da indicacao que o cliente aceitou). Cobrar de novo aqui para
      // o pedido numa tela de pendencia sem pendencia.
      const veioDoPedidoMontado = (montagemAtual?.itens ?? []).some((x) => {
        const a = String(x.produto ?? "").trim().toLowerCase();
        const b = String(l.item).trim().toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      if (veioDoPedidoMontado) continue;
      const palavras = sabor.split(/\s+/).filter((p) => p.length > 3);
      // Sem acento: o cliente escreve "prestigio" e o cardapio tem "prestígio".
      // Com acento na comparacao, o pedido parava numa pendencia falsa dizendo
      // que ele nao tinha falado o sabor que ele acabou de escolher.
      const limpar = (t: string) =>
        String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const falaLimpa = limpar(falaDoCliente);
      const falado = palavras.length === 0 || palavras.some((x) => falaLimpa.includes(limpar(x)));
      if (!falado) {
        precisaConfirmacao = true;
        pendencias.push(`confirmar o sabor do bolo: "${sabor}" não foi dito pelo cliente`);
      }
    }

    // Bolo de festa e vendido por QUILO. Linha cobrada por unidade quer dizer
    // que o motor casou com outro produto (um bolo caseiro de nome parecido).
    for (const l of c.linhas) {
      const eraDeFesta = (montagemAtual?.itens ?? []).some((x) => {
        if (String(x.categoria ?? "") !== "bolo_festa") return false;
        const a = String(x.produto ?? "").trim().toLowerCase();
        const b = String(l.item).trim().toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });
      if (eraDeFesta && l.unidade !== "kg") {
        precisaConfirmacao = true;
        pendencias.push(
          "conferir o bolo: o pedido tem bolo de festa (por quilo) e ele saiu como \"" + l.item + "\" por unidade",
        );
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
      // Item que veio do pedido anotado ja passou pela guarda de recheio na hora
      // de entrar, inclusive aceitando o que ELA propos e o cliente confirmou.
      // Rechecar aqui contra a fala do cliente barrava o recheio da indicacao
      // ("100 mini bolha de carne, pode ser assim?" e o cliente dizendo que sim).
      if (anotados.length > 0) continue;
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
    // Pendencia sem motivo escrito nao para o pedido: a tela de espera ficaria
    // com um card sem dizer o que falta, e ninguem consegue resolver isso. Quem
    // detecta pendencia de verdade sao as travas daqui, e todas escrevem o
    // motivo; marcacao vazia da IA segue pra fila normal, que a dona revisa
    // pedido por pedido do mesmo jeito.
    if (precisaConfirmacao && pendencias.length === 0 && !motivoHumano) {
      console.warn("[ia] precisa_confirmacao marcado sem motivo; seguindo pra aprovacao normal");
      precisaConfirmacao = false;
    }
    estado.pedido = {
      itens,
      linhas: c.linhas,
      retiradaData: String(input.retirada_data || ""),
      retiradaHora: input.retirada_hora ? horaLimpa(input.retirada_hora) : undefined,
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
    const temTopo = itens.some((i) => citadoDeVerdade(String(i.obs ?? ""), "topo"));
    estado.resumo =
      `*Pedido recebido*\n` +
      nomeResumo +
      linhaPagamento +
      // Dia sem hora nao serve: o cliente precisa saber quando buscar, e a
      // equipe precisa da mesma informacao no ticket.
      `*Retirada:* ${String(input.retirada_data || "")}${horaLimpa(input.retirada_hora) ? " às " + horaLimpa(input.retirada_hora) : ""}\n` +
      (input.observacoes ? `*Obs:* ${String(input.observacoes)}\n` : "") +
      c.linhas.map((l) => `${l.item}${l.obs ? " (" + l.obs + ")" : ""}: ${fmtQtd(l.qtd, l.unidade)} x ${brl(l.unit)} = ${brl(l.subtotal)}`).join("\n") +
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
      .map((l) => `${l.item}${l.obs ? " (" + l.obs + ")" : ""}: ${fmtQtd(l.qtd, l.unidade)} x ${brl(l.unit)} = ${brl(l.subtotal)}`)
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
    `O cumprimento vale SO na sua primeira mensagem da conversa: no meio do atendimento você já cumprimentou, ` +
    `e recomeçar com "boa noite" faz o cliente achar que você perdeu o fio. Responda direto o que ele acabou de dizer. ` +
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
  // PIZZA e o produto com mais sabor da casa, e estava fora do mapa: os
  // sabores moram numa estrutura propria, nao em itens.
  const daPizza = [
    ...((catalogo.pizza?.sabores_salgados ?? []) as string[]),
    ...((catalogo.pizza?.sabores_doces ?? []) as string[]),
  ];
  if (daPizza.length) {
    guardar("pizza inteira", daPizza);
    guardar("pizza meia", daPizza);
    guardar("pizza", daPizza);
    guardar("pizza redonda", daPizza);
    guardar("calzone", daPizza);
    guardar("pizza redonda", daPizza);
  }
  // O cupcake grande tem os mesmos sabores do pequeno; a lista so estava
  // escrita num deles.
  if (m["cupcake pequeno"]) {
    guardar("cupcake grande", m["cupcake pequeno"]);
    guardar("cupcake grande recheado", m["cupcake pequeno"]);
    guardar("cupcake", m["cupcake pequeno"]);
  }
  return m;
}
const SABORES = mapaDeSabores();

// Os sabores de bolo recheado, pra reconhecer bolo misto na fala do cliente.
const SABORES_DE_BOLO: string[] = (catalogo.bolos_recheados.faixas ?? []).flatMap((f) => f.sabores ?? []);

// As cores de forminha do cardapio, pra saber se a observacao do docinho ja tem
// uma. Sem a cor a cozinha nao sabe em que forminha embrulhar.
const CORES_FORMINHA =
  /amarel|azul|branc|dourad|laranja|lil[áa]s|marrom|pink|prata|pret|ros[ae]|roxo|verde|vermelh|laminad/i;

// Os tipos de cada familia, pra cobrar a escolha do TIPO com a lista na mao.
const TIPOS_DA_FAMILIA: Record<string, string[]> = (() => {
  type ItemCat = { nome: string };
  const frito = ((catalogo.salgados.frito.itens ?? []) as ItemCat[]).map((i) => i.nome);
  const assado = ((catalogo.salgados.assado.itens ?? []) as ItemCat[]).map((i) => i.nome);
  const doce = ((catalogo.doces.itens ?? []) as ItemCat[]).map((i) => i.nome);
  return {
    salgado_frito: frito,
    "salgado frito": frito,
    salgado_assado: assado,
    "salgado assado": assado,
    docinho: doce,
    doce,
    salgado: [...frito, ...assado],
  };
})();

// Nao basta a observacao estar preenchida: ela tem que trazer um sabor DA LISTA
// daquele produto. A trufa passou batido com a observacao "forminha azul royal",
// que fala da forminha e nao do sabor.
function faltaSabor(obs: string | null | undefined, ops: string[]): boolean {
  const t = String(obs ?? "").trim().toLowerCase();
  if (!t) return true;
  return !ops.some((o) => t.includes(o.trim().toLowerCase()));
}

// A FESTA TEM UMA ORDEM, E ELA E FIXA.
//
// Salgados inteiros (tipo, quantidade de cada e recheio), depois docinhos
// inteiros (sabor, quantos de cada e a cor da forminha), depois o bolo (sabor,
// peso e pao de lo), depois os acompanhamentos do bolo (topo e papel de arroz)
// e, no fim, os dados da peca: nome e idade do aniversariante, tema e foto.
// Sem ordem ela pulava etapa e voltava, e o cliente respondia tres assuntos ao
// mesmo tempo. Aqui o prompt cobra UMA etapa por vez, a da vez.
type Etapa = { titulo: string; pendencias: string[] };

function faltaNoItem(i: MontagemAtual["itens"][number]): string | null {
  const nome = String(i.produto || "").trim();
  if (!nome) return null;
  if (semTipo(nome)) {
    const tipos = TIPOS_DA_FAMILIA[nome.toLowerCase()] ?? TIPOS_DA_FAMILIA[i.categoria] ?? [];
    return (
      `- ${i.qtd} de "${nome}": falta o cliente escolher QUAIS TIPOS e quantos de cada. ` +
      (tipos.length ? `Os tipos sao ${tipos.join(", ")}. ` : "") +
      `Pergunte SO o tipo agora; o recheio de cada um vem depois que ele escolher.`
    );
  }
  const ops = SABORES[nome.toLowerCase()];
  if (ops && faltaSabor(i.obs, ops)) return `- ${nome}: falta o sabor. As opcoes sao ${ops.join(", ")}.`;
  return null;
}

function etapasDaFesta(
  itens: MontagemAtual["itens"],
  festa = false,
  pediuBolo = false,
  naoQuer = "",
  falouSalgado = false,
  falouDocinho = false,
  // O que o cliente ja escreveu na conversa. A idade e o tema costumam ser
  // ditos na primeira frase ("aniversario da minha filha, 8 anos") e nao
  // chegam na observacao do bolo.
  falaDoCliente = "",
): Etapa[] {
  // O cliente pode dispensar uma parte inteira da festa, e ai ela para de
  // cobrar aquilo em vez de perguntar a mesma coisa pra sempre.
  const dispensou = (o: string) => new RegExp(o, "i").test(naoQuer);
  const da = (pref: string) => itens.filter((i) => String(i.categoria || "").startsWith(pref));
  const salgados = da("salgado");
  const docinhos = da("docinho");
  const bolos = itens.filter((i) => String(i.categoria || "").startsWith("bolo"));
  const etapas: Etapa[] = [];

  etapas.push({
    titulo: "SALGADOS",
    pendencias: [
      ...(festa && !dispensou("salgado") && salgados.length === 0 && !falouSalgado
        ? [
            "- o cliente NAO falou em salgado ainda. E festa: PERGUNTE se ele vai querer salgado tambem, numa frase, " +
              "sem mandar cardapio nenhum ainda. Se ele disser que nao, chame anotar_dados com nao_quer=\"salgado\".",
          ]
        : []),
      ...(festa && !dispensou("salgado") && salgados.length === 0 && falouSalgado
        ? [
            "- o cliente ainda nao escolheu NENHUM salgado. MANDE a peca do cardapio de salgados (enviar_cardapio) e " +
              "Se ele disser que nao entende ou pedir a sua indicacao, INDIQUE: monte um sortido dos mais pedidos com " +
              "quantidade (ex: 100 coxinha, 100 mini bolha de carne e 100 esfirra de calabresa) e pergunte se pode ser " +
              "assim. Nao devolva a pergunta pra ele. " +
              "Se ele ja disse quantas pessoas e voce ainda NAO passou a base da festa, chame montar_orcamento por " +
              "pessoas primeiro: ninguem sabe quanto salgado pedir pra 30 convidados, e sem a base ele chuta ou voce " +
              "chuta por ele. " +
              "pergunte em cima dela: ninguem decora cardapio, nem quem ja comprou dez vezes. Se a peca ja foi mandada " +
              "nesta conversa, o sistema nao repete, entao pode pedir de novo sem medo. Depois pergunte quais ele quer e " +
              "quantos de cada, antes de falar de docinho ou de bolo. Se ele disser que NAO quer salgado, chame " +
              "anotar_dados com nao_quer=\"salgado\" e siga, que eu paro de cobrar.",
          ]
        : []),
      ...(salgados.map(faltaNoItem).filter(Boolean) as string[]),
    ],
  });

  const doceSemForminha = docinhos.filter((i) => !CORES_FORMINHA.test(String(i.obs ?? "")));
  etapas.push({
    titulo: "DOCINHOS",
    pendencias: [
      ...(festa && !dispensou("docinho|doce") && docinhos.length === 0 && !falouDocinho
        ? [
            "- o cliente NAO falou em docinho ainda. E festa: PERGUNTE se ele vai querer docinho tambem, e aproveite pra citar o resto que serve festa numa frase so (docinho, bolo, pizza de metro, torta, empadao): tem gente que so lembra da pizza quando alguem fala nela. " +
              "Se ele disser que nao, chame anotar_dados com nao_quer=\"docinho\".",
          ]
        : []),
      ...(festa && !dispensou("docinho|doce") && docinhos.length === 0 && falouDocinho
        ? ["- o cliente ainda nao escolheu NENHUM docinho. MANDE a peca do cardapio de docinhos e pergunte em cima dela; ninguem decora cardapio. Depois pergunte quais sabores e quantos de cada."]
        : []),
      ...(docinhos.map(faltaNoItem).filter(Boolean) as string[]),
      ...(docinhos.length && doceSemForminha.length
        ? [
            `- falta a COR DA FORMINHA dos docinhos (${doceSemForminha
              .map((d) => d.produto)
              .join(", ")}). Pergunte uma vez so, pra todos.`,
          ]
        : []),
    ],
  });

  // Acompanhamento do bolo: e aqui que a padaria ganha os R$ 12 do papel de
  // arroz e o valor do topo, e e a ultima hora de perguntar.
  const bolo = bolos[0];
  // A arte do bolo pode estar na linha do BOLO ou nas linhas do topo e do papel
  // de arroz, que agora sao itens proprios. Ela anotou tema, nome e idade no
  // topo, e a regra, olhando so o bolo, mandava perguntar tudo de novo.
  const linhasDaArte = itens.filter((i) =>
    /topo|papel de arroz/i.test(String(i.produto || "")) || String(i.categoria || "").startsWith("bolo"),
  );
  const obsBolo = linhasDaArte.map((i) => String(i.obs ?? "")).join(", ");
  // Topo e papel de arroz podem estar como ITEM proprio, nao so citados na
  // observacao do bolo: sem olhar o nome do produto, ela ficava sendo mandada
  // "oferecer topo" com o topo ja no pedido.
  const jaTratouArte =
    linhasDaArte.some((i) => /topo|papel de arroz/i.test(String(i.produto || ""))) ||
    /topo|papel de arroz|sem topo|sem papel/i.test(obsBolo);
  etapas.push({
    titulo: "BOLO",
    pendencias: [
      ...(festa && !pediuBolo && !dispensou("bolo") && bolos.length === 0
        ? [
            "- o cliente NAO falou em bolo ainda. E festa de aniversario: PERGUNTE se ele vai querer bolo tambem. " +
              "Se ele disser que nao, chame anotar_dados com nao_quer=\"bolo\".",
          ]
        : []),
      ...(pediuBolo && !dispensou("bolo") && bolos.length === 0
        ? [
            "- o cliente falou em bolo e nao tem bolo nenhum anotado. Mande o cardapio de bolos ou pergunte o " +
              "sabor, e anote com o peso em quilos e o pao de lo.",
          ]
        : []),
      ...(bolos.map(faltaNoItem).filter(Boolean) as string[]),
      ...(bolo && !jaTratouArte
        ? [
            "- falta oferecer TOPO DE BOLO e PAPEL DE ARROZ pro bolo. Pergunte os dois de uma vez. " +
              "Se ele nao quiser, anote na observacao do bolo \"sem topo e sem papel de arroz\", senao eu pergunto de novo.",
          ]
        : []),
    ],
  });

  // A peca e fabricada com nome, idade, tema e (se tiver) a foto.
  // Sem topo e sem papel nao precisa de nome, idade nem tema: a peca nao existe.
  if (bolo && (citadoDeVerdade(obsBolo, "topo") || citadoDeVerdade(obsBolo, "papel de arroz"))) {
    const falta: string[] = [];
    if (!/nome/i.test(obsBolo)) falta.push("o NOME do aniversariante");
    // A idade pode ter sido dita na conversa, nao na observacao.
    const temIdade =
      /[0-9]{1,2} ?anos?/i.test(obsBolo) ||
      /idade *[0-9]{1,2}/i.test(obsBolo) ||
      /[0-9]{1,2} ?anos?/i.test(falaDoCliente);
    if (!temIdade) falta.push("a IDADE");
    // "topo de unicornio" E o tema. Exigir a palavra "tema" fazia ela pedir
    // pra sempre uma coisa que o cliente ja tinha dito.
    const temTema =
      /tema/i.test(obsBolo) ||
      /(topo|papel de arroz)[^,;.]{0,20}\bde\s+(?!bolo|arroz)[a-zà-úA-ZÀ-Ú][a-zà-ú-]{2,}/i.test(obsBolo);
    if (!temTema) falta.push("o TEMA da festa");
    if (!/foto/i.test(obsBolo)) falta.push("se ele tem FOTO de referencia do tema (se nao tiver, anote 'sem foto')");
    etapas.push({
      titulo: "DADOS DA PECA DO BOLO",
      pendencias: falta.length
        ? [`- ${bolo.produto}: falta ${falta.join(", ")}. Sem isso a peca nao e fabricada. Escreva tudo na observacao do bolo.`]
        : [],
    });
  }

  return etapas.filter((e) => e.pendencias.length > 0);
}

// Tudo que ainda falta, de todas as etapas. Quem decide se DA pra fechar usa
// isto: sem ele, fechar so olhava sabor e passava por cima da forminha, do
// topo e dos dados da peca.
function pendenciasDeSabor(
  itens: MontagemAtual["itens"],
  festa = false,
  pediuBolo = false,
  naoQuer = "",
): string[] {
  return etapasDaFesta(itens, festa, pediuBolo, naoQuer).flatMap((e) => e.pendencias);
}

// A peca de cardapio que combina com a etapa de agora. O webhook usa isso pra
// mandar a imagem sem depender de ela pedir.
// A unidade de venda de cada produto, direto do cardapio. E a mesma fonte que
// da o preco, entao ticket, painel e cobranca falam a mesma lingua.
// A hora da retirada num formato so. O cliente escreve de todo jeito; a
// equipe precisa ler sempre igual no ticket e na tela.
export function horaLimpa(bruta: unknown): string {
  const t = String(bruta ?? "").trim().toLowerCase();
  if (!t) return "";
  const m = t.match(/(\d{1,2})\s*(?::|h|hs)?\s*(\d{2})?/);
  if (!m) return t;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(h) || h > 23 || min > 59) return t;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

// TODAS as opcoes de sabor de um produto, venha de onde vier: o mapa do
// cardapio (salgado, docinho, trufa, mini bolha) ou a lista fechada dos
// outros produtos (cuca, torta, empadao).
export function opcoesDeSabor(nome: string): string[] {
  const chave = String(nome || "").trim().toLowerCase();
  const doMapa = SABORES[chave] ?? [];
  if (doMapa.length) return doMapa;
  return saboresDoCardapio(nome);
}

// A lista fechada de sabores de um produto do cardapio, se existir.
export function saboresDoCardapio(nome: string): string[] {
  const limpo = String(nome || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const achado = ((catalogo.outros_produtos ?? []) as { nome: string; sabores?: string[] }[]).find(
    (i) => String(i.nome).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === limpo,
  );
  return Array.isArray(achado?.sabores) ? (achado?.sabores as string[]) : [];
}

// A observacao e a ESCOLHA dele, nao a lista que voce ofereceu. Quando ela
// traz tres ou mais opcoes do mesmo produto, e a pergunta copiada.
export function obsEhAListaInteira(produto: string, obs?: string | null): boolean {
  const ops = opcoesDeSabor(produto);
  if (ops.length < 3) return false;
  const t = String(obs ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!t) return false;
  const citados = ops.filter((o) => t.includes(String(o).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).length;
  return citados >= 3;
}

export function unidadeDoProduto(nome: string, categoria?: string): "kg" | "un" {
  const limpo = String(nome || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const todos: { nome: string; unidade?: string }[] = [
    ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string; unidade?: string }[]),
    ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string; unidade?: string }[]),
    ...((catalogo.doces?.itens ?? []) as { nome: string; unidade?: string }[]),
    ...((catalogo.bolos_caseiros?.itens ?? []) as { nome: string; unidade?: string }[]),
    ...((catalogo.outros_produtos ?? []) as { nome: string; unidade?: string }[]),
  ];
  const achado = todos.find((x) => {
    const n = String(x.nome || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return n === limpo || limpo.includes(n) || n.includes(limpo);
  });
  if (achado?.unidade === "kg") return "kg";
  if (achado?.unidade === "un") return "un";
  // Bolo de festa e por quilo por definicao (as faixas sao preco por kg).
  if (/^bolo/i.test(limpo) && categoria !== "bolo_caseiro") return "kg";
  return "un";
}

export function pecaDaEtapa(
  itens: MontagemAtual["itens"],
  naoQuer = "",
): CardapioId | null {
  const tem = (pref: string) => itens.some((i) => String(i.categoria || "").startsWith(pref));
  const fora = (o: string) => new RegExp(o, "i").test(naoQuer);
  if (!tem("salgado") && !fora("salgado")) return "salgados";
  if (!tem("docinho") && !fora("docinho|doce")) return "docinhos";
  if (!tem("bolo") && !fora("bolo")) return "bolos-festa";
  return null;
}

// O pedido do cliente que ainda esta vivo. Nao e o que esta sendo montado: e o
// que ja foi registrado e segue andando (com a equipe, aprovado ou impresso).
export type PedidoEmAbertoIA = {
  status: string;
  aguardandoCliente: boolean;
  retiradaData: string | null;
  retiradaHora: string | null;
  totalCentavos: number;
  motivoHumano: string | null;
  impresso: boolean;
  formaPagamento: string | null;
  quemRetira: string | null;
  itens: { produto: string; qtd: number; unidade: string; obs: string | null }[];
};

// O que ela precisa saber sobre esse pedido antes de responder qualquer coisa.
function blocoPedidoEmAberto(p: PedidoEmAbertoIA): string {
  const quando = [
    p.retiradaData ? `pra ${p.retiradaData}` : null,
    p.retiradaHora ? `as ${p.retiradaHora}` : null,
  ].filter(Boolean).join(" ");
  const valor = p.totalCentavos > 0 ? `, total ${brl(p.totalCentavos / 100)}` : "";
  const confirmado = p.impresso || p.status === "aprovado";
  const linhas = [
    `# ESTE CLIENTE JA TEM UM PEDIDO ${quando}${valor}`,
    confirmado
      ? "A equipe ja confirmou esse pedido."
      : "O pedido esta na mao da equipe, esperando a confirmacao dela. Voce ja avisou que avisaria quando confirmassem.",
  ];
  // Pendencia aberta e divida SUA com ele: some do estado, e ela responde como
  // se nunca tivesse prometido nada.
  if (p.motivoHumano) {
    linhas.push(
      `VOCE FICOU DE VOLTAR PRA ELE COM ISSO: ${p.motivoHumano}. Se ele cobrar, diga que ja esta com a equipe e ` +
        "que voce avisa aqui assim que tiver a resposta. NAO invente esse valor nem esse prazo.",
    );
  }
  // As linhas do pedido, como estao AGORA no banco. Se a equipe corrigiu pela
  // tela, e isto que vale, nao o que voce lembra de ter combinado na conversa.
  // O combinado tambem esta no pedido: sem isso ela perguntava de novo quem
  // retira e como paga, coisas que o cliente ja tinha respondido.
  const combinado = [
    p.quemRetira ? `quem retira: ${p.quemRetira}` : null,
    p.formaPagamento ? `pagamento: ${p.formaPagamento}` : null,
  ].filter(Boolean);
  if (combinado.length > 0) linhas.push("Combinado: " + combinado.join(", ") + ". Nao pergunte isso de novo.");
  if (p.itens.length > 0) {
    linhas.push("", "O QUE TEM NESSE PEDIDO (vale mais que a sua lembranca da conversa):");
    for (const i of p.itens) {
      linhas.push(`- ${i.qtd} ${i.unidade === "kg" ? "kg" : "un"} de ${i.produto}${i.obs ? ` (${i.obs})` : ""}`);
    }
  }
  linhas.push(
    "",
    "COMO RESPONDER ENQUANTO ESSE PEDIDO EXISTIR:",
    "- Mensagem curta ou solta (ok, obrigado, blz, um oi): reconheca e feche o assunto em cima DESSE pedido. " +
      "NUNCA pergunte se ele quer comecar um pedido: ele acabou de fazer um.",
    "- Mensagem generica ou que da pra entender de dois jeitos: pergunte se e sobre esse pedido ou se e outra coisa, " +
      "antes de comecar qualquer pedido novo.",
    "- Pergunta sobre o pedido (valor, data, o que tem nele): responda em cima deste pedido, com os dados daqui.",
    "- Ele quer MUDAR, ACRESCENTAR ou CANCELAR algo nele: chame a equipe (falar_com_humano). Voce nao mexe em pedido registrado.",
    "- So comece um pedido novo se ele pedir claramente outra coisa, pra outra data.",
  );
  return linhas.join(String.fromCharCode(10));
}

// O pedido anotado, em texto, pra IA ler no fim da conversa. É a memória dela:
// em vez de reconstruir o pedido inteiro pelo histórico a cada mensagem (que é
// onde ela trocava bolo por docinho e perdia item), ela lê o que está guardado.
// A equipe também mexe nisso pela tela, então o que vier aqui pode ter sido
// corrigido na mão e vale mais que a lembrança dela.
function descreverMontagem(
  m?: MontagemAtual | null,
  pedidoAguardando = false,
  festa = false,
  pediuBolo = false,
  falouSalgado = false,
  falouDocinho = false,
  // A conversa inteira do cliente: idade e tema costumam estar la, nao na
  // observacao do bolo.
  falaDoCliente = "",
): string {
  // PEDIDO JA REGISTRADO ESPERANDO O ACEITE NAO SE MONTA DE NOVO.
  //
  // Com a montagem limpa (o pedido virou pedido de verdade), o lembrete mandava
  // anotar tudo de novo: ela reanotou os itens do pedido ja fechado, montou um
  // orcamento novo e devolveu pro cliente o total VELHO, contradizendo o valor
  // que ela mesma tinha acabado de passar depois do ajuste da equipe.
  if (pedidoAguardando) {
    return (
      "# EXISTE UM PEDIDO DESTE CLIENTE JA REGISTRADO, ESPERANDO SO O ACEITE DELE" + "\n" +
      "A equipe ajustou o valor e voce ja passou pra ele. Agora e so a resposta." + "\n" + "\n" +
      "NAO anote item, NAO monte orcamento e NAO some nada: o pedido ja existe e o total certo e o que a equipe " +
      "fechou, nao o que voce calcularia de novo. Se ele concordou (de qualquer jeito: ok, pode, ta certo, um " +
      "joinha), chame cliente_aceitou_orcamento. Se ele discordou, pediu desconto ou quis mudar alguma coisa, chame a equipe."
    );
  }

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

  // Quanto deu no total de cada familia. Ela ja anotou 400 salgados em cada
  // uma das tres linhas de uma festa de 400 salgados no total, e nada mostrava
  // que o pedido tinha virado 1200.
  const somas: Record<string, number> = {};
  for (const i of itens) {
    const fam = String(i.categoria || "").startsWith("salgado")
      ? "salgados"
      : i.categoria === "docinho"
        ? "docinhos"
        : null;
    if (fam) somas[fam] = (somas[fam] ?? 0) + (Number(i.qtd) || 0);
  }
  const totais = Object.entries(somas).map(([f, n]) => `${n} ${f}`);

  const linhas = itens.map((i) => {
    const q = i.unidade === "kg" ? `${i.qtd} kg` : `${i.qtd} un`;
    return `- ${q} de ${i.produto} (categoria: ${i.categoria})${i.obs ? ` | ${i.obs}` : ""}`;
  });

  // Sabor que a padaria nao faz e o cliente ja pediu: avisado uma vez, nunca
  // mais proposto. Sem esta linha ela relia a conversa e voltava a escrever
  // "3 cucas de banana" depois de ja ter dito que nao faz.
  const recusados = String(m?.dados?.sabor_recusado ?? "").trim();
  const linhaRecusados = recusados
    ? "\n\nSABOR JA RECUSADO NESTA CONVERSA (a padaria nao faz, o cliente ja foi avisado): " + recusados +
      ". NAO escreva esse sabor de novo, NAO anote e NAO confirme pedido com ele. Trate como se ele ainda nao tivesse escolhido."
    : "";

  const ordem =
    "NAO pergunte sabor nem recheio de item que ja aparece com sabor na lista acima: ele ja escolheu, e perguntar de " +
    "novo faz o cliente repetir o que acabou de dizer. " +
    "ANTES de escrever a resposta, chame anotar_item pra cada produto que o cliente decidiu agora e anotar_dados pro que ele informou agora " +
    "(nome, data, hora, pagamento). Quantidade nova do mesmo produto e recheio escolhido depois entram com anotar_item de novo: corrigir nao duplica. " +
    "O que voce nao anotar se perde, e o pedido registrado no fim sai DESTA lista, nao da sua lembranca da conversa. " +
    "E quando o cliente disser que NAO ENTENDE ou pedir a sua indicacao, INDIQUE: monte a festa inteira com tipos e " +
    "quantidades (salgados, docinhos e bolo, na base do numero de pessoas) e pergunte se pode ser assim. Devolver a " +
    "pergunta pra quem acabou de dizer que nao entende deixa a pessoa travada.";

  if (linhas.length === 0 && dados.length === 0) {
    return (
      "# PEDIDO EM MONTAGEM: NADA ANOTADO AINDA" + "\n" + ordem + linhaRecusados
    );
  }

  // Uma etapa por vez: a lista inteira de uma vez fazia ela perguntar salgado,
  // docinho e bolo na mesma mensagem, e o cliente respondia so um.
  const etapas = etapasDaFesta(itens, festa, pediuBolo, String(m?.dados?.nao_quer ?? ""), falouSalgado, falouDocinho, falaDoCliente);
  const atual = etapas[0];
  const pend = atual ? atual.pendencias : [];
  const faltaDepois = Math.max(0, etapas.length - 1);
  const cobrar = pend.length
    ? `\n\nETAPA DE AGORA: ${atual?.titulo}. Fora a resposta a pergunta dele, fale SO desta etapa nesta mensagem.\n` +
      "SE A ULTIMA MENSAGEM DO CLIENTE FOR UMA PERGUNTA, RESPONDA ELA PRIMEIRO, com a informacao concreta " +
      "(preco, peso, sabor, como se vende), e so depois siga a etapa. Ja aconteceu de ele perguntar o preco do " +
      "cento e receber de volta a mesma pergunta da etapa tres vezes seguidas.\n" +
      pend.join(String.fromCharCode(10)) +
      String.fromCharCode(10, 10) +
      "ANOTAR O QUE ELE ACABOU DE INFORMAR VALE SEMPRE, mesmo que nao seja desta etapa: data, hora, nome e " +
      "pagamento entram com anotar_dados na hora em que ele fala. Ele disse a data e a hora e voce repetiu a " +
      "mesma pergunta duas vezes, como se ninguem tivesse escrito nada." +
      "\n\nSe o cliente JA respondeu alguma dessas coisas na conversa, nao pergunte de novo: chame anotar_item agora " +
      "com o que ele disse. Perguntar duas vezes a mesma coisa faz ele achar que ninguem anotou nada. Pergunte so o que " +
      "sobrou desta etapa, de uma vez so." +
      (faltaDepois > 0 ? ` Depois desta ainda faltam ${faltaDepois} etapas, mas NAO fale delas agora.` : "")
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
      "deixa o cliente achando que encomendou sem existir pedido nenhum. " +
      "Valor que voce nao sabe (o topo de bolo, por exemplo) NAO e motivo pra chamar_humano: registre o pedido com " +
      "precisa_confirmacao=true e o motivo, que a equipe informa o valor depois. Chamar a equipe em vez de registrar " +
      "deixa o pedido fora da fila e a festa sem producao."
    : "";

  return (
    "# O QUE JA ESTA ANOTADO NESTE PEDIDO" + "\n" +
    "Isto esta guardado e a equipe ja pode ter corrigido na tela. Vale mais que a sua lembranca da conversa." + "\n\n" +
    (linhas.length ? "Itens:" + "\n" + linhas.join("\n") + "\n\n" : "Nenhum item anotado ainda." + "\n\n") +
    (dados.length ? "Dados:" + "\n" + dados.join("\n") + "\n\n" : "") +
    (totais.length ? "Somando o que esta anotado: " + totais.join(" e ") + ". Confira se bate com o tamanho da festa. Quando o cliente fala um total (ex: 200 fritos) e escolhe varios tipos, esse total e pra DIVIDIR entre os tipos, nunca pra repetir em cada um: repetir triplicou o pedido de um cliente." + "\n\n" : "") +
    "Nao pergunte de novo nada que ja esta aqui em cima: o cliente ja respondeu e vai achar que voce nao anotou. Falta so o que NAO aparece nesta lista." + "\n\n" +
    ordem +
    linhaRecusados +
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
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_ATIVO === "1") {
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
  pedidoAberto?: PedidoEmAbertoIA | null,
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
  const estado = { precisaHumano: false, pedido: null as RespostaIA["pedidoRegistrado"], cardapios: [] as CardapioId[], resumo: undefined as string | undefined, sugestao: undefined as string | undefined, aceitouOrcamento: false, montagem: [] as MudancaMontagem[] };
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...historico.map((m) => ({ role: m.role, content: m.content })),
  ];

  // O que já está anotado entra DEPOIS do histórico, nunca dentro do system: o
  // system é o prefixo que a OpenAI guarda em cache, e mexer nele a cada turno
  // jogaria o cache fora (a conta triplica). No fim ele é lido do mesmo jeito.
  // Festa muda o roteiro inteiro: tem ordem, tem etapa e tem bolo. Sai da fala
  // do cliente, nao de adivinhacao: sem isso a ordem so comecava depois do
  // primeiro item anotado, e ela pulava direto pro bolo.
  const falaToda = historico
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content as string)
    .join("  ")
    .toLowerCase();
  const ehFesta = ehFestaNaFala(falaToda);
  const pediuBolo = /bolo/.test(falaToda);
  // Mencionar nao e escolher: quem falou "quero salgado" precisa da peca e da
  // cobranca; quem nunca falou precisa da pergunta antes.
  // "sabores salgados" e "pizza salgada" falam de pizza, nao de salgadinho de
  // festa. Sem tirar isso, quem pede pizza entra na esteira da festa.
  const falaSemPizza = falaToda
    .replace(/sabor(es)?\s+salgad\w*/g, " ")
    .replace(/pizzas?\s+salgad\w*/g, " ")
    .replace(/salgad\w*\s+d[ae]\s+pizza/g, " ");
  const falouSalgado = /salgad|frito|assado|coxinha|esfirra|empadinha|risolis|ris[óo]lis/.test(falaSemPizza);
  const falouDocinho = /docinho|doce|brigadeiro|beijinho|trufa/.test(falaToda);
  // O pedido que ja existe vem primeiro: e o contexto de tudo que ela vai
  // responder, inclusive do silencio dele.
  if (pedidoAberto && !pedidoAguardando) {
    messages.push({ role: "system", content: blocoPedidoEmAberto(pedidoAberto) });
  }
  // ACEITOU A INDICACAO: O CODIGO ANOTA TUDO QUE PROPOS.
  //
  // Deixar isso pro modelo custou uma festa inteira: ele anotou os salgados da
  // proposta e perguntou de novo pelos docinhos que o cliente tinha acabado de
  // aceitar na mesma frase. Quem escreveu a proposta anota a proposta.
  // A montagem que vale PARA ESTE TURNO (a do banco mais o que o aceite anotou).
  let montagemDoTurno = montagemAtual;
  const propostaGuardada = String(montagemAtual?.dados?.proposta ?? "");
  const ultimaFalaDoCliente = [...historico].reverse().find((h) => h.role === "user")?.content ?? "";
  const aceitou = /^(pode ser assim|pode ser|isso mesmo|isso|ta bom|tá bom|ta otimo|tá ótimo|perfeito|fechado|fechou|beleza|blz|ok|sim|pode|quero assim|manda assim)[ ]*[.!,]*$/i.test(
    String(ultimaFalaDoCliente).trim(),
  );
  if (propostaGuardada && aceitou && (montagemAtual?.itens?.length ?? 0) === 0) {
    try {
      const itensPropostos = JSON.parse(propostaGuardada) as {
        produto: string; categoria: string; qtd: number; obs?: string | null;
      }[];
      for (const it of itensPropostos) {
        estado.montagem.push({ tipo: "item", produto: it.produto, categoria: it.categoria, qtd: it.qtd, obs: it.obs ?? null });
      }
      // O que acabou de ser anotado vale JA neste turno: sem isso a maquina de
      // etapas continua achando que falta escolher, e ela pergunta de novo.
      montagemDoTurno = {
        ...(montagemAtual ?? { itens: [], dados: {} }),
        itens: [
          ...(montagemAtual?.itens ?? []),
          ...itensPropostos.map((it) => ({
            produto: it.produto,
            categoria: it.categoria,
            qtd: it.qtd,
            unidade: it.categoria === "bolo_festa" ? "kg" : "un",
            obs: it.obs ?? null,
          })),
        ],
      } as MontagemAtual;
      estado.montagem.push({ tipo: "dados", dados: { proposta: null } });
      messages.push({
        role: "system",
        content:
          "O cliente ACEITOU a indicacao que voce deu, e o pedido inteiro dela JA FOI ANOTADO: " +
          itensPropostos.map((i) => i.qtd + " " + i.produto + (i.obs ? " (" + i.obs + ")" : "")).join(", ") + ". " +
          "NAO anote nada disso de novo e NAO pergunte de novo por esses itens. Confirme numa frase curta e siga pra proxima etapa que faltar.",
      });
    } catch {
      // proposta ilegivel: segue o fluxo normal, o modelo pergunta
    }
  }

  // Pediu com quantidade uma coisa que a casa nao faz: ela precisa dizer isso
  // e seguir com o resto, em vez de repetir o cardapio e travar a conversa.
  const naoExistem = pedidosQueNaoExistem(String(ultimaFalaDoCliente));
  if (naoExistem.length > 0) {
    messages.push({
      role: "system",
      content:
        "O cliente pediu isto e a padaria NAO FAZ: " + naoExistem.join(", ") + ". Diga numa frase que esse item a gente nao tem, ofereca os parecidos que existem no cardapio e ANOTE normalmente o resto do que ele pediu. Nao repita o cardapio inteiro nem ignore o pedido dele."
    });
  }

  // ELA JA DISSE QUE MANDOU O CARDAPIO: PARA DE DIZER.
  //
  // "Te mandei o cardapio de salgados aqui" saiu oito vezes na mesma conversa,
  // enquanto o cliente respondia outra coisa. O cardapio vai uma vez; depois
  // disso a conversa tem que ser sobre o que ele escreveu.
  const repetiuCardapio = historico
    .filter((h) => h.role === "assistant")
    .slice(-4)
    .filter((h) => /mandei o card[áa]pio|te mandei o card/i.test(String(h.content ?? ""))).length;
  if (repetiuCardapio >= 2) {
    messages.push({
      role: "system",
      content:
        "Voce ja disse que mandou o cardapio nas ultimas mensagens. NAO repita isso e NAO mande a peca de novo. Responda exatamente o que o cliente escreveu na ultima mensagem e anote o que ele escolheu."
    });
  }

  // A RECUSA VIRA ESTADO NA HORA.
  const jaDispensado = String(montagemDoTurno?.dados?.nao_quer ?? "");
  const recusasAgora: string[] = [];
  const falaRecusa = String(ultimaFalaDoCliente).toLowerCase();
  const RECUSOU: [string, RegExp][] = [
    ["salgado", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer|dispensa)[^.]{0,24}salgad/],
    ["docinho", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer|dispensa)[^.]{0,24}(docinho|doce)/],
    ["bolo", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer|dispensa)[^.]{0,24}bolo/],
  ];
  for (const [fam, re] of RECUSOU) {
    if (re.test(falaRecusa) && !jaDispensado.includes(fam)) recusasAgora.push(fam);
  }

  // Ofereceu duas vezes e ele nao pediu: nao quer. Sem isto ela pergunta a
  // festa inteira em toda mensagem e o cliente desiste antes de fechar.
  const falasDelaAgora = historico
    .filter((h) => h.role === "assistant")
    .slice(-6)
    .map((h) => String(h.content ?? "").toLowerCase());
  const ofertas = (re: RegExp) => falasDelaAgora.filter((t) => re.test(t)).length;
  const CANSOU: [string, RegExp][] = [
    ["salgado", /querer salgad|quer salgad|salgado tambem|salgados tambem|salgado também|salgados também/],
    ["docinho", /querer docinho|quer docinho|docinho tambem|docinho também/],
    ["bolo", /querer bolo|quer bolo|bolo tambem|bolo também/],
  ];
  // O que o CLIENTE ja falou sobre cada familia. Se ele citou, ele nao
  // recusou: pedir o cardapio de salgado e o oposto de dispensar salgado.
  const falaDeleToda = historico
    .filter((h) => h.role === "user" && typeof h.content === "string")
    .map((h) => String(h.content).toLowerCase())
    .join("  ");
  const CITOU: [string, RegExp][] = [
    ["salgado", /salgad|frito|assado|coxinha|esfirra|empadinha|ris[óo]lis|risolis|croquete|bolinha|almofadinha|quiche|croissant/],
    ["docinho", /docinho|doce|brigadeiro|beijinho|trufa|caju|camafeu|olho de sogra|ouri[çc]o/],
    ["bolo", /bolo/],
  ];
  const clienteCitou = (fam: string) =>
    CITOU.some(([f, re]) => f === fam && re.test(falaDeleToda));
  for (const [fam, re] of CANSOU) {
    if (clienteCitou(fam)) continue;
    if (ofertas(re) >= 2 && !jaDispensado.includes(fam) && !recusasAgora.includes(fam)) recusasAgora.push(fam);
  }

  if (recusasAgora.length > 0) {
    const naoQuerNovo = [jaDispensado, ...recusasAgora].filter(Boolean).join(", ");
    estado.montagem.push({ tipo: "dados", dados: { nao_quer: naoQuerNovo } });
    montagemDoTurno = {
      ...(montagemDoTurno ?? { itens: [], dados: {} }),
      dados: { ...(montagemDoTurno?.dados ?? {}), nao_quer: naoQuerNovo },
    } as MontagemAtual;
    messages.push({
      role: "system",
      content:
        "JA ESTA ANOTADO que este cliente nao quer: " + naoQuerNovo + ". NAO ofereca, NAO pergunte e NAO mande cardapio disso de novo em nenhuma mensagem. Siga pro que falta e feche o pedido."
    });
  }

  // PERGUNTA JA FEITA NAO SE REPETE.
  //
  // A etapa fica pendente enquanto o cliente nao escolhe nem recusa, e ela
  // repetia a MESMA oferta a cada mensagem: o cliente falava de outra coisa e
  // levava "vai querer salgados tambem?" tres vezes seguidas. Quem foi
  // perguntado duas vezes e nao respondeu nao quer; a conversa tem que andar.
  const falasDela = historico.filter((h) => h.role === "assistant").slice(-6).map((h) => String(h.content ?? "").toLowerCase());
  const jaOfereceu = (marcador: RegExp) => falasDela.filter((t) => marcador.test(t)).length;
  const repetidas: string[] = [];
  if (jaOfereceu(/querer salgad|quer salgad|salgado tambem|salgados tambem/) >= 2) repetidas.push("salgados");
  if (jaOfereceu(/querer docinho|quer docinho|docinho tambem|doce tambem/) >= 2) repetidas.push("docinhos");
  if (jaOfereceu(/querer bolo|quer bolo|bolo tambem/) >= 2) repetidas.push("bolo");
  if (repetidas.length > 0) {
    messages.push({
      role: "system",
      content:
        "Voce JA ofereceu " + repetidas.join(" e ") + " duas vezes nesta conversa e o cliente nao pediu. NAO pergunte de novo: trate como se ele nao quisesse, siga pro que falta e feche o pedido. Repetir a mesma oferta faz o cliente achar que voce nao esta lendo o que ele escreve."
    });
  }

  // PEDIU PRA TIRAR: TIRA.
  //
  // "pensando bem, tira a empadinha e poe risoles" e ela seguiu com os dois no
  // pedido. Item cancelado que fica vira producao que ninguem pediu e total
  // maior do que o combinado.
  const semAcentoTira = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mandouTirar = /\b(tira|tirar|tire|remove|remover|cancela|cancelar|troca|trocar|substitui|substituir|sem)\b/i.test(
    String(ultimaFalaDoCliente),
  );
  if (mandouTirar) {
    const falaLimpaTira = semAcentoTira(ultimaFalaDoCliente);
    const paraTirar = (montagemDoTurno?.itens ?? []).filter((x) => {
      const nome = semAcentoTira(String(x.produto ?? ""));
      if (nome.length < 4) return false;
      // O nome aparece DEPOIS do verbo de remover, na mesma frase.
      const re = new RegExp(
        "(tira|tirar|tire|remove|remover|cancela|cancelar|troca|trocar|substitui|substituir|sem)[^.]{0,30}" +
          nome.split(" ")[0],
        "i",
      );
      return re.test(falaLimpaTira);
    });
    for (const item of paraTirar) {
      estado.montagem.push({ tipo: "remover", produto: item.produto, categoria: item.categoria });
    }
    // Ele disse o que entra NO LUGAR? Entao entra com a mesma quantidade.
    const entrouNoLugar: { produto: string; categoria: string; qtd: number; obs: string | null }[] = [];
    if (paraTirar.length > 0) {
      const nomesCatalogo: { nome: string; categoria: string }[] = [
        ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => ({
          nome: String(i.nome),
          categoria: "salgado_frito",
        })),
        ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => ({
          nome: String(i.nome),
          categoria: "salgado_assado",
        })),
        ...((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => ({
          nome: String(i.nome),
          categoria: "docinho",
        })),
      ];
      const depoisDoPoe = falaLimpaTira.split(/\b(poe|põe|poem|coloca|bota|quero|no lugar|troca por|substitui por)\b/i).slice(-1)[0] || "";
      for (const saiu of paraTirar) {
        const novo = nomesCatalogo.find((c) => {
          const n = semAcentoTira(c.nome);
          if (n === semAcentoTira(String(saiu.produto ?? ""))) return false;
          const raiz = n.split(" ")[0];
          return raiz.length > 3 && depoisDoPoe.includes(raiz.slice(0, Math.max(4, raiz.length - 2)));
        });
        if (!novo) continue;
        // Recheio dito junto: "risoles de carne".
        const recheio = (depoisDoPoe.match(new RegExp(semAcentoTira(novo.nome).split(" ")[0] + "[a-z ]{0,10} de ([a-z]+)")) ?? [])[1];
        entrouNoLugar.push({
          produto: novo.nome,
          categoria: novo.categoria,
          qtd: Number(saiu.qtd) || 0,
          obs: recheio ?? null,
        });
      }
      for (const nv of entrouNoLugar) {
        estado.montagem.push({ tipo: "item", produto: nv.produto, categoria: nv.categoria, qtd: nv.qtd, obs: nv.obs });
      }
      montagemDoTurno = {
        ...(montagemDoTurno ?? { itens: [], dados: {} }),
        itens: (montagemDoTurno?.itens ?? []).filter((x) => !paraTirar.includes(x)),
      } as MontagemAtual;
      messages.push({
        role: "system",
        content:
        "O cliente mandou TIRAR isto do pedido e EU JA TIREI: " +
          paraTirar.map((x) => x.produto).join(", ") +
          ". " +
          (entrouNoLugar.length
            ? "E JA COLOQUEI no lugar, com a mesma quantidade: " +
              entrouNoLugar.map((x) => x.qtd + " " + x.produto + (x.obs ? " (" + x.obs + ")" : "")).join(", ") +
              ". Confirme numa frase curta e siga."
            : "Confirme numa frase curta que saiu e anote o que ele quer no lugar, se ele disse.") +
          " Nao pergunte de novo o que ele acabou de cancelar."
      });
    }
  }

  // NAO TEM FOTO DO TEMA: FICA ESCRITO NO BOLO.
  //
  // A etapa da arte cobra a foto ate a observacao registrar a resposta. Sem
  // isso ela pergunta a foto de novo a cada mensagem e o pedido nao fecha.
  const semFoto =
    /nao tenho foto|não tenho foto|sem foto|nao tem foto|não tem foto|nao vou mandar foto|não vou mandar foto/i.test(
      String(ultimaFalaDoCliente),
    );
  if (semFoto) {
    const boloF = (montagemDoTurno?.itens ?? []).find((x) => String(x.categoria ?? "").startsWith("bolo"));
    if (boloF && !/foto/i.test(String(boloF.obs ?? ""))) {
      const obsF = [String(boloF.obs ?? "").trim(), "sem foto"].filter(Boolean).join(", ");
      estado.montagem.push({
        tipo: "item",
        produto: boloF.produto,
        categoria: boloF.categoria,
        qtd: boloF.qtd,
        obs: obsF,
      });
      montagemDoTurno = {
        ...(montagemDoTurno ?? { itens: [], dados: {} }),
        itens: (montagemDoTurno?.itens ?? []).map((x) => (x === boloF ? { ...x, obs: obsF } : x)),
      } as MontagemAtual;
      messages.push({
        role: "system",
        content: "O cliente disse que NAO TEM foto do tema, e EU JA ANOTEI isso no bolo. Nao pergunte a foto de novo: siga e feche o pedido."
      });
    }
  }

  // RECUSOU TOPO E PAPEL DE ARROZ: FICA ESCRITO NO BOLO.
  //
  // A etapa cobra ate a observacao do bolo registrar a recusa. Deixar isso pro
  // modelo fez a conversa girar em falso: ele recusava, ela perguntava de novo.
  const recusouArte =
    /sem topo|nao quero topo|não quero topo|sem papel de arroz|nao quero papel|não quero papel|nem topo|nenhum dos dois/i.test(
      String(ultimaFalaDoCliente),
    );
  if (recusouArte) {
    const bolo = (montagemDoTurno?.itens ?? []).find((x) =>
      String(x.categoria ?? "").startsWith("bolo"),
    );
    const jaEscrito = /sem topo|sem papel/i.test(String(bolo?.obs ?? ""));
    if (bolo && !jaEscrito) {
      const obsNova = [String(bolo.obs ?? "").trim(), "sem topo e sem papel de arroz"]
        .filter(Boolean)
        .join(", ");
      estado.montagem.push({
        tipo: "item",
        produto: bolo.produto,
        categoria: bolo.categoria,
        qtd: bolo.qtd,
        obs: obsNova,
      });
      montagemDoTurno = {
        ...(montagemDoTurno ?? { itens: [], dados: {} }),
        itens: (montagemDoTurno?.itens ?? []).map((x) =>
          x === bolo ? { ...x, obs: obsNova } : x,
        ),
      } as MontagemAtual;
      messages.push({
        role: "system",
        content:
          "O cliente recusou topo de bolo e papel de arroz, e EU JA ANOTEI isso na observacao do bolo. Nao pergunte de novo sobre topo nem papel: siga pro que falta e feche o pedido."
      });
    }
  }

  messages.push({ role: "system", content: descreverMontagem(montagemDoTurno, pedidoAguardando, ehFesta, pediuBolo, falouSalgado, falouDocinho, falaToda) });

  // FERRAMENTA QUE NAO CABE AGORA NEM E OFERECIDA.
  //
  // Ela tentou registrar o pedido quatro vezes seguidas, apanhou da guarda nas
  // quatro, e no fim desistiu e chamou a equipe. Fechar so existe quando da pra
  // fechar; aceite de orcamento so existe quando ha pedido esperando o cliente.
  const podeFechar =
    (montagemDoTurno?.itens?.length ?? 0) > 0 && pendenciasDeSabor(montagemDoTurno?.itens ?? [], ehFesta, pediuBolo, String(montagemDoTurno?.dados?.nao_quer ?? "")).length === 0;
  const ferramentas = (tenant.sistemaCustom ? FERRAMENTAS_BASICAS : FERRAMENTAS).filter((f) => {
    const nome = "function" in f ? f.function.name : "";
    if (nome === "cliente_aceitou_orcamento") return pedidoAguardando;
    // Esperando o aceite, so existem tres caminhos: ele aceita, ele reclama (e
    // a equipe entra), ou ele pergunta alguma coisa. Montar pedido ali e o que
    // fez ela recalcular por cima de um pedido ja fechado.
    if (pedidoAguardando) {
      return !["anotar_item", "remover_item", "anotar_dados", "montar_orcamento", "registrar_pedido"].includes(nome);
    }
    if (nome === "registrar_pedido" && !podeFechar) return false;
    return true;
  });

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
            tools: ferramentas,
          }
        : {
            model: prov.modelo,
            max_tokens: 350, // resposta de WhatsApp é curta; corta desperdício de token
            temperature: 0.4, // menos "criatividade" = segue mais as regras (usar a ferramenta)
            messages,
            tools: ferramentas,
          },
    );
    somarUso(resp.usage);

    const msg = resp.choices[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      gravarUso();
      // Fechou pedido: o texto que vai pro cliente e o resumo montado em
      // codigo, nao o que ela escreveu. Ela ja tentou reescrever o total.
      let textoFinal = estado.resumo ?? umaPerguntaSo((msg.content || "").trim());

      const falaDoCliente2 = [...historico].reverse().find((h) => h.role === "user")?.content ?? "";
      const ultimaDelaAgora = [...historico].reverse().find((h) => h.role === "assistant")?.content ?? "";
      // PEDIU INDICACAO, RECEBE INDICACAO.
      //
      // Com o pedido ainda vazio e o cliente dizendo que nao entende, ela
      // devolvia a pergunta. Aqui a festa sugerida sai pronta, em cima da base
      // que ela mesma acabou de passar, e ele so precisa dizer se pode ser.
      const pediuIndicacao =
        /nao entendo|não entendo|nao sei|não sei|me indica|indica pra mim|o que voce|o que você|o que voces|o que vocês|voce que sabe|você que sabe|escolhe por mim|pode escolher/i.test(
          String(falaDoCliente2),
        );
      const nadaAnotado = (montagemAtual?.itens?.length ?? 0) === 0;
      if (pediuIndicacao && nadaAnotado && !estado.pedido) {
        const base = String(estado.sugestao || ultimaDelaAgora || "");
        const salg = Number((base.match(/([0-9]+) *salgados/i) ?? [])[1] ?? 0);
        const doc = Number((base.match(/([0-9]+) *docinhos/i) ?? [])[1] ?? 0);
        const kg = Number(String((base.match(/([0-9]+(?:[.,][0-9]+)?) *kg/i) ?? [])[1] ?? "").replace(",", "."));
        if (salg > 0 || doc > 0 || kg > 0) {
          const linhas: string[] = [];
          if (salg > 0) {
            const a = Math.round(salg / 3);
            const b = Math.round(salg / 3);
            const c2 = salg - a - b;
            linhas.push(a + " coxinha, " + b + " mini bolha de carne e " + c2 + " esfirra de calabresa");
          }
          if (doc > 0) {
            const a = Math.round(doc / 2);
            linhas.push(a + " brigadeiro e " + (doc - a) + " beijinho");
          }
          if (kg > 0) linhas.push(String(kg).replace(".", ",") + " kg de bolo de brigadeiro");
          // A INDICACAO FICA GUARDADA PRA VALER QUANDO ELE ACEITAR.
          //
          // O cliente respondia "pode ser assim" e so os salgados entravam: o
          // modelo anotava a primeira linha e seguia perguntando dos docinhos
          // que ELE mesmo tinha acabado de aceitar. Quem escreveu a proposta
          // (este codigo) e quem anota quando o aceite vem.
          const propostos: { produto: string; categoria: string; qtd: number; obs?: string | null }[] = [];
          if (salg > 0) {
            const a = Math.round(salg / 3);
            const b = Math.round(salg / 3);
            propostos.push({ produto: "coxinha", categoria: "salgado_frito", qtd: a, obs: null });
            propostos.push({ produto: "mini bolha", categoria: "salgado_frito", qtd: b, obs: "carne" });
            propostos.push({ produto: "esfirra", categoria: "salgado_assado", qtd: salg - a - b, obs: "calabresa" });
          }
          if (doc > 0) {
            const a = Math.round(doc / 2);
            propostos.push({ produto: "brigadeiro", categoria: "docinho", qtd: a, obs: null });
            propostos.push({ produto: "beijinho", categoria: "docinho", qtd: doc - a, obs: null });
          }
          if (kg > 0) propostos.push({ produto: "bolo brigadeiro", categoria: "bolo_festa", qtd: kg, obs: null });
          if (propostos.length) {
            estado.montagem.push({ tipo: "dados", dados: { proposta: JSON.stringify(propostos) } });
          }
          textoFinal =
            "Então deixa eu te indicar o que a gente mais faz em festa de criança:" +
            String.fromCharCode(10) + String.fromCharCode(10) +
            linhas.map((l) => "- " + l).join(String.fromCharCode(10)) +
            String.fromCharCode(10) + String.fromCharCode(10) +
            "Pode ser assim, ou você quer trocar alguma coisa?";
        }
      }

      // Sugestao de festa: os numeros vem do codigo e a pergunta continua
      // sendo dela, pra conversa nao ficar robotica. So o que ela escreveu
      // sobre quantidade e que nao vale.
      if (estado.sugestao && !estado.resumo) {
        // So a ULTIMA FRASE com pergunta: pegando um pedaco maior, o texto dela
        // repetia a base que o codigo ja tinha escrito, e o cliente lia a mesma
        // coisa duas vezes.
        const frases = textoFinal.split(new RegExp("(?<=[.!?])", "g")).map((f) => f.trim()).filter(Boolean);
        const pergunta = [...frases].reverse().find((f) => f.includes("?")) ?? "";
        textoFinal = pergunta
          ? estado.sugestao + String.fromCharCode(10) + String.fromCharCode(10) + pergunta
          : estado.sugestao;
      }

      // ELA TRAVA REPETINDO A PROPRIA FRASE.
      //
      // Depois de responder "deixa eu chamar alguem da equipe" uma vez, ela
      // passou a repetir isso identico a cada mensagem do cliente, sem chamar
      // ferramenta nenhuma: o cliente pedia o resumo do pedido e recebia a mesma
      // frase. Repetir palavra por palavra a ultima resposta nunca e o certo.
      const ultimaDela = [...historico].reverse().find((h) => h.role === "assistant")?.content ?? "";
      const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      if (textoFinal && igual(textoFinal, String(ultimaDela)) && i < 5) {
        messages.push({
          role: "system",
          content:
            "Voce acabou de escrever exatamente a mesma resposta de antes, palavra por palavra. Isso deixa o cliente " +
            "em loop. Leia o que ele pediu na ultima mensagem e responda AQUILO. Se o pedido esta completo e ele " +
            "mandou fechar, chame registrar_pedido agora em vez de repetir.",
        });
        continue;
      }
      // PROMESSA DE PEDIDO FECHADO SEM PEDIDO FECHADO NAO SAI.
      //
      // Ela ja disse "passei seu pedido pra equipe" com o registro recusado nas
      // duas tentativas: o cliente foi embora achando que encomendou e a padaria
      // nao tinha nada. Se nao registrou, o texto vira a verdade.
      const prometeuFechamento =
        /passei (seu |o )?pedido|pedido recebido|passei pra (nossa )?equipe|ja passei pra equipe|esta com a equipe|mandei pra cozinha/i.test(
          textoFinal,
        );
      if (prometeuFechamento && !estado.pedido && !pedidoAguardando && !pedidoAberto) {
        console.warn("[ia] ela anunciou pedido fechado sem registrar; texto trocado pela verdade");
        const faltando = pendenciasDeSabor(
          montagemDoTurno?.itens ?? [],
          ehFesta,
          pediuBolo,
          String(montagemDoTurno?.dados?.nao_quer ?? ""),
        );
        textoFinal = faltando.length
          ? "Pra fechar seu pedido ainda falta " + faltando[0].replace(/^- /, "") + ". Me confirma isso que eu fecho agora."
          : "Ainda nao consegui fechar seu pedido aqui. Vou chamar alguem da equipe pra terminar com voce.";
        if (!faltando.length) estado.precisaHumano = true;
      }

      // "QUANTO FICOU O TOTAL?" COM PEDIDO REGISTRADO TEM RESPOSTA.
      //
      // Ela devolveu "ta querendo fazer um pedido novo?" pra quem tinha acabado
      // de fechar. O valor esta no pedido; perguntar de volta e fazer o cliente
      // duvidar do que combinou.
      const perguntouTotal =
        /(quanto|qual)[^?]{0,30}(total|ficou|deu|valor)|quanto (ficou|deu|custou)/i.test(String(falaDoCliente2 ?? ""));
      if (pedidoAberto && perguntouTotal && !estado.pedido && pedidoAberto.totalCentavos > 0) {
        if (!/R\$\s?[0-9]/.test(textoFinal)) {
          console.warn("[ia] total do pedido respondido pelo codigo");
          const quandoT = [
            pedidoAberto.retiradaData ? pedidoAberto.retiradaData : null,
            pedidoAberto.retiradaHora ? "às " + pedidoAberto.retiradaHora : null,
          ].filter(Boolean).join(" ");
          textoFinal =
            "Seu pedido" + (quandoT ? " pra " + quandoT : "") + " deu " + brl(pedidoAberto.totalCentavos / 100) + "." +
            "\n\n" + textoFinal;
        }
      }

      // MUDANCA OU CANCELAMENTO DE PEDIDO REGISTRADO: CHAMA A EQUIPE.
      const querMexerNoPedido =
        /\b(mudar|muda|trocar|troca|alterar|altera|aumentar|aumenta|diminuir|diminui|acrescentar|acrescenta|tirar|tira|cancelar|cancela|desmarcar|adiar)\b/i.test(
          String(falaDoCliente2 ?? ""),
        );
      if (pedidoAberto && querMexerNoPedido && !estado.pedido) {
        console.warn("[ia] cliente quer mexer no pedido registrado; chamando a equipe");
        estado.precisaHumano = true;
        const quandoM = [
          pedidoAberto.retiradaData ? pedidoAberto.retiradaData : null,
          pedidoAberto.retiradaHora ? "às " + pedidoAberto.retiradaHora : null,
        ].filter(Boolean).join(" ");
        textoFinal =
          "Seu pedido" + (quandoM ? " pra " + quandoM : "") + " já está com a equipe da padaria." +
          " Pra mexer nele agora quem resolve é uma pessoa daqui: já avisei, e ela fala com você por aqui." +
          " Me diz o que você quer mudar que eu deixo anotado pra ela.";
      }

      // CONFIRMACAO CURTA COM PEDIDO REGISTRADO VIRA STATUS, NAO PERGUNTA.
      //
      // "pode fechar" depois do pedido fechado recebia "quer falar sobre esse
      // pedido ou e outro?". O cliente quer saber uma coisa so: preciso esperar
      // alguem? Entao a resposta diz exatamente isso.
      // Vale por palavra: "ok obrigada" e "beleza, valeu" sao a mesma coisa que
      // "ok", e antes so a palavra sozinha contava.
      const PALAVRAS_DE_OK = new Set([
        "ok", "okay", "okey", "blz", "beleza", "ta", "tá", "bom", "certo", "isso", "mesmo", "perfeito",
        "fechado", "fechar", "pode", "mandar", "ser", "combinado", "show", "sim", "obrigado", "obrigada",
        "brigado", "brigada", "valeu", "vlw", "otimo", "ótimo", "legal", "entao", "então",
      ]);
      const palavrasDele = String(falaDoCliente2 ?? "").toLowerCase().replace(/[.,!?;:]/g, " ").split(/\s+/).filter(Boolean);
      const soConfirmou = palavrasDele.length > 0 && palavrasDele.length <= 4 && palavrasDele.every((w) => PALAVRAS_DE_OK.has(w));
      if (pedidoAberto && soConfirmou && !estado.pedido) {
        const quando = [
          pedidoAberto.retiradaData ? pedidoAberto.retiradaData : null,
          pedidoAberto.retiradaHora ? `às ${pedidoAberto.retiradaHora}` : null,
        ].filter(Boolean).join(" ");
        const jaConfirmado = pedidoAberto.impresso || pedidoAberto.status === "aprovado";
        // Item que depende da equipe pra fechar preco (topo de bolo, sabor fora
        // da tabela) tem que ser dito com nome, senao o cliente acha que o total
        // que ele viu e final.
        const temTopo = pedidoAberto.itens.some((i) =>
          /topo|papel de arroz/i.test(String(i.obs ?? "")),
        );
        if (jaConfirmado) {
          textoFinal =
            "A equipe já confirmou seu pedido" + (quando ? " pra " + quando : "") + "." +
            " É só retirar aqui na padaria no dia.";
        } else {
          textoFinal =
            "Seu pedido já está registrado" + (quando ? " pra " + quando : "") +
            " e agora está com a equipe da padaria, esperando a confirmação deles." +
            (temTopo
              ? " O topo é a equipe que confirma: eles te passam o valor junto com a confirmação."
              : pedidoAberto.motivoHumano
                ? " Tem um detalhe que a equipe está conferindo e eu te trago a resposta aqui."
                : "") +
            " Assim que confirmarem, eu te aviso por aqui.";
        }
      }

      // SABOR DE PIZZA: O ASSUNTO DA CONVERSA MANDA, NAO A PALAVRA SOLTA.
      const ultimasFalas = historico
        .slice(-4)
        .map((h) => (typeof h.content === "string" ? h.content : ""))
        .join(" ");
      const assuntoPizza = /pizza/i.test(ultimasFalas);
      const querSaborDePizza =
        assuntoPizza &&
        /(sabor|sabores)/i.test(String(falaDoCliente2 ?? "")) &&
        !/coxinha|esfirra|empadinha|ris[óo]lis|croquete|docinho|brigadeiro/i.test(String(falaDoCliente2 ?? ""));
      if (querSaborDePizza) {
        const doces = /doce|sobremesa/i.test(String(falaDoCliente2 ?? ""));
        const lista = (
          doces
            ? ((catalogo.pizza?.sabores_doces ?? []) as string[])
            : ((catalogo.pizza?.sabores_salgados ?? []) as string[])
        ).slice(0, 12);
        if (lista.length) {
          // A peca de salgados de festa nao tem nada a ver com isso.
          estado.cardapios = estado.cardapios.filter((x) => x !== "salgados");
          const jaCitou = lista.some((sab) => textoFinal.toLowerCase().includes(String(sab).toLowerCase()));
          if (!jaCitou) {
            console.warn("[ia] sabor de pizza respondido pelo codigo");
            textoFinal =
              "Os sabores " + (doces ? "doces" : "salgados") + " da pizza sao: " + lista.join(", ") + "." +
              "\n\n" + textoFinal;
          }
        }
      }

      // LISTA DE SABOR DITA POR ELA: TEM QUE SER A DO PRODUTO CITADO.
      //
      // "O empadão pode ser de palmito, frango, carne ou brócolis" e a lista da
      // EMPADINHA. Empadao e frango ou frango com legumes; com palmito e outro
      // produto, mais caro. Escolher pela lista errada faz a cozinha produzir
      // outra coisa e a padaria cobrar a menos.
      {
        const semAcL = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const txt = semAcL(textoFinal);
        // O produto que ela citou junto de uma oferta de sabor.
        const ofertando = /pode ser de|tem (os sabores|de)|os sabores s[ãa]o|op[çc][õo]es s[ãa]o|qual (o )?sabor|que sabor|qual recheio/i.test(
          textoFinal,
        );
        // Produtos com lista de sabor citados nesta mensagem. Dois ou mais e
        // conversa de festa normal, e cada sabor tem dono possivel.
        const produtosCitados = Object.keys(SABORES).filter(
          (nome) => (SABORES[nome] ?? []).length >= 2 && txt.includes(semAcL(nome)),
        ).length;
        if (ofertando && produtosCitados === 1) {
          for (const nome of Object.keys(SABORES)) {
            const ops = SABORES[nome] ?? [];
            if (ops.length < 2) continue;
            if (!txt.includes(semAcL(nome))) continue;
            // Sabor que ela citou e que NAO e desse produto.
            const intrusos = Object.entries(SABORES)
              .filter(([outro]) => outro !== nome)
              .flatMap(([, lista]) => lista)
              .filter((sab) => !ops.some((o) => semAcL(o) === semAcL(sab)))
              .filter((sab) => txt.includes(semAcL(sab)));
            if (!intrusos.length) continue;
            // So corrige quando ela realmente listou o sabor errado perto do
            // produto, e nao quando o cliente falou de duas coisas na mesma frase.
            const faltamOsCertos = ops.filter((o) => !txt.includes(semAcL(o))).length;
            if (faltamOsCertos === 0) continue;
            console.warn("[ia] lista de sabor errada pra " + nome + ": " + intrusos.join(", ") + "; a lista certa vai na frente");
            // Nao mexe no texto dela: acrescenta a lista do cardapio na frente.
            // Cortar frase ja deixou a resposta vazia, e resposta vazia e pior
            // que resposta com sabor errado, porque o cliente fica sem nada.
            textoFinal =
              "O " + nome + " a gente faz de " + ops.slice(0, -1).join(", ") +
              (ops.length > 1 ? " ou " + ops[ops.length - 1] : String(ops[0])) +
              ". Os outros sabores que apareceram aqui sao de outro produto." +
              "\n\n" + textoFinal;
            break;
          }
        }
      }

      // PERGUNTA DE SABOR TEM RESPOSTA NO CARDAPIO: ELA SAI DAQUI.
      //
      // "o risoles de que sabor vem?" virou "anotei 67 coxinhas, e o pastel, de
      // que sabor?". Quem perguntou ficou sem resposta e ainda levou pergunta.
      const perguntouSabor =
        /(de |que |quais |qual )?(que |quais |qual )?(sabor|sabores|recheio|recheios)/i.test(
          String(falaDoCliente2 ?? ""),
        ) && /[?]|^(qual|quais|que|de que|tem)/i.test(String(falaDoCliente2 ?? "").trim());
      if (perguntouSabor && textoFinal) {
        const limpo = String(falaDoCliente2 ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        // O produto de que ele falou, entre os que tem escolha de recheio.
        const alvo = Object.keys(SABORES).find((nome) => {
          const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return limpo.includes(n) || limpo.includes(n.slice(0, Math.max(4, n.length - 2)));
        });
        const ops = alvo ? SABORES[alvo] : null;
        if (ops && ops.length) {
          // Ela respondeu o sabor? Basta citar um deles pra valer.
          // TODAS as opcoes, nao uma. Ela respondeu "o risolis e de carne" e
          // escondeu o frango: o cliente escolhe entre o que ele conhece.
          const respondeu = ops.every((o) =>
            textoFinal.toLowerCase().includes(String(o).trim().toLowerCase().split(" ")[0]),
          );
          if (!respondeu) {
            console.warn("[ia] ela ignorou a pergunta de sabor de " + alvo + "; resposta escrita pelo codigo");
            textoFinal =
              "O " + alvo + " tem " + ops.slice(0, -1).join(", ") +
              (ops.length > 1 ? " ou " + ops[ops.length - 1] : String(ops[0])) + "." +
              "\n\n" + textoFinal;
          }
        }
      }

      // PRECO DO BOLO DE FESTA: as faixas estao no cardapio, e o sabor decide.
      const perguntouBolo =
        /(quanto|qual|pre[çc]o)[^?]{0,40}(quilo|kg)[^?]{0,20}bolo|quanto (custa|fica|sai) o bolo|pre[çc]o do bolo/i.test(
          String(falaDoCliente2 ?? ""),
        );
      if (perguntouBolo && textoFinal && !/R\$\s?[0-9]/.test(textoFinal)) {
        const faixas = ((catalogo.bolos_recheados?.faixas ?? []) as { preco?: number }[])
          .map((f) => Number(f.preco ?? 0))
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        if (faixas.length) {
          console.warn("[ia] preco do bolo respondido pelo codigo");
          const menor = faixas[0];
          const maior = faixas[faixas.length - 1];
          textoFinal =
            "O bolo de festa é vendido por quilo: de " + brl(menor) + " a " + brl(maior) +
            " o quilo, dependendo do sabor." + "\n\n" + textoFinal;
        }
      }

      // PRECO DE SALGADO, DOCINHO E BOLO: POR UNIDADE E POR CENTO.
      const perguntouCento =
        /(quanto|qual|preco|preço)[^?]{0,40}(cento|cem|100)|quanto (custa|fica|sai) o (cento|salgadinho|salgado|docinho|doce|bolo)|pre[çc]o d[oa] (cento|salgado|docinho|bolo)/i.test(
          String(falaDoCliente2 ?? ""),
        );
      if (perguntouCento && textoFinal && !/R\$\s?[0-9]/.test(textoFinal)) {
        const t = String(falaDoCliente2 ?? "").toLowerCase();
        const frito = Number(catalogo.salgados?.frito?.preco ?? 0);
        const assado = Number(catalogo.salgados?.assado?.preco ?? 0);
        const doce = Number(catalogo.doces?._preco_padrao_doce ?? 0);
        const linhas: string[] = [];
        if (/salgad|frito|assado|cento/i.test(t) && frito > 0) {
          linhas.push(
            "Salgado frito sai " + brl(frito) + " a unidade (" + brl(frito * 100) + " o cento) e o assado " +
              brl(assado) + " (" + brl(assado * 100) + " o cento).",
          );
        }
        if (/docinho|doce/i.test(t) && doce > 0) {
          linhas.push("Docinho sai " + brl(doce) + " cada (" + brl(doce * 100) + " o cento).");
        }
        if (linhas.length) {
          console.warn("[ia] preco por cento respondido pelo codigo");
          textoFinal = linhas.join(" ") + "\n\n" + textoFinal;
        }
      }

      // PRECO DE PRODUTO DA TABELA E RESPOSTA, NAO PROMESSA DE CONFERIR.
      const perguntouPreco =
        /(quanto (custa|fica|sai|ta|e)|qual o pre[çc]o|pre[çc]o d)/i.test(String(falaDoCliente2 ?? ""));
      if (perguntouPreco && textoFinal && !/R\$\s?[0-9]/.test(textoFinal)) {
        const t = String(falaDoCliente2 ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const tabela = ((catalogo.outros_produtos ?? []) as { nome: string; preco: number; unidade?: string }[])
          .map((i) => ({ nome: String(i.nome), preco: Number(i.preco), unidade: String(i.unidade ?? "un") }))
          .filter((i) => t.includes(i.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
          .sort((a, b) => b.nome.length - a.nome.length);
        // Pergunta generica ("quanto custa a cuca?") num assunto especifico
        // (cuca recheada): a variante da conversa manda.
        const recente = historico
          .slice(-6)
          .map((h) => (typeof h.content === "string" ? h.content : ""))
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const daConversa = ((catalogo.outros_produtos ?? []) as { nome: string; preco: number; unidade?: string }[])
          .map((i) => ({ nome: String(i.nome), preco: Number(i.preco), unidade: String(i.unidade ?? "un") }))
          .filter((i) => {
            const n = i.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            // So variantes do que ele perguntou, e que aparecem na conversa.
            return tabela.some((t) => n.startsWith(t.nome.toLowerCase()) && n !== t.nome.toLowerCase()) && recente.includes(n);
          })
          .sort((a, b) => b.nome.length - a.nome.length);
        const achado = daConversa[0] ?? tabela[0];
        if (achado && achado.preco > 0) {
          console.warn("[ia] ela nao respondeu o preco de " + achado.nome + "; preco escrito pelo codigo");
          textoFinal =
            "A " + achado.nome + " sai " + brl(achado.preco) +
            (achado.unidade === "kg" ? " o quilo." : " cada.") +
            // A frase dela que promete confirmar o preco sai: o valor ja esta
            // dito, e duvidar dele na linha seguinte desfaz a resposta.
            "\n\n" +
            textoFinal
              .replace(
                /[^.!?\n]*(n[ãa]o sei o pre[çc]o|vou confirmar (o )?(pre[çc]o|valor)|confirmo (o )?(pre[çc]o|valor) com a equipe|preciso confirmar (o )?(pre[çc]o|valor))[^.!?\n]*[.!?]/gi,
                "",
              )
              .replace(/\n{3,}/g, "\n\n")
              .trim();
        }
      }

      // COMO SE VENDE: A RESPOSTA VEM DO CARDAPIO, NAO DA CONVERSA.
      const perguntouComoVende =
        /(por quilo|por unidade|vendid|inteir|como (que )?vende|quanto (custa )?o quilo)/i.test(
          String(falaDoCliente2 ?? ""),
        ) &&
        /[?]/.test(String(falaDoCliente2 ?? ""));
      if (perguntouComoVende && textoFinal) {
        const t = String(falaDoCliente2 ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const doCatalogo = ((catalogo.outros_produtos ?? []) as { nome: string; unidade?: string }[])
          .filter((i) => i.unidade)
          .map((i) => ({ nome: String(i.nome), unidade: String(i.unidade) }))
          .filter((i) => t.includes(i.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
          .sort((a, b) => b.nome.length - a.nome.length);
        const alvo = doCatalogo[0];
        // Ela ja respondeu? Entao nao repete.
        const jaDisse = alvo
          ? new RegExp(alvo.unidade === "kg" ? "por quilo|o quilo|por kg" : "por unidade|cada unidade", "i").test(textoFinal)
          : true;
        if (alvo && !jaDisse) {
          console.warn("[ia] ela ignorou como se vende " + alvo.nome + "; resposta escrita pelo codigo");
          textoFinal =
            "A gente vende " + alvo.nome + " por " + (alvo.unidade === "kg" ? "quilo" : "unidade") + "." +
            "\n\n" + textoFinal;
        }
      }

      // NEGAR O QUILO DE UM PRODUTO DE QUILO NAO SAI.
      //
      // Ela escreveu "nao vende cachorro-quente por quilo, so por unidade" pra
      // um produto que o cardapio vende a R$ 19,90 o quilo. O cliente desiste
      // ou compra errado por causa de uma frase que o proprio catalogo desmente.
      const negouOQuilo = /(n[ãa]o|nao)[^.]{0,40}por quilo|s[óo] por unidade|somente por unidade|por unidade mesmo/i.test(
        textoFinal,
      );
      if (negouOQuilo) {
        const porQuilo = ((catalogo.outros_produtos ?? []) as { nome: string; unidade?: string }[])
          .filter((i) => i.unidade === "kg")
          .map((i) => String(i.nome))
          .filter((n) => {
            const x = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const t = (String(falaDoCliente2 ?? "") + " " + textoFinal).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return t.includes(x);
          });
        if (porQuilo.length) {
          console.warn("[ia] ela negou o quilo de " + porQuilo[0] + "; frase trocada pela verdade");
          textoFinal = textoFinal.replace(/[^.!?\n]*(n[ãa]o|nao)[^.!?\n]{0,40}por quilo[^.!?\n]*[.!?]?/gi, "").trim();
          textoFinal = textoFinal.replace(/[^.!?\n]*(s[óo] por unidade|somente por unidade|por unidade mesmo)[^.!?\n]*[.!?]?/gi, "").trim();
          textoFinal =
            "O " + porQuilo[0] + " a gente vende por quilo." + (textoFinal ? "\n\n" + textoFinal : "");
        }
      }

      // FRASE DE RECUSA SO SAI SE O CLIENTE RECUSOU COM AS PALAVRAS DELE.
      const anunciaRecusa =
        /anotei que (voc[êe] )?n[ãa]o (quer|vai querer)|anotado que (voc[êe] )?n[ãa]o quer|sem salgado|sem docinho/i.test(
          textoFinal,
        );
      if (anunciaRecusa) {
        const falaDele = historico
          .filter((h) => h.role === "user" && typeof h.content === "string")
          .map((h) => String(h.content).toLowerCase())
          .join("  ");
        const recusouMesmo =
          /(sem|n[ãa]o quero|nem|n[ãa]o vou querer|dispensa|deixa pra la|deixa pra lá)[^.]{0,30}(salgad|docinho|doce|bolo)/i.test(
            falaDele,
          );
        if (!recusouMesmo) {
          console.warn("[ia] ela anunciou recusa que o cliente nao fez; frase cortada");
          const semFrase = textoFinal
            .replace(
              /[^.!?\n]*(anotei que (voc[êe] )?n[ãa]o (quer|vai querer)|anotado que (voc[êe] )?n[ãa]o quer)[^.!?\n]*[.!?]/gi,
              "",
            )
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          if (semFrase) textoFinal = semFrase;
        }
      }

      // PARAGRAFO REPETIDO DA MENSAGEM ANTERIOR NAO SAI DE NOVO.
      const anteriorDela = [...historico].reverse().find((h) => h.role === "assistant")?.content ?? "";
      if (textoFinal && String(anteriorDela).trim()) {
        const limpar = (t: string) => String(t).toLowerCase().replace(/\s+/g, " ").trim();
        const jaDito = new Set(
          String(anteriorDela)
            .split(/\n{2,}/)
            .map(limpar)
            .filter((t) => t.length > 25),
        );
        if (jaDito.size) {
          const paragrafos = textoFinal.split(/\n{2,}/);
          const sobrou = paragrafos.filter((t) => !jaDito.has(limpar(t)));
          const restante = sobrou.join("\n\n").trim();
          // So corta se ainda sobra conversa: uma resposta vazia e pior que uma
          // repetida.
          if (sobrou.length < paragrafos.length && restante.length >= 20) {
            console.warn("[ia] paragrafo repetido da mensagem anterior; cortado");
            textoFinal = restante;
          }
        }
      }

      // DIA DA SEMANA CHUTADO NAO SAI.
      const DIAS_DA_SEMANA = /\b(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(-feira)?\b/gi;
      if (DIAS_DA_SEMANA.test(textoFinal)) {
        // So mexe quando ha uma data no texto: 'a gente abre sabado' e verdade,
        // 'sabado 20/09' pode ser mentira.
        const comData = /\b(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(-feira)?\b[ ,]*(\d{1,2})[\/](\d{1,2})/gi;
        textoFinal = textoFinal.replace(comData, (todo, _dia, _f, d, m) => {
          const dia = Number(d);
          const mes = Number(m);
          if (!Number.isFinite(dia) || !Number.isFinite(mes)) return todo;
          // O ano vem do proprio texto quando existir; senao, o ano de hoje.
          const anoNoTexto = textoFinal.match(new RegExp(d + "\\/" + m + "\\/(\\d{4})"));
          const ano = anoNoTexto ? Number(anoNoTexto[1]) : new Date().getFullYear();
          const data = new Date(ano, mes - 1, dia);
          if (Number.isNaN(data.getTime())) return todo;
          const nomes = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
          const certo = nomes[data.getDay()];
          const escrito = String(todo).trim().toLowerCase();
          if (escrito.startsWith(certo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3))) return todo;
          console.warn("[ia] dia da semana errado em \"" + todo + "\"; corrigido pra " + certo);
          return todo.replace(/^[a-zà-ú-]+/i, certo);
        });
      }

      // Lista de produtos digitada vira peca do cardapio: a imagem tem tudo e o
      // preco, e ninguem escolhe festa lendo nove nomes num paragrafo.
      // Peca que ja foi pro cliente ha pouco nao volta: repetir cardapio no meio
      // da escolha faz parecer que a padaria perdeu o fio da conversa.
      const mandadasAgora = pecasJaMandadas(historico);
      const semLista = listaViraCardapio(textoFinal, estado.cardapios, mandadasAgora);
      // O que o CLIENTE pediu vale por ultimo: se ele pediu a peca, ela vai.
      const pedidasPeloCliente = cardapioPedidoPeloCliente(String(falaDoCliente2), semLista.cardapios).filter(
        (x) => semLista.cardapios.includes(x) || !mandadasAgora.includes(x) || /card[áa]pio|me manda|quais|que tipos/i.test(String(falaDoCliente2)),
      );
      // Ele nomeou a familia que quer ver: so ela vai agora. Mandar junto o
      // cardapio que ninguem pediu polui a conversa e atrapalha a escolha.
      const nomeouAFamilia = QUER_VER.test(String(falaDoCliente2 ?? ""))
        ? PEDIDO_DE_CARDAPIO.filter(([, rx]) => rx.test(String(falaDoCliente2 ?? ""))).map(([id]) => id)
        : [];
      // O texto manda na imagem: "te mandei o cardapio de docinhos" com a foto
      // de salgados junto ja saiu pro cliente.
      const anunciadoNoTexto: CardapioId[] = [
        [/card[áa]pio de salgad|cardapio de salgad/i, "salgados"] as const,
        [/card[áa]pio de docinho|cardapio de docinho/i, "docinhos"] as const,
        [/card[áa]pio de bolos? de festa|cardapio de bolos? de festa/i, "bolos-festa"] as const,
        [/card[áa]pio de bolos? caseiro|cardapio de bolos? caseiro/i, "bolos-caseiros"] as const,
        [/card[áa]pio de cuca|cardapio de cuca/i, "cucas-paes"] as const,
        [/card[áa]pio de torta|cardapio de torta|card[áa]pio de empad/i, "tortas-empadao"] as const,
        [/card[áa]pio de pizza|cardapio de pizza/i, "pizza"] as const,
        [/card[áa]pio de cupcake|cardapio de cupcake/i, "cupcakes-franciscano"] as const,
      ]
        .filter(([rx]) => rx.test(textoFinal))
        .map(([, id]) => id as CardapioId);
      const escolhidas = nomeouAFamilia.length
        ? pedidasPeloCliente.filter((x) => nomeouAFamilia.includes(x))
        : pedidasPeloCliente;
      const pecasAntesDoAssunto = anunciadoNoTexto.length
        ? Array.from(new Set([...escolhidas.filter((x) => anunciadoNoTexto.includes(x)), ...anunciadoNoTexto]))
        : escolhidas;
      // Assunto pizza: o cardapio de salgados de festa nao tem nada a ver com
      // "quais sabores salgados tem" de uma pizza.
      const pecasFinais = querSaborDePizza
        ? pecasAntesDoAssunto.filter((x) => x !== "salgados")
        : pecasAntesDoAssunto;
      // A peca ja vai junto desta resposta: perguntar se pode mandar e pedir
      // permissao pra uma coisa que ja saiu.
      if (pecasFinais.length) {
        const oferta =
          /[^.!?\n]*(quer que eu (te )?mand|posso (te )?mandar|quer (ver )?o card[áa]pio|quer que eu envie)[^.!?\n]*[.!?]/gi;
        const semOferta = semLista.texto.replace(oferta, "").replace(/\n{3,}/g, "\n\n").trim();
        if (semOferta) semLista.texto = semOferta;
      }
      return {
        texto: semLista.texto,
        precisaHumano: estado.precisaHumano,
        pedidoRegistrado: estado.pedido,
        aceitouOrcamento: estado.aceitouOrcamento,
        montagem: estado.montagem,
        cardapiosParaEnviar: pecasPermitidas(
          honrarCardapioPrometido(semLista.texto, pecasFinais, mandadasAgora),
          String(falaDoCliente2),
          String(montagemDoTurno?.dados?.nao_quer ?? ""),
        ),
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
      // A ULTIMA fala, separada: pra saber o que ele acabou de pedir sem a
      // conversa inteira contaminando (morango e sabor de trufa e de bolo).
      const ultimaFala =
        [...historico].reverse().find((m) => m.role === "user" && typeof m.content === "string")?.content ?? "";
      // O que ELA propos na mensagem anterior: numero que ela colocou na mesa e
      // o cliente aceitou vale tanto quanto numero que ele digitou.
      const ultimaFalaDela =
        [...historico].reverse().find((m) => m.role === "assistant" && typeof m.content === "string")?.content ?? "";
      const falaDoCliente = historico
        .filter((m) => m.role === "user" && typeof m.content === "string")
        .map((m) => m.content as string)
        .join("  ");
      const falasDela = historico.filter((m) => m.role === "assistant" && typeof m.content === "string").map((m) => m.content as string);
      const saida = executarFerramenta(tc.function.name, args, estado, tenant.motor, falaDoCliente, montagemDoTurno, pedidoAguardando, ultimaFala, ultimaFalaDela, falasDela);
      // Sem isto, quando ela faz besteira so da pra adivinhar o que ela chamou.
      // 90 caracteres cortavam justamente a lista do que falta, que e o motivo da
      // recusa. Sem ela o log so diz que recusou, nao por que.
      console.log(`[ia] ${tc.function.name} -> ${saida.replace(new RegExp("\\s+", "g"), " ").slice(0, 320)}`);
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


// O que o cliente pediu COM QUANTIDADE e nao existe no cardapio.
//
// So olha "150 casadinho", "2 tortas de brigadeiro": numero colado num nome.
// E onde o erro custa caro, porque e a hora em que ele acha que fechou.
function pedidosQueNaoExistem(fala: string): string[] {
  const semAcento = (t: string) =>
    String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const conhecidos: string[] = [
    ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => semAcento(i.nome)),
    ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => semAcento(i.nome)),
    ...((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => semAcento(i.nome)),
    ...((catalogo.bolos_caseiros?.itens ?? []) as { nome: string }[]).map((i) => semAcento(i.nome)),
    ...((catalogo.outros_produtos ?? []) as { nome: string }[]).map((i) => semAcento(i.nome)),
    ...(catalogo.bolos_recheados?.faixas ?? []).flatMap((f: { sabores?: string[] }) =>
      (f.sabores ?? []).map((x) => semAcento(x)),
    ),
    "salgado", "salgados", "docinho", "docinhos", "doce", "doces", "bolo", "bolos", "kg", "pessoas", "convidados",
    "anos", "unidades", "cento", "centos", "pedaco", "pedacos", "fatia", "fatias",
    // Palavras que aparecem coladas em numero e nao sao produto nenhum.
    "crianca", "criancas", "adulto", "adultos", "gente", "reais", "real", "hora", "horas",
    "minuto", "minutos", "dia", "dias", "semana", "semanas", "mes", "meses", "ano",
    "caixa", "caixas", "litro", "litros", "gramas", "grama", "mesa", "mesas", "por cento",
    "manha", "tarde", "noite", "meio dia", "meio-dia", "hoje", "amanha", "sabado", "domingo",
    "segunda", "terca", "quarta", "quinta", "sexta", "semana", "feriado", "convidado", "convidados",
  ];
  const achados: string[] = [];
  // Data e hora saem antes: "dia 30/08 de manha" nao e pedido de "manha", e
  // "as 16h" nao e pedido de "h". Foi assim que ela inventou que a padaria
  // nao faz bolo de manha.
  const texto = semAcento(fala)
    .replace(/[0-9]{1,2}[/.-][0-9]{1,2}(?:[/.-][0-9]{2,4})?/g, " ")
    .replace(/[0-9]{1,2} ?(h|hs|horas?)\b/g, " ")
    .replace(/\b(de|da|pela|pra|para) ?(manha|tarde|noite|manhazinha)\b/g, " ");
  const re = /([0-9]+) *(?:de |da |do )?([a-z][a-z ]{2,22})/g;
  let m = re.exec(texto);
  while (m) {
    const nome = m[2].trim().replace(/ (de|da|do|com|e|pra|para|no|na)$/,"").trim();
    const conhecido = conhecidos.some(
      (c) => c.length > 2 && (nome.includes(c) || c.includes(nome) || nome.startsWith(c.slice(0, 5))),
    );
    if (!conhecido && nome.length > 3 && !achados.includes(nome)) achados.push(nome);
    m = re.exec(texto);
  }
  return achados;
}

// PORTAO FINAL: peca de familia recusada nao sai.
//
// Existem quatro caminhos que enfileiram cardapio (ferramenta, promessa no
// texto, lista digitada, pedido do cliente). Barrar em cada um deles deixou
// passar: a ferramenta recusou e a promessa mandou. Aqui e o unico lugar por
// onde a peca sai de verdade.
function pecasPermitidas(pecas: CardapioId[], ultimaFala: string, naoQuer: string): CardapioId[] {
  if (pecas.length === 0) return pecas;
  const dito = (String(naoQuer || "") + " " + String(ultimaFala || "")).toLowerCase();
  const recusou: [CardapioId, RegExp][] = [
    ["salgados", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}salgad/],
    ["docinhos", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}(docinho|doce)/],
    ["bolos-festa", /(sem|nao quero|não quero|nem|nao vou querer|não vou querer)[^.]{0,24}bolo/],
  ];
  // Pediu agora, com todas as letras: manda mesmo assim.
  const pediuAgora = /card[áa]pio|me manda|quais|que tipos|op[çc][õo]es|que sabores/i.test(String(ultimaFala || ""));
  if (pediuAgora) return pecas;
  const fora = recusou.filter(([, re]) => re.test(dito)).map(([peca]) => peca);
  return pecas.filter((c) => !fora.includes(c));
}

// Quais pecas ja foram mandadas nas ultimas mensagens (a peca vai como imagem
// com legenda "Cardapio de X", e isso fica no historico).
function pecasJaMandadas(historico: Mensagem[]): CardapioId[] {
  const ultimas = historico.slice(-8).map((m) => String(m.content ?? "").toLowerCase());
  const achadas: CardapioId[] = [];
  for (const t of ultimas) {
    if (!t.includes("cardápio de") && !t.includes("cardapio de")) continue;
    if (/salgad/.test(t)) achadas.push("salgados");
    if (/docinho|doce/.test(t)) achadas.push("docinhos");
    if (/bolo.*festa|festa.*bolo/.test(t)) achadas.push("bolos-festa");
    if (/bolo caseiro/.test(t)) achadas.push("bolos-caseiros");
  }
  return achadas;
}

// O jeito que o cliente pede cada peca do cardapio.
const PEDIDO_DE_CARDAPIO: [CardapioId, RegExp][] = [
  ["salgados", /salgad|frito|assado|coxinha|esfirra|empadinha|ris[óo]lis/i],
  ["docinhos", /docinho|doce|brigadeiro|beijinho|trufa/i],
  ["bolos-festa", /bolo de festa|bolos de festa|bolo recheado|bolo de anivers/i],
  ["bolos-caseiros", /bolo caseiro|bolos caseiros/i],
  ["cucas-paes", /cuca|p[ãa]o doce|p[ãa]es/i],
  ["tortas-empadao", /torta|empad[ãa]o/i],
  ["pizza", /pizza/i],
  ["cupcakes-franciscano", /cupcake|franciscano/i],
];
// Pergunta que so se responde com a peca: 'quais salgados tem', 'me manda o
// cardapio de doce', 'que sabores de bolo voces fazem'.
const QUER_VER = /quais|que tipos|quais tipos|que sabores|quais sabores|qual sabor|tem o que|o que tem|me manda|manda o card|card[áa]pio|lista de|op[çc][õo]es/i;

function cardapioPedidoPeloCliente(fala: string, jaNaFila: CardapioId[]): CardapioId[] {
  const t = String(fala || "");
  if (!QUER_VER.test(t)) return jaNaFila;
  const fila = [...jaNaFila];
  for (const [peca, marcador] of PEDIDO_DE_CARDAPIO) {
    if (fila.includes(peca)) continue;
    if (marcador.test(t)) fila.push(peca);
  }
  // Pediu o cardapio sem dizer de que: manda o de salgados, que e o que mais
  // sai em festa, e a conversa segue.
  if (fila.length === jaNaFila.length && /card[áa]pio/i.test(t)) fila.push("salgados");
  return fila;
}

// Os nomes que o cardapio de cada familia ja mostra em imagem.
const NOMES_DA_FAMILIA: [CardapioId, string[]][] = [
  ["salgados", ((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[])
    .concat((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[])
    .map((i) => String(i.nome).toLowerCase())],
  ["docinhos", ((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => String(i.nome).toLowerCase())],
];

// Enumerou a familia inteira em texto? Manda a peca e corta a lista da frase.
// Frase que confirma o que o cliente acabou de escolher nao e lista de
// cardapio, mesmo citando varios produtos.
const CONFIRMANDO = /anotei|anotado|anotamos|fechando|fechamos|somando|no seu pedido|ficou assim/i;

function listaViraCardapio(
  texto: string,
  jaNaFila: CardapioId[],
  jaMandadas: CardapioId[] = [],
): { texto: string; cardapios: CardapioId[] } {
  const frases = texto.split(new RegExp('(?<=[.!?])', 'g'));
  let fila = [...jaNaFila];
  let mudou = false;
  const saida = frases.map((frase) => {
    const t = frase.toLowerCase();
    if (CONFIRMANDO.test(t)) return frase;
    for (const [peca, nomes] of NOMES_DA_FAMILIA) {
      if (fila.includes(peca) || jaMandadas.includes(peca)) continue;
      const achados = nomes.filter((n) => n.length > 3 && t.includes(n));
      // Quatro ou mais nomes na MESMA frase e lista de cardapio, nao conversa.
      if (achados.length >= 4) {
        fila = [...fila, peca];
        mudou = true;
        return " Te mandei o cardápio de " + peca + " aqui, com tudo e os preços.";
      }
    }
    return frase;
  });
  return mudou ? { texto: saida.join("").trim(), cardapios: fila } : { texto, cardapios: jaNaFila };
}

// A IA às vezes ESCREVE que mandou o cardápio sem ter chamado enviar_cardapio.
// O cliente fica olhando pra "te mandei o cardápio aqui" e nada chega; ele
// avisa, ela promete de novo, e a conversa entra em loop de desculpa (aconteceu
// três vezes seguidas num teste real com o cardápio de docinhos).
//
// O prompt sozinho não resolve isso: é comportamento, não regra. Aqui a gente
// cumpre a promessa que ela fez — se o texto anuncia uma peça e nenhuma foi
// enfileirada, a peça citada entra na fila.
function honrarCardapioPrometido(
  texto: string,
  jaNaFila: CardapioId[],
  jaMandadas: CardapioId[] = [],
): CardapioId[] {
  if (jaNaFila.length > 0) return jaNaFila;
  const t = texto.toLowerCase();
  if (!/(mandei|mandando|enviei|enviando|mandar).{0,24}card[áa]pio|card[áa]pio.{0,24}(aqui|pra voc|de novo)/.test(t)) {
    return jaNaFila;
  }
  // Peca ja mandada nao volta so porque ela repetiu a frase: era isso que
  // fazia o mesmo cardapio ir cinco vezes na mesma conversa.
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
  pedidoAberto?: PedidoEmAbertoIA | null,
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
  // Limite de tokens por minuto pede espera, nao desistencia: o proprio erro
  // diz quanto tempo falta, e esperar isso custa segundos contra perder o
  // pedido. Por isso 429 ganha ate quatro tentativas com a espera que ele pede.
  const TENTATIVAS_LIMITE = 4;
  const TENTATIVAS_NORMAIS = 2;
  for (const prov of lista) {
    let teto = TENTATIVAS_NORMAIS;
    for (let tentativa = 1; tentativa <= teto; tentativa++) {
      try {
        return await rodarConversa(prov, system, historico, tenant, origem, clienteId, montagemAtual, pedidoAguardando, pedidoAnterior, pedidoAberto);
      } catch (e) {
        ultimoErro = e;
        const msg = (e as Error)?.message ?? String(e);
        console.error(`[ia] provedor ${prov.nome} falhou (tentativa ${tentativa}/${teto}):`, msg);
        const noLimite = /429|rate limit|quota/i.test(msg);
        if (noLimite) teto = TENTATIVAS_LIMITE;
        if (tentativa >= teto) break;
        // A propria mensagem traz o tempo: "try again in 1.54s" ou "in 200ms".
        const pedidoEmS = msg.match(/try again in ([0-9.]+)s/i);
        const pedidoEmMs = msg.match(/try again in ([0-9.]+)ms/i);
        const espera = pedidoEmS
          ? Math.ceil(Number(pedidoEmS[1]) * 1000) + 400
          : pedidoEmMs
            ? Math.ceil(Number(pedidoEmMs[1])) + 400
            : noLimite
              ? tentativa * 2500
              : 800;
        await new Promise((r) => setTimeout(r, Math.min(espera, 12000)));
      }
    }
  }
  throw new Error("Todos os provedores de IA falharam: " + String((ultimoErro as Error)?.message ?? ultimoErro));
}
