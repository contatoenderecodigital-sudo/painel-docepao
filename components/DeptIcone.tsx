// Icone unico por comanda, usado em TODO lugar (cards de producao, filtros,
// tickets do cupom). Assim a mesma comanda tem sempre o mesmo icone, e a equipe
// reconhece de longe no mural sem precisar ler.

import {
  Drumstick,
  Cookie,
  Cake,
  CakeSlice,
  Pizza,
  Croissant,
  Sandwich,
  Soup,
  Receipt,
  CupSoda,
  Wheat,
  Beef,
} from "lucide-react";
import type { DeptoId } from "@/lib/departamentos";

const ICONES: Record<DeptoId, typeof Cake> = {
  salgados: Drumstick,
  docinhos: Cookie,
  bolo_festa: Cake,
  bolo_caseiro: CakeSlice,
  bolo_salgado: Beef,
  torta_fria: Sandwich,
  torta_doce: CupSoda,
  empadao: Soup,
  pizza: Pizza,
  calzone: Croissant,
  cupcake: CupSoda,
  franciscano: Sandwich,
  padaria: Wheat,
};

export function DeptIcone({
  id,
  size = 16,
  strokeWidth = 2,
}: {
  id: DeptoId | "caixa";
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = id === "caixa" ? Receipt : ICONES[id] ?? Cookie;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
