// ============================================================================
//  AS PEÇAS DO CARDÁPIO, GERADAS DO CATÁLOGO.
//
//  A peça "Cucas e Pães" não trazia pão francês, pão de X nem cachorro-quente.
//  A dona deu esses três preços em áudio, eles entraram no catálogo, e a imagem
//  que a Dora manda pro cliente ficou pra trás. Quem perguntava o preço do pão
//  de cachorro-quente recebia uma imagem que não respondia a pergunta.
//
//  É a mesma doença de sempre: o mesmo fato em dois lugares. Por isso a peça
//  passa a ser GERADA do catalogo.json, com o mesmo desenho de antes. Mudou o
//  preço no JSON, roda de novo e a imagem acompanha.
//
//  Uso:
//    node scripts/gerar-cardapio.mjs           gera o HTML em .cardapios/
//    (depois é só abrir o HTML e salvar como imagem, ou rodar o passo de
//     captura descrito no fim deste arquivo)
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import catalogo from "../lib/ia/dados/catalogo.json" with { type: "json" };

const SAIDA = ".cardapios";
mkdirSync(SAIDA, { recursive: true });

const brl = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");
const unidade = (u) => (u === "kg" ? "o quilo" : "a unidade");

function acha(nome) {
  const p = catalogo.outros_produtos.find((x) => x.nome === nome);
  if (!p) throw new Error("produto nao existe no catalogo: " + nome);
  return p;
}

