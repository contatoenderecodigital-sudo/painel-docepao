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
import type { PedidoEmMontagem } from "./etapas";

export type Base = {
  salgados: number;
  docinhos: number;
  boloKg: number;
  totalCentavos: number;
};

/** O que entra na base: tudo, menos o que ele dispensou. */
function oQueEleQuer(p: PedidoEmMontagem): { salgado: boolean; doce: boolean; bolo: boolean } {
  const recusou = (o: string) => p.naoQuer.some((x) => new RegExp(o, "i").test(x));
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
