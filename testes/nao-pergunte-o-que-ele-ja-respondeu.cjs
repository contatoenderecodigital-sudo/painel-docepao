// TRES DEFEITOS QUE MATAM A VENDA SEM QUEBRAR NADA
//
// Os tres apareceram lendo conversa como cliente em 21/08/2026. Nenhum dos tres
// aparece na medicao, porque em dois deles o pedido nem chega a existir e no
// terceiro ele sai certo. So aparecem lendo.
//
//   1. "escolhe voce os tipos, to sem tempo" -> ela perguntou o sabor da
//      esfirra TRES vezes, palavra por palavra. Loop ate o cliente sumir.
//   2. "quanto custa a torta doce?" recebeu preco; "e a salgada?" recebeu
//      "qual sabor voce quer?". Pergunta de preco sem preco.
//   3. "dia 27/09 as 16h" na primeira mensagem, "me diz que horas" na sexta.
//
// Este teste cobra a REGRA, nao o caso: as tres correcoes valem pra qualquer
// produto do cardapio, e o teste varre o cardapio inteiro pra provar.
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const catalogo = require(path.join(raiz, "lib/ia/dados/catalogo.json"));

const {
  pediuQueVoceEscolha, perguntaElipticaDePreco, horaQueEleFalou,
  textoSemPerguntaDeHora, textoSemPerguntaDeNome, obsSemONomeDeQuemRetira, obsSemDeliberacao,
  quantidadePorSabor, coresDeForminhaQueEleFalou, textoSemPedirDadosDeFechamento,
  textoSemPerguntaJaFeita, obsSemRepeticao, pecasDoBoloQueEleAceitou,
} = require("./_guardas.cjs")();

// "2 CALABRESA E 1 DE FRANGO" SAO TRES PIZZAS, NAO UMA COM DOIS SABORES.
// O pedido real fechou com uma pizza de R$ 120,00 tendo o cliente pedido tres.
const saboresPizza = (catalogo.pizza?.sabores_salgados ?? []).concat(catalogo.pizza?.sabores_doces ?? []);
const pizzas = [
  ["2 calabresa e 1 de frango pra hoje a noite", 3, 2],
  ["quero 3 portuguesa", 3, 1],
  ["duas de bacon com milho", 2, 1],
  ["quero uma pizza", 0, 0],
];

const r = {
  delega: [
    "escolhe voce os tipos, to sem tempo",
    "pode ser assim, escolhe os tipos",
    "escolha os sabores",
    "decide os tipos pra mim",
    "pode ser, escolhe tudo voce",
    "monta tudo pra mim",
    "pode escolher",
    "me indica",
    "manda o que for melhor",
    "faz sortido",
    "confio em voce",
  ].map((f) => pediuQueVoceEscolha(f)),
  eliptica: [
    ["e a salgada?", "quanto custa a torta doce?"],
    ["e o assado?", "quanto custa o salgado frito?"],
    ["e a especial?", "qual o preco da torta doce"],
  ].map(([a, b]) => perguntaElipticaDePreco(a, b)),
  conversa: [
    ["e ai, tudo bem?", "quanto custa a torta doce?"],
    ["e a salgada?", "quero 200 salgados"],
  ].map(([a, b]) => perguntaElipticaDePreco(a, b)),
  horas: [
    ["oi boa tarde, vou fazer o aniversario da minha filha dia 27/09 as 16h, queria bolo"],
    ["preciso de 200 salgados assados pra quarta as 9h"],
    ["pode ser as 14:30"],
  ].map((f) => horaQueEleFalou(f)),
};

// A PERGUNTA DE HORA SAI DO TEXTO quando ele ja disse a hora, e so ela sai.
const cortes = [
  ["Agora me fala o nome de quem vai retirar, que horas, e como prefere pagar?", true],
  ["Me diz o nome de quem retira e que horas?", true],
  ["Falta o nome, o horário de retirada, e a forma de pagamento?", true],
  ["Qual o sabor do bolo?", false],
  ["O pedido fica pra quarta às 9h, pode ser?", false],
];

// O NOME QUE ELE JA DEU sai do texto, e frase quebrada nunca sai.
const cortesNome = [
  ["Ja passei pra equipe. So me diz: o pedido fica no nome de quem?", true],
  ["Me fala o nome de quem vai retirar e como prefere pagar?", true],
  ["Qual o sabor do bolo?", false],
];

