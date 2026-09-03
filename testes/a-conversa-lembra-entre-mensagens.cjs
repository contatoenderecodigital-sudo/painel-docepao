// A CONVERSA LEMBRA ENTRE UMA MENSAGEM E OUTRA
//
// O DEFEITO QUE ESTE TESTE EXISTE PRA NUNCA MAIS VOLTAR
//
// No WhatsApp cada mensagem e uma chamada nova. O estado nasce do banco no
// comeco e morre no fim: o que nao foi gravado nao existe mais.
//
// O fluxo novo gravava so os itens e os dados da retirada. Tudo o mais — se a
// conversa era de festa, quantas pessoas, se ele ja tinha aceitado a proposta,
// se queria topo e papel de arroz — se perdia no caminho.
//
// Na pratica isso significa:
//
//   cliente: quero comida pra festa de 20 pessoas
//   padaria: [proposta de R$ 418,80]  Pode ser / Quero ajustar
//   cliente: [toca em Pode ser]
//   padaria: ...
//
// A mensagem do botao chegava com ehFesta false, pessoas null e base null. Nao
// havia proposta nenhuma pra virar pedido: o aceite dele caia no vazio.
//
// POR QUE OS OUTROS TESTES NAO PEGAVAM
//
// Porque la a conversa inteira roda dentro de uma chamada so, com o estado vivo
// na memoria, e a memoria sempre lembra. Conversa de verdade nao e assim, e
// esta e a diferenca que custou o defeito.
//
// O QUE ESTE TESTE COBRA
//
// 1. IDA E VOLTA: o que a conversa sabe vai pro banco e volta igual.
// 2. NENHUM CAMPO ESQUECIDO: campo novo no estado tem que ser gravado, ou estar
//    na lista de excecoes aqui embaixo com o motivo escrito.
//
// Nao encosta em banco nem em OpenAI: as duas pontas sao funcoes puras.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// ---------------------------------------------------------------------------
// O que NAO precisa ser gravado, e por que
// ---------------------------------------------------------------------------
const NAO_PRECISA_GRAVAR = {
  itens: "gravado item a item por anotarItem, que e a mesma funcao do painel",
  dados: "gravado campo a campo (nome, data, hora, pagamento)",
  naoQuer: "gravado em nao_quer",
  base: "nao e memoria, e conta: sai de novo do numero de pessoas a cada mensagem",
  // Vive UM TURNO de proposito, e gravar seria o defeito.
  //
  // `aplicar` poe o que foi tirado da observacao por a casa nao fazer (o "sem
  // lactose" do brigadeiro), `responder` transforma numa frase pro cliente e
  // limpa na mesma passada. E o jeito de a funcao pura contar o que fez.
  //
  // Se sobrevivesse entre mensagens, a padaria repetiria "a gente nao tem opcao
  // sem lactose" em toda resposta seguinte, sobre uma coisa que o cliente ja
  // ouviu. Insistir no que ja foi dito e o defeito que este projeto mais teve.
  restricoesTiradas: "vive um turno so: vira frase pro cliente e e limpo na mesma passada",
  // Pelo mesmo motivo, e com o mesmo desenho.
  //
  // `repartirABase` divide o total da proposta entre os sabores que o cliente
  // escolheu. Quando a divisao deixa menos que os 20 por sabor que a casa
  // sugere, ele guarda a frase aqui, `responder` poe na frente da pergunta da
  // etapa e limpa na mesma passada.
  //
  // Gravar seria o defeito: a padaria repetiria "a casa costuma sugerir pelo
  // menos 20 de cada" em toda mensagem seguinte, sobre uma divisao que o
  // cliente ja viu e ja aceitou ao seguir a conversa.
  poucoPorSabor: "vive um turno so: e a sugestao do minimo por sabor, dita uma vez",
  // Terceiro do mesmo desenho, e pelo mesmo motivo.
  //
  // `aplicar` tira da observacao o recheio que aquele produto nao tem (o
  // "camarao" da coxinha), `responder` vira "A gente faz coxinha de frango" e
  // limpa na mesma passada. Gravar faria a padaria repetir qual e o recheio da
  // coxinha em toda mensagem seguinte.
  recheiosTrocados: "vive um turno so: vira a frase do recheio da casa e e limpo junto",
  saboresAConfirmar: "vive um turno so: vira frase pra equipe depois de insistir no sabor e e limpo na mesma passada",
  // O PEDIDO APROVADO JA TEM DONO, e o dono nao e a conversa.
  //
  // Ele mora na tabela `pedidos`, e quem manda nele e a equipe apertando o botao
  // no painel. Guardar uma copia no rascunho criaria duas verdades sobre a mesma
  // coisa, que e o defeito que mais se repetiu neste sistema. E lido do banco a
  // cada mensagem, junto do pedido em aberto.
  pedidoAprovado: "vem da tabela de pedidos a cada mensagem: copiar pro rascunho seria a segunda verdade",
  // Mesma origem e mesmo motivo: o pedido registrado e ainda na fila da equipe
  // e lido da tabela de pedidos pelo webhook, a cada mensagem.
  pedidoNaFila: "vem da tabela de pedidos a cada mensagem, igual ao pedidoAprovado",
};

