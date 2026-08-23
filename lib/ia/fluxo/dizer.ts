// ============================================================================
//  O JEITO DE FALAR
//
//  O codigo decide O QUE dizer; esta peca decide COMO dizer.
//
//  POR QUE ELA EXISTE
//
//  No primeiro teste com as conversas reais o fluxo acertou o pedido e errou o
//  tom:
//
//    cliente: quero um bolo e docinhos pra festa do meu filho arthur
//    padaria: Quantas pessoas vão na festa?
//
//  O pedido saiu certo e a conversa saiu dura. Quem manda isso pra uma mae que
//  acabou de falar do aniversario do filho parece formulario, nao padaria.
//
//  O QUE ELA PODE E O QUE NAO PODE
//
//  Ela reescreve a MESMA pergunta com outras palavras, e pode reconhecer o que
//  o cliente falou ("que legal, festa do Arthur"). Ela NAO pode:
//
//    - mudar a pergunta nem juntar duas numa mensagem
//    - falar de valor, quantidade ou produto que nao esteja no texto original
//    - prometer nada
//
//  E onde tem dinheiro (a base da festa, o resumo do pedido) ela nem e chamada:
//  a fala vem marcada com podeReescrever false e sai como o motor escreveu. Foi
//  assim que nasceu o "R$ 44,90 o quilo" numa torta de R$ 36,90.
//
//  SE FALHAR, VAI O TEXTO DO CODIGO
//
//  Erro de rede, resposta estranha, o que for: o texto original vai puro. O
//  cliente nunca fica sem resposta porque a reescrita nao deu certo.
// ============================================================================

import type OpenAI from "openai";
import type { Fala } from "./pergunta";

const MODELO = process.env.OPENAI_MODEL_FALA || "gpt-4.1-mini";

const REGRAS =
  "Você é a atendente de uma padaria de bairro, no WhatsApp. Reescreva a " +
  "mensagem abaixo com as suas palavras, do jeito que uma pessoa fala." +
  String.fromCharCode(10, 10) +
  "REGRAS QUE NÃO SE QUEBRAM:" + String.fromCharCode(10) +
  "- Faça a MESMA pergunta. Não mude o assunto, não acrescente pergunta nova." + String.fromCharCode(10) +
  "- Não fale de preço, quantidade ou produto que não esteja na mensagem." + String.fromCharCode(10) +
  "- Não prometa prazo, desconto nem nada que não esteja lá." + String.fromCharCode(10) +
  "- Uma pergunta só, no máximo duas frases curtas." + String.fromCharCode(10) +
  "- Sem emoji." + String.fromCharCode(10) +
  "- Responda só com o texto, sem aspas e sem explicação.";

/**
 * O CLIENTE ACABOU DE FALAR ISTO.
 *
 * Vai junto pra ela poder reconhecer ("que legal, festa do Arthur") em vez de
 * emendar a pergunta seca. E so a ultima fala: o resto da conversa nao muda o
 * jeito de fazer UMA pergunta, e mandar tudo custaria caro a toa.
 */
export async function dizerComJeito(
  cliente: OpenAI,
  fala: Fala,
  ultimaFalaDoCliente: string,
  registrar?: (uso: { tokensIn: number; tokensOut: number }) => void,
): Promise<string> {
  const texto = String(fala.texto || "").trim();
  if (!texto || !fala.podeReescrever) return texto;

  try {
    const r = await cliente.chat.completions.create({
      model: MODELO,
      temperature: 0.7, // aqui SE quer variacao: repetir a mesma frase e robo
      max_tokens: 120,
      messages: [
        { role: "system", content: REGRAS },
        {
          role: "user",
          content:
            "O cliente acabou de dizer: " + JSON.stringify(ultimaFalaDoCliente) +
            String.fromCharCode(10, 10) +
            "A mensagem a reescrever: " + JSON.stringify(texto),
        },
      ],
    });

    registrar?.({
      tokensIn: r.usage?.prompt_tokens ?? 0,
      tokensOut: r.usage?.completion_tokens ?? 0,
    });

    const saiu = String(r.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (!saiu) return texto;

    // ELA INVENTOU DINHEIRO? VAI O TEXTO DO CODIGO.
    //
    // O original nao tinha valor nenhum (senao nem estaria aqui), entao valor
    // na reescrita so pode ter saido da cabeca dela.
    if (/R\$\s?[0-9]/.test(saiu)) {
      console.warn("[fala] a reescrita inventou valor; mandei o texto do codigo:", saiu.slice(0, 80));
      return texto;
    }

    // Duas perguntas viram formulario: o codigo faz uma por vez de proposito.
    //
    // SAUDACAO NAO CONTA COMO PERGUNTA. "Boa noite, tudo bem? Qual bolo voce
    // quer?" e UMA pergunta com um cumprimento na frente, e a guarda estava
    // barrando isso: sobrava sempre a mesma frase do codigo, que e justamente o
    // robotismo que a reescrita existe pra evitar.
    const semSaudacao = saiu.replace(/(tudo bem|tudo bom|como vai|como voc[êe] est[áa])\s*\?/gi, "");
    if ((semSaudacao.match(/\?/g) ?? []).length > 1) {
      console.warn("[fala] a reescrita fez duas perguntas; mandei o texto do codigo:", saiu.slice(0, 80));
      return texto;
    }

    // Resposta comprida demais nao e jeito de falar, e outra coisa.
    if (saiu.length > texto.length * 3 + 80) {
      console.warn("[fala] a reescrita ficou comprida demais; mandei o texto do codigo");
      return texto;
    }

    return saiu;
  } catch (e) {
    console.error("[fala] falha ao reescrever (segue com o texto do codigo):", (e as Error)?.message ?? e);
    return texto;
  }
}
