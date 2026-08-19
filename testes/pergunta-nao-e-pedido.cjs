// PERGUNTA NAO VIRA ITEM NO PEDIDO, E SABOR E ESCOLHA DO CLIENTE.
//
// Teste com clientes ao vivo, 19/08/2026. Uma cliente escreveu, com todas as
// letras, "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco" e
// depois "Por favor nao anota nada". A Dora anotou cinco itens. Outro cliente
// perguntou o preco da torta e ganhou uma torta no pedido. Uma senhora escreveu
// "eu nao falei que queria 1 quilo minha filha" e o quilo continuou la.
//
// E ela inventou sabor: "porto alegre" (que e sabor DOCE) numa torta SALGADA,
// "frango com legumes" num empadao e "sem recheio" numa cuca. Nada disso o
// cliente falou. Sabor inventado vira producao errada e cliente recusando o
// pedido no balcao.
//
// As frases deste teste sao as REAIS das conversas, nao inventadas aqui.
//
// Roda com: node testes/pergunta-nao-e-pedido.cjs
const fs = require("fs");
const fonte = fs.readFileSync("lib/ia/cerebro.ts", "utf8");

function extrair(assinatura, ate) {
  const ini = fonte.indexOf(assinatura);
  const fim = fonte.indexOf(ate, ini);
  if (ini < 0 || fim < 0) throw new Error("nao achei no arquivo: " + assinatura);
  return fonte.slice(ini, fim);
}

const semTipos = (t) =>
  t
    .replace(/export function /g, "function ")
    .replace(/export const /g, "const ")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+, ([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1, $2)")
    .replace(/\(([a-zA-Z]+): [A-Za-z<>[\]| ]+\)/g, "($1)")
    .replace(/(const [a-zA-Z]+): [A-Za-z<>[\]| ]+ =/g, "$1 =")
    .replace(/\): [A-Za-z<>[\]| ]+ =>/g, ") =>")
    .replace(/\): [A-Za-z<>[\]| ]+ \{/g, ") {");

const corpo =
  semTipos(extrair("const semAcMin =", "// O cliente disse explicitamente")) +
  semTipos(extrair("export function clienteProibiuAnotar(", "// A fala do cliente e SO uma pergunta")) +
  semTipos(extrair("export function soPerguntouSemPedir(", "// Pedacos da observacao")) +
  semTipos(extrair("export function obsQueOClienteNaoDisse(", "//  O RESUMO QUE ELA FALA TEM QUE SER O PEDIDO QUE ESTA GRAVADO.")) +
  semTipos(
    extrair("export function produtoQueNinguemCitou(", "// ENDERECO DITO QUE NAO E O DA PADARIA")
      .replace(/\(\s*produto: string,\s*falasDoCliente: string\[\],\s*propostaDela: string,\s*\): boolean/, "(produto, falasDoCliente, propostaDela)"),
  );

const criar = new Function(
  corpo + "\nreturn { clienteProibiuAnotar, soPerguntouSemPedir, obsQueOClienteNaoDisse, produtoQueNinguemCitou };",
);
const { clienteProibiuAnotar, soPerguntouSemPedir, obsQueOClienteNaoDisse, produtoQueNinguemCitou } = criar();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

console.log('== "nao anota nada" tem que travar a escrita ==');
for (const frase of [
  "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco",
  "Espera, eu nao pedi torta salgada nenhuma, eu so perguntei o preco. Por favor nao anota nada",
  "so to pesquisando preco por enquanto",
  "e so uma pergunta, nao e pedido",
  "so queria saber quanto fica",
]) {
  conferir(clienteProibiuAnotar(frase), 'trava "' + frase.slice(0, 50) + '"', "passou batido");
}

console.log("");
console.log("== quem esta comprando NAO pode ser travado ==");
for (const frase of [
  "quero 100 coxinhas e 50 esfirras de calabresa",
  "pode ser",
  "anota 2 kg de cuca de goiaba",
  "vou querer o bolo de 3 kg",
  "fechado, pode mandar",
]) {
  conferir(!clienteProibiuAnotar(frase), 'deixa passar "' + frase + '"', "travou sem motivo");
}

