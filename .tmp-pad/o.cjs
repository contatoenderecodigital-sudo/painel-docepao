"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/ia/orcamento.ts
var orcamento_exports = {};
__export(orcamento_exports, {
  brl: () => brl,
  cardapioResumo: () => cardapioResumo,
  citadoDeVerdade: () => citadoDeVerdade,
  cotarPorItens: () => cotarPorItens,
  criarMotor: () => criarMotor,
  formatarOrcamento: () => formatarOrcamento,
  motorPadrao: () => motorPadrao,
  sugerirPorPessoas: () => sugerirPorPessoas
});
module.exports = __toCommonJS(orcamento_exports);

// lib/ia/dados/catalogo.json
var catalogo_default = {
  _fonte: "Extra\xEDdo dos 5 PDFs oficiais da Doce P\xE3o (dados/tabelas de produtos), julho 2026. Esta \xE9 a tabela-fonte do or\xE7amento. Pre\xE7o que o sistema cotar SAI DAQUI.",
  _moeda: "BRL",
  _regra_preco: "O sabor N\xC3O muda o pre\xE7o. O que define o valor \xE9 a linha (frito x assado, faixa do bolo, etc.). Sabores ficam como metadados pra IA saber o que oferecer.",
  forminhas_docinho: {
    _nota: "Cores de forminha que a IA oferece pro cliente escolher no docinho. S\xF3 a cor (sem repetir variante 'laminada'; se o cliente quiser laminada, \xE9 a mesma cor com acabamento laminado).",
    cores: [
      "amarelo",
      "amarelo neon",
      "azul",
      "azul beb\xEA",
      "azul royal",
      "branca",
      "dourada",
      "laranja",
      "laranja neon",
      "lil\xE1s",
      "marrom",
      "pink",
      "prata",
      "preta",
      "rosa",
      "rosa claro",
      "roxo",
      "roxo neon",
      "verde bandeira",
      "verde tiffany",
      "vermelha"
    ]
  },
  salgados: {
    _regra_sabor: "FRITO = sabor fixo, a IA NAO pergunta recheio (o recheio ja esta no campo 'recheio'). ASSADO = se tiver 'recheios', a IA PERGUNTA qual o cliente quer; sem 'recheios' e fixo. Frito com 'recheios' (risolis, mini bolha) a IA PERGUNTA igual ao assado. Chodo tem padrao presunto e queijo (a dona confirmou); frango, calabresa ou bacon so se o cliente pedir.",
    frito: {
      preco: 1,
      preco_cento: 100,
      itens: [
        {
          nome: "coxinha",
          recheio: "frango"
        },
        {
          nome: "bolinha de queijo",
          recheio: "queijo"
        },
        {
          nome: "almofadinha",
          recheio: "presunto e queijo"
        },
        {
          nome: "croquete",
          recheio: "carne com catupiry"
        },
        {
          nome: "mini p\xE3o de queijo",
          recheio: "queijo"
        },
        {
          nome: "salsicha frita",
          recheio: "salsicha"
        },
        {
          nome: "chod\xF3",
          recheio: "presunto e queijo",
          _nota: "Padrao presunto e queijo. Frango, calabresa ou bacon so sob pedido."
        },
        {
          nome: "mini bolha",
          recheios: [
            "carne",
            "queijo",
            "presunto",
            "frango"
          ],
          _nota: "Sao esses QUATRO os sabores padrao (audio docepao16082 (2), 16/08/2026: 'O pastelzinho bolha pode colocar varios sabores, carne, queijo, presunto, frango, ne, geralmente. Geralmente, esses quatro sabores'). BROCOLIS nao entra na lista padrao: no audio DOCEPAORESPOSTASDONA (3), 30/07, ela cita 'tem brocolis, o que o cliente escolher', ou seja, sob pedido. Sabor fora dos quatro vai com precisa_confirmacao."
        },
        {
          nome: "ris\xF3lis",
          recheios: [
            "carne",
            "frango"
          ],
          _nota: "A dona fala 'gado', que e a carne de gado, a mesma coisa que carne (audio DOCEPAORESPOSTASDONA (3), 30/07/2026: 'O risoles e so frango e gado, so frango e gado'; audio WhatsApp 2026-07-29 08.08.53 (3): 'recheado com carne de gado'). Pro cliente aparece como CARNE, que e como esta no cardapio impresso. Se ele disser 'gado', e carne."
        }
      ]
    },
    assado: {
      preco: 1.25,
      preco_cento: 125,
      itens: [
        {
          nome: "pastel assado",
          recheios: [
            "carne",
            "frango",
            "calabresa",
            "bacon",
            "br\xF3colis"
          ]
        },
        {
          nome: "esfirra",
          recheios: [
            "carne",
            "frango",
            "calabresa",
            "br\xF3colis",
            "bacon"
          ]
        },
        {
          nome: "empadinha",
          recheios: [
            "palmito",
            "frango",
            "carne",
            "br\xF3colis"
          ]
        },
        {
          nome: "quiche",
          recheios: [
            "calabresa",
            "bacon",
            "frango",
            "br\xF3colis"
          ]
        },
        {
          nome: "croissant",
          recheios: [
            "carne",
            "frango",
            "calabresa",
            "bacon",
            "br\xF3colis"
          ]
        },
        {
          nome: "mini pizza",
          recheios: [
            "calabresa",
            "fil\xE9",
            "bacon",
            "milho"
          ]
        },
        {
          nome: "mini sandu\xEDche de pat\xEA de frango"
        },
        {
          nome: "mini x"
        },
        {
          nome: "enroladinho de salsicha assado"
        },
        {
          nome: "p\xE3o de batata"
        }
      ]
    }
  },
  doces: {
    _nota: "Pre\xE7o por unidade. Especialidades variam 1,25\u20131,75; trufas 2,25 fixo.",
    itens: [
      {
        nome: "brigadeiro",
        preco: 1.25
      },
      {
        nome: "beijinho",
        preco: 1.25
      },
      {
        nome: "cajuzinho",
        preco: 1.25
      },
      {
        nome: "caf\xE9",
        preco: 1.25
      },
      {
        nome: "leite ninho",
        preco: 1.25
      },
      {
        nome: "bicho de p\xE9",
        preco: 1.75
      },
      {
        nome: "camafeu de nozes",
        preco: 1.75
      },
      {
        nome: "docinho de churros",
        preco: 1.75
      },
      {
        nome: "leite ninho com avel\xE3",
        preco: 1.75
      },
      {
        nome: "olho de sogra",
        preco: 1.75
      },
      {
        nome: "ouri\xE7o",
        preco: 1.75
      },
      {
        nome: "trufa",
        preco: 2.25,
        sabores: [
          "morango",
          "uva",
          "cereja",
          "caf\xE9",
          "nozes",
          "lim\xE3o",
          "amendoim",
          "maracuj\xE1",
          "brigadeiro"
        ]
      }
    ],
    _preco_padrao_doce: 1.25
  },
  bolos_recheados: {
    _nota: "3 faixas de pre\xE7o POR QUILO: o valor da faixa \xE9 o pre\xE7o do quilo e a quantidade registrada \xE9 o peso (ex: 1,5 kg = 1,5 x o valor). 1 quilo serve 10 pessoas (100 g por pessoa), confirmado pela dona. Tamanhos: redondo de 300 g a 5,5 kg, quadrado de 2,5 kg a 6 kg. Bolo misto vale o sabor mais caro.",
    unidade: "kg",
    faixas: [
      {
        faixa: "A",
        preco: 46.9,
        sabores: [
          "4 leites",
          "brigadeiro",
          "dois amores",
          "frutas (p\xEAssego e abacaxi)",
          "laka",
          "mineira",
          "prest\xEDgio",
          "porto alegre",
          "brigadeiro com maracuj\xE1"
        ]
      },
      {
        faixa: "B",
        preco: 49.9,
        sabores: [
          "bombom",
          "biz",
          "morango",
          "marta rocha"
        ]
      },
      {
        faixa: "C",
        preco: 55.9,
        sabores: [
          "0% lactose",
          "strogonoff de nozes"
        ]
      }
    ]
  },
  bolos_caseiros: {
    _nota: "Pre\xE7o por unidade (bolo inteiro caseiro).",
    itens: [
      {
        nome: "aipim",
        preco: 30.9
      },
      {
        nome: "banana caramelizada",
        preco: 30.9
      },
      {
        nome: "chocolate preto com leite ninho",
        preco: 30.9
      },
      {
        nome: "floresta negra",
        preco: 30.9
      },
      {
        nome: "formigueiro",
        preco: 30.9
      },
      {
        nome: "fub\xE1 com goiabada",
        preco: 30.9
      },
      {
        nome: "ingl\xEAs",
        preco: 33.9
      },
      {
        nome: "nega maluca",
        preco: 33.9
      },
      {
        nome: "prest\xEDgio com ganache",
        preco: 33.9
      },
      {
        nome: "red velvet",
        preco: 33.9
      },
      {
        nome: "cenoura",
        preco: 34.9
      },
      {
        nome: "churros",
        preco: 34.9
      },
      {
        nome: "laranja caramelizada",
        preco: 34.9
      },
      {
        nome: "caf\xE9",
        preco: 35.9
      },
      {
        nome: "lim\xE3o",
        preco: 35.9
      }
    ]
  },
  pizza: {
    _nota: "Forma 60x40cm. O rendimento (serve X pessoas) VEM DO CARD\xC1PIO DELA \u2014 est\xE1 impresso, n\xE3o \xE9 chute.",
    inteira: {
      preco: 120,
      serve: [
        6,
        8
      ],
      sabores_ate: 4
    },
    meia: {
      preco: 60,
      serve: [
        1,
        4
      ],
      sabores_ate: 2
    },
    _nota_sabores: "Lista igual a do PDF oficial de julho (5 PDFs em Desktop/docepao/MazyOS-main/dados/tabelas de produtos), conferida sabor a sabor em 19/08/2026: 21 salgadas e 10 doces. 'Bacon com brocolis' e um sabor PROPRIO, diferente de 'bacon' e de 'brocolis', e chegou a ser removido por engano quando o cardapio revisado de 16/08 nao o listou. A regra e copiar o cardapio dela, nao editar.",
    sabores_salgados: [
      "bacon",
      "bacon com milho",
      "bacon com br\xF3colis",
      "4 queijos",
      "fil\xE9 ao molho madeira com fritas",
      "fil\xE9 acebolado",
      "frango com catupiry",
      "alho e \xF3leo",
      "hot dog",
      "moda da casa",
      "lombinho",
      "lombinho com abacaxi",
      "br\xF3colis",
      "milho",
      "bolonhesa",
      "vegetariana",
      "strogonoff de frango",
      "strogonoff de gado",
      "calabresa",
      "calabresa acebolada",
      "portuguesa"
    ],
    sabores_doces: [
      "abacaxi com coco",
      "brigadeiro",
      "prest\xEDgio",
      "crocante",
      "calif\xF3rnia",
      "banana",
      "chocolate preto com morango",
      "chocolate branco com morango",
      "chocolate com confete",
      "banana com suspiro"
    ]
  },
  _por_quilo: "Bolos recheados, tortas, empad\xE3o, bolo salgado, p\xE3o franc\xEAs, p\xE3o doce, calzone, cachorro-quente, p\xE3o de X, pizza redonda e CUCA (recheada e sem recheio) s\xE3o POR QUILO: a qtd registrada \xE9 o PESO em kg (ex: 1.5) e o pre\xE7o aqui \xE9 por kg. Cupcake, franciscano e pizza de forma s\xE3o por unidade.",
  _preco_beneficente: "SO a equipe aplica, a IA nunca cota. Quando o cliente pede desconto, ajuda ou diz que e beneficente, o cachorro-quente e o pao de X saem POR UNIDADE: cachorro-quente R$ 1,20 e pao de X R$ 1,40 (audio WhatsApp 2026-08-11 11.02.24: 'quando a pessoa pedir um desconto, ou entao falar que e beneficente, ou ate pedir uma ajuda, a gente ja cobra unidade. O cachorro-quente, R$ 1,20 e o pao de X, R$ 1,40'). No mesmo audio a dona diz que quem negocia e a casa ('deixa eu ver a possibilidade de um desconto, eu ja te retorno'), entao esses valores ficam aqui como registro e o caso vai pro humano.",
  _topo_de_bolo: "Nao e produto do motor, e por isso nao esta na lista: o valor varia e a equipe orca. Referencia da dona (audio WhatsApp 2026-08-11 10.39.36): so o nome R$ 15 a 20, topo completo R$ 30, com flores ou muito dourado R$ 35 a 40; e no audio 11.02.22 (1) ela diz que '90% dos topos custa realmente 30 reais, mas tem as excecoes'. Em 16/08 (audio docepao16082 (3)) ela pediu pra publicar no cardapio 'valores do topo aproximado 30 reais'. A regra do audio 10.39.36 segue valendo: 'sempre tem que ter a confirmacao ou colocar que geralmente e 30 reais, mas a gente vai ter que pedir um orcamento antes'. Papel de arroz, esse sim, e fixo em R$ 12.",
  outros_produtos: [
    {
      nome: "torta fria",
      preco: 36.9,
      categoria: "torta_fria",
      unidade: "kg",
      sabores: [
        "frango",
        "legumes"
      ]
    },
    {
      nome: "torta fria com palmito",
      preco: 39.9,
      categoria: "torta_fria",
      unidade: "kg",
      sabores: [
        "palmito",
        "frango com palmito"
      ],
      _nota: "SIM, existe a versao frango com palmito, e ela custa o mesmo que a de palmito (audio DOCEPAORESPOSTASDONA (4): 'Uma torta de palmito, ou entao frango com palmito fica R$ 39,90 o quilo'). O que sobe o preco e o palmito, nao o frango."
    },
    {
      nome: "empadao",
      preco: 34.9,
      categoria: "empadao",
      unidade: "kg",
      sabores: [
        "frango",
        "frango com legumes"
      ]
    },
    {
      nome: "empadao com palmito",
      preco: 39.9,
      categoria: "empadao",
      unidade: "kg",
      sabores: [
        "palmito",
        "frango com palmito"
      ],
      _nota: "Existe frango com palmito, igual a torta fria. A dona disse: se ACRESCENTAR o palmito, vai ficar tambem R$ 39,90 (audio DOCEPAORESPOSTASDONA (5)). So palmito na lista fazia o guard de sabor recusar a venda de um dos produtos mais caros por quilo."
    },
    {
      nome: "torta doce",
      preco: 33.9,
      categoria: "torta_recheada",
      unidade: "kg",
      sabores: [
        "lim\xE3o",
        "morango",
        "bombom",
        "prest\xEDgio",
        "porto alegre"
      ]
    },
    {
      nome: "torta especial",
      preco: 49.9,
      categoria: "torta_recheada",
      unidade: "kg",
      sabores: [
        "oreo",
        "mousse de 4 leites",
        "mousse morango"
      ]
    },
    {
      nome: "bolo salgado",
      preco: 29.9,
      categoria: "bolo_salgado",
      unidade: "kg",
      sabores: [
        "frango",
        "presunto",
        "legumes"
      ]
    },
    {
      nome: "cupcake pequeno",
      preco: 2,
      categoria: "cupcake",
      unidade: "un",
      _nota: "2 a 3 cm, forminha de brigadeiro",
      sabores: [
        "4 leites",
        "brigadeiro"
      ]
    },
    {
      nome: "cupcake pequeno recheado",
      preco: 3,
      categoria: "cupcake",
      unidade: "un",
      sabores: [
        "4 leites",
        "brigadeiro"
      ]
    },
    {
      nome: "cupcake grande",
      preco: 5,
      categoria: "cupcake",
      unidade: "un",
      _nota: "5 a 6 cm"
    },
    {
      nome: "cupcake grande recheado",
      preco: 7,
      categoria: "cupcake",
      unidade: "un"
    },
    {
      nome: "franciscano",
      preco: 12,
      categoria: "franciscano",
      unidade: "un",
      sabores: [
        "calabresa",
        "bacon",
        "frango",
        "presunto e queijo",
        "salsicha com presunto e queijo",
        "salsicha presunto queijo e bacon",
        "s\xF3 bacon",
        "calabresa com bacon"
      ]
    },
    {
      nome: "calzone",
      preco: 41.9,
      categoria: "calzone",
      unidade: "kg",
      _nota: "sabores da pizza"
    },
    {
      nome: "pizza redonda",
      preco: 41.9,
      categoria: "pizza",
      unidade: "kg",
      _nota: "30 cm de diametro, o unico tamanho que a casa faz, vendida POR PESO a R$ 41,90 o quilo. Aceita SO DOIS sabores (a de forma aceita 4). NAO tem peso minimo: e montada e pesada na hora. Costuma dar entre 800 g e 1,2 kg, o que sai por R$ 35 a R$ 45. Fonte: audio da dona docepao1908 (1) e docepao19082 (2), 19/08/2026.",
      sabores_ate: 2,
      peso_minimo: null,
      peso_tipico_kg: [
        0.8,
        1.2
      ],
      valor_tipico: [
        35,
        45
      ]
    },
    {
      nome: "pao frances",
      preco: 11.99,
      categoria: "padaria",
      unidade: "kg"
    },
    {
      nome: "cachorro-quente mini",
      preco: 20.9,
      categoria: "padaria",
      unidade: "kg"
    },
    {
      nome: "cachorro-quente",
      preco: 19.9,
      categoria: "padaria",
      unidade: "kg",
      _nota: "medio e grande"
    },
    {
      nome: "pao de x",
      preco: 19.9,
      categoria: "padaria",
      unidade: "kg"
    },
    {
      nome: "cuca recheada",
      preco: 26.9,
      categoria: "padaria",
      unidade: "kg",
      sabores: [
        "chocolate",
        "doce de leite",
        "abacaxi",
        "vinho",
        "goiaba",
        "frutas vermelhas",
        "lim\xE3o"
      ],
      _nota: "vendida POR QUILO (dona confirmou em audio 16/08/2026; o cardapio impresso dizia unidade)"
    },
    {
      nome: "cuca",
      preco: 22.9,
      categoria: "padaria",
      unidade: "kg",
      _nota: "vendida POR QUILO (dona confirmou em audio 16/08/2026; o cardapio impresso dizia unidade)"
    },
    {
      nome: "pao doce",
      preco: 22.9,
      categoria: "padaria",
      unidade: "kg",
      _nota: "POR QUILO, igual a cuca. A dona citou o pao doce na mesma frase da cuca sem recheio e no mesmo valor (audio 2026-08-11 10.35.43 (2)), e depois corrigiu num audio so pra dizer que esse preco e o do QUILO (docepao1608 (4)). Estava como unidade, o que faria cada pao custar mais que um bolo caseiro inteiro."
    },
    {
      nome: "mini bolha doce",
      preco: 1.25,
      categoria: "salgado",
      unidade: "un",
      sabores: [
        "banana"
      ],
      _nota: "ENTRA no cardapio, confirmado no audio docepao16082 (2), 16/08/2026: 'se o cliente pedir, voce consegue fazer, por exemplo, pastel doce de banana. E uma coisa que a gente faz, so que a gente cobra 1,25. A gente ate nao tem no cardapio, mas da pra colocar (...) incluindo no cardapio tambem pasteis doce, pastel bolha doce'. E a mesma bolha frita, so que doce, e custa R$ 1,25 em vez de R$ 1,00. O cliente chama de 'pastel bolha doce' ou 'pastel doce'; o nome fica 'mini bolha doce' de proposito, pra casar com a familia da 'mini bolha' e nao roubar o pedido salgado no motor de preco (nome mais completo ganha: 'pastel bolha doce' fazia 'pastel bolha' virar o doce e cobrar R$ 0,25 a mais em cada um). O salgado continua sendo 'mini bolha' a R$ 1,00."
    },
    {
      nome: "papel de arroz",
      preco: 12,
      categoria: "adicional_bolo",
      unidade: "un",
      _nota: "Adicional do bolo decorado, valor fixo. Topo de bolo NAO entra aqui: valor varia, vai por precisa_confirmacao."
    }
  ],
  _minimo_por_sabor: {
    sugerir: 20,
    sabores_por_cento_sugeridos: 5,
    recusar: false,
    _nota: '"Num cento de salgados, o ideal e sempre 20, no minimo 20 unidades. Claro que se a cliente quiser 10 de cada, a gente abre uma excecao, e obvio. Mas assim, sempre sugerir." e "se a cliente falar 15, 15, 15, abre uma excecao, nao tem problema nenhum". Ou seja: SUGERIR 20 por sabor e 5 sabores no cento, e ACEITAR o que o cliente pedir. Nunca recusar quantidade menor. Fonte: audio da dona docepao1908 (2), 19/08/2026.'
  },
  _entrega: {
    sempre_pedir_humano: true,
    tem_aplicativo: false,
    _nota: '"e sempre pedir ajuda pro humano quando e entrega, e dai a gente responde" e "A gente nao tem aplicativo para Uber, nao tem aplicativo, a gente nao chama Uber, so em algumas ocasioes, mas ai sempre pedi ajuda para o humano". Depende do entregador e do dia: pra HOJE depende se ele consegue, um dia antes a casa tenta encaixar, e a janela da tarde e por volta das 14h30 as 16h30. A Dora NAO cota taxa e NAO promete entrega: chama a equipe. Fonte: audios da dona docepao19082 (1), (3) e (4), 19/08/2026.'
  }
};

