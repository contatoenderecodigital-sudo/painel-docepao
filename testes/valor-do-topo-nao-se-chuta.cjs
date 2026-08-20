// O VALOR DO TOPO NAO SAI DA BOCA DELA. NUNCA.
//
// Teste ao vivo de 20/08/2026, com o dono prestes a abrir a tela:
//
//   cliente: e o topo do homem aranha, quanto fica?
//   Dora:    O topo de bolo tema homem aranha fica em torno de R$ 30, mas a
//            equipe vai confirmar o valor certinho antes de fechar.
//
// O topo e o UNICO item da casa sem preco de tabela: cada peca e fabricada com
// o tema, o nome e a idade do aniversariante, e quem lanca o valor e a equipe,
// na tela do painel. E exatamente por isso que existe a pendencia de topo.
//
// "Em torno de R$ 30" nao e estimativa, e ancora. O cliente le 30, a equipe
// lanca 45, e a diferenca vira discussao no balcao com a dona. Em Moffatt
// contra Air Canada o tribunal obrigou a empresa a honrar o numero que o
// chatbot inventou.
//
// A persona ja mandava nao chutar valor de topo, com essas palavras. Ela
// chutou assim mesmo. Prompt e sugestao: guarda e codigo.
//
// Roda com: node testes/valor-do-topo-nao-se-chuta.cjs
const { chutouValorDoTopo, textoSemValorDoTopo } = require("./_guardas.cjs")();

let erros = 0;
function conferir(ok, oque, detalhe) {
  console.log((ok ? "ok    " : "ERRO  ") + oque + (ok ? "" : "  ->  " + detalhe));
  if (!ok) erros++;
}

const REAL =
  "O topo de bolo tema homem aranha fica em torno de R$ 30, mas a equipe vai confirmar o valor " +
  "certinho antes de fechar. O bolo bombom é vendido por quilo, e você já falou 3 kg com pão de ló branco.";

console.log("== o caso real ==");
conferir(chutouValorDoTopo(REAL).length === 1, "pega a frase do chute", JSON.stringify(chutouValorDoTopo(REAL)));
const limpo = textoSemValorDoTopo(REAL);
conferir(!/R\$ ?30/.test(limpo), "o R$ 30 some", limpo);
conferir(limpo.includes("bolo bombom"), "o resto da resposta continua de pe", limpo);
conferir(limpo.includes("equipe"), "e entra a verdade, que a equipe confirma", limpo);

console.log("");
console.log("== os jeitos de chutar ==");
for (const frase of [
  "O topo fica R$ 25,00.",
  "O topo de bolo sai por uns R$ 40.",
  "topo de bolo: R$ 35",
  "O papel de arroz fica R$ 12 e o topo eu confirmo.",
  "O topo custa 30 reais.",
  "Fica em torno de R$ 30 o topo tema homem aranha.",
]) {
  conferir(chutouValorDoTopo(frase).length > 0, '"' + frase.slice(0, 44) + '" e pego', "o numero ia pro cliente");
}

console.log("");
console.log("== o que NAO pode ser tocado ==");
// Total de pedido e conta do motor, e a mensagem oficial da equipe vem por
// outro caminho (o painel), nao por aqui.
for (const frase of [
  "Seu pedido fica em R$ 637,30. Tá certo assim?",
  "O bolo bombom sai R$ 49,90 o quilo.",
  "Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento).",
  "O topo de bolo eu confirmo com a equipe e te aviso.",
  "Anotei o topo tema homem aranha, nome Théo, 7 anos.",
  "Quer topo de bolo e papel de arroz também?",
]) {
  conferir(
    chutouValorDoTopo(frase).length === 0 && textoSemValorDoTopo(frase) === frase,
    '"' + frase.slice(0, 44) + '" passa inteira',
    JSON.stringify(textoSemValorDoTopo(frase)),
  );
}

console.log("");
console.log("== resposta que era SO o chute nao fica vazia ==");
const soChute = textoSemValorDoTopo("O topo fica em torno de R$ 30.");
conferir(soChute.length > 20 && soChute.includes("equipe"), "sobra a frase honesta, nao o vazio", JSON.stringify(soChute));
conferir(textoSemValorDoTopo("") === "" , "texto vazio continua vazio", "inventou texto do nada");

console.log("");
console.log(erros === 0 ? "O VALOR DO TOPO SO VEM DA EQUIPE" : erros + " FALHA(S)");
process.exit(erros === 0 ? 0 : 1);
