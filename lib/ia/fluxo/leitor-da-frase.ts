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

import catalogo from "../dados/catalogo.json";
import { coresDaForminha } from "./sabor";
import { APELIDOS } from "../dados/apelidos";
import type { Leitura } from "./leitura";

const semAcMin = (t: string) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Fronteira de palavra escrita na mão. Ver o aviso no topo do arquivo. */
const cerca = (miolo: string) => new RegExp("(^|[^a-z])(" + miolo + ")($|[^a-z])", "i");

/* -------------------------------------------------------------- sim e não */

/**
 * O termo apareceu na frase, e ele estava afirmando ou negando?
 *
 * Olha o pedaço da frase ANTES do termo, curto de propósito: um "sem" lá no
 * começo não pode negar uma coisa citada no fim.
 */
function afirmouOuNegou(t: string, termo: RegExp): boolean | null {
  const m = termo.exec(t);
  if (m == null) return null;
  const antes = t.slice(Math.max(0, m.index - 22), m.index);
  if (/(^|[^a-z])(sem|nao|nem)([^a-z][^.,;]*)?$/.test(antes)) return false;
  if (/(^|[^a-z])(com|quero|vai com|pode por|poe|bota|sim)([^a-z][^.,;]*)?$/.test(antes)) return true;
  return null;
}

/* ---------------------------------------------------------------- produtos */

/** Todo nome de produto do cardápio, para achar o que o cliente escreveu. */
function nomesDoCatalogo(): string[] {
  const c = catalogo as unknown as Record<string, unknown>;
  const de = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String((x as { nome?: string })?.nome ?? "")).filter(Boolean) : [];
  const salgados = c.salgados as { frito?: { itens?: unknown }; assado?: { itens?: unknown } } | undefined;
  // Os sabores de bolo entram aqui tambem. Sem eles "4 leites" nao era achado
  // em frase nenhuma, e o bolo citado junto com o docinho se perdia: o cliente
  // escrevia "50 brigadeiro e um bolo de 2 kg de 4 leites" e ouvia de volta "e
  // o bolo, qual sabor?".
  const sabores = ((c.bolos_recheados as { faixas?: { sabores?: string[] }[] } | undefined)?.faixas ?? [])
    .flatMap((faixa) => faixa.sabores ?? [])
    .map(String);

  return [
    ...de(salgados?.frito?.itens),
    ...de(salgados?.assado?.itens),
    ...de((c.doces as { itens?: unknown } | undefined)?.itens),
    ...de(c.outros_produtos),
    ...sabores,
  ];
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
  const t = semAcMin(fala);
  if (!t.trim()) return [];
  const palavras = t.split(/[^a-z]+/).filter((p) => p.length >= 4);
  const achados: string[] = [];

  for (const nome of nomesDoCatalogo()) {
    const alvo = semAcMin(nome);
    if (!alvo) continue;
    // Escrito igual: não precisa de aproximação nenhuma.
    if (cerca(alvo.replace(/[^a-z ]/g, "")).test(t) || t.includes(alvo)) {
      achados.push(nome);
      continue;
    }
    // Apelido e corretor do celular: "chique" é o que o teclado escreve no
    // lugar de "quiche", e as duas estão a quatro letras uma da outra. Isso é
    // caso de lista, nunca de afrouxar a régua da distância.
    const apelidos = (APELIDOS[nome] ?? APELIDOS[alvo] ?? []).map(semAcMin);
    if (apelidos.some((a) => cerca(a.replace(/[^a-z ]/g, "")).test(t))) {
      achados.push(nome);
      continue;
    }
    // Nome de uma palavra só é o que dá para comparar por distância com
    // segurança. "pastel assado" tem que estar escrito.
    if (alvo.includes(" ")) continue;
    const folga = alvo.length >= 7 ? 2 : 1;
    if (palavras.some((p) => dist(p, alvo) <= folga)) achados.push(nome);
  }

  return [...new Set(achados)];
}

/* ------------------------------------------------------------------ dados */

