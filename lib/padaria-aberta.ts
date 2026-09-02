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

/**
 * UM INSTANTE VIRA UM NÚMERO DE MINUTOS DE PAREDE DE SÃO PAULO.
 *
 * Tudo aqui é combinado e lido em horário de São Paulo, então virar parede uma
 * vez e comparar parede com parede daí pra frente é o certo. Converter pra UTC
 * no meio do caminho só criaria uma chance de errar uma hora duas vezes por ano,
 * no horário de verão.
 */
export function instanteDeParede(quando = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(quando);
  const p = (t: string) => Number(partes.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(p("year"), p("month") - 1, p("day"), p("hour") % 24, p("minute")) / 60000;
}

/**
 * A PADARIA ESTAVA (OU ESTARÁ) ABERTA NESTE INSTANTE?
 *
 * A mesma pergunta de `padariaAberta`, só que com o relógio na mão em vez do
 * relógio da parede. É o que o lembrete da retirada usa pra decidir se pode
 * escrever pro cliente agora, e é o que faz o teste dele conseguir medir um
 * domingo às 14h sem esperar domingo chegar.
 *
 * Feriado a gente não sabe, e por isso ninguém aqui promete hora exata.
 */
export function abertaNoInstante(minutoDeParede: number): boolean {
  const d = new Date(minutoDeParede * 60000);
  const minutos = d.getUTCHours() * 60 + d.getUTCMinutes();
  const faixas = d.getUTCDay() === 0 ? DOMINGO : SEMANA;
  return faixas.some((f) => minutos >= f.de && minutos < f.ate);
}

export function padariaAberta(): boolean {
  return abertaNoInstante(instanteDeParede());
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
