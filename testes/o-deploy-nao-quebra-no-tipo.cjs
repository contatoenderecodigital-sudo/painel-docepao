// ============================================================================
//  O QUE DERRUBA O DEPLOY TEM QUE REPROVAR AQUI.
//
//  POR QUE ISTO EXISTE
//
//  Em 30/08/2026 a producao estava TRINTA COMMITS atras da main e ninguem
//  sabia. O container rodava `b034101`, de quatro horas antes, enquanto a
//  campanha inteira (pizza que nao vira salgado, pedido misturado, colisao de
//  nome, sabor obrigatorio) ja estava na main ha horas.
//
//  A fila do Coolify contava a historia: oito construcoes seguidas, todas
//  `failed`, desde as 05:20. E o motivo era uma linha:
//
//      app/(painel)/testar/page.tsx:340
//      onClick={enviar}
//      Type '(toque?: BotaoDaFala) => Promise<void>' nao encaixa em
//      MouseEventHandler<HTMLButtonElement>
//
//  O `next build` reprova o tipo e o Docker para no `npm run build`. Coolify
//  entao MANTEM o container antigo no ar, que e o certo a fazer, e a padaria
//  segue atendendo com a versao velha. Nada na tela do Coolify grita.
//
//  E o portao local passava, os 109, porque nenhum teste daqui roda o
//  `next build`. Os consertos eram de verdade; eles so nunca chegavam ao
//  cliente. Foi isso que fez o dono testar dias a fio e ver "a mesma merda".
//
//  ESTE TESTE FECHA A PORTA: roda a mesma checagem de tipo do build, sobre o
//  projeto inteiro, em uns seis segundos. Se ela reprova, o deploy vai
//  reprovar tambem, e a gente descobre aqui e nao quatro horas depois.
//
//  A ISCA, E ELA E REAL
//
//  Nao precisei plantar defeito sintetico: o commit que estava na main quando
//  este arquivo nasceu tinha o erro de verdade. Rodando este teste com a linha
//  340 de volta para `onClick={enviar}`, ele reprova apontando o arquivo e a
//  linha. Provado a mao antes de commitar.
//
//  O QUE ELE NAO E
//
//  Nao substitui o `next build`. O build faz mais coisa (bundle, rotas,
//  prerender) e pode quebrar por motivo que o tipo nao ve. Este teste pega a
//  familia que ja nos custou trinta commits parados, que e a mais comum.
//
//  Rodar:  node testes/o-deploy-nao-quebra-no-tipo.cjs
// ============================================================================

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const raiz = path.join(__dirname, "..");

let saida = "";
let reprovou = false;

try {
  saida = execFileSync("npx", ["tsc", "--noEmit"], {
    cwd: raiz,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
} catch (erro) {
  reprovou = true;
  saida = String(erro.stdout || "") + String(erro.stderr || "");
}

if (!reprovou) {
  console.log("PASSOU: a checagem de tipo do build esta limpa.");
  process.exit(0);
}

// So as linhas que nomeiam arquivo e erro, que e o que resolve o problema.
const linhas = saida
  .split(/\r?\n/)
  .filter((l) => /error TS[0-9]+/.test(l))
  .slice(0, 12);

console.log("");
console.log("REPROVOU: o tipo quebra, entao o DEPLOY VAI FALHAR.");
console.log("");
console.log("O Coolify mantem o container velho no ar quando o build falha.");
console.log("Ninguem ve erro na tela, e a padaria segue com a versao antiga.");
console.log("");
for (const l of linhas) console.log("  " + l);
console.log("");
console.log("Conserte antes de dar push, senao a main anda e a producao nao.");
process.exit(1);
