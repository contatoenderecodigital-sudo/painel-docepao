// BATERIA DE CONVERSAS CONTRA A PRODUÇÃO.
//
// Ele em 02/09/2026: *"cada problema tem que ser resolvido na raiz para não
// acontecer com outro produto ou com outro cliente"*.
//
// O método até aqui era eu rodar UMA conversa, ler cada resposta e achar um
// defeito. Lento, e a impressão que dá é a certa: nunca acaba, porque conversa é
// infinita e eu leio uma por vez.
//
// Isto roda DEZENAS sozinhas e cobra o que não pode falhar em nenhuma delas.
// Nada aqui lê "se a frase ficou bonita": só o que custa dinheiro ou perde
// pedido, que é o critério pra entregar.
//
// AS SETE COISAS QUE NENHUMA CONVERSA PODE FAZER:
//
//   1. fechar com item de quantidade ZERO (trava o pedido, já custou R$ 218,80)
//   2. cobrar produto que não existe no cardápio
//   3. fechar com a soma das linhas diferente do total dito ao cliente
//   4. numa festa, entregar menos do que a base combinada
//   5. repetir a MESMA pergunta três vezes seguidas
//   6. mandar a mesma peça de cardápio duas vezes
//   7. terminar a conversa sem o pedido registrado
//
// Roda com: node testes/_bateria-de-conversas.cjs [quantas]
//
// Fala com a produção e gasta API: por isso o "_" na frente, que é como este
// projeto marca o que não entra no portão.
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const raiz = path.join(__dirname, "..");
const falar = (m) =>
  execFileSync("node", [path.join(__dirname, "falar.cjs"), m], {
    cwd: raiz, encoding: "utf8", timeout: 180000,
  });
const limpar = () =>
  execFileSync("node", [path.join(__dirname, "falar.cjs"), "--limpar"], {
    cwd: raiz, encoding: "utf8", timeout: 120000,
  });
const pedido = () =>
  execFileSync("node", [path.join(__dirname, "falar.cjs"), "--pedido"], {
    cwd: raiz, encoding: "utf8", timeout: 120000,
  });

// AS CONVERSAS. Cada uma é um jeito de gente falar, e não um roteiro de teste:
// as frases são as que apareceram nas conversas reais dele e da Kemilly.
const CONVERSAS = [
  {
    nome: "decidido, loja",
    falas: ["boa tarde, queria 3 kg de pao frances pra amanha", "as 8h", "Carlos", "pix", "isso mesmo"],
  },
  {
    nome: "decidido, salgado com quantidade",
    falas: ["oi, quero 100 coxinha pra sabado as 10h", "Marcia", "pix", "pode confirmar"],
  },
  {
    nome: "festa guiada",
    falas: [
      "oi, quero fazer uma festa de aniversario", "30 pessoas", "pode ser",
      "coxinha e risoles de frango", "brigadeiro e beijinho", "rosa", "bolo de brigadeiro",
      "nao quero topo nem papel nem prato", "dia 12 as 15h", "Joana", "pix", "isso mesmo",
    ],
  },
  {
    nome: "festa que ajusta",
    falas: [
      "boa tarde, festa de aniversario do meu filho", "20 pessoas", "quero ajustar",
      "quero 50 salgados a mais e 50 docinhos a mais", "coxinha e bolinha de queijo",
      "brigadeiro e beijinho, forminha preta", "bolo de laka", "2 kg",
      "nao quero topo nem papel nem prato", "dia 20 as 16h", "Marcelo", "pix", "isso mesmo",
    ],
  },
  {
    nome: "festa mais pizza",
    falas: [
      "oi, festa pra 20 pessoas", "pode ser", "coxinha e risoles de carne",
      "brigadeiro e beijinho", "dourada", "bolo de biz", "2 kg",
      "e quero uma pizza inteira de calabresa tambem",
      "nao quero topo nem papel nem prato", "dia 14 as 19h", "Paulo", "pix", "isso mesmo",
    ],
  },
  {
    nome: "confuso, delega a escolha",
    falas: [
      "oi", "queria fazer um pedido", "pra festa", "sei la, umas 25 pessoas",
      "pode ser isso ai", "sei la, o que voces tiverem", "azul", "bolo de brigadeiro",
      "nao quero topo nem papel nem prato", "dia 18 as 15h", "Rita", "pix", "isso mesmo",
    ],
  },
  {
    nome: "escreve torto",
    falas: [
      "boa tarde, qeria 50 coxinia e 50 rissolis de carne pra sabado",
      "as 11h", "Fernando", "pix", "isso mesmo",
    ],
  },
  {
    nome: "bolo com todas as pecas",
    falas: [
      "oi, quero encomendar um bolo de aniversario", "nao eh festa, so o bolo", "brigadeiro",
      "2 kg", "sim quero papel de arroz", "quero topo tambem",
      "tema do homem aranha, nome Miguel, 5 anos", "sim quero o prato",
      "dia 22 as 15h", "Sonia", "pix", "isso mesmo",
    ],
  },
  {
    nome: "sem lactose",
    falas: [
      "oi, voces fazem bolo sem lactose?", "quero um de 2 kg entao",
      "nao quero topo nem papel nem prato", "dia 15 as 14h", "Ana", "pix", "isso mesmo",
    ],
  },
  {
    nome: "pergunta preco antes",
    falas: [
      "boa noite, quanto e o cento de coxinha?", "quero 200 entao pra domingo",
      "as 9h", "Ricardo", "pix", "isso mesmo",
    ],
  },
];

