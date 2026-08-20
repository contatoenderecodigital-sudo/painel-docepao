// ============================================================================
//  AS GUARDAS: o que o codigo confere antes de deixar a IA falar ou gravar.
//
//  Moradas aqui, e nao no cerebro.ts, por um motivo pratico: os testes liam o
//  cerebro.ts e RECORTAVAM cada funcao por comentario. Toda funcao nova no meio
//  quebrava tres testes de uma vez, e isso aconteceu tres vezes no mesmo dia,
//  sempre custando tempo com coisa que nao era o defeito. Com arquivo proprio,
//  o teste importa de verdade e para de depender de onde o texto esta.
//
//  Cada funcao aqui nasceu de um defeito REAL, com a frase do cliente no
//  comentario. Nenhuma e precaucao teorica.
// ============================================================================

import catalogo from "./dados/catalogo.json";
// TODOS OS PRECOS UNITARIOS QUE A PADARIA PRATICA, em centavos.
// Fonte unica: o catalogo. O que nao esta aqui, ela nao pode dizer que cobra.
function precosDaCasa(): Set<number> {
  const validos = new Set<number>();
  const guardar = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) validos.add(Math.round(n * 100));
  };
  guardar(catalogo.salgados?.frito?.preco);
  guardar(catalogo.salgados?.assado?.preco);
  for (const i of catalogo.doces?.itens ?? []) guardar((i as { preco?: number }).preco);
  for (const f of catalogo.bolos_recheados?.faixas ?? []) guardar((f as { preco?: number }).preco);
  for (const i of catalogo.bolos_caseiros?.itens ?? []) guardar((i as { preco?: number }).preco);
  for (const i of (catalogo.outros_produtos ?? []) as { preco?: number }[]) guardar(i.preco);
  guardar(catalogo.pizza?.inteira?.preco);
  guardar(catalogo.pizza?.meia?.preco);
  // O cento e o unitario vezes cem, e ela fala nos dois formatos.
  for (const v of [...validos]) validos.add(v * 100);
  return validos;
}

// PRECOS UNITARIOS QUE ELA ESCREVEU E A PADARIA NAO COBRA.
//
// So olha preco por unidade, nos dois jeitos que ela escreve:
//   "R$ 70 o quilo"        valor primeiro
//   "Cada quilo custa R$ 50,00"   unidade primeiro
//
// Total de pedido continua livre: quem soma e o motor, conferido em outro
// lugar, e "3 kg de bolo laka: R$ 140,70" nao e preco de tabela, e linha de
// conta. Por isso a forma com unidade primeiro exige "cada/o/a/por" na frente e
// NAO pode ter numero antes: senao toda linha de orcamento cairia aqui.
//
// LIMITE CONHECIDO: isto pega valor que nao existe em NENHUM lugar da tabela.
// Nao pega valor que existe mas e de outro produto (dizer que o salgado custa
// R$ 2,00, que e o preco do cupcake pequeno, passa). Os dois casos reais que
// motivaram a guarda, R$ 70 e R$ 50, nao existem na tabela e ficam pegos.
// Cobrir o resto exige amarrar preco a produto na mesma frase, que e o proximo
// passo quando sobrar tempo.
export function precosInventados(texto: string): string[] {
  const validos = precosDaCasa();
  const NUM = "([0-9]{1,3}(?:[.][0-9]{3})*(?:[,][0-9]{1,2})?|[0-9]+(?:[.][0-9]{1,2})?)";
  const UNI = "(quilo|kg|cada|a unidade|por unidade|o cento)";
  const padroes = [
    // valor primeiro: "R$ 70 o quilo"
    new RegExp("R\\$ ?" + NUM + " ?(?:o |a |por |cada )?" + UNI, "gi"),
    // unidade primeiro: "Cada quilo custa R$ 50,00". Sem numero antes da
    // unidade, senao "3 kg ... R$ 140,70" viraria falso positivo.
    new RegExp(
      "(?<![0-9,.] ?)(?:cada|por|o|a) (quilo|kg|unidade|cento)( (?:custa|sai|fica|e|vale|de))? R\\$ ?" + NUM,
      "gi",
    ),
  ];
  const fora: string[] = [];
  for (const acha of padroes) {
    for (const m of String(texto ?? "").matchAll(acha)) {
      // O valor e o primeiro grupo que parece numero de dinheiro.
      const bruto = m.slice(1).find((g) => typeof g === "string" && /[0-9]/.test(g) && !/[a-z]/i.test(g));
      if (!bruto) continue;
      const cru = String(bruto).replace(/[.]/g, "").replace(",", ".");
      const cent = Math.round(Number(cru) * 100);
      if (Number.isFinite(cent) && cent > 0 && !validos.has(cent) && !fora.includes(m[0])) fora.push(m[0]);
    }
  }
  return fora;
}