console.log("");
console.log("== pergunta de preco NAO vira item ==");
for (const [frase, produto] of [
  ["quanto custa a torta doce?", "torta doce"],
  ["voces tem docinho sem lactose?", "docinho sem lactose"],
  ["qual o preco do empadao", "empadao"],
  ["quanto fica a mini pizza?", "mini pizza"],
  ["como funciona a cuca, e por quilo?", "cuca"],
]) {
  conferir(soPerguntouSemPedir(frase, produto), 'segura "' + frase + '"', "deixou virar item");
}

console.log("");
console.log("== decisao de verdade tem que passar ==");
for (const [frase, produto] of [
  ["quero 2 kg de torta doce", "torta doce"],
  ["me ve uma cuca de goiaba", "cuca"],
  ["pode ser", "coxinha"],
  ["100 coxinhas", "coxinha"],
  ["quanto custa a torta doce? pode anotar 1 kg", "torta doce"],
  ["a festa e dia 12/09, quero empadao", "empadao"],
]) {
  conferir(!soPerguntouSemPedir(frase, produto), 'deixa passar "' + frase + '"', "segurou uma venda");
}

console.log("");
console.log("== A INTENCAO E DO TURNO, nao da conversa inteira ==");
// O DEFEITO QUE ISTO PEGA, achado na bateria de 19/08/2026:
// eu usei a conversa INTEIRA no lugar da mensagem de agora, entao o cliente
// disse "so estou pesquisando" na mensagem 3 e ficou bloqueado ate a 17,
// gritando "anota ai, confirmado" e ouvindo que nao tinha confirmado. Sete
// tentativas de fechar, nenhuma pizza anotada, cliente indo embora achando que
// tinha pedido. Pior que o bug original.
const CONVERSA_INTEIRA = [
  "bom dia, quanto custa a torta salgada?",
  "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco",
  "e a pizza redonda, quantos sabores cabem?",
  "vou querer uma redonda meio calabresa meio frango com catupiry pra sabado 19h",
  "pode anotar a pizza",
  "confirmado",
].join(String.fromCharCode(10));
const AGORA = "pode anotar a pizza";

conferir(
  clienteProibiuAnotar(CONVERSA_INTEIRA),
  "a conversa inteira ainda casa com o 'so pesquisando' (por isso nao serve)",
  "o teste perdeu o sentido, reveja",
);
conferir(
  !clienteProibiuAnotar(AGORA),
  "mas a mensagem de AGORA nao bloqueia: ele mandou anotar",
  "vai travar a venda de novo",
);
for (const agora of ["confirmado", "pode anotar a pizza", "mano eu ja fechei, anota ai", "sim, quero fechar agora"]) {
  conferir(!clienteProibiuAnotar(agora), 'nao trava em "' + agora + '"', "trava venda fechada");
  conferir(!soPerguntouSemPedir(agora, "pizza redonda"), '  e nao trata como pergunta: "' + agora + '"', "segurou o pedido");
}

console.log("");
console.log("== ROTULO dela nao e invencao ==");
// A cliente escreveu so "rosa" e a Dora anotou "forminha rosa". A guarda
// recusou dizendo que ela inventou, e a cor se perdia: exatamente o defeito que
// existia ANTES de haver guarda nenhuma.
const SO_A_COR = ["quero 60 brigadeiros", "rosa"];
for (const obs of ["forminha rosa", "recheio de calabresa", "sabor morango", "cor dourada"]) {
  const fora = obsQueOClienteNaoDisse(obs, SO_A_COR.concat(["calabresa", "morango", "dourada"]));
  conferir(fora.length === 0, 'aceita "' + obs + '" (o rotulo e dela, a escolha e dele)', "recusou: " + fora.join(", "));
}

