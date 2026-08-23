// O CLIENTE SEMPRE TEM SAIDA
//
// A varredura do caminho da festa em 23/08/2026 achou quatro becos. Beco e
// quando o cliente faz uma coisa perfeitamente normal e o codigo nao tem por
// onde sair: ele responde, nada muda, e a padaria repete a mesma pergunta pra
// sempre. Foi assim com "vcs fazem bolo?", perguntado duas vezes.
//
// OS QUATRO
//
// 1. ESCREVER "pode fechar" NAO FECHAVA O PEDIDO. So o toque no botao fechava,
//    e o botao nem sempre existe: fora da janela de 24 horas o WhatsApp nao
//    deixa mandar botao nenhum. O cliente ficava olhando o mesmo resumo.
//
// 2. "MUDAR ALGO" DEVOLVIA O MESMO RESUMO, com os mesmos dois botoes, que da no
//    mesmo que nao ter botao.
//
// 3. "NAO QUERO DOCINHO" NAO ERA OUVIDO fora da etapa da proposta. Nas etapas
//    de familia a recusa nao anotava item (nao pediu nada) nem recusava nada
//    (ninguem estava escutando), e a etapa ficava aberta pra sempre.
//
// 4. BOTOES FANTASMA: quatro ids tratados no codigo e oferecidos por etapa
//    nenhuma. Codigo que nao roda, mas que quem le acredita.
//
// Este teste e todo de leitura de codigo: nao chama banco nem OpenAI.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const ler = (a) => fs.readFileSync(path.join(raiz, a), "utf8");

const fluxo = ler("lib/ia/fluxo/fluxo.ts");
const pergunta = ler("lib/ia/fluxo/pergunta.ts");
const atender = ler("lib/ia/fluxo/atender.ts");
const leitura = ler("lib/ia/fluxo/leitura.ts");
const pensar = ler("lib/ia/fluxo/pensar-openai.ts");
const falhas = [];

// ------------------------------------------- 1. botao tratado x botao oferecido
const tratados = [...fluxo.matchAll(/^ {2}(\w+):\s*\(e\)/gm)].map((m) => m[1]);
const oferecidos = [...pergunta.matchAll(/\{\s*id:\s*"(\w+)"/g)].map((m) => m[1]);
// fecha_sim nao esta na lista do fluxo porque fechar pedido mexe em banco, e
// isso mora no atender. Continua tendo que ser tratado em algum lugar.
const tratadoNoAtender = [...atender.matchAll(/botaoId === "(\w+)"/g)].map((m) => m[1]);

for (const id of tratados) {
  if (!oferecidos.includes(id)) {
    falhas.push("o botao '" + id + "' e tratado no codigo e nenhuma etapa oferece ele: ou some, ou alguem esqueceu de oferecer");
  }
}
for (const id of oferecidos) {
  if (!tratados.includes(id) && !tratadoNoAtender.includes(id)) {
    falhas.push("o botao '" + id + "' e oferecido ao cliente e ninguem trata: quem tocar nele nao vai acontecer nada");
  }
}

// -------------------------- 2. o limpador nao pode comer campo da leitura
//
// O limpador de pensar-openai.ts e lista fechada: campo que nao esta escrito la
// e jogado fora mesmo que o modelo tenha acertado. Foi assim que "pode fechar"
// morreu no caminho. Campo novo na leitura tem que aparecer no limpador.
const bloco = leitura.slice(leitura.indexOf("export type Leitura"), leitura.indexOf(String.fromCharCode(10) + "};", leitura.indexOf("export type Leitura")));
const campos = [...bloco.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
if (campos.length < 8) falhas.push("nao consegui ler os campos da leitura (li " + campos.length + ")");
for (const campo of campos) {
  if (!new RegExp("lido\\." + campo + "\\b").test(pensar)) {
    falhas.push("o limpador joga fora '" + campo + "': o modelo pode acertar que a resposta dele morre aqui");
  }
}

// ------------------------------ 3. a recusa vale nas tres familias, igual
for (const familia of ["salgado", "docinho", "bolo"]) {
  if (!new RegExp('recusa\\("' + familia + '"\\)').test(leitura)) {
    falhas.push("a etapa do " + familia + " nao sabe ouvir 'nao quero': ela fica perguntando pra sempre");
  }
}
if (!/const recusa = \(familia/.test(leitura)) {
  falhas.push("a instrucao de recusa deixou de ser uma so: cada familia vai quebrar de um jeito diferente");
}

// ------------------------------ 4. o pedido fecha pela palavra, nao so pelo botao
if (!/confirmouEscrevendo/.test(atender)) {
  falhas.push("o pedido voltou a fechar so pelo botao; fora da janela de 24h o cliente nem recebe botao");
}
// E a palavra so vale embaixo do resumo: "pode ser" no meio dos docinhos e
// conversa, nao ordem de fechar pedido de R$ 543,00.
if (!/etapaAgora\.id === "confirmacao"/.test(fluxo)) {
  falhas.push("a confirmacao por escrito nao esta presa a etapa da confirmacao: um 'pode ser' qualquer fecharia o pedido");
}

console.log("Botoes tratados: " + tratados.concat(tratadoNoAtender).join(", "));
console.log("Botoes oferecidos: " + [...new Set(oferecidos)].join(", "));
console.log("Campos da leitura: " + campos.join(", "));
console.log("");
if (falhas.length) {
  console.log("FALHOU");
  for (const f of falhas) console.log("  - " + f);
  process.exit(1);
}
console.log("PASSOU: nenhum beco conhecido, e nenhuma camada comendo a resposta da outra.");
