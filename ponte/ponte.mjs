// ============================================================================
//  PONTE DA IMPRESSORA DA DOCE PAO
//
//  Roda no computador da padaria, ao lado da impressora. De tempos em tempos
//  pergunta ao painel se tem pedido aprovado esperando, monta os cupons e
//  manda pra impressora em ESC/POS. Depois avisa o painel que imprimiu.
//
//  MORA AQUI DENTRO DO REPOSITORIO DE PROPOSITO. A versao anterior vivia solta
//  na maquina da padaria, e o resultado foi que ela ficou pra tras: o painel
//  aprendeu a separar salgado de docinho, a imprimir a forma de pagamento e a
//  escrever peso como peso, e o papel continuou saindo com tudo junto embaixo
//  de "EXTRAS". Codigo que decide o que a cozinha le nao pode viver fora do
//  controle de versao.
//
//  COMO INSTALAR (na maquina da padaria):
//    1. Instalar o Node.js (nodejs.org, versao LTS).
//    2. Copiar esta pasta pra maquina, por exemplo C:\docepao-ponte
//    3. Criar o arquivo .env ao lado deste, com:
//         PAINEL_URL=https://docepao.enderecodigital.tech
//         PONTE_TOKEN=<o mesmo token que esta no painel>
//         IMPRESSORA=<nome exato da impressora no Windows>
//    4. Rodar: node ponte.mjs
//    5. Pra subir sozinha com o computador, ver instalar.md
//
//  Pra testar sem gastar papel: node ponte.mjs --simular
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIMULAR = process.argv.includes("--simular");

