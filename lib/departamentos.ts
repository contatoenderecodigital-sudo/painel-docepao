// ============================================================================
//  COMANDAS DA PRODUÇÃO.
//
//  A regra é da dona, e ela explicou nos áudios por que é assim:
//
//    "Tudo vai ficar separado por segmentos. Empadão é uma coisa, torta doce é
//     outra coisa, torta recheada é outra coisa. É tudo separado."
//
//  O motivo não é organização, é PRODUÇÃO em etapas:
//
//    "Os docinhos é uma coisa que eu posso fazer cinco horas antes, não vai ter
//     problema. Mas daí o salgado eu tenho que preparar no momento, tipo 15
//     minutos antes da pessoa chegar."
//
//  E cada comanda avisa o que mais o cliente pediu, porque já deu errado:
//
//    "A Apoliana pegou um pedido que tinha tudo junto, e daí a outra não viu no
//     mural que tinha um pedaço de torta."
//
//  Por isso NÃO são três bancadas. São treze segmentos, um por tipo de produto.
//  Também não é pra escrever o nome do setor no papel: "não precisa colocar
//  salgadeiro, padeiro, confeiteiro, porque vai tudo pra mesma sala".
// ============================================================================

import type { Pedido } from "./tipos";
import { produtoPorNome } from "./ia/dados/produtos";

export type DeptoId =
  | "salgados"
  | "docinhos"
  | "bolo_festa"
  | "bolo_caseiro"
  | "bolo_salgado"
  | "torta_fria"
  | "torta_doce"
  | "empadao"
  | "pizza"
  | "calzone"
  | "cupcake"
  | "franciscano"
  | "padaria";

export type Departamento = {
  id: DeptoId;
  nome: string;
  cor: string; // acento cheio (fundo de icone, header) - usar com texto claro
  corClara: string; // tom claro pra TEXTO/icone sobre fundo escuro (legivel)
};

// A ordem é a da produção: o que se faz com antecedência primeiro, o que sai na
// hora por último. É a ordem em que a equipe olha o mural.
export const DEPARTAMENTOS: Departamento[] = [
  { id: "docinhos", nome: "Docinhos", cor: "#c65f7a", corClara: "#e58fa6" },
  { id: "bolo_festa", nome: "Bolo Festa", cor: "#a06a3c", corClara: "#cf9a68" },
  { id: "bolo_caseiro", nome: "Bolo Caseiro", cor: "#8a6a45", corClara: "#c2a077" },
  { id: "cupcake", nome: "Cupcake", cor: "#b06590", corClara: "#d69cbc" },
  { id: "torta_doce", nome: "Torta Doce", cor: "#a85b85", corClara: "#d093b2" },
  { id: "torta_fria", nome: "Torta Fria", cor: "#5f8c9e", corClara: "#93bccd" },
  { id: "empadao", nome: "Empadão", cor: "#8a7c33", corClara: "#c2b56b" },
  { id: "bolo_salgado", nome: "Bolo Salgado", cor: "#7d7a4a", corClara: "#b6b285" },
  { id: "pizza", nome: "Pizza", cor: "#b2472f", corClara: "#dd8871" },
  { id: "calzone", nome: "Calzone", cor: "#9c5a3c", corClara: "#cf9276" },
  { id: "franciscano", nome: "Franciscano", cor: "#6f7a52", corClara: "#a7b28c" },
  { id: "padaria", nome: "Pães e Cucas", cor: "#8a6f2f", corClara: "#c4a869" },
  { id: "salgados", nome: "Salgados", cor: "#c46a1e", corClara: "#e59355" },
];

export function deptoInfo(id: DeptoId): Departamento {
  return DEPARTAMENTOS.find((d) => d.id === id) ?? DEPARTAMENTOS[DEPARTAMENTOS.length - 1];
}

export function nomeDaComanda(id: DeptoId): string {
  return deptoInfo(id).nome.toUpperCase();
}

