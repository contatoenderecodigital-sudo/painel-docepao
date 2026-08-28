// A CONVERSA DAS PECAS DO BOLO SEMPRE TERMINA, E NUNCA REPETE A MESMA PERGUNTA.
//
// POR QUE ISTO EXISTE, E POR QUE ELE E DIFERENTE DOS OUTROS
//
// Em 28/08/2026 eu consertei duas vezes a etapa das pecas do bolo e ERREI as
// duas, do mesmo jeito: escrevendo a mao, no teste, a marca que o fluxo grava.
//
//   1a vez: o teste montava `['bolo']`, uma marca ambigua (a etapa do bolo
//           fazia duas perguntas). O teste passava e o defeito estava no ar.
//   2a vez: o teste montava `['bolo','bolo:tres']`, uma marca que NAO EXISTE
//           MAIS: a pergunta juntada passou a sair pela etapa das pecas, entao
//           o fluxo grava `pecas_do_bolo:tres`. O teste passava contra uma
//           marca fantasma, e o defeito foi pro ar.
//
// O segundo custou caro: a etapa nunca fechava, a padaria repetia a mesma
// pergunta PARA SEMPRE, e o pedido deixou de ser registrado. Medido na quarta
// conversa do mesmo cenario, ja em producao:
//
//     padaria >> So faltam os detalhes do bolo: quer papel de arroz...e topo?
//     cliente >> pode confirmar
//     padaria >> So faltam os detalhes do bolo: quer papel de arroz...e topo?
//     (NADA, o pedido nao foi registrado)
//
// O QUE MUDA AQUI: A MARCA NAO E ESCRITA A MAO.
//
// Este teste SIMULA a conversa. Ele pergunta pela etapa, le a chave da fala que
// saiu, e monta a marca do mesmo jeito que o `fluxo.ts` monta (`id` e
// `id:chave`). Se a chave mudar, o teste acompanha; se a marca que o codigo
// procura nao for a que o fluxo grava, o loop nao fecha e ele reprova.
//
// E o unico jeito de nao errar uma terceira vez pelo mesmo motivo.
//
// O QUE ELE COBRA
//
//   1. o cliente que IGNORA tudo chega ao fim: a etapa fecha em poucos turnos
//   2. nenhuma pergunta sai DUAS vezes: ignorar da lugar a proxima, nao repete
//   3. o cliente que RESPONDE fecha na hora
//   4. quem manda tudo de uma vez ouve a pergunta juntada, e ela vale pelas duas
//
// Roda com: node testes/a-conversa-das-pecas-sempre-termina.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-conversa-pecas.mjs");

