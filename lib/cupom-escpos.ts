// ============================================================================
//  O PAPEL QUE VAI PRO MURAL DA COZINHA.
//
//  A regra é da dona, dita por ela nos áudios:
//
//    "Tudo vai ficar separado por segmentos. Empadão é uma coisa, torta doce é
//     outra coisa, torta recheada é outra coisa. É tudo separado."
//
//  E o motivo é produção em etapas, não organização:
//
//    "Os docinhos é uma coisa que eu posso fazer cinco horas antes. Mas daí o
//     salgado eu tenho que preparar no momento, tipo 15 minutos antes da pessoa
//     chegar. Por isso elas precisam estar separadas pra vir pra frente e a
//     gente já ir dando ok."
//
//  Cada comanda avisa o que MAIS o cliente pediu, porque já deu errado:
//
//    "A Apoliana pegou um pedido que tinha tudo junto, e daí a outra não viu no
//     mural que tinha um pedaço de torta."
//
//    "No bolo tem que estar escrito que ela encomendou salgados e docinhos, nos
//     doces tem que estar escrito que ela encomendou bolo e salgados, que aí a
//     gente se liga."
//
//  E o papel NÃO leva nome de setor:
//
//    "Não precisa colocar salgadeiro, padeiro, confeiteiro, porque vai tudo pra
//     mesma sala. A gente só queria que eles tivessem separados."
//
//  MONTADO AQUI, NO SERVIDOR, e não na ponte que roda na padaria: enquanto era
//  lá, mudar o layout exigia trocar o arquivo naquela máquina E reiniciar o
//  programa. Isso falhou do jeito previsível, o arquivo foi corrigido às 02:17 e
//  o processo rodava desde as 14:26 do dia anterior, então continuou imprimindo
//  o layout velho da memória.
// ============================================================================

import { deptoDe, deptosDoPedido, nomeDaComanda, qtdDoTicket, type DeptoId } from "./departamentos";

export type ItemCupom = {
  produto: string;
  categoria: string;
  qtd: number;
  obs?: string | null;
  unidade?: string | null;
  unitCentavos?: number;
  subtotalCentavos?: number;
};

export type PedidoCupom = {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  retiradaData: string | null;
  retiradaHora: string | null;
  pessoas: number | null;
  totalCentavos: number;
  formaPagamento: string | null;
  observacoes: string | null;
  itens: ItemCupom[];
};

// Comandos da impressora termica.
const ESC = "\x1B";
const GS = "\x1D";
const INICIO = ESC + "@";
const CENTRO = ESC + "a\x01";
const ESQUERDA = ESC + "a\x00";
const NEGRITO_ON = ESC + "E\x01";
const NEGRITO_OFF = ESC + "E\x00";
const GRANDE_ON = GS + "!\x11";
const GRANDE_OFF = GS + "!\x00";
const CORTAR = GS + "V\x42\x00";
const LARGURA = 48; // colunas de uma impressora de 80mm

// Impressora termica engasga com acento: sai caractere trocado no meio da
// palavra. Melhor "PAES E CUCAS" legivel do que "PÃES" virando ruido.
function semAcento(t: string): string {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function risco(c = "="): string {
  return c.repeat(LARGURA);
}

function dinheiro(centavos: number | undefined): string {
  return "R$ " + (Number(centavos || 0) / 100).toFixed(2).replace(".", ",");
}

function dataBR(iso: string | null): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

// Quebra na largura do papel em vez de deixar a impressora cortar no meio da
// palavra: "esfirra de calabresa com catupiry" virava "...com catupi" e quem
// esta assando ficava adivinhando o resto.
function quebrar(texto: string, largura = LARGURA): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of semAcento(texto).split(/\s+/)) {
    if ((atual + " " + p).trim().length > largura) {
      if (atual) linhas.push(atual.trim());
      atual = p;
    } else {
      atual = (atual + " " + p).trim();
    }
  }
  if (atual) linhas.push(atual.trim());
  return linhas;
}

// O cabecalho e igual em toda comanda. Nas palavras dela: "a comanda e simples,
// e nome do cliente, e dia, e horario e e a quantidade".
function cabecalho(titulo: string, p: PedidoCupom): string {
  let t = INICIO + CENTRO + NEGRITO_ON + GRANDE_ON;
  t += semAcento(titulo) + "\n" + GRANDE_OFF;
  t += "Doce Pao\n" + NEGRITO_OFF + ESQUERDA + risco() + "\n";
  t += NEGRITO_ON + "CLIENTE: " + semAcento(p.clienteNome || "-") + "\n" + NEGRITO_OFF;
  // Dia e hora em corpo grande: e o que a producao procura primeiro. Pedido sem
  // data grita, em vez de sair um espaco em branco que ninguem nota.
  const data = dataBR(p.retiradaData);
  t += NEGRITO_ON + GRANDE_ON;
  t += "RETIRADA: " + (data || "SEM DATA") + (p.retiradaHora ? " " + p.retiradaHora : "") + "\n";
  t += GRANDE_OFF + NEGRITO_OFF;
  if (p.pessoas) t += "Festa de " + p.pessoas + " pessoas\n";
  t += "Pedido #" + String(p.id).slice(0, 8) + "\n" + risco() + "\n";
  return t;
}

