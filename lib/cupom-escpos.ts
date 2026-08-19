// ============================================================================
//  O CUPOM DA IMPRESSORA, MONTADO NO SERVIDOR.
//
//  Por que aqui e nao na ponte, que e quem imprime:
//
//  A ponte e um programa que roda no computador da padaria e fica aberto o dia
//  inteiro. Enquanto ela montava o cupom, toda mudanca de layout exigia duas
//  coisas: alterar o arquivo NA MAQUINA DELES e reiniciar o programa. Isso
//  falhou exatamente como se esperava: o arquivo foi corrigido as 02:17 e o
//  processo estava rodando desde o dia anterior as 14:26, entao continuou
//  imprimindo o layout velho da memoria. O papel saiu com tudo junto embaixo de
//  "EXTRAS" mesmo com o conserto ja escrito no disco.
//
//  Com o cupom vindo pronto do servidor, mudanca de layout sobe junto com o
//  painel e chega na padaria na proxima impressao, sem ninguem tocar naquela
//  maquina e sem depender de alguem lembrar de reiniciar nada.
//
//  De quebra, as regras de qual item vai pra qual bancada deixam de existir em
//  dois lugares: aqui usa o mesmo lib/departamentos.ts que a tela usa, entao
//  papel e tela nunca mais discordam.
// ============================================================================

import { deptoDe, qtdDoTicket, type DeptoId } from "./departamentos";

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

const NOME_DA_BANCADA: Record<DeptoId, string> = {
  salgados: "SALGADOS",
  confeitaria: "DOCINHOS",
  bolos: "BOLO FESTA",
};

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
  for (const p of String(texto).split(/\s+/)) {
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

function cabecalhoDaRetirada(p: PedidoCupom): string {
  const data = dataBR(p.retiradaData);
  const hora = p.retiradaHora || "";
  // Corpo grande porque e a primeira coisa que a producao procura. E sem data
  // grita: pedido com hora e sem dia ja chegou na bancada como um tracinho
  // discreto do lado de um horario que parecia certo.
  return (
    NEGRITO_ON +
    GRANDE_ON +
    "RETIRADA: " +
    (data || "SEM DATA") +
    (hora ? " " + hora : "") +
    "\n" +
    GRANDE_OFF +
    NEGRITO_OFF
  );
}

// O papel de UMA bancada: so o que ela faz, e sem preco. Quem esta fritando nao
// precisa saber quanto custou, e numero a mais e numero pra ler errado.
function cupomDaBancada(p: PedidoCupom, bancada: DeptoId, itens: ItemCupom[]): string {
  let t = INICIO + CENTRO + NEGRITO_ON + GRANDE_ON;
  t += NOME_DA_BANCADA[bancada] + "\n" + GRANDE_OFF + NEGRITO_OFF;
  t += "Doce Pao\n" + ESQUERDA + risco() + "\n";
  t += NEGRITO_ON + "CLIENTE: " + (p.clienteNome || "-") + "\n" + NEGRITO_OFF;
  t += cabecalhoDaRetirada(p);
  if (p.pessoas) t += `Festa de ${p.pessoas} pessoas\n`;
  t += "Pedido #" + String(p.id).slice(0, 8) + "\n" + risco() + "\n";

  for (const i of itens) {
    t += NEGRITO_ON + GRANDE_ON + qtdDoTicket(i) + GRANDE_OFF + "  " + i.produto.toUpperCase() + "\n" + NEGRITO_OFF;
    // A observacao e o sabor, o recheio, a cor da forminha. Sem ela nao ha o
    // que assar: "3 cucas recheadas" sem sabor ja foi pra cozinha assim.
    if (i.obs) for (const l of quebrar("  > " + i.obs)) t += l + "\n";
  }

  if (p.observacoes) {
    t += risco("-") + "\n";
    for (const l of quebrar("OBS: " + p.observacoes)) t += l + "\n";
  }
  return t + "\n\n\n" + CORTAR;
}

// O papel do CAIXA: o pedido inteiro, com valores e a forma de pagamento.
function cupomDoCaixa(p: PedidoCupom): string {
  let t = INICIO + CENTRO + NEGRITO_ON + GRANDE_ON + "CAIXA\n" + GRANDE_OFF;
  t += "Doce Pao\n" + NEGRITO_OFF + ESQUERDA + risco() + "\n";
  t += NEGRITO_ON + "CLIENTE: " + (p.clienteNome || "-") + "\n" + NEGRITO_OFF;
  if (p.clienteTelefone) t += "Fone: " + p.clienteTelefone + "\n";
  t += cabecalhoDaRetirada(p);
  t += "Pedido #" + String(p.id).slice(0, 8) + "\n" + risco() + "\n";

  for (const i of p.itens) {
    t += qtdDoTicket(i) + "  " + i.produto + "\n";
    if (i.obs) for (const l of quebrar("  > " + i.obs)) t += l + "\n";
    t += "  " + qtdDoTicket(i) + " x " + dinheiro(i.unitCentavos) + " = " + dinheiro(i.subtotalCentavos) + "\n";
  }

  t += risco("-") + "\n";
  t += NEGRITO_ON + GRANDE_ON + "TOTAL: " + dinheiro(p.totalCentavos) + "\n" + GRANDE_OFF + NEGRITO_OFF;
  // A forma de pagamento no papel do caixa evita a pergunta no balcao com o
  // cliente na frente.
  if (p.formaPagamento) {
    t += NEGRITO_ON + "Pagamento: " + String(p.formaPagamento).toUpperCase() + "\n" + NEGRITO_OFF;
  }
  if (p.observacoes) {
    t += risco("-") + "\n";
    for (const l of quebrar("OBS: " + p.observacoes)) t += l + "\n";
  }
  return t + "\n\n\n" + CORTAR;
}

// Todos os papeis de um pedido: uma via por bancada que tem item, mais o caixa.
export function montarCupons(p: PedidoCupom): string[] {
  const porBancada: Record<DeptoId, ItemCupom[]> = { salgados: [], confeitaria: [], bolos: [] };
  for (const i of p.itens || []) porBancada[deptoDe(i)].push(i);

  const saida: string[] = [];
  for (const bancada of ["salgados", "confeitaria", "bolos"] as DeptoId[]) {
    if (porBancada[bancada].length) saida.push(cupomDaBancada(p, bancada, porBancada[bancada]));
  }
  saida.push(cupomDoCaixa(p));
  return saida;
}
