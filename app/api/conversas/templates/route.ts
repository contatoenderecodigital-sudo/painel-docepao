// Lista os templates aprovados da WABA do negócio (pra reabrir conversa fora da
// janela de 24h ou iniciar uma conversa nova). Sem WhatsApp conectado, devolve
// lista vazia com um motivo claro pra tela orientar o usuário.

import { lerSessao } from "@/lib/auth";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { listarTemplates } from "@/lib/whatsapp/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem_sessao" }, { status: 401 });

  const creds = await carregarCredsWhatsapp(negocioId);
  if (!creds.wabaId || !creds.token) {
    return Response.json({ ok: true, templates: [], motivo: "sem_conexao" });
  }
  try {
    const templates = await listarTemplates(creds.wabaId, creds.token);
    return Response.json({ ok: true, templates });
  } catch (e) {
    return Response.json({ ok: false, erro: "falha_lista", detalhe: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
