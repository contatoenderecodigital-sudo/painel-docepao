// ============================================================================
//  QUANDO A IA CAI, QUEM DESCOBRE NAO PODE SER O CLIENTE.
//
//  Hoje, se todos os provedores falham, o cliente recebe "tive um probleminha
//  aqui agora", a conversa fica marcada no painel e pronto: se a dona estiver
//  na cozinha, ninguem fica sabendo. Aconteceu de verdade nos testes, com o
//  limite de tokens por minuto estourado, e a unica forma de descobrir foi
//  abrindo o log do servidor.
//
//  O mesmo vale pra mensagem que o WhatsApp NAO entrega: a equipe acha que
//  avisou o cliente e ele nunca soube.
//
//  Aviso vai pro WhatsApp de quem cuida do sistema (ADMIN_WHATSAPP). Sem essa
//  variavel, nada acontece e nada quebra.
// ============================================================================

import { enviarTexto, type CredsEnvio } from "@/lib/whatsapp/api";

// Um aviso igual nao se repete a cada mensagem que falha: numa queda de
// provedor sao dezenas em segundos, e o celular do dono viraria alarme de
// incendio. Um por assunto a cada dez minutos e o suficiente pra ele agir.
const JANELA_MS = 10 * 60 * 1000;
const ultimoAviso = new Map<string, number>();

export async function avisarDono(
  assunto: string,
  texto: string,
  creds?: CredsEnvio,
): Promise<void> {
  const destino = (process.env.ADMIN_WHATSAPP ?? "").trim();
  if (!destino) return;

  const agora = Date.now();
  const anterior = ultimoAviso.get(assunto) ?? 0;
  if (agora - anterior < JANELA_MS) return;
  ultimoAviso.set(assunto, agora);

  try {
    await enviarTexto(destino, texto, creds);
    console.log("[alerta] avisei o dono:", assunto);
  } catch (e) {
    // Alerta que falha nao pode derrubar o atendimento: o log ainda registra.
    console.error("[alerta] nao consegui avisar o dono:", e);
  }
}
