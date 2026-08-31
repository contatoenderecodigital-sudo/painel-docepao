// ============================================================================
//  O LEITOR DA FRASE — o código lê a mensagem, não só o modelo.
//
//  POR QUE ISTO EXISTE
//
//  Até 25/08/2026 quem lia a mensagem do cliente era só o modelo, e o código
//  recebia apenas o que ele tinha extraído. Duas consequências, e as duas
//  custaram pedido de verdade:
//
//  1. O QUE ELE DEIXA PASSAR, SOME. O cliente escreveu "na embalagem com
//     tampa, sem topo e sem papel de arroz" e o modelo devolveu só o prato. A
//     padaria perguntou papel de arroz duas vezes e o pedido nunca fechou.
//     Escreveu "forminha azul e amarelo" e o modelo devolveu "azul": o amarelo
//     sumiu sem ninguém avisar.
//
//  2. CADA CAMPO GANHOU UM RESGATE PRÓPRIO, DEPOIS DE QUEBRAR. `disseQuantidade`
//     para número, `coresDaForminha` para cor, `lerPecasDaFala` para topo e
//     papel. Três remendos avulsos, cada um nascido de um defeito já entregue
//     ao cliente. Isso não termina: sempre falta o campo que ninguém quebrou
//     ainda.
//
//  Este arquivo é a regra única no lugar dos remendos: UM passe sobre a frase
//  crua que preenche TODOS os campos que reconhece, sem se importar com qual
//  pergunta a padaria tinha feito. É isso que faz "o cliente respondeu três
//  coisas de uma vez" funcionar por construção, e não caso a caso.
//
//  COMO SE COMBINA COM O MODELO
//
//  A frase manda onde ela achou alguma coisa; o modelo preenche o resto. O
//  modelo continua sendo melhor em interpretar ("aquele de nozes mesmo"), e o
//  código é melhor em não deixar passar o que está escrito com todas as letras.
//
//  SEM BARRA INVERTIDA DE BORDA DE PALAVRA EM NENHUMA REGRA DESTE ARQUIVO.
//  Ela vira byte de backspace no caminho até o disco e a regra nunca casa. Já
//  custou caro três vezes neste projeto, duas delas na mesma noite. Aqui as
//  fronteiras são escritas na mão: (^|[^a-z]) e ($|[^a-z]).
// ============================================================================

import { coresDaForminha } from "./sabor";
import { afirmouOuNegou, semAcento, PALAVRAS_VAZIAS, numerosEscritos } from "../texto";
import { APELIDOS } from "../dados/apelidos";
import { produtosDaCasa, pedeEscolhaDeSabor, produtoPorNome, produtoNoComeco } from "../dados/produtos";
import { chavesDeFamilia, ehNomeDeFamilia, familiaDaCategoria, familiaDoNome, nomeDaFamilia } from "./generico";
import type { Leitura } from "./leitura";

// O mesmo normalizador de todo mundo. Era a decima segunda copia, e a unica
// diferenca era nao aparar as pontas, o que aqui nao muda nada: as posicoes que
// este arquivo guarda sao dentro do texto ja normalizado.
const semAcMin = semAcento;

/** Fronteira de palavra escrita na mão. Ver o aviso no topo do arquivo. */
const cerca = (miolo: string) => new RegExp("(^|[^a-z])(" + miolo + ")($|[^a-z])", "i");

/* -------------------------------------------------------------- sim e não */

export { afirmouOuNegou } from "../texto";

/* ---------------------------------------------------------------- produtos */

/**
 * TODO NOME DE PRODUTO DA CASA, pra achar o que o cliente escreveu.
 *
 * SAI DA LISTA UNICA. Aqui havia a leitura crua do `catalogo.json`, com a mesma
 * lista de QUATRO baldes escrita a mao que causou o buraco da pizza no
 * `produto.ts`: salgados.frito, salgados.assado, doces e outros_produtos, mais
 * os sabores de bolo de festa.
 *
 * Ficavam de fora `bolos_caseiros` e `pizza`. Medido em 28/08/2026, procurando
 * cada produto numa frase: CATORZE dos 86 nao eram achados -- doze bolos
 * caseiros e as duas pizzas.
 *
 * O estrago: `produtosNaFrase` e quem responde "ele nomeou um produto?" no
 * fluxo. Quem escrevesse "na verdade quero um bolo de cenoura" no meio do
 * docinho nao nomeava produto nenhum, e a conversa NAO ia pro bolo.
 *
 * O nome curto entra junto porque e como o cliente fala: ele diz "cenoura", nao
 * "bolo caseiro cenoura".
 */
function nomesDoCatalogo(): string[] {
  return [...new Set(produtosDaCasa().flatMap((p) => [p.nome, p.nomeCurto]))].filter(Boolean);
}

/** Distância de edição curta, só para pegar troca e falta de letra. */
function dist(x: string, y: string): number {
  if (Math.abs(x.length - y.length) > 3) return 99;
  const linha = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let ant = linha[0];
    linha[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const guarda = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, ant + (x[i - 1] === y[j - 1] ? 0 : 1));
      ant = guarda;
    }
  }
  return linha[y.length];
}

/**
 * OS PRODUTOS QUE ESTÃO ESCRITOS NA FRASE, ACEITANDO ERRO DE DIGITAÇÃO.
 *
 * "chique e coxinha" é quiche e coxinha: "chique" está a duas letras de
 * "quiche". Na conversa de 25/08 o cliente escreveu assim, depois escreveu
 * certo, e nas duas vezes só a coxinha entrou no pedido.
 *
 * A tolerância é apertada de propósito e cresce com o tamanho da palavra: em
 * nome curto, duas letras de diferença já é outro produto.
 */