// ===========================================================================
//  PORTAO DE ESCRITA: PERGUNTA NAO E PEDIDO.
//
//  Teste com clientes ao vivo, 19/08/2026. A cliente escreveu, com todas as
//  letras, "Calma, eu nao quero pedir nada ainda, so estou pesquisando preco" e
//  depois "Por favor nao anota nada". A Dora anotou cinco itens. Outro cliente
//  perguntou o preco da torta e ganhou uma torta no pedido. Uma senhora disse
//  "eu nao falei que queria 1 quilo minha filha" e o quilo continuou la.
//
//  Isso e o que a literatura chama de nao separar ferramenta de LEITURA de
//  ferramenta de ESCRITA. Consultar preco e leitura e nao pode mexer no pedido.
//
//  Aqui o codigo confere ANTES de aplicar, em vez de pedir por favor no prompt.
// ===========================================================================

const semAcMin = (t: unknown): string =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// O cliente disse explicitamente pra NAO anotar. Vale pro turno inteiro.
export function clienteProibiuAnotar(fala: string): boolean {
  const t = semAcMin(fala);
  return /(nao|so nao) (anota|anote|coloca|bota|poe|registra)|nao quero (pedir|encomendar|fechar) nada|so (estou|to) (pesquisando|perguntando|olhando|vendo)|so queria saber|e so (uma )?(pergunta|duvida)|nao e pedido/.test(
    t,
  );
}

// ELE NAO VAI COMPRAR HOJE: O QUE ENTROU POR ENGANO TEM QUE SAIR.
//
// Bloquear a proxima anotacao nao basta. A cliente que so pesquisava ganhou um
// "bolo 0% lactose" no pedido por ter feito uma PERGUNTA, pediu pra apagar, e a
// Dora respondeu "Claro, nao anotei nada entao" com o item ainda na tela. Ela
// afirmou ao cliente uma coisa que o sistema desmentia.
//
// Aqui a diferenca importa e e proposital:
//   "nao anota esse" / "tira isso"      -> so bloqueia o proximo (pode ter
//                                          pedido de verdade em andamento)
//   "nao vou pedir nada hoje"           -> LIMPA, porque ele disse que nao
//   "so estou pesquisando preco"           esta comprando
export function clienteNaoVaiComprar(fala: string): boolean {
  const t = semAcMin(fala);
  return /nao (vou|quero) (pedir|comprar|encomendar|fechar)( nada)?( hoje| agora| ainda)?|nao e (um )?pedido|so (estou|to) (pesquisando|olhando|vendo)|so (queria|quero) (saber|perguntar|uma informacao)|nao pedi nada|nao vou levar nada|so pesquisando/.test(
    t,
  );
}

