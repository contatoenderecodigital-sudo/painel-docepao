import Shell from "@/components/Shell";
import { carregarFilaAprovacao } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";

// Layout compartilhado do painel: renderiza a sidebar (Shell) UMA vez e mantém
// entre navegações — só o conteúdo (children) troca. Isso deixa a troca de aba
// bem mais lisa. O filaCount (badge da Aprovação) é carregado aqui.
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao();
  const fila = await carregarFilaAprovacao(sessao?.negocioId);
  return <Shell filaCount={fila.length}>{children}</Shell>;
}