export function produtosNaFrase(fala: string): string[] {
  return [...new Set(acharNaFrase(fala).map((a) => a.nome))];
}

/**
 * A FAMILIA QUE ELE NOMEOU, PELO CATALOGO.
 *
 * "voces fazem pizza de forma?" nao e sabor de bolo. O modelo, preso na etapa,
 * classifica a pergunta como a familia da vez. O codigo le o que esta escrito
 * contra a lista unica e devolve a familia larga (pizza, bolo, salgado).
 *
 * Null quando ele nao nomeou produto nem chave de familia.
 */
export function familiaDoQueEleNomeou(fala: string): string | null {
  for (const nome of produtosNaFrase(fala)) {
    const p = produtoPorNome(nome) ?? produtoNoComeco(nome);
    if (p) {
      const fam = familiaDaCategoria(p.categoria);
      if (fam) return fam;
      if (p.grupo) return p.grupo;
    }
    const daChave = familiaDoNome(nome) ?? nomeDaFamilia(nome);
    if (daChave) return daChave;
  }
  const t = semAcMin(fala);
  for (const chave of chavesDeFamilia()) {
    const alvo = semAcMin(chave);
    if (alvo && cerca(alvo).test(t)) return chave;
  }
  return null;
}

/**
 * OS PRODUTOS DA FRASE, COM O LUGAR ONDE CADA UM FOI ACHADO.
 *
 * O lugar importa por dois motivos, os dois medidos em 28/08/2026:
 *
 * 1. QUEM ACHOU POR ERRO DE DIGITACAO ERA JOGADO FORA LOGO DEPOIS. O
 *    `itensDeOutraEtapaNaFrase` reprocurava o nome CANONICO com um `indexOf`, e
 *    "coxinia" nao contem "coxinha":
 *
 *        "100 coxinia"     achou coxinha    ->  item: nenhum
 *        "100 brigadero"   achou brigadeiro ->  item: nenhum
 *
 *    A tolerancia a erro de digitacao existia e era desfeita na linha seguinte.
 *
 * 2. O SABOR DE UM VIRAVA PRODUTO DO OUTRO:
 *
 *        "50 trufa de morango"  ->  50 trufa E 50 "morango"
 *
 *    "morango" e sabor de bolo de festa, entao e produto quando dito sozinho.
 *    Colado atras de "trufa de" ele e o RECHEIO da trufa, e virava uma linha
 *    propria que o motor cotaria como bolo, a R$ 46,90 o quilo.
 */