// A fala do cliente e SO uma pergunta sobre este produto, sem decidir nada.
// Perguntar quanto custa nao pode virar item no pedido.
export function soPerguntouSemPedir(fala: string, produto: string): boolean {
  const t = semAcMin(fala);
  const nome = semAcMin(produto).trim();
  if (!t || !nome) return false;
  // O CLIENTE FALA DO PRODUTO PELA PALAVRA QUE IMPORTA, NAO PELA PRIMEIRA.
  //
  // Isto olhava so a primeira palavra do nome. A cliente perguntou "0% lactose
  // nao e sem acucar ne?" e ganhou um "bolo 0% lactose" no pedido, porque a
  // guarda procurava a palavra "bolo" e ela nunca escreveu "bolo". Uma pergunta
  // de esclarecimento virou item, e o item ficou ate o fim da conversa.
  const pedacos = nome
    .replace(/\b(de|do|da|com|e|em|no|na|mini)\b/g, " ")
    .split(/[^a-z0-9%]+/)
    .filter((w) => w.length > 2);
  if (!pedacos.length || !pedacos.some((w) => t.includes(w))) return false;
  // Decidiu de verdade? Entao pode anotar.
  const decidiu =
    /\b(quero|queria|vou querer|me ve|me da|manda|pode ser|fechado|vou levar|anota|bota|coloca|leva)\b/.test(t) ||
    // quantidade explicita: "2 kg", "50 coxinha", "meia duzia"
    /\b[0-9]+([.,][0-9]+)? ?(kg|quilos?|un|unidades?|pe[cç]as?|cento)\b/.test(t) ||
    // NUMERO QUE NAO E QUANTIDADE NAO CONTA COMO DECISAO.
    //
    // A cliente escreveu "0% lactose nao e sem acucar ne?" e ganhou um bolo no
    // pedido: o "0" do "0%" fez o codigo achar que ela tinha dito uma
    // quantidade. Porcentagem faz parte do NOME do produto (0% lactose, 4
    // queijos vem por extenso), data e data, e hora e hora.
    /\b[0-9]+\b/.test(
      t
        .replace(/[0-9]+\s*%/g, " ") // 0% lactose
        .replace(/\b(0[1-9]|[12][0-9]|3[01])[/-][0-9]{1,2}([/-][0-9]{2,4})?/g, " ") // 06/09
        .replace(/\b[0-9]{1,2}\s*(h|hs|horas?)\b/g, " ") // 15h
        .replace(/\b[0-9]{1,2}:[0-9]{2}\b/g, " "), // 15:00
    );
  if (decidiu) return false;
  // PERGUNTA E PERGUNTA, DE QUALQUER JEITO QUE ELE ESCREVA.
  //
  // Isto era uma lista de padroes ("quanto custa", "qual o preco"...) e cliente
  // pergunta de mil jeitos. A cliente escreveu "0% lactose nao e sem acucar ne?
  // eu precisava mesmo de um sem acucar, pra diabetico" e ganhou um bolo no
  // pedido, porque a frase dela nao estava na minha lista.
  //
  // Agora vale o sinal que existe em toda pergunta: o ponto de interrogacao.
  // Somado a nao ter decisao nem quantidade (checados acima), isso e duvida, e
  // duvida nao vira item. Os padroes ficam pra quem pergunta sem "?".
  if (t.includes("?")) return true;
  return /(quanto (custa|fica|sai|e|vem)|qual o pre[cç]o|pre[cç]o d|voces (tem|fazem|trabalham)|voces (fazem|tem)|como (e|funciona|vende)|serve quantas|e doce ou salgado|qual a diferenca)/.test(
    t,
  );
}

