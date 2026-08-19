import Clientes from "@/components/Clientes";
import { carregarClientes } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await lerSessao();
  const clientes = await carregarClientes(sessao?.negocioId);
  // O mes da padaria: este codigo roda no servidor, que esta em UTC. No dia 1,
  // a partir das 21h do dia 31, a tela ja pulava pro mes seguinte e escondia
  // quem faz aniversario hoje.
  const mesAtual = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(new Date()),
  );
  return <Clientes clientes={clientes} mesAtual={mesAtual} />;
}
