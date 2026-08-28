// LEMBRAR DE UMA COR NAO APAGA A OUTRA, NOS DOIS LADOS.
//
// POR QUE ISTO EXISTE
//
// Regra do dono, 24/08/2026: "voce pode aceitar uma ou mais cor e NAO quero que
// peca o cliente qual cor de forminha usar para X docinho". As cores sao da
// festa dela, e valem pro pedido todo.
//
// Numa conversa medida contra o banco em 28/08/2026, com o pedido ja montado
// com duas cores:
//
//     cliente  >> sim, mas nao esquece da forminha rosa
//     antes    >> forminha rosa e azul
//     depois   >> forminha rosa            (o azul sumiu)
//
// Ele estava LEMBRANDO de uma cor que ja tinha escolhido, e o codigo leu como
// troca. E o mesmo defeito que ja custou o amarelo da Kemilly, por outra porta.
//
// A MESMA REGRA CAIU TRES VEZES, E POR ISSO ESTE TESTE EXISTE
//
// 1. escrevi na `montagem.ts`, que grava no banco. O pedido continuou errado,
//    porque o FECHAMENTO usa o estado da memoria.
// 2. escrevi no `aplicar` do `fluxo.ts`, que e a memoria. Continuou errado.
// 3. a causa era uma linha VINTE ACIMA do bloco que decide a cor:
//    `novo.forminha = l.forminha` cru, que sobrescrevia a cor anterior antes de
//    a comparacao acontecer. A comparacao era sempre com ela mesma.
//
// Escrever a regra nao basta enquanto sobrar uma linha mais acima decidindo a
// mesma coisa. Um teste basta.
//
// O QUE ELE COBRA
//
// A funcao `aplicar` nao e exportada, entao o teste mede pela porta que existe:
// o estado que sai de `responder`. Sem banco e sem modelo -- o `pensar` e
// injetado, que e o desenho deste fluxo desde o comeco.
//
// Roda com: node testes/a-cor-lembrada-nao-apaga-a-outra.cjs
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const sonda = path.join(__dirname, "_sonda-cor.mjs");
fs.writeFileSync(
  sonda,
  [
    "import { responder } from '../lib/ia/fluxo/fluxo.ts';",
    "",
    "const VAZIO = {",
    "  ehFesta: true, pessoas: 20, base: null, baseAceita: true, naoQuer: [], forminha: null,",
    "  dados: { nome: 'Ana', data: '05/09/2026', hora: '15:00', pagamento: 'pix' },",
    "  pecas: { topo: false, papelDeArroz: false }, topoNome: null, topoIdade: null,",
    "  escrito: null, tema: null, prato: 'aberto', ofereceu: false,",
    "  itens: [{ produto: 'brigadeiro', categoria: 'docinho', qtd: 50, obs: 'forminha rosa e azul' }],",
    "};",
    "",
    "// O modelo de mentira devolve o que a gente mandar: aqui ele le a cor da",
    "// frase, que e o que o de verdade faz.",
    "const pensarQueDevolve = (leitura) => async () => leitura;",
    "",
    "// `responder` recebe argumentos POSICIONAIS. A primeira versao deste teste",
    "// passou um objeto e morreu com 'p.itens is undefined', que e o estado",
    "// chegando vazio: erro do teste, nao do codigo.",
    "const rodar = async (estado, texto, leitura) => {",
    "  const r = await responder(estado, { texto, botaoId: null }, pensarQueDevolve(leitura));",
    "  return r.estado;",
    "};",
    "",
    "const erros = [];",
    "const cobra = (rotulo, deu, esperado) => {",
    "  if (deu !== esperado) erros.push(rotulo + ': ficou ' + JSON.stringify(deu) + ', esperado ' + JSON.stringify(esperado));",
    "};",
    "",
    "// 1. as duas cores entram",
    "let e = await rodar({ ...VAZIO, forminha: null }, '50 brigadeiro, forminha rosa e azul',",
    "  { forminha: 'rosa e azul' });",
    "cobra('as duas cores entram', e.forminha, 'rosa e azul');",
    "",
    "// 2. LEMBRAR de uma delas nao apaga a outra",
    "let f = await rodar({ ...VAZIO, forminha: 'rosa e azul' }, 'sim, mas nao esquece da forminha rosa',",
    "  { forminha: 'rosa' });",
    "cobra('lembrar da rosa mantem o azul', f.forminha, 'rosa e azul');",
    "",
    "// 3. e a cor NOVA continua trocando: quem muda de ideia manda.",
    "//",
    "// A COR DO TESTE TEM QUE SER COR DO CARDAPIO. A primeira versao usou",
    "// 'verde', que NAO esta na lista da casa (la tem 'verde bandeira' e 'verde",
    "// tiffany'), entao nenhuma cor era lida e o estado ficava como estava. O",
    "// teste reprovava por defeito dele, e o codigo estava certo.",
    "let g = await rodar({ ...VAZIO, forminha: 'rosa e azul' }, 'na verdade quero amarelo',",
    "  { forminha: 'amarelo' });",
    "cobra('cor nova troca', g.forminha, 'amarelo');",
    "",
    "// 4. a cor tem que chegar na OBSERVACAO do item, que e o que vira comanda",
    "const obs = String((f.itens ?? []).find((i) => i.categoria === 'docinho')?.obs ?? '');",
    "const naObs = /rosa/.test(obs) && /azul/.test(obs);",
    "if (!naObs) erros.push('a cor nao chegou na observacao do item: ' + JSON.stringify(obs));",
    "",
    "console.log(JSON.stringify({ erros, obs }));",
  ].join("\n"),
  "utf8",
);

let bruto;
try {
  bruto = execFileSync("npx", ["tsx", "_sonda-cor.mjs"], {
    cwd: __dirname, encoding: "utf8", timeout: 180000, shell: process.platform === "win32",
  });
} finally {
  try { fs.unlinkSync(sonda); } catch {}
}
const r = JSON.parse(bruto.trim().split("\n").pop());

console.log("Observacao do docinho depois da lembranca: " + JSON.stringify(r.obs));
console.log("");

if (r.erros.length) {
  console.log("ERRO  a cor do pedido mudou quando nao devia (" + r.erros.length + ")");
  for (const e of r.erros) console.log("        " + e);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    lembrar mantem, cor nova troca, e a cor chega na comanda");
console.log("");
console.log("PASSOU");