// Pedacos da observacao que o cliente NUNCA escreveu.
//
// Ela inventou "porto alegre" como sabor de uma torta SALGADA, inventou
// "frango com legumes" num empadao e inventou "sem recheio" numa cuca. Sabor
// inventado vira producao errada e cliente recusando o pedido no balcao.
export function obsQueOClienteNaoDisse(obs: unknown, falasDoCliente: string[]): string[] {
  const texto = String(obs ?? "").trim();
  if (!texto) return [];
  const tudo = " " + falasDoCliente.map((f) => semAcMin(f)).join(" | ") + " ";
  // Palavras que descrevem o pedido, nao o gosto do cliente: ela pode escrever
  // sozinha porque vieram de uma escolha estruturada, nao de invencao.
  const nossas =
    /^(sem foto|com foto|tem foto|foto|sem topo|com topo|sem papel|com papel|prato aberto|caixa com tampa|topo de bolo|papel de arroz|pao de lo|nome|idade|tema|anos?|dividido|variado|sortido|a combinar)/;
  // ROTULO NAO E ESCOLHA.
  //
  // O cliente escreve "rosa", e ela anota "forminha rosa". A palavra "forminha"
  // e rotulo DELA, nao invencao: quem escolheu a cor foi ele. Sem tirar esses
  // rotulos, a guarda recusava a anotacao certa e a cor se perdia, que e
  // exatamente o defeito que ela ja tinha antes de existir guarda nenhuma.
  const ROTULOS =
    /\b(forminha|forminhas|recheio|recheios|sabor|sabores|cor|tema|massa|cobertura|pao de lo|aniversariante|niver|idade|anos?|nome|para|pra|com|de|do|da|e|em|no|na)\b/g;
  // ENCHIMENTO NAO E ESCOLHA, E NAO PODE RECUSAR O ITEM.
  //
  // O rastro de 20/08/2026 pegou a festa travando em "cor da forminha nao
  // definida ainda": ela escreve isso pra nao deixar o campo vazio, e a guarda
  // tratava como sabor inventado e recusava o item INTEIRO. Enchimento se
  // limpa, nao se recusa.
  const ENCHIMENTO =
    /\b(nao (definid|informad|especificad|escolhid)[oa]?|a definir|a combinar|ainda|indefinid[oa]|pendente|sem definir|por enquanto|talvez)\b/g;
  const fora: string[] = [];
  for (const pedaco of texto.split(",").map((x) => x.trim()).filter(Boolean)) {
    const p = semAcMin(pedaco);
    if (p.length < 4 || nossas.test(p)) continue;
    // Basta o cliente ter escrito as palavras significativas em algum momento.
    // Os rotulos dela ("forminha", "recheio") saem antes: o que precisa vir do
    // cliente e a ESCOLHA, nao a palavra que descreve o campo.
    // "sem" tem tres letras e cairia do filtro, mas e ESCOLHA, nao rotulo: ela
    // inventou "cuca sem recheio" que ninguem pediu. Tirando o rotulo "recheio"
    // sobra so o "sem", e ele precisa continuar valendo.
    const palavras = p
      .replace(ENCHIMENTO, " ")
      .replace(ROTULOS, " ")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 || w === "sem");
    if (!palavras.length) continue;
    const disse = palavras.every((w) => tudo.includes(w));
    if (!disse) fora.push(pedaco);
  }
  return fora;
}

// ===========================================================================
//  O RESUMO QUE ELA FALA TEM QUE SER O PEDIDO QUE ESTA GRAVADO.
//
//  Teste com clientes ao vivo, 19/08/2026. Ela recitou "1 quilo de torta doce
//  de morango" com total de R$ 131,40 enquanto o registro tinha SO coxinha e
//  brigadeiro. E antes disso disse "esta certo, so tem uma torta doce de
//  morango no pedido agora" num momento em que nao havia torta nenhuma.
//
//  Cliente que confia no resumo fecha um pedido que nao existe. Aqui o codigo
//  compara o que ela escreveu com o que esta gravado, e quando diverge o resumo
//  e refeito a partir do estado.
//
//  So vale pra RESUMO, marcado pela linha de total. Responder "a torta doce sai
//  R$ 33,90 o quilo" pra quem perguntou preco nao e resumo e passa direto.
// ===========================================================================

export function ehResumoDePedido(texto: string): boolean {
  const t = String(texto ?? "");
  // A linha de total e o sinal mais claro.
  if (/\*?\s*total\s*:?\s*\*?\s*R\$/i.test(t)) return true;
  // MAS NAO E O UNICO. Na bateria de 19/08/2026 o cliente pediu conferencia e
  // ela listou os itens com valor SEM linha de total, deixando 63 brigadeiros e
  // 62 beijinhos de fora. Como nao tinha "Total", a guarda nem olhou.
  //
  // Duas ou mais linhas no formato "N produto: R$ X" e recitacao de pedido, nao
  // resposta de preco. Resposta de preco vem em prosa, na mesma linha
  // ("frito R$ 1,00 e assado R$ 1,25"), e por isso a contagem e de LINHAS.
  const linhasDeItem = t
    .split(/[\n]/)
    .filter((l) => /R\$\s?[0-9]/.test(l) && /[0-9]+\s*(x|un|kg|quilos?)\b|^\s*[-*]?\s*[0-9]+\s/i.test(l));
  return linhasDeItem.length >= 2;
}

