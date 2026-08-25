// A CONVERSA ESCUTA O CLIENTE
//
// Teste da Kemilly no celular dela, 23/08/2026. Foi o teste que mais achou
// defeito neste projeto, e todos da mesma familia: o cliente responde e o
// sistema nao escuta.
//
// 1. A REESCRITA TROCOU A PERGUNTA
//
//      Dora:    O bolo será entregue no prato de MDF aberto ou na embalagem com tampa?
//      Kemilly: Com tampa
//      Dora:    O bolo é com tampa?        <- o codigo escreveu "O bolo vai com topo?"
//      Kemilly: Sim
//
//    A camada que reescreve, vendo que a ultima fala dela tinha sido "Com
//    tampa", trocou o assunto da pergunta. Ela respondeu "Sim" achando que
//    confirmava a embalagem, e o sistema gravou TOPO = SIM.
//
//    Onde a resposta e fechada, o texto e lei: o toque no botao vira dado, e
//    trocar a pergunta e trocar o dado.
//
// 2. "NAO QUERO TOPO" NAO DESFAZIA NADA
//
//      Dora:    O nome do topo vai ser qual?
//      Kemilly: nao quero topo
//      Dora:    Em nome de quem vai o topo?
//      Kemilly: nao quero topo de bolo
//      Dora:    Para quem eu coloco o nome no topo?
//
//    Toda pergunta sabia gravar sim e gravar nao, e nao sabia voltar atras.
//
// 3. ITEM FALADO NA ABERTURA VIRAVA "OUTRO"
//
//    "quero encomendar bolo, beijinhos e cajuzinhos" na primeira mensagem: os
//    tres entraram como categoria "outro", porque eu so sabia dar categoria
//    dentro da etapa da familia. No painel da dona: "Outro / bolo / 0 quilos".
//
// 4. A COR DA FORMINHA
//
//    Duas correcoes seguidas aqui, e a segunda desfez a primeira de proposito.
//
//    Em 23/08 eu fiz a primeira cor ir pro primeiro docinho e a segunda pro
//    segundo, e passei a perguntar item por item quando faltasse cor.
//
//    Em 24/08 o dono cortou isso: "voce pode aceitar uma ou mais cor e NAO quero
//    que peca o cliente qual cor de forminha usar para X docinho". Ele esta
//    certo: a cliente escolhe as cores da FESTA dela, nao a cor de cada docinho,
//    e perguntar item por item vira interrogatorio.
//
//    Agora e uma pergunta so, aceita quantas cores ele falar, e todas valem pro
//    pedido inteiro.
//
// 5. A MESMA PERGUNTA SAIU TRES VEZES
//
//    O tema, quase palavra por palavra, porque as respostas dela nao viravam
//    dado. Do lado do cliente, isso e o sinal mais claro de que ninguem leu.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-escuta.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null,",
    "  topoIdade:null, tema:null, forminha:null, prato:null, ultimaFala:null, insistiu:0,",
    "  retomarEm:null, assunto:null,",
    "};",
    "const com = (p) => ({ ...VAZIO, ...p });",
    "const nada = async () => ({});",
    "",
    "// 3. os tres itens da abertura, sem quantidade nenhuma",
    "const abertura = await responder(VAZIO as never, { texto: 'quero bolo, beijinhos e cajuzinhos pra festa' } as never,",
    "  (async () => ({ ehFesta:true, itens:[{produto:'bolo',qtd:0},{produto:'beijinho',qtd:0},{produto:'cajuzinho',qtd:0}] })) as never);",
    "",
    "// 4. duas cores para dois docinhos",
    "const doisDocinhos = com({ ehFesta:true, pessoas:20, baseAceita:true,",
    "  base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880}, naoQuer:['salgado'],",
    "  itens:[{produto:'cajuzinho',categoria:'docinho',qtd:50,obs:null},{produto:'beijinho',categoria:'docinho',qtd:50,obs:null}] });",
    "const cores = await responder(doisDocinhos as never, { texto: 'quero azul e rosa' } as never,",
    "  (async () => ({ forminha: 'azul e rosa' })) as never);",
    "",
    "// 2. ele muda de ideia sobre o topo depois de ter dito sim",
    "const comTopo = com({ ehFesta:true, pessoas:20, baseAceita:true, naoQuer:['salgado','docinho'],",
    "  itens:[{produto:'bolo morango',categoria:'bolo_festa',qtd:2,obs:'Topo: tema Minnie, Arthur, 5 anos'}],",
    "  pecas:{topo:true,papelDeArroz:false}, prato:'aberto', tema:'Minnie', topoNome:'Arthur', topoIdade:'5 anos' });",
    "const desistiu = await responder(comTopo as never, { texto: 'nao quero topo' } as never,",
    "  (async () => ({ naoQuer: ['topo'] })) as never);",
    "",
    "// 5. tres respostas seguidas que nao viram dado",
    "let e: Record<string, unknown> = com({ ehFesta:true, pessoas:20, baseAceita:true, naoQuer:['salgado','docinho'],",
    "  itens:[{produto:'bolo morango',categoria:'bolo_festa',qtd:2,obs:null}],",
    "  pecas:{topo:true,papelDeArroz:false}, prato:'aberto' });",
    "const teimosia = [];",
    "for (const t of ['uma foto', 'sei la', 'hmm']) {",
    "  const r = await responder(e as never, { texto: t } as never, nada as never);",
    "  e = r.estado as never;",
    "  teimosia.push({ texto: r.fala.texto, precisaHumano: r.precisaHumano });",
    "}",
    "",
    "console.log(JSON.stringify({",
    "  abertura: abertura.estado.itens,",
    "  cores: cores.estado.itens.map((i) => ({ produto: i.produto, obs: i.obs })),",
    "  desistiu: { pecas: desistiu.estado.pecas, nome: desistiu.estado.topoNome,",
    "             idade: desistiu.estado.topoIdade, obs: desistiu.estado.itens[0].obs, etapa: desistiu.etapa },",
    "  teimosia,",
    "}));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-escuta.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ------------------------- 1. pergunta com botao nao passa pela reescrita
