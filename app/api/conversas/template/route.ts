// ============================================================================
//  ENVIAR TEMPLATE — reabre conversa fora da janela de 24h OU inicia conversa
//  nova (proativa). Aceita clienteId (conversa existente) OU telefone (nova):
//  nesse caso acha/cria o cliente e devolve o id pra tela abrir a conversa.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { enviarTemplate } from "@/lib/whatsapp/api";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { salvarMensagem, acharOuCriarCliente } from "@/lib/banco/conversas";
import { definirHandoff, telefoneDoCliente } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId;
  if (!negocioId) return Response.json({ ok: false, erro: "sem_sessao" }, { status: 401 });

  let body: {
    clienteId?: string;
    telefone?: string;
    nome?: string; // nome do template
    idioma?: string;
    parametros?: string[];
    preview?: string; // texto já renderizado pra guardar no histórico
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo_invalido" }, { status: 400 });
  }
  if (!body.nome || !body.idioma) return Response.json({ ok: false, erro: "falta_template" }, { status: 400 });

  // Resolve o cliente: existente (clienteId) ou novo (telefone).
  let clienteId = body.clienteId;
  let telefone: string | null = null;
  if (clienteId) {
    telefone = await telefoneDoCliente(negocioId, clienteId);
  } else if (body.telefone) {
    telefone = body.telefone.replace(/\D/g, "");
    if (telefone.length < 10) return Response.json({ ok: false, erro: "telefone_invalido" }, { status: 400 });
    clienteId = await acharOuCriarCliente(negocioId, telefone);
  }
  if (!clienteId || !telefone) return Response.json({ ok: false, erro: "sem_destino" }, { status: 400 });

  const creds = await carregarCredsWhatsapp(negocioId);
  try {
    await enviarTemplate(telefone, body.nome, body.idioma, { phoneId: creds.phoneId, token: creds.token }, body.parametros);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/credenciais/i.test(msg)) return Response.json({ ok: false, erro: "sem_conexao" }, { status: 400 });
    return Response.json({ ok: false, erro: "falha_envio", detalhe: msg }, { status: 502 });
  }

  const conteudo = (body.preview ?? "").trim() || `Mensagem modelo: ${body.nome}`;
  const id = await salvarMensagem(negocioId, clienteId, "assistant", conteudo, { autor: "equipe" });
  await definirHandoff(negocioId, clienteId, false).catch(() => {});
  return Response.json({ ok: true, id, clienteId });
}