// Itens que ela citou no resumo e que NAO estao no pedido gravado.
export function citadosForaDoPedido(texto: string, itens: { produto?: string }[]): string[] {
  if (!ehResumoDePedido(texto)) return [];
  const gravados = itens.map((i) => semAcMin(i.produto).trim()).filter(Boolean);
  const fora: string[] = [];
  for (const linha of String(texto ?? "").split(/[\n]/)) {
    // So linha de item: tem dinheiro e nao e a linha do total.
    if (!/R\$\s?[0-9]/.test(linha) || /total/i.test(linha)) continue;
    const l = semAcMin(linha);
    // A linha casa com algum item gravado? Basta a primeira palavra do produto.
    const casa = gravados.some((g) => {
      const chave = g.split(" ").filter((w) => w.length > 2)[0] ?? g;
      return chave && l.includes(chave);
    });
    if (!casa) fora.push(linha.trim());
  }
  return fora;
}

// Itens gravados que ela DEIXOU DE FORA do resumo. Some do papel do cliente e
// aparece na comanda: a equipe produz o que ele nao sabe que pediu.
export function faltandoNoResumo(texto: string, itens: { produto?: string }[]): string[] {
  if (!ehResumoDePedido(texto)) return [];
  const t = semAcMin(texto);
  return itens
    .map((i) => String(i.produto ?? "").trim())
    .filter((p) => {
      const chave = semAcMin(p).split(" ").filter((w) => w.length > 2)[0] ?? semAcMin(p);
      return chave && !t.includes(chave);
    });
}

// PRODUTO QUE NINGUEM CITOU NAO ENTRA NO PEDIDO.
//
// Na troca do bolo de prestigio por 4 leites, nasceu no pedido um "leite ninho"
// que a cliente nunca pediu. Ela NEGOU que existia ("nao tem bolo de leite
// ninho no seu pedido, pode ficar tranquila") e duas mensagens depois COBROU:
// "leite ninho: 3 un x R$ 1,25 = R$ 3,13". Anotado como 2,5 kg e cobrado como
// 3 unidades, ou seja, nem consigo isso ela conseguiu.
//
// O enum nao pega isso, porque "leite ninho" EXISTE (e um docinho). E a guarda
// de observacao tambem nao, porque ela olha o SABOR, nao o produto. Faltava
// perguntar o obvio: alguem falou nesse produto?
//
// Vale a fala do cliente E o que ELA acabou de propor, porque proposta aceita
// com "pode ser" e escolha dele tambem.
export function produtoQueNinguemCitou(
  produto: string,
  falasDoCliente: string[],
  propostaDela: string,
): boolean {
  const nome = semAcMin(produto).trim();
  if (!nome) return false;
  // Generico ("salgado", "docinho") e a IA organizando o pedido, nao produto.
  if (/^(salgado|salgado frito|salgado assado|docinho|bolo|bolo recheado|topo de bolo)$/.test(nome)) return false;
  const tudo = " " + [...falasDoCliente, propostaDela].map((f) => semAcMin(f)).join(" | ") + " ";
  // Toda palavra que importa do nome tem que aparecer em algum lugar. "bolo
  // laka" passa se ele falou "laka"; "leite ninho" nao passa se ninguem falou
  // "ninho", mesmo com "leites" na conversa.
  const palavras = nome
    .replace(/\b(de|do|da|com|e|em|no|na|bolo|pizza|mini)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!palavras.length) return false;
  if (palavras.every((w) => tudo.includes(w))) return false;

  // O NOME DO CATALOGO NAO E O NOME QUE O CLIENTE USA.
  //
  // Ele pede "cuca de goiaba"; o produto do catalogo chama "cuca recheada".
  // Exigindo toda palavra do nome na fala dele, eu bloqueava a IA por ter
  // ACERTADO o produto. O teste de concorrencia pegou isso falhando 1 em 3.
  //
  // O que separa esse caso do "leite ninho" fantasma e o SABOR: goiaba e sabor
  // de cuca recheada, e ninho nao e sabor de nada que ele pediu. Entao, quando
  // a primeira palavra do produto bate, o sabor dito por ele fecha a conta.
  // O JEITO QUE O CLIENTE CHAMA NAO E O NOME DO CATALOGO.
  //
  // O rastro de 20/08/2026 pegou isto no ato: o cliente escreveu "quero uma de
  // forma com calabresa, frango com catupiry e portuguesa", a Dora chamou
  // anotar_item com "pizza inteira" (o nome certo do catalogo) OITO vezes, e
  // esta guarda recusou as oito, porque ele nunca escreveu a palavra "inteira".
  // Eu estava bloqueando toda venda de pizza da padaria.
  //
  // Estes apelidos sao os que a propria casa usa, e ja estao no prompt dela:
  // "pizza de metro" e "pizza de forma" sao a retangular; o pastel frito e a
  // mini bolha.
  const APELIDOS: Record<string, string[]> = {
    "pizza inteira": ["pizza de forma", "de forma", "pizza de metro", "de metro", "retangular", "pizza grande", "pizza inteira", "uma pizza"],
    "pizza meia": ["meia pizza", "metade da pizza", "meia de forma", "meia"],
    "pizza redonda": ["redonda", "pizza redonda", "de 30", "30 cm"],
    "mini bolha": ["pastel frito", "pastel", "bolha"],
    "cuca recheada": ["cuca"],
    "torta fria com palmito": ["torta fria"],
    "empadao com palmito": ["empadao", "empadão"],
  };
  for (const apelido of APELIDOS[nome] ?? []) {
    if (tudo.includes(semAcMin(apelido))) return false;
  }

  const primeira = palavras[0];
  if (primeira && tudo.includes(primeira)) {
    const doCatalogo = ((catalogo.outros_produtos ?? []) as { nome: string; sabores?: string[]; recheios?: string[] }[])
      .concat(
        ((catalogo.doces?.itens ?? []) as { nome: string; sabores?: string[] }[]).map((i) => ({ nome: i.nome, sabores: i.sabores })),
      )
      .find((i) => semAcMin(i.nome) === nome);
    const sabores = [...(doCatalogo?.sabores ?? []), ...(doCatalogo?.recheios ?? [])].map(semAcMin);
    if (sabores.some((sab) => sab.length > 2 && tudo.includes(sab))) return false;
  }
  return true;
}

