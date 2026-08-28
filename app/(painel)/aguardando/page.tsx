import { redirect } from "next/navigation";
import AguardandoConfirmacao from "@/components/AguardandoConfirmacao";
import { carregarAguardandoConfirmacao } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

// Sempre fresco: muda a cada pedido que a Dora deixa pendente.
export const dynamic = "force-dynamic";

export default async function Aguardando() {
  const sessao = await lerSessao();
  if (sessao) {
    const { carregarMarca } = await import("@/lib/banco/negocios");
    const marca = await carregarMarca(sessao.negocioId);
    if (marca?.tipo === "agencia") redirect("/atendimentos");
  }
  const pedidos = await carregarAguardandoConfirmacao(sessao?.negocioId);
  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-5">
      <div>
        <div className="t-label text-dourado">Aguardando confirmação</div>
        <h1 className="t-h1 text-cream mt-1">
          {pedidos.length === 0
            ? "Nenhum pedido travado"
            : pedidos.length === 1
              ? "1 pedido esperando um valor"
              : `${pedidos.length} pedidos esperando um valor`}
        </h1>
        <p className="text-sm text-cream/60 mt-1 max-w-2xl">
          A Dora montou tudo, mas não podia fechar sozinha. Quase sempre é o valor do topo de bolo, que não está
          na tabela. Combine com o cliente, lance aqui, e ela avisa o total novo. Só depois disso o pedido entra na
          fila de aprovação.
        </p>
      </div>
      <AguardandoConfirmacao pedidos={pedidos} />
    </div>
  );
}
