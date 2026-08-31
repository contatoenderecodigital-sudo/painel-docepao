// ============================================================================
//  AS PEÇAS DO CARDÁPIO, GERADAS DO CATÁLOGO.
//
//  Estas são as imagens que a Dora manda pro cliente no WhatsApp. Elas eram
//  feitas à mão, e por isso saíam do ar do catálogo sem ninguém perceber:
//
//   - a de Cucas e Pães não trazia pão francês, pão de X nem cachorro-quente,
//     que a dona tinha dado em áudio;
//   - a de Pizza tinha 20 sabores e o cardápio dela tem 21 (faltava "bacon com
//     brócolis", o mesmo que eu havia tirado do sistema por engano);
//   - o pão doce aparecia como "a unidade" depois de virar por quilo.
//
//  Toda vez foi a mesma doença: o mesmo fato em dois lugares e um deles ficando
//  pra trás. Agora as oito nascem do catalogo.json.
//
//  Uso:
//    node scripts/gerar-cardapio.mjs      gera os HTML em .cardapios/
//
//  Pra virar imagem (1 minuto cada):
//    1. Abra o HTML no Chrome
//    2. F12, botão de dispositivo, o tamanho que o script imprimir
//    3. Ctrl+Shift+P, "screenshot", "Capture full size screenshot"
//    4. Salve como public/cardapios/<nome>.jpg
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import catalogo from "../lib/ia/dados/catalogo.json" with { type: "json" };

const SAIDA = ".cardapios";
mkdirSync(SAIDA, { recursive: true });

const brl = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");
const porUnidade = (u) => (u === "kg" ? "o quilo" : "a unidade");
// O catalogo guarda o nome sem acento em alguns casos, porque o motor de preco
// compara sem acento. Na peca que vai pro cliente, escreve certo.
const COMO_ESCREVE = { empadao: "empadão", "empadao com palmito": "empadão com palmito", "pao doce": "pão doce", "pao frances": "pão francês", "pao de x": "pão de X", "pao de batata": "pão de batata", "pao de queijo": "pão de queijo", "mini pao de queijo": "mini pão de queijo", "mini sanduiche de pate de frango": "mini sanduíche de patê de frango" };
const maiuscula = (t) => {
  const certo = COMO_ESCREVE[String(t).toLowerCase()] ?? String(t);
  return certo.charAt(0).toUpperCase() + certo.slice(1);
};
const lista = (a) => a.join(" · ");

function acha(nome) {
  const p = catalogo.outros_produtos.find((x) => x.nome === nome);
  if (!p) throw new Error("produto nao existe no catalogo: " + nome);
  return p;
}

