// ============================================================================
//  DE QUEM É O CÉREBRO, e como se troca sem mexer em código.
//
//  A leitura da conversa é feita por um modelo de fora. Qual deles é decisão de
//  quem opera, não de quem escreve o código: aqui ela é lida do ambiente, num
//  lugar só, e vale para o WhatsApp e para a tela de teste ao mesmo tempo.
//
//  QUALQUER PROVEDOR COMPATÍVEL COM A API DA OPENAI ENTRA POR AQUI, e o DeepSeek
//  é um deles: muda a URL, a chave e o nome do modelo, e o resto do sistema não
//  fica sabendo. O que o fluxo usa é `chat.completions` com `response_format`
//  JSON, que é o mesmo nos dois.
//
//  AS TRÊS VARIÁVEIS:
//
//    IA_BASE_URL          https://api.deepseek.com   (vazio = OpenAI)
//    IA_API_KEY           a chave do provedor        (vazio = OPENAI_API_KEY)
//    OPENAI_MODEL_FLUXO   deepseek-v4-flash          (vazio = gpt-4.1-mini)
//
//  TROCAR O CÉREBRO É MUDANÇA GRANDE, e por isso ela deixa rastro: o modelo em
//  uso aparece no log a cada partida do processo. Sem isso, uma variável errada
//  no deploy vira "a IA ficou burra" sem ninguém saber por quê.
// ============================================================================

import OpenAI from "openai";

/** O modelo que lê a conversa. Uma fonte só, lida do ambiente. */
export function modeloDoCerebro(): string {
  return process.env.OPENAI_MODEL_FLUXO || "gpt-4.1-mini";
}

/** O provedor, em uma palavra, pro log e pra contabilidade. */
export function provedorDoCerebro(): string {
  const url = String(process.env.IA_BASE_URL || "").trim();
  if (!url) return "openai";
  if (/deepseek/i.test(url)) return "deepseek";
  return url.replace(/^https?:\/\//, "").split("/")[0];
}

let avisou = false;

/**
 * O cliente que fala com o provedor escolhido.
 *
 * A chave própria (`IA_API_KEY`) existe para o dia em que os dois convivem: o
 * áudio continua sendo transcrito pela OpenAI (Whisper) enquanto a leitura da
 * conversa roda em outro provedor. Sem ela, ligar o DeepSeek desligaria a
 * transcrição junto, e o cliente que manda áudio ficaria sem resposta.
 */
export function clienteDoCerebro(): OpenAI {
  const baseURL = String(process.env.IA_BASE_URL || "").trim() || undefined;
  const apiKey = String(process.env.IA_API_KEY || process.env.OPENAI_API_KEY || "").trim();

  if (!avisou) {
    avisou = true;
    console.log(
      "[cerebro] provedor=" + provedorDoCerebro() +
        " modelo=" + modeloDoCerebro() +
        (baseURL ? " url=" + baseURL : "") +
        (apiKey ? "" : " SEM CHAVE"),
    );
  }

  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
