// RECIBO HONESTO: so o que o banco gravou.
//
// A Meta manda entregue e lida. O painel nao inventa tique azul: se o UPDATE
// nao casou o wamid, os campos ficam vazios e a tela nao finge que chegou.

export type ReciboDaMensagem = {
  falhaEnvio?: string | null;
  lidaWpp?: boolean | null;
  entregue?: boolean | null;
};

/** Palavra que a tela pode mostrar. Null = ainda nao ha recibo, e nao se inventa. */
export function rotuloDoRecibo(m: ReciboDaMensagem): "nao chegou" | "lida" | "entregue" | null {
  if (m.falhaEnvio) return "nao chegou";
  if (m.lidaWpp) return "lida";
  if (m.entregue) return "entregue";
  return null;
}