function acharNaFrase(fala: string): { nome: string; onde: number; tamanho: number }[] {
  const t = semAcMin(fala);
  if (!t.trim()) return [];
  const palavras = t.split(/[^a-z]+/).filter((p) => p.length >= 4);
  const achados: { nome: string; onde: number; tamanho: number }[] = [];

  for (const nome of nomesDoCatalogo()) {
    const alvo = semAcMin(nome);
    if (!alvo) continue;
    // Escrito igual: não precisa de aproximação nenhuma.
    const direto = t.indexOf(alvo);
    if (direto >= 0) {
      achados.push({ nome, onde: direto, tamanho: alvo.length });
      continue;
    }
    // Apelido e corretor do celular: "chique" é o que o teclado escreve no
    // lugar de "quiche", e as duas estão a quatro letras uma da outra. Isso é
    // caso de lista, nunca de afrouxar a régua da distância.
    // O DIGITO FICA. Tirar tudo que nao e letra transformava o apelido "de 30"
    // da pizza redonda em "de ", e "de " esta em quase toda frase:
    //
    //   "50 brigadeiro, forminha rosa, e um bolo de 2 kg de 4 leites"
    //   achava  ->  brigadeiro, PIZZA REDONDA, 4 leites
    //
    // A pizza fantasma virava item guardado com quantidade zero, e a padaria
    // passava a perguntar o sabor de uma pizza que ninguem pediu. Medido em
    // 28/08/2026, e defeito anterior a esta leitura.
    //
    // Os unicos dois apelidos com digito no cardapio sao "de 30" e "30 cm", os
    // dois da pizza redonda, e eram justamente os dois destruidos.
    const semRuido = (a: string) => a.replace(/[^a-z0-9 ]/g, "");
    // APELIDO DE UMA PALAVRA CURTA NAO SERVE PRA VARRER FRASE SOLTA.
    //
    // A lista de apelidos foi escrita pra RESOLVER um nome que o cliente ja
    // disse ("ele escreveu esfiha, e isso e esfirra"). Aqui ela e usada pra
    // CACAR nome dentro de frase livre, e ai apelido que tambem e palavra da
    // lingua acha o que nao existe:
    //
    //   "meia duzia de coxinha"  ->  6 coxinha E 194 PIZZA MEIA
    //
    // Medido em 28/08/2026, na lista inteira: "meia" e o UNICO apelido de uma
    // palavra com menos de cinco letras, e e o unico que e palavra comum. Os de
    // cinco pra cima sao todos nome de produto torto ("bolha", "esfia",
    // "kiche"). A regua sai dessa medicao, e o teste cobra que nenhum apelido da
    // casa se perca por causa dela.
    //
    // E APELIDO DE DUAS PALAVRAS TAMBEM NAO SERVE, SE AS DUAS FOREM VAZIAS.
    //
    // A linha acima dizia "apelido de duas palavras passa direto: de 30, de
    // forma, pizza de metro", e essa suposicao custou o pior defeito visivel do
    // dia 30/08/2026. `"de 30"` e apelido da pizza redonda no cardapio, porque
    // ela e a de 30 cm. E "de 30" aparece em toda conversa de festa:
    //
    //   cliente >> orcamento pra festa de aniversario de 30 pessoas
    //   padaria >> Pizza redonda sai R$ 41,90 o quilo.  [cardapio de pizza]
    //
    // O primeiro contato de uma festa respondido com preco de pizza. Achado
    // conversando, e o rastro entregou na primeira linha: "achei na frase e
    // anotei: pizza redonda". Nao foi a IA: foi este `find`.
    //
    // A regua certa nao e o numero de palavras, e sim se sobra alguma palavra
    // que APONTE alguma coisa. "de 30" e preposicao mais numero: nao aponta
    // nada. "30 cm" tem "cm", "de forma" tem "forma", "pizza de metro" tem
    // duas: essas continuam cacando, e o teste cobra isso.
    const apontaAlgo = (a: string) =>
      a.split(/\s+/).some((w) => w && !PALAVRAS_VAZIAS.has(w) && !/^\d+$/.test(w));
    const serveParaCacar = (a: string) => apontaAlgo(a) && (a.includes(" ") || a.length >= 5);
    const apelidos = (APELIDOS[nome] ?? APELIDOS[alvo] ?? []).map(semAcMin).filter(serveParaCacar);
    const apelido = apelidos.find((a) => cerca(semRuido(a)).test(t));
    if (apelido) {
      const onde = t.indexOf(apelido);
      achados.push({ nome, onde: onde >= 0 ? onde : 0, tamanho: apelido.length });
      continue;
    }
    // Nome de uma palavra só é o que dá para comparar por distância com
    // segurança. "pastel assado" tem que estar escrito.
    if (alvo.includes(" ")) continue;
    const folga = alvo.length >= 7 ? 2 : 1;
    // A PRIMEIRA LETRA TEM QUE BATER.
    //
    // Sem isso, duas letras de folga num nome de sete inventavam produto:
    //
    //   "100 quiche de FRANGO"  ->  produtos na frase: quiche, MORANGO
    //
    // "frango" e "morango" estão a exatamente duas letras, e "morango" tem
    // sete. Medido em 27/08/2026.
    //
    // O morango fantasma não virava item (o `indexOf` mais abaixo o descarta),
    // mas fazia `nomeouProduto` valer no fluxo, e isso derruba a regra de que
    // SABOR SOLTO NÃO É ASSUNTO NOVO: quem responde "de frango" à pergunta do
    // sabor passava a "ter nomeado um produto" e a conversa saía da etapa.
    //
    // Erro de digitação quase nunca começa noutra letra: "brigadero",
    // "coxinia" e "beijino" mantêm a inicial. Trocar a primeira letra é outro
    // produto, não o mesmo escrito torto.
    const parecida = palavras.find((p) => p[0] === alvo[0] && dist(p, alvo) <= folga);
    if (parecida) {
      const onde = t.indexOf(parecida);
      achados.push({ nome, onde: onde >= 0 ? onde : 0, tamanho: parecida.length });
    }
  }

  // DOIS NOMES NO MESMO PEDACO DA FRASE SAO UM PRODUTO SO, E VENCE O MAIOR.
  //
  // "pizza" e familia, "pizza redonda" e produto. Na frase "quero uma pizza
  // redonda" os dois casam, e os DOIS viravam item (e a inteira ainda virava
  // uma terceira linha quando "uma pizza" era apelido de pizza inteira).
  //
  // O maior ganha: quem escreveu "pizza redonda" disse mais do que "pizza".
  // "quero uma pizza" sozinho fica familia, e a padaria pergunta forma, meia
  // ou redonda, em vez de cotar R$ 120 calada.

  for (const chave of chavesDeFamilia()) {
    const alvo = semAcMin(chave);
    if (!alvo) continue;
    const m = cerca(alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).exec(t);
    if (!m) continue;
    const onde = t.indexOf(alvo);
    achados.push({ nome: chave, onde: onde >= 0 ? onde : 0, tamanho: alvo.length });
  }

  const porTamanho = [...achados].sort((a, b) => b.tamanho - a.tamanho || a.onde - b.onde);
  const ficam: typeof achados = [];
  for (const c of porTamanho) {
    const pisa = ficam.some((f) => c.onde < f.onde + f.tamanho && f.onde < c.onde + c.tamanho);
    if (!pisa) ficam.push(c);
  }
  const familias = new Set(chavesDeFamilia().map((k) => semAcMin(k)));
  return ficam
    .filter((c) => {
      if (!familias.has(semAcMin(c.nome))) return true;
      return !ficam.some((p) => {
        if (p === c || familias.has(semAcMin(p.nome))) return false;
        if (p.onde <= c.onde) return false;
        const entre = t.slice(c.onde + c.tamanho, p.onde);
        return /^ *(de|da|do)? *$/.test(entre);
      });
    })
    .sort((a, b) => a.onde - b.onde);
}

/* ------------------------------------------------------------------ dados */

const PAGAMENTOS: [RegExp, string][] = [
  [cerca("pix"), "pix"],
  [cerca("cartao|credito|debito|maquininha"), "cartao"],
  [cerca("dinheiro|especie|a vista"), "dinheiro"],
  [cerca("boleto|faturado"), "boleto"],
];

