import { registrarUsoIA } from "@/lib/ia/uso";
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
//
// `negocioId` e `clienteId` são opcionais e servem só pra MEDIR: o Whisper
// cobra por minuto de áudio e esse custo não aparecia em lugar nenhum. Numa
// conversa em que o cliente manda vários áudios, ele deixa de ser desprezível —
// e a padaria só descobriria na fatura.
export async function transcrever(
  audio: ArrayBuffer,
  medir?: { negocioId?: string | null; clienteId?: string | null; contato?: string | null },
): Promise<string> {
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

  // Registra o custo do áudio. Whisper cobra por MINUTO, não por token: o
  // tamanho do arquivo é a única medida que temos aqui sem decodificar o áudio.
  // O ogg/opus do WhatsApp roda perto de 4 KB por segundo, então essa é a
  // aproximação usada — declarada aqui pra ninguém achar que é medição exata.
  if (medir?.negocioId) {
    const segundos = Math.max(1, Math.round(audio.byteLength / 4000));
    const usdPorMinuto = PROVIDER === "groq" ? 0.0002 : 0.006;
    const custoCent = Math.max(1, Math.round((segundos / 60) * usdPorMinuto * 5.4 * 100));
    void registrarUsoIA(
      medir.negocioId,
      ENDPOINTS[PROVIDER!]?.modelo ?? "whisper",
      { tokensIn: segundos, tokensOut: 0 },
      "transcricao",
      medir.clienteId ?? null,
      medir.contato ?? null,
    ).catch(() => {});
    void custoCent;
  }
  return text.trim();
}