// lib/ia/dados/rendimento.json
var rendimento_default = {
  _o_que_e: "Quanto de cada coisa serve por pessoa numa festa. \xC9 o cora\xE7\xE3o do or\xE7amento autom\xE1tico: cliente diz 'festa pra 50 pessoas' e o sistema sugere quantidade. TODOS os valores marcados 'confirmar:true' s\xE3o CHUTES do padr\xE3o de mercado \u2014 trocar pelos n\xFAmeros REAIS da dona quando ela responder.",
  _gancho_pra_perguntar: "No card\xE1pio de pizza dela J\xC1 EST\xC1 escrito: inteira serve 6-8, meia serve at\xE9 4. Ela j\xE1 sabe a conta. S\xF3 falta a mesma regra pra salgado, doce e bolo.",
  salgado_por_pessoa: {
    valor: 10,
    confirmar: false,
    nota: "Confirmado pela dona (audio 2026-07-30, cerebro-docepao-CONFIRMAR-DONA secao 4): 10 salgados por pessoa. Ex: 10 pessoas = 100 salgados + 50 docinhos."
  },
  doce_por_pessoa: {
    valor: 5,
    confirmar: false,
    nota: "Confirmado pela dona (audio 2026-07-30): 5 docinhos por pessoa, metade do salgado. Ex: 10 pessoas = 100 salgados + 50 docinhos."
  },
  bolo_recheado_serve: {
    valor: 10,
    confirmar: false,
    nota: "Confirmado pela dona: bolo e vendido POR QUILO e 1 quilo serve 10 pessoas (100g por pessoa). Aqui o valor 10 vira o divisor: pessoas/10 = kg de bolo sugerido."
  },
  pizza_inteira_serve: {
    valor: 7,
    confirmar: false,
    nota: "CONFIRMADO pelo card\xE1pio dela: inteira serve 6-8 pessoas. Uso a m\xE9dia (7)."
  },
  pizza_meia_serve: {
    valor: 4,
    confirmar: false,
    nota: "CONFIRMADO pelo card\xE1pio dela: meia serve at\xE9 4 pessoas."
  },
  regras_encomenda: {
    _nota: "Regras da opera\xE7\xE3o de encomenda. O que est\xE1 com 'confirmar:true' segue sem resposta da dona; o resto veio dela ou do card\xE1pio oficial.",
    salgado_vende_por_cento: {
      valor: true,
      confirmar: false,
      nota: "Confirmado pelo cardapio oficial: cento frito R$ 100,00, cento assado R$ 125,00. No cento da pra escolher ate 5 sabores, 20 de cada. O motor trabalha em UNIDADES, nunca multiplica preco por cento."
    },
    quantidade_minima_salgado: {
      valor: 0,
      confirmar: false,
      nota: "NAO EXISTE minimo de salgado por encomenda, por isso zero (o motor so aplica minimo quando o valor e maior que zero). O que a dona chama de minimo e por SABOR, dentro do cento (audio DOCEPAORESPOSTASDONA (8): 'num centro voce pode escolher cinco sabores, que a\xED seria ao minimo 20 de cada (...) Ou tambem, a gente deixa bem a criterio da pessoa'). O 100 que estava aqui era chute e empurrava a festa pequena pra um cento inteiro."
    },
    quantidade_minima_salgado_por_sabor: {
      valor: 20,
      confirmar: false,
      nota: "Confirmado pela dona (audio DOCEPAORESPOSTASDONA (8)): a cada 100 salgadinhos da pra escolher ate 5 sabores, 20 de cada. E orientacao, nao trava: ela mesma diz que deixa a criterio do cliente."
    },
    quantidade_minima_docinho_por_sabor: {
      valor: 20,
      confirmar: false,
      nota: "Confirmado pela dona (audio DOCEPAORESPOSTASDONA (2)): 'a quantidade minima (...) de docinho, seria no minimo 20 de cada'."
    },
    antecedencia_minima_dias: {
      valor: 0,
      confirmar: false,
      nota: "NAO existe prazo minimo pra salgado, docinho e torta: dependendo do dia a padaria faz pro MESMO DIA (dono, 19/08/2026). Zero significa que a IA nao anuncia prazo e nao recusa data nenhuma; ela confirma com a equipe. O unico prazo real e o do topo de bolo e papel de arroz, dois dias e no maximo ate sexta, porque vem de fornecedor."
    },
    prazo_alteracao_horas: {
      valor: 0,
      confirmar: false,
      nota: "Nao existe prazo fixo pra alterar ou cancelar pedido fechado: e sempre com a equipe (dono, 19/08/2026). A IA nunca promete que da pra mudar nem diz que nao da; passa pra equipe."
    },
    cobra_sinal: {
      valor: false,
      confirmar: false,
      nota: "Confirmado pela dona: nao cobra entrada. Se o cliente quiser adiantar, pode; pagamento em pix, cartao (ate 3x) ou dinheiro na retirada."
    },
    percentual_sinal: {
      valor: 0,
      confirmar: false,
      nota: "Nao se aplica: a padaria nao cobra sinal."
    }
  },
  funcionamento: {
    _nota: "Confirmado pelo cardapio oficial e pelo cerebro da dona. Formato: dia -> lista de faixas [abre, fecha] em HH:MM (domingo tem duas), ou null se fechado. Feriado segue o domingo.",
    confirmar: false,
    horarios: {
      seg: [
        [
          "06:30",
          "20:00"
        ]
      ],
      ter: [
        [
          "06:30",
          "20:00"
        ]
      ],
      qua: [
        [
          "06:30",
          "20:00"
        ]
      ],
      qui: [
        [
          "06:30",
          "20:00"
        ]
      ],
      sex: [
        [
          "06:30",
          "20:00"
        ]
      ],
      sab: [
        [
          "06:30",
          "20:00"
        ]
      ],
      dom: [
        [
          "06:30",
          "12:00"
        ],
        [
          "16:00",
          "20:00"
        ]
      ]
    }
  }
};