/**
 * A HORA DENTRO DA FRASE INTEIRA. Devolve "HH:MM".
 *
 * Aqui um numero solto NAO e hora: "50 brigadeiro" e quantidade. Por isso a
 * regra exige o separador (`:`, `h`, `hs`, `horas`) -- ao contrario do
 * `horaDaRetirada`, em lib/tipos.ts, que arruma um campo que ja E a hora.
 *
 * O PERIODO DO DIA FAZ PARTE DA HORA, E ESTAVA FALTANDO.
 *
 * O comentario desta funcao sempre prometeu entender "as 9 da manha". Ela nao
 * entendia: sem `h` nem `:` depois do 9, a regra nao casava e devolvia null.
 * A padaria perguntava a hora de novo pra quem ja tinha respondido.
 *
 * E o pior caso nao era esse. "as 8 da noite" casava pelo caminho velho e
 * virava 08:00 -- doze horas antes, num pedido que a cozinha produz por hora
 * marcada. Em portugues, tarde e noite antes das 12 somam 12; "12 da noite" e
 * meia-noite e "12 da manha" e meio-dia. Isso e lingua, nao regra da casa.
 *
 * Achado na leitura da camada de banco, 28/08/2026.
 */
function horaNaFrase(t: string): string | null {
  const m =
    /(^|[^0-9])([01]?[0-9]|2[0-3])\s*(?::|h|hs|horas?)\s*([0-5][0-9])?(?![0-9])/.exec(t) ?? null;

  // "9 da manha", "8 da noite": sem separador nenhum, so o periodo depois.
  const semSeparador = m
    ? null
    : /(^|[^0-9])([01]?[0-9]|2[0-3])\s*(?:da|de|na|a)?\s*(manha|manhã|tarde|noite)(?![a-z])/i.exec(t);

  const achado = m ?? semSeparador;
  if (!achado) return null;

  let h = Number(achado[2]);
  const min = m && m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || h > 23 || min > 59) return null;

  // O periodo pode vir depois da hora com separador tambem ("8h da noite"), e
  // ai ele manda: quem diz "8 da noite" nao quer as oito da manha.
  //
  // A JANELA E CURTA DE PROPOSITO. Procurar a palavra na frase toda faz "as 8h,
  // boa noite" virar 20:00: a despedida no fim da mensagem mudaria a hora do
  // pedido. So vale o periodo grudado na hora.
  //
  // No caminho SEM separador a palavra ja faz parte do que casou ("9 da
  // manha"), entao ela vem do proprio grupo -- procurar depois dela nao acharia
  // nada.
  const fim = achado.index + achado[0].length;
  const logoDepois = t.slice(fim, fim + 16);
  const periodo = semSeparador
    ? String(achado[3] ?? "").toLowerCase()
    : /^[\s,]*(?:da|de|na|a|do)?[\s]*(manha|manhã|tarde|noite)/i.exec(logoDepois)?.[1]?.toLowerCase();
  if (periodo === "tarde" || periodo === "noite") {
    if (h < 12) h += 12;
    // "12 da noite" e meia-noite, nao meio-dia.
    else if (h === 12 && periodo === "noite") h = 0;
  } else if (periodo === "manha" || periodo === "manhã") {
    // "12 da manha" e meio-dia; so a meia-noite muda de nome.
    if (h === 24) h = 0;
  }

  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

/** "dia 02/09", "02/09/2026", "dia 2", "sexta". Devolve cru, para dataDeRetirada tratar. */
function dataNaFrase(t: string): string | null {
  const comBarra = /(^|[^0-9])([0-3]?[0-9])\s*\/\s*([01]?[0-9])(\s*\/\s*(\d{2,4}))?/.exec(t);
  if (comBarra) {
    return comBarra[2] + "/" + comBarra[3] + (comBarra[5] ? "/" + comBarra[5] : "");
  }
  const soDia = /(^|[^a-z0-9])dia\s+([0-3]?[0-9])($|[^0-9\/])/.exec(t);
  if (soDia) return soDia[2];
  // Dia da semana e do mundo, nao da padaria. Sem isto, "sexta as 16h, nome
  // Marina, pix" chegava com hora e nome e SEM data, e a padaria perguntava o
  // dia de novo. dataDeRetirada ja vira o nome na proxima sexta.
  const diaSemana =
    /(^|[^a-z0-9])(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira)?([^a-z0-9]|$)/.exec(t);
  return diaSemana ? diaSemana[2] + (diaSemana[3] || "") : null;
}

/** "nome Ana Prass", "em nome de Ana", "no nome da Ana". */
function nomeNaFrase(bruto: string): string | null {
  const m =
    /(?:em\s+nome\s+d[eoa]s?|no\s+nome\s+d[eoa]s?|nome\s+d[eoa]s?|nome)\s*:?\s+([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,3})/i.exec(
      bruto,
    );
  if (!m) return null;
  const nome = m[1].trim();
  // "nome do aniversariante" e afins não são o nome de quem retira.
  if (/^(do|da|de|dele|dela|completo|certo)$/i.test(nome.split(/\s+/)[0])) return null;
  return nome;
}

/* --------------------------------------------------------------- o leitor */

/**
 * Lê a frase e devolve tudo o que ela diz, sem ligar para a etapa em que a
 * conversa está. O que não estiver escrito volta ausente, nunca chutado.
 */
