// Conversas do negócio logado, em JSON. O Atendimentos busca aqui a cada poucos
// segundos pra atualizar sozinho (mensagens/conversas novas sem recarregar).

import { lerSessao } from "@/lib/auth";
import { carregarConversas } from "@/lib/dados";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  // A BUSCA VAI AO BANCO, e nao so ao que a tela ja tem.
  //
  // A tela carrega as 60 conversas mais recentes. Sem isto, procurar por quem
  // falou ha um ano nao achava nada, e a dona vai largar o WhatsApp do celular
  // contando com esta tela. Exigencia dele em 01/09/2026.
  const q = new URL(req.url).searchParams.get("q")?.trim() || undefined;
  const conversas = await carregarConversas(sessao.negocioId, q);
  return Response.json(conversas);
}
