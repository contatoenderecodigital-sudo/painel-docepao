// ============================================================================
//  O PAPEL QUE VAI PRO MURAL DA COZINHA.
//
//  O LAYOUT É O QUE JÁ ESTAVA CERTO. A ponte antiga imprimia assim e funcionou
//  nos testes de salgadinho, docinho e bolo de festa: tudo em tamanho normal,
//  com negrito só no que a dona nomeou como essencial.
//
//    "A comanda é simples: é nome do cliente, é dia, é horário e é a quantidade."
//
//  Tentei "melhorar" dobrando largura e altura do título, da retirada e de cada
//  item. Saiu gigante: largura dobrada corta o papel em 24 colunas, então cada
//  linha estoura e um pedido de sete itens vira meio metro de bobina. A ponte
//  antiga tinha o comando de dobrar definido e nunca usava, e era por isso que
//  ninguém reclamava. Aqui não se dobra nada: negrito basta.
//
//  A DIVISÃO EM COMANDAS é a regra dela, e o motivo é produção em etapas:
//
//    "Empadão é uma coisa, torta doce é outra coisa, torta recheada é outra.
//     Os docinhos eu posso fazer cinco horas antes, mas o salgado eu tenho que
//     preparar 15 minutos antes da pessoa chegar."
//
//  Cada comanda avisa o que MAIS o cliente pediu, porque já deu errado:
//
//    "A Apoliana pegou um pedido que tinha tudo junto, e a outra não viu no
//     mural que tinha um pedaço de torta."
//
//  E o papel não escreve nome de setor: "não precisa colocar salgadeiro,
//  padeiro, confeiteiro, porque vai tudo pra mesma sala".
//
//  MONTADO NO SERVIDOR, e não na ponte que roda na padaria: enquanto era lá,
//  mudar o layout exigia trocar o arquivo naquela máquina E reiniciar o
//  programa, e isso falhou do jeito previsível (o arquivo corrigido às 02:17 e
//  o processo rodando desde as 14:26 do dia anterior, imprimindo o layout velho
//  da memória).
// ============================================================================

import { deptoDe, deptoDoTexto, deptosDoPedido, nomeDaComanda, qtdDoTicket, unidadeDoItem, type DeptoId } from "./departamentos";

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

const ESC = "\x1B";
const GS = "\x1D";
const INICIO = ESC + "@";
const CENTRO = ESC + "a\x01";
const ESQUERDA = ESC + "a\x00";
const NEGRITO_ON = ESC + "E\x01";
const NEGRITO_OFF = ESC + "E\x00";
const CORTAR = GS + "V\x42\x00";
const LARGURA = 48; // colunas de uma impressora de 80mm