export function lerAFrase(fala: string): Leitura {
  const bruto = String(fala || "");
  const t = semAcMin(bruto);
  const l: Leitura = {};
  if (!t.trim()) return l;

  // --- topo e papel de arroz, cada um com a sua negação
  //
  // "papel" sozinho conta. Quem responde uma pergunta que acabou de dizer
  // "papel de arroz" escreve só "sem papel", e antes isso não era lido: a
  // resposta caía no vazio e a padaria perguntava de novo.
  let topo = afirmouOuNegou(t, /topo/);
  let papel = afirmouOuNegou(t, /papel( de arroz)?/);

  // "SO O PAPEL DE ARROZ" RESPONDE OS DOIS: sim pra um, NAO pro outro.
  //
  // Quem escreve "so" esta excluindo o resto, e isso e resposta completa. Antes
  // "aberto, so o papel de arroz" devolvia null nos dois, e a padaria perguntava
  // de novo uma coisa que ele ja tinha respondido com todas as letras.
  //
  // So vale quando o OUTRO nao foi citado: "so o papel, e o topo tambem" nao e
  // exclusao, e ai cada um responde por si.
  const soO = /(^|[^a-z])(so|somente|apenas) (o |a )?/;
  if (soO.test(t)) {
    const citouTopo = /topo/.test(t);
    const citouPapel = /papel/.test(t);
    if (citouPapel && !citouTopo) {
      papel = papel ?? true;
      topo = false;
    } else if (citouTopo && !citouPapel) {
      topo = topo ?? true;
      papel = false;
    }
  }

  if (topo != null || papel != null) {
    l.pecas = {};
    if (topo != null) l.pecas.topo = topo;
    if (papel != null) l.pecas.papelDeArroz = papel;
  }

  // A RESPOSTA QUE VALE PELOS DOIS DE UMA VEZ.
  //
  // Quem mandou o pedido inteiro numa mensagem recebe os três detalhes do bolo
  // numa pergunta só (decisão do dono, 26/08/2026), e responde do jeito que
  // gente responde pergunta juntada: "quero os dois", "sem nada disso",
  // "nenhum dos dois".
  //
  // Sem isto a pergunta juntada não adiantaria nada: ela sairia de uma vez e a
  // resposta cairia no vazio, e a padaria voltaria a perguntar uma por uma.
  //
  // Só vale quando NENHUM dos dois foi dito pelo nome: quem escreveu "com papel
  // de arroz e sem topo" já respondeu, e "os dois" ali seria outra coisa.
  if (topo == null && papel == null) {
    // A RECUSA VEM PRIMEIRO, e "dois" sozinho não vale.
    //
    // Duas armadilhas medidas em 26/08/2026, na hora de escrever isto:
    //
    //   "nenhum dos dois"   contém "dois" e virava SIM pros dois;
    //   "quero dois bolos"  virava topo e papel de arroz num pedido que só
    //                       falava de quantidade de bolo.
    //
    // A segunda é a cara: uma resposta de quantidade acrescentando dois
    // adicionais que ninguém pediu, um deles com preço de tabela.
    //
    // Então a negação é testada antes, e o "sim" exige "OS dois" ou "ambos".
    const nenhum =
      /(^|[^a-z])nenhum( dos dois)?([^a-z]|$)/.test(t) ||
      /(^|[^a-z])(nada disso|nada dos dois)([^a-z]|$)/.test(t) ||
      /(^|[^a-z])(sem|nao quero) (os dois|ambos)([^a-z]|$)/.test(t);
    const osDois =
      !nenhum &&
      (/(^|[^a-z])(os dois|as duas|ambos|ambas)([^a-z]|$)/.test(t) ||
        /(^|[^a-z])(quero|pode ser|bota|poe|coloca) os dois([^a-z]|$)/.test(t));
    if (osDois || nenhum) l.pecas = { topo: osDois, papelDeArroz: osDois };
  }

  // --- prato do bolo
  if (cerca("tampa|fechad[ao]|com tampa").test(t)) l.prato = "tampa";
  else if (cerca("mdf|aberto|abert[ao]").test(t)) l.prato = "aberto";

  // --- cores da forminha, TODAS as que ele disse
  const cores = coresDaForminha(bruto);
  if (cores.length) l.forminha = cores.join(" e ");

  // --- quantas pessoas
  const pessoas = /(^|[^0-9])(\d{1,3})\s*\+?\s*(pessoas?|convidados?|gente)/.exec(t);
  if (pessoas) {
    const n = Number(pessoas[2]);
    if (n > 0 && n < 1000) {
      l.pessoas = n;
      l.ehFesta = true;
    }
  }

  // --- data, hora, nome e pagamento
  const dados: { nome?: string; data?: string; hora?: string; pagamento?: string } = {};
  const data = dataNaFrase(t);
  if (data) dados.data = data;
  const hora = horaNaFrase(t);
  if (hora) dados.hora = hora;
  const nome = nomeNaFrase(bruto);
  if (nome) dados.nome = nome;
  // A FORMA DE PAGAMENTO E A ULTIMA QUE O CLIENTE FALOU.
  //
  // Isto era um `break` no primeiro que casasse, e o primeiro da lista e o pix.
  // Entao "pago no pix, na verdade no cartao" virava PIX, e "no cartao mesmo,
  // esquece o pix" tambem virava pix.
  //
  // O defeito ja foi pra producao uma vez, em 19/08/2026: o cliente nunca falou
  // pix, a padaria anotou pix, ele corrigiu pra cartao, ouviu "anotei que o
  // pagamento sera no cartao" e o pedido fechou com pix.
  //
  // O cerebro antigo tinha guarda pra isso e o fluxo nao tinha. Achado em
  // 26/08/2026, no levantamento feito antes de apagar o antigo.
  //
  // Agora ganha quem aparece por ULTIMO na frase, que e a correcao dele.
  //
  // MAS FORMA NEGADA NAO CONTA. "no cartao mesmo, esquece o pix" termina em pix
  // e mesmo assim o cliente quer cartao: quem vem depois de "esquece", "nao e"
  // ou "sem" esta sendo DESCARTADO, nao escolhido.
  //
  // Sem esta parte, o "ultimo ganha" acerta a correcao normal e erra a
  // correcao por negacao, que e igual de comum no WhatsApp.
  const negadoAntes = (onde: number) =>
    /(esquece|esquec\w*|nao e|nao vai ser|nao sera|nada de|sem|deixa o|tira o|cancela o)\s+[a-z ]{0,10}$/.test(
      t.slice(Math.max(0, onde - 26), onde),
    );

  let ondeEstaOPagamento = -1;
  for (const [re, forma] of PAGAMENTOS) {
    // `cerca` monta a regex sem estado global, entao procurar a ultima ocorrencia
    // e varrer o que sobra depois de cada casamento.
    let de = 0;
    let ultima = -1;
    for (;;) {
      const pedaco = t.slice(de);
      const m = re.exec(pedaco);
      if (!m) break;
      const onde = de + (m.index ?? 0);
      if (!negadoAntes(onde)) ultima = onde;
      de = onde + Math.max(1, m[0].length);
    }
    if (ultima > ondeEstaOPagamento) {
      ondeEstaOPagamento = ultima;
      dados.pagamento = forma;
    }
  }
  if (Object.keys(dados).length) l.dados = dados;

  return l;
}

