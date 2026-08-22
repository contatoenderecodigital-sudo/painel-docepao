// UMA CAMADA NAO DESMENTE A OUTRA
//
// O defeito que mais se repetiu neste projeto nao e a IA errando: e uma guarda
// minha mandando fazer o que outra guarda minha apaga depois. O rastro de
// 23/08/2026, com o cliente vendo o resultado:
//
//   [rastro] anotar_dados -> ... Pergunte isso agora, numa frase.
//   [ia] ela pediu dado de fechamento com o pedido vazio; tirei do texto
//
//   Dora: "Anotei a data da festa para 12/09/2026. Pode ser assim?"
//
// A instrucao mandou pedir nome e pagamento com o pedido vazio; a guarda de
// texto apagou a pergunta; sobrou o toco "Pode ser assim?" sobre uma data que o
// cliente acabara de dar.
//
// Este teste nao adivinha intencao: ele cobra que os pares conhecidos de
// "instrucao que manda" e "guarda que apaga" continuem combinando entre si.
// Quando alguem mexer num lado e esquecer o outro, cai aqui.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const cerebro = fs.readFileSync(path.join(raiz, "lib/ia/cerebro.ts"), "utf8");

const falhas = [];

// ---------------------------------------------------------------- par 1
// A guarda textoSemPedirDadosDeFechamento apaga pedido de nome e pagamento
// quando o pedido esta vazio. Entao NENHUMA instrucao pode mandar pedir isso
// com o pedido vazio.
{
  const apaga = /ela pediu dado de fechamento com o pedido vazio/.test(cerebro);
  if (!apaga) {
    falhas.push("a guarda que apaga pedido de dado com pedido vazio sumiu; o par ficou solto");
  }
  // A instrucao do outro lado precisa tratar o caso "sem item" primeiro.
  const trecho = cerebro.slice(
    cerebro.indexOf("const faltando = Object.keys(NOMES)"),
    cerebro.indexOf("const faltando = Object.keys(NOMES)") + 2600,
  );
  if (!/itensAnotados\.length === 0\s*$|itensAnotados\.length === 0\s*\n\s*\?\s*"NAO peca nome nem pagamento/m.test(trecho)) {
    falhas.push("a instrucao de anotar_dados voltou a mandar pedir nome/pagamento com o pedido vazio");
  }
  if (/itensAnotados\.length === 0 \|\| faltando\.every/.test(cerebro)) {
    falhas.push("a condicao invertida voltou: pedido vazio manda perguntar dado de fechamento");
  }
}

// ---------------------------------------------------------------- par 2
// A guarda que apaga a pergunta repetida e a que apaga a pergunta de hora/nome
// nao podem tocar no resumo do pedido: os numeros do resumo sao do motor.
{
  const guardas = fs.readFileSync(path.join(raiz, "lib/ia/guardas.ts"), "utf8");
  const protegidas = [
    "textoSemPerguntaDeHora",
    "textoSemPerguntaDeNome",
    "textoSemPedirDadosDeFechamento",
    "textoSemPerguntaJaFeita",
    "textoSemValorDoTopo",
  ];
  for (const nome of protegidas) {
    const i = guardas.indexOf("export function " + nome);
    if (i < 0) {
      falhas.push("a guarda " + nome + " sumiu");
      continue;
    }
    const corpo = guardas.slice(i, i + 1400);
    if (!/Pedido recebido|\*Total:/.test(corpo)) {
      falhas.push(nome + " voltou a poder mexer no resumo do pedido");
    }
  }
}

// ---------------------------------------------------------------- par 3
// Toda guarda que RECUSA por "o cliente nao falou" tem que reconhecer quando o
// cliente delegou a escolha, senao ela recusa o que a IA acertou. Foi o que
// aconteceu com o bolo da mae de 60 anos e com a esfirra do coffee break.
{
  const chamadas = [...cerebro.matchAll(/pediuQueVoceEscolha\(([^)]*)\)/g)].map((m) => m[1].trim());
  const soUltima = chamadas.filter((a) => /^(falaDoCliente|String\(ultimaFala\))$/.test(a));
  if (soUltima.length) {
    falhas.push(soUltima.length + " guarda(s) de delegacao leem so a ultima fala: " + soUltima.join(", "));
  }
  if (chamadas.length < 5) {
    falhas.push("as guardas de delegacao sumiram do cerebro (achei " + chamadas.length + ")");
  }
}

console.log("Pares de instrucao e guarda conferidos: 3");
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: nenhuma camada manda fazer o que a outra apaga.");
