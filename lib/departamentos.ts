// ============================================================================
//  DEPARTAMENTOS de producao da padaria. Cada equipe produz separado e so
//  quer ver o que ELA precisa fazer. Mapeia item -> estacao e agrega o dia.
// ============================================================================

import type { Pedido } from "./tipos";

export type DeptoId = "padaria" | "salgados" | "confeitaria" | "bolos";

export type Departamento = {
  id: DeptoId;
  nome: string;
  cor: string; // acento cheio (fundo de icone, header) - usar com texto claro
  corClara: string; // tom claro pra TEXTO/icone sobre fundo escuro (legivel)
};

export const DEPARTAMENTOS: Departamento[] = [
  { id: "padaria", nome: "Padaria", cor: "#d9a441", corClara: "#ecc16a" },
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
  if (c.startsWith("bolo") || p.includes("bolo")) return "bolos";
  if (
    c.startsWith("doce") ||
    p.includes("brigadeiro") ||
    p.includes("trufa") ||
    p.includes("cheesecake") ||
    p.includes("torta") ||
    p.includes("docinho")
  )
    return "confeitaria";
  if (c.startsWith("salgado") || p.includes("salgado") || p.includes("coxinha") || p.includes("cento"))
    return "salgados";
  return "padaria"; // pizza, pao, etc.
}

export type ItemAgregado = { produto: string; qtd: number };

// Soma consolidada de todos os itens do dia, por departamento.
export function agregarPorDepto(pedidos: Pedido[]): Record<DeptoId, ItemAgregado[]> {
  const mapas: Record<DeptoId, Map<string, number>> = {
    padaria: new Map(),
    salgados: new Map(),
    confeitaria: new Map(),
    bolos: new Map(),
  };
  for (const ped of pedidos) {
    for (const it of ped.itens) {
      const d = deptoDe(it);
      mapas[d].set(it.produto, (mapas[d].get(it.produto) || 0) + it.qtd);
    }
  }
  const out = {} as Record<DeptoId, ItemAgregado[]>;
  for (const id of Object.keys(mapas) as DeptoId[]) {
    out[id] = [...mapas[id].entries()]
      .map(([produto, qtd]) => ({ produto, qtd }))
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
