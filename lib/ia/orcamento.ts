// ============================================================================
//  MOTOR DE ORÇAMENTO — a peça que a IA chama pra calcular. Código puro.
//  A IA NUNCA calcula preço, ela chama o motor (não erra soma, não alucina).
//
//  MULTI-TENANT: `criarMotor(produtos, rendimento)` monta um motor com o
//  cardápio de QUALQUER padaria. O padrão (Doce Pão) vem do catalogo.json.
// ============================================================================

import catalogo from "./dados/catalogo.json";
import rendimentoJson from "./dados/rendimento.json";

export const brl = (n: number) =>
  "R$ " +
  n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");

// Um produto do cardápio (formato genérico, serve pra qualquer negócio).
// unidade: "un" (vendido por unidade, qtd inteira) ou "kg" (por quilo, qtd = peso).
export type Produto = { nome: string; preco: number; categoria: string; unidade?: "un" | "kg" };

// Regras de rendimento (quanto por pessoa). unidadePorProduto lida com produtos
// vendidos em pacote (ex: "cento" = 100 unidades).
export type Rendimento = {
  salgadoPorPessoa?: number;
  docePorPessoa?: number;
  boloServe?: number; // 1 bolo serve N pessoas
  unidadePorProduto?: number; // 1 = por unidade; 100 = vendido por cento
  minSalgado?: number;
  confirmar?: boolean;
};

export type LinhaCotacao = { item: string; categoria: string; qtd: number; unit: number; subtotal: number; obs?: string; unidade?: "un" | "kg" };
export type Cotacao = {
  linhas: LinhaCotacao[];
  avisos: string[];
  notas?: string[];
  estimativa?: boolean;
  pessoas?: number;
  total: number;
};

export type Motor = {
  cotarPorItens(pedido: { item: string; qtd: number; obs?: string }[]): Cotacao;
  sugerirPorPessoas(pessoas: number, quer: { salgado?: boolean; doce?: boolean; bolo?: boolean }): Cotacao;
  cardapioResumo(): string;
};

