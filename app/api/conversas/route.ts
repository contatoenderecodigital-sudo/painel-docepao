// Conversas do negócio logado, em JSON. O Atendimentos busca aqui a cada poucos
// segundos pra atualizar sozinho (mensagens/conversas novas sem recarregar).

import { lerSessao } from "@/lib/auth";
import { carregarConversas } from "@/lib/dados";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  const conversas = await carregarConversas(sessao.negocioId);
  return Response.json(conversas);
}