const sonda = path.join(__dirname, "_sonda-memoria.mjs");
fs.writeFileSync(
  sonda,
  [
    'import { estadoDosDados, dadosQueMudaram } from "../lib/ia/fluxo/gravar.ts";',
    "",
    "const VAZIO = {",
    "  ehFesta:false, pessoas:null, base:null, baseAceita:false, itens:[], naoQuer:[],",
    "  dados:{nome:null,data:null,hora:null,pagamento:null}, pecas:null, retomarEm:null, assunto:null,",
    "};",
    "",
    "// Uma festa no meio do caminho: aceitou a proposta, escolheu topo sem papel,",
    "// e ficou devendo o bolo porque perguntou de docinho no meio.",
    "const noMeio = { ...VAZIO, ehFesta:true, pessoas:20, baseAceita:true,",
    "  pecas:{topo:true, papelDeArroz:false}, assunto:'docinho', retomarEm:'salgado' };",
    "",
    "const escrito = dadosQueMudaram(VAZIO, noMeio);",
    "const devolta = estadoDosDados(escrito);",
    "",
    "// E o contrario: quem NAO quis nenhuma peca tem que voltar como 'nao quero',",
    "// e nao como 'ninguem perguntou ainda'.",
    "const semPecas = { ...VAZIO, pecas:{topo:false, papelDeArroz:false} };",
    "const semPecasVolta = estadoDosDados(dadosQueMudaram(VAZIO, semPecas));",
    "",
    "// Conversa que nunca respondeu nada nao inventa resposta.",
    "const nadaVolta = estadoDosDados({});",
    "",
    "console.log(JSON.stringify({ escrito, devolta, semPecas: semPecasVolta, nada: nadaVolta }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-memoria.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());
const falhas = [];

// ------------------------------------------------------- 1. a ida e a volta
const esperado = {
  ehFesta: true,
  pessoas: 20,
  baseAceita: true,
  assunto: "docinho",
  retomarEm: "salgado",
};
for (const [campo, valor] of Object.entries(esperado)) {
  if (JSON.stringify(r.devolta[campo]) !== JSON.stringify(valor)) {
    falhas.push(
      "o banco esqueceu " + campo + ": foi " + JSON.stringify(valor) +
        " e voltou " + JSON.stringify(r.devolta[campo]),
    );
  }
}
if (r.devolta.pecas?.topo !== true || r.devolta.pecas?.papelDeArroz !== false) {
  falhas.push("as pecas do bolo voltaram erradas: " + JSON.stringify(r.devolta.pecas));
}

// "nao quero nenhuma" e resposta, nao ausencia de resposta: se voltar null, a
// padaria pergunta de topo e papel de arroz de novo pra quem ja disse que nao.
if (r.semPecas.pecas === null) {
  falhas.push("quem disse que nao quer topo nem papel volta como se nao tivesse respondido");
}

// Conversa nova nao pode nascer sabendo coisa nenhuma.
if (r.nada.ehFesta !== false || r.nada.pessoas !== null || r.nada.baseAceita !== false || r.nada.pecas !== null) {
  falhas.push("conversa sem nada gravado nasceu com memoria: " + JSON.stringify(r.nada));
}

// --------------------------------------------- 2. nenhum campo fica de fora
//
// Le os campos do estado direto do codigo, pra campo NOVO tambem cair aqui: foi
// exatamente assim que ehFesta e pessoas ficaram sem ser gravados.
const leCampos = (arquivo, tipo) => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", arquivo), "utf8");
  const i = fonte.indexOf(tipo);
  if (i < 0) return [];
  const bloco = fonte.slice(i, fonte.indexOf(String.fromCharCode(10) + "};", i));
  return [...bloco.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
};
const campos = [
  ...leCampos("lib/ia/fluxo/etapas.ts", "export type PedidoEmMontagem"),
  ...leCampos("lib/ia/fluxo/fluxo.ts", "export type Estado"),
];
if (campos.length < 8) falhas.push("nao consegui ler os campos do estado (li " + campos.length + ")");

const gravador = fs.readFileSync(path.join(__dirname, "..", "lib/ia/fluxo/gravar.ts"), "utf8");
for (const campo of campos) {
  if (NAO_PRECISA_GRAVAR[campo]) continue;
  if (!new RegExp("depois\\." + campo + "\\b").test(gravador)) {
    falhas.push(
      "o campo '" + campo + "' existe no estado e ninguem grava: ele se perde entre " +
        "uma mensagem e outra do cliente",
    );
  }
}

console.log("Campos do estado: " + campos.join(", "));
console.log("Gravado no banco: " + Object.keys(r.escrito).join(", "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: o que a conversa sabe sobrevive ate a proxima mensagem.");