// Sem acento e em minuscula. O mesmo produto chega escrito de tres jeitos
// ("risoles", "risóles", "Pão Francês") e a comanda nao pode mudar por causa
// do acento.
function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// A categoria gravada em pedido_itens vem de dois vocabularios: o do catalogo
// (lib/ia/orcamento.ts) e o da ferramenta da IA e da tela. Sao os mesmos
// produtos escritos de outro jeito, e sem as duas listas todo pedido corrigido
// pela equipe caia numa comanda generica.
const POR_CATEGORIA: Record<string, DeptoId> = {
  // vocabulario do catalogo
  salgado: "salgados",
  doce: "docinhos",
  bolo_recheado: "bolo_festa",
  bolo_caseiro: "bolo_caseiro",
  pizza: "pizza",
  torta_fria: "torta_fria",
  empadao: "empadao",
  torta_recheada: "torta_doce",
  bolo_salgado: "bolo_salgado",
  cupcake: "cupcake",
  franciscano: "franciscano",
  calzone: "calzone",
  padaria: "padaria",
  adicional_bolo: "bolo_festa",
  // vocabulario da ferramenta da IA e da tela
  salgado_frito: "salgados",
  salgado_assado: "salgados",
  docinho: "docinhos",
  bolo_festa: "bolo_festa",
  papel_de_arroz: "bolo_festa",
  // "por_quilo" e "por_unidade" nao dizem QUAL produto e: quem decide ali e o
  // nome, na lista abaixo.
};

// Acompanhamento de bolo sai NA COMANDA DO BOLO, nunca solto: topo, papel de
// arroz, vela, prato e caixa sao coisas que quem monta o bolo le junto com ele.
const ACESSORIO_DE_BOLO = /topo de bolo|topo|papel de arroz|vela|prato aberto|caixa com tampa|andar/;

// Quando a categoria e generica, quem diz a comanda e o nome do produto: torta
// fria e empadao sao produzidos em mesas diferentes, mesmo os dois sendo
// vendidos por quilo.
const POR_NOME: [RegExp, DeptoId][] = [
  [/torta fria|torta salgada/, "torta_fria"],
  [/empad[ao]o/, "empadao"],
  [/torta (doce|especial)/, "torta_doce"],
  [/bolo salgado/, "bolo_salgado"],
  [/calzone/, "calzone"],
  [/pizza/, "pizza"],
  [/cupcake/, "cupcake"],
  [/franciscano/, "franciscano"],
  [/cuca|pao doce|pao frances|pao de x|cachorro-?quente|bisnaguinha/, "padaria"],
  [/^bolo (caseiro|de cenoura|de fuba|simples|seco)/, "bolo_caseiro"],
  [/^bolo/, "bolo_festa"],
  // Salgadinho de festa por ultimo: e a lista mais generica e sequestraria
  // "torta fria" e "bolo salgado" se viesse antes.
  [
    /coxinha|risol|pastel|esfir|esfih|empadinha|croissant|croquete|enroladinho|bolinha|mini bolha|kibe|quibe|salgad|almofadinha|xodo|quiche|mini x|mini sandu|pao de batata|salsicha/,
    "salgados",
  ],
];

// De qual comanda um item sai.
export function deptoDe(item: { categoria?: string | null; produto: string }): DeptoId {
  const c = norm(item.categoria);
  const p = norm(item.produto);
  const porCategoria = POR_CATEGORIA[c];
  if (porCategoria) return porCategoria;
  for (const [rx, id] of POR_NOME) if (rx.test(p)) return id;
  if (ACESSORIO_DE_BOLO.test(p)) return "bolo_festa";
  // Sobrou doce sem categoria conhecida: vai pros docinhos, que e a bancada que
  // mais recebe item novo.
  return "docinhos";
}

// PESO NAO E PECA.
//
// O bolo de 3 kg gravado sem unidade saia no ticket como "3x BOLO BRIGADEIRO" e
// a cozinha assava TRES bolos. A coluna `unidade` pode vir nula (linha antiga,
// pedido editado na mao), entao aqui o peso e reconstituido: pela familia do
// produto, que e por quilo por definicao, e pela quantidade quebrada, porque
// 1,5 coxinha nao existe.
// O CATALOGO DECIDE, E O RESTO E REDE EMBAIXO.
//
// A coluna `unidade` pode vir nula (linha antiga, pedido editado na mao), e o
// bolo de 3 kg gravado assim saia no ticket como "3x BOLO BRIGADEIRO": a cozinha
// assava TRES bolos.
//
// A reconstituicao existia, e ela chutava pela CATEGORIA e por uma lista de
// NOMES escrita a mao. Medido em 28/08/2026, com o item chegando sem unidade:
//
//     17 dos 86 produtos saiam com a unidade errada
//     os 15 bolos caseiros e as duas pizzas, todos `un` no cardapio, viravam kg
//
// A causa era o conjunto abaixo listar `bolo_caseiro` e `pizza` como "por quilo
// por natureza", e eles nao sao: o caseiro se vende por unidade (R$ 30,90 a
// R$ 35,90 cada) e a pizza tambem.
//
// Nao estava dando prejuizo, e vale dizer por que: hoje toda linha gravada tem
// unidade, e conferi no banco. A defesa e que estava errada.
//
// Agora quem responde primeiro e o cardapio, pelo nome do produto. As duas
// camadas abaixo ficam pro que o cardapio nao conhece: o pedido corrigido na
// mao com um nome que nao existe, e a quantidade quebrada, porque 1,5 coxinha
// nao existe.
//
// O CONJUNTO DE CATEGORIAS FICA, e mistura DOIS vocabularios de proposito:
// `bolo_recheado` e do orcamento e e o que esta gravado nas linhas do banco;
// `bolo_festa` e do pedido. Os dois chegam aqui.
const KG_POR_NATUREZA = new Set([
  "bolo_recheado",
  "bolo_festa",
  "por_quilo",
  "torta_fria",
  "torta_recheada",
  "empadao",
  "calzone",
  "bolo_salgado",
  "padaria",
]);