// O CLIENTE PEDIU QUE ELA ESCOLHA.
//
// No teste de aceitacao de 19/08/2026 a secretaria pediu TRES vezes que a Dora
// montasse o sortido, e nas tres ela devolveu a pergunta:
//   "Estou sem tempo de escolher um a um. Escolha voce os recheios mais pedidos"
//   -> "preciso que voce escolha o recheio de cada um, porque cada um tem
//       opcoes diferentes"
// O coffee break de 150 salgados e 100 docinhos NAO fechou por causa disso.
//
// Devolver a pergunta pra quem pediu ajuda e o oposto de atender. Quando isto e
// verdade, o codigo monta a sugestao concreta e entrega pronta pra ela.
export function pediuQueVoceEscolha(fala: string): boolean {
  const t = semAcMin(fala);
  if (!t.trim()) return false;
  return /(voce (escolhe|escolha|decide|monta|que sabe|quem sabe)|escolhe (voce|pra mim|por mim)|o que (voce|vc) (indica|recomenda|sugere|acha)|pode escolher|fica a seu criterio|do jeito que (voces|vc|voce) (acham|achar|quiser)|me (indica|sugere|recomenda)|sortido|variado|misturado|surpresa|sem tempo (de|pra) escolher|nao sei (o que|quais|os tipos)|confio (em voce|no seu|em vcs)|manda o que (for|vier) melhor|(costuma|costumam) (sair|vender|pedir)|(sai|vende|pedem) mais|mais (pedido|vendido|sai)|o que (sai|vende|leva) mais|que (voces|vcs) mais)/.test(
    t,
  );
}

// A SUGESTAO CONCRETA, montada pelo codigo a partir do catalogo.
//
// Devolve os tipos mais comuns da familia com a quantidade ja dividida, pra ela
// OFERECER em vez de perguntar. Quantidade e a conta exata: a soma das partes
// bate com o total, sempre, senao a padaria produz a mais ou a menos.
export function sugestaoDeSortido(
  familia: "salgado_frito" | "salgado_assado" | "docinho",
  total: number,
): { produto: string; qtd: number }[] {
  const q = Math.max(0, Math.floor(total));
  if (!q) return [];
  // Os mais pedidos de cada familia, na ordem em que a casa costuma sugerir.
  const preferidos: Record<string, string[]> = {
    salgado_frito: ["coxinha", "mini bolha", "risólis", "bolinha de queijo", "croquete"],
    salgado_assado: ["esfirra", "empadinha", "pastel assado", "quiche", "croissant"],
    docinho: ["brigadeiro", "beijinho", "cajuzinho", "leite ninho"],
  };
  const nomes = preferidos[familia] ?? [];
  // Quantos tipos: quatro e o que a dona sugere no cento ("cinco sabores, 20 de
  // cada"), mas pedido pequeno nao se divide em cinco.
  const quantos = Math.min(nomes.length, q >= 100 ? 5 : q >= 40 ? 3 : 2);
  const escolhidos = nomes.slice(0, quantos);
  const base = Math.floor(q / quantos);
  const sobra = q - base * quantos;
  // A sobra vai nos primeiros, um a um, pra soma bater exatamente.
  return escolhidos.map((produto, k) => ({ produto, qtd: base + (k < sobra ? 1 : 0) }));
}

