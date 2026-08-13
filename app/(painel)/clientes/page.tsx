import Clientes from "@/components/Clientes";
import { carregarClientes } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await lerSessao();
  const clientes = await carregarClientes(sessao?.negocioId);
  const mesAtual = new Date().getMonth() + 1;
  return <Clientes clientes={clientes} mesAtual={mesAtual} />;
}