export function unidadeDoItem(item: {
  categoria?: string | null;
  produto: string;
  qtd: number;
  unidade?: string | null;
}): "un" | "kg" {
  if (item.unidade === "kg") return "kg";
  if (item.unidade === "un") return "un";

  // O CARDAPIO RESPONDE, MAS SO NO CASAMENTO EXATO.
  //
  // A primeira versao disto perguntava com `produtoNoComeco`, que casa pelo
  // COMECO do nome, e o teste `todo-produto-funciona` pegou na hora:
  //
  //   "bolo prestigio com ganache"  comeca com "bolo prestigio"
  //   e "bolo prestigio" e o bolo de FESTA, vendido por quilo
  //
  // O caseiro saiu em kg no papel. E o mesmo tropeco que o `produtos.ts` avisa
  // no comentario do `produtoNoComeco`: "bolo caseiro prestigio com ganache tem
  // que ganhar de bolo caseiro prestigio, que nem existe mas quase casou uma
  // vez".
  //
  // Aqui nao se pode chutar: o nome ja passou pelo resolvedor antes de virar
  // linha do pedido, entao se ele nao bate EXATO com o cardapio, quem responde
  // sao as duas camadas de baixo.
  const daCasa = produtoPorNome(String(item.produto ?? ""));
  if (daCasa) return daCasa.unidade;

  const c = norm(item.categoria);
  if (KG_POR_NATUREZA.has(c)) return "kg";
  if (!Number.isInteger(Number(item.qtd))) return "kg";
  return "un";
}

// Como a quantidade sai escrita no ticket e na tela: "1,5 kg" pro que e pesado,
// "67 un" pro que e contado. Nunca a unidade do outro.
export function qtdDoTicket(item: {
  categoria?: string | null;
  produto: string;
  qtd: number;
  unidade?: string | null;
}): string {
  const numero = String(item.qtd).replace(".", ",");
  return `${numero} ${unidadeDoItem(item)}`;
}

export type ItemAgregado = { produto: string; qtd: number; unidade?: string; horas?: string[] };

// Soma consolidada de todos os itens do dia, por comanda.
export function agregarPorDepto(pedidos: Pedido[]): Record<DeptoId, ItemAgregado[]> {
  const unidades = new Map<string, string>();
  const horas = new Map<string, Set<string>>();
  const mapas = {} as Record<DeptoId, Map<string, number>>;
  for (const d of DEPARTAMENTOS) mapas[d.id] = new Map();

  for (const ped of pedidos) {
    for (const it of ped.itens) {
      const d = deptoDe(it);
      mapas[d].set(it.produto, (mapas[d].get(it.produto) || 0) + it.qtd);
      unidades.set(it.produto, unidadeDoItem(it));
      const h = String(ped.retiradaHora ?? "").trim();
      if (h) {
        const jaTem = horas.get(it.produto) ?? new Set<string>();
        jaTem.add(h);
        horas.set(it.produto, jaTem);
      }
    }
  }

  const out = {} as Record<DeptoId, ItemAgregado[]>;
  for (const d of DEPARTAMENTOS) {
    out[d.id] = [...mapas[d.id].entries()]
      .map(([produto, qtd]) => ({
        produto,
        qtd,
        unidade: unidades.get(produto),
        horas: [...(horas.get(produto) ?? [])].sort(),
      }))
      .sort((a, b) => b.qtd - a.qtd);
  }
  return out;
}

// Quais comandas um pedido gera (pra tags no card e pra referencia cruzada).
export function deptosDoPedido(ped: Pedido): DeptoId[] {
  const s = new Set<DeptoId>();
  for (const it of ped.itens) s.add(deptoDe(it));
  return DEPARTAMENTOS.map((d) => d.id).filter((id) => s.has(id));
}