// O CLIENTE DISSE QUE A IMAGEM NAO CHEGOU, OU PEDIU POR ESCRITO.
//
// A regra do prompt e "mande a imagem, nao digite a lista", e ela e boa: a peca
// do cardapio ja traz os precos certos e evita ela errar digitando. So que a
// regra era absoluta, e por isso ela repetia "te mandei o cardapio" pra quem
// tinha acabado de dizer que nao recebeu.
//
// Aconteceu com dois clientes no teste de 19/08/2026. Uma senhora escreveu
// "eu nao consigo abrir isso minha filha, me fala o preco por escrito" e ouviu
// de novo que estava no cardapio. Isso e venda perdida por teimosia: internet
// ruim, imagem apagada sem querer e celular velho acontecem todo dia.
//
// Quando isto e verdade, o codigo TIRA a ferramenta de mandar imagem da mesa e
// ela e obrigada a escrever. Prompt e sugestao; ferramenta que nao existe, nao.
export function pediuPorEscrito(fala: string): boolean {
  const t = semAcMin(fala);
  if (!t.trim()) return false;
  const naoChegou =
    /(nao|n) (chegou|veio|recebi|apareceu|carregou|abriu|abre|consigo abrir|to vendo|estou vendo|vejo)/.test(t) ||
    /nao chegou nada|nada chegou|nenhuma (lista|imagem|foto)|imagem nao|cardapio nao (chegou|veio|abriu)/.test(t);
  const porEscrito =
    /(por escrito|escrito aqui|escreve|digita|manda escrito|me fala (o|os|a|as)? ?(preco|precos|sabores|tipos)|fala aqui|lista aqui)/.test(t);
  return naoChegou || porEscrito;
}

// A DATA TEM QUE CAIR NO DIA DA SEMANA QUE O CLIENTE FALOU.
//
// A secretaria pediu pra QUARTA-FEIRA. A Dora escreveu "quarta-feira, dia
// 27/08" e mandou pro pedido. Em 20/08/2026, que e uma quinta, a proxima quarta
// e 26/08; 27/08 e quinta. O cliente ia buscar num dia e a padaria produzir
// noutro, e ninguem ia perceber ate o balcao.
//
// O codigo sabe converter dia da semana em data, mas so era chamado quando ela
// mandava o dia PURO. Mandando a data ja calculada, ele aceitava sem conferir.
// Agora confere: se o cliente falou um dia da semana e a data nao cai nele, a
// PALAVRA DELE vence a aritmetica dela.
//
// Devolve a data corrigida (dd/mm/aaaa) ou null quando nao ha o que corrigir.
export function dataBrigaComODiaDaSemana(
  dataDita: string,
  falaDoCliente: string,
  hoje: Date,
): string | null {
  const DIAS: Record<string, number> = {
    domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
  };
  const t = semAcMin(falaDoCliente);
  // O ULTIMO dia da semana citado pelo cliente: ele pode ter mudado de ideia.
  let nomeDito: string | null = null;
  let ondeUltimo = -1;
  for (const nome of Object.keys(DIAS)) {
    for (const m of t.matchAll(new RegExp("\\b" + nome + "(-feira|feira)?\\b", "g"))) {
      const onde = m.index ?? -1;
      if (onde > ondeUltimo) {
        ondeUltimo = onde;
        nomeDito = nome;
      }
    }
  }
  if (!nomeDito) return null;

  const m = String(dataDita ?? "").match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3] ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear();
  const d = new Date(ano, mes - 1, dia);
  if (Number.isNaN(d.getTime()) || d.getDate() !== dia || d.getMonth() !== mes - 1) return null;
  if (d.getDay() === DIAS[nomeDito]) return null; // bate, nao ha o que corrigir

  // Nao bate: vale o dia da semana que ELE falou, na proxima ocorrencia.
  const certo = new Date(hoje);
  certo.setHours(0, 0, 0, 0);
  const falta = ((DIAS[nomeDito] - certo.getDay() + 7) % 7) || 7;
  certo.setDate(certo.getDate() + falta);
  const dd = String(certo.getDate()).padStart(2, "0");
  const mm = String(certo.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm + "/" + certo.getFullYear();
}

