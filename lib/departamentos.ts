// ============================================================================
//  DEPARTAMENTOS de producao da padaria. Cada equipe produz separado e so
//  quer ver o que ELA precisa fazer. Mapeia item -> estacao e agrega o dia.
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
  { id: "confeitaria", nome: "Confeitaria", cor: "#c65f7a", corClara: "#e58fa6" },
  { id: "bolos", nome: "Bolos", cor: "#a06a3c", corClara: "#cf9a68" },
];

export function deptoInfo(id: DeptoId): Departamento {
  return DEPARTAMENTOS.find((d) => d.id === id) ?? DEPARTAMENTOS[0];
}

// De qual estacao um item sai (usa a categoria; cai pro nome do produto).
export function deptoDe(item: { categoria?: string; produto: string }): DeptoId {
  const c = (item.categoria || "").toLowerCase();
  const p = item.produto.toLowerCase();
  // Acessorio de bolo e da estacao de BOLOS. O papel de arroz tem categoria
  // "adicional_bolo", que nao comeca com "bolo", e por isso caia na padaria:
  // saia um cupom inteiro so pro papel de arroz, na estacao errada, e quem faz
  // o bolo nao via que tinha papel de arroz nele.
  if (c.includes("bolo") || p.includes("bolo") || p.includes("papel de arroz") || c === "extra") return "bolos";
  if (
    c.startsWith("doce") ||
    p.includes("brigadeiro") ||
    p.includes("trufa") ||
    p.includes("cheesecake") ||
    p.includes("torta") ||
    p.includes("docinho")
  )
    return "confeitaria";
  if (
    c.startsWith("salgado") ||
    c === "pizza" ||
    p.includes("salgado") ||
    p.includes("coxinha") ||
    p.includes("cento") ||
    p.includes("pizza") ||
    p.includes("calzone") ||
    p.includes("cachorro") ||
    p.includes("empad")
  )
    return "salgados";
  // Sobrou: cuca, pao doce, franciscano, cupcake. Tudo isso e da confeitaria.
  return "confeitaria";
}

export type ItemAgregado = { produto: string; qtd: number; unidade?: string };

// Soma consolidada de todos os itens do dia, por departamento.
export function agregarPorDepto(pedidos: Pedido[]): Record<DeptoId, ItemAgregado[]> {
  // Guarda a unidade junto: bolo e por quilo, e a cozinha lendo "3 bolo" entende
  // tres bolos em vez de um de tres quilos.
  const unidades = new Map<string, string>();
  const mapas: Record<DeptoId, Map<string, number>> = {
    salgados: new Map(),
    confeitaria: new Map(),
    bolos: new Map(),
  };
  for (const ped of pedidos) {
    for (const it of ped.itens) {
      const d = deptoDe(it);
      mapas[d].set(it.produto, (mapas[d].get(it.produto) || 0) + it.qtd);
      if (it.unidade) unidades.set(it.produto, it.unidade);
    }
  }
  const out = {} as Record<DeptoId, ItemAgregado[]>;
  for (const id of Object.keys(mapas) as DeptoId[]) {
    out[id] = [...mapas[id].entries()]
      .map(([produto, qtd]) => ({ produto, qtd, unidade: unidades.get(produto) }))
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