const dizer = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/dizer.ts"), "utf8");
if (!/fala\.botoes\?\.length/.test(dizer)) {
  falhas.push(
    "a reescrita voltou a poder mexer em pergunta com botao: foi assim que " +
      "'O bolo vai com topo?' virou 'O bolo é com tampa?' e gravou um sim que a cliente nunca deu",
  );
}

// --------------------------- 3. a categoria sai do catalogo, nao da etapa
const cat = (nome) => (r.abertura.find((i) => i.produto === nome) ?? {}).categoria;
if (cat("bolo") !== "bolo_festa") falhas.push("o bolo falado na abertura entrou como " + cat("bolo"));
if (cat("beijinho") !== "docinho") falhas.push("o beijinho da abertura entrou como " + cat("beijinho"));
if (cat("cajuzinho") !== "docinho") falhas.push("o cajuzinho da abertura entrou como " + cat("cajuzinho"));
if (r.abertura.some((i) => i.categoria === "outro")) {
  falhas.push("item conhecido do cardapio entrou como 'outro'; a dona ve isso na tela dela");
}

// ------------------- 4. as cores valem pro pedido todo, e sao uma pergunta so
const obsDe = (nome) => String((r.cores.find((i) => i.produto === nome) ?? {}).obs ?? "");
for (const p of ["cajuzinho", "beijinho"]) {
  if (!/forminha azul e rosa/.test(obsDe(p))) {
    falhas.push("o " + p + " nao ficou com as duas cores que ela pediu: " + obsDe(p));
  }
}
// E o codigo nao pode voltar a perguntar cor item por item.
const perguntaPorItem = fs
  .readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/pergunta.ts"), "utf8")
  .includes("vai em qual cor de forminha");
if (perguntaPorItem) {
  falhas.push("voltou a perguntar a cor item por item; o dono cortou isso em 24/08");
}

// -------------------------------------------- 2. "nao quero" desfaz mesmo
if (r.desistiu.pecas?.topo !== false) falhas.push("disse que nao quer topo e o topo continuou marcado");
if (r.desistiu.nome || r.desistiu.idade) {
  falhas.push("tirou o topo e o nome/idade do aniversariante ficaram presos no pedido");
}
if (/Topo:/.test(String(r.desistiu.obs ?? ""))) {
  falhas.push("tirou o topo e a comanda continuou mandando fazer topo: " + r.desistiu.obs);
}

// ------------------------------ 5. a mesma pergunta nao sai tres vezes
if (r.teimosia[0].texto === r.teimosia[1].texto && r.teimosia[1].texto === r.teimosia[2].texto) {
  falhas.push("a mesma pergunta saiu tres vezes igual; foi o que a Kemilly viu com o tema");
}
if (!r.teimosia[2].precisaHumano) {
  falhas.push("insistiu tres vezes e nao chamou a equipe: o cliente fica preso na mesma pergunta");
}
if (r.teimosia[0].precisaHumano || r.teimosia[1].precisaHumano) {
  falhas.push("chamou a equipe cedo demais; o aviso do painel so pode acender quando ela desiste de verdade");
}

console.log("Abertura: " + r.abertura.map((i) => i.produto + "=" + i.categoria).join(", "));
console.log("Forminha: " + r.cores.map((i) => i.produto + " -> " + i.obs).join(" | "));
console.log("Desistiu do topo: pecas=" + JSON.stringify(r.desistiu.pecas) + " etapa=" + r.desistiu.etapa);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o que o cliente diz chega no pedido, e o que ele desdiz sai dele.");
