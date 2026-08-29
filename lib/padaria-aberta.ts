// ============================================================================
//  A PADARIA ESTÁ ABERTA AGORA?
//
//  Existe por causa de um buraco que só aparece de madrugada: quando a Dora cai
//  ou precisa da equipe, ela dizia "já já te respondo" e "a equipe vai falar com
//  você" na mesma voz às 14h e às 23h. Às 14h é verdade. Às 23h é promessa que
//  ninguém vai cumprir, e o cliente fica olhando o celular esperando alguém que
//  só volta às 6h30.
//
//  Prometer atendimento que não vem é pior que avisar que a loja fechou: quem
//  sabe que a resposta vem de manhã dorme tranquilo, quem foi prometido fica
//  achando que foi ignorado.
//
//  O horário vem da configuração do negócio, o mesmo texto que a Dora usa pra
//  responder "que horas vocês abrem".
// ============================================================================

// Segunda a sábado das 6h30 às 20h. Domingo e feriado das 6h30 às 12h e das 16h
// às 20h. Se mudar aqui, muda no persona.ts junto: é o mesmo horário que ela
// fala pro cliente.
const SEMANA = [{ de: 6 * 60 + 30, ate: 20 * 60 }];
const DOMINGO = [
  { de: 6 * 60 + 30, ate: 12 * 60 },
  { de: 16 * 60, ate: 20 * 60 },
];

function agoraEmSaoPaulo(): { minutos: number; domingo: boolean } {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(agora);
  const pega = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  const minutos = Number(pega("hour")) * 60 + Number(pega("minute"));
  // "dom." em pt-BR. Domingo tem intervalo no meio do dia; feriado a gente não
  // sabe, e por isso a mensagem nunca promete hora exata.
  const domingo = /dom/i.test(pega("weekday"));
  return { minutos, domingo };
}

export function padariaAberta(): boolean {
  const { minutos, domingo } = agoraEmSaoPaulo();
  const faixas = domingo ? DOMINGO : SEMANA;
  return faixas.some((f) => minutos >= f.de && minutos < f.ate);
}

// O que dizer pro cliente quando a conversa precisa de gente.
//
// Aberta: alguém está lá, então promete resposta agora.
// Fechada: avisa que a loja fechou e que respondem quando abrir. Não promete
// hora exata de propósito, porque feriado muda o horário e promessa quebrada
// custa mais que a espera.
export function avisoDeEspera(): string {
  return padariaAberta()
    ? "Já vou chamar uma pessoa da equipe pra te ajudar, um instante."
    : "A padaria já fechou por hoje, mas anotei tudo aqui. Assim que a equipe abrir, eles te respondem por aqui.";
}

// A mesma ideia pra quando a IA cai: dentro do horário ela volta em seguida,
// fora dele quem volta é a equipe de manhã.
export function avisoDeProblema(): string {
  return padariaAberta()
    ? "Tive um probleminha aqui agora, ja ja te respondo, ta?"
    : "Tive um probleminha aqui agora, e a padaria ja fechou. Anotei sua mensagem e a equipe te responde assim que abrir.";
}

/**
 * A RETIRADA CABE NO EXPEDIENTE?
 *
 * Pedido do dono em 23/08/2026: "se ele marcar pra retirar numa data ou horario
 * que a empresa nao trabalha, tem que avisar o cliente". Ficar calado e
 * perguntar de novo faz ele achar que nao foi entendido.
 *
 * Usa o MESMO horario que a Dora fala pro cliente e que decide se ela promete
 * atendimento agora. Fonte unica: se mudar aqui, muda em tudo junto.
 *
 * Devolve o motivo escrito pra ela dizer, ou null quando cabe.
 */
export function retiradaForaDoExpediente(
  dataDDMMAAAA: string | null | undefined,
  horaHHMM: string | null | undefined,
): string | null {
  const d = String(dataDDMMAAAA ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const h = String(horaHHMM ?? "").match(/(\d{1,2})[h:]?(\d{2})?/);
  if (!d || !h) return null;

  const quando = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]));
  const minutos = Number(h[1]) * 60 + Number(h[2] ?? 0);
  const domingo = quando.getDay() === 0;
  const faixas = domingo ? DOMINGO : SEMANA;
  if (faixas.some((f) => minutos >= f.de && minutos < f.ate)) return null;

  const escrever = (m: number) =>
    String(Math.floor(m / 60)) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : "");
  const janelas = faixas.map((f) => escrever(f.de) + " às " + escrever(f.ate)).join(" e das ");
  // O AVISO INFORMA. QUEM PERGUNTA E A ETAPA.
  //
  // Esta frase terminava em "Qual horario fica bom pra voce?", e o unico lugar
  // que a usa (`fluxo.ts`) sempre gruda a pergunta da etapa logo atras. O
  // cliente recebia duas perguntas para a mesma coisa, na mesma mensagem:
  //
  //   "No domingo a gente atende das 6h30 as 12h e das 16h as 20h.
  //    Qual horario fica bom pra voce?  Que horas voce vai buscar?"
  //
  // Medido em 28/08/2026, na bateria. Sem a pergunta daqui, a mensagem fica com
  // o motivo na frente e UMA pergunta no fim, que e o desenho descrito la.
  return (
    (domingo ? "No domingo" : "Nesse dia") + " a gente atende das " + janelas + "."
  );
}
