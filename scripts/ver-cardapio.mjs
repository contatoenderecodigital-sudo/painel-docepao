// ============================================================================
//  O CARDAPIO INTEIRO, DO JEITO QUE O SISTEMA ENXERGA.
//
//  Pedido dele em 02/09/2026: *"me fala tudo que tem no cardapio da loja
//  separado por familias, precos, se e kg g ou unid, sabores e etc, quero ver
//  tudo como ta isso no padrao"*.
//
//  ELE LE PELO MESMO CAMINHO QUE A IA, e nao pelo JSON cru: `produtosDaCasa()`.
//  Se este relatorio mostra uma coisa e a padaria faz outra, o defeito esta no
//  leitor, e nao no relatorio, que e exatamente o que se quer de uma conferida.
//
//  Roda com:  node scripts/ver-cardapio.mjs
//             node scripts/ver-cardapio.mjs --md > CARDAPIO.md
// ============================================================================

import { produtosDaCasa } from "../lib/ia/dados/produtos.ts";
import { familiaDaCategoria, categoriasDaFamilia } from "../lib/ia/fluxo/generico.ts";

const md = process.argv.includes("--md");
const brl = (r) => "R$ " + Number(r).toFixed(2).replace(".", ",");

const porCategoria = new Map();
for (const p of produtosDaCasa()) {
  const c = String(p.categoria || "(sem categoria)");
  if (!porCategoria.has(c)) porCategoria.set(c, []);
  porCategoria.get(c).push(p);
}

// AGRUPADO PELA FAMILIA QUE O SISTEMA CONHECE, e nao por uma ordem minha: e
// assim que da pra ver quem ficou orfao.
const porFamilia = new Map();
for (const [cat, itens] of porCategoria) {
  const fam = familiaDaCategoria(cat) ?? "(SEM FAMILIA)";
  if (!porFamilia.has(fam)) porFamilia.set(fam, []);
  porFamilia.get(fam).push([cat, itens]);
}

const linha = (s) => console.log(s);
const titulo = (s) => linha(md ? "\n## " + s + "\n" : "\n=== " + s + " ===");

linha(md ? "# Cardapio da Doce Pao, como o sistema enxerga\n" : "CARDAPIO DA DOCE PAO, COMO O SISTEMA ENXERGA");
linha(
  (md ? "" : "") +
    produtosDaCasa().length + " produtos, " + porCategoria.size + " categorias, " +
    [...porFamilia.keys()].filter((f) => f !== "(SEM FAMILIA)").length + " familias reconhecidas.",
);

for (const [fam, grupos] of [...porFamilia].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
  const cats = fam === "(SEM FAMILIA)" ? [] : categoriasDaFamilia(fam);
  titulo(
    "FAMILIA: " + fam +
      (cats.length ? "   (categorias: " + cats.join(", ") + ")" : "   <- o cliente nao consegue pedir pelo nome do grupo"),
  );
  for (const [cat, itens] of grupos) {
    linha(md ? "\n**categoria `" + cat + "`**\n" : "\n  categoria " + cat);
    if (md) {
      linha("| produto | preco | unidade | sabores |");
      linha("| --- | --- | --- | --- |");
    }
    for (const p of itens.sort((a, b) => a.nome.localeCompare(b.nome))) {
      const preco = p.preco ? brl(p.preco) : "(sem preco)";
      const sab = p.saborFixo
        ? "fixo: " + (p.sabores?.[0] ?? "-")
        : p.sabores?.length
          ? p.sabores.length + ": " + p.sabores.slice(0, 6).join(", ") + (p.sabores.length > 6 ? "..." : "")
          : "nao pergunta";
      if (md) {
        linha("| " + p.nome + " | " + preco + " | " + p.unidade + " | " + sab + " |");
      } else {
        linha(
          "    " + p.nome.padEnd(34) + preco.padStart(11) + "  por " + String(p.unidade).padEnd(3) + "  " + sab,
        );
      }
    }
  }
}
