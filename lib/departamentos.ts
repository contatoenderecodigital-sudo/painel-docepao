// ============================================================================
//  ESTACOES de producao da padaria. Cada equipe produz separado e so quer ver
//  o que ELA precisa fazer. Mapeia item -> estacao, define a unidade que sai
//  escrita no ticket e agrega o dia.
//
//  As estacoes sao as que o dono usa na bancada: BOLO FESTA, DOCINHOS,
//  SALGADOS. O ticket do CAIXA (com o total) e montado no cupom, nao aqui.
// ============================================================================

import type { Pedido } from "./tipos";

export type DeptoId = "salgados" | "confeitaria" | "bolos";

export type Departamento = {
  id: DeptoId;
  nome: string;
  cor: string; // acento cheio (fundo de icone, header) - usar com texto claro
  corClara: string; // tom claro pra TEXTO/icone sobre fundo escuro (legivel)
};

export const DEPARTAMENTOS: Departamento[] = [
  { id: "salgados", nome: "Salgados", cor: "#c46a1e", corClara: "#e59355" },
  { id: "confeitaria", nome: "Docinhos", cor: "#c65f7a", corClara: "#e58fa6" },
  { id: "bolos", nome: "Bolo Festa", cor: "#a06a3c", corClara: "#cf9a68" },
];

export function deptoInfo(id: DeptoId): Departamento {
  return DEPARTAMENTOS.find((d) => d.id === id) ?? DEPARTAMENTOS[0];
}

// Sem acento e em minuscula. O mesmo produto chega escrito de tres jeitos
// ("risoles", "risóles", "Pão Francês") e a estacao nao pode mudar por causa
// do acento.
function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// SALGADO E SALGADO, VENHA POR UNIDADE OU POR QUILO.
//
// A categoria gravada em pedido_itens e a do catalogo (lib/ia/orcamento.ts):
// "salgado", "pizza", "calzone", "empadao", "torta_fria", "bolo_salgado",
// "franciscano", "padaria". A torta fria com palmito de 2 kg caia nos docinhos
// porque o nome tem "torta", e o bolo salgado caia no bolo de festa porque o
// nome comeca com "bolo": duas encomendas salgadas indo pra bancada do acucar.
const SALGADO_CATEGORIA = new Set([
  "salgado",
  "salgado_frito",
  "salgado_assado",
  "pizza",
  "calzone",
  "empadao",
  "torta_fria",
  "bolo_salgado",
  "franciscano",
]);
// Pelo nome, pra quando a categoria vier vazia ou fora do catalogo. "pao
// frances", "pao de x" e "cachorro" sao a parte SALGADA da categoria "padaria",
// que tambem guarda cuca e pao doce (esses sao doce, caem no fallback).
const SALGADO_NOME =
  /coxinha|risol|pastel|esfir|esfih|empad|croissant|croquete|enroladinho|bolinha|mini bolha|kibe|quibe|salgad|pizza|calzone|cachorro|pao frances|pao de x|pao de queijo|torta fria|torta salgada|franciscano|cento/;

// De qual estacao um item sai (usa a categoria; cai pro nome do produto).
export function deptoDe(item: { categoria?: string | null; produto: string }): DeptoId {
  const c = norm(item.categoria);
  const p = norm(item.produto);
  // Salgado PRIMEIRO: e o unico jeito de "bolo salgado" e "torta fria" nao
  // serem sequestrados pelas regras de bolo e de doce logo abaixo.
  if (SALGADO_CATEGORIA.has(c) || SALGADO_NOME.test(p)) return "salgados";
  // Acessorio de bolo e da estacao de BOLO FESTA. O papel de arroz tem
  // categoria "adicional_bolo", que nao comeca com "bolo", e por isso caia na
  // padaria: saia um cupom inteiro so pro papel de arroz, na estacao errada, e
  // quem faz o bolo nao via que tinha papel de arroz nele.
  if (
    c.includes("bolo") ||
    c === "extra" ||
    /^bolo\b/.test(p) ||
    p.includes("papel de arroz") ||
    p.includes("topo de bolo")
  )
    return "bolos";
  // Sobrou doce: docinho, cupcake, torta doce, cuca, pao doce. Tudo dos
  // DOCINHOS, que e a bancada da confeitaria.
  return "confeitaria";
}

// PESO NAO E PECA.
//
// O bolo de 3 kg gravado sem unidade saia no ticket como "3x BOLO BRIGADEIRO" e
// a cozinha assava TRES bolos. A coluna `unidade` pode vir nula (linha antiga,
// pedido editado na mao) e o painel a lia como "un", entao aqui o peso e
// reconstituido: pela familia do produto, que e por quilo por definicao, e pela
// quantidade quebrada, porque 1,5 coxinha nao existe.
const KG_POR_NATUREZA = new Set([
  "bolo_recheado",
  "bolo_festa",
  "por_quilo",
  "torta_fria",
  "torta_recheada",
  "empadao",
  "calzone",
  "bolo_salgado",
]);
const KG_POR_NOME = /cachorro|pao frances|pao de x|pizza redonda|torta fria|torta salgada|empadao/;

export function unidadeDoItem(item: {
  categoria?: string | null;
  produto: string;
  qtd: number;
  unidade?: string | null;
}): "un" | "kg" {
  if (item.unidade === "kg") return "kg";
  const c = norm(item.categoria);
  if (KG_POR_NATUREZA.has(c)) return "kg";
  if (KG_POR_NOME.test(norm(item.produto))) return "kg";
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

// Soma consolidada de todos os itens do dia, por departamento.
export function agregarPorDepto(pedidos: Pedido[]): Record<DeptoId, ItemAgregado[]> {
  // Guarda a unidade junto: bolo e por quilo, e a cozinha lendo "3 bolo" entende
  // tres bolos em vez de um de tres quilos.
  const unidades = new Map<string, string>();
  // As horas de retirada de cada produto: e o que diz o que sai do forno primeiro.
  const horas = new Map<string, Set<string>>();
  const mapas: Record<DeptoId, Map<string, number>> = {
    salgados: new Map(),
    confeitaria: new Map(),
    bolos: new Map(),
  };
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
  for (const id of Object.keys(mapas) as DeptoId[]) {
    out[id] = [...mapas[id].entries()]
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

// Quais departamentos um pedido envolve (pra tags no card).
export function deptosDoPedido(ped: Pedido): DeptoId[] {
  const s = new Set<DeptoId>();
  for (const it of ped.itens) s.add(deptoDe(it));
  return DEPARTAMENTOS.map((d) => d.id).filter((id) => s.has(id));
}
