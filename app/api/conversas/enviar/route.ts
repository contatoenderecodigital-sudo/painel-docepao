// ============================================================================
//  ENVIAR MENSAGEM DE TEXTO — a equipe responde pelo painel (número Cloud API).
//  Regra da JANELA DE 24H da Meta: só dá pra mandar texto livre dentro de 24h
//  da última mensagem do cliente. Fora disso, o servidor recusa (409) e a tela
//  oferece um template aprovado. Ao enviar, salva no banco (autor='equipe') e
//  tira o handoff (a equipe assumiu).
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { enviarTexto } from "@/lib/whatsapp/api";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { salvarMensagem } from "@/lib/banco/conversas";
import { ultimaMsgClienteMs, definirHandoff, telefoneDoCliente } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";
const JANELA_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem_sessao" }, { status: 401 });

  let body: { clienteId?: string; texto?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo_invalido" }, { status: 400 });
  }
  const texto = (body.texto ?? "").trim();
  if (!body.clienteId || !texto) return Response.json({ ok: false, erro: "faltam_dados" }, { status: 400 });

  const telefone = await telefoneDoCliente(negocioId, body.clienteId);
  if (!telefone) return Response.json({ ok: false, erro: "cliente_invalido" }, { status: 404 });

  // Janela de 24h: só texto livre se o cliente escreveu nas últimas 24h.
  const ultima = await ultimaMsgClienteMs(negocioId, body.clienteId);
  if (ultima == null || Date.now() - ultima > JANELA_MS) {
    return Response.json({ ok: false, erro: "janela_fechada" }, { status: 409 });
  }

  const creds = await carregarCredsWhatsapp(negocioId);
  try {
    await enviarTexto(telefone, texto, { phoneId: creds.phoneId, token: creds.token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/credenciais/i.test(msg)) return Response.json({ ok: false, erro: "sem_conexao" }, { status: 400 });
    return Response.json({ ok: false, erro: "falha_envio", detalhe: msg }, { status: 502 });
  }

  const id = await salvarMensagem(negocioId, body.clienteId, "assistant", texto, { autor: "equipe" });
  await definirHandoff(negocioId, body.clienteId, false).catch(() => {});
  return Response.json({ ok: true, id });
}
