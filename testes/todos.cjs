// RODA TODOS OS TESTES E FALHA DE VERDADE SE UM SO QUEBRAR.
//
// Em 19/08/2026 eu rodei os testes num laco de shell, um deles quebrou, a tela
// mostrou FALHOU, e o commit foi feito assim mesmo: laco de shell nao propaga a
// falha pro && seguinte. Teste que nao trava o commit nao e teste, e enfeite.
//
// Este arquivo tambem descobre os testes sozinho. Antes a lista era digitada a
// mao em cada comando, e teste novo so entrava na conta se alguem lembrasse.
//
// Roda com: node testes/todos.cjs
const { readdirSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

// O medidor fica de fora de proposito: ele roda cada cenario cinco vezes
// falando com a IA de verdade, gasta uns 25 minutos e centenas de mensagens do
// teto da OpenAI. Serve pra DECIDIR, rodando na mao quando a gente quer saber
// se melhorou. Quem trava commit e este arquivo aqui, que roda em segundos.
// Estes dois precisam de argumento (o pedido e o cliente) ou de um pedido com
// bolo na fila, entao nao servem de portao: sao ferramenta de conferir na mao,
// igual ao medidor. Deixar aqui dentro faria o portao ficar vermelho por falta
// de argumento, e portao que reprova sem defeito ensina a ignorar portao.
const FORA = [
  "todos.cjs",
  "medidor.cjs",
  "painel-visto-de-fora.cjs",
  "papel-de-arroz-segue-o-botao.cjs",
  "auditoria-do-atendimento.cjs",
  // Ferramentas sob demanda: falam com o servidor ou com a OpenAI e pedem
  // chave. Nao sao portao, sao instrumento.
  "comparar-velho-e-novo.cjs",
  "ver-os-botoes-no-celular.cjs",
  "previa-whatsapp.cjs",

  // ------------------------------------------------------------------------
  // OS QUE FALAM COM O VPS. Instrumento, nao portao.
  //
  // Estes tres abrem SSH pro servidor, mandam mensagem de verdade e leem o
  // banco de producao. Sao valiosos, e por isso mesmo nao servem de portao:
  //
  //   - dependem da rede, entao ficam vermelhos por motivo que nao e defeito
  //     no codigo, e portao que reprova sem defeito ensina a ignorar portao;
  //   - sao lentos: o `qa-concorrencia` sozinho leva mais de cem segundos;
  //   - em 26/08/2026 o `pausa-nao-vaza` prendeu o portao por mais de meia
  //     hora, e os trinta testes seguintes nunca rodaram. Duas rodadas
  //     inteiras se perderam assim antes de alguem olhar onde tinha parado.
  //
  // Rode na mao quando quiser saber do servidor:
  //   node testes/pausa-nao-vaza.cjs
  //   node testes/qa-conversa.cjs
  //   node testes/qa-concorrencia.cjs
  "pausa-nao-vaza.cjs",
  "qa-conversa.cjs",
  "qa-concorrencia.cjs",
  "guardar-conversas.cjs",

  // O `qa-pedido-completo` e o caso mais claro de todos: ele abre um navegador
  // de verdade contra https://docepao.enderecodigital.tech, faz login e CRIA
  // PEDIDO NO BANCO. Esta escrito no cabecalho dele: "limpe o banco antes e
  // depois".
  //
  // Duas razoes pra sair do portao, e a segunda e a que importa:
  //
  //   1. ele acumula estado. Passou verde com o banco limpo e ficou vermelho
  //      na rodada seguinte com fila=21 e treze resumos enviados, sem uma
  //      linha de codigo ter mudado no meio;
  //   2. ele testa o que esta NO AR, e nao o codigo desta maquina. Um teste que
  //      nao ve as minhas alteracoes nunca poderia ter aprovado nenhuma delas,
  //      e vermelho nele nunca quis dizer defeito no que eu acabei de escrever.
  //
  // Rode na mao, com o banco de teste limpo, quando quiser conferir producao:
  //   node testes/qa-pedido-completo.cjs
  "qa-pedido-completo.cjs",

  // A ferramenta mais barata daqui, e por isso mesmo nao e portao: ela fala com
  // producao e cria pedido de verdade na faixa de teste.
  //
  // Roda ANTES de gastar 25 minutos numa bateria. Em 26/08/2026 duas baterias
  // inteiras devolveram 0/5 sem dizer por que, e uma conversa unica lida no
  // banco deu a resposta em dois minutos.
  //
  //   node testes/uma-conversa-contra-o-banco.cjs
  "uma-conversa-contra-o-banco.cjs",

  // A mesma coisa, com as falas vindas de fora num .json. Medir um caminho
  // novo passa a custar tres linhas de arquivo em vez de um arquivo de codigo.
  //
  //   node testes/mede-uma-conversa.cjs caminho/das/falas.json
  "mede-uma-conversa.cjs",
];

const aqui = __dirname;
const arquivos = readdirSync(aqui)
  // Arquivo com "_" na frente e utilitario dos testes, nao teste. Sem isto o
  // portao tentaria rodar o _guardas.cjs e contaria como falha.
  .filter((f) => f.endsWith(".cjs") && !f.startsWith("_") && !FORA.includes(f))
  .sort();

console.log("Rodando " + arquivos.length + " testes.");
console.log("");

const quebrados = [];
for (const arq of arquivos) {
  const nome = arq.replace(/\.cjs$/, "");
  const comeco = process.hrtime.bigint();
  try {
    // PRAZO POR TESTE.
    //
    // Sem isto o portao nao e portao: em 26/08/2026 ele ficou preso mais de
    // meia hora no `pausa-nao-vaza`, que fala com o VPS por SSH e manda
    // mensagem de verdade. Rede caiu, o teste ficou esperando pra sempre, e os
    // outros vinte e nove nunca rodaram. Duas rodadas inteiras foram perdidas
    // assim antes de alguem olhar onde tinha parado.
    //
    // Travado agora e FALHA, e falha aparece. Dois minutos e folgado: o teste
    // mais lento daqui leva uns cinco segundos.
    execFileSync(process.execPath, [join(aqui, arq)], {
      stdio: "pipe",
      cwd: join(aqui, ".."),
      timeout: 120000,
      killSignal: "SIGKILL",
    });
    const ms = Number(process.hrtime.bigint() - comeco) / 1e6;
    console.log("ok     " + nome.padEnd(28) + Math.round(ms) + "ms");
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - comeco) / 1e6;
    // Travado e diferente de vermelho, e a diferenca importa: vermelho e um
    // defeito no codigo, travado quase sempre e a rede. Dizer qual foi poupa
    // meia hora procurando defeito onde nao tem.
    const travou = e.signal === "SIGKILL" || e.code === "ETIMEDOUT";
    console.log((travou ? "TRAVOU " : "FALHOU ") + nome.padEnd(28) + Math.round(ms) + "ms");
    quebrados.push({
      nome,
      saida: travou
        ? "TRAVOU: passou de 120s sem terminar e foi morto. Este teste fala com a rede?\n" +
          String(e.stdout ?? "")
        : String(e.stdout ?? "") + String(e.stderr ?? ""),
    });
  }
}

console.log("");
if (!quebrados.length) {
  console.log("OS " + arquivos.length + " TESTES PASSARAM");
  process.exit(0);
}

for (const q of quebrados) {
  console.log("=".repeat(70));
  console.log("FALHA EM " + q.nome);
  console.log("=".repeat(70));
  // So as linhas que interessam: o que deu ERRO e o fim da saida.
  const linhas = q.saida.split("\n");
  const ruins = linhas.filter((l) => /^ERRO|Error|SyntaxError|falha|FALHA/i.test(l));
  console.log((ruins.length ? ruins : linhas.slice(-15)).join("\n").trim());
  console.log("");
}
console.log(quebrados.length + " DE " + arquivos.length + " TESTES QUEBRADOS: " + quebrados.map((q) => q.nome).join(", "));
process.exit(1);
