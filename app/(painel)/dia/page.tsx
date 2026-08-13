import PedidosDoDia from "@/components/PedidosDoDia";
import { carregarDoDia } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

// Painel de producao por departamento (a visao da cozinha). Dados reais do
// banco quando logado; mock no modo demo.
export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await lerSessao();
  const pedidos = await carregarDoDia(sessao?.negocioId);
  return <PedidosDoDia pedidos={pedidos} />;
}
