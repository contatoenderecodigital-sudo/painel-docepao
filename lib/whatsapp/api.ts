// ============================================================================
//  WHATSAPP (Meta Cloud API) — enviar mensagem e baixar áudio.
//  O webhook recebe; estas funções respondem e buscam mídia.
// ============================================================================

// Credenciais GLOBAIS (env) = fallback. Quando o negocio conecta o WhatsApp
// pelo botao (Embedded Signup), o webhook passa as creds DELE aqui e a gente
// responde pelo numero do cliente. Sem conexao, usa o env (numero de teste).
const ENV_TOKEN = process.env.WHATSAPP_TOKEN;
const ENV_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const BASE = "https://graph.facebook.com/v25.0";

// Token+numero usados pra falar com a Graph API. Prioriza o do tenant.
export type CredsEnvio = { token?: string | null; phoneId?: string | null };
function resolverCreds(creds?: CredsEnvio): { token: string; phoneId: string } {
  const token = creds?.token || ENV_TOKEN;
  const phoneId = creds?.phoneId || ENV_PHONE_ID;
  if (!token || !phoneId) throw new Error("Faltam credenciais do WhatsApp (token/phone_id do tenant ou env)");
  return { token, phoneId };
}

// Brasil: o wa_id do WhatsApp costuma vir SEM o 9º dígito do celular
// (55 + DDD + 8 dígitos = 12), mas pra ENVIAR o número precisa do 9
// (55 + DDD + 9 + 8 = 13). Aqui a gente adiciona o 9 quando falta.
function normalizarBR(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (n.startsWith("55") && n.length === 12) {
    return n.slice(0, 4) + "9" + n.slice(4);
  }
  return n;
}

// Manda um texto de volta pro cliente (pelo numero do tenant, ou o do env).
export async function enviarTexto(para: string, texto: string, creds?: CredsEnvio): Promise<void> {
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);
  console.log(`[whatsapp] enviando para ${destino} (recebido: ${para}) via ${phoneId}`);
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino,
      type: "text",
      text: { body: texto },
    }),
  });
  if (!r.ok) throw new Error(`Falha ao enviar WhatsApp: ${r.status} ${await r.text()}`);
}

// Baixa o binário de um áudio pelo media_id (pra transcrever). Usa o token do
// tenant que recebeu a mídia (a URL da mídia é escopada pela WABA dele).
export async function baixarMidia(mediaId: string, creds?: CredsEnvio): Promise<ArrayBuffer> {
  const { token } = resolverCreds(creds);
  // 1) pega a URL temporária da mídia
  const meta = await fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meta.ok) throw new Error(`Falha ao achar mídia: ${meta.status}`);
  const { url } = (await meta.json()) as { url: string };
  // 2) baixa o binário (precisa do mesmo token)
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) throw new Error(`Falha ao baixar mídia: ${bin.status}`);
  return bin.arrayBuffer();
}
