// ============================================================================
//  TRANSCRIÇÃO DE ÁUDIO (STT) — a dona pediu: a IA ouve áudio, responde texto.
//  O Claude não recebe áudio direto; um serviço Whisper transcreve primeiro.
//  Custo baixo (~R$ 0,01–0,02 por áudio de recado). Provedor trocável por env.
//
//  Suporta OpenAI Whisper e Groq (mesma API, endpoint diferente). Escolha em
//  STT_PROVIDER=openai|groq e a chave em STT_API_KEY.
// ============================================================================

const PROVIDER = process.env.STT_PROVIDER; // "openai" | "groq"
const KEY = process.env.STT_API_KEY;

const ENDPOINTS: Record<string, { url: string; modelo: string }> = {
  openai: { url: "https://api.openai.com/v1/audio/transcriptions", modelo: "whisper-1" },
  groq: { url: "https://api.groq.com/openai/v1/audio/transcriptions", modelo: "whisper-large-v3-turbo" },
};

// Transcreve um áudio (bytes do WhatsApp, formato ogg/opus) em texto pt-BR.
export async function transcrever(audio: ArrayBuffer): Promise<string> {
  if (!PROVIDER || !KEY) {
    // Sem STT configurado ainda: não quebra o fluxo, só sinaliza.
    return "[áudio recebido — transcrição ainda não configurada]";
  }
  const cfg = ENDPOINTS[PROVIDER];
  if (!cfg) throw new Error(`STT_PROVIDER inválido: ${PROVIDER} (use openai ou groq)`);

  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/ogg" }), "recado.ogg");
  form.append("model", cfg.modelo);
  form.append("language", "pt");

  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!r.ok) throw new Error(`Falha na transcrição: ${r.status} ${await r.text()}`);
  const { text } = (await r.json()) as { text: string };
  return text.trim();
}