const PAGAMENTOS: [RegExp, string][] = [
  [cerca("pix"), "pix"],
  [cerca("cartao|credito|debito|maquininha"), "cartao"],
  [cerca("dinheiro|especie|a vista"), "dinheiro"],
  [cerca("boleto|faturado"), "boleto"],
];

/** "as 14h", "14:30", "as 9 da manha". Devolve "HH:MM". */
function horaNaFrase(t: string): string | null {
  const m =
    /(^|[^0-9])([01]?[0-9]|2[0-3])\s*(?::|h|hs|horas?)\s*([0-5][0-9])?(?![0-9])/.exec(t) ?? null;
  if (!m) return null;
  const h = Number(m[2]);
  const min = m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || h > 23 || min > 59) return null;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

/** "dia 02/09", "02/09/2026", "dia 2". Devolve cru, para dataDeRetirada tratar. */
function dataNaFrase(t: string): string | null {
  const comBarra = /(^|[^0-9])([0-3]?[0-9])\s*\/\s*([01]?[0-9])(\s*\/\s*(\d{2,4}))?/.exec(t);
  if (comBarra) {
    return comBarra[2] + "/" + comBarra[3] + (comBarra[5] ? "/" + comBarra[5] : "");
  }
  const soDia = /(^|[^a-z0-9])dia\s+([0-3]?[0-9])($|[^0-9\/])/.exec(t);
  return soDia ? soDia[2] : null;
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
  const topo = afirmouOuNegou(t, /topo/);
  const papel = afirmouOuNegou(t, /papel( de arroz)?/);
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

  if (daFrase.pecas || doModelo.pecas) {
    junto.pecas = {
      ...(doModelo.pecas ?? {}),
      // A frase por cima: ela é quem viu as duas respostas na mesma linha.
      ...(daFrase.pecas ?? {}),
    };
  }
  if (daFrase.prato) junto.prato = daFrase.prato;
  if (daFrase.forminha) junto.forminha = daFrase.forminha;
  if (daFrase.pessoas) {
    junto.pessoas = daFrase.pessoas;
    junto.ehFesta = true;
  }
  if (daFrase.dados) junto.dados = { ...(doModelo.dados ?? {}), ...daFrase.dados };

  return junto;
}

/* --------------------------------------------------------------- recheio */

/** Os recheios que a casa faz. Sai do cardapio, nao de lista escrita a mao. */
function recheiosDoCatalogo(): string[] {
  const c = catalogo as unknown as Record<string, unknown>;
  const de = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.flatMap((x) => ((x as { recheios?: string[] })?.recheios ?? []).map(String))
      : [];
  const salgados = c.salgados as { frito?: { itens?: unknown }; assado?: { itens?: unknown } } | undefined;
  return [...new Set([...de(salgados?.frito?.itens), ...de(salgados?.assado?.itens)])];
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
): { produto: string; qtd: number }[] {
  const t = semAcMin(fala);
  if (!t.trim()) return [];

  const achados: { produto: string; qtd: number }[] = [];
  for (const nome of produtosNaFrase(fala)) {
    if (daEtapaDeAgora(nome)) continue;

    const alvo = semAcMin(nome);
    const onde = t.indexOf(alvo);
    if (onde < 0) continue;

    // NEGACAO MANDA. "sem coxinha" nao e pedido de coxinha, e adivinhar aqui
    // colocaria no pedido o que ele acabou de recusar.
    const antes = t.slice(Math.max(0, onde - 24), onde);
    if (/(^|[^a-z])(sem|nao|nem|tirar?|tira)([^a-z][^.,;]*)?$/.test(antes)) continue;

    // A quantidade e o numero mais perto ANTES do nome. "2 kg de 4 leites" da
    // 2; "50 brigadeiro" da 50. Sem numero fica 0, e quem preenche depois e a
    // proposta da festa ou a pergunta da padaria.
    const nums = [...antes.matchAll(/([0-9]+(?:[.,][0-9]+)?)/g)];
    const ultimo = nums.length ? nums[nums.length - 1][1] : null;
    const qtd = ultimo ? Number(ultimo.replace(",", ".")) : 0;

    achados.push({ produto: nome, qtd: qtd > 0 && qtd <= 5000 ? qtd : 0 });
  }
  return achados;
}
