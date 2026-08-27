// UMA MENSAGEM ENTRA, UMA RESPOSTA SAI
//
// Quarta peca do fluxo novo: o motor que junta as tres anteriores. Recebe
// (estado, mensagem) e devolve (estado novo, fala). Sem laco de ferramentas,
// sem a IA decidindo quantas voltas dar.
//
// POR QUE SEM LACO
//
// A versao antiga tinha um laco em que o modelo chamava ferramenta, lia a
// recusa e chamava de novo. Numa conversa real ele chamou registrar_pedido
// CINCO vezes seguidas levando a mesma negativa, ate a conversa morrer num
// "deixa eu chamar alguem da equipe" — com o cliente tendo dado nome, data,
// hora e pagamento.
//
// A IA E GRAVADA AQUI
//
// `pensar` e injetado: em producao e a OpenAI, neste teste sao respostas
// prontas. A conversa inteira de uma festa roda sem gastar um centavo, e foi
// por nao existir isso que a versao antiga so podia ser testada conversando
// com o robo de verdade.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-fluxo-motor.mts");
fs.writeFileSync(
  sonda,
  [
    'import { responder } from "../lib/ia/fluxo/fluxo.ts";',
    "const gravado: Record<string, unknown> = {",
    "  '20 pessoas': { pessoas: 20 },",
    "  'quero coxinha e risoles': { itens:[{produto:'coxinha',qtd:100},{produto:'risólis',qtd:100}] },",
    "  'risoles de frango': { itens:[{produto:'risólis',qtd:100,obs:'frango'}] },",
    "  'brigadeiro e beijinho': { itens:[{produto:'brigadeiro',qtd:50},{produto:'beijinho',qtd:50}] },",
    "  'forminha rosa': { forminha:'rosa' },",
    "  'bolo de ninho': { itens:[{produto:'ninho',qtd:2}] },",
    "  'entao o de morango': { itens:[{produto:'morango',qtd:2}] },",
    "  'sandro, dia 12/09 as 11h': { dados:{nome:'Sandro',data:'12/09/2026',hora:'11:00'} },",
    "  'da minnie': { tema:'Minnie' },",
    "  'arthur, 5 anos': { aniversariante:{nome:'Arthur',idade:'5 anos'} },",
    "};",
    "const pensar = async ({ mensagem }: { mensagem: string }) => (gravado[mensagem] ?? {}) as never;",
    "let e: Record<string, unknown> = { ehFesta:true, pessoas:null, base:{salgados:200,docinhos:100,boloKg:2,totalCentavos:41880}, baseAceita:false, itens:[], naoQuer:[], dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, topoNome:null, topoIdade:null, tema:null, retomarEm:null };",
    "const passos = [",
    "  {texto:'20 pessoas'}, {texto:'',botaoId:'base_sim'}, {texto:'quero coxinha e risoles'},",
    "  {texto:'risoles de frango'}, {texto:'brigadeiro e beijinho'}, {texto:'forminha rosa'},",
    "  {texto:'bolo de ninho'}, {texto:'entao o de morango'}, {texto:'',botaoId:'prato_aberto'},",
    "  {texto:'',botaoId:'topo_sim'}, {texto:'',botaoId:'papel_sim'},",
    "  {texto:'da minnie'}, {texto:'arthur, 5 anos'},",
    "  {texto:'sandro, dia 12/09 as 11h'}, {texto:'',botaoId:'pag_pix'},",
    "];",
    "const linhas = [];",
    "let chamadas = 0;",
    "for (const p of passos) {",
    "  const r = await responder(e as never, p as never, pensar);",
    "  e = r.estado as never;",
    "  if (r.chamouIA) chamadas++;",
    "  linhas.push({ entrada: p.botaoId ?? p.texto, etapa: r.etapa, texto: r.fala.texto, chamouIA: r.chamouIA, rastro: r.rastro });",
    "}",
    "console.log(JSON.stringify({ linhas, estado: e, chamadas, total: passos.length }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-fluxo-motor.mts"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const { linhas, estado, chamadas, total } = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];
const passo = (entrada) => linhas.find((l) => l.entrada === entrada);

// ------------------------------------------- a conversa anda ate o fim
const caminho = linhas.map((l) => l.etapa);
if (caminho[caminho.length - 1] !== "confirmacao") {
  falhas.push("a festa nao chegou na confirmacao; parou em " + caminho[caminho.length - 1]);
}
// Nao pode ficar preso repetindo a mesma etapa sem motivo.
if (new Set(caminho).size < 5) {
  falhas.push("a conversa travou: passou por " + new Set(caminho).size + " etapas em " + total + " mensagens");
}

// ------------------------- a categoria do item vem da etapa (nao vazia)
// Foi o defeito que o teste pegou antes de ir pro ar: sem categoria, a etapa do
// salgado nunca se cumpria e a conversa ficava presa nela pra sempre.
for (const i of estado.itens) {
  if (!i.categoria) falhas.push("o item " + i.produto + " entrou sem categoria; a etapa nunca vai se cumprir");
}
console.log("Itens: " + estado.itens.map((i) => i.produto + " [" + i.categoria + "]").join(", "));
// PROCURA PELO NOME CANONICO.
//
// O bolo de festa e guardado com o prefixo ("bolo morango"), e o prefixo nao e
// enfeite: e ele que separa o bolo do docinho de mesmo nome. Este teste
// procurava por "morango" cru, do jeito que o cliente fala, e por isso passou a
// nao achar o item quando o sistema comecou a escrever um nome so por produto.
// O item estava certo o tempo todo; a busca e que era pelo nome velho.
const cat = (nome) => (estado.itens.find((i) => i.produto === nome) ?? {}).categoria;
if (cat("coxinha") !== "salgado_frito") falhas.push("coxinha entrou como " + cat("coxinha"));
if (cat("brigadeiro") !== "docinho") falhas.push("brigadeiro entrou como " + cat("brigadeiro") + " em vez de docinho");
if (cat("bolo morango") !== "bolo_festa") falhas.push("o bolo de morango entrou como " + cat("bolo morango"));

// ------------------------- o sabor que ela nao achou, ela COMENTA (e nao nega)
// A Doce Pao nao tem bolo de ninho com esse nome. Sem comentar, o fluxo repetia
// "E o bolo, qual sabor?" pra sempre e o cliente achava que ela nao entendeu.
//
// O QUE ELA DIZ MUDOU EM 27/08/2026, E O TESTE MUDOU JUNTO.
//
// Ela dizia "A gente nao faz ninho", e isso era negacao. Medido na etapa do
// bolo: "bolo de chocolate" recebia "A gente nao faz chocolate", sendo que a
// casa faz brigadeiro, laka, bombom, biz, prestigio e dois amores, todos bolos
// de chocolate. A dona ja tinha dito que a lista e aberta: "se o cliente pedir
// outro sabor, a gente vai colocando".
//
// Entao o teste cobra o que importa e nao a palavra: ela tem que CITAR o sabor
// que nao achou, pra o cliente saber que foi lido, e NAO pode dizer que a casa
// nao faz.
{
  const p = passo("bolo de ninho");
  if (!p) falhas.push("o passo do bolo de ninho sumiu do teste");
  else if (!/ninho/i.test(p.texto)) {
    falhas.push("pediu um sabor que ela nao achou e ela nao comentou: " + p.texto);
  } else if (/n(ã|a)o faz|n(ã|a)o tem|n(ã|a)o temos/i.test(p.texto)) {
    falhas.push("negou o sabor em vez de mostrar o que a casa tem: " + p.texto);
  }
}
// E o comentario nao pode sobrar pra mensagem seguinte.
{
  const p = passo("entao o de morango");
  if (p && /n(ã|a)o achei/i.test(p.texto)) falhas.push("o aviso do sabor vazou pra mensagem seguinte");
}

// ------------------------------------- o que nao existe nao entra
if (estado.itens.some((i) => /ninho/i.test(i.produto))) {
  falhas.push("o bolo de ninho entrou no pedido; a padaria nao faz esse sabor");
}

// -------------------------------------------- botao nao chama a IA
const deBotao = linhas.filter((l) => /^(base_|topo_|papel_|prato_|pag_)/.test(l.entrada));
for (const l of deBotao) {
  if (l.chamouIA) falhas.push("o toque em " + l.entrada + " chamou a IA; botao tem que sair de graca");
}
if (chamadas >= total) falhas.push("todas as mensagens chamaram a IA; os botoes deixaram de economizar");

console.log("Mensagens: " + total + " | chamadas de IA: " + chamadas + " | de graca: " + (total - chamadas));
console.log("Caminho: " + [...new Set(caminho)].join(" -> "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: a festa inteira anda ate a confirmacao, e o botao nao custa nada.");
