// ROTA DO PAINEL EXIGE SESSAO. O NEGOCIO NAO PODE VIR DO AMBIENTE.
//
// POR QUE ISTO EXISTE
//
// Dezesseis rotas do painel resolviam o tenant assim:
//
//     const negocioId = sessao?.negocioId ?? process.env.NEGOCIO_PADRAO_ID;
//     if (!negocioId) return 401;
//
// Parece uma guarda, e nao e. Enquanto o `NEGOCIO_PADRAO_ID` estiver no
// ambiente -- e ele esta, o proprio `.env.example` manda por -- a variavel
// NUNCA e vazia, entao o 401 nunca acontece e a rota roda sem sessao nenhuma,
// no tenant da padaria.
//
// Este projeto nao tem middleware: cada rota se defende sozinha. Entao isso era
// a defesa inteira.
//
// MEDIDO CONTRA A PRODUCAO, EM 28/08/2026, SEM ESCREVER NADA
//
// Um POST sem cookie nenhum, com corpo invalido de proposito, pra a resposta
// dizer ate onde a requisicao chegou:
//
//     POST /api/cliente/nota   (sem cookie, corpo invalido)  ->  400
//     GET  /api/conversas      (sem cookie)                  ->  401
//
// O 400 e "corpo invalido": a requisicao PASSOU da checagem de sessao. Com um
// corpo valido, ela teria escrito na ficha do cliente da padaria.
//
// O que estava aberto, entre outras: desconectar o WhatsApp da padaria,
// ligar e desligar a IA, mandar mensagem em nome dela, disparar a cobranca
// automatica, trocar a logo, ler a midia de qualquer mensagem.
//
// AS TRES QUE PODEM USAR O AMBIENTE, E POR QUE
//
//   app/api/fila/route.ts                  a ponte da impressora, Bearer PONTE_TOKEN
//   app/api/whatsapp/route.ts              o webhook da Meta, assinatura HMAC
//   app/api/whatsapp/provisionar/route.ts  vem do hub, x-provision-secret
//   app/api/lembretes/route.ts             o relogio do lembrete, Bearer PONTE_TOKEN
//
// Nenhuma delas tem login pra apresentar, e cada uma se defende com um segredo.
// A quarta, `cobranca/rodar`, usa o ambiente E exige sessao ou o token do
// relogio na mesma linha, entao continua valendo.
//
// O QUE ELE COBRA
//
// Nenhuma rota fora dessa lista resolve o negocio pelo ambiente.
//
// Roda com: node testes/rota-do-painel-exige-sessao.cjs
const path = require("node:path");
const fs = require("node:fs");

const raiz = path.join(__dirname, "..");

// Cada uma esta aqui com o segredo que a protege. Tirar uma daqui e dizer que
// ela passou a ter login; por uma nova e afirmar que ela tem outro guarda.
const PODEM = new Map([
  [path.join("app", "api", "fila", "route.ts"), "PONTE_TOKEN"],
  [path.join("app", "api", "whatsapp", "route.ts"), "assinatura da Meta"],
  [path.join("app", "api", "whatsapp", "provisionar", "route.ts"), "PROVISION_SECRET"],
  [path.join("app", "api", "cobranca", "rodar", "route.ts"), "sessao ou token do relogio"],
  // O RELOGIO DO LEMBRETE usa o MESMO token da ponte, e nao um novo.
  //
  // Decisao de 02/09/2026: e o mesmo grau de confianca (uma maquina da casa
  // falando com o painel), e cada variavel de ambiente a mais e uma a mais pra
  // errar no deploy. Mexer numa custou meia hora e quatro tentativas naquele
  // mesmo dia.
  [path.join("app", "api", "lembretes", "route.ts"), "PONTE_TOKEN"],
]);

const arquivos = [];
const andar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) andar(p);
    else if (/\.tsx?$/.test(e.name)) arquivos.push(p);
  }
};
andar(path.join(raiz, "app"));

const abertas = [];
const sobrando = [];
for (const abs of arquivos) {
  const rel = path.relative(raiz, abs);
  const fonte = fs.readFileSync(abs, "utf8");
  const usa = fonte.split(/\r?\n/).some((linha) => {
    const codigo = linha.replace(/\r/g, "").replace(/\/\/.*$/, "");
    return codigo.includes("NEGOCIO_PADRAO_ID");
  });
  if (usa && !PODEM.has(rel)) abertas.push(rel);
}
for (const [rel, segredo] of PODEM) {
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) {
    sobrando.push(rel + " nao existe mais (guardada por " + segredo + ")");
    continue;
  }
  const fonte = fs.readFileSync(abs, "utf8");
  if (!fonte.includes("NEGOCIO_PADRAO_ID")) {
    sobrando.push(rel + " nao usa mais o ambiente: tirar da lista");
  }
}

console.log("Arquivos de rota varridos: " + arquivos.length);
console.log("Podem usar o ambiente, cada uma com o seu segredo: " + PODEM.size);
console.log("");

const falhas = [];
const cobra = (rotulo, lista) => {
  if (!lista.length) return;
  falhas.push(rotulo);
  console.log("ERRO  " + rotulo + " (" + lista.length + ")");
  for (const l of lista) console.log("        " + l);
  console.log("");
};

cobra("rota resolve o negocio pelo ambiente e roda sem sessao", abertas);
cobra("a lista de excecoes ficou desatualizada", sobrando);

if (falhas.length) {
  console.log("REPROVOU");
  process.exit(1);
}

console.log("ok    so quem tem segredo proprio dispensa a sessao");
console.log("");
console.log("PASSOU");
