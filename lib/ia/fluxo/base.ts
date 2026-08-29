// ============================================================================
//  A BASE DA FESTA
//
//  Calcula a base pelo numero de pessoas e, quando o cliente aceita, TRANSFORMA
//  A BASE EM ITENS DE VERDADE.
//
//  OS DOIS DEFEITOS QUE ISTO CONSERTA
//
//  1. A BASE VINHA SEM BOLO E SEM DOCINHO.
//
//     No primeiro teste com a conversa real do Sandro saiu "200 salgados no
//     total, 0 docinhos e 0 kg de bolo, R$ 325,00", quando o certo era 100
//     docinhos, 2 kg e R$ 418,80. Eu chamava sugerirPorPessoas sem dizer quais
//     familias entram, e o motor so devolvia salgado.
//
//     O motor sempre soube fazer certo: quem estava errado era a chamada.
//
//  2. ACEITAR A BASE NAO ANOTAVA NADA.
//
//     Conversa real do Sandro, 22/08/2026, com a Dora antiga:
//
//       Dora:    Pra 20 pessoas... Da R$ 418,80 no total.
//       cliente: Pode ser, vou querer bolo tambem dai
//       Dora:    Agora me diz: o pedido fica no nome de quem...
//
//     Nada foi anotado. O pedido continuou vazio depois de um aceite de
//     R$ 418,80, e ela ainda perguntou se ele queria os salgados que ja estavam
//     na base que ele acabara de aceitar.
//
//     Aceitar a base E o pedido. Aqui ela vira item na hora.
// ============================================================================

import { motorPadrao } from "../orcamento";
import catalogo from "../dados/catalogo.json";
import { produtosDaCasa } from "../dados/produtos";
import type { PedidoEmMontagem } from "./etapas";
import { formasDoCliente } from "../texto";

export type Base = {
  salgados: number;
  docinhos: number;
  boloKg: number;
  totalCentavos: number;
};

/**
 * O que entra na base: tudo, menos o que ele dispensou.
 *
 * A RECUSA E LIDA DO JEITO QUE ELE ESCREVE, e esta era a segunda copia da mesma
 * regra: a primeira, na etapa, ja tinha sido consertada em 28/08/2026 e esta
 * ficou pra tras comparando a palavra crua. Medido, numa festa de 20 pessoas:
 *
 *   naoQuer ["salgado"]     ->  a base tira os 200 salgados
 *   naoQuer ["salgadinho"]  ->  a base continua com os 200, R$ 200 a mais
 *
 * O cliente dizia que nao queria e recebia a proposta com aquilo dentro.
 */
function oQueEleQuer(p: PedidoEmMontagem): { salgado: boolean; doce: boolean; bolo: boolean } {
  const recusou = (o: string) =>
    p.naoQuer.some((x) => formasDoCliente(x).some((f) => new RegExp(o, "i").test(f)));
  return {
    salgado: !recusou("salgado"),
    doce: !recusou("docinho|doce"),
    bolo: !recusou("bolo"),
  };
}

/**
 * A BASE, CALCULADA PELO MOTOR.
 *
 * O mesmo motor que faz a conta do pedido fechado: se ele errar, erram os dois
 * juntos, e o cliente nunca ve um numero na proposta e outro na cobranca.
 */
export function calcularBase(p: PedidoEmMontagem): Base | null {
  const pessoas = Number(p.pessoas) || 0;
  if (pessoas <= 0) return null;

  const c = motorPadrao.sugerirPorPessoas(pessoas, oQueEleQuer(p));
  const soma = (rx: RegExp) =>
    (c.linhas ?? [])
      .filter((l) => rx.test(String(l.categoria ?? "")))
      .reduce((t, l) => t + Number(l.qtd || 0), 0);

  return {
    salgados: soma(/^salgado/i),
    docinhos: soma(/^doce|^docinho/i),
    boloKg: soma(/^bolo/i),
    totalCentavos: Math.round(Number(c.total || 0) * 100),
  };
}

// AQUI FICAVA baseVirandoItens, QUE ESCOLHIA OS SABORES SOZINHA.
//
// Ela pegava os cinco salgados e os quatro docinhos mais pedidos e dividia a
// proposta entre eles no instante em que o cliente tocava em "Pode ser". O dono
// viu no teste de 23/08/2026 e chamou pelo nome: "escolheu os salgadinhos e os
// docinhos sortidos por conta propria", sem nunca mandar o cardapio.
//
// A proposta diz QUANTO. QUAL e escolha do cliente, e e pra isso que existem as
// etapas do salgado e do docinho. Quem reparte o total entre o que ele escolheu
// agora e repartirABase, no fluxo, e so depois de ele escolher.