// O NOME DE QUEM RETIRA nao fica na observacao do item quando o bolo nao leva
// peca, e FICA quando leva, porque ai e o nome do aniversariante.
const obsNome = [
  ["pao de lo branco, sem topo e sem papel de arroz, nome Marcia", "Marcia", false],
  ["topo de bolo, tema princesa, nome Marcia, 5 anos", "Marcia", true],
];

const falhas = [];
// O DOCINHO DELE NAO VIRA O BOLO DELE.
//
// Regressao minha, pega pela medicao em 21/08/2026: o cliente pediu "um bolo
// de 3 kg de laka" e o pedido fechou com BOLO BRIGADEIRO, cinco vezes em
// cinco. Duas mensagens antes ele tinha pedido "60 brigadeiros", e brigadeiro
// tambem e sabor de bolo: o codigo escolhia o sabor mais LONGO da conversa
// inteira, e brigadeiro tem dez letras contra quatro de laka.
{
  const cerebroL = require("node:fs").readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
  if (/\.sort\(\(x, y\) => y\.length - x\.length\)\[0\];/.test(cerebroL)) {
    falhas.push("o sabor do bolo voltou a ser o mais longo da conversa; o docinho vira o bolo");
  }
  if (!/O SABOR DO BOLO E O QUE ELE DISSE JUNTO DA PALAVRA BOLO/.test(cerebroL)) {
    falhas.push("a regra do sabor do bolo sumiu do cerebro");
  }
  // COR DE FORMINHA SO EXISTE EM DOCINHO: "pao de lo branco" nao e forminha.
  if (!/COR DE FORMINHA SO EXISTE EM DOCINHO/.test(cerebroL)) {
    falhas.push("a cor de forminha voltou a valer pra qualquer item; o pao de lo branco vira forminha");
  }
}
// AS PECAS DO BOLO QUE ELE ACEITOU ENTRAM NO PEDIDO.
//
// "papel de arroz e topo sim" fechou o pedido so com o papel. O topo e a peca
// que a equipe cota a parte e que a cozinha manda fazer fora.
{
  const casos = [
    ["papel de arroz e topo sim, forminha azul, nome Amanda, pix", true, true],
    ["sem topo e sem papel de arroz", false, false],
    ["so o topo, sem papel", true, false],
    ["nome Ana, pix", false, false],
  ];
  for (const [fala, topo, papel] of casos) {
    const r = pecasDoBoloQueEleAceitou(fala);
    if (r.topo !== topo) falhas.push("topo lido errado em: " + fala);
    if (r.papel !== papel) falhas.push("papel de arroz lido errado em: " + fala);
  }
  const cerebroAqui = require("node:fs").readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
  if (!/peca do bolo que ele aceitou e nao estava/.test(cerebroAqui)) {
    falhas.push("o codigo parou de completar as pecas do bolo que o cliente aceitou");
  }
}
// A MESMA COISA DUAS VEZES NA OBSERVACAO E UMA COISA SO.
//
// A linha do bolo chegou no cliente com tema, nome e idade repetidos, porque o
// codigo completa o que ela escreveu e ela reescreve por cima no turno seguinte.
{
  const sujo = "tema homem aranha, nome Theo, 5 anos, papel de arroz, topo de bolo, tema homem aranha, nome Theo, 5 anos";
  const limpo = obsSemRepeticao(sujo);
  if ((limpo.match(/tema homem aranha/g) ?? []).length !== 1) {
    falhas.push("a observacao continua repetindo o tema: " + limpo);
  }
  for (const parte of ["papel de arroz", "topo de bolo", "nome Theo", "5 anos"]) {
    if (!limpo.includes(parte)) falhas.push("a limpeza da observacao comeu \"" + parte + "\"");
  }
  if (obsSemRepeticao("pao de lo branco, sem topo") !== "pao de lo branco, sem topo") {
    falhas.push("mexeu em observacao que nao repete nada");
  }
}
// RESUMO DE PEDIDO NAO SE MEXE.
//
// O cliente da festa de 5 anos recebeu "Seu pedido ......... *Total: R$ 543,00*"
// com os dois pontilhados colados e nenhuma linha entre eles: total cego. E a
// linha "*Forma de pagamento:* pix" sumia por casar com o recorte de dados.
{
  const nl = String.fromCharCode(10);
  const resumo = [
    "*Pedido recebido*", "*Nome:* Amanda", "*Forma de pagamento:* pix",
    "*Retirada:* 30/08/2026 às 15:00", "Seu pedido", "............................",
    "50x coxinha: R$ 50,00", "............................", "*Total: R$ 543,00*",
  ].join(nl);
  const passou = [
    ["dados de fechamento", textoSemPedirDadosDeFechamento(resumo)],
    ["pergunta de nome", textoSemPerguntaDeNome(resumo)],
    ["pergunta repetida", textoSemPerguntaJaFeita(resumo, ["Qual a cor da forminha?"])],
  ];
  for (const [nome, saiu] of passou) {
    if (saiu !== resumo) falhas.push("a guarda de " + nome + " mexeu no resumo do pedido");
  }
  const fs2 = require("node:fs");
  const cer = fs2.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
  if (!/o resumo refeito saiu sem item/.test(cer)) {
    falhas.push("o resumo refeito voltou a poder sair sem nenhuma linha de item");
  }
}
// PERGUNTA JA FEITA NAO SE FAZ DE NOVO.
//
// A auditoria das 40 conversas da medicao apontou "vai querer salgado tambem
// pra festa?" repetida em quatro delas. Repetir e o que faz soar de robo.
{
  const dela = ["Anotei o bolo. Você vai querer salgado também pra festa?"];
  const cortado = textoSemPerguntaJaFeita("Anotei tudo certinho. Vai querer salgado também pra festa?", dela);
  if (/salgado/i.test(cortado)) falhas.push("a pergunta repetida continuou no texto: " + cortado);
  if (!/[.!?]$/.test(cortado.trim())) falhas.push("o corte da pergunta repetida quebrou a frase: " + cortado);
  const outra = textoSemPerguntaJaFeita("Qual a cor da forminha?", dela);
  if (outra !== "Qual a cor da forminha?") falhas.push("cortou pergunta que nunca tinha sido feita");
  // Mensagem que E so a pergunta repetida fica: vazio e pior que repetido.
  const sozinha = textoSemPerguntaJaFeita("Vai querer salgado também pra festa?", dela);
  if (!sozinha.trim()) falhas.push("a mensagem ficou vazia");
}
// PEDIDO VAZIO NAO PEDE DADO DE FECHAMENTO, E O CORTE NUNCA QUEBRA A FRASE.
//
// A primeira versao recortava pedacos e deixou isto na tela do cliente:
//   "E o pedido fica no nome de quem, que horas voce retira Pode ser assim?"
{
  const casos = [
    ["Anotei que é pra retirar no domingo. E o pedido fica no nome de quem, que horas você retira e como prefere pagar?", true],
    ["Pra 80 pessoas, a base é 800 salgados. Dá R$ 1.675,20. E o pedido fica no nome de quem, como vai pagar e quem retira?", true],
    ["Qual o sabor do bolo?", false],
  ];
  for (const [texto, deviaMudar] of casos) {
    const saiu = textoSemPedirDadosDeFechamento(texto);
    if (deviaMudar && saiu === texto) falhas.push("o pedido de dado continuou com o pedido vazio: " + texto);
    if (!deviaMudar && saiu !== texto) falhas.push("mexeu em texto que nao pede dado: " + texto);
    // Sentenca inteira sai ou fica: o que sobra tem que terminar em pontuacao.
    if (saiu !== texto && !/[.!?]$/.test(saiu.trim())) falhas.push("o corte deixou a frase pendurada: " + saiu);
  }
}
// DUAS CORES DE FORMINHA SAO DUAS: "rosa e dourado" fechou pedido so com rosa.
{
  const duas = coresDeForminhaQueEleFalou("pode ser rosa e dourado");
  if (duas.length !== 2) falhas.push("nao leu as duas cores de forminha: " + JSON.stringify(duas));
  if (duas[0] !== "rosa") falhas.push("as cores sairam fora da ordem que ele falou: " + JSON.stringify(duas));
  if (coresDeForminhaQueEleFalou("quero 100 docinhos").length) falhas.push("achou cor onde nao tem");
}
// A PERGUNTA DE HORA COM VERBO NO MEIO tambem sai.
{
  const t = textoSemPerguntaDeHora("E o pedido fica no nome de quem, que horas você retira e como prefere pagar?");
  if (/que horas/i.test(t)) falhas.push("a pergunta de hora com verbo no meio escapou: " + t);
}
for (const [fala, totalEsperado, itensEsperados] of pizzas) {
  const pares = quantidadePorSabor(fala, saboresPizza);
  const total = pares.reduce((a, b) => a + b.qtd, 0);
  if (pares.length !== itensEsperados) {
    falhas.push("quantidade por sabor leu " + pares.length + " item(ns) em vez de " + itensEsperados + ": " + fala);
  }
  if (total !== totalEsperado) {
    falhas.push("quantidade por sabor somou " + total + " em vez de " + totalEsperado + ": " + fala);
  }
}
// O sabor mais longo vence: "bacon com milho" nao pode virar "bacon".
{
  const p = quantidadePorSabor("duas de bacon com milho", saboresPizza)[0];
  if (p && p.sabor !== "bacon com milho") falhas.push("o sabor foi cortado no meio: " + p.sabor);
}
for (const [texto, deviaMudar] of cortesNome) {
  const saiu = textoSemPerguntaDeNome(texto);
  if (deviaMudar && saiu === texto) falhas.push("a pergunta de nome continuou no texto: " + texto);
  if (!deviaMudar && saiu !== texto) falhas.push("mexeu em texto que nao pergunta nome: " + texto);
  if (/^(e|ou|,)( |$)/i.test(saiu) || / (e|ou|,)$/i.test(saiu)) falhas.push("o corte quebrou a frase: " + saiu);
}
for (const [obs, nome, deviaFicar] of obsNome) {
  const saiu = obsSemONomeDeQuemRetira(obs, nome);
  const ficou = saiu.toLowerCase().includes(nome.toLowerCase());
  if (deviaFicar && !ficou) falhas.push("o nome do aniversariante sumiu da peca: " + obs);
  if (!deviaFicar && ficou) falhas.push("o nome de quem retira ficou na observacao do item: " + saiu);
}
// Deliberacao nao vira ficha da cozinha nem texto do cliente.
if (obsSemDeliberacao("brigadeiro, cor da forminha nao especificada").includes("nao especificada")) {
  falhas.push("observacao interna de forminha continua indo pro cliente e pra cozinha");
}
for (const [texto, deviaMudar] of cortes) {
  const saiu = textoSemPerguntaDeHora(texto);
  if (deviaMudar && saiu === texto) falhas.push("a pergunta de hora continuou no texto: " + texto);
  if (!deviaMudar && saiu !== texto) falhas.push("mexeu em texto que nao pergunta hora: " + texto + " -> " + saiu);
  if (/que horas|hor[áa]rio de retirada/i.test(saiu) && deviaMudar) falhas.push("sobrou pergunta de hora: " + saiu);
}