// A FORMA DE PAGAMENTO E A ULTIMA QUE ELE FALOU, NAO A PRIMEIRA.
//
// A funcao antiga testava numa ORDEM FIXA: pix, depois cartao, depois dinheiro.
// Entao quem falasse pix e depois corrigisse pra cartao continuava com pix.
//
// Foi o que aconteceu na bateria de 19/08/2026: o pedido fechou com
// "*Forma de pagamento:* pix" depois do cliente ter corrigido pra cartao e dela
// ter respondido "Anotei que o pagamento sera no cartao". O pedido foi pra
// producao com o dado errado, e na hora de pagar isso vira discussao no balcao.
//
// Corrigir de ideia e normal. Quem manda e a ultima palavra dele.
export function pagamentoQueEleFalou(fala: string): string | undefined {
  const t = String(fala ?? "").toLowerCase();
  const jeitos: { nome: string; acha: RegExp }[] = [
    { nome: "pix", acha: /\bpix\b/g },
    { nome: "cartao", acha: /cart[ãa]o|cr[ée]dito|d[ée]bito|parcel|maquin(a|inha)/g },
    { nome: "dinheiro", acha: /dinheiro|esp[ée]cie|\bvista\b/g },
    // TRANSFERENCIA E BOLETO EXISTEM E NAO ESTAVAM AQUI.
    //
    // A secretaria do coffee break informou "transferencia" TRES vezes e o
    // pedido fechou perguntando "vai ser pix, cartao ou dinheiro na retirada?".
    // Cliente de empresa quase sempre paga assim, e ele fica achando que a
    // padaria nao aceita o jeito dele.
    { nome: "transferencia", acha: /transfer[êe]ncia|transferir|ted\b|doc\b|dep[óo]sito/g },
    { nome: "boleto", acha: /boleto|faturado|nota fiscal|\bnf\b|empenho/g },
  ];
  let escolhido: string | undefined;
  let ondeUltimo = -1;
  for (const j of jeitos) {
    for (const m of t.matchAll(j.acha)) {
      const onde = m.index ?? -1;
      if (onde > ondeUltimo) {
        ondeUltimo = onde;
        escolhido = j.nome;
      }
    }
  }
  return escolhido;
}

// ENDERECO DITO QUE NAO E O DA PADARIA, trocado pelo verdadeiro.
//
// Ela disse "Rua XV de Novembro, 123" pra uma cliente de 68 anos que ia
// buscar o bolo, com o endereco certo dentro do proprio prompt dela.
export function corrigirEndereco(texto: string, enderecoCerto: string): string {
  const certo = String(enderecoCerto ?? "").trim();
  let saida = String(texto ?? "");
  if (!certo) return saida;
  const achaRua = new RegExp(
    "\\b(rua|av[.]?|avenida|travessa|rodovia) +[A-Za-zÀ-ú0-9.ºª]+(?: +[A-Za-zÀ-ú0-9.ºª]+){0,4},? *(?:n[ºo.]? *)?[0-9]{1,5}\\b",
    "gi",
  );
  const semAc = (t: string) =>
    t.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase();
  const alvo = semAc(certo).replace(/[^a-z0-9]/g, " ");
  for (const m of [...saida.matchAll(achaRua)].map((x) => x[0])) {
    const partes = semAc(m).replace(/[^a-z0-9]/g, " ").split(" ").filter((x) => x.length > 3);
    const bate = partes.length > 0 && partes.every((x) => alvo.includes(x));
    if (!bate) saida = saida.split(m).join(certo);
  }
  return saida;
}
