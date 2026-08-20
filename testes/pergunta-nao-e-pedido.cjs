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
// Importa as guardas de verdade, em vez de recortar texto do cerebro.ts.
const { clienteProibiuAnotar, soPerguntouSemPedir, obsQueOClienteNaoDisse, produtoQueNinguemCitou } = require("./_guardas.cjs")();

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
console.log("== os ROTULOS dela e o ENCHIMENTO nao recusam o item ==");
// O rastro de 20/08/2026 pegou a festa travando duas vezes por isto:
//   "isto na observacao o cliente NUNCA escreveu: aniversariante Alice 5 anos"
//   "isto na observacao o cliente NUNCA escreveu: cor da forminha nao definida"
// O cliente escreveu "a Alice faz 5 anos"; quem pos a palavra "aniversariante"
// foi ela. E "nao definida ainda" e enchimento pra nao deixar campo vazio: se
// limpa, nao se recusa o item inteiro.
const FALA_DA_FESTA = [
  "vai topo tema princesa, a Alice faz 5 anos, nao tenho foto",
  "e 60 brigadeiros, forminha dourada",
];
for (const obs of [
  "aniversariante Alice 5 anos",
  "nome Alice, idade 5 anos",
  "tema princesa",
  "cor da forminha nao definida ainda",
  "sabor a definir",
  "recheio pendente",
]) {
  const fora = obsQueOClienteNaoDisse(obs, FALA_DA_FESTA);
  conferir(fora.length === 0, 'nao recusa "' + obs + '"', "trava o item: " + fora.join(", "));
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
console.log("== o NOME DO CATALOGO nao e o nome que o cliente usa ==");
// O teste de concorrencia pegou isto falhando 1 em 3: o cliente pede "cuca de
// goiaba" e o produto do catalogo chama "cuca recheada". Exigindo toda palavra
// do nome na fala dele, eu bloqueava a IA por ter ACERTADO o produto.
//
// O que separa isto do "leite ninho" fantasma e o SABOR: goiaba e sabor de cuca
// recheada, e ninho nao e sabor de nada que ele pediu.
conferir(
  !produtoQueNinguemCitou("cuca recheada", ["quero 3 kg de cuca de goiaba pra dia 22/08 as 10h"], ""),
  'aceita "cuca recheada" quando ele pediu cuca de goiaba',
  "bloqueia a IA por ter acertado o produto",
);
conferir(
  !produtoQueNinguemCitou("torta fria com palmito", ["quero 2 kg de torta fria de frango com palmito"], ""),
  'aceita "torta fria com palmito" quando ele disse frango com palmito',
  "bloqueia a variante certa do catalogo",
);
conferir(
  produtoQueNinguemCitou("cuca recheada", ["quero 100 coxinhas pra sabado"], ""),
  "mas continua recusando cuca quando ele nao falou em cuca nenhuma",
  "a guarda parou de guardar",
);

console.log("");
console.log("== o JEITO QUE O CLIENTE CHAMA vale como ter citado ==");
// O rastro de 20/08/2026 pegou isto no ato: o cliente escreveu "quero uma de
// forma com calabresa, frango com catupiry e portuguesa", a Dora chamou
// anotar_item com "pizza inteira" (o nome certo do catalogo) OITO vezes, e a
// guarda recusou as oito, porque ele nunca escreveu a palavra "inteira".
// Resultado: eu estava bloqueando TODA venda de pizza da padaria.
for (const [produto, fala] of [
  ["pizza inteira", "quero uma de forma com calabresa, frango com catupiry e portuguesa"],
  ["pizza inteira", "me ve uma pizza de metro de calabresa"],
  ["pizza inteira", "queria uma pizza grande pro jogo"],
  ["pizza redonda", "quero uma redonda de calabresa e frango"],
  ["pizza meia", "pode ser meia pizza so"],
  ["mini bolha", "quero 50 pastel frito de carne"],
  ["cuca recheada", "3 kg de cuca de goiaba"],
  ["torta fria com palmito", "2 kg de torta fria de frango com palmito"],
]) {
  conferir(
    !produtoQueNinguemCitou(produto, [fala], ""),
    'aceita "' + produto + '" quando ele disse "' + fala.slice(0, 38) + '"',
    "bloqueia a venda por causa do nome do catalogo",
  );
}
conferir(
  produtoQueNinguemCitou("pizza inteira", ["quero 100 coxinhas pra sabado"], ""),
  "mas continua recusando pizza quando ele nao falou em pizza nenhuma",
  "a guarda parou de guardar",
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
