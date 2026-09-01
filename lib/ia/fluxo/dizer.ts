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
import { COMO_VAI } from "./falas-do-cliente";
import { semAcento } from "../texto";
import { produtosNaFrase } from "./leitor-da-frase";

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
  "- Sem emoji nem travessão." + String.fromCharCode(10) +
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

  // PERGUNTA COM BOTAO SAI EXATAMENTE COMO O CODIGO ESCREVEU.
  //
  // Teste da Kemilly, 23/08/2026, e este e o pior defeito que este projeto teve:
  //
  //   Dora:    O bolo será entregue no prato de MDF aberto ou na embalagem com tampa?
  //   Kemilly: Com tampa
  //   Dora:    O bolo é com tampa?        <- o codigo escreveu "O bolo vai com topo?"
  //   Kemilly: Sim
  //
  // A reescrita, vendo que a ultima fala dela tinha sido "Com tampa", trocou o
  // assunto da pergunta. Ela respondeu "Sim" achando que confirmava a
  // embalagem, e o sistema gravou TOPO = SIM. Depois ela disse "nao quero topo"
  // tres vezes e a padaria insistiu, por causa de um sim que ela nunca deu.
  //
  // Onde a resposta e fechada, o texto e lei: o cliente toca num botao e aquele
  // toque vira dado. Trocar a pergunta e trocar o dado.
  //
  // A reescrita continua valendo em pergunta aberta, que e onde a conversa fica
  // humana e onde nao ha risco de virar dado errado.
  if (fala.botoes?.length) return texto;

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
    }, {
      // O TURNO TEM 60 SEGUNDOS, E ESTA E A SEGUNDA CHAMADA DE IA DELE.
      //
      // O SDK da OpenAI vem com 10 minutos de timeout e 2 tentativas, e nada
      // aqui dizia o contrario. A primeira chamada (a leitura, no
      // `pensar-openai.ts`) ja foi corrigida em 28/08/2026 pelo mesmo motivo, e
      // esta ficou pra tras: uma reescrita travada mata o turno DEPOIS de a IA
      // ja ter sido cobrada duas vezes, e o cliente nao recebe nada.
      //
      // Aqui o prazo e mais curto que o da leitura: reescrever e enfeite, e o
      // texto do codigo ja esta pronto e correto. Estourar aqui nao perde
      // resposta nenhuma, so o jeito de falar.
      timeout: 8000,
      maxRetries: 0,
    });

    registrar?.({
      tokensIn: r.usage?.prompt_tokens ?? 0,
      tokensOut: r.usage?.completion_tokens ?? 0,
    });

    const saiu = String(r.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (!saiu) return texto;

    // ELA INVENTOU NUMERO? VAI O TEXTO DO CODIGO.
    //
    // Texto com dinheiro do motor nem chega na reescrita. Nos demais, todo
    // numero que sai precisa existir no original: assim "fica 44,90" nao passa
    // so porque o modelo esqueceu o R$. A comparacao e de formato, nao de uma
    // lista de palavras.
    const numeros = (t: string) => t.match(/[0-9]+(?:[.,][0-9]+)*/g) ?? [];
    const noOriginal = new Set(numeros(texto));
    const inventouNumero = numeros(saiu).some((n) => !noOriginal.has(n));
    if ((/R\$\s?[0-9]/.test(saiu) && !/R\$\s?[0-9]/.test(texto)) || inventouNumero) {
      console.warn("[fala] a reescrita inventou valor; mandei o texto do codigo:", saiu.slice(0, 80));
      return texto;
    }

    // A REESCRITA NAO PODE TROCAR AS OPCOES DA ESCOLHA.
    //
    // Medido conversando com a producao em 02/09/2026, numa conversa com festa,
    // pizza e pao na mesma mensagem:
    //
    //   codigo >> Qual pizza voce quer: pizza inteira, pizza meia ou redonda?
    //   saiu   >> Qual forminha dourada voce quer, brigadeiro ou beijinho?
    //
    // Ela trocou o ASSUNTO da pergunta pelo assunto do turno anterior. O cliente
    // recebe uma escolha que nao existe, responde qualquer coisa, e a conversa
    // anda pro lado errado com o pedido no meio.
    //
    // Numero ja era conferido aqui. Opcao de escolha e a mesma coisa: e conteudo
    // do codigo, e nao jeito de falar. Faltando uma delas, vai a frase do
    // motor, que e feia e certa.
    // O QUE O CODIGO ESCREVEU TEM QUE CONTINUAR LA: opcao e nome de produto.
    //
    // A troca de assunto foi vista mais de uma vez, e nao so na pizza. Entao a
    // conferencia nao e de uma lista escrita aqui: e do que ESTAVA no texto do
    // motor. Se o codigo citou "pizza redonda", a frase que sai cita tambem.
    //
    // O contrario (a reescrita ACRESCENTAR produto) tambem cai: dizer "temos
    // coxinha tambem" numa pergunta de bolo e oferecer o que a etapa nao esta
    // oferecendo, e ja aconteceu com sabor que a casa nem faz.
    const saiuSemAcento = semAcento(saiu);
    const noTexto = semAcento(texto);

    const opcoes = (fala.opcoes ?? []).map((o) => semAcento(String(o))).filter(Boolean);
    const opcaoSumiu = opcoes.filter((o) => !saiuSemAcento.includes(o));
    if (opcaoSumiu.length) {
      console.warn("[fala] a reescrita trocou as opcoes; mandei o texto do codigo:", saiu.slice(0, 80));
      return texto;
    }

    const doCodigo = produtosNaFrase(texto).map((n) => semAcento(n));
    const daReescrita = produtosNaFrase(saiu).map((n) => semAcento(n));
    const produtoSumiu = doCodigo.some((n) => !saiuSemAcento.includes(n));
    const produtoNovo = daReescrita.some((n) => !noTexto.includes(n));
    if (produtoSumiu || produtoNovo) {
      console.warn(
        "[fala] a reescrita mexeu nos produtos da frase; mandei o texto do codigo:",
        saiu.slice(0, 80),
      );
      return texto;
    }

    // Duas perguntas viram formulario: o codigo faz uma por vez de proposito.
    //
    // SAUDACAO NAO CONTA COMO PERGUNTA. "Boa noite, tudo bem? Qual bolo voce
    // quer?" e UMA pergunta com um cumprimento na frente, e a guarda estava
    // barrando isso: sobrava sempre a mesma frase do codigo, que e justamente o
    // robotismo que a reescrita existe pra evitar.
    // A lista de saudacao mora com quem cumprimenta. Esta era a terceira copia
    // dela, e ja tinha uma entrada a mais que as outras duas ("como voce esta").
    const semSaudacao = COMO_VAI.reduce(
      (t, c) => t.replace(new RegExp(c + "\\s*\\?", "gi"), ""),
      saiu.replace(/como voc[êe] est[áa]\s*\?/gi, ""),
    );
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
