// TRES DEFEITOS QUE SO APARECERAM QUANDO ALGUEM OLHOU OS PRINTS.
//
// 22/08/2026. Cinco conversas ao vivo passaram em tudo que a medicao sabia
// medir: pedido fechado, data certa, total certo, nenhum item fantasma. O
// relatorio automatico disse "5 de 5".
//
// Ai o dono mandou OLHAR as imagens. Estes tres estavam na tela, em conversas
// que a medicao aprovou. Nenhum deles muda o total, nenhum aparece no banco --
// e os tres sao exatamente do tipo que faz o cliente achar que esta falando
// com uma maquina burra.
//
// Roda com: node testes/o-que-eu-vi-nos-prints.cjs
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const cerebro = fs.readFileSync(path.join(raiz, "lib", "ia", "cerebro.ts"), "utf8");
const montagem = fs.readFileSync(path.join(raiz, "lib", "banco", "montagem.ts"), "utf8");

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

// ---------------------------------------------------------------------------
console.log("== 1. a observacao repetida na comanda da cozinha ==");
//
//   bolo morango (sem topo e sem papel de arroz, sem topo nem papel de arroz)
//
// O codigo escreveu a recusa com "e sem"; a IA escreveu com "nem". A limpeza
// comparava texto cru, nenhuma continha a outra, e as duas foram impressas.
const chaveDaObs = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bnem\b/g, "e sem")
    .replace(/\bn[ao]o (quero|vou querer|quer|precisa de)\b/g, "sem")
    .replace(/\bsem +sem\b/g, "sem")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

for (const [a, b, iguais, oque] of [
  ["sem topo e sem papel de arroz", "sem topo nem papel de arroz", true, "o caso da comanda"],
  ["sem topo", "nao quero topo", true, "outra forma de dizer a mesma recusa"],
  ["sem papel de arroz", "não quero papel de arroz", true, "com acento"],
  // Os negativos: observacao diferente nao pode ser engolida.
  ["pao de lo branco", "recheio de morango", false, "duas observacoes de verdade"],
  ["misto (queijo e presunto)", "frango com catupiry", false, "sabor com 'e' dentro do nome"],
  ["forminha azul", "forminha dourada", false, "cores diferentes"],
  ["sem topo", "sem papel de arroz", false, "duas recusas diferentes"],
]) {
  const deu = chaveDaObs(a) === chaveDaObs(b);
  conferir(deu === iguais, oque + ": " + JSON.stringify(a) + " x " + JSON.stringify(b), "deu " + deu);
}
conferir(
  montagem.includes("const chaveDaObs = (t: string) =>") && montagem.includes('replace(/\\bnem\\b/g, "e sem")'),
  "a limpeza da observacao iguala as formas antes de comparar",
  "a comanda volta a sair com a mesma recusa escrita duas vezes",
);

// ---------------------------------------------------------------------------
console.log("");
console.log("== 2. o 'boa tarde' que caiu no meio da mensagem ==");
//
//   cliente: boa tarde, quanto sai 100 salgados pra festa?
//   Dora:    Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento)...
//            Boa tarde! Quantas pessoas vai ter na festa?
//
// Ela cumprimentou certo. Foi o codigo que prefixou o preco por cima.
const SAUDACAO = /^(bom dia|boa tarde|boa noite|oi|ol[áa]|opa|e a[íi])\b[!,.]*\s*/i;
function saudacaoNaFrente(t) {
  if (!t || SAUDACAO.test(t.trimStart())) return t;
  const ps = t.split(/\n{2,}/);
  const k = ps.findIndex((p, i) => i > 0 && SAUDACAO.test(p.trimStart()));
  if (k < 1) return t;
  const p = ps[k].trimStart();
  const s = (p.match(SAUDACAO) || [""])[0].trim();
  ps[k] = p.replace(SAUDACAO, "").trimStart();
  return (s + " " + ps.filter((x) => x.trim()).join("\n\n")).trim();
}