// ============================================================================
//  O MINIMO POR SABOR: SUGERE, NUNCA RECUSA.
//
//  A dona ditou isto com as duas metades juntas, e as duas importam:
//
//    "Num cento de salgados, o ideal e sempre 20, no minimo 20 unidades. Claro
//     que se a cliente quiser 10 de cada, a gente abre uma excecao, e obvio.
//     Mas assim, sempre sugerir."
//
//    "Se a cliente falar 15, 15, 15, abre uma excecao, nao tem problema nenhum."
//
//  O catalogo guarda as duas: `sugerir: 20` e `recusar: false`. O no inteiro
//  estava la desde 19/08/2026 e NENHUMA LINHA DE CODIGO LIA. A padaria repartia
//  cem docinhos entre oito sabores, doze de cada, e nao dizia nada.
//
//  E O AVISO SO VALE QUANDO QUEM DIVIDIU FOMOS NOS.
//
//  Se o cliente escreveu "15 de cada", ele ja decidiu, e a dona mandou aceitar
//  sem discutir. Sugerir ali seria a padaria corrigindo uma conta que o proprio
//  cliente fez. O aviso e pro caso em que ele escolheu SABORES e o codigo
//  repartiu o total da proposta entre eles: ai ele nunca viu o numero por sabor.
// ============================================================================

/** O que a casa sugere por sabor, e quantos sabores cabem num cento. */
export function minimoPorSabor(): { sugerir: number; saboresNoCento: number } {
  const m = (catalogo as unknown as {
    _minimo_por_sabor?: { sugerir?: number; sabores_por_cento_sugeridos?: number };
  })._minimo_por_sabor;
  return {
    sugerir: Number(m?.sugerir) > 0 ? Number(m?.sugerir) : 0,
    saboresNoCento: Number(m?.sabores_por_cento_sugeridos) > 0 ? Number(m?.sabores_por_cento_sugeridos) : 0,
  };
}

/**
 * A FRASE DA SUGESTAO, ou null quando nao ha o que sugerir.
 *
 * Sai NA FRENTE da pergunta da etapa, como o aviso de restricao, e vive um
 * turno so. Nao e pergunta e nao trava nada: o pedido segue exatamente como
 * esta se o cliente nao disser nada.
 */
export function avisoDePoucoPorSabor(qtds: number[]): string | null {
  const { sugerir } = minimoPorSabor();
  if (!sugerir || !qtds.length) return null;
  const abaixo = qtds.filter((q) => q > 0 && q < sugerir);
  if (!abaixo.length) return null;
  const menor = Math.min(...abaixo);
  return (
    "Dividindo assim ficam " + menor + " de alguns sabores. A casa costuma sugerir " +
    "pelo menos " + sugerir + " de cada, mas dá pra fazer do jeito que você preferir."
  );
}

/**
 * O SORTIDO DA CASA, quando ele pede pra padaria escolher os tipos.
 *
 * Nao e ranking nem lista de favoritos. Sai da ordem do catalogo, com a conta
 * que a dona ditou: uns 20 de cada e 5 sabores no cento. Quem tem sabor fixo
 * entra sem observacao; quem tem lista ganha o primeiro sabor do catalogo, pra
 * a etapa nao ficar perguntando o que a casa ja escolheu.
 *
 * Bolo de festa e um so: o primeiro da lista, no peso que a proposta combinou.
 */
export function sortidoDaCasa(
  categorias: string[],
  total: number,
): { produto: string; categoria: string; qtd: number; obs: string | null }[] {
  if (!(total > 0) || !categorias.length) return [];
  const soFesta = categorias.includes("bolo_festa");
  const candidatos = produtosDaCasa().filter(
    (p) => categorias.includes(p.categoria) && (!soFesta || p.categoria === "bolo_festa"),
  );
  if (!candidatos.length) return [];

  const porKg = soFesta || candidatos.every((p) => p.unidade === "kg");
  if (porKg) {
    const p = candidatos[0];
    return [{ produto: p.nome, categoria: p.categoria, qtd: total, obs: null }];
  }

  const { sugerir, saboresNoCento } = minimoPorSabor();
  const tetoCento =
    saboresNoCento > 0 ? saboresNoCento * Math.max(1, Math.round(total / 100)) : candidatos.length;
  const tetoMinimo = sugerir > 0 ? Math.max(1, Math.floor(total / sugerir)) : candidatos.length;
  const n = Math.min(candidatos.length, Math.max(1, Math.min(tetoCento, tetoMinimo)));
  const escolhidos = candidatos.slice(0, n);
  const cada = Math.floor(total / n);
  const resto = total - cada * n;
  return escolhidos.map((p, i) => ({
    produto: p.nome,
    categoria: p.categoria,
    qtd: cada + (i === 0 ? resto : 0),
    obs: p.saborFixo || !p.sabores.length ? null : p.sabores[0],
  }));
}
