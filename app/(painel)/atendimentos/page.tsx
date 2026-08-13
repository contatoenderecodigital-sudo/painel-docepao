import Atendimentos from "@/components/Atendimentos";
import { carregarConversas } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await lerSessao();
  const conversas = await carregarConversas(sessao?.negocioId);
  return <Atendimentos conversas={conversas} />;
}
