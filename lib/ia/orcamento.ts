// ============================================================================
//  MOTOR DE ORÇAMENTO — a peça que a IA chama pra calcular. Código puro.
//  A IA NUNCA calcula preço, ela chama o motor (não erra soma, não alucina).
//
//  MULTI-TENANT: `criarMotor(produtos, rendimento)` monta um motor com o
//  cardápio de QUALQUER padaria. O padrão (Doce Pão) vem do catalogo.json.
// ============================================================================

import catalogo from "./dados/catalogo.json";
import { produtosDaCasa } from "./dados/produtos";
import rendimentoJson from "./dados/rendimento.json";
import { semAcento, afirmouOuNegou, cercaDaPalavra } from "./texto";
import { unidadeDoItem } from "../tipos";

/**
 * O TERMO FOI CITADO, E NAO NEGADO?
 *
 * Isto era uma leitura de negacao PROPRIA deste arquivo, com a sua propria
 * lista de palavras, e ela discordava do leitor da frase em quatro de nove
 * casos medidos em 28/08/2026. Tres cobravam R$ 12 do cliente que tinha
 * recusado o papel de arroz com todas as letras:
 *
 *   "nao quero papel de arroz"      cobrava
 *   "topo sim, papel de arroz nao"  cobrava
 *   "papel de arroz nao"            cobrava
 *
 * Duas leituras da mesma pergunta sempre divergem. Agora e uma so, e o que esta
 * lista sabia de portugues ("tirar o", "nada de") foi junto pra la.
 */
export function citadoDeVerdade(texto: string, termo: string): boolean {
  return afirmouOuNegou(semAcento(texto), cercaDaPalavra(semAcento(termo))) !== false
    && semAcento(texto).includes(semAcento(termo));
}

export const brl = (n: number) =>
  "R$ " +
  n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");

// Um produto do cardápio (formato genérico, serve pra qualquer negócio).
// unidade: "un" (vendido por unidade, qtd inteira) ou "kg" (por quilo, qtd = peso).
export type Produto = { nome: string; preco: number; categoria: string; unidade?: "un" | "kg" };

// Regras de rendimento (quanto por pessoa). unidadePorProduto lida com produtos
// vendidos em pacote (ex: "cento" = 100 unidades).
export type Rendimento = {
  salgadoPorPessoa?: number;
  docePorPessoa?: number;
  boloServe?: number; // 1 bolo serve N pessoas
  unidadePorProduto?: number; // 1 = por unidade; 100 = vendido por cento
  minSalgado?: number;
  confirmar?: boolean;
};

export type LinhaCotacao = { item: string; categoria: string; qtd: number; unit: number; subtotal: number; obs?: string; unidade?: "un" | "kg" };
export type Cotacao = {
  linhas: LinhaCotacao[];
  avisos: string[];
  notas?: string[];
  estimativa?: boolean;
  pessoas?: number;
  total: number;
};

export type Motor = {
  cotarPorItens(pedido: { item: string; qtd: number; obs?: string }[]): Cotacao;
  sugerirPorPessoas(pessoas: number, quer: { salgado?: boolean; doce?: boolean; bolo?: boolean }): Cotacao;
  cardapioResumo(): string;
};