// ---------------------------------------------------------------------------
// Configuracao: .env ao lado deste arquivo, ou variaveis de ambiente.
// ---------------------------------------------------------------------------
function lerEnv() {
  const caminho = join(AQUI, ".env");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
lerEnv();

const PAINEL = (process.env.PAINEL_URL || "https://docepao.enderecodigital.tech").replace(/\/$/, "");
const TOKEN = process.env.PONTE_TOKEN || "";
const IMPRESSORA = process.env.IMPRESSORA || "";
const INTERVALO_MS = Number(process.env.INTERVALO_MS || 5000);

if (!TOKEN) {
  console.error("Falta PONTE_TOKEN no .env. Sem ele o painel nao responde, e nada imprime.");
  process.exit(1);
}
if (!IMPRESSORA && !SIMULAR) {
  console.error("Falta IMPRESSORA no .env (o nome exato dela no Windows).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Registro do que aconteceu. Quando a dona diz "nao imprimiu", este arquivo e
// a unica forma de saber se o pedido chegou aqui, se a impressora recusou, ou
// se ninguem aprovou nada.
// ---------------------------------------------------------------------------
const PASTA_LOG = join(AQUI, "registro");
if (!existsSync(PASTA_LOG)) mkdirSync(PASTA_LOG, { recursive: true });

function agora() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function anotar(texto) {
  const linha = "[" + agora() + "] " + texto;
  console.log(linha);
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  try {
    appendFileSync(join(PASTA_LOG, dia + ".log"), linha + "\n", "utf8");
  } catch {
    // registro e conforto: se o disco encher, a impressao continua.
  }
}

// ---------------------------------------------------------------------------
// ESTACOES DA COZINHA
//
// Mesma regra do painel (lib/departamentos.ts), copiada aqui de proposito: a
// ponte tem que imprimir certo mesmo se ficar um tempo sem atualizar. Quando
// mudar la, mude aqui.
//
// Salgado e avaliado PRIMEIRO. Sem isso, "bolo salgado" ia pra bancada do bolo
// de festa e "torta fria de palmito" ia pra dos docinhos: duas encomendas
// salgadas indo parar na bancada do acucar.
// ---------------------------------------------------------------------------
function semAcento(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const SALGADO_CATEGORIA = new Set([
  "salgado", "salgado_frito", "salgado_assado", "pizza", "calzone",
  "empadao", "torta_fria", "bolo_salgado", "franciscano",
]);
const SALGADO_NOME =
  /coxinha|risol|pastel|esfir|esfih|empad|croissant|croquete|enroladinho|bolinha|mini bolha|kibe|quibe|salgad|pizza|calzone|cachorro|pao frances|pao de x|pao de queijo|torta fria|torta salgada|franciscano|cento/;

function estacaoDe(item) {
  const c = semAcento(item.categoria);
  const p = semAcento(item.produto);
  if (SALGADO_CATEGORIA.has(c) || SALGADO_NOME.test(p)) return "salgados";
  if (
    c.includes("bolo") ||
    c === "extra" ||
    /^bolo\b/.test(p) ||
    p.includes("papel de arroz") ||
    p.includes("topo de bolo")
  )
    return "bolos";
  return "confeitaria";
}

const NOME_DA_ESTACAO = {
  salgados: "SALGADOS",
  confeitaria: "DOCINHOS",
  bolos: "BOLO FESTA",
};

// PESO NAO E PECA.
//
// O bolo de 3 kg gravado sem unidade saia como "3x BOLO BRIGADEIRO" e a cozinha
// assava TRES bolos. A unidade pode vir vazia em linha antiga ou pedido editado
// na mao, entao aqui ela e reconstituida.
const KG_POR_NATUREZA = new Set([
  "bolo_recheado", "bolo_festa", "por_quilo", "torta_fria",
  "torta_recheada", "empadao", "calzone", "bolo_salgado",
]);
const KG_POR_NOME = /cachorro|pao frances|pao de x|pizza redonda|torta fria|torta salgada|empadao/;

function unidadeDe(item) {
  if (item.unidade === "kg") return "kg";
  const c = semAcento(item.categoria);
  if (KG_POR_NATUREZA.has(c)) return "kg";
  if (KG_POR_NOME.test(semAcento(item.produto))) return "kg";
  if (!Number.isInteger(Number(item.qtd))) return "kg";
  return "un";
}

function quantidade(item) {
  return String(item.qtd).replace(".", ",") + " " + unidadeDe(item);
}

function dinheiro(centavos) {
  return "R$ " + (Number(centavos || 0) / 100).toFixed(2).replace(".", ",");
}

function dataBR(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso);
}

// ---------------------------------------------------------------------------
// ESC/POS: os comandos da impressora termica.
// ---------------------------------------------------------------------------
const ESC = "\x1B";
const GS = "\x1D";
const INICIO = ESC + "@";
const CENTRO = ESC + "a" + "\x01";
const ESQUERDA = ESC + "a" + "\x00";
const NEGRITO_ON = ESC + "E" + "\x01";
const NEGRITO_OFF = ESC + "E" + "\x00";
const GRANDE_ON = GS + "!" + "\x11"; // dobro de altura e largura
const GRANDE_OFF = GS + "!" + "\x00";
const CORTAR = GS + "V" + "\x42" + "\x00";
const LARGURA = 48; // colunas de uma impressora de 80mm

function risco(c = "=") {
  return c.repeat(LARGURA);
}

// Quebra o texto na largura do papel em vez de deixar a impressora cortar no
// meio da palavra. "esfirra de calabresa com catupiry" virava "esfirra de
// calabresa com catupi" e a cozinha ficava adivinhando o resto.
function quebrar(texto, largura = LARGURA) {
  const palavras = String(texto).split(/\s+/);
  const linhas = [];
  let atual = "";
  for (const p of palavras) {
    if ((atual + " " + p).trim().length > largura) {
      if (atual) linhas.push(atual.trim());
      atual = p;
    } else {
      atual = (atual + " " + p).trim();
    }
  }
  if (atual) linhas.push(atual.trim());
  return linhas;
}

// ---------------------------------------------------------------------------
// O CUPOM DA COZINHA: um por estacao, com SO o que aquela bancada faz.
//
// Sem preco de proposito. Quem esta fritando nao precisa saber quanto custou, e
// numero a mais no papel e numero pra ler errado na correria.
// ---------------------------------------------------------------------------
function cupomDaEstacao(job, estacao, itens) {
  let t = INICIO;
  t += CENTRO + NEGRITO_ON + GRANDE_ON;
  t += NOME_DA_ESTACAO[estacao] + "\n";
  t += GRANDE_OFF + NEGRITO_OFF;
  t += "Doce Pao\n";
  t += ESQUERDA + risco() + "\n";

  t += NEGRITO_ON + "CLIENTE: " + (job.clienteNome || "(sem nome)") + "\n" + NEGRITO_OFF;

  const data = dataBR(job.retiradaData);
  const hora = job.retiradaHora || "";
  // Data e hora em corpo grande: e a primeira coisa que a producao procura, e
  // pedido sem dia ja chegou na bancada como um tracinho discreto.
  t += NEGRITO_ON + GRANDE_ON;
  t += "RETIRADA: " + (data || "SEM DATA") + (hora ? " " + hora : "") + "\n";
  t += GRANDE_OFF + NEGRITO_OFF;

  if (job.pessoas) t += "Festa de " + job.pessoas + " pessoas\n";
  t += "Pedido #" + String(job.pedidoId || "").slice(0, 8) + "\n";
  t += risco() + "\n";

  for (const i of itens) {
    t += NEGRITO_ON + GRANDE_ON + quantidade(i) + GRANDE_OFF + "  " + i.produto.toUpperCase() + "\n" + NEGRITO_OFF;
    // A observacao e o sabor, o recheio, a cor da forminha. Sem ela nao ha o
    // que assar: "3 cucas recheadas" sem sabor ja foi pra cozinha.
    if (i.obs) for (const linha of quebrar("  > " + i.obs)) t += linha + "\n";
  }

  if (job.observacoes) {
    t += risco("-") + "\n";
    for (const linha of quebrar("OBS: " + job.observacoes)) t += linha + "\n";
  }

  t += "\n\n\n" + CORTAR;
  return t;
}

// ---------------------------------------------------------------------------
// O CUPOM DO CAIXA: o pedido inteiro, com valores e forma de pagamento.
// ---------------------------------------------------------------------------
function cupomDoCaixa(job) {
  let t = INICIO;
  t += CENTRO + NEGRITO_ON + GRANDE_ON + "CAIXA\n" + GRANDE_OFF;
  t += "Doce Pao\n" + NEGRITO_OFF;
  t += ESQUERDA + risco() + "\n";

  t += NEGRITO_ON + "CLIENTE: " + (job.clienteNome || "(sem nome)") + "\n" + NEGRITO_OFF;
  if (job.clienteTelefone) t += "Fone: " + job.clienteTelefone + "\n";
  const data = dataBR(job.retiradaData);
  t += "RETIRADA: " + (data || "SEM DATA") + (job.retiradaHora ? " " + job.retiradaHora : "") + "\n";
  t += "Pedido #" + String(job.pedidoId || "").slice(0, 8) + "\n";
  t += risco() + "\n";

  for (const i of job.itens || []) {
    t += quantidade(i) + "  " + i.produto + "\n";
    if (i.obs) for (const linha of quebrar("  > " + i.obs)) t += linha + "\n";
    t +=
      "  " +
      quantidade(i) +
      " x " +
      dinheiro(i.unit_centavos) +
      " = " +
      dinheiro(i.subtotal_centavos) +
      "\n";
  }

  t += risco("-") + "\n";
  t += NEGRITO_ON + GRANDE_ON + "TOTAL: " + dinheiro(job.totalCentavos) + "\n" + GRANDE_OFF + NEGRITO_OFF;
  // A forma de pagamento no papel do caixa evita a pergunta no balcao com o
  // cliente na frente. Ela ja estava no painel e faltava aqui.
  if (job.formaPagamento) t += NEGRITO_ON + "Pagamento: " + String(job.formaPagamento).toUpperCase() + "\n" + NEGRITO_OFF;
  if (job.observacoes) {
    t += risco("-") + "\n";
    for (const linha of quebrar("OBS: " + job.observacoes)) t += linha + "\n";
  }
  t += "\n\n\n" + CORTAR;
  return t;
}

// Todos os cupons de um pedido: uma via por estacao que tem item, mais o caixa.
function cuponsDoPedido(job) {
  const porEstacao = { salgados: [], confeitaria: [], bolos: [] };
  for (const i of job.itens || []) porEstacao[estacaoDe(i)].push(i);

  const saida = [];
  for (const estacao of ["salgados", "confeitaria", "bolos"]) {
    if (porEstacao[estacao].length) saida.push(cupomDaEstacao(job, estacao, porEstacao[estacao]));
  }
  saida.push(cupomDoCaixa(job));
  return saida;
}

// ---------------------------------------------------------------------------
// IMPRIMIR: manda o texto cru pra impressora do Windows.
// ---------------------------------------------------------------------------
function imprimir(texto) {
  return new Promise((resolve, reject) => {
    if (SIMULAR) {
      console.log("\n----- SIMULACAO, nada foi impresso -----");
      console.log(texto.replace(/\x1B|\x1D/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""));
      console.log("----- fim -----\n");
      return resolve();
    }
    const arquivo = join(tmpdir(), "docepao-" + Date.now() + ".prn");
    writeFileSync(arquivo, texto, "binary");
    // O copy /b manda o arquivo cru pra fila da impressora, sem o Windows
    // tentar formatar nada. E o caminho que respeita os comandos ESC/POS.
    execFile(
      "cmd",
      ["/c", "copy", "/b", arquivo, '"' + IMPRESSORA + '"'],
      { windowsHide: true },
      (erro, _saida, saidaErro) => {
        if (erro) return reject(new Error(String(saidaErro || erro.message)));
        resolve();
      },
    );
  });
}

// ---------------------------------------------------------------------------
// A CONVERSA COM O PAINEL.
// ---------------------------------------------------------------------------
async function buscarJobs() {
  const r = await fetch(PAINEL + "/api/fila", {
    headers: { Authorization: "Bearer " + TOKEN },
  });
  if (!r.ok) throw new Error("painel respondeu " + r.status);
  const j = await r.json();
  return Array.isArray(j.jobs) ? j.jobs : [];
}

async function confirmar(filaId, ok, cupomTexto, erro) {
  const r = await fetch(PAINEL + "/api/fila", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ filaId, ok, cupomTexto, erro }),
  });
  if (!r.ok) throw new Error("painel recusou a confirmacao: " + r.status);
}

