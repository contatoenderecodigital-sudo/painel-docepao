// Roda a cobrança dos orçamentos parados.
//
// Duas portas de entrada, e as duas exigem prova de quem é:
//  - a dona logada no painel, apertando o botão de cobrar agora;
//  - o relógio do servidor, com o segredo em COBRANCA_SEGREDO no cabeçalho.
//
// Por padrão SIMULA: devolve quem seria cobrado, com que texto e por quê, sem
// mandar nada. Pra valer só com { simular: false } e com COBRANCA_AUTOMATICA=1
// nas variáveis, porque escrever pra cliente de verdade não tem desfazer.

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { rodarCobranca } from "@/lib/cobranca";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { simular?: boolean; cliente?: string; negocioId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vazio é rodada simulada da dona logada */
  }

  const sessao = await lerSessao();
  const segredo = process.env.COBRANCA_SEGREDO;
  const veioDoRelogio =
    !!segredo && req.headers.get("x-cobranca-segredo") === segredo;

  const negocioId = sessao?.negocioId ?? (veioDoRelogio ? body.negocioId : null) ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId || (!sessao && !veioDoRelogio)) {
    return Response.json({ ok: false, erro: "sem_permissao" }, { status: 401 });
  }

  try {
    const r = await rodarCobranca(negocioId, {
      simular: body.simular !== false,
      apenasCliente: body.cliente,
    });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cobranca/rodar]", e);
    return Response.json(
      { ok: false, erro: "falha", detalhe: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
