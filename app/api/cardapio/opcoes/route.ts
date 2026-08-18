// O cardápio em forma de lista, pro painel oferecer produto e sabor prontos em
// vez de deixar a equipe digitar na mão. Digitar na mão erra o nome (e nome
// errado não casa com a tabela de preço) e esquece o sabor.
import catalogo from "@/lib/ia/dados/catalogo.json";

export const dynamic = "force-static";

type Opcao = { nome: string; categoria: string; unidade: "un" | "kg"; sabores: string[] };

type ItemCat = { nome: string; recheios?: string[]; sabores?: string[]; unidade?: string; categoria?: string };

function montar(): Opcao[] {
  const lista: Opcao[] = [];
  const por = (nome: string, categoria: string, sabores: string[] = [], unidade: "un" | "kg" = "un") =>
    lista.push({ nome, categoria, unidade, sabores });

  for (const it of (catalogo.salgados.frito.itens ?? []) as ItemCat[]) {
    por(it.nome, "salgado_frito", it.recheios ?? []);
  }
  for (const it of (catalogo.salgados.assado.itens ?? []) as ItemCat[]) {
    por(it.nome, "salgado_assado", it.recheios ?? []);
  }
  for (const d of (catalogo.doces.itens ?? []) as ItemCat[]) {
    por(d.nome, "docinho", d.sabores ?? []);
  }
  // Bolo de festa é por quilo, e o sabor faz parte do nome do produto.
  for (const f of catalogo.bolos_recheados.faixas ?? []) {
    for (const s of f.sabores ?? []) por("bolo " + s, "bolo_festa", [], "kg");
  }
  for (const b of (catalogo.bolos_caseiros.itens ?? []) as ItemCat[]) {
    por("bolo caseiro " + b.nome, "bolo_caseiro");
  }
  // Sabor que o cardapio escreveu num item da familia vale pros irmaos: o
  // cupcake grande tem os mesmos sabores do pequeno, e a lista so estava num.
  const doIrmao = (nome: string, ops?: string[]) => {
    if (ops && ops.length) return ops;
    // Calzone e pizza redonda levam os sabores da pizza: e a mesma massa e o
    // mesmo recheio, so muda o formato. O cardapio diz isso em texto.
    if (/calzone|pizza redonda/i.test(nome)) {
      return [
        ...((catalogo.pizza?.sabores_salgados ?? []) as string[]),
        ...((catalogo.pizza?.sabores_doces ?? []) as string[]),
      ];
    }
    if (/^cupcake/i.test(nome)) {
      const base = ((catalogo.outros_produtos ?? []) as ItemCat[]).find((x) =>
        /^cupcake pequeno$/i.test(x.nome),
      );
      return base?.sabores ?? [];
    }
    return [];
  };
  for (const o of (catalogo.outros_produtos ?? []) as ItemCat[]) {
    const cat = /papel de arroz/i.test(o.nome)
      ? "papel_de_arroz"
      : /cupcake/i.test(o.nome)
        ? "cupcake"
        : o.unidade === "kg"
          ? "por_quilo"
          : "por_unidade";
    por(o.nome, cat, doIrmao(o.nome, o.sabores), o.unidade === "kg" ? "kg" : "un");
  }
  // A pizza tem os sabores numa estrutura propria do cardapio. Sem eles a
  // equipe digitava o sabor na mao no campo de observacao.
  const saboresPizza = [
    ...((catalogo.pizza?.sabores_salgados ?? []) as string[]),
    ...((catalogo.pizza?.sabores_doces ?? []) as string[]),
  ];
  por("pizza inteira", "pizza", saboresPizza);
  por("pizza meia", "pizza", saboresPizza);
  return lista;
}

const OPCOES = montar();

export async function GET() {
  return Response.json({ produtos: OPCOES });
}
