// O QUE O CATALOGO SABE NAO SE COPIA PRO CODIGO.
//
// POR QUE ISTO EXISTE
//
// Regra do dono, 27/08/2026, depois de me cobrar tres vezes no mesmo dia:
//
//   "nao da pra ser so uma lista tua, nada pode ser so uma lista tua assim, so
//    o cardapio e valores, o que e fixo mesmo"
//
// Ele estava certo e eu nao tinha varrido. Varrendo, achei tres copias vivas:
//
//   1. as 21 CORES da forminha, reescritas a mao numa regex em montagem.ts. O
//      dia em que a dona cadastrasse uma cor nova na tela, a copia nao saberia;
//   2. os NOMES DE FAMILIA em TRES arquivos, e eles ja discordavam: "pizza" era
//      familia em generico.ts e nao era em etapas.ts nem em montagem.ts;
//   3. o vocabulario da etapa sem os apelidos, que jogava 32 grafias fora do
//      pedido (medido no mesmo dia).
//
// Copia de catalogo nao da erro no dia em que e escrita. Ela envelhece calada e
// so aparece meses depois, quando alguem mexe no cardapio e metade do sistema
// nao fica sabendo.
//
// COMO ESTE TESTE DECIDE
//
// Ele varre o codigo atras de LISTA LITERAL (array de strings ou alternativa de
// regex) que junte tres ou mais nomes que o catalogo ja tem. Tres, e nao um:
// citar um produto num comentario ou num caso especifico e normal; juntar tres
// e reconstruir o cardapio na unha.
//
// O QUE NAO CONTA
//
//   - comentario, que e onde a explicacao mora;
//   - `dados/`, que E o catalogo e a lista unica;
//   - `apelidos.ts`, que e dado da casa: sinonimo de verdade ("chique" pra
//     quiche) nao sai por semelhanca, tem que estar escrito;
//   - `departamentos.ts`, cuja lista de nomes e a REDE EMBAIXO, pro nome que o
//     cardapio nao conhece ("quibe", "esfiha", "vela numero 5"). Desde
//     30/08/2026 quem responde primeiro lá e a categoria do catalogo, e quem
//     cobra isso, nos 86 produtos, e o
//     `a-comanda-sai-da-categoria-do-catalogo.cjs`.
//
// A VARREDURA PEGA `lib/`, `app/` E `components/`.
//
// Era so `lib/`, e foi por isso que a copia mais cara sobreviveu a este proprio
// teste: as 21 CORES da forminha, as mesmas que a abertura aqui em cima diz que
// sairam do `montagem.ts`, estavam reescritas a mao em
// `components/PedidoMontado.tsx`. Achadas em 30/08/2026, varrendo a tela.
//
// Roda com: node testes/nao-copiar-o-catalogo-pro-codigo.cjs
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const catalogo = require(path.join(RAIZ, "lib/ia/dados/catalogo.json"));

const semAc = (t) =>
  String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// TODO NOME QUE O CATALOGO CONHECE: produtos, sabores e cores.
const doCatalogo = new Set();
const anda = (o) => {
  if (Array.isArray(o)) return o.forEach(anda);
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (k === "nome" && typeof v === "string") doCatalogo.add(semAc(v));
      if ((k === "sabores" || k === "recheios" || k === "cores") && Array.isArray(v)) {
        for (const x of v) if (typeof x === "string") doCatalogo.add(semAc(x));
      }
      anda(v);
    }
  }
};
anda(catalogo);
// Nome de uma letra ou duas nao identifica nada e daria ruido.
for (const n of [...doCatalogo]) if (n.length < 4) doCatalogo.delete(n);

const FORA = [
  path.join("lib", "ia", "dados"),
  path.join("lib", "departamentos.ts"),
  // Dado de DEMONSTRACAO: o painel roda sem banco configurado com pedidos
  // falsos. Ele copia nome e preco de proposito, pra tela ter o que mostrar, e
  // nada dali chega em cliente nenhum.
  path.join("lib", "mock.ts"),
];

const arquivos = [];
const varrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(e.name)) varrer(p);
      continue;
    }
    if (!/\.tsx?$/.test(e.name)) continue;
    if (FORA.some((f) => p.includes(f))) continue;
    arquivos.push(p);
  }
};
varrer(path.join(RAIZ, "lib"));
varrer(path.join(RAIZ, "app"));
varrer(path.join(RAIZ, "components"));

// Fora os comentarios: a explicacao pode e deve citar o cardapio.
const semComentario = (texto) =>
  texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\r/g, "").replace(/\/\/.*$/, ""))
    .join("\n");

const copias = [];
for (const arq of arquivos) {
  const codigo = semComentario(fs.readFileSync(arq, "utf8"));
  // As listas literais: array de strings, e alternativa de regex.
  const listas = [
    ...codigo.matchAll(/\[[^\[\]]{10,400}\]/g),
    ...codigo.matchAll(/\/[^\/\n]{10,400}\//g),
  ];
  for (const m of listas) {
    const trecho = semAc(m[0]);
    const achados = [...doCatalogo].filter((n) => {
      const i = trecho.indexOf(n);
      if (i < 0) return false;
      // Palavra inteira: "bolo" dentro de "bolo_festa" nao conta como o produto.
      const antes = trecho[i - 1] ?? " ";
      const depois = trecho[i + n.length] ?? " ";
      return !/[a-z_]/.test(antes) && !/[a-z_]/.test(depois);
    });
    if (achados.length >= 3) {
      copias.push({
        arquivo: path.relative(RAIZ, arq).replace(/\\/g, "/"),
        quantos: achados.length,
        nomes: achados.slice(0, 6).join(", "),
        trecho: m[0].replace(/\s+/g, " ").slice(0, 90),
      });
    }
  }
}

console.log("Nomes que o catalogo conhece: " + doCatalogo.size);
console.log("Arquivos varridos: " + arquivos.length);
console.log("");

if (!doCatalogo.size || !arquivos.length) {
  // Detector que nao detecta nada e o pior resultado: passa verde e esconde a
  // quebra da propria varredura.
  console.log("ERRO  a varredura nao leu nada: o catalogo mudou ou o caminho quebrou");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

if (copias.length) {
  console.log("ERRO  o catalogo foi copiado pro codigo (" + copias.length + ")");
  for (const c of copias) {
    console.log("        " + c.arquivo + "  (" + c.quantos + " nomes: " + c.nomes + ")");
    console.log("            " + c.trecho);
  }
  console.log("");
  console.log("        Leia do catalogo, ou da lista unica em lib/ia/dados/produtos.ts.");
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    nenhuma lista do codigo reconstroi o cardapio");
console.log("");
console.log("PASSOU");
