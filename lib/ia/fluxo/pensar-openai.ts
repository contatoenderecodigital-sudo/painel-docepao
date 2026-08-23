// ============================================================================
//  A CHAMADA DA IA, DENTRO DA ETAPA
//
//  Esta e a unica parte do fluxo novo que gasta dinheiro, e e a menor de todas.
//
//  O QUE MUDA EM RELACAO A VERSAO ANTIGA
//
//  La ia a carta inteira em toda mensagem: persona, cardapio completo, regras,
//  historico, doze ferramentas. O modelo tinha que decidir o rumo da conversa,
//  escolher ferramenta, montar preco e escrever a resposta, e ainda respeitar
//  quarenta guardas que corrigiam depois.
//
//  Aqui ele recebe uma pergunta so: "estando NESTA etapa, o que esta frase
//  muda no pedido?". A instrucao cabe num paragrafo (374 a 704 caracteres),
//  nao ha ferramenta, nao ha laco, e a resposta e um JSON pequeno.
//
//  RESPOSTA EM FORMATO FIXO
//
//  response_format json_object: o modelo nao tem como devolver conversa no
//  lugar do dado. Se vier algo fora do esperado, a leitura sai vazia e o fluxo
//  segue perguntando — nunca inventa item.
// ============================================================================

import OpenAI from "openai";
import type { Leitura } from "./leitura";
import type { Pensar } from "./fluxo";

const MODELO = process.env.OPENAI_MODEL_FLUXO || "gpt-4.1-mini";

/** O formato que o modelo tem que devolver. Nada alem disto e lido. */
const FORMATO = `Responda SÓ com um JSON, sem texto em volta, neste formato:

{
  "itens": [{ "produto": "nome do cardápio", "qtd": 0, "obs": "sabor, cor, tema" }],
  "pessoas": 0,
  "aceitouBase": false,
  "naoQuer": ["salgado"],
  "pecas": { "topo": false, "papelDeArroz": false },
  "dados": { "nome": "", "data": "DD/MM/AAAA", "hora": "HH:MM", "pagamento": "pix" },
  "falouDeOutraEtapa": "bolo",
  "recomecar": false
}

Mande SÓ os campos que a mensagem mudou. Campo que não mudou, não mande.
Se a mensagem não mudou nada no pedido, mande {}.`;

/**
 * Monta a funcao que o fluxo chama pra pensar.
 *
 * `registrar` recebe o custo de cada chamada, pra medir sem depender de tabela
 * de preco: quem manda no numero e o uso que o proprio provedor devolve.
 */
export function pensarComOpenAI(
  cliente: OpenAI,
  registrar?: (uso: { tokensIn: number; tokensOut: number; cacheRead: number }) => void,
): Pensar {
  return async ({ instrucao, mensagem }) => {
    const r = await cliente.chat.completions.create({
      model: MODELO,
      // Temperatura baixa: aqui nao se quer criatividade, se quer leitura.
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instrucao + "\n\n" + FORMATO },
        { role: "user", content: mensagem },
      ],
    });

    const u = r.usage;
    registrar?.({
      tokensIn: u?.prompt_tokens ?? 0,
      tokensOut: u?.completion_tokens ?? 0,
      cacheRead: u?.prompt_tokens_details?.cached_tokens ?? 0,
    });

    const bruto = r.choices?.[0]?.message?.content ?? "{}";
    try {
      const lido = JSON.parse(bruto) as Leitura;
      // Campo vazio que o modelo mandou por educacao nao vira mudanca: "dados"
      // com tudo null apagaria o que ja estava anotado.
      const limpo: Leitura = {};
      if (Array.isArray(lido.itens) && lido.itens.length) {
        limpo.itens = lido.itens
          .filter((i) => i && String(i.produto ?? "").trim() && Number(i.qtd) > 0)
          .map((i) => ({ produto: String(i.produto).trim(), qtd: Number(i.qtd), obs: i.obs ?? null }));
        if (!limpo.itens.length) delete limpo.itens;
      }
      if (Number(lido.pessoas) > 0) limpo.pessoas = Number(lido.pessoas);
      if (lido.aceitouBase === true) limpo.aceitouBase = true;
      if (lido.recomecar === true) limpo.recomecar = true;
      if (Array.isArray(lido.naoQuer) && lido.naoQuer.length) {
        limpo.naoQuer = lido.naoQuer.map(String).filter(Boolean);
      }
      if (lido.pecas && typeof lido.pecas === "object") {
        limpo.pecas = {
          topo: lido.pecas.topo === true,
          papelDeArroz: lido.pecas.papelDeArroz === true,
        };
      }
      if (lido.dados && typeof lido.dados === "object") {
        const d: NonNullable<Leitura["dados"]> = {};
        for (const k of ["nome", "data", "hora", "pagamento"] as const) {
          const v = String(lido.dados[k] ?? "").trim();
          if (v) d[k] = v;
        }
        if (Object.keys(d).length) limpo.dados = d;
      }
      if (lido.falouDeOutraEtapa) limpo.falouDeOutraEtapa = lido.falouDeOutraEtapa;
      return limpo;
    } catch {
      // JSON quebrado nao trava a conversa: o fluxo segue perguntando o mesmo,
      // e isso e melhor que anotar lixo no pedido de alguem.
      console.warn("[fluxo] o modelo devolveu algo que nao e JSON; ignorei:", bruto.slice(0, 160));
      return {};
    }
  };
}
