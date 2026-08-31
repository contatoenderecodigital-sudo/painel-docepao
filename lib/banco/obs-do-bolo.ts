// ============================================================================
//  A OBSERVACAO DO BOLO TEM UM FORMATO SO
//
//  POR QUE ISTO EXISTE
//
//  A observacao do item e lida por tres partes do sistema, e ate 31/08/2026
//  cada uma cortava o texto num caractere diferente:
//
//    o fluxo (quem escreve)   juntava os pedacos com " | "
//    o cupom  (a cozinha)     corta na VIRGULA, uma linha por pedaco
//    o painel (a equipe)      procura "tema X", "nome Y" e "N anos" ate a virgula
//
//  Medido num pedido real de festa, o de 30/08/2026 as 23h:
//
//    guardado:  "Gabriel Lucas | 12 anos | Topo: tema foto de referencia,
//                Gabriel Lucas, 12 anos"
//
//    a cozinha recebeu TRES linhas, duas delas repetidas:
//      > Gabriel Lucas | 12 anos | Topo: tema foto de referencia
//      > Gabriel Lucas
//      > 12 anos
//
//    o painel mostrou o campo "Nome do aniversariante" VAZIO, porque procurava
//    a palavra "nome" e o fluxo escreveu o nome pelado. A idade apareceu, por
//    acidente: "12 anos" casa sozinho.
//
//  Nao e defeito de nenhuma das tres. E defeito de nao existir um formato.
//
//  ENTAO AQUI TEM AS DUAS PONTAS, E SO AQUI: quem escreve e quem le. O teste
//  `a-observacao-do-bolo-tem-um-formato-so.cjs` faz o caminho de ida e volta e
//  quebra se elas discordarem, que e o unico jeito de isso nao se soltar de
//  novo daqui a duas semanas.
//
//  O VOCABULARIO E O DO PAINEL, de proposito. A equipe edita na tela e o que
//  ela digita tem que continuar sendo lido pela mesma funcao: se o formato
//  fosse o do fluxo, todo pedido tocado pela dona voltaria ilegivel.
// ============================================================================

export type Embalagem = "prato aberto" | "caixa com tampa";

export type PecaDoBolo = {
  /** O desenho: "foto de referencia", "homem aranha", "jardim encantado". */
  tema?: string | null;
  /** O aniversariante. */
  nome?: string | null;
  /** So o numero: "12". A palavra "anos" entra na escrita. */
  idade?: string | null;
  /** O que vai escrito na peca, quando o cliente pediu uma frase propria. */
  escrito?: string | null;
  topo?: boolean;
  papelDeArroz?: boolean;
  embalagem?: Embalagem | null;
  /** O que a IA anotou e nao cabe em nenhum campo. Sai e volta sem ser tocado. */
  resto?: string[];
};

const TOPO = "topo de bolo";
const PAPEL = "papel de arroz";
const EMBALAGENS: Embalagem[] = ["prato aberto", "caixa com tampa"];

const limpo = (v?: string | null) => String(v ?? "").trim();

/** "12 anos" e "12" viram "12". A palavra e escrita por quem escreve. */
function soONumeroDaIdade(v?: string | null): string {
  const m = limpo(v).match(/\d{1,3}/);
  return m ? m[0] : "";
}

/**
 * A OBSERVACAO, ESCRITA UMA VEZ SO.
 *
 * Separador virgula, porque e onde o cupom corta. Cada pedaco vira uma linha
 * na comanda, e nenhuma linha repete a outra.
 */