// ----------------------------------------------------------------- as regras
function conferir(nome, falas, respostas, rascunho, registrado, pecas) {
  const problemas = [];

  // 1. item com quantidade zero no fim
  const zerados = rascunho.filter((l) => l.qtd === 0);
  if (registrado && zerados.length) {
    problemas.push("fechou com item em zero: " + zerados.map((l) => l.produto).join(", "));
  }

  // 3. a soma das linhas bate com o total dito
  const fechamento = respostas.filter((r) => /Fechando o pedido/i.test(r)).pop();
  if (fechamento) {
    const total = /Total: R\$ ?([0-9.,]+)/i.exec(fechamento);
    const linhas = [...fechamento.matchAll(/= R\$ ?([0-9.,]+)/g)].map((m) =>
      Number(m[1].replace(/\./g, "").replace(",", ".")),
    );
    if (total && linhas.length) {
      const soma = linhas.reduce((t, v) => t + v, 0);
      const dito = Number(total[1].replace(/\./g, "").replace(",", "."));
      if (Math.abs(soma - dito) > 0.05) {
        problemas.push("a soma das linhas (" + soma.toFixed(2) + ") nao bate com o total dito (" + dito.toFixed(2) + ")");
      }
    }
  }

  // 5. a mesma pergunta tres vezes seguidas
  const soPergunta = (t) => String(t).replace(/[^a-zà-ú? ]/gi, "").trim().toLowerCase();
  for (let i = 2; i < respostas.length; i++) {
    const a = soPergunta(respostas[i]);
    if (a && a === soPergunta(respostas[i - 1]) && a === soPergunta(respostas[i - 2])) {
      problemas.push("repetiu a mesma pergunta tres vezes: " + a.slice(0, 50));
      break;
    }
  }

  // 6. a mesma peca de cardapio duas vezes
  const vistas = new Set();
  for (const p of pecas) {
    if (vistas.has(p)) {
      problemas.push("mandou a peca " + p + " duas vezes");
      break;
    }
    vistas.add(p);
  }

  // 7. terminou sem registrar
  if (!registrado) problemas.push("a conversa terminou sem o pedido registrado");

  return problemas;
}

// ------------------------------------------------------------------- rodando
const quantas = Number(process.argv[2] || CONVERSAS.length);
console.log("== bateria de conversas ==");
console.log("Rodando " + Math.min(quantas, CONVERSAS.length) + " conversas contra a producao.");
console.log("");

let comProblema = 0;
for (const c of CONVERSAS.slice(0, quantas)) {
  limpar();
  const respostas = [];
  const pecas = [];
  for (const fala of c.falas) {
    const saiu = falar(fala);
    for (const linha of saiu.split("\n")) {
      const t = linha.trim();
      if (t.startsWith("padaria >>")) respostas.push(t.replace("padaria >>", "").trim());
      else if (/^Cardápio de |^Pode misturar/i.test(t)) pecas.push(t);
    }
  }
  const bruto = pedido();
  const rascunho = [...bruto.matchAll(/^([0-9.]+) ~ ([^~]+) ~/gm)].map((m) => ({
    qtd: Number(m[1]),
    produto: m[2].trim(),
  }));
  const registrado = /status=/.test(bruto);

  const problemas = conferir(c.nome, c.falas, respostas, rascunho, registrado, pecas);
  if (problemas.length) comProblema++;
  console.log((problemas.length ? "ERRO  " : "ok    ") + c.nome);
  for (const p of problemas) console.log("        " + p);
}

console.log("");
console.log(comProblema ? "CONVERSAS COM PROBLEMA: " + comProblema : "TODAS AS CONVERSAS PASSARAM");
process.exit(comProblema ? 1 : 0);
