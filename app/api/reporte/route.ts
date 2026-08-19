// ============================================================================
//  "A DORA FALOU BESTEIRA AQUI": O BOTAO DE REPORTAR.
//
//  A dona acha que a IA vai ficando mais esperta sozinha conforme atende. Nao
//  vai: o modelo e o mesmo hoje e daqui a um ano, e so melhora quando alguem
//  conserta. O risco disso e ela ver um erro e RELEVAR, esperando que passe.
//
//  Este botao resolve o problema sem ela precisar entender nada disso. Ela ve
//  besteira, clica, escreve o que aconteceu, e chega na gente com a conversa
//  junto. Erro que a gente nao sabe e erro que fica.
//
//  O reporte vai pra dois lugares de proposito: fica gravado no banco, pra nao
//  depender de ninguem ler mensagem na hora, e sai no WhatsApp de quem cuida do
//  sistema, pra nao ficar esperando alguem abrir o painel.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { bancoConfigurado } from "@/lib/banco/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });

  let corpo: { clienteId?: string; oQue?: string; quem?: string };
  try {
    corpo = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const oQue = String(corpo.oQue ?? "").trim();
  if (!oQue) return Response.json({ erro: "sem_texto" }, { status: 400 });
  if (!bancoConfigurado) return Response.json({ ok: true });

  try {
    const { query } = await import("@/lib/banco/db");
    await query(
      `insert into reportes (negocio_id, cliente_id, o_que, quem)
       values ($1, $2, $3, $4)`,
      [sessao.negocioId, corpo.clienteId ?? null, oQue.slice(0, 2000), (corpo.quem ?? "").slice(0, 120) || null],
    );
  } catch (e) {
    console.error("[reporte] nao consegui gravar:", e);
    return Response.json({ erro: "falha" }, { status: 500 });
  }

  // O aviso no WhatsApp e conforto, nao pode derrubar o reporte que ja gravou.
  try {
    const { avisarTecnico } = await import("@/lib/alertas");
    const { carregarCredsWhatsapp } = await import("@/lib/banco/negocios");
    const creds = await carregarCredsWhatsapp(sessao.negocioId).catch(() => null);
    // Assunto por reporte, e nao geral: dois problemas diferentes no mesmo dia
    // sao dois avisos, mas o mesmo botao clicado duas vezes por engano nao vira
    // dois. A janela de repeticao ja e tratada dentro do avisarTecnico.
    await avisarTecnico(
      "reporte:" + oQue.slice(0, 40).toLowerCase(),
      "A equipe da padaria reportou um problema no atendimento da Dora:" +
        String.fromCharCode(10, 10) +
        oQue.slice(0, 600) +
        String.fromCharCode(10, 10) +
        "Esta gravado no painel, em Reportes.",
      creds ? { token: creds.token, phoneId: creds.phoneId } : undefined,
    );
  } catch (e) {
    console.error("[reporte] gravou, mas nao avisei no WhatsApp:", e);
  }

  return Response.json({ ok: true });
}

// Os reportes abertos, pro painel listar.
export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return new Response("nao autorizado", { status: 401 });
  if (!bancoConfigurado) return Response.json({ reportes: [] });
  try {
    const { query } = await import("@/lib/banco/db");
    const linhas = await query<{ id: string; o_que: string; quem: string | null; criado_em: string; cliente_id: string | null }>(
      `select id, o_que, quem, criado_em, cliente_id from reportes
        where negocio_id = $1 and resolvido = false
        order by criado_em desc limit 50`,
      [sessao.negocioId],
    );
    return Response.json({ reportes: linhas });
  } catch (e) {
    console.error("[reporte] GET", e);
    return Response.json({ reportes: [] });
  }
}