/**
 * O QUE O MODELO MANDOU, COMPLETADO PELO QUE ESTÁ ESCRITO NA FRASE.
 *
 * A frase manda onde ela achou alguma coisa. O modelo continua valendo para o
 * que ela não alcança: "aquele de nozes mesmo" só ele entende.
 *
 * Item é o único campo que se soma em vez de substituir: se o cliente nomeou um
 * produto do cardápio e o modelo não mandou, ele ENTRA. É o caso do quiche, que
 * foi pedido três vezes e nunca chegou ao pedido.
 */
export function juntarComAFrase(doModelo: Leitura, fala: string): Leitura {
  const daFrase = lerAFrase(fala);
  const junto: Leitura = { ...doModelo };

  // O LEITOR COMPLETA O MODELO. NÃO O DESMENTE.
  //
  // Aqui a frase vinha POR CIMA, e o motivo era bom: o modelo lê "sem topo e sem
  // papel de arroz" e devolve só o topo, e a frase via os dois.
  //
  // Mas por cima quer dizer que uma regex minha pode APAGAR uma leitura certa
  // do modelo, e isso aconteceu em 26/08/2026, na hora de escrever a resposta
  // da pergunta juntada: minha regra procurava a palavra "dois" e lia
  // "nenhum dos dois" como SIM pros dois. Se o modelo tivesse lido certo, e ele
  // lê essa frase certo, a minha regra apagaria a resposta dele e o cliente
  // levaria um papel de arroz de R$ 12 que recusou com todas as letras.
  //
  // Completar preserva o motivo original inteiro (o que o modelo não disse, a
  // frase acrescenta) e tira o risco: o que ele DISSE fica de pé. Quando os dois
  // discordam, quem ganha é quem leu a frase inteira com contexto, que é o
  // modelo; a regex só enxerga a palavra.
  if (daFrase.pecas || doModelo.pecas) {
    junto.pecas = {
      ...(daFrase.pecas ?? {}),
      ...(doModelo.pecas ?? {}),
    };
  }
  if (daFrase.prato) junto.prato = daFrase.prato;
  if (daFrase.forminha) junto.forminha = daFrase.forminha;
  if (daFrase.pessoas) {
    junto.pessoas = daFrase.pessoas;
    junto.ehFesta = true;
  }
  if (daFrase.dados) junto.dados = { ...(doModelo.dados ?? {}), ...daFrase.dados };

  // A QUANTIDADE ESCRITA NA FRASE NAO PODE SUMIR QUANDO O MODELO DISTRAI.
  //
  // "na verdade muda a coxinha pra 100": o numero vem DEPOIS do nome, e o
  // modelo na etapa da oferta largava a correcao. O leitor ja achava o 100 em
  // `itensDeOutraEtapaNaFrase`, mas so quando o produto era de OUTRA etapa.
  // Coxinha na etapa do salgado era pulada, e a quantidade nova morria.
  //
  // Completar, nao desmentir: se o modelo ja mandou quantidade, ela fica.
  const daFraseItens = itensNaFrase(fala);
  if (daFraseItens.length) {
    const atuais = [...(junto.itens ?? [])];
    const mesmo = (a: string, b: string) => semAcMin(a) === semAcMin(b);
    for (const i of daFraseItens) {
      const achou = atuais.findIndex((x) => mesmo(x.produto, i.produto));
      // PALAVRA QUE JA E SABOR DE UM ITEM DESTA LEITURA NAO VIRA ITEM NOVO.
      //
      // Medido em 31/08/2026, num pedido banal:
      //
      //   cliente >> quero 50 docinhos de morango
      //   modelo  >> 50x docinho [morango]
      //   frase   >> tambem achou "morango" e virou um item
      //   pedido  >> 50x docinho (morango)  E  50x bolo
      //
      // "morango" e sabor de docinho e nome de bolo de festa ao mesmo tempo: e
      // uma das oito palavras do cardapio que sao produto E sabor. O cliente
      // pediu UM item e o pedido ficava com dois, e a padaria ainda perguntava
      // qual bolo ele queria.
      //
      // Este leitor existe pra COMPLETAR o modelo, e nao pra duplicar o que ele
      // ja leu: se a palavra ja tem dono na mesma leitura, ela nao esta sobrando.
      const jaESaborDeOutro =
        achou < 0 &&
        atuais.some((x) => semAcMin(String(x.sabor ?? "") + " " + String(x.obs ?? ""))
          .includes(semAcMin(i.produto)));
      if (jaESaborDeOutro) continue;
      if (achou < 0) {
        atuais.push({ produto: i.produto, qtd: i.qtd, obs: i.obs ?? null });
      } else if (i.qtd > 0) {
        atuais[achou] = { ...atuais[achou], qtd: i.qtd };
      }
    }
    if (atuais.length) junto.itens = atuais;
  }

  return junto;
}