// O desenho é o mesmo das peças que já estão no ar: fundo vinho, selo dourado,
// título grande, cartões translúcidos e o preço em dourado com a unidade
// embaixo. Mexer aqui muda todas as peças de uma vez.
function pagina({ etiqueta, titulo, subtitulo, itens, rodapeNota }) {
  const cartoes = itens
    .map(
      (i) => `
      <div class="item">
        <div class="esq">
          <div class="nome">${i.nome}</div>
          ${i.detalhe ? `<div class="detalhe">${i.detalhe}</div>` : ""}
        </div>
        <div class="dir">
          <div class="preco">${i.preco}</div>
          <div class="unidade">${i.unidade}</div>
        </div>
      </div>`,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1080px; height:1296px;
    font-family:"Poppins","Segoe UI",Arial,sans-serif;
    background:radial-gradient(120% 90% at 50% 0%, #8f1b30 0%, #6d1424 45%, #4d0e1a 100%);
    color:#fff; position:relative; overflow:hidden;
  }
  /* Bloco fixo em vez de item flexivel: dentro do flex ele encolhia pro
     tamanho do conteudo e a peca saia com um quarto da largura. */
  .moldura { position:absolute; inset:22px; border:1px solid rgba(231,207,148,.35); border-radius:10px; }
  .folha { width:1080px; height:1296px; padding:52px 62px; text-align:center; display:flex; flex-direction:column; justify-content:center; }
  .selo {
    width:118px; height:118px; margin:0 auto 26px; border-radius:50%;
    background:linear-gradient(150deg,#f0d493,#c99a35);
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 10px 30px rgba(0,0,0,.28);
  }
  .etiqueta { font-size:17px; letter-spacing:7px; color:#e7cf94; font-weight:600; }
  h1 { font-size:78px; font-weight:700; line-height:1; margin:14px 0 10px; letter-spacing:-1px; }
  .sub { font-size:29px; opacity:.9; font-weight:400; }
  .divisor { display:flex; align-items:center; justify-content:center; gap:16px; margin:26px 0 34px; }
  .divisor span { width:120px; height:1px; background:linear-gradient(90deg,transparent,#e7cf94); }
  .divisor span:last-child { background:linear-gradient(90deg,#e7cf94,transparent); }
  .lista { display:flex; flex-direction:column; gap:14px; text-align:left; }
  .item {
    display:flex; align-items:center; justify-content:space-between; gap:26px;
    background:rgba(255,255,255,.055); border:1px solid rgba(231,207,148,.18);
    border-radius:16px; padding:22px 28px;
  }
  .nome { font-size:33px; font-weight:600; }
  .detalhe { font-size:22px; opacity:.82; margin-top:6px; line-height:1.35; font-weight:400; }
  .dir { text-align:right; flex-shrink:0; }
  .preco { font-size:38px; font-weight:700; color:#f0d493; white-space:nowrap; }
  .unidade { font-size:20px; opacity:.8; margin-top:2px; }
  .nota { font-size:21px; font-style:italic; opacity:.85; margin-top:26px; }
  .rodape { margin-top:26px; padding-top:22px; border-top:1px solid rgba(231,207,148,.22); }
  .rodape .zap { font-size:26px; }
  .rodape .zap b { color:#f0d493; }
  .rodape .arroba { font-size:33px; font-weight:700; margin-top:8px; }
  .rodape .cidade { font-size:18px; letter-spacing:5px; opacity:.8; margin-top:10px; }
</style></head><body>
  <div class="moldura"></div>
  <div class="folha">
    <div class="selo">
      <svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="#8a5a12" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 3c-1.6 1.7-1.6 3.6 0 5.3 1.6-1.7 1.6-3.6 0-5.3Z"/>
        <path d="M12 21V9"/><path d="M12 12c-2 0-3.4-1-4-2.6 2 0 3.4 1 4 2.6Z"/>
        <path d="M12 12c2 0 3.4-1 4-2.6-2 0-3.4 1-4 2.6Z"/>
        <path d="M12 16c-2 0-3.4-1-4-2.6 2 0 3.4 1 4 2.6Z"/>
        <path d="M12 16c2 0 3.4-1 4-2.6-2 0-3.4 1-4 2.6Z"/>
      </svg>
    </div>
    <div class="etiqueta">${etiqueta}</div>
    <h1>${titulo}</h1>
    <div class="sub">${subtitulo}</div>
    <div class="divisor"><span></span><span></span></div>
    <div class="lista">${cartoes}</div>
    ${rodapeNota ? `<div class="nota">${rodapeNota}</div>` : ""}
    <div class="rodape">
      <div class="zap">Encomende pelo <b>WhatsApp</b></div>
      <div class="arroba">@padariadocepaoxanxere</div>
      <div class="cidade">DOCE PÃO · XANXERÊ · SC</div>
    </div>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// CUCAS E PÃES
//
// Agora com os três que a dona deu em áudio e faltavam na peça: pão francês,
// pão de X e os cachorro-quentes.
// ---------------------------------------------------------------------------
const cucaRecheada = acha("cuca recheada");
const cuca = acha("cuca");
const paoDoce = acha("pao doce");
const paoFrances = acha("pao frances");
const paoDeX = acha("pao de x");
const cachorroMini = acha("cachorro-quente mini");
const cachorro = acha("cachorro-quente");

const cucasPaes = pagina({
  etiqueta: "CARDÁPIO · DIA A DIA",
  titulo: "Cucas e Pães",
  subtitulo: "Fresquinhas todo dia",
  itens: [
    {
      nome: "Cuca recheada",
      detalhe: cucaRecheada.sabores.join(" · "),
      preco: brl(cucaRecheada.preco),
      unidade: unidade(cucaRecheada.unidade),
    },
    { nome: "Cuca simples", detalhe: "sem recheio", preco: brl(cuca.preco), unidade: unidade(cuca.unidade) },
    { nome: "Pão doce", detalhe: "", preco: brl(paoDoce.preco), unidade: unidade(paoDoce.unidade) },
    { nome: "Pão francês", detalhe: "", preco: brl(paoFrances.preco), unidade: unidade(paoFrances.unidade) },
    { nome: "Pão de X", detalhe: "", preco: brl(paoDeX.preco), unidade: unidade(paoDeX.unidade) },
    {
      nome: "Pão de cachorro-quente",
      detalhe: "médio e grande",
      preco: brl(cachorro.preco),
      unidade: unidade(cachorro.unidade),
    },
    {
      nome: "Mini cachorro-quente",
      detalhe: "bisnaguinha",
      preco: brl(cachorroMini.preco),
      unidade: unidade(cachorroMini.unidade),
    },
  ],
  rodapeNota: "Cuca e pães são vendidos por quilo",
});

writeFileSync(join(SAIDA, "cucas-paes.html"), cucasPaes, "utf8");
console.log("gerado: " + join(SAIDA, "cucas-paes.html"));
console.log("");
console.log("COMO VIRAR IMAGEM (1 minuto):");
console.log("  1. Abra .cardapios/cucas-paes.html no Chrome");
console.log("  2. F12, botao de dispositivo, escolha tamanho 1080 x 1296");
console.log("  3. Ctrl+Shift+P, digite screenshot, escolha Capture full size screenshot");
console.log("  4. Salve como public/cardapios/cucas-paes.jpg");
console.log("");
console.log("O desenho e o mesmo das pecas que ja estao no ar. Mudou preco no");
console.log("catalogo? Roda este script de novo e repete a captura.");