// Impressora térmica engasga com acento: sai caractere trocado no meio da
// palavra. Melhor "PAES E CUCAS" legível do que "PÃES" virando ruído.
function semAcento(t: string): string {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function risco(c = "="): string {
  return c.repeat(LARGURA) + "\n";
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
// está assando ficava adivinhando o resto.
function quebrar(texto: string, marca = ""): string {
  // A marca ("  > ") vai SO na primeira linha. Repetida em todas, cada pedaco
  // da quebra parecia uma observacao separada, e foi assim que "sem topo"
  // virou "topo" no papel.
  const recuo = " ".repeat(marca.length);
  const largura = LARGURA - marca.length;
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
  return linhas.map((l, i) => (i === 0 ? marca : recuo) + l + "\n").join("");
}

// CADA INFORMACAO DA OBSERVACAO NA SUA LINHA.
//
// A Dora escreve separando por virgula ("com morango, pao de lo de chocolate,
// sem topo e sem papel de arroz"). Cortando ali, a producao le uma coisa por
// linha e nenhuma negacao fica orfa da palavra que ela nega.
//
// `outrosNomes` sao as outras LINHAS desta mesma comanda. Visto no papel em
// 21/08: o bolo trazia "> topo de bolo" e "> papel de arroz" na observacao e,
// logo abaixo, saiam "1 un topo de bolo" e "1 un papel de arroz" como linha
// propria, com quantidade. Quem monta le duas vezes e faz dois de cada.
function observacaoDoItem(obs: string, produto: string, outrosNomes: string[] = []): string {
  const chave = (t: string) => semAcento(t).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const nome = chave(produto);
  const outros = outrosNomes.map(chave).filter((n) => n && n !== nome);
  // O trecho so cai fora quando NAO acrescenta nada ao que a linha propria ja
  // diz. "topo tema futebol" fica, porque diz o tema. E o trecho tem que
  // nomear uma peca de verdade: "calabresa" e o recheio da esfirra e nao pode
  // sumir so porque a bancada tambem faz "coxinha de calabresa".
  const soRepeteOutraLinha = (f: string) =>
    outros.some((n) => n === f || (n.includes(f) && deptoDoTexto(f) !== null));
  return String(obs)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    // O que ja esta no nome do item nao se repete embaixo dele: saia
    // "bolo brigadeiro com morango" e logo abaixo "> com morango".
    .filter((x) => {
      const f = chave(x);
      return f.length > 2 && !nome.includes(f) && !soRepeteOutraLinha(f);
    })
    .map((x) => quebrar(x, "  > "))
    .join("");
}

// O cabeçalho é igual em toda comanda: as quatro coisas que ela nomeou, mais o
// número do pedido pra casar com o painel.
function cabecalho(titulo: string, p: PedidoCupom): string {
  let t = INICIO + CENTRO + NEGRITO_ON;
  t += semAcento(titulo) + "\n" + NEGRITO_OFF;
  t += "Doce Pao\n" + ESQUERDA + risco("=");
  t += NEGRITO_ON + semAcento("CLIENTE: " + (p.clienteNome || "-")) + "\n" + NEGRITO_OFF;
  if (p.clienteTelefone) t += "Fone: " + p.clienteTelefone + "\n";
  // Dia e hora sempre juntos: a produção separa o mural por dia, e a hora diz o
  // que sai do forno primeiro. Faltando a data, o papel avisa em vez de deixar
  // um espaço em branco que ninguém nota.
  const data = dataBR(p.retiradaData);
  const quando = [data, p.retiradaHora].filter(Boolean).join(" as ");
  t += NEGRITO_ON + "RETIRADA: " + (quando || "SEM DATA, CONFIRMAR") + "\n" + NEGRITO_OFF;
  if (p.pessoas) t += "Festa: " + p.pessoas + " pessoas\n";
  t += "Pedido #" + String(p.id).slice(0, 8) + "\n";
  t += risco("=");
  return t;
}

// A observação de cada item sai logo abaixo dele: é o sabor, o recheio, a cor
// da forminha, o tema do topo, o nome e a idade do aniversariante. Cada uma na
// comanda do seu item, então a forminha não vaza pra comanda do bolo.
function listaItens(itens: ItemCupom[]): string {
  const nomes = itens.map((i) => i.produto);
  let t = "";
  for (const i of itens) {
    t += NEGRITO_ON + qtdDoTicket(i).padEnd(8) + NEGRITO_OFF + semAcento(i.produto) + "\n";
    if (i.obs) t += observacaoDoItem(i.obs, i.produto, nomes);
  }
  return t;
}

// Resumo por faixa de preço, pedido dela pra bater com o caixa quando o pedido
// chega na frente por partes ("quantos salgados de R$ 1,00 e quantos de R$
// 1,25"). Por quilo sai aproximado, porque o peso final é na balança.
function resumoPorFaixa(itens: ItemCupom[]): { texto: string; total: number; temKg: boolean } {
  const grupos = new Map<string, { unidade: string; unit: number; qtd: number; sub: number }>();
  let temKg = false;
  for (const i of itens) {
    const u = unidadeDoItem(i);
    if (u === "kg") temKg = true;
    const unit = i.unitCentavos || 0;
    const chave = u + ":" + unit;
    const g = grupos.get(chave) ?? { unidade: u, unit, qtd: 0, sub: 0 };
    g.qtd += Number(i.qtd) || 0;
    g.sub += i.subtotalCentavos || 0;
    grupos.set(chave, g);
  }
  let texto = "";
  let total = 0;
  for (const g of grupos.values()) {
    total += g.sub;
    const q = String(g.qtd).replace(".", ",");
    texto +=
      g.unidade === "kg"
        ? `${q} kg x ${dinheiro(g.unit)}/kg = ${dinheiro(g.sub)}\n`
        : `${q} un x ${dinheiro(g.unit)} = ${dinheiro(g.sub)}\n`;
  }
  return { texto, total, temKg };
}

// A OBSERVACAO DO PEDIDO NAO E DE TODA BANCADA.
//
// Visto no papel em 21/08: "OBS: tema homem aranha, nome Theo, 5 anos" impresso
// tambem na comanda dos SALGADOS e na dos DOCINHOS. Quem frita coxinha nao tem
// o que fazer com o tema do bolo, e papel cheio de recado que nao e da bancada
// ensina a bancada a nao ler o papel.
//
// A leitura segue a ordem em que a frase foi escrita: o trecho que nomeia um
// produto manda nele E nos seguintes, ate outro produto ser nomeado. E assim
// que ela sai da conversa — em "bolo tema homem aranha, nome Theo, 5 anos" o
// nome e a idade sao do bolo, nao do pedido.
//
// Trecho que nao nomeia nada e nao vem depois de nenhum produto ("buzinar na
// frente") e recado da casa e vai em todas.
function trechosDaObservacao(obs: string): { texto: string; depto: DeptoId | null }[] {
  let atual: DeptoId | null = null;
  return String(obs)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((texto) => {
      atual = deptoDoTexto(texto) ?? atual;
      return { texto, depto: atual };
    });
}

// `id` null e o caixa: la vai a observacao inteira, porque quem entrega o
// pedido na retirada le tudo o que foi combinado.
//
// Trecho que fala de uma comanda que este pedido nao tem vai pra todas: perder
// recado no papel e pior do que repetir.
function observacaoDaComanda(p: PedidoCupom, id: DeptoId | null, doPedido: DeptoId[]): string {
  if (!p.observacoes) return "";
  const meus = trechosDaObservacao(p.observacoes)
    .filter((t) => id === null || t.depto === null || t.depto === id || !doPedido.includes(t.depto))
    .map((t) => t.texto);
  if (!meus.length) return "";
  return risco("-") + NEGRITO_ON + "OBS:\n" + NEGRITO_OFF + quebrar(meus.join(", "));
}

// "CLIENTE TAMBEM PEDIU": sem isso a pessoa da bancada pega o papel dela e vai
// embora achando que o pedido acabou ali.
function referenciaCruzada(outras: DeptoId[]): string {
  if (!outras.length) return "";
  return risco("-") + NEGRITO_ON + "CLIENTE TAMBEM PEDIU:\n" + NEGRITO_OFF + quebrar(outras.map(nomeDaComanda).join(", "));
}

function comanda(p: PedidoCupom, id: DeptoId, itens: ItemCupom[], outras: DeptoId[]): string {
  let t = cabecalho("== " + nomeDaComanda(id) + " ==", p);
  t += listaItens(itens);
  // O RESUMO POR FAIXA E O MECANISMO DE CONFERENCIA DELA.
  //
  // "Queria que estivesse especificado a quantidade total de R$ 1,00, de
  //  R$ 1,25 tambem, pra ficar mais facil a gente somar dai com a caixa."
  //
  // As comandas chegam na frente por etapa, e ela vai somando conforme cada
  // uma fica pronta. Preco POR ITEM continua fora: o que ela usa e a linha
  // agrupada e o subtotal.
  t += risco("-");
  const r = resumoPorFaixa(itens);
  t += r.texto;
  t += NEGRITO_ON + "Subtotal" + (r.temKg ? " (aprox)" : "") + ": " + dinheiro(r.total) + "\n" + NEGRITO_OFF;
  t += observacaoDaComanda(p, id, [id, ...outras]);
  t += referenciaCruzada(outras);
  return t + "\n\n\n" + CORTAR;
}

// O papel do CAIXA: o pedido inteiro, pra fechar o valor com o cliente na
// retirada. "Veio um pedido só de salgado no caixa, mas eu vou ler embaixo que
// tem bolo."
function caixa(p: PedidoCupom): string {
  let t = cabecalho("== CAIXA ==", p);
  t += listaItens(p.itens);
  t += risco("-");
  const r = resumoPorFaixa(p.itens);
  t += r.texto;
  t += NEGRITO_ON + "TOTAL: " + dinheiro(p.totalCentavos) + "\n" + NEGRITO_OFF;
  // Sem forma combinada vale o padrão da casa: paga na retirada.
  const forma = String(p.formaPagamento || "").trim();
  t += NEGRITO_ON + (forma ? "Pagamento: " + semAcento(forma).toUpperCase() : "Pagamento na RETIRADA") + "\n" + NEGRITO_OFF;
  t += observacaoDaComanda(p, null, []);
  return t + "\n\n\n" + CORTAR;
}

// Todos os papéis de um pedido: uma comanda por segmento, mais o caixa.
export function montarCupons(p: PedidoCupom): string[] {
  const porComanda = new Map<DeptoId, ItemCupom[]>();
  for (const i of p.itens || []) {
    const id = deptoDe(i);
    porComanda.set(id, [...(porComanda.get(id) ?? []), i]);
  }
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