// Fábrica: monta um motor a partir de uma lista de produtos + rendimento.
export function criarMotor(produtos: Produto[], rend: Rendimento = {}): Motor {
  // Tira plural comum do portugues: coxinhas, risoles, pasteis, esfihas.
  const semPlural = (t: string) => t.replace(/(oes|aes|ais|eis|res|zes|ns|es|s)$/, "");
  // Distancia de edicao curta, so pra pegar erro de digitacao e de transcricao.
  const distancia = (a: string, b: string): number => {
    if (Math.abs(a.length - b.length) > 3) return 99;
    const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let anterior = linha[0];
      linha[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const guardado = linha[j];
        linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
        anterior = guardado;
      }
    }
    return linha[b.length];
  };
  // O NORMALIZADOR AQUI ERA LOCAL, E SOMBREAVA O DE TODO MUNDO.
  //
  // Um `const semAcento` dentro desta funcao escondia o `semAcento` importado no
  // topo do arquivo: quem lesse o codigo veria o nome conhecido e estaria lendo
  // outra funcao. As duas quase iguais, com uma diferenca de verdade: a local
  // fazia `String(t)` sem o `|| ""`, entao `undefined` virava a palavra
  // "undefined" e podia virar chave de preco.
  //
  // Sem acento dos dois lados continua valendo pelo mesmo motivo de sempre: o
  // cliente escreve "prestigio" e o cardapio tem "prestígio".
  const PRECOS: Record<string, Produto> = {};
  for (const p of produtos) PRECOS[semAcento(p.nome)] = p;

  // acha o 1º produto de uma categoria (pro "por pessoas")
  const primeiroDaCategoria = (cat: string) =>
    produtos.find((p) => p.categoria.toLowerCase().startsWith(cat));

  const unidade = rend.unidadePorProduto && rend.unidadePorProduto > 0 ? rend.unidadePorProduto : 1;

  const norm = (s: string) => semAcento(s);

  // Sinais de que a linha é o BOLO da festa, e não um docinho de mesmo nome.
  // Sem isto, "brigadeiro" com a observação do bolo casa com o docinho de
  // R$ 1,25: o bolo de 2 kg vira R$ 2,50 e a cozinha recebe um pedido sem bolo.
  // Aconteceu num teste real, com o pedido já fechado e o cliente avisado.
  const MARCA_DE_BOLO = /p[ãa]o de l[óo]|topo d|papel de arroz|aniversariante|prato aberto|caixa com tampa|andar/i;

  // Os sabores de bolo recheado, do mais caro pro mais barato, pra saber qual
  // vale quando o cliente pede dois no mesmo bolo.
  // O cliente fala "com nozes", não "strogonoff de nozes", então a última
  // palavra do sabor também vale como apelido. Casar duas vezes o mesmo sabor
  // não faz mal: o preço só muda quando o outro é mais caro de verdade.
  const SABORES_BOLO = produtos
    .filter((p) => p.categoria === "bolo_festa" && norm(p.nome).startsWith("bolo ") && !norm(p.nome).startsWith("bolo recheado "))
    .flatMap((p) => {
      const sabor = norm(p.nome).slice(5);
      const ultima = (sabor.split(" ").pop() || "").replace(/[^a-zà-ú0-9]/g, "");
      // O nome inteiro do sabor entra SEMPRE, seja qual for o tamanho. Antes
      // havia um filtro de mais de três letras aqui, e ele derrubava exatamente
      // um sabor do cardápio: "biz", de R$ 49,90.
      //
      // O efeito era caro e mudo: todo bolo misto com biz saía cobrado pelo
      // OUTRO sabor, quase sempre o de R$ 46,90, e ninguém via porque o pedido
      // fechava normal. O filtro existia pra proteger o apelido, que é um
      // palpite; o nome do cardápio não é palpite.
      const lista = [{ sabor, produto: p }];
      // A última palavra vale como apelido, porque o cliente fala "com nozes"
      // e não "strogonoff de nozes". Aqui o tamanho mínimo continua valendo:
      // apelido curto casa dentro de qualquer palavra.
      if (ultima.length > 3 && ultima !== sabor) lista.push({ sabor: ultima, produto: p });
      return lista;
    })
    .filter((x) => x.sabor.length > 0)
    .sort((a, b) => b.produto.preco - a.produto.preco);

  // O sabor tem que aparecer como PALAVRA INTEIRA, e não como pedaço de outra.
  // Sem isto, deixar entrar sabor de três letras faria "biz" casar dentro de
  // qualquer palavra que tivesse essas letras juntas.
  const contemComoPalavra = (texto: string, palavra: string): boolean => {
    if (!palavra) return false;
    let de = texto.indexOf(palavra);
    while (de >= 0) {
      const antes = de === 0 ? " " : texto[de - 1];
      const fim = de + palavra.length;
      const depois = fim >= texto.length ? " " : texto[fim];
      if (!/[a-zà-ú0-9]/.test(antes) && !/[a-zà-ú0-9]/.test(depois)) return true;
      de = texto.indexOf(palavra, de + 1);
    }
    return false;
  };

  // "brigadeiro com morango": vale o morango. Sem isso o bolo misto saía pelo
  // preço do primeiro sabor que casasse, quase sempre o mais barato.
  function saborMaisCaro(texto: string): Produto | undefined {
    const t = norm(texto);
    const achados = SABORES_BOLO.filter((x) => contemComoPalavra(t, x.sabor));
    if (achados.length < 2) return undefined;
    return achados[0].produto; // já vem ordenado do mais caro
  }

  function cotarPorItens(pedido: { item: string; qtd: number; obs?: string }[]): Cotacao {
    const linhas: LinhaCotacao[] = [];
    const avisos: string[] = [];
    let total = 0;
    for (const { item, qtd, obs } of pedido) {
      // "bolo de brigadeiro" precisa virar "bolo brigadeiro" antes de qualquer
      // busca. Sem isso o "de" atrapalha o casamento e sobra só "brigadeiro",
      // que existe como docinho de R$ 1,25: o bolo de 2 kg virava R$ 2,50.
      // O PRODUTO QUE EXISTE COM ESSE NOME VEM PRIMEIRO.
      //
      // Cortar " recheado" do fim serve pro bolo: o cliente diz "bolo laka
      // recheado" e o cardapio tem "bolo laka". Mas o corte era cego, e havia
      // produto cujo nome TERMINA em "recheado":
      //
      //   "cupcake pequeno recheado" custa R$ 3,00 e virava "cupcake pequeno",
      //   de R$ 2,00. O grande, de R$ 7,00, virava o de R$ 5,00.
      //
      // Cobrava a menos, calado, e ninguem via porque o produto certo existia:
      // so nunca era alcancado. A prova esta na foto dos precos, que congelou o
      // defeito, e no plural: "cupcake pequeno recheados" cotava certo, porque
      // o "s" no fim salvava o nome do corte.
      //
      // Agora o corte so acontece quando o nome inteiro nao e produto nenhum.
      const semArrumar = norm(item)
        .replace(/^bolo (de |do |da )/, "bolo ")
        .replace(/^torta (de |do |da )/, "torta ");
      const chave = PRECOS[semArrumar]
        ? semArrumar
        : semArrumar.replace(/ recheado$| de festa$| de anivers[áa]rio$/, "");
      // Bolo disfarçado de docinho: tenta o mesmo sabor na família dos bolos.
      if (obs && MARCA_DE_BOLO.test(obs) && !chave.startsWith("bolo")) {
        // A CATEGORIA "bolo" NAO EXISTE NESTE MOTOR, E ESTE GALHO NUNCA DISPAROU.
        //
        // As categorias que ele enxerga sao `bolo_recheado`, `bolo_caseiro` e
        // `bolo_salgado`; "bolo" seco nao e nenhuma delas. Medido em
        // 28/08/2026, com marca de bolo na observacao:
        //
        //   "cafe"  ->  cotava o DOCINHO de cafe, R$ 1,25
        //   o certo ->  bolo caseiro cafe
        //
        // Um bolo de 2 kg saindo por R$ 2,50. E o mesmo defeito que o
        // `produto.ts` diz ter consertado no fluxo, sobrevivendo aqui: o motor
        // e chamado de outros lugares (o painel da dona, o pedido corrigido na
        // mao) e nesses o nome chega curto.
        //
        // O caseiro entra pelo nome exato antes do casamento por pedaco, senao
        // "cafe" alcanca qualquer nome que contenha essas letras.
        const comoBolo =
          PRECOS[norm("bolo " + item)] ??
          PRECOS[norm("bolo caseiro " + item)] ??
          produtos.find((p) => /^bolo/.test(p.categoria) && norm(p.nome).includes(chave));
        if (comoBolo) {
          const q0 = Number(qtd) || 0;
          const sub0 = comoBolo.preco * q0;
          total += sub0;
          linhas.push({
            item: comoBolo.nome, categoria: comoBolo.categoria, qtd: q0, unit: comoBolo.preco,
            subtotal: sub0, obs: obs || undefined, unidade: comoBolo.unidade ?? "kg",
          });
          avisos.push(`"${item}" foi cotado como ${comoBolo.nome} (a observação é de bolo de festa).`);
          continue;
        }
      }
      // 1) match exato; 2) nome parcial (ex: "coxinha" acha "Cento de coxinha")
      let ref: Produto | undefined = PRECOS[chave];

      // O BOLO CASEIRO PELO NOME CURTO.
      //
      // No cardápio ele é "bolo caseiro prestígio com ganache", e quem escreve
      // "bolo prestígio com ganache" está falando dele. O fluxo já resolve isso
      // antes de chegar aqui, mas o motor é chamado de outros lugares (o painel
      // da dona, o pedido corrigido na mão), e nesses o nome vinha curto.
      //
      // Sem esta linha, "bolo prestígio com ganache" caía no casamento por
      // pedaço e virava "bolo prestígio", que é o de FESTA: R$ 46,90 o quilo no
      // lugar de R$ 33,90 a unidade. Errava preço, produto e unidade.
      //
      // Depois do exato, de propósito: "bolo prestígio" continua sendo o de
      // festa, porque "bolo caseiro prestígio" não existe.
      if (!ref && chave.startsWith("bolo ")) {
        ref = PRECOS["bolo caseiro " + chave.slice(5)];
      }

      if (!ref) {
        // BOLO SÓ CASA COM BOLO.
        //
        // "bolo brigadeiro com morango" não existe na tabela (lá é "bolo
        // brigadeiro"), então caía na busca por pedaço e casava com o DOCINHO
        // brigadeiro: o bolo de 4 kg virava R$ 5,00 e a guarda passava a dizer
        // que o pedido não tinha bolo nenhum, travando o fechamento.
        const ehBolo = /^bolo\b/.test(chave);
        const universo = ehBolo ? produtos.filter((p) => /^bolo\b/.test(norm(p.nome))) : produtos;
        // Todos os que casam, do nome mais completo pro mais curto: 'cuca
        // recheada' tem que ganhar de 'cuca', senao a padaria cobra R$ 4 a
        // menos por unidade sem ninguem perceber.
        // O NOME DO PRODUTO GANHA DO RECHEIO. SEMPRE.
        //
        // Antes daqui os candidatos eram ordenados pelo NOME MAIS COMPRIDO, e
        // isso deixava um produto totalmente diferente ganhar de um casamento
        // de verdade. "quiche de frango" casava com "quiche" (nome do produto)
        // e tambem com "pizza inteira strogonoff de frango", so porque essa
        // termina em "frango". A pizza tem o nome mais comprido e ganhava: o
        // quiche saiu cotado a R$ 120,00 a unidade e um pedido de R$ 381 fechou
        // por R$ 12.256,30. Medido em 25/08/2026, com o pedido fechado.
        //
        // Agora a ordem e por QUALIDADE do casamento, e o comprimento so
        // desempata dentro do mesmo nivel, que e o que faz "cuca recheada"
        // continuar ganhando de "cuca".
        //
        //   1. o nome bate inteiro
        //   2. um nome contem o outro (quiche dentro de "quiche de frango")
        //   3. so a ultima palavra bate (o recheio) — o mais fraco de todos
        // Nome exato NAO ganha nivel proprio de proposito: "cuca" e cobrada
        // como "cuca recheada" por decisao da casa, e um nivel so pro exato
        // mudaria esse preco em silencio. Dentro do mesmo nivel o comprimento
        // desempata, que e o que mantem essa escolha de pe.
        const nivelDoCasamento = (p: Produto): number => {
          const pn = norm(p.nome);
          if (pn.includes(chave) || chave.includes(pn)) return 2;
          const ultima = pn.split(" ").pop() || "";
          if (ultima.length > 3 && chave.includes(ultima)) return 3;
          return 99;
        };
        const candidatos = universo
          .map((p) => ({ p, nivel: nivelDoCasamento(p) }))
          .filter((c) => c.nivel < 99)
          .sort((a, b) => a.nivel - b.nivel || norm(b.p.nome).length - norm(a.p.nome).length);
        ref = candidatos[0]?.p;
      }
      // Ainda nao achou: tenta por aproximacao (plural e erro de digitacao ou de
      // transcricao de audio). So aceita quando ha UM candidato claro; empate
      // vira aviso pra equipe, porque cobrar produto errado e pior que conferir.
      if (!ref) {
        const ehBolo2 = /^bolo\b/.test(chave);
        const universo2 = ehBolo2 ? produtos.filter((x) => /^bolo\b/.test(norm(x.nome))) : produtos;
        const alvo = semPlural(chave);
        let melhor: { p: Produto; d: number } | null = null;
        let empate = false;
        for (const cand of universo2) {
          const nomeCand = semPlural(norm(cand.nome));
          const partes = nomeCand.split(' ').filter((x) => x.length > 3);
          const d = Math.min(distancia(alvo, nomeCand), ...partes.map((x) => distancia(alvo, x)), 99);
          if (d > 2) continue;
          if (!melhor || d < melhor.d) {
            melhor = { p: cand, d };
            empate = false;
          } else if (d === melhor.d && cand.nome !== melhor.p.nome) {
            empate = true;
          }
        }
        if (melhor && !empate) {
          ref = melhor.p;
          if (semPlural(norm(melhor.p.nome)) !== alvo) {
            avisos.push(`"${item}" foi cotado como ${melhor.p.nome}.`);
          }
        }
      }
      if (!ref) {
        avisos.push(`Não achei "${item}" no cardápio, conferir com a equipe.`);
        continue;
      }
      // Dois sabores no mesmo bolo: vale o mais caro. É a regra da casa, está
      // escrita na própria peça do cardápio, e o motor não aplicava: brigadeiro
      // com morango saía a R$ 46,90 o quilo em vez de R$ 49,90.
      if (ref.categoria === "bolo_festa") {
        const caro = saborMaisCaro(chave + " " + (obs ?? ""));
        if (caro && caro.preco > ref.preco) {
          const outro = caro.nome.replace(/^bolo /, "");
          avisos.push(`Bolo com mais de um sabor: cobrei pelo mais caro (${outro}).`);
          // O nome guarda os DOIS sabores: quem lê na cozinha precisa saber que
          // o bolo é misto, e quem lê o orçamento precisa entender o preço.
          const nome = chave.includes(outro) ? ref.nome : `${ref.nome} com ${outro}`;
          ref = { ...caro, nome };
        }
      }
      const q = Number(qtd) || 0;
      const subtotal = ref.preco * q;
      total += subtotal;
      linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: q, unit: ref.preco, subtotal, obs: obs || undefined, unidade: unidadeDoItem(ref.unidade) });
    }

    // Papel de arroz citado só na observação do bolo é papel de arroz não
    // cobrado: são R$ 12 que somem do pedido e reaparecem como prejuízo na
    // produção. Se a observação pede e ele não está entre os itens, entra.
    const citaPapel = linhas.some((l) => citadoDeVerdade(String(l.obs ?? ""), "papel de arroz"));
    const temPapel = linhas.some((l) => /papel de arroz/i.test(l.item));
    if (citaPapel && !temPapel) {
      const ref = PRECOS[norm("papel de arroz")] ?? produtos.find((p) => norm(p.nome).includes("papel de arroz"));
      if (ref) {
        total += ref.preco;
        linhas.push({ item: ref.nome, categoria: ref.categoria, qtd: 1, unit: ref.preco, subtotal: ref.preco, unidade: "un" });
        avisos.push("Papel de arroz estava só na observação; lancei como item pra entrar no total.");
      }
    }
    return { linhas, avisos, total };
  }

  function sugerirPorPessoas(
    pessoas: number,
    quer: { salgado?: boolean; doce?: boolean; bolo?: boolean } = { salgado: true, doce: true },
  ): Cotacao {
    const n = Number(pessoas) || 0;
    const pedido: { item: string; qtd: number }[] = [];
    const notas: string[] = [];
    let estimativa = false;

    if (quer.salgado && rend.salgadoPorPessoa) {
      const prod = primeiroDaCategoria("salgado");
      if (prod) {
        let unidades = Math.round(n * rend.salgadoPorPessoa);
        if (rend.minSalgado && unidades < rend.minSalgado) {
          unidades = rend.minSalgado;
          notas.push(`Salgado ajustado pro mínimo de ${rend.minSalgado}.`);
        }
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.doce && rend.docePorPessoa) {
      const prod = primeiroDaCategoria("docinho");
      if (prod) {
        const unidades = Math.round(n * rend.docePorPessoa);
        pedido.push({ item: prod.nome, qtd: Math.max(1, Math.ceil(unidades / unidade)) });
        estimativa = true;
      }
    }
    if (quer.bolo && rend.boloServe) {
      // BOLO DE FESTA, E NAO QUALQUER COISA QUE COMECE COM "bolo".
      //
      // `primeiroDaCategoria` casa pelo comeco, e ha tres categorias de bolo no
      // motor: `bolo_recheado` (o de festa), `bolo_caseiro` e `bolo_salgado`.
      // Pedir "bolo" devolvia o primeiro da ORDEM DO CATALOGO, e hoje isso da
      // certo por acidente. No dia em que a dona reordenar a tela, a proposta
      // da festa passa a sugerir BOLO SALGADO de R$ 29,90, e ninguem descobre
      // olhando codigo: o numero simplesmente muda.
      //
      // Pedir o mais barato tambem nao serve, e foi medido: o mais barato entre
      // os tres e justamente o bolo salgado.
      const prod = primeiroDaCategoria("bolo_festa");
      if (prod) {
        // Bolo por quilo: qtd = PESO (kg), 1 casa decimal. Por unidade: nº de bolos.
        const qtd =
          prod.unidade === "kg"
            ? Math.max(0.5, Math.round((n / rend.boloServe) * 10) / 10)
            : Math.max(1, Math.ceil(n / rend.boloServe));
        pedido.push({ item: prod.nome, qtd });
        estimativa = true;
      }
    }

    const cotacao = cotarPorItens(pedido);
    return { pessoas: n, estimativa, notas, ...cotacao };
  }

  function cardapioResumo(): string {
    // agrupa por categoria pro prompt
    const porCat: Record<string, string[]> = {};
    for (const p of produtos) {
      (porCat[p.categoria] ||= []).push(`${p.nome} ${brl(p.preco)}`);
    }
    return Object.entries(porCat)
      .map(([cat, itens]) => `${cat}: ${itens.join(", ")}`)
      .join("\n");
  }

  return { cotarPorItens, sugerirPorPessoas, cardapioResumo };
}