// Fábrica: monta um motor a partir de uma lista de produtos + rendimento.
export function criarMotor(produtos: Produto[], rend: Rendimento = {}): Motor {
  const PRECOS: Record<string, Produto> = {};
  for (const p of produtos) PRECOS[p.nome.trim().toLowerCase()] = p;

  // acha o 1º produto de uma categoria (pro "por pessoas")
  const primeiroDaCategoria = (cat: string) =>
    produtos.find((p) => p.categoria.toLowerCase().startsWith(cat));

  const unidade = rend.unidadePorProduto && rend.unidadePorProduto > 0 ? rend.unidadePorProduto : 1;

  const norm = (s: string) => String(s).trim().toLowerCase();

  // Sinais de que a linha é o BOLO da festa, e não um docinho de mesmo nome.
  // Sem isto, "brigadeiro" com a observação do bolo casa com o docinho de
  // R$ 1,25: o bolo de 2 kg vira R$ 2,50 e a cozinha recebe um pedido sem bolo.
  // Aconteceu num teste real, com o pedido já fechado e o cliente avisado.
  const MARCA_DE_BOLO = /p[ãa]o de l[óo]|topo d|papel de arroz|aniversariante|prato aberto|caixa com tampa|andar/i;

  // Os sabores de bolo recheado, do mais caro pro mais barato, pra saber qual
  // vale quando o cliente pede dois no mesmo bolo.
  // O cliente fala "com nozes", não "strogonoff de nozes", então a última
  // palavra do sabor também vale como apelido. Casar duas vezes o mesmo sabor
  // não faz mal: o preço só muda quando o outro é mais caro de verdade.
  const SABORES_BOLO = produtos
    .filter((p) => p.categoria === "bolo_recheado" && norm(p.nome).startsWith("bolo ") && !norm(p.nome).startsWith("bolo recheado "))
    .flatMap((p) => {
      const sabor = norm(p.nome).slice(5);
      const ultima = (sabor.split(" ").pop() || "").replace(/[^a-zà-ú0-9]/g, "");
      const lista = [{ sabor, produto: p }];
      if (ultima.length > 3 && ultima !== sabor) lista.push({ sabor: ultima, produto: p });
      return lista;
    })
    .filter((x) => x.sabor.length > 3)
    .sort((a, b) => b.produto.preco - a.produto.preco);

  // "brigadeiro com morango": vale o morango. Sem isso o bolo misto saía pelo
  // preço do primeiro sabor que casasse, quase sempre o mais barato.
  function saborMaisCaro(texto: string): Produto | undefined {
    const t = norm(texto);
    const achados = SABORES_BOLO.filter((x) => t.includes(x.sabor));
    if (achados.length < 2) return undefined;
    return achados[0].produto; // já vem ordenado do mais caro
  }

  function cotarPorItens(pedido: { item: string; qtd: number; obs?: string }[]): Cotacao {
    const linhas: LinhaCotacao[] = [];
    const avisos: string[] = [];
    let total = 0;
    for (const { item, qtd, obs } of pedido) {
      // "bolo de brigadeiro" precisa virar "bolo brigadeiro" antes de qualquer
      // busca. Sem isso o "de" atrapalha o casamento e sobra só "brigadeiro",
      // que existe como docinho de R$ 1,25: o bolo de 2 kg virava R$ 2,50.
      const chave = norm(item)
        .replace(/^bolo (de |do |da )/, "bolo ")
        .replace(/^torta (de |do |da )/, "torta ")
        .replace(/ recheado$| de festa$| de anivers[áa]rio$/, "");
      // Bolo disfarçado de docinho: tenta o mesmo sabor na família dos bolos.
      if (obs && MARCA_DE_BOLO.test(obs) && !chave.startsWith("bolo")) {
        const comoBolo =
          PRECOS[norm("bolo " + item)] ??
          produtos.find((p) => p.categoria === "bolo" && norm(p.nome).includes(chave));
        if (comoBolo) {
          const q0 = Number(qtd) || 0;
          const sub0 = comoBolo.preco * q0;
          total += sub0;
          linhas.push({
            item: comoBolo.nome, categoria: comoBolo.categoria, qtd: q0, unit: comoBolo.preco,
            subtotal: sub0, obs: obs || undefined, unidade: comoBolo.unidade ?? "kg",
          });
          avisos.push(`"${item}" foi cotado como ${comoBolo.nome} (a observação é de bolo de festa).`);
          continue;
        }
      }
      // 1) match exato; 2) nome parcial (ex: "coxinha" acha "Cento de coxinha")
      let ref: Produto | undefined = PRECOS[chave];
      if (!ref) {
        ref = produtos.find((p) => {
          const pn = norm(p.nome);
          if (pn.includes(chave) || chave.includes(pn)) return true;
          const ultima = pn.split(" ").pop() || "";
          return ultima.length > 3 && chave.includes(ultima);
        });
      }
      if (!ref) {
        avisos.push(`Não achei "${item}" no cardápio, conferir com a equipe.`);
        continue;
      }
      // Dois sabores no mesmo bolo: vale o mais caro. É a regra da casa, está
      // escrita na própria peça do cardápio, e o motor não aplicava: brigadeiro
      // com morango saía a R$ 46,90 o quilo em vez de R$ 49,90.
      if (ref.categoria === "bolo_recheado") {
        const caro = saborMaisCaro(chave + " " + (obs ?? ""));
        if (caro && caro.preco > ref.preco) {
          const outro = caro.nome.replace(/^bolo /, "");
          avisos.push(`Bolo com mais de um sabor: cobrei pelo mais caro (${outro}).`);
          // O nome guarda os DOIS sabores: quem lê na cozinha precisa saber que
          // o bolo é misto, e quem lê o orçamento precisa entender o preço.
          const nome = chave.includes(outro) ? ref.nome : `${ref.nome} com ${outro}`;
          ref = { ...caro, nome };
        }
      }
      const q = Number(qtd) || 0;
      const subtotal = ref.preco * q;
      total += subtotal;
      linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: q, unit: ref.preco, subtotal, obs: obs || undefined, unidade: ref.unidade ?? "un" });
    }

    // Papel de arroz citado só na observação do bolo é papel de arroz não
    // cobrado: são R$ 12 que somem do pedido e reaparecem como prejuízo na
    // produção. Se a observação pede e ele não está entre os itens, entra.
    const citaPapel = linhas.some((l) => /papel de arroz/i.test(l.obs ?? ""));
    const temPapel = linhas.some((l) => /papel de arroz/i.test(l.item));
    if (citaPapel && !temPapel) {
      const ref = PRECOS[norm("papel de arroz")] ?? produtos.find((p) => norm(p.nome).includes("papel de arroz"));
      if (ref) {
        total += ref.preco;
        linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: 1, unit: ref.preco, subtotal: ref.preco, unidade: "un" });
        avisos.push("Papel de arroz estava só na observação; lancei como item pra entrar no total.");
      }
    }
    return { linhas, avisos, total };
  }

  function sugerirPorPessoas(
    pessoas: number,
    quer: { salgado?: boolean; doce?: boolean; bolo?: boolean } = { salgado: true, doce: true },
  ): Cotacao {
    const n = Number(pessoas) || 0;
    const pedido: { item: string; qtd: number }[] = [];
    const notas: string[] = [];
    let estimativa = false;

    if (quer.salgado && rend.salgadoPorPessoa) {
      const prod = primeiroDaCategoria("salgado");
      if (prod) {
        let unidades = Math.round(n * rend.salgadoPorPessoa);
        if (rend.minSalgado && unidades < rend.minSalgado) {
          unidades = rend.minSalgado;
          notas.push(`Salgado ajustado pro mínimo de ${rend.minSalgado}.`);
        }
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.doce && rend.docePorPessoa) {
      const prod = primeiroDaCategoria("doce");
      if (prod) {
        const unidades = Math.round(n * rend.docePorPessoa);
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.bolo && rend.boloServe) {
      const prod = primeiroDaCategoria("bolo");
      if (prod) {
        // Bolo por quilo: qtd = PESO (kg), 1 casa decimal. Por unidade: nº de bolos.
        const qtd =
          prod.unidade === "kg"
            ? Math.max(0.5, Math.round((n / rend.boloServe) * 10) / 10)
            : Math.max(1, Math.ceil(n / rend.boloServe));
        pedido.push({ item: prod.nome, qtd });
        estimativa = true;
      }
    }

    const cotacao = cotarPorItens(pedido);
    return { pessoas: n, estimativa, notas, ...cotacao };
  }

  function cardapioResumo(): string {
    // agrupa por categoria pro prompt
    const porCat: Record<string, string[]> = {};
    for (const p of produtos) {
      (porCat[p.categoria] ||= []).push(`${p.nome} ${brl(p.preco)}`);
    }
    return Object.entries(porCat)
      .map(([cat, itens]) => `${cat}: ${itens.join(", ")}`)
      .join("\n");
  }

  return { cotarPorItens, sugerirPorPessoas, cardapioResumo };
}

// Texto do orçamento pronto pro WhatsApp.
export function formatarOrcamento(c: Cotacao, titulo = "Orçamento"): string {
  const L: string[] = [];
  L.push(titulo);
  L.push("".padEnd(28, "."));
  for (const l of c.linhas) {
    const q = (l.unidade ?? "un") === "kg" ? `${String(l.qtd).replace(".", ",")} kg` : `${l.qtd}x`;
    L.push(`${q} ${l.item}: ${brl(l.subtotal)}`);
  }
  L.push("".padEnd(28, "."));
  L.push(`*Total: ${brl(c.total)}*`);
  // Nao existe "paga na retirada" combinado: e o cliente que escolhe pix,
  // cartao ou dinheiro. Esta linha vinha colada em TODO orcamento e a IA a
  // repetia como se fosse condicao acertada, do mesmo jeito que ela ja tinha
  // inventado "pix" no resumo do pedido.
  if (c.estimativa) L.push("\nEssa quantidade é uma sugestão pro tamanho da festa. Se quiser mais ou menos de algo, é só falar.");
  if (c.avisos?.length) L.push("\n" + c.avisos.join("\n"));
  return L.join("\n");
}

// ---------------------------------------------------------------------------
//  MOTOR PADRÃO (Doce Pão) — do catalogo.json. Usado quando o negócio não tem
//  cardápio próprio no banco (fallback).
// ---------------------------------------------------------------------------
function produtosDoCatalogo(): Produto[] {
  const p: Produto[] = [];
  // Genéricos primeiro: o "por pessoas" sugere salgado sem discriminar o tipo.
  p.push({ nome: "salgado frito", preco: catalogo.salgados.frito.preco, categoria: "salgado" });
  p.push({ nome: "salgado assado", preco: catalogo.salgados.assado.preco, categoria: "salgado" });
  // Cada tipo pelo nome, pra precificar pedido discriminado (ex: "100 coxinha").
  // Frito e assado têm preço de linha (o sabor não muda o valor).
  for (const it of catalogo.salgados.frito.itens)
    p.push({ nome: it.nome, preco: catalogo.salgados.frito.preco, categoria: "salgado" });
  for (const it of catalogo.salgados.assado.itens)
    p.push({ nome: it.nome, preco: catalogo.salgados.assado.preco, categoria: "salgado" });
  for (const d of catalogo.doces.itens) p.push({ nome: d.nome, preco: d.preco, categoria: "doce" });
  // Bolos recheados são vendidos POR QUILO (unidade kg): qtd = peso em kg.
  for (const f of catalogo.bolos_recheados.faixas) {
    p.push({ nome: "bolo recheado " + f.faixa.toLowerCase(), preco: f.preco, categoria: "bolo_recheado", unidade: "kg" });
    for (const s of f.sabores) p.push({ nome: "bolo " + s, preco: f.preco, categoria: "bolo_recheado", unidade: "kg" });
  }
  for (const b of catalogo.bolos_caseiros.itens)
    p.push({ nome: "bolo caseiro " + b.nome, preco: b.preco, categoria: "bolo_caseiro" });
  p.push({ nome: "pizza inteira", preco: catalogo.pizza.inteira.preco, categoria: "pizza" });
  p.push({ nome: "pizza meia", preco: catalogo.pizza.meia.preco, categoria: "pizza" });
  // Produtos novos (tortas, empadão, bolo salgado, cupcake, franciscano, pão francês),
  // cada um com sua unidade (kg pros por quilo, un pros por unidade).
  for (const o of catalogo.outros_produtos) {
    p.push({ nome: o.nome, preco: o.preco, categoria: o.categoria, unidade: o.unidade as "un" | "kg" });
  }
  return p;
}

const rendimentoPadrao: Rendimento = {
  salgadoPorPessoa: rendimentoJson.salgado_por_pessoa?.valor,
  docePorPessoa: rendimentoJson.doce_por_pessoa?.valor,
  boloServe: rendimentoJson.bolo_recheado_serve?.valor,
  unidadePorProduto: 1,
  minSalgado: rendimentoJson.regras_encomenda?.quantidade_minima_salgado?.valor,
  confirmar: true,
};

export const motorPadrao = criarMotor(produtosDoCatalogo(), rendimentoPadrao);

// Compat: exports antigos (Doce Pão). Novo código usa criarMotor por tenant.
export const cotarPorItens = motorPadrao.cotarPorItens;
export const sugerirPorPessoas = motorPadrao.sugerirPorPessoas;
export const cardapioResumo = motorPadrao.cardapioResumo;