// lib/ia/orcamento.ts
function citadoDeVerdade(texto, termo) {
  const t = String(texto || "").toLowerCase();
  const alvo = termo.toLowerCase();
  let de = t.indexOf(alvo);
  while (de >= 0) {
    const antes = t.slice(Math.max(0, de - 22), de);
    if (!/(sem|nao quer|não quer|nada de|tirar o|tira o|nem)\s+[a-zà-ú ]{0,12}$/.test(antes)) return true;
    de = t.indexOf(alvo, de + alvo.length);
  }
  return false;
}
var brl = (n) => "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
function criarMotor(produtos, rend = {}) {
  const semPlural = (t) => t.replace(/(oes|aes|ais|eis|res|zes|ns|es|s)$/, "");
  const distancia = (a, b) => {
    if (Math.abs(a.length - b.length) > 3) return 99;
    const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let anterior = linha[0];
      linha[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const guardado = linha[j];
        linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
        anterior = guardado;
      }
    }
    return linha[b.length];
  };
  const semAcento = (t) => String(t).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const PRECOS = {};
  for (const p of produtos) PRECOS[semAcento(p.nome)] = p;
  const primeiroDaCategoria = (cat) => produtos.find((p) => p.categoria.toLowerCase().startsWith(cat));
  const unidade = rend.unidadePorProduto && rend.unidadePorProduto > 0 ? rend.unidadePorProduto : 1;
  const norm = (s) => semAcento(s);
  const MARCA_DE_BOLO = /p[ãa]o de l[óo]|topo d|papel de arroz|aniversariante|prato aberto|caixa com tampa|andar/i;
  const SABORES_BOLO = produtos.filter((p) => p.categoria === "bolo_recheado" && norm(p.nome).startsWith("bolo ") && !norm(p.nome).startsWith("bolo recheado ")).flatMap((p) => {
    const sabor = norm(p.nome).slice(5);
    const ultima = (sabor.split(" ").pop() || "").replace(/[^a-zà-ú0-9]/g, "");
    const lista = [{ sabor, produto: p }];
    if (ultima.length > 3 && ultima !== sabor) lista.push({ sabor: ultima, produto: p });
    return lista;
  }).filter((x) => x.sabor.length > 3).sort((a, b) => b.produto.preco - a.produto.preco);
  function saborMaisCaro(texto) {
    const t = norm(texto);
    const achados = SABORES_BOLO.filter((x) => t.includes(x.sabor));
    if (achados.length < 2) return void 0;
    return achados[0].produto;
  }
  function cotarPorItens2(pedido) {
    const linhas = [];
    const avisos = [];
    let total = 0;
    for (const { item, qtd, obs } of pedido) {
      const chave = norm(item).replace(/^bolo (de |do |da )/, "bolo ").replace(/^torta (de |do |da )/, "torta ").replace(/ recheado$| de festa$| de anivers[áa]rio$/, "");
      if (obs && MARCA_DE_BOLO.test(obs) && !chave.startsWith("bolo")) {
        const comoBolo = PRECOS[norm("bolo " + item)] ?? produtos.find((p) => p.categoria === "bolo" && norm(p.nome).includes(chave));
        if (comoBolo) {
          const q0 = Number(qtd) || 0;
          const sub0 = comoBolo.preco * q0;
          total += sub0;
          linhas.push({
            item: comoBolo.nome,
            categoria: comoBolo.categoria,
            qtd: q0,
            unit: comoBolo.preco,
            subtotal: sub0,
            obs: obs || void 0,
            unidade: comoBolo.unidade ?? "kg"
          });
          avisos.push(`"${item}" foi cotado como ${comoBolo.nome} (a observa\xE7\xE3o \xE9 de bolo de festa).`);
          continue;
        }
      }
      let ref = PRECOS[chave];
      if (!ref) {
        const ehBolo = /^bolo\b/.test(chave);
        const universo = ehBolo ? produtos.filter((p) => /^bolo\b/.test(norm(p.nome))) : produtos;
        const nivelDoCasamento = (p) => {
          const pn = norm(p.nome);
          if (pn.includes(chave) || chave.includes(pn)) return 2;
          const ultima = pn.split(" ").pop() || "";
          if (ultima.length > 3 && chave.includes(ultima)) return 3;
          return 99;
        };
        const candidatos = universo.map((p) => ({ p, nivel: nivelDoCasamento(p) })).filter((c) => c.nivel < 99).sort((a, b) => a.nivel - b.nivel || norm(b.p.nome).length - norm(a.p.nome).length);
        ref = candidatos[0]?.p;
      }
      if (!ref) {
        const ehBolo2 = /^bolo\b/.test(chave);
        const universo2 = ehBolo2 ? produtos.filter((x) => /^bolo\b/.test(norm(x.nome))) : produtos;
        const alvo = semPlural(chave);
        let melhor = null;
        let empate = false;
        for (const cand of universo2) {
          const nomeCand = semPlural(norm(cand.nome));
          const partes = nomeCand.split(" ").filter((x) => x.length > 3);
          const d = Math.min(distancia(alvo, nomeCand), ...partes.map((x) => distancia(alvo, x)), 99);
          if (d > 2) continue;
          if (!melhor || d < melhor.d) {
            melhor = { p: cand, d };
            empate = false;
          } else if (d === melhor.d && cand.nome !== melhor.p.nome) {
            empate = true;
          }
        }
        if (melhor && !empate) {
          ref = melhor.p;
          if (semPlural(norm(melhor.p.nome)) !== alvo) {
            avisos.push(`"${item}" foi cotado como ${melhor.p.nome}.`);
          }
        }
      }
      if (!ref) {
        avisos.push(`N\xE3o achei "${item}" no card\xE1pio, conferir com a equipe.`);
        continue;
      }
      if (ref.categoria === "bolo_recheado") {
        const caro = saborMaisCaro(chave + " " + (obs ?? ""));
        if (caro && caro.preco > ref.preco) {
          const outro = caro.nome.replace(/^bolo /, "");
          avisos.push(`Bolo com mais de um sabor: cobrei pelo mais caro (${outro}).`);
          const nome = chave.includes(outro) ? ref.nome : `${ref.nome} com ${outro}`;
          ref = { ...caro, nome };
        }
      }
      const q = Number(qtd) || 0;
      const subtotal = ref.preco * q;
      total += subtotal;
      linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: q, unit: ref.preco, subtotal, obs: obs || void 0, unidade: ref.unidade ?? "un" });
    }
    const citaPapel = linhas.some((l) => citadoDeVerdade(String(l.obs ?? ""), "papel de arroz"));
    const temPapel = linhas.some((l) => /papel de arroz/i.test(l.item));
    if (citaPapel && !temPapel) {
      const ref = PRECOS[norm("papel de arroz")] ?? produtos.find((p) => norm(p.nome).includes("papel de arroz"));
      if (ref) {
        total += ref.preco;
        linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: 1, unit: ref.preco, subtotal: ref.preco, unidade: "un" });
        avisos.push("Papel de arroz estava s\xF3 na observa\xE7\xE3o; lancei como item pra entrar no total.");
      }
    }
    return { linhas, avisos, total };
  }
  function sugerirPorPessoas2(pessoas, quer = { salgado: true, doce: true }) {
    const n = Number(pessoas) || 0;
    const pedido = [];
    const notas = [];
    let estimativa = false;
    if (quer.salgado && rend.salgadoPorPessoa) {
      const prod = primeiroDaCategoria("salgado");
      if (prod) {
        let unidades = Math.round(n * rend.salgadoPorPessoa);
        if (rend.minSalgado && unidades < rend.minSalgado) {
          unidades = rend.minSalgado;
          notas.push(`Salgado ajustado pro m\xEDnimo de ${rend.minSalgado}.`);
        }
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.doce && rend.docePorPessoa) {
      const prod = primeiroDaCategoria("doce");
      if (prod) {
        const unidades = Math.round(n * rend.docePorPessoa);
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.bolo && rend.boloServe) {
      const prod = primeiroDaCategoria("bolo");
      if (prod) {
        const qtd = prod.unidade === "kg" ? Math.max(0.5, Math.round(n / rend.boloServe * 10) / 10) : Math.max(1, Math.ceil(n / rend.boloServe));
        pedido.push({ item: prod.nome, qtd });
        estimativa = true;
      }
    }
    const cotacao = cotarPorItens2(pedido);
    return { pessoas: n, estimativa, notas, ...cotacao };
  }
  function cardapioResumo2() {
    const porCat = {};
    for (const p of produtos) {
      (porCat[p.categoria] ||= []).push(`${p.nome} ${brl(p.preco)}`);
    }
    return Object.entries(porCat).map(([cat, itens]) => `${cat}: ${itens.join(", ")}`).join("\n");
  }
  return { cotarPorItens: cotarPorItens2, sugerirPorPessoas: sugerirPorPessoas2, cardapioResumo: cardapioResumo2 };
}
function formatarOrcamento(c, titulo = "Or\xE7amento", paraOCliente = false) {
  const L = [];
  L.push(titulo);
  L.push("".padEnd(28, "."));
  for (const l of c.linhas) {
    const q = (l.unidade ?? "un") === "kg" ? `${String(l.qtd).replace(".", ",")} kg` : `${l.qtd}x`;
    const detalhe = paraOCliente && l.obs ? ` (${String(l.obs).trim()})` : "";
    L.push(`${q} ${l.item}${detalhe}: ${brl(l.subtotal)}`);
  }
  L.push("".padEnd(28, "."));
  L.push(`*Total: ${brl(c.total)}*`);
  if (c.estimativa) L.push("\nEssa quantidade \xE9 uma sugest\xE3o pro tamanho da festa. Se quiser mais ou menos de algo, \xE9 s\xF3 falar.");
  if (!paraOCliente && c.avisos?.length) L.push("\n" + c.avisos.join("\n"));
  return L.join("\n");
}
function produtosDoCatalogo() {
  const p = [];
  p.push({ nome: "salgado frito", preco: catalogo_default.salgados.frito.preco, categoria: "salgado" });
  p.push({ nome: "salgado assado", preco: catalogo_default.salgados.assado.preco, categoria: "salgado" });
  for (const it of catalogo_default.salgados.frito.itens)
    p.push({ nome: it.nome, preco: catalogo_default.salgados.frito.preco, categoria: "salgado" });
  for (const it of catalogo_default.salgados.assado.itens)
    p.push({ nome: it.nome, preco: catalogo_default.salgados.assado.preco, categoria: "salgado" });
  for (const d of catalogo_default.doces.itens) p.push({ nome: d.nome, preco: d.preco, categoria: "doce" });
  for (const f of catalogo_default.bolos_recheados.faixas) {
    p.push({ nome: "bolo recheado " + f.faixa.toLowerCase(), preco: f.preco, categoria: "bolo_recheado", unidade: "kg" });
    for (const s of f.sabores) p.push({ nome: "bolo " + s, preco: f.preco, categoria: "bolo_recheado", unidade: "kg" });
  }
  for (const b of catalogo_default.bolos_caseiros.itens)
    p.push({ nome: "bolo caseiro " + b.nome, preco: b.preco, categoria: "bolo_caseiro" });
  p.push({ nome: "pizza inteira", preco: catalogo_default.pizza.inteira.preco, categoria: "pizza" });
  p.push({ nome: "pizza meia", preco: catalogo_default.pizza.meia.preco, categoria: "pizza" });
  for (const s of [
    ...catalogo_default.pizza.sabores_salgados ?? [],
    ...catalogo_default.pizza.sabores_doces ?? []
  ]) {
    p.push({ nome: "pizza inteira " + String(s).toLowerCase(), preco: catalogo_default.pizza.inteira.preco, categoria: "pizza" });
    p.push({ nome: "pizza meia " + String(s).toLowerCase(), preco: catalogo_default.pizza.meia.preco, categoria: "pizza" });
  }
  for (const o of catalogo_default.outros_produtos) {
    p.push({ nome: o.nome, preco: o.preco, categoria: o.categoria, unidade: o.unidade });
  }
  return p;
}
var rendimentoPadrao = {
  salgadoPorPessoa: rendimento_default.salgado_por_pessoa?.valor,
  docePorPessoa: rendimento_default.doce_por_pessoa?.valor,
  boloServe: rendimento_default.bolo_recheado_serve?.valor,
  unidadePorProduto: 1,
  minSalgado: rendimento_default.regras_encomenda?.quantidade_minima_salgado?.valor,
  confirmar: true
};
var motorPadrao = criarMotor(produtosDoCatalogo(), rendimentoPadrao);
var cotarPorItens = motorPadrao.cotarPorItens;
var sugerirPorPessoas = motorPadrao.sugerirPorPessoas;
var cardapioResumo = motorPadrao.cardapioResumo;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  brl,
  cardapioResumo,
  citadoDeVerdade,
  cotarPorItens,
  criarMotor,
  formatarOrcamento,
  motorPadrao,
  sugerirPorPessoas
});