// Texto do orçamento pronto pro WhatsApp.
// A MESMA FUNCAO SERVIA A DOIS DONOS, E UM DELES E O CLIENTE.
//
// Isto e usado em dois lugares muito diferentes:
//   1. como RESULTADO DE FERRAMENTA, que so a IA le
//   2. como MENSAGEM DE FECHAMENTO, quando o codigo refaz o resumo porque o
//      que ela escreveu nao batia com o pedido gravado
//
// No caso 2 saiu isto pra uma cliente, num pedido de R$ 199,60 (20/08/2026):
//
//   Seu pedido ............ 4 kg bolo laka: R$ 187,60 ... *Total: R$ 199,60*
//   Papel de arroz estava so na observacao; lancei como item pra entrar no total.
//
// Duas coisas erradas. A ultima frase e recado INTERNO, escrito pra IA, e a
// cliente leu como se fosse conversa. E a linha do bolo perdeu a observacao:
// sumiram o pao de lo, o tema Frozen, o nome da Alice e a idade, que e
// justamente o que ela quer conferir num bolo de aniversario.
//
// paraOCliente separa os dois usos: com observacao, sem recado interno.
function formatarOrcamento(c: Cotacao, titulo = "Orçamento", paraOCliente = false): string {
  const L: string[] = [];
  L.push(titulo);
  L.push("".padEnd(28, "."));
  for (const l of c.linhas) {
    const q = unidadeDoItem(l.unidade) === "kg" ? `${String(l.qtd).replace(".", ",")} kg` : `${l.qtd}x`;
    const detalhe = paraOCliente && l.obs ? ` (${String(l.obs).trim()})` : "";
    L.push(`${q} ${l.item}${detalhe}: ${brl(l.subtotal)}`);
  }
  L.push("".padEnd(28, "."));
  L.push(`*Total: ${brl(c.total)}*`);
  // Nao existe "paga na retirada" combinado: e o cliente que escolhe pix,
  // cartao ou dinheiro. Esta linha vinha colada em TODO orcamento e a IA a
  // repetia como se fosse condicao acertada, do mesmo jeito que ela ja tinha
  // inventado "pix" no resumo do pedido.
  if (c.estimativa) L.push("\nEssa quantidade é uma sugestão pro tamanho da festa. Se quiser mais ou menos de algo, é só falar.");
  // Aviso e recado pra IA ("lancei o papel de arroz como item"). Pro cliente
  // isso e a cozinha falando sozinha no meio da confirmacao dele.
  if (!paraOCliente && c.avisos?.length) L.push("\n" + c.avisos.join("\n"));
  return L.join("\n");
}

