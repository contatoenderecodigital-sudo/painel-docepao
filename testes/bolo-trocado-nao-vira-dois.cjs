// O BOLO TROCADO NÃO VIRA DOIS, E "TA BOM DE SALGADO" NÃO É "SIM".
//
// Medição de 22/08/2026, uma conversa só, R$ 197,25 cobrados a mais.
//
// DEFEITO 1 — os dois bolos (R$ 117,25):
//
//   [o código escolheu sozinho um bolo brigadeiro de 2,5 kg]
//   cliente: eu nao pedi brigadeiro. queria de morango. pao de lo branco
//   Dora:    Você quer trocar o bolo brigadeiro pelo bolo morango? Confirma?
//   cliente: isso, morango. sem topo e sem papel de arroz
//   pedido:  bolo morango 2,5 kg R$ 124,75  +  bolo brigadeiro 2,5 kg R$ 117,25
//
// Três portas deviam ter barrado o segundo bolo, e as três falharam:
//
//   1. `querTrocar` procura "troca|muda|na verdade|prefiro..." — "eu não pedi X,
//      queria Y" não tem nenhuma dessas. É o vocabulário de quem NEGA um pedido
//      que nunca fez, não o de quem muda de ideia.
//   2. `oQueEuSugeri` lê `estado.sugeridos`, que nasce VAZIO a cada turno. Só
//      pegaria quem reclamasse no mesmo turno em que o palpite nasceu.
//   3. `dois_bolos` era a única porta de escrita do pedido SEM conferência do
//      lado do código: um booleano que a IA preenche e que desliga a guarda.
//
// E o texto da recusa ensinava a fuga com todas as letras: "CONFIRME com ele e
// chame anotar_item de novo com dois_bolos=true". Ela perguntou "confirma?", a
// cliente confirmou a TROCA, e ela leu como confirmação de DOIS BOLOS.
//
// DEFEITO 2 — os 80 salgados (R$ 80,00):
//
//   [a cliente já tinha 75 coxinha e 75 mini pão de queijo anotados]
//   cliente: ta bom de salgado. agora os docinho, o que vc me indica?
//   pedido:  + mini bolha 20, risólis 20, bolinha de queijo 20, croquete 20
//
// "ta bom de salgado" quer dizer "de salgado já chega" — o OPOSTO de "ta bom".
// `aceitouAOferta` leu como aceite e o código re-anotou o sortido de 100 que
// ainda estava na mensagem anterior da Dora. A conta bate exata: o sortido de
// 100 são 5 itens de 20, menos a coxinha que já estava lá = 80.
//
// Roda com: node testes/bolo-trocado-nao-vira-dois.cjs
const guardas = require("./_guardas.cjs")();

const semAcP = (t) =>
  String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// As mesmas regras que o cerebro usa, na mesma forma.
const DOIS_BOLOS =
  /\b(dois bolos|2 bolos|duas tortas|2 tortas|mais um bolo|outro bolo|um segundo bolo|segundo bolo|bolo a mais|os dois bolos|os dois|dois mesmo|um de cada)\b/;
const rejeitou = (falas, produtoAnotado) => {
  const sabor = semAcP(produtoAnotado).replace(/^bolo (de )?/, "").trim();
  if (!sabor) return false;
  return new RegExp(
    "\\b(nao|nunca)\\s+(pedi|queria|quero|falei|escolhi|e|era|foi)\\b[^|.!?]{0,40}" +
      sabor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).test(semAcP(falas.join(" | ")));
};

console.log("== negar o bolo que o codigo escolheu conta como troca ==");
const A_CONVERSA = [
  "vou fazer festa pro meu filho e nao sei o que preciso, me ajuda",
  "acho que uns 25, e dia 12/09 a tarde",
  "eu nao pedi brigadeiro. queria de morango. pao de lo branco",
  "isso, morango. sem topo e sem papel de arroz",
];
conferir(rejeitou(A_CONVERSA, "bolo brigadeiro"), 'o caso medido: "eu nao pedi brigadeiro"', "o pedido fecha com os dois bolos");
for (const [fala, produto, esperado, oque] of [
  [["nao pedi bolo de laka"], "bolo laka", true, "sem acento"],
  [["não pedi bolo de laka"], "bolo laka", true, "com acento"],
  [["nunca pedi bolo bombom"], "bolo bombom", true, "nunca em vez de nao"],
  [["nao era morango, era prestigio"], "bolo morango", true, "nao era X"],
  // Os negativos: nenhum destes pode virar troca.
  [["quero um bolo de brigadeiro de 2,5 kg"], "bolo brigadeiro", false, "pedir nao e negar"],
  [["nao quero docinho. o bolo de brigadeiro ta otimo"], "bolo brigadeiro", false, "negar OUTRA coisa"],
  [["nao quero papel de arroz"], "bolo brigadeiro", false, "negar acessorio"],
  [["brigadeiro sim, e tambem 60 docinhos"], "bolo brigadeiro", false, "confirmar nao e negar"],
]) {
  conferir(rejeitou(fala, produto) === esperado, oque + ": " + JSON.stringify(fala[0]), "deu " + rejeitou(fala, produto));
}

console.log("");
console.log("== dois bolos so com a palavra do cliente ==");
conferir(!DOIS_BOLOS.test(semAcP(A_CONVERSA.join(" | "))), "a conversa medida NAO autoriza dois bolos", "dois_bolos continua sendo saida de emergencia");
for (const f of [
  "quero dois bolos, um de morango e um de brigadeiro",
  "pode ser 2 bolos",
  "quero mais um bolo",
  "os dois mesmo",
  "um de cada",
]) {
  conferir(DOIS_BOLOS.test(semAcP(f)), "festa de dois bolos continua passando: " + JSON.stringify(f), "travou venda legitima");
}

console.log("");
console.log('== "ta bom de salgado" e CHEGA, nao e SIM ==');
for (const [fala, aceita, oque] of [
  ["ta bom de salgado", false, "o caso medido"],
  ["ta bom de docinho", false, "vale pra qualquer familia"],
  ["ja chega de salgado", false, "outra forma de dizer chega"],
  ["ta bom", true, "aceite limpo continua aceite"],
  ["pode ser assim", true, "aceite continua aceite"],
  ["ta bom pra mim", true, "'pra' nao e 'de'"],
  ["isso mesmo", true, "aceite continua aceite"],
]) {
  const deu = guardas.aceitouAOferta(fala);
  conferir(deu === aceita, oque + ": " + JSON.stringify(fala) + " -> " + (aceita ? "aceite" : "NAO e aceite"), "deu " + deu);
}

console.log("");
console.log("== a impressao digital dos 80 salgados ==");
const sortido = guardas.sugestaoDeSortido("salgado_frito", 100);
const semACoxinha = sortido.filter((i) => i.produto !== "coxinha").reduce((a, i) => a + i.qtd, 0);
conferir(
  semACoxinha === 80,
  "o sortido de 100 menos a coxinha da exatamente os 80 do defeito",
  "deu " + semACoxinha + " (a conta mudou, revisar o caso)",
);

console.log("");
console.log(
  erros === 0
    ? "O BOLO TROCADO NAO VIRA DOIS"
    : erros + " FALHA(S): o cliente paga por item que nao pediu",
);
process.exit(erros === 0 ? 0 : 1);