// ---------------------------------------------------------------------------
// O LACO.
// ---------------------------------------------------------------------------
let falhasSeguidas = 0;

async function rodada() {
  let jobs;
  try {
    jobs = await buscarJobs();
    if (falhasSeguidas > 0) anotar("voltei a falar com o painel");
    falhasSeguidas = 0;
  } catch (e) {
    falhasSeguidas++;
    // So reclama na primeira e depois de cada dez: internet de padaria oscila,
    // e um registro por segundo esconde o que importa.
    if (falhasSeguidas === 1 || falhasSeguidas % 10 === 0) {
      anotar("sem falar com o painel (" + falhasSeguidas + "x): " + e.message);
    }
    return;
  }

  for (const job of jobs) {
    const quem = job.clienteNome || "(sem nome)";
    try {
      const cupons = cuponsDoPedido(job);
      for (const cupom of cupons) await imprimir(cupom);
      // Guarda o texto do que saiu: quando a dona reclamar que o papel veio
      // errado, da pra ver exatamente o que foi impresso, e nao o que a gente
      // acha que foi.
      await confirmar(job.filaId, true, cupons.join("\n"));
      anotar("imprimi " + cupons.length + " cupons do pedido de " + quem);
    } catch (e) {
      anotar("ERRO ao imprimir o pedido de " + quem + ": " + e.message);
      try {
        await confirmar(job.filaId, false, undefined, e.message);
      } catch (e2) {
        anotar("e nem consegui avisar o painel: " + e2.message);
      }
    }
  }
}

anotar("ponte no ar. painel: " + PAINEL + (SIMULAR ? " (SIMULANDO, nao imprime)" : " impressora: " + IMPRESSORA));
await rodada();
setInterval(rodada, INTERVALO_MS);
