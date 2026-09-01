// O QUE VEIO ANTES NA CONVERSA, quando a equipe rola a tela pra cima.
//
// A lista de conversas traz as 40 ultimas mensagens de cada uma, pra tela nao
// carregar um ano de historico a cada seis segundos de atualizacao. Nada e
// apagado: o resto vem por aqui, em blocos, do mais novo pro mais velho.
//
// Pergunta dele em 01/09/2026: "mesmo se tiver um ano de conversa todo dia vai
// conseguir ver tudo?". Esta rota e o que faz a resposta ser sim.
//
// Escopo: SEMPRE pelo negocio da sessao. Ler conversa de outra padaria pelo id
// do cliente seria o pior vazamento que este painel pode ter.

import { lerSessao } from "@/lib/auth";
import { mensagensAnteriores, instanteDaMensagem } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });

  const p = new URL(req.url).searchParams;
  const cliente = p.get("cliente")?.trim();
  const antesDaMensagem = p.get("antesDaMensagem")?.trim();
  if (!cliente || !antesDaMensagem) {
    return new Response("faltou cliente ou antesDaMensagem", { status: 400 });
  }

  // O CORTE VEM DO BANCO, e nao da hora que a tela mostra.
  //
  // A tela guarda "14:32" e a data. Duas mensagens no mesmo minuto, que e o
  // normal quando o cliente manda tres seguidas, voltariam repetidas ou
  // sumiriam no meio. O carimbo cru resolve, e sai do id da propria mensagem.
  const quando = await instanteDaMensagem(sessao.negocioId, antesDaMensagem);
  if (!quando) return Response.json([]);

  const mensagens = await mensagensAnteriores(sessao.negocioId, cliente, quando);
  return Response.json(mensagens);
}
