import Atendimentos from "@/components/Atendimentos";
import { carregarConversas } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

// O telefone vem de quem clicou em 'Abrir conversa' na fila de aprovacao ou
// em aguardando confirmacao: sem ele, a equipe caia na lista inteira e tinha
// que procurar o cliente na mao.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const sessao = await lerSessao();
  const conversas = await carregarConversas(sessao?.negocioId);
  const { cliente } = await searchParams;
  return <Atendimentos conversas={conversas} telefoneInicial={cliente} />;
}