const SONDA = [
  "import { ROTEIRO_DA_FESTA } from '../lib/ia/fluxo/etapas.ts';",
  "import { falaDaEtapa } from '../lib/ia/fluxo/pergunta.ts';",
  "",
  "const pecas = ROTEIRO_DA_FESTA.find((e) => e.id === 'pecas_do_bolo');",
  "",
  "const BASE = {",
  "  ehFesta: true, pessoas: 20, base: null, baseAceita: true, naoQuer: [], forminha: 'azul',",
  "  dados: {}, pecas: { topo: null, papelDeArroz: null }, topoNome: null, topoIdade: null,",
  "  escrito: null, tema: null, prato: null, ofereceu: false, etapasJaPerguntadas: [],",
  "  itens: [{ produto: 'bolo brigadeiro', categoria: 'bolo_festa', qtd: 2, obs: null }],",
  "};",
  "",
  "// A MARCA SAI DO FLUXO, NAO DA MINHA MAO.",
  "//",
  "// E a mesma conta do fluxo.ts: marca a etapa, e marca a etapa com a chave da",
  "// fala que saiu. Escrever isto a mao no teste foi como eu errei duas vezes.",
  "const marcarComoOFluxoMarca = (etapa, fala, marcas) => {",
  "  const novas = [etapa.id, ...(fala.chave ? [etapa.id + ':' + fala.chave] : [])];",
  "  return [...marcas, ...novas.filter((m) => !marcas.includes(m))];",
  "};",
  "",
  "// Roda a conversa ate a etapa fechar, ou desistir. Devolve o que aconteceu.",
  "const conversar = (estadoInicial, responde) => {",
  "  let p = { ...estadoInicial };",
  "  const perguntas = [];",
  "  for (let turno = 0; turno < 8; turno++) {",
  "    if (pecas.cumprida(p)) return { fechou: true, turnos: turno, perguntas };",
  "    const fala = falaDaEtapa(pecas, p, 21880);",
  "    const texto = String(fala.texto ?? '').trim();",
  "    if (!texto) return { fechou: false, turnos: turno, perguntas, vazia: true };",
  "    perguntas.push(texto.slice(0, 40));",
  "    p = { ...p, etapasJaPerguntadas: marcarComoOFluxoMarca(pecas, fala, p.etapasJaPerguntadas) };",
  "    p = responde(p, texto);",
  "  }",
  "  return { fechou: false, turnos: 8, perguntas };",
  "};",
  "",
  "const ignoraTudo = (p) => p;",
  "const respondeNao = (p, texto) => {",
  "  if (/papel de arroz/i.test(texto) && /topo/i.test(texto)) return { ...p, pecas: { topo: false, papelDeArroz: false } };",
  "  if (/papel de arroz/i.test(texto)) return { ...p, pecas: { ...p.pecas, papelDeArroz: false } };",
  "  if (/topo/i.test(texto)) return { ...p, pecas: { ...p.pecas, topo: false } };",
  "  return p;",
  "};",
  "",
  "const tudoDeUmaVez = { ...BASE, dados: { nome: 'Ana', data: '12/09/2026', hora: '10:00', pagamento: 'pix' } };",
  "",
  "console.log(JSON.stringify({",
  "  ignorando:      conversar(BASE, ignoraTudo),",
  "  respondendo:    conversar(BASE, respondeNao),",
  "  juntadaIgnorada: conversar(tudoDeUmaVez, ignoraTudo),",
  "  juntadaRespondida: conversar(tudoDeUmaVez, respondeNao),",
  "}));",
];

fs.writeFileSync(sonda, SONDA.join("\n"), "utf8");

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-conversa-pecas.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

const falhas = [];

for (const [nome, caso] of Object.entries(r)) {
  const repetida = caso.perguntas.find((q, i) => caso.perguntas.indexOf(q) !== i);
  console.log(nome + ": " + (caso.fechou ? "fechou" : "NAO FECHOU") + " em " + caso.turnos + " turno(s)");
  for (const q of caso.perguntas) console.log("    >> " + q);

  if (!caso.fechou) {
    falhas.push(
      nome + ": a etapa nunca fecha. A padaria fica repetindo a pergunta e o " +
        "pedido nao e registrado" + (caso.vazia ? " (e a fala veio vazia)" : ""),
    );
  }
  if (repetida) {
    falhas.push(nome + ": a mesma pergunta saiu duas vezes: " + JSON.stringify(repetida));
  }
}

// Quem RESPONDE tem que fechar mais rapido que quem ignora: se os dois levam o
// mesmo tanto, responder nao esta valendo de nada.
if (r.respondendo.turnos > r.ignorando.turnos) {
  falhas.push("quem responde leva MAIS turnos que quem ignora: " + r.respondendo.turnos + " contra " + r.ignorando.turnos);
}
// A pergunta juntada existe pra resolver as duas de uma vez: um turno.
if (r.juntadaRespondida.turnos > 1) {
  falhas.push("a pergunta juntada devia resolver em um turno, levou " + r.juntadaRespondida.turnos);
}

console.log("");
if (falhas.length) {
  console.log("ERRO  a conversa das pecas do bolo nao termina direito (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    ignorando ou respondendo, a conversa das pecas sempre termina");
console.log("");
console.log("PASSOU");
