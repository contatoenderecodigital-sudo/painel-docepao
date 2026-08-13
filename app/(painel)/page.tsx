import { redirect } from "next/navigation";
import FilaAprovacao from "@/components/FilaAprovacao";
import { carregarFilaAprovacao } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";
import { nomeNegocioAtual } from "@/lib/negocio";
import { aprovarPedido, recusarPedido } from "./acoes";

// Sempre fresco: a fila muda a cada pedido que chega do WhatsApp.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Escopa pelo negócio do usuário logado (isolamento multi-tenant).
  const sessao = await lerSessao();
  // Aprovação de pedido é de padaria. Agência (só WhatsApp/CRM) não tem essa
  // tela: cai direto no CRM de atendimentos.
  if (sessao) {
    const { carregarMarcaCache } = await import("@/lib/banco/negocios");
    const marca = await carregarMarcaCache(sessao.negocioId);
    if (marca?.tipo === "agencia") redirect("/atendimentos");
  }
  const fila = await carregarFilaAprovacao(sessao?.negocioId);
  const nomeNegocio = await nomeNegocioAtual("");
  return (
    <FilaAprovacao
      inicial={fila}
      aprovar={aprovarPedido}
      recusar={recusarPedido}
      nomeNegocio={nomeNegocio}
    />
  );
}
