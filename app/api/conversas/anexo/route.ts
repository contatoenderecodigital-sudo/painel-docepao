// ============================================================================
//  ENVIAR ANEXO (bônus) — a equipe manda imagem ou documento pelo painel.
//  Também respeita a janela de 24h (mídia só dentro da janela). Sobe o binário
//  pela Cloud API e guarda a mídia no banco (base64) pra aparecer no chat.
//  Recebe multipart/form-data: { clienteId, file }.
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { enviarMidia } from "@/lib/whatsapp/api";
import { carregarCredsWhatsapp } from "@/lib/banco/negocios";
import { salvarMensagem } from "@/lib/banco/conversas";
import { ultimaMsgClienteMs, definirHandoff, telefoneDoCliente } from "@/lib/banco/atendimentos";

export const dynamic = "force-dynamic";
const JANELA_MS = 24 * 60 * 60 * 1000;
const LIMITE = 16 * 1024 * 1024; // 16MB (limite prático da Cloud API)

export async function POST(req: NextRequest) {
  const sessao = await lerSessao();
  const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
  if (!negocioId) return Response.json({ ok: false, erro: "sem_sessao" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, erro: "corpo_invalido" }, { status: 400 });
  }
  const clienteId = String(form.get("clienteId") ?? "");
  const file = form.get("file");
  if (!clienteId || !(file instanceof File)) return Response.json({ ok: false, erro: "faltam_dados" }, { status: 400 });
  if (file.size > LIMITE) return Response.json({ ok: false, erro: "arquivo_grande" }, { status: 413 });

  const telefone = await telefoneDoCliente(negocioId, clienteId);
  if (!telefone) return Response.json({ ok: false, erro: "cliente_invalido" }, { status: 404 });

  const ultima = await ultimaMsgClienteMs(negocioId, clienteId);
  if (ultima == null || Date.now() - ultima > JANELA_MS) {
    return Response.json({ ok: false, erro: "janela_fechada" }, { status: 409 });
  }

  const mime = file.type || "application/octet-stream";
  const ehImagem = mime.startsWith("image/");
  const buffer = Buffer.from(await file.arrayBuffer());
  const creds = await carregarCredsWhatsapp(negocioId);
  try {
    await enviarMidia(telefone, buffer, mime, ehImagem ? "image" : "document", { phoneId: creds.phoneId, token: creds.token }, { nome: file.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/credenciais/i.test(msg)) return Response.json({ ok: false, erro: "sem_conexao" }, { status: 400 });
    return Response.json({ ok: false, erro: "falha_envio", detalhe: msg }, { status: 502 });
  }

  const id = await salvarMensagem(
    negocioId,
    clienteId,
    "assistant",
    ehImagem ? "Foto" : file.name,
    { autor: "equipe", tipo: ehImagem ? "imagem" : "documento", mime, dados: buffer.toString("base64"), nome: file.name },
  );
  await definirHandoff(negocioId, clienteId, false).catch(() => {});
  return Response.json({ ok: true, id });
}
