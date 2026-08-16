// Recebe do HUB as credenciais do número que ele acabou de conectar.
//
// Divisão de responsabilidade: o hub é dono do ROTEAMENTO (a Meta entrega tudo
// nele e ele descobre de quem é o número). Este painel é dono do ATENDIMENTO —
// e pra ENVIAR mensagem ele precisa do phone_number_id e do token na mão.
// Sem este repasse, o painel receberia mensagens encaminhadas e não teria como
// responder.
//
// Autenticação por segredo compartilhado (PROVISION_SECRET), o mesmo dos dois
// lados. Sem ele a rota recusa — senão qualquer um poderia apontar o
// atendimento da padaria para um número dele.

import { NextRequest, NextResponse } from "next/server";
import { salvarWhatsappTenant } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const segredo = process.env.PROVISION_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "PROVISION_SECRET nao configurado" }, { status: 500 });
  }
  if (req.headers.get("x-provision-secret") !== segredo) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const b = (await req.json().catch(() => ({}))) as {
    phoneNumberId?: string;
    wabaId?: string;
    token?: string;
    numero?: string;
  };
  if (!b.phoneNumberId || !b.wabaId || !b.token) {
    return NextResponse.json({ erro: "dados incompletos" }, { status: 400 });
  }

  const negocioId = process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) {
    return NextResponse.json({ erro: "NEGOCIO_PADRAO_ID nao configurado" }, { status: 500 });
  }

  try {
    await salvarWhatsappTenant(negocioId, {
      phoneId: b.phoneNumberId,
      wabaId: b.wabaId,
      token: b.token,
      numero: b.numero ?? null,
      perfil: "conectado pelo hub",
    });
  } catch (e) {
    console.error("[provisionar] falha ao gravar credenciais:", e);
    return NextResponse.json({ erro: "falha ao gravar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