/* --------------------------------------------------------------- recheio */

/**
 * OS SABORES QUE A CASA FAZ, de TODOS os produtos.
 *
 * Era outra leitura crua, e so dos salgados. Medido em 28/08/2026:
 *
 *   "100 quiche de frango"   ->  obs: frango     (salgado, achava)
 *   "2 cuca de chocolate"    ->  sem obs         (cuca nao estava na lista)
 *
 * A cuca tem sete sabores, a trufa nove, o franciscano oito, a pizza trinta e
 * um. Nenhum deles chegava aqui, entao o sabor colado no nome se perdia e a
 * padaria perguntava de novo o que o cliente ja tinha escrito.
 */
function recheiosDoCatalogo(): string[] {
  return [...new Set(produtosDaCasa().flatMap((p) => p.sabores))].filter(Boolean);
}

function pedeSaborAberto(nome: string): boolean {
  const n = semAcMin(nome);
  const p = produtosDaCasa().find((x) => semAcMin(x.nome) === n || semAcMin(x.nomeCurto) === n);
  return pedeEscolhaDeSabor(p);
}

/**
 * O ITEM DE OUTRA ETAPA QUE ESTA ESCRITO NA FRASE E O MODELO NAO DEVOLVEU.
 *
 * Medido em 25/08/2026: o cliente escreveu "50 brigadeiro, forminha rosa, e um
 * bolo de 2 kg de 4 leites" e recebeu de volta "E o bolo, qual sabor?". O
 * brigadeiro entrou, o bolo nao: a instrucao daquela etapa nao fala de sabor de
 * bolo, entao o modelo simplesmente nao extraiu. A padaria perguntou o sabor
 * duas vezes e o pedido nunca fechou.
 *
 * Guardar item barrado nao resolvia esse caso: para ser barrado ele precisa ter
 * sido LIDO, e ele nunca foi.
 *
 * SO devolve o que pertence a OUTRA etapa, de proposito. O que e da etapa de
 * agora e assunto do modelo, que le com o contexto todo; aqui o codigo so
 * impede que o que ele nao tinha como ler seja perdido.
 */
export function itensDeOutraEtapaNaFrase(
  fala: string,
  daEtapaDeAgora: (produto: string) => boolean,
): { produto: string; qtd: number; obs?: string }[] {
  return itensNaFrase(fala).filter((i) => !daEtapaDeAgora(i.produto));
}

/**
 * OS PRODUTOS DA FRASE, COM A QUANTIDADE QUE ELE ESCREVEU.
 *
 * Numero antes do nome ("50 brigadeiro") e numero depois ("muda a coxinha pra
 * 100"). Os dois. Sem numero fica zero, que e resposta da festa.
 */
/**
 * "UMA TORTA" E UMA TORTA. O leitor so enxergava digito.
 *
 * Medido em 30/08/2026: `"quero uma torta fria"` devolvia qtd 0, e o pedido
 * chegava no fechamento com uma linha de quantidade zero, que o motor cota por
 * R$ 0,00. O mesmo valia pra "um bolo", "dois cupcakes", "meia duzia".
 *
 * So troca o que vem ANTES do nome do produto, que e onde a quantidade mora.
 * "uma" solta no meio de uma frase nao vira 1 em lugar nenhum.
 *
 * SEM BARRA INVERTIDA DE BORDA, como manda o aviso do topo deste arquivo: as
 * fronteiras sao (^|[^a-z]) e ($|[^a-z]), escritas na mao.
 */

function numeroPorExtenso(t: string): string {
  let saida = t;
  // COM o "um/uma": aqui a palavra vem colada no nome do produto, entao "uma
  // torta fria" e uma torta fria. Ver o porque no `numerosEscritos`.
  for (const [palavra, numero] of numerosEscritos({ umEUma: true })) {
    saida = saida.replace(
      new RegExp("(^|[^a-z])" + palavra + "($|[^a-z])", "gi"),
      (_m, a: string, b: string) => a + String(numero) + b,
    );
  }
  return saida;
}