console.log("");
console.log("== sabor que o cliente NUNCA falou tem que ser recusado ==");
const conversaReal = [
  "bom dia, queria saber o preco da torta salgada e do empadao",
  "e a mini pizza, quanto fica",
  "obrigada, vou pensar e falar com meu marido",
];
for (const obs of ["porto alegre", "frango com legumes", "sem recheio", "calabresa"]) {
  const fora = obsQueOClienteNaoDisse(obs, conversaReal);
  conferir(fora.length > 0, 'recusa a observacao "' + obs + '"', "aceitou o que ele nao disse");
}

console.log("");
console.log("== o que o cliente FALOU tem que ser aceito ==");
const conversaFesta = [
  "quero 50 esfirras de calabresa e 60 brigadeiros",
  "forminha dourada",
  "um bolo de laka com pao de lo branco, topo tema princesa",
  "a menina eh a Alice, faz 5 anos",
];
for (const obs of [
  "calabresa",
  "forminha dourada",
  "pao de lo branco, topo tema princesa",
  "sem foto",
  "prato aberto",
]) {
  const fora = obsQueOClienteNaoDisse(obs, conversaFesta);
  conferir(fora.length === 0, 'aceita a observacao "' + obs + '"', "recusou: " + fora.join(", "));
}

console.log("");
console.log("== PRODUTO FANTASMA: o leite ninho que ninguem pediu ==");
// O CASO REAL, da bateria de 19/08/2026. A cliente pediu pra trocar o bolo de
// prestigio por 4 leites. Nasceu no pedido um "leite ninho" que ela nunca
// pediu. A Dora NEGOU que existia ("nao tem bolo de leite ninho no seu pedido,
// pode ficar tranquila") e duas mensagens depois COBROU R$ 3,13 por ele.
//
// O enum nao pega isso, porque "leite ninho" existe de verdade (e um docinho).
const CONVERSA_DO_BOLO = [
  "quero um bolo de 2,5 kg de prestigio pra festa dia 12/09",
  "pao de lo branco, topo tema princesa",
  "trocar o bolo de prestigio pra 4 leites",
];
conferir(
  produtoQueNinguemCitou("leite ninho", CONVERSA_DO_BOLO, ""),
  'recusa o "leite ninho" que ninguem citou',
  "o fantasma entra no pedido e vira cobranca",
);
conferir(
  !produtoQueNinguemCitou("bolo 4 leites", CONVERSA_DO_BOLO, ""),
  "mas deixa passar o bolo 4 leites, que ela pediu",
  "bloqueou a troca que o cliente pediu",
);

console.log("");
console.log("== o que foi PROPOSTO por ela e aceito tambem vale ==");
// Na festa ela indica os itens e o cliente responde "pode ser". Esses produtos
// nao aparecem na fala dele, e nem por isso sao invencao.
const PROPOSTA = '[{"produto":"mini bolha","qtd":83},{"produto":"esfirra","qtd":84}]';
for (const nome of ["mini bolha", "esfirra"]) {
  conferir(
    !produtoQueNinguemCitou(nome, ["festa de 25 pessoas dia 12/09", "pode ser"], PROPOSTA),
    'aceita "' + nome + '", que ela propos e ele aceitou',
    "recusaria a indicacao da festa inteira",
  );
}

console.log("");
console.log("== generico nao e produto fantasma ==");
for (const nome of ["salgado", "docinho", "bolo", "topo de bolo"]) {
  conferir(
    !produtoQueNinguemCitou(nome, ["quero 300 salgados pra festa"], ""),
    'nao trava no generico "' + nome + '"',
    "quebra a montagem do pedido antes de escolher os tipos",
  );
}

console.log("");
console.log(erros === 0 ? "PERGUNTA NAO VIRA PEDIDO E SABOR E DO CLIENTE" : erros + " FALHA(S) NO PORTAO");
process.exit(erros === 0 ? 0 : 1);