function linhasDosItens(itens: ItemCupom[], comPreco: boolean): string {
  let t = "";
  for (const i of itens) {
    t += NEGRITO_ON + GRANDE_ON + qtdDoTicket(i) + GRANDE_OFF + "  " + semAcento(i.produto).toUpperCase() + "\n" + NEGRITO_OFF;
    // A observacao e o sabor, o recheio, a cor da forminha, o tema do topo. Sem
    // ela nao ha o que assar: "3 cucas recheadas" sem sabor ja foi pra cozinha.
    if (i.obs) for (const l of quebrar("  > " + i.obs)) t += l + "\n";
    if (comPreco) {
      t += "  " + qtdDoTicket(i) + " x " + dinheiro(i.unitCentavos) + " = " + dinheiro(i.subtotalCentavos) + "\n";
    }
  }
  return t;
}

// "CLIENTE TAMBEM PEDIU": a referencia cruzada que ela pediu em cada comanda.
// Sem isso a pessoa da bancada pega o papel dela e vai embora achando que o
// pedido acabou ali.
function referenciaCruzada(outras: DeptoId[]): string {
  if (!outras.length) return "";
  let t = risco("-") + "\n";
  t += NEGRITO_ON + "CLIENTE TAMBEM PEDIU:\n" + NEGRITO_OFF;
  for (const l of quebrar(outras.map(nomeDaComanda).join(", "))) t += l + "\n";
  return t;
}

function observacaoDoPedido(p: PedidoCupom): string {
  if (!p.observacoes) return "";
  let t = risco("-") + "\n";
  t += NEGRITO_ON + "OBS:\n" + NEGRITO_OFF;
  for (const l of quebrar(p.observacoes)) t += l + "\n";
  return t;
}

// UMA COMANDA POR SEGMENTO, com o subtotal dela.
//
// O subtotal ajuda a conferir com o caixa quando o pedido chega na frente por
// partes, que e como ela trabalha: "a gente vai dar ok na nossa comandinha aqui
// na frente, que a torta fria ta pronta".
function comanda(p: PedidoCupom, id: DeptoId, itens: ItemCupom[], outras: DeptoId[]): string {
  let t = cabecalho("== " + nomeDaComanda(id) + " ==", p);
  t += linhasDosItens(itens, false);
  t += risco("-") + "\n";
  const subtotal = itens.reduce((s, i) => s + Number(i.subtotalCentavos || 0), 0);
  t += NEGRITO_ON + "Subtotal desta comanda: " + dinheiro(subtotal) + "\n" + NEGRITO_OFF;
  t += observacaoDoPedido(p);
  t += referenciaCruzada(outras);
  return t + "\n\n\n" + CORTAR;
}

// O PAPEL DO CAIXA: o pedido inteiro, com valores e a forma de pagamento.
//
// E o unico que junta tudo, e serve pra fechar o valor com o cliente na
// retirada: "veio um pedido so de salgado no caixa, mas eu vou ler embaixo que
// tem bolo".
function caixa(p: PedidoCupom): string {
  let t = cabecalho("== CAIXA ==", p);
  if (p.clienteTelefone) t += "Fone: " + p.clienteTelefone + "\n";
  t += linhasDosItens(p.itens, true);
  t += risco("-") + "\n";
  t += NEGRITO_ON + GRANDE_ON + "TOTAL: " + dinheiro(p.totalCentavos) + "\n" + GRANDE_OFF + NEGRITO_OFF;
  // Sem forma combinada vale o padrao da casa: paga na retirada.
  const forma = String(p.formaPagamento || "").trim();
  t += NEGRITO_ON + (forma ? "Pagamento: " + semAcento(forma).toUpperCase() : "Pagamento na RETIRADA") + "\n" + NEGRITO_OFF;
  t += observacaoDoPedido(p);
  return t + "\n\n\n" + CORTAR;
}

// Todos os papeis de um pedido: uma comanda por segmento, mais o caixa.
export function montarCupons(p: PedidoCupom): string[] {
  const porComanda = new Map<DeptoId, ItemCupom[]>();
  for (const i of p.itens || []) {
    const id = deptoDe(i);
    porComanda.set(id, [...(porComanda.get(id) ?? []), i]);
  }
  // Ordem da producao, a mesma da lista de departamentos.
  const ordem = deptosDoPedido({ itens: p.itens } as never);

  const saida: string[] = [];
  for (const id of ordem) {
    const itens = porComanda.get(id);
    if (!itens?.length) continue;
    saida.push(comanda(p, id, itens, ordem.filter((o) => o !== id)));
  }
  saida.push(caixa(p));
  return saida;
}
