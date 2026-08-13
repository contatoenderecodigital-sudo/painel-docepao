// Desconecta o WhatsApp do negocio logado: limpa as credenciais do config.
// O numero para de rotear mensagens pra ca ate reconectar pelo Embedded Signup.

import { lerSessao } from "@/lib/auth";
import { desconectarWhatsapp } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

export async function POST() {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem sessao" }, { status: 401 });
  await desconectarWhatsapp(negocioId);
  return Response.json({ ok: true });
}
