import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { carregarFilaAprovacao } from "@/lib/dados";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

// Layout compartilhado do painel: renderiza a sidebar (Shell) UMA vez e mantém
// entre navegações — só o conteúdo (children) troca. Isso deixa a troca de aba
// bem mais lisa. O filaCount (badge da Aprovação) é carregado aqui.
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao();

  // SEM LOGIN, VAI PRO LOGIN. NAO MOSTRA O PAINEL COM DADOS DE EXEMPLO.
  //
  // Nenhuma pagina do painel redirecionava: elas passavam `sessao?.negocioId`
  // (undefined) pras funcoes de carga, e o `lib/dados.ts` cai no MOCK quando nao
  // recebe negocio. Entao quem abrisse o painel sem estar logado via a fila de
  // aprovacao e a lista de clientes cheias de dados de exemplo, com a cara do
  // painel de verdade.
  //
  // Nao vazava nada real (e mock, e as Server Actions conferem a sessao e
  // devolvem erro), mas ficava a mentira: as ROTAS de API respondem 401 e as
  // TELAS mostravam teatro.
  //
  // O layout e o ponto unico: uma guarda aqui cobre todas as paginas de dentro.
  //
  // O MOCK CONTINUA VALENDO SEM BANCO, que e pra que ele existe ("sem banco
  // configurado, o painel cai no mock, bom pra demo"). Com banco no ar, sem
  // sessao, nao ha demo nenhuma pra mostrar.
  //
  // Achado na leitura do `app/`, 28/08/2026.
  if (!sessao && bancoConfigurado) redirect("/login");

  const fila = await carregarFilaAprovacao(sessao?.negocioId);
  return <Shell filaCount={fila.length}>{children}</Shell>;
}
