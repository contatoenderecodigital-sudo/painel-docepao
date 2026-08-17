// Icone unico por estacao/departamento, usado em TODO lugar (cards de producao,
// filtros, tickets do cupom). Assim cada estacao tem sempre o mesmo icone.
//   Salgados = Drumstick · Confeitaria = Cookie · Bolos = Cake

import { Drumstick, Cookie, Cake, Receipt } from "lucide-react";
import type { DeptoId } from "@/lib/departamentos";

const ICONES: Record<DeptoId, typeof Cake> = {
  salgados: Drumstick,
  confeitaria: Cookie,
  bolos: Cake,
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
  const Icon = id === "caixa" ? Receipt : ICONES[id];
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