export function itensNaFrase(fala: string): { produto: string; qtd: number; obs?: string }[] {
  const t = semAcMin(fala);
  if (!t.trim()) return [];

  const achados: { produto: string; qtd: number; obs?: string }[] = [];
  // Onde termina o que ja foi consumido como RECHEIO de um produto anterior. O
  // que cair dentro disso e sabor, e nao um item novo.
  let fimDoRecheioAnterior = -1;
  // Numero que JA E O NOME do produto anterior nao e quantidade do proximo.
  //
  // "4 leites e biz": o 4 e o nome do bolo. Sem isto o biz ganhava qtd 4, e o
  // bolo misto da festa saia com 4 kg no lugar dos 2 da proposta. Medido no
  // conserto do rateio da festa, 30/08/2026.
  const jaUsado: [number, number][] = [];

  for (const { nome, onde, tamanho } of acharNaFrase(fala)) {
    // NOME DE FAMILIA DA FESTA NAO E ITEM GUARDADO.
    //
    // "nao quero docinho, so salgado e bolo" fala das tres pernas da proposta,
    // nao pede um produto. Pizza fica: ela nao tem etapa, e "quero uma pizza"
    // precisa entrar como familia pra padaria perguntar forma, meia ou redonda.
    if (ehNomeDeFamilia(nome) && semAcMin(nome) !== "pizza") continue;
    // "50 trufa de morango": o morango esta dentro do recheio da trufa.
    if (onde < fimDoRecheioAnterior) continue;

    // NEGACAO MANDA. "sem coxinha" nao e pedido de coxinha, e adivinhar aqui
    // colocaria no pedido o que ele acabou de recusar.
    const inicioAntes = Math.max(0, onde - 24);
    const antes = numeroPorExtenso(t.slice(inicioAntes, onde));
    if (/(^|[^a-z])(sem|nao|nem|tirar?|tira)([^a-z][^.,;]*)?$/.test(antes)) continue;

    // A quantidade e o numero mais perto ANTES do nome. "2 kg de 4 leites" da
    // 2; "50 brigadeiro" da 50. Sem numero fica 0, e quem preenche depois e a
    // proposta da festa ou a pergunta da padaria.
    //
    // O 4 de "4 leites" nao conta pro biz: ele ja foi o nome do bolo.
    const nums = [...antes.matchAll(/([0-9]+(?:[.,][0-9]+)?)/g)].filter((m) => {
      const pos = inicioAntes + (m.index ?? 0);
      return !jaUsado.some(([a, b]) => pos >= a && pos < b);
    });
    const ultimo = nums.length ? nums[nums.length - 1][1] : null;
    let qtd = ultimo ? Number(ultimo.replace(",", ".")) : 0;

    // E O NUMERO QUE VEM DEPOIS DO NOME, QUE E COMO SE CORRIGE UM PEDIDO.
    //
    // Ninguem corrige dizendo "100 coxinha" de novo. Corrige assim:
    //
    //     "na verdade muda a coxinha pra 100"
    //     "aumenta a coxinha pra 300"
    //     "coxinha 150"
    //
    // Nos tres o numero vem DEPOIS, e o leitor devolvia zero. Medido em
    // 27/08/2026, e o estrago foi medido na bateria antes disso: o cenario
    // "mudando de ideia no meio" reprovou nas cinco execucoes, com a coxinha
    // ficando em 200 quando o cliente tinha mandado 100. O modelo, ocupado com a
    // pergunta da etapa, larga a correcao, e o leitor existe justamente pra
    // segurar o que ele larga.
    //
    // "PIZZA DE 30 CM" NAO E TRINTA PIZZAS.
    //
    // O numero de depois so vale quando NAO e medida. Unidade de medida e do
    // mundo, e nao da padaria: cm, kg, g, ml, l, litro. Esta e uma das tres
    // listas que o CLAUDE.md permite, junto com dia da semana e mes.
    if (!qtd) {
      const depois = t.slice(onde + tamanho, onde + tamanho + 24);
      const m = depois.match(/^[^0-9]{0,12}?([0-9]+(?:[.,][0-9]+)?)\s*([a-z]*)/);
      const medida = /^(cm|mm|m|kg|g|gr|gramas?|ml|l|litros?|horas?|h|anos?|reais?)$/.test(m?.[2] ?? "");
      if (m && !medida) qtd = Number(m[1].replace(",", "."));
    }

    // O RECHEIO VEM COLADO NO NOME, E TEM QUE VIR JUNTO.
    //
    // "100 quiche de frango" achava o quiche e deixava o frango pra tras. Isso
    // nao doia enquanto o item ficava GUARDADO, porque quem entrava de verdade
    // era a leitura do modelo, que trazia o recheio. Quando o item passou a
    // entrar direto, em 26/08/2026, ele passou por cima da leitura do modelo e
    // o quiche ficou sem sabor: a padaria perguntou "o quiche vai de que?" pra
    // quem tinha escrito "quiche de frango" na primeira mensagem.
    //
    // Aqui o recheio sai da MESMA lista do cardapio que o resto do sistema usa,
    // e so vale colado no nome: "quiche de frango, e esfirra de carne" da
    // frango pro quiche e carne pra esfirra, e nao os dois pros dois.
    // O tamanho e o do que CASOU na frase, e nao o do nome canonico: quem
    // escreveu "coxinia" tem sete letras ali, e cortar por "coxinha" moveria o
    // resto da frase de lugar.
    const cru = t.slice(onde + tamanho);
    const tinhaLigacao = /^ *(de|da|do|com) +/.test(cru);
    const semLigacao = cru.replace(/^ *(de|da|do|com) +/, "");
    const ateOProximo = semLigacao.split(/[,;]| e (?=[a-z])/)[0] ?? "";
    const recheio = recheiosDoCatalogo().find((r) => {
      const rr = semAcMin(r);
      return rr && (ateOProximo === rr || ateOProximo.startsWith(rr + " ") || ateOProximo.startsWith(rr));
    });
    // SABOR FORA DO CARDAPIO NAO SOME.
    //
    // A dona: "se o cliente pedir outro sabor, a gente vai colocando". Pra
    // colocando, a equipe PRECISA VER o que ele falou. O casamento acima so
    // pega sabor da lista; "esfirra de pistache" ficava esfirra SEM recado, e
    // a insistencia depois tambem nao grudava (so olha a lista da casa).
    //
    // So vale colado com de/da/do/com, igual ao recheio da casa: "50 esfirra
    // pra sabado" nao e sabor. E nao vira sabor de catalogo: vai como recado.
    let recado: string | undefined;
    if (recheio) {
      // Tudo ate o fim do recheio ja tem dono.
      fimDoRecheioAnterior = onde + tamanho + (cru.length - semLigacao.length) + semAcMin(recheio).length;
    } else if (tinhaLigacao && pedeSaborAberto(nome)) {
      const resto = ateOProximo.trim();
      if (resto) {
        recado = resto;
        fimDoRecheioAnterior = onde + tamanho + (cru.length - semLigacao.length) + resto.length;
      }
    }

    achados.push({
      produto: nome,
      qtd: qtd > 0 && qtd <= 5000 ? qtd : 0,
      ...(recheio ? { obs: recheio } : recado ? { obs: recado } : {}),
    });
    jaUsado.push([onde, onde + tamanho]);
  }
  return achados;
}
