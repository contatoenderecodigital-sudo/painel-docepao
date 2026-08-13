// ============================================================================
//  EMBEDDED SIGNUP (Tech Provider) — o cliente conecta o WhatsApp dele ao nosso
//  app do Meta. O frontend (botao "Conectar WhatsApp") manda { code, waba_id,
//  phone_number_id }; aqui a gente:
//   1) troca o code por token do negocio
//   2) inscreve nosso app na WABA do cliente com override do webhook
//   3) registra o numero
//   4) mapeia waba_id + phone_number_id -> tenant (pro atendimento com IA)
// ============================================================================

import { NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { salvarWhatsappTenant } from "@/lib/banco/negocios";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v25.0";
const APP_ID = process.env.WHATSAPP_APP_ID ?? "986426127711722";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PIN = process.env.WHATSAPP_REGISTER_PIN ?? "";
const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL ?? "https://app.enderecodigital.com/api/whatsapp";
const NEGOCIO_PADRAO = process.env.NEGOCIO_PADRAO_ID ?? "";

export async function POST(req: NextRequest) {
  if (!APP_SECRET || !VERIFY_TOKEN) {
    return Response.json({ ok: false, erro: "Faltam WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN no ambiente." }, { status: 500 });
  }

  let body: { code?: string; waba_id?: string; phone_number_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, erro: "corpo invalido" }, { status: 400 });
  }
  const { code, waba_id, phone_number_id } = body;
  if (!code || !waba_id || !phone_number_id) {
    return Response.json({ ok: false, erro: "faltam code / waba_id / phone_number_id" }, { status: 400 });
  }

  try {
    // 1) troca o code por token do negocio
    const tokRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`);
    const tok = (await tokRes.json()) as { access_token?: string; error?: unknown };
    if (!tokRes.ok || !tok.access_token) throw new Error("troca do code falhou: " + JSON.stringify(tok));
    const token = tok.access_token;

    // 2) inscreve nosso app na WABA do cliente, com override do webhook
    const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ override_callback_uri: WEBHOOK_URL, verify_token: VERIFY_TOKEN }),
    });
    const sub = await subRes.json();
    if (!subRes.ok) throw new Error("subscribe falhou: " + JSON.stringify(sub));

    // 3) registra o numero (define o PIN de 2FA). 133005 = ja registrado.
    if (PIN) {
      const regRes = await fetch(`${GRAPH}/${phone_number_id}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", pin: PIN }),
      });
      const reg = (await regRes.json()) as { error?: { code?: number } };
      if (!regRes.ok && reg?.error?.code !== 133005) throw new Error("register falhou: " + JSON.stringify(reg));
    }

    // 4) busca o numero bonito + nome do perfil (pra mostrar no painel)
    let numero: string | null = null;
    let perfil: string | null = null;
    try {
      const infoRes = await fetch(
        `${GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const info = (await infoRes.json()) as { display_phone_number?: string; verified_name?: string };
      numero = info.display_phone_number ?? null;
      perfil = info.verified_name ?? null;
    } catch {
      /* nao bloqueia a conexao se o fetch do numero falhar */
    }

    // 5) mapeia pro tenant do dono logado (ou o padrao)
    const sessao = await lerSessao();
    const negocioId = sessao?.negocioId ?? NEGOCIO_PADRAO;
    if (negocioId)
      await salvarWhatsappTenant(negocioId, { phoneId: phone_number_id, wabaId: waba_id, token, numero, perfil });

    return Response.json({ ok: true, phone_number_id, waba_id, numero, perfil });
  } catch (e) {
    console.error("[embedded] erro:", e);
    return Response.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