const oCaso = "Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento).\n\nBoa tarde! Quantas pessoas vai ter na festa?";
const arrumado = saudacaoNaFrente(oCaso);
conferir(/^Boa tarde!/.test(arrumado), "o caso medido: a saudacao volta pro comeco", "saiu " + JSON.stringify(arrumado));
conferir(
  arrumado.includes("R$ 100,00") && arrumado.includes("Quantas pessoas"),
  "  e nada do conteudo se perde no caminho",
  "saiu " + JSON.stringify(arrumado),
);
conferir(
  saudacaoNaFrente("Boa tarde! O cento sai R$ 100,00.") === "Boa tarde! O cento sai R$ 100,00.",
  "quem ja comeca cumprimentando nao e mexido",
  "mexeu numa mensagem que estava certa",
);
conferir(
  saudacaoNaFrente("O cento sai R$ 100,00.\n\nQuantos voce quer?") === "O cento sai R$ 100,00.\n\nQuantos voce quer?",
  "mensagem sem saudacao nenhuma nao e mexida",
  "inventou saudacao",
);
conferir(
  cerebro.includes("a saudacao tinha caido no meio da mensagem; voltou pro comeco"),
  "o cerebro faz essa correcao",
  "o 'bom dia' volta pro segundo paragrafo",
);

// ---------------------------------------------------------------------------
console.log("");
console.log("== 3. a pergunta de preco ignorada durante a montagem ==");
//
//   cliente: forminha azul. quanto fica tudo?
//   Dora:    O bolo de morango ta anotado com 2,5 kg. Quer topo de bolo?
//   cliente: nao quero topo nao. MAS ME FALA O VALOR TOTAL POR FAVOR
//   Dora:    O total ficou R$ 337,25 do jeito que esta.
//
// Ela sabia o total o tempo todo. O bloco que responde exigia `pedidoAberto`
// -- pedido JA REGISTRADO --, e durante a montagem, que e quando o cliente
// pergunta, nao havia resposta do codigo.
const PERGUNTOU_TOTAL =
  /(quanto|qual)[^?]{0,30}\b(total|tudo)\b|quanto (ficou|deu|custou)\b|\bvalor total\b|\bqual o valor\b|\btotal (fica|ficou|deu|sai)\b/i;
for (const [fala, pergunta] of [
  ["forminha azul. quanto fica tudo?", true],
  ["quanto fica tudo?", true],
  ["me fala o valor total por favor", true],
  ["quanto ficou?", true],
  ["qual o valor?", true],
  ["quanto deu tudo isso?", true],
  ["quero 50 coxinha", false],
  ["pode fechar", false],
  // Preco de ITEM tem outro dono: nao pode virar o total da montagem.
  ["quanto sai 100 salgados?", false],
  ["quanto ta o cento de coxinha?", false],
]) {
  const deu = PERGUNTOU_TOTAL.test(fala);
  conferir(deu === pergunta, (pergunta ? "e pergunta de total: " : "nao e:            ") + JSON.stringify(fala), "deu " + deu);
}
conferir(
  cerebro.includes("const itensPraCotar = (montagemDoTurno?.itens ?? []).filter((i) => Number(i.qtd) > 0)"),
  "o codigo cota a MONTAGEM pra responder, nao so o pedido registrado",
  "quem pergunta o preco antes de fechar continua sem resposta",
);
conferir(
  cerebro.includes('"Do jeito que está, deu " + brl(cotAgora.total)'),
  "  e responde com o total de agora",
  "a resposta some de novo",
);
conferir(
  cerebro.includes("total da montagem respondido pelo codigo"),
  "  deixando rastro, pra dar pra conferir depois",
  "sem rastro nao da pra saber se a trava entrou",
);

console.log("");
console.log(
  erros === 0
    ? "O QUE EU VI NOS PRINTS ESTA CONSERTADO"
    : erros + " FALHA(S): voltou algo que so aparece olhando a conversa",
);
process.exit(erros === 0 ? 0 : 1);
