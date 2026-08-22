// PREVIA: como o cardapio da Doce Pao fica no WhatsApp com botao e lista
//
// Nao e teste: e uma tela pra olhar antes de decidir. Monta um HTML com as
// telas do WhatsApp usando o cardapio DE VERDADE e os limites REAIS da Meta,
// conferidos na documentacao em 23/08/2026:
//
//   lista  -> 10 linhas no total, titulo 24 caracteres, descricao 72
//   botao  -> 3 opcoes, 20 caracteres cada
//
// O ponto que so fica claro vendo: o cardapio dela nao cabe numa lista so.
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..");
const c = require(path.join(raiz, "lib/ia/dados/catalogo.json"));

const brl = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const fritos = (c.salgados.frito.itens || []).map((i) => [i.nome, brl(c.salgados.frito.preco) + " a unidade"]);
const docinhos = (c.doces.itens || []).map((i) => [i.nome, brl(i.preco ?? 1.25) + " a unidade"]);
const pizza = [...(c.pizza.sabores_salgados || []), ...(c.pizza.sabores_doces || [])].map((s) => [
  s,
  "pizza inteira " + brl(c.pizza.inteira.preco),
]);

const linha = (t, s) =>
  "<div class='linha'><div class='radio'></div><div><div class='lt'>" + esc(t) +
  "</div><div class='ls'>" + esc(s) + "</div></div></div>";

function folha(secao, itens) {
  const dez = itens.slice(0, 10);
  const fora = itens.slice(10);
  let h = "<div class='folha'><div class='puxador'></div><div class='secao'>" + esc(secao) + "</div>";
  h += dez.map(([t, s]) => linha(t, s)).join("");
  if (fora.length) {
    h += "<div class='aviso'>" + fora.length + " item(ns) NAO CABEM nesta lista:<span>" +
      esc(fora.map(([t]) => t).join(", ")) + "</span></div>";
  }
  return h + "</div>";
}

const fone = (chat, folhaHtml) =>
  "<div class='fone'><div class='topo'>Doce Pao</div><div class='chat'>" + chat + "</div>" + (folhaHtml || "") + "</div>";

const botoes = (...b) =>
  "<div class='btns'>" + b.map((x) => "<div class='btn1'>" + esc(x) + "</div>").join("") + "</div>";

const ESTILO = [
  "<title>Como fica no WhatsApp</title><style>",
  "body{margin:0;background:#0b141a;color:#e9edef;font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}",
  ".capa{max-width:1180px;margin:0 auto;padding:28px 20px 60px}",
  "h1{font-size:26px;margin:0 0 6px}.sub{color:#8696a0;margin:0 0 26px}",
  "h2{font-size:17px;margin:34px 0 12px}.nota{color:#8696a0;font-size:14px;margin:-4px 0 16px;max-width:780px}",
  ".telas{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start}",
  ".fone{width:330px;background:#0b141a;border:1px solid #2a3942;border-radius:14px;overflow:hidden;flex:0 0 auto}",
  ".topo{background:#202c33;padding:11px 14px;font-size:14px;color:#8696a0;border-bottom:1px solid #2a3942}",
  ".chat{padding:14px}.bal{background:#202c33;border-radius:8px;padding:9px 11px;max-width:90%;font-size:14.5px;margin-bottom:8px}",
  ".bal.meu{background:#005c4b;margin-left:auto;max-width:60%}",
  ".btn{border-top:1px solid #2a3942;color:#53bdeb;text-align:center;padding:11px;font-weight:500;margin:8px -11px -9px;background:#202c33;border-radius:0 0 8px 8px}",
  ".btns{display:flex;flex-direction:column;gap:5px;margin-top:8px}",
  ".btn1{background:#202c33;border:1px solid #3b4a54;border-radius:8px;color:#53bdeb;text-align:center;padding:10px;font-size:14.5px}",
  ".folha{background:#111b21;border-top:1px solid #2a3942;padding:0 0 10px}",
  ".puxador{width:36px;height:4px;background:#3b4a54;border-radius:2px;margin:9px auto 10px}",
  ".secao{color:#8696a0;font-size:12.5px;text-transform:uppercase;letter-spacing:.4px;padding:8px 16px 6px;font-weight:600}",
  ".linha{display:flex;gap:12px;align-items:flex-start;padding:11px 16px;border-bottom:1px solid #1f2c34}",
  ".radio{width:17px;height:17px;border:1.5px solid #8696a0;border-radius:50%;flex:0 0 auto;margin-top:2px}",
  ".lt{font-size:15px}.ls{color:#8696a0;font-size:13px;margin-top:2px}",
  ".aviso{margin:12px 14px 4px;padding:12px;border:1px dashed #d9534f;border-radius:8px;color:#f0a3a1;font-size:13.5px}",
  ".aviso span{color:#8696a0;display:block;margin-top:6px;line-height:1.7}",
  ".card{background:#111b21;border:1px solid #2a3942;border-radius:12px;padding:18px 20px;flex:1 1 320px;max-width:430px}",
  ".card h3{margin:0 0 10px;font-size:15.5px}.card p{margin:0 0 8px;color:#8696a0;font-size:14px}",
  ".ok{color:#7ee0a0}.ruim{color:#f0a3a1}",
  "table{border-collapse:collapse;width:100%;font-size:14.5px}",
  "td,th{border-bottom:1px solid #2a3942;padding:8px 10px;text-align:left}",
  "th{color:#8696a0;font-size:13px}.n{color:#f0a3a1;font-weight:600}.s{color:#7ee0a0;font-weight:600}",
  "</style>",
].join("");