// 1. DELEGACAO: quem delega tem que ser reconhecido em todas as formas.
r.delega.forEach((ok, i) => { if (!ok) falhas.push("delegacao nao reconhecida no caso " + i); });

// 2. ELIPSE: continua a pergunta -> devolve o termo remontado.
r.eliptica.forEach((v, i) => { if (!v) falhas.push("pergunta que continua a anterior nao reconhecida no caso " + i); });
r.conversa.forEach((v, i) => { if (v) falhas.push("conversa virou pergunta de preco no caso " + i + ": " + v); });

// 3. HORA: o que o cliente escreve de todo jeito.
r.horas.forEach((v, i) => { if (!v) falhas.push("hora dita pelo cliente nao foi lida no caso " + i); });

// 4. O CONSERTO E DE CLASSE, NAO DE PRODUTO.
//
// A correcao do sabor delegado vale pra qualquer item com lista de sabores.
// Aqui se conta quantos sao: se um dia alguem consertar so a esfirra, este
// numero denuncia.
const comSabores = [];
for (const i of catalogo.outros_produtos ?? []) if ((i.sabores ?? []).length) comSabores.push(i.nome);
for (const grupo of [catalogo.salgados?.frito, catalogo.salgados?.assado, catalogo.doces]) {
  for (const i of grupo?.itens ?? []) if ((i.sabores ?? []).length) comSabores.push(i.nome);
}
const fs = require("node:fs");
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");
if (!/delegou o sabor, o codigo escolheu/.test(cerebro)) {
  falhas.push("o bloco que escolhe o sabor quando o cliente delega sumiu do cerebro");
}
if (/SABORES\["esfirra"\]|=== "esfirra"/.test(cerebro)) {
  falhas.push("tem conserto escrito so pra esfirra; a regra e da familia inteira");
}

