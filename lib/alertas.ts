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
//  Sao DOIS destinos, porque sao dois publicos:
//
//    ADMIN_WHATSAPP  quem cuida do sistema  IA fora do ar, envio falhou
//    DONA_WHATSAPP   quem cuida da padaria  cliente esperando uma pessoa
//
//  Cada uma e opcional. Sem a variavel, aquele canal fica mudo e nada quebra.
// ============================================================================

import { enviarTexto, type CredsEnvio } from "@/lib/whatsapp/api";

// Um aviso igual nao se repete a cada mensagem que falha: numa queda de
// provedor sao dezenas em segundos, e o celular do dono viraria alarme de
// incendio. Um por assunto a cada dez minutos e o suficiente pra ele agir.
const JANELA_MS = 10 * 60 * 1000;
const ultimoAviso = new Map<string, number>();

// Manda pro numero pedido. Vazio nao e erro: aquele canal so fica mudo.
async function avisar(
  destino: string,
  assunto: string,
  texto: string,
  creds?: CredsEnvio,
): Promise<void> {
  if (!destino) return;

  // A trava e por destino TAMBEM: o mesmo assunto pode precisar chegar nos
  // dois, e um nao pode calar o outro.
  const chave = destino + ':' + assunto;
  const agora = Date.now();
  const anterior = ultimoAviso.get(chave) ?? 0;
  if (agora - anterior < JANELA_MS) return;
  ultimoAviso.set(chave, agora);

  try {
    await enviarTexto(destino, texto, creds);
    console.log("[alerta] avisei", destino.slice(-4), assunto);
  } catch (e) {
    // Alerta que falha nao pode derrubar o atendimento: o log ainda registra.
    console.error("[alerta] nao consegui avisar:", e);
  }
}

// PROBLEMA DE SISTEMA: vai pra quem mantem, nao pra padaria.
// IA fora do ar, mensagem que o WhatsApp nao entregou, ponte morta.
export async function avisarTecnico(
  assunto: string,
  texto: string,
  creds?: CredsEnvio,
): Promise<void> {
  await avisar((process.env.ADMIN_WHATSAPP ?? "").trim(), assunto, texto, creds);
}

// PROBLEMA DE PADARIA: vai pra dona. Cliente esperando gente de verdade e
// coisa que so ela resolve, e o tecnico nao atende balcao.
export async function avisarDona(
  assunto: string,
  texto: string,
  creds?: CredsEnvio,
): Promise<void> {
  await avisar((process.env.DONA_WHATSAPP ?? "").trim(), assunto, texto, creds);
}

// Nome antigo, mantido pra nao quebrar chamada existente: e problema de
// sistema, entao vai pro tecnico.
export async function avisarDono(
  assunto: string,
  texto: string,
  creds?: CredsEnvio,
): Promise<void> {
  await avisarTecnico(assunto, texto, creds);
}