const p = [];
p.push(ESTILO);
p.push("<div class='capa'><h1>Como o cardapio fica no WhatsApp</h1>");
p.push("<p class='sub'>Telas com o cardapio de verdade da Doce Pao e os limites reais da Meta: lista aceita 10 linhas, botao aceita 3 opcoes.</p>");

p.push("<h2>1. Botoes: a decisao de sim ou nao</h2>");
p.push("<p class='nota'>Ate tres botoes, 20 caracteres cada. O cliente toca e chega um codigo no sistema, nao uma frase pra interpretar. E aqui que morre o defeito do Sandro: o &quot;Pode ser, vou querer bolo tambem dai&quot; que nao virava pedido nenhum.</p><div class='telas'>");
p.push(fone(
  "<div class='bal'>Pra 20 pessoas, uma base boa e 200 salgados, 100 docinhos e 2 kg de bolo.<br><br>Da R$ 418,80 no total." +
  botoes("Pode ser", "Quero ajustar", "So o bolo") + "</div><div class='bal meu'>Pode ser</div>"));
p.push(fone("<div class='bal'>O bolo vai com topo e papel de arroz?" + botoes("Os dois", "So o topo", "Nenhum") + "</div>"));
p.push("</div>");

p.push("<h2>2. Lista: quando cabe</h2>");
p.push("<p class='nota'>Salgados fritos sao 9 e assados sao 10. Cada um cabe sozinho; juntos sao 19 numa lista de 10, entao viram duas telas.</p><div class='telas'>");
p.push(fone("<div class='bal'>Escolhe o salgado frito<div class='btn'>Ver salgados fritos</div></div>", folha("Salgados fritos", fritos)));
p.push(fone("<div class='bal'>Escolhe o docinho<div class='btn'>Ver docinhos</div></div>", folha("Docinhos", docinhos)));
p.push("</div>");

p.push("<h2>3. Onde nao cabe</h2>");
p.push("<p class='nota'>A pizza tem 31 sabores: sao quatro telas ate o cliente achar calabresa. Quem sabe o que quer digita &quot;2 calabresa&quot; em tres segundos.</p><div class='telas'>");
p.push(fone("<div class='bal'>Escolhe o sabor da pizza<div class='btn'>Ver sabores</div></div>", folha("Pizza salgada e doce", pizza)));

const conta = [
  ["salgados fritos", (c.salgados.frito.itens || []).length],
  ["salgados assados", (c.salgados.assado.itens || []).length],
  ["docinhos", (c.doces.itens || []).length],
  ["sabores de bolo festa", (c.bolos_recheados.faixas || []).flatMap((f) => f.sabores || []).length],
  ["bolos caseiros", (c.bolos_caseiros.itens || []).length],
  ["sabores de pizza", pizza.length],
  ["outros produtos", (c.outros_produtos || []).length],
];
p.push("<div class='card'><h3>A conta do cardapio dela</h3><table><tr><th>categoria</th><th>itens</th><th>cabe em 10?</th></tr>");
for (const [nome, q] of conta) {
  const cls = q > 10 ? "n" : "s";
  const txt = q > 10 ? "nao" : q === 10 ? "no limite" : "cabe";
  p.push("<tr><td>" + esc(nome) + "</td><td>" + q + "</td><td class='" + cls + "'>" + txt + "</td></tr>");
}
p.push("</table>");

const longos = [
  ...(c.salgados.frito.itens || []),
  ...(c.salgados.assado.itens || []),
  ...(c.doces.itens || []),
  ...(c.outros_produtos || []),
].map((i) => String(i.nome)).filter((n) => n.length > 24);
p.push("<p style='margin-top:14px'>" + longos.length + " nome(s) passam do limite de 24 caracteres do titulo da linha: <b>" +
  esc(longos.join("</b>, <b>")).replace(/&lt;\/b&gt;/g, "</b>").replace(/&lt;b&gt;/g, "<b>") + "</b>.</p></div></div>");

p.push("<h2>O que eu faria</h2><div class='telas'>");
p.push("<div class='card'><h3 class='ok'>Botao onde a resposta e fechada</h3><p>&quot;Pode ser assim?&quot;, &quot;vai querer salgado?&quot;, &quot;topo e papel de arroz?&quot;, cor da forminha, pao de lo.</p><p>Tres opcoes cabem sempre e o cliente responde num toque. Mata a maior parte dos guardas que existem so pra adivinhar o que ele quis dizer.</p></div>");
p.push("<div class='card'><h3 class='ok'>Lista onde a escolha e curta</h3><p>Salgados fritos, assados, cor da forminha, tipo de bolo: ate 10 linhas, com o preco na descricao de cada uma.</p></div>");
p.push("<div class='card'><h3 class='ruim'>Texto livre continua</h3><p>Quantidade, data, hora, nome, &quot;tenho uma festa de 20 pessoas, me ajuda&quot;. Botao nao resolve isso, e e onde a IA ganha do formulario.</p></div>");
p.push("</div></div>");

const destino = process.argv[2] || path.join(require("node:os").homedir(), "Desktop", "como-fica-no-whatsapp.html");
fs.writeFileSync(destino, p.join(""), "utf8");
console.log("escrito em: " + destino);
console.log("tamanho: " + fs.statSync(destino).size + " bytes");