// A DELEGACAO VALE PRA CONVERSA INTEIRA, NAO PRA ULTIMA FRASE.
//
// Tres guardas liam so a fala do turno. Quem escreveu "escolhe voce o sabor" na
// terceira mensagem e viu a Dora responder "nao posso escolher por voce" na
// quarta perdeu o bolo inteiro do aniversario da mae.
{
  const chamadas = [...cerebro.matchAll(/pediuQueVoceEscolha\(([^)]*)\)/g)].map((m) => m[1].trim());
  const soUltimaFala = chamadas.filter((arg) => /^(falaDoCliente|String\(ultimaFala\))$/.test(arg));
  if (soUltimaFala.length) {
    falhas.push(
      soUltimaFala.length + " guarda(s) de delegacao ainda leem so a ultima fala: " + soUltimaFala.join(", "),
    );
  }
  // QUEM ESCOLHE PIZZA E BOLO DELEGADO E O CODIGO, NAO A INSTRUCAO.
  //
  // A instrucao "sao tres pizzas" foi dada e ignorada duas rodadas seguidas, e
  // o pedido fechou com uma pizza de R$ 120,00 tendo o cliente pedido tres.
  if (!/pizzas anotadas pelo codigo/.test(cerebro)) {
    falhas.push("o codigo parou de anotar as pizzas por sabor; volta a depender da instrucao");
  }
  if (!/bolo escolhido pelo codigo/.test(cerebro)) {
    falhas.push("o codigo parou de escolher o bolo quando o cliente delega");
  }
  // A FAMILIA DO SORTIDO SAI DA BOCA DELE, NAO DA DELA.
  //
  // A cliente queria so bolo. A Dora perguntou "vai querer salgado tambem?",
  // ela respondeu "escolhe voce o sabor" falando do bolo, e o codigo anotou
  // 100 salgados que ninguem pediu.
  if (/const t = String\(String\(ultimaFalaDoCliente\) \+ " " \+ String\(ultimaDelaAqui\)\)/.test(cerebro)) {
    falhas.push("a familia do sortido voltou a ler a fala dela; anota item que o cliente nao pediu");
  }
  // O PESO DO BOLO JA ESTA NA CONTA DA CASA: 100 g por pessoa.
  if (!/peso do bolo veio da conta da casa/.test(cerebro)) {
    falhas.push("o codigo parou de preencher o peso do bolo; a conversa trava perguntando quilos");
  }
  // FESTA DE CRIANCA TEM CRIANCA, NAO "PESSOAS".
  //
  // A lição que mais se repetiu na noite de 20 para 21/08/2026: o mesmo defeito
  // existia em DOIS lugares e so um foi consertado. Aqui os dois contadores de
  // gente sao varridos: quem contar so "pessoas" deixa a festa de 5 anos sem
  // bolo, porque a mae escreveu "25 criancas".
  {
    const contadores = [...cerebro.matchAll(/pessoas\|pessoa\?|pessoas\|convidados[^)]*/g)].map((m) => m[0]);
    const contamGente = [...cerebro.matchAll(/\(\?:pessoas[^)]*\)/g)].map((m) => m[0]);
    const cegos = contamGente.filter((x) => !/crian/.test(x));
    if (cegos.length) {
      falhas.push(cegos.length + " contador(es) de gente ainda ignoram crianca: " + cegos.join(" | ").slice(0, 160));
    }
    void contadores;
    console.log("Contadores de gente no cerebro: " + contamGente.length + ", todos contando crianca.");
  }
  // A COR DA FORMINHA QUE ELE DISSE VALE PRA TODOS OS DOCINHOS.
  //
  // A festa de 5 anos fechou com "forminha azul" dita pela mae e os quatro
  // docinhos sem cor nenhuma na comanda.
  if (!/cor da forminha escrita em/.test(cerebro)) {
    falhas.push("o codigo parou de escrever a cor da forminha nos docinhos");
  }
  // O SABOR VAI NO NOME DA PIZZA, senao as tres viram uma na juncao do pedido.
  if (!/pizza inteira " \+ String\(par\.sabor\)/.test(cerebro)) {
    falhas.push("as pizzas voltaram a ter o mesmo nome; uma sobrescreve a outra");
  }
  console.log("Guardas de delegacao no cerebro: " + chamadas.length + ", todas lendo a conversa inteira.");
}

console.log("Produtos com lista de sabores no cardapio: " + comSabores.length);
console.log("A regra do sabor delegado vale pra todos eles, nao pra um.");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: delegacao, pergunta que continua a anterior e hora ja dita.");