export function escreverObs(p: PecaDoBolo): string {
  const partes: string[] = [];

  const tema = limpo(p.tema);
  if (tema) partes.push("tema " + tema);

  // O QUE VAI ESCRITO NA PECA MANDA NO NOME E NA IDADE.
  //
  // Quando o cliente dita a frase ("Parabens vovo"), o nome e a idade nao vao
  // pra peca: quem fabrica escreve o que foi ditado, e mais nada. Escrever os
  // tres faria a confeitaria ter que adivinhar qual vale.
  const escrito = limpo(p.escrito);
  if (escrito) {
    partes.push("escrito: " + escrito);
  } else {
    const nome = limpo(p.nome);
    if (nome) partes.push("nome " + nome);
    const idade = soONumeroDaIdade(p.idade);
    if (idade) partes.push(idade + " anos");
  }

  if (p.topo === true) partes.push(TOPO);
  if (p.papelDeArroz === true) partes.push(PAPEL);
  if (p.embalagem) partes.push(p.embalagem);

  for (const x of p.resto ?? []) {
    const t = limpo(x);
    if (t) partes.push(t);
  }

  // NADA APARECE DUAS VEZES.
  //
  // O defeito de 30/08 nasceu de dois carimbos empilhando o mesmo nome. Aqui
  // isso e impossivel por construcao, e nao por cuidado de quem chama.
  const vistos = new Set<string>();
  return partes
    .filter((x) => {
      const chave = x.toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .join(", ");
}

/**
 * MUDA UM CAMPO SO, SEM ENCOSTAR NO RESTO DO TEXTO.
 *
 * E o que quem chama sempre quer: "o cliente disse que nao quer topo" nao pode
 * apagar o tema, o nome nem o que a IA anotou por fora. Antes isso era feito
 * com corte de string na mao, em tres lugares diferentes.
 */
export function mexerNaObs(obs: string | null | undefined, mudanca: Partial<PecaDoBolo>): string {
  return escreverObs({ ...lerObs(obs), ...mudanca });
}

/**
 * A OBSERVACAO, LIDA DE VOLTA.
 *
 * Aceita o " | " antigo tambem: existe pedido gravado com ele, e a equipe nao
 * pode abrir um pedido de ontem e ver os campos vazios.
 */
export function lerObs(texto?: string | null): PecaDoBolo {
  const bruto = limpo(texto);
  if (!bruto) return { topo: false, papelDeArroz: false, embalagem: null, resto: [] };

  // "Topo: tema foto de referencia" e UM pedaco com DUAS informacoes: que tem
  // topo, e qual e o tema. Foi assim que o fluxo escreveu ate 31/08/2026, e
  // existe pedido gravado desse jeito. Lendo o pedaco inteiro como "tem topo",
  // o tema sumia do painel de quem ia fabricar a peca.
  const partes = bruto
    .split(/[,|]/)
    .flatMap((x) => {
      const t = x.trim();
      const comPrefixo = t.match(/^topo:\s*(.*)$/i);
      if (!comPrefixo) return [t];
      return [TOPO, comPrefixo[1].trim()];
    })
    .filter(Boolean);

  const p: PecaDoBolo = { topo: false, papelDeArroz: false, embalagem: null, resto: [] };

  for (const parte of partes) {
    const baixo = parte.toLowerCase();

    // A NEGACAO VEM ANTES DA AFIRMACAO.
    //
    // "sem topo" contem "topo". Testando o positivo primeiro, o cliente que
    // recusou a peca ficava com ela marcada na tela da equipe.
    if (/^sem\s/.test(baixo)) {
      if (baixo.includes("topo")) p.topo = false;
      else if (baixo.includes("papel")) p.papelDeArroz = false;
      else p.resto!.push(parte);
      continue;
    }

    if (baixo.includes(TOPO) || /^topo\b/.test(baixo) || /^topo:/.test(baixo)) {
      p.topo = true;
      continue;
    }
    if (baixo.includes(PAPEL)) {
      p.papelDeArroz = true;
      continue;
    }
    const emb = EMBALAGENS.find((e) => baixo.includes(e));
    if (emb) {
      p.embalagem = emb;
      continue;
    }
    const escrito = parte.match(/^escrito:\s*(.+)$/i);
    if (escrito) {
      p.escrito = escrito[1].trim();
      continue;
    }
    const tema = parte.match(/^tema\s+(.+)$/i);
    if (tema) {
      p.tema = tema[1].trim();
      continue;
    }
    const nome = parte.match(/^nome\s+(.+)$/i);
    if (nome) {
      p.nome = nome[1].trim();
      continue;
    }
    const idade = parte.match(/^(\d{1,3})\s*anos?$/i);
    if (idade) {
      p.idade = idade[1];
      continue;
    }
    p.resto!.push(parte);
  }

  return p;
}
