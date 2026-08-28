// O SSO NAO ACEITA TOKEN FRACO: SEM VALIDADE, SEM ASSINATURA, SEM NEGOCIO.
//
// POR QUE ISTO EXISTE
//
// O `/sso` loga como DONO da padaria sem pedir senha. Ele existe pro MODO OWNER
// do hub: o console manda um token assinado com o SSO_SECRET, e o painel abre
// dentro de um iframe ja logado.
//
// Quem entra por essa porta pode tudo o que a dona pode. Entao a porta so pode
// abrir com o token completo, e nao com o mais fraco que der pra montar.
//
// O DEFEITO ACHADO NA LEITURA DO `app/`, EM 28/08/2026
//
//     const exp = typeof data.exp === "number" ? data.exp : 0;
//     if (!data || !negocioId || (exp && Date.now() > exp)) recusa
//
// Quando o token NAO trazia `exp`, o valor caia pra 0, o `(exp && ...)` era
// falsy, e o token PASSAVA. Um link de SSO sem validade valeria pra sempre.
//
// E ele viaja na URL: vai pro historico do navegador, pro log do proxy e pro
// cabecalho Referer de qualquer coisa que a pagina carregue.
//
// Ninguem estava exposto: o hub sempre emite com 5 minutos
// (`app/ws/[neg]/page.tsx`). Mas a guarda estava escrita pra ACEITAR o token
// mais fraco possivel, que e a MESMA FORMA DE ERRO das dezesseis rotas que
// rodavam sem login: um `if` que parece guarda e nao dispara nunca.
//
// O QUE ELE COBRA
//
// O token completo entra. Os fracos, nao:
//
//   1. sem `exp`                 (o defeito de 28/08)
//   2. com `exp` vencido
//   3. com `exp` que nao e numero ("depois", null)
//   4. sem `negocioId`
//   5. com assinatura errada     (o segredo e o que separa o hub de qualquer um)
//   6. sem assinatura nenhuma
//
// COMO ELE MEDE
//
// Sem servidor: a regra do `/sso` e reescrita aqui a partir do ARQUIVO, e nao
// da minha memoria. O teste le o `app/sso/route.ts`, confere que a linha da
// guarda esta na forma que falha fechado, e so entao roda os casos contra uma
// copia dela. Se a linha mudar de forma, ele reprova e manda olhar.
//
// Roda com: node testes/o-sso-nao-aceita-token-fraco.cjs
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const raiz = path.join(__dirname, "..");
const fonte = fs.readFileSync(path.join(raiz, "app", "sso", "route.ts"), "utf8");

// -----------------------------------------------------------------------------
// 1. A GUARDA ESTA NA FORMA QUE FALHA FECHADO?
//
// Ler o arquivo em vez de confiar na copia abaixo: e o que impede o teste de
// continuar verde depois de alguem afrouxar a regra la.
// -----------------------------------------------------------------------------
const falhas = [];

const linhaDaGuarda = fonte
  .split(/\r?\n/)
  .map((l) => l.replace(/\r/g, ""))
  .find((l) => /if \(!data \|\| !negocioId/.test(l.replace(/\/\/.*$/, "")));

if (!linhaDaGuarda) {
  falhas.push("nao achei a guarda do /sso no arquivo: ela mudou de forma, vale olhar");
} else {
  // `(exp && Date.now() > exp)` aceita token sem exp. `!exp || Date.now() > exp`
  // recusa. A diferenca inteira mora aqui.
  if (/\(\s*exp\s*&&/.test(linhaDaGuarda)) {
    falhas.push("a guarda voltou pro `(exp && ...)`, que ACEITA token sem validade: " + linhaDaGuarda.trim());
  }
  if (!/!exp/.test(linhaDaGuarda)) {
    falhas.push("a guarda nao exige mais que o token tenha validade: " + linhaDaGuarda.trim());
  }
}

// -----------------------------------------------------------------------------
// 2. OS CASOS, contra uma copia fiel da regra do arquivo.
// -----------------------------------------------------------------------------
const SEGREDO = "segredo-de-teste";

const assinar = (obj, segredo) => {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const mac = crypto.createHmac("sha256", segredo).update(payload).digest("base64url");
  return payload + "." + mac;
};

const verificar = (token, segredo) => {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const mac = token.slice(i + 1);
  const esperado = crypto.createHmac("sha256", segredo).update(payload).digest("base64url");
  if (mac.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
};

const entra = (token) => {
  const data = verificar(token, SEGREDO);
  const exp = data && typeof data.exp === "number" ? data.exp : 0;
  const negocioId = data && typeof data.negocioId === "string" ? data.negocioId : "";
  return !(!data || !negocioId || !exp || Date.now() > exp);
};

const NEG = "11111111-1111-1111-1111-111111111111";
const daquiA5min = Date.now() + 5 * 60 * 1000;

const casos = [
  ["o token completo, como o hub emite", assinar({ negocioId: NEG, exp: daquiA5min }, SEGREDO), true],
  ["SEM validade (o defeito de 28/08)", assinar({ negocioId: NEG }, SEGREDO), false],
  ["validade VENCIDA", assinar({ negocioId: NEG, exp: Date.now() - 1000 }, SEGREDO), false],
  ["validade que nao e numero", assinar({ negocioId: NEG, exp: "depois" }, SEGREDO), false],
  ["validade nula", assinar({ negocioId: NEG, exp: null }, SEGREDO), false],
  ["sem negocio", assinar({ exp: daquiA5min }, SEGREDO), false],
  ["negocio que nao e texto", assinar({ negocioId: 42, exp: daquiA5min }, SEGREDO), false],
  ["assinado com OUTRO segredo", assinar({ negocioId: NEG, exp: daquiA5min }, "outro"), false],
  ["sem assinatura", Buffer.from(JSON.stringify({ negocioId: NEG, exp: daquiA5min })).toString("base64url"), false],
  ["vazio", "", false],
];

console.log("Tokens medidos: " + casos.length);
console.log("");
for (const [rotulo, token, esperado] of casos) {
  const deu = entra(token);
  const ok = deu === esperado;
  console.log((ok ? "ok    " : "ERRO  ") + (deu ? "ENTRA     " : "recusado  ") + rotulo);
  if (!ok) {
    falhas.push(rotulo + ": " + (deu ? "ENTROU e nao devia" : "foi recusado e devia entrar"));
  }
}

console.log("");
if (falhas.length) {
  console.log("ERRO  a porta do SSO aceita token que nao devia (" + falhas.length + ")");
  for (const f of falhas) console.log("        " + f);
  console.log("");
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    so o token completo e assinado abre a porta do dono");
console.log("");
console.log("PASSOU");