// ---------------------------------------------------------------------------
//  MOTOR PADRÃO (Doce Pão) — do catalogo.json. Usado quando o negócio não tem
//  cardápio próprio no banco (fallback).
// ---------------------------------------------------------------------------
// A CATEGORIA QUE O ORÇAMENTO FALA.
//
// O sistema tem DOIS vocabulários de categoria, e isso é um defeito de verdade:
// o orçamento diz "salgado", "doce", "bolo_recheado"; o pedido e a comanda dizem
// "salgado_frito", "salgado_assado", "docinho", "bolo_festa". A lista única fala
// o vocabulário do pedido, porque é ele que decide a bancada.
//
// Aqui a tradução fica em UM lugar visível, em vez de espalhada por dezessete
// leitores. Unificar os dois vocabulários de vez muda a comanda de cozinha, e
// isso é uma decisão separada, tomada de olho aberto. Está anotada no
// O-QUE-FALTA. Enquanto não for tomada, o orçamento continua respondendo
// exatamente o que sempre respondeu, e `testes/o-catalogo-nao-mudou-preco.cjs`
// é a prova disso.

function produtosDoCatalogo(): Produto[] {
  const p: Produto[] = [];
  // Genéricos primeiro: o "por pessoas" sugere salgado sem discriminar o tipo.
  p.push({ nome: "salgado frito", preco: catalogo.salgados.frito.preco, categoria: "salgado_frito" });
  p.push({ nome: "salgado assado", preco: catalogo.salgados.assado.preco, categoria: "salgado_assado" });

  // TUDO O QUE A CASA VENDE, da lista única. Nome, preço, unidade e categoria
  // saem de lá: aqui não se interpreta mais o catálogo, só se traduz a palavra
  // da categoria e se acrescenta o que só o orçamento usa.
  for (const c of produtosDaCasa()) {
    p.push({
      nome: c.nome,
      preco: c.preco,
      categoria: c.categoria,
      unidade: c.unidade,
    });
  }

  // AS FAIXAS DE PREÇO, que no catálogo se chamam A, B e C. Não são produto e
  // nenhum cliente diz "bolo recheado b": é o degrau de preço do bolo de festa
  // (R$ 46,90 / R$ 49,90 / R$ 55,90 o quilo), e o motor precisa conseguir cotar
  // pelo degrau quando o pedido vem da equipe em vez de vir do sabor.
  //
  // Por isso não estão na lista única: lá só entra o que a casa vende com nome
  // e preço, e o degrau não tem nome de venda.
  for (const f of catalogo.bolos_recheados.faixas) {
    p.push({ nome: "bolo recheado " + f.faixa.toLowerCase(), preco: f.preco, categoria: "bolo_festa", unidade: "kg" });
  }
  // CADA SABOR DE PIZZA COM NOME PROPRIO, igual ao bolo recheado.
  //
  // Teste ao vivo de 21/08/2026: "2 calabresa e 1 de frango com catupiry"
  // fechou com UMA pizza de R$ 120,00. O codigo anotava as tres certinho, mas
  // as tres tinham o mesmo nome ("pizza inteira") e a mesma categoria, entao
  // uma sobrescrevia a outra na hora de juntar o pedido: sobrava a ultima.
  //
  // Com o sabor no nome, cada linha e uma linha, e o preco continua o mesmo,
  // porque na pizza o sabor nao muda o valor.
  for (const s of [
    ...((catalogo.pizza.sabores_salgados ?? []) as string[]),
    ...((catalogo.pizza.sabores_doces ?? []) as string[]),
  ]) {
    p.push({ nome: "pizza inteira " + String(s).toLowerCase(), preco: catalogo.pizza.inteira.preco, categoria: "pizza" });
    p.push({ nome: "pizza meia " + String(s).toLowerCase(), preco: catalogo.pizza.meia.preco, categoria: "pizza" });
  }
  return p;
}

const rendimentoPadrao: Rendimento = {
  salgadoPorPessoa: rendimentoJson.salgado_por_pessoa?.valor,
  docePorPessoa: rendimentoJson.doce_por_pessoa?.valor,
  boloServe: rendimentoJson.bolo_recheado_serve?.valor,
  unidadePorProduto: 1,
  minSalgado: rendimentoJson.regras_encomenda?.quantidade_minima_salgado?.valor,
  confirmar: true,
};

export const motorPadrao = criarMotor(produtosDoCatalogo(), rendimentoPadrao);

// Compat: exports antigos (Doce Pão). Novo código usa criarMotor por tenant.
export const cotarPorItens = motorPadrao.cotarPorItens;
export const sugerirPorPessoas = motorPadrao.sugerirPorPessoas;
export const cardapioResumo = motorPadrao.cardapioResumo;
