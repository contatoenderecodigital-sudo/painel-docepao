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

/**
 * O MODELO QUE LÊ A CONVERSA.
 *
 * A ordem é: o que o banco diz para ESTE negócio, depois a variável de ambiente,
 * depois o padrão. O banco vem primeiro por um motivo prático, medido em
 * 02/09/2026: trocar a variável no painel do deploy exigiu quatro tentativas e
 * meia hora, e o container continuava subindo com o valor antigo. Comparar dois
 * cérebros com as mesmas frases não pode custar meia hora por troca.
 *
 * `negocios.config.modelo_ia` é lido a cada mensagem, então a troca vale na
 * próxima frase, sem deploy nenhum. E é por negócio: no dia em que houver duas
 * padarias, uma pode testar o cérebro novo sem a outra sentir.
 */
export function modeloDoCerebro(doBanco?: string | null): string {
  return String(doBanco ?? "").trim() || process.env.OPENAI_MODEL_FLUXO || "gpt-4.1-mini";
}

let avisou = "";

/**
 * O cliente que fala com o provedor escolhido.
 *
 * A chave própria (`IA_API_KEY`) existe para o dia em que os dois convivem: o
 * áudio continua sendo transcrito pela OpenAI (Whisper) enquanto a leitura da
 * conversa roda em outro provedor. Sem ela, ligar o DeepSeek desligaria a
 * transcrição junto, e o cliente que manda áudio ficaria sem resposta.
 */
export function clienteDoCerebro(doBanco?: { url?: string | null; chave?: string | null }): OpenAI {
  const baseURL = String(doBanco?.url || process.env.IA_BASE_URL || "").trim() || undefined;
  const apiKey = String(
    doBanco?.chave || process.env.IA_API_KEY || process.env.OPENAI_API_KEY || "",
  ).trim();

  // O aviso sai UMA vez por combinacao: trocando o modelo pelo banco, o log
  // precisa dizer que trocou, senao a medicao seguinte compara sem saber com o
  // que esta comparando.
  const assinatura = String(baseURL) + "|" + modeloDoCerebro();
  if (avisou !== assinatura) {
    avisou = assinatura;
    console.log(
      "[cerebro] provedor=" + (baseURL ? (/deepseek/i.test(baseURL) ? "deepseek" : baseURL) : "openai") +
        " modelo=" + modeloDoCerebro() +
        (baseURL ? " url=" + baseURL : "") +
        (apiKey ? "" : " SEM CHAVE"),
    );
  }

  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
