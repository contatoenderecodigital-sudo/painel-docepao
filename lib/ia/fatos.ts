// ============================================================================
//  POLITICA E FATO DA CASA SO SAEM DAQUI.
//
//  Teste com clientes ao vivo, 19/08/2026. Ela disse, sem ninguem ter falado
//  nada disso:
//
//    "Fazemos docinho sem lactose, sim. E vendido por unidade, com minimo de
//     20 de cada sabor."          -> produto e minimo inventados
//    "Cada quilo serve cerca de 10 pessoas"   -> rendimento inventado
//    "Um quilo de cuca serve umas 8 a 10 pessoas"  -> idem
//
//  Isso nao e chatice, e exposicao da dona. Em Moffatt contra Air Canada o
//  tribunal obrigou a empresa a HONRAR a politica que o proprio chatbot
//  inventou, e rejeitou a defesa de que o bot seria entidade separada. Minimo
//  de pedido inventado no WhatsApp e minimo que o cliente pode cobrar.
//
//  O enum de produtos ja impediu ela de VENDER o que nao existe. Aqui e o outro
//  lado: impedir que ela AFIRME regra que a padaria nao tem.
//
//  A regra e simples: se a afirmacao nao esta autorizada aqui, ela nao sai. No
//  lugar vai a verdade, que e "a equipe confirma isso com voce".
// ============================================================================

import catalogo from "./dados/catalogo.json";

export type FatosDaCasa = {
  // Quantidade minima por pedido. null = a padaria NAO tem minimo, entao
  // qualquer "minimo de N" que ela escrever e invencao.
  pedidoMinimo: number | null;
  // Quantos dias de antecedencia. Vem da config do negocio.
  prazoMinimoDias: number | null;
  // Entrega: null = nao existe entrega combinada, quem responde e a equipe.
  entrega: string | null;
  // Rendimento autorizado, por produto. Quem nao esta aqui, ela nao chuta.
  serve: Record<string, string>;
};

export function fatosDaCasa(cfg?: { prazoMinimoDias?: number }): FatosDaCasa {
  const serve: Record<string, string> = {};
  // O unico rendimento que tem fonte e o da pizza, que esta no cardapio dela.
  const p = catalogo.pizza as { inteira?: { serve?: number[] }; meia?: { serve?: number[] } };
  if (p?.inteira?.serve) serve["pizza inteira"] = p.inteira.serve.join(" a ") + " pessoas";
  if (p?.meia?.serve) serve["pizza meia"] = p.meia.serve.join(" a ") + " pessoas";
  return {
    pedidoMinimo: null,
    prazoMinimoDias: cfg?.prazoMinimoDias ?? null,
    entrega: null,
    serve,
  };
}

const semAc = (t: unknown): string =>
  String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// AFIRMACOES DE POLITICA QUE A CASA NAO AUTORIZOU.
//
// Devolve a lista do que ela escreveu e nao pode. Cada entrada e a frase
// inteira, pra quem le o log saber exatamente o que quase saiu.
export function afirmacoesNaoAutorizadas(texto: string, fatos: FatosDaCasa): string[] {
  const fora: string[] = [];
  const frases = String(texto ?? "").split(/(?<=[.!?\n])/);

  for (const frase of frases) {
    const f = semAc(frase);
    if (!f.trim()) continue;

    // 1. MINIMO DE PEDIDO. A padaria nao tem, entao qualquer numero e invencao.
    //    "no minimo 20", "minimo de 20 unidades", "a partir de 20 pecas"
    const falaDeMinimo =
      /\bminimo\b[^.!?]{0,25}\b[0-9]+/.test(f) ||
      /\b[0-9]+[^.!?]{0,25}\bno minimo\b/.test(f) ||
      /\ba partir de\s+[0-9]+\s*(unidades?|pecas?|un\b|docinhos?|salgados?)/.test(f);
    if (falaDeMinimo && fatos.pedidoMinimo === null) {
      fora.push(frase.trim());
      continue;
    }

    // 2. ENTREGA. Prometer entrega ou taxa sem a casa ter isso definido.
    const prometeEntrega =
      /\b(entrega|entregamos|delivery|levamos ate|taxa de entrega|frete)\b/.test(f) &&
      // Passar pra equipe NAO e promessa: e a resposta certa.
      !/\b(equipe|confirma|confirmar|verifica|nao (temos|fazemos)|so (retirada|na loja))\b/.test(f);
    if (prometeEntrega && fatos.entrega === null) {
      fora.push(frase.trim());
      continue;
    }

    // 3. RENDIMENTO. "serve 10 pessoas", "da pra 20 pessoas", "rende 30".
    const falaDeRendimento =
      /\b(serve|da pra|rende|atende)\b[^.!?]{0,20}\b[0-9]+[^.!?]{0,12}\bpessoas?\b/.test(f) ||
      /\bpara\s+[0-9]+\s+pessoas\b[^.!?]{0,20}\b(1|um|cada)\s*(kg|quilo)/.test(f);
    if (falaDeRendimento) {
      // Autorizado so pro que tem fonte no cardapio (a pizza).
      const temFonte = Object.keys(fatos.serve).some((k) => {
        const chave = semAc(k).split(" ")[0];
        return chave && f.includes(chave);
      });
      if (!temFonte) {
        fora.push(frase.trim());
        continue;
      }
    }

    // 4. PRAZO. So pode dizer o que esta na config do negocio.
    const falaDePrazo = /\b[0-9]+\s*(dias?|semanas?)\b[^.!?]{0,25}\b(antecedencia|antes|previo)/.test(f);
    if (falaDePrazo && fatos.prazoMinimoDias === null) {
      fora.push(frase.trim());
      continue;
    }
  }
  return fora;
}

// A verdade que entra no lugar do que foi cortado.
export const RECADO_DA_EQUIPE =
  "Isso eu prefiro confirmar com a equipe pra nao te passar nada errado, ja te falo.";