// O estilo é o mesmo das peças que já estavam no ar: fundo vinho, selo dourado,
// título grande e cartões translúcidos. Mexer aqui muda todas de uma vez.
function estilo(altura) {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  /* O navegador que gera a imagem roda com densidade 0,25: sem o zoom a
     captura sai a um quarto do tamanho. */
  html { zoom: 4; }
  body {
    /* MIN-HEIGHT, E NAO HEIGHT.
       Com altura fixa, peca cujo conteudo passa do numero escrito aqui
       TRANSBORDA: em 30/08/2026 o rodape dos "Pães" saiu por fora da moldura e
       a nota encavalou na borda. A altura vira piso, nao teto, e a captura ja
       mede a peca renderizada em vez de acreditar no numero. */
    width:1080px; min-height:${altura}px;
    font-family:"Poppins","Segoe UI",Arial,sans-serif;
    background:radial-gradient(120% 70% at 50% 0%, #8f1b30 0%, #6d1424 45%, #4d0e1a 100%);
    color:#fff; position:relative;
  }
  .moldura { position:absolute; inset:22px; border:1px solid rgba(231,207,148,.35); border-radius:10px; }
  .folha { width:1080px; min-height:${altura}px; padding:38px 58px; display:flex; flex-direction:column; }
  .topo { text-align:center; }
  .selo { width:84px; height:84px; flex:0 0 84px; margin:0 auto 14px; border-radius:50%;
    background:linear-gradient(150deg,#f0d493,#c99a35); display:flex; align-items:center; justify-content:center;
    box-shadow:0 10px 30px rgba(0,0,0,.28); }
  .etiqueta { font-size:17px; letter-spacing:7px; color:#e7cf94; font-weight:600; }
  h1 { font-size:66px; font-weight:700; line-height:1; margin:10px 0 8px; letter-spacing:-1px; }
  .sub { font-size:25px; opacity:.9; }
  .divisor { display:flex; align-items:center; justify-content:center; gap:16px; margin:18px 0 22px; }
  .divisor span { width:120px; height:1px; background:linear-gradient(90deg,transparent,#e7cf94); }
  .divisor span:last-child { background:linear-gradient(90deg,#e7cf94,transparent); }
  .secao { font-size:32px; font-weight:600; display:flex; align-items:center; gap:18px; margin:20px 0 12px; }
  .secao i { flex:1; height:1px; background:rgba(231,207,148,.3); }
  .lista { display:flex; flex-direction:column; gap:9px; }
  .item { display:flex; align-items:center; justify-content:space-between; gap:26px;
    background:rgba(255,255,255,.055); border:1px solid rgba(231,207,148,.18);
    border-radius:14px; padding:12px 26px; }
  .nome { font-size:29px; font-weight:600; }
  .detalhe { font-size:19px; opacity:.82; margin-top:4px; line-height:1.3; }
  .dir { text-align:right; flex-shrink:0; }
  .preco { font-size:33px; font-weight:700; color:#f0d493; white-space:nowrap; }
  .unidade { font-size:19px; opacity:.8; margin-top:2px; }
  .precos { display:flex; gap:18px; justify-content:center; }
  .preco-card { flex:1; text-align:center; background:rgba(255,255,255,.055);
    border:1px solid rgba(231,207,148,.22); border-radius:16px; padding:18px 14px; }
  .preco-nome { font-size:28px; font-weight:600; }
  .preco-valor { font-size:46px; font-weight:700; color:#f0d493; margin:4px 0 6px; }
  .preco-nota { font-size:18px; opacity:.82; }
  .pastilhas { display:flex; flex-wrap:wrap; gap:10px; }
  .pastilha { font-size:21px; padding:10px 18px; border-radius:999px;
    background:rgba(255,255,255,.05); border:1px solid rgba(231,207,148,.2); }
  .nota { font-size:19px; font-style:italic; opacity:.85; text-align:center; margin-top:16px; }
  .rodape { margin-top:auto; padding-top:16px; border-top:1px solid rgba(231,207,148,.22); text-align:center; }
  .rodape .zap { font-size:25px; }
  .rodape .zap b { color:#f0d493; }
  .rodape .arroba { font-size:32px; font-weight:700; margin-top:8px; }
  .rodape .cidade { font-size:17px; letter-spacing:5px; opacity:.8; margin-top:8px; }`;
}

const SELO = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#8a5a12" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 3c-1.6 1.7-1.6 3.6 0 5.3 1.6-1.7 1.6-3.6 0-5.3Z"/><path d="M12 21V9"/>
        <path d="M12 12c-2 0-3.4-1-4-2.6 2 0 3.4 1 4 2.6Z"/><path d="M12 12c2 0 3.4-1 4-2.6-2 0-3.4 1-4 2.6Z"/>
        <path d="M12 16c-2 0-3.4-1-4-2.6 2 0 3.4 1 4 2.6Z"/><path d="M12 16c2 0 3.4-1 4-2.6-2 0-3.4 1-4 2.6Z"/>
      </svg>`;

// Uma peça. Os blocos podem ser cartões de preço em destaque, seções de itens
// com preço, ou seções de pastilhas de sabor: é o que as oito precisam.
function peca({ arquivo, altura, etiqueta, titulo, subtitulo, blocos, nota }) {
  const corpo = blocos
    .map((b) => {
      if (b.tipo === "precos") {
        return `<div class="precos">${b.cartoes
          .map(
            (c) => `<div class="preco-card">
          <div class="preco-nome">${c.nome}</div>
          <div class="preco-valor">${c.valor}</div>
          <div class="preco-nota">${c.nota}</div>
        </div>`,
          )
          .join("")}</div>`;
      }
      const cabeca = b.titulo ? `<div class="secao"><span>${b.titulo}</span><i></i></div>` : "";
      if (b.tipo === "pastilhas") {
        return cabeca + `<div class="pastilhas">${b.itens.map((x) => `<span class="pastilha">${x}</span>`).join("")}</div>`;
      }
      return (
        cabeca +
        `<div class="lista">${b.itens
          .map(
            (i) => `<div class="item">
          <div>
            <div class="nome">${i.nome}</div>
            ${i.detalhe ? `<div class="detalhe">${i.detalhe}</div>` : ""}
          </div>
          <div class="dir">
            <div class="preco">${i.preco}</div>
            ${i.unidade ? `<div class="unidade">${i.unidade}</div>` : ""}
          </div>
        </div>`,
          )
          .join("")}</div>`
      );
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${estilo(altura)}</style></head><body>
  <div class="moldura"></div>
  <div class="folha">
    <div class="topo">
      <div class="selo">${SELO}</div>
      <div class="etiqueta">${etiqueta}</div>
      <h1>${titulo}</h1>
      <div class="sub">${subtitulo}</div>
      <div class="divisor"><span></span><span></span></div>
    </div>
    ${corpo}
    ${nota ? `<div class="nota">${nota}</div>` : ""}
    <div class="rodape">
      <div class="zap">Encomende pelo <b>WhatsApp</b></div>
      <div class="arroba">@padariadocepaoxanxere</div>
      <div class="cidade">DOCE PÃO · XANXERÊ · SC</div>
    </div>
  </div>
</body></html>`;

  writeFileSync(join(SAIDA, arquivo + ".html"), html, "utf8");
  console.log(`  ${arquivo}.html  (capturar em 1080 x ${altura})`);
}

console.log("Peças geradas do catálogo:");

// ---------------------------------------------------------------------------
// 1. SALGADOS
// ---------------------------------------------------------------------------
const frito = catalogo.salgados.frito;
const assado = catalogo.salgados.assado;
// Frito com sabor fixo mostra o recheio; frito com opcao mostra as opcoes.
// Mini bolha e risolis tem lista, e sem isso saiam sem sabor nenhum na peca.
const comRecheio = (i) =>
  i.recheios?.length ? `${maiuscula(i.nome)} (${lista(i.recheios)})` : i.recheio ? `${maiuscula(i.nome)} (${i.recheio})` : maiuscula(i.nome);
const comOpcoes = (i) => (i.recheios?.length ? `${maiuscula(i.nome)} (${lista(i.recheios)})` : maiuscula(i.nome));

peca({
  arquivo: "salgados",
  altura: 1560,
  etiqueta: "CARDÁPIO · SALGADOS",
  titulo: "Salgados",
  subtitulo: "Fritos e assados, feitos na hora",
  blocos: [
    {
      tipo: "precos",
      cartoes: [
        { nome: "Fritos", valor: brl(frito.preco), nota: "a unidade" },
        { nome: "Assados", valor: brl(assado.preco), nota: "a unidade" },
      ],
    },
    { tipo: "pastilhas", titulo: "Fritos", itens: frito.itens.map(comRecheio) },
    { tipo: "pastilhas", titulo: "Assados", itens: assado.itens.map(comOpcoes) },
  ],
  nota: "No cento dá pra escolher até 5 sabores, 20 de cada",
});

// ---------------------------------------------------------------------------
// 2. DOCINHOS
// ---------------------------------------------------------------------------
const trufa = catalogo.doces.itens.find((i) => i.sabores?.length);
const docinhos = catalogo.doces.itens.filter((i) => !i.sabores?.length);
const faixaDoce = (preco) => docinhos.filter((i) => i.preco === preco).map((i) => maiuscula(i.nome));

peca({
  arquivo: "docinhos",
  altura: 1720,
  etiqueta: "CARDÁPIO · DOCINHOS",
  titulo: "Docinhos",
  subtitulo: "De festa, na forminha da cor que você quiser",
  blocos: [
    {
      tipo: "precos",
      cartoes: [
        { nome: "Tradicionais", valor: brl(1.25), nota: "a unidade" },
        { nome: "Especiais", valor: brl(1.75), nota: "a unidade" },
        { nome: "Trufas", valor: brl(trufa.preco), nota: "a unidade" },
      ],
    },
    { tipo: "pastilhas", titulo: "Tradicionais", itens: faixaDoce(1.25) },
    { tipo: "pastilhas", titulo: "Especiais", itens: faixaDoce(1.75) },
    { tipo: "pastilhas", titulo: "Trufas", itens: trufa.sabores.map(maiuscula) },
    // AS CORES DA FORMINHA ENTRAM NA PECA.
    //
    // A dona pergunta a cor toda vez que o cliente escolhe docinho ("voce quer
    // rosa, azul, marrom, tem uma cor da tua preferencia?"), e o cardapio so
    // dizia "na forminha da cor que voce quiser", sem dizer QUAIS. O cliente
    // ficava adivinhando e a Dora tinha que listar 21 cores no texto.
    //
    // Saem do catalogo, como todo o resto desta peca: cor que a dona tirar da
    // tabela some daqui junto.
    { tipo: "pastilhas", titulo: "Cores da forminha", itens: (catalogo.forminhas_docinho?.cores ?? []).map(maiuscula) },
  ],
  nota: "Mínimo de 20 de cada sabor · todas as cores podem ser laminadas",
});

// ---------------------------------------------------------------------------
// 3. BOLOS DE FESTA
// ---------------------------------------------------------------------------
const faixas = catalogo.bolos_recheados.faixas;
peca({
  arquivo: "bolos-festa",
  altura: 1180,
  etiqueta: "CARDÁPIO · BOLOS DE FESTA",
  titulo: "Bolos de Festa",
  subtitulo: "Recheados, vendidos por quilo",
  blocos: [
    {
      tipo: "precos",
      cartoes: faixas.map((f) => ({ nome: f.sabores.length + " sabores", valor: brl(f.preco), nota: "o quilo" })),
    },
    ...faixas.map((f) => ({ tipo: "pastilhas", titulo: brl(f.preco) + " o quilo", itens: f.sabores.map(maiuscula) })),
  ],
  nota: "1 kg serve 10 pessoas · dois sabores no mesmo bolo valem o mais caro",
});

// ---------------------------------------------------------------------------
// 4. BOLOS CASEIROS
// ---------------------------------------------------------------------------
peca({
  arquivo: "bolos-caseiros",
  altura: 2120,
  etiqueta: "CARDÁPIO · BOLOS CASEIROS",
  titulo: "Bolos Caseiros",
  subtitulo: "Bolo inteiro, do jeito de casa",
  blocos: [
    {
      tipo: "itens",
      itens: catalogo.bolos_caseiros.itens.map((i) => ({
        nome: maiuscula(i.nome),
        preco: brl(i.preco),
        unidade: "cada",
      })),
    },
  ],
});

// ---------------------------------------------------------------------------
// 5. TORTAS E EMPADÃO
// ---------------------------------------------------------------------------
const porQuilo = (nome) => {
  const p = acha(nome);
  return {
    nome: maiuscula(nome),
    detalhe: p.sabores ? lista(p.sabores) : "",
    preco: brl(p.preco),
    unidade: porUnidade(p.unidade),
  };
};

peca({
  arquivo: "tortas-empadao",
  altura: 1560,
  etiqueta: "CARDÁPIO · POR QUILO",
  titulo: "Tortas e Empadão",
  subtitulo: "Salgadas e doces, vendidas por quilo",
  blocos: [
    {
      tipo: "itens",
      titulo: "Salgadas",
      itens: ["empadao", "empadao com palmito", "torta fria", "torta fria com palmito", "bolo salgado"].map(porQuilo),
    },
    { tipo: "itens", titulo: "Doces", itens: ["torta doce", "torta especial"].map(porQuilo) },
  ],
  nota: "A quantidade é o peso, o valor é por quilo",
});

// ---------------------------------------------------------------------------
// 6. CUPCAKES E FRANCISCANO
// ---------------------------------------------------------------------------
const cp = acha("cupcake pequeno");
const cpr = acha("cupcake pequeno recheado");
const cg = acha("cupcake grande");
const cgr = acha("cupcake grande recheado");
const fr = acha("franciscano");

// SEPARADAS POR ORDEM DO DONO, 30/08/2026: "cupcake e doce, franciscano e
// salgado de R$ 12,00". Numa peca so, quem pedia o cardapio de cupcake recebia
// um salgado junto, e o preco do franciscano parecia ser de cupcake.
peca({
  arquivo: "cupcakes",
  altura: 900,
  etiqueta: "CARDÁPIO · CUPCAKES",
  titulo: "Cupcakes",
  subtitulo: "Vendidos por unidade",
  blocos: [
    {
      tipo: "itens",
      itens: [
        { nome: "Pequeno", detalhe: "2 a 3 cm, forminha de brigadeiro", preco: brl(cp.preco), unidade: "a unidade" },
        { nome: "Pequeno recheado", detalhe: lista(cpr.sabores ?? []), preco: brl(cpr.preco), unidade: "a unidade" },
        { nome: "Grande", detalhe: "5 a 6 cm", preco: brl(cg.preco), unidade: "a unidade" },
        { nome: "Grande recheado", preco: brl(cgr.preco), unidade: "a unidade" },
      ],
    },
  ],
});

peca({
  arquivo: "franciscano",
  altura: 640,
  etiqueta: "CARDÁPIO · FRANCISCANO",
  titulo: "Franciscano",
  subtitulo: "Salgado, vendido por unidade",
  blocos: [
    {
      tipo: "itens",
      itens: [{ nome: "Franciscano", detalhe: lista(fr.sabores ?? []), preco: brl(fr.preco), unidade: "a unidade" }],
    },
  ],
});

// ---------------------------------------------------------------------------
// 7. CUCAS E PÃES
// ---------------------------------------------------------------------------
const cucaRecheada = acha("cuca recheada");
const cuca = acha("cuca");
const paoDoce = acha("pao doce");
const paoFrances = acha("pao frances");
const paoDeX = acha("pao de x");
const cachorroMini = acha("cachorro-quente mini");
const cachorro = acha("cachorro-quente");

// SEPARADAS POR ORDEM DO DONO, 30/08/2026: "cuca e confeitaria, pao e padaria,
// salas diferentes". Eram uma peca so, e quem pedia o cardapio de pao recebia
// cuca junto.
peca({
  arquivo: "cucas",
  altura: 660,
  etiqueta: "CARDÁPIO · CUCAS",
  titulo: "Cucas",
  subtitulo: "Fresquinhas todo dia",
  blocos: [
    {
      tipo: "itens",
      itens: [
        { nome: "Cuca recheada", detalhe: lista(cucaRecheada.sabores), preco: brl(cucaRecheada.preco), unidade: "o quilo" },
        { nome: "Cuca simples", detalhe: "sem recheio", preco: brl(cuca.preco), unidade: "o quilo" },
      ],
    },
  ],
  nota: "A cuca é vendida por quilo",
});

peca({
  arquivo: "paes",
  altura: 950,
  etiqueta: "CARDÁPIO · PÃES",
  titulo: "Pães",
  subtitulo: "Feitos todo dia",
  blocos: [
    {
      tipo: "itens",
      itens: [
        { nome: "Pão doce", preco: brl(paoDoce.preco), unidade: porUnidade(paoDoce.unidade) },
        { nome: "Pão francês", preco: brl(paoFrances.preco), unidade: "o quilo" },
        { nome: "Pão de X", preco: brl(paoDeX.preco), unidade: "o quilo" },
        { nome: "Pão de cachorro-quente", detalhe: "médio e grande", preco: brl(cachorro.preco), unidade: "o quilo" },
        { nome: "Mini cachorro-quente", detalhe: "bisnaguinha", preco: brl(cachorroMini.preco), unidade: "o quilo" },
      ],
    },
  ],
  // A NOTA SAI DO CATALOGO, NAO DA MINHA CABECA. A primeira versao dizia "o
  // pao doce por unidade" e o catalogo diz `unidade: "kg"` pros cinco. Escrever
  // na peca uma regra de venda que o dado nao sustenta e o mesmo erro de
  // inventar preco: quem le acredita.
  nota: "Os pães são vendidos por quilo",
});

// ---------------------------------------------------------------------------
// 8. PIZZA
// ---------------------------------------------------------------------------
const pz = catalogo.pizza;
peca({
  arquivo: "pizza",
  altura: 1720,
  etiqueta: "CARDÁPIO · PIZZA",
  titulo: "Pizza",
  subtitulo: "Forma grande 60x40 cm, assada na hora",
  blocos: [
    {
      tipo: "precos",
      cartoes: [
        {
          nome: "Inteira",
          valor: "R$ " + pz.inteira.preco,
          nota: `serve ${pz.inteira.serve[0]} a ${pz.inteira.serve[1]} · até ${pz.inteira.sabores_ate} sabores`,
        },
        {
          nome: "Meia",
          valor: "R$ " + pz.meia.preco,
          nota: `serve ${pz.meia.serve[0]} a ${pz.meia.serve[1]} · até ${pz.meia.sabores_ate} sabores`,
        },
      ],
    },
    { tipo: "pastilhas", titulo: "Sabores salgados", itens: pz.sabores_salgados.map(maiuscula) },
    { tipo: "pastilhas", titulo: "Sabores doces", itens: pz.sabores_doces.map(maiuscula) },
  ],
  nota: "Também temos pizza redonda (30 cm) e calzone por quilo",
});

console.log("");
console.log("As oito peças saem do catalogo.json. Mudou preço ou sabor lá?");
console.log("Roda este script de novo e captura as que mudaram.");
