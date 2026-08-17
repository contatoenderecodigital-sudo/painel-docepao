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
  for (const o of (catalogo.outros_produtos ?? []) as ItemCat[]) {
    const cat = /papel de arroz/i.test(o.nome)
      ? "papel_de_arroz"
      : /cupcake/i.test(o.nome)
        ? "cupcake"
        : o.unidade === "kg"
          ? "por_quilo"
          : "por_unidade";
    por(o.nome, cat, o.sabores ?? [], o.unidade === "kg" ? "kg" : "un");
  }
  por("pizza inteira", "pizza");
  por("pizza meia", "pizza");
  return lista;
}

const OPCOES = montar();

export async function GET() {
  return Response.json({ produtos: OPCOES });
}
