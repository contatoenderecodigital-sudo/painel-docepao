// O FLUXO SABE ONDE ESTA
//
// Este e o teste da peca central da IA nova. Ele caminha a festa inteira, de
// "cliente chegou agora" ate "pedido confirmado", e cobra que a etapa da vez
// seja sempre a certa.
//
// POR QUE ISSO IMPORTA
//
// Na versao antiga a IA decidia o rumo da conversa e quarenta guardas corriam
// atras. Os defeitos que o dono viu no WhatsApp dele em 22 e 23/08/2026
// nasceram todos disso:
//
//   cliente: 4 leites 1kg e 100 brigadeiros e 100 beijinhos
//   Dora:    Anotei o bolo 4 leites COM BRIGADEIRO, 1 kg
//
//   Dora:    Quer escolher os tipos de SALGADOS primeiro?
//   cliente: Sim
//   Dora:    Te mandei o cardapio de DOCINHOS aqui.
//
// Com etapa, os dois somem por construcao: na etapa do bolo so entra sabor de
// bolo, e o cardapio que vai e o da etapa, nao o que a IA escreveu.
//
// E RODA DE GRACA
//
// etapaDaVez e funcao pura: mesma entrada, mesma saida, sem banco e sem modelo.
// O fluxo inteiro se testa sem gastar um centavo de API, que e o oposto do que
// acontecia antes, quando so dava pra saber se estava certo conversando com o
// robo de verdade.
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const raiz = path.join(__dirname, "..");

const sonda = path.join(__dirname, "_sonda-fluxo.mts");
fs.writeFileSync(
  sonda,
  [
    'import { etapaDaVez, ETAPAS_DA_FESTA } from "../lib/ia/fluxo/etapas.ts";',
    "const vazio = { ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null, topoIdade:null, tema:null };",
    "const p = (x: Record<string, unknown>) => ({ ...vazio, ...x });",
    "const salgado = [{produto:'coxinha',categoria:'salgado_frito',qtd:40,obs:null}];",
    "const bolo = [{produto:'bolo ninho',categoria:'bolo_festa',qtd:2,obs:null}];",
    "const festa = { ehFesta:true, pessoas:20, baseAceita:true };",
    "const casos: [string, unknown][] = [",
    "  ['chegou agora', vazio],",
    "  ['disse que e festa', p({ehFesta:true})],",
    "  ['disse 20 pessoas', p({ehFesta:true,pessoas:20})],",
    "  ['aceitou a base', p(festa)],",
    "  ['ja tem salgado', p({...festa, itens:salgado})],",
    "  ['nao quer docinho', p({...festa, naoQuer:['docinho'], itens:salgado})],",
    "  ['so bolo', p({...festa, naoQuer:['salgado','docinho']})],",
    "  ['tem bolo falta peca', p({...festa, naoQuer:['salgado','docinho'], itens:bolo})],",
    "  ['peca ok falta dado', p({...festa, naoQuer:['salgado','docinho'], itens:bolo, pecas:{topo:true,papelDeArroz:false}, topoNome:'Arthur', topoIdade:'5 anos', tema:'Minnie'})],",
    "  ['tudo pronto', p({...festa, naoQuer:['salgado','docinho'], itens:bolo, pecas:{topo:false,papelDeArroz:false}, dados:{nome:'Sandro',data:'12/09',hora:'11:30',pagamento:'pix'}})],",
    "];",
    "const saida = casos.map(([nome, est]) => [nome, etapaDaVez(est as never).id]);",
    "const etapas = ETAPAS_DA_FESTA.map((e) => ({ id: e.id, pergunta: e.pergunta, espera: e.espera.tipo, rotulo: e.rotulo }));",
    "console.log(JSON.stringify({ saida, etapas }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-fluxo.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { saida, etapas } = JSON.parse(bruto.trim().split("\n").pop());

const falhas = [];

// ------------------------------------------- a etapa da vez e a certa
const esperado = {
  "chegou agora": "abertura",
  "disse que e festa": "quantas_pessoas",
  "disse 20 pessoas": "base_da_festa",
  "aceitou a base": "salgado",
  "ja tem salgado": "docinho",
  "nao quer docinho": "bolo",
  "so bolo": "bolo",
  "tem bolo falta peca": "pecas_do_bolo",
  "peca ok falta dado": "dados",
  "tudo pronto": "confirmacao",
};
for (const [nome, etapa] of saida) {
  if (etapa !== esperado[nome]) {
    falhas.push("em '" + nome + "' o fluxo foi pra " + etapa + " em vez de " + esperado[nome]);
  }
}

// ------------------------- toda etapa que pergunta tem o que esperar
for (const e of etapas) {
  if (e.pergunta && e.espera === "nada") {
    falhas.push("a etapa " + e.id + " pergunta e nao espera resposta nenhuma");
  }
  if (!e.rotulo) falhas.push("a etapa " + e.id + " nao tem rotulo pro painel");
}

// -------------------------------- a ordem e a da cozinha, nao outra
// Salgado, docinho, bolo, pecas: foi a dona que pediu assim.
const ordem = etapas.map((e) => e.id);
const daCozinha = ["salgado", "docinho", "bolo", "pecas_do_bolo"];
const posicoes = daCozinha.map((id) => ordem.indexOf(id));
for (let i = 1; i < posicoes.length; i++) {
  if (posicoes[i] < posicoes[i - 1]) {
    falhas.push("a ordem da cozinha mudou: " + daCozinha.join(" -> ") + " esta fora de ordem");
  }
}

// --------------------------- dados de fechamento vem DEPOIS dos itens
if (ordem.indexOf("dados") < ordem.indexOf("bolo")) {
  falhas.push("a etapa de dados voltou a vir antes dos itens; foi assim que ela pediu nome com o pedido vazio");
}

console.log("Estados caminhados: " + saida.length);
console.log("Etapas da festa: " + etapas.length);
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o fluxo sabe onde esta em todos os estados, e de graca.");
