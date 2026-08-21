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
  // DESCRICAO DELA NAO E ESCOLHA INVENTADA, E PODE VIR NO MEIO DA FRASE.
  //
  // O rastro pegou "salgado assado sortido, conforme cardapio" sendo recusado
  // cinco vezes. Nada ali e sabor: e ela descrevendo o que acabou de montar.
  // A lista acima so valia no COMECO do fragmento, e "salgado assado sortido"
  // comeca com o nome da familia, entao caia fora e levava o item junto.
  //
  // Mesma classe do "forminha rosa" e do "nao definida ainda": rotulo dela
  // nunca pode recusar venda.
  const DESCRICAO =
    /\b(sortid[oa]s?|variad[oa]s?|misto|mistos|conforme (o )?cardapio|do cardapio|da casa|a escolher|a definir|escolha (da casa|sua)|sugestao (da casa|sua)|montado por voce|como voce indicou|que voce indicou)\b/;
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
  // DIA E HORA SAO LOGISTICA, NAO GOSTO.
  //
  // "sexta as 19h" passava e "retirar sexta as 19h" era recusado: um verbo na
  // frente derrubava o fragmento e levava o item junto. Data e hora de verdade
  // moram no campo de retirada, com guarda propria que confere o dia da semana
  // contra a conversa. Na observacao isso e enfeite, e enfeite nao pode custar
  // uma venda.
  const LOGISTICA =
    /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo|hoje|amanha|manha|tarde|noite|retirada|retirar|entrega|buscar|[0-9]{1,2}h|[0-9]{1,2}:[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2})\b/;
  const fora: string[] = [];
  for (const pedaco of texto.split(",").map((x) => x.trim()).filter(Boolean)) {
    const p = semAcMin(pedaco);
    if (p.length < 4 || nossas.test(p) || LOGISTICA.test(p) || DESCRICAO.test(p)) continue;
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

// ASSADO NAO E FRITO, E O CLIENTE ESCOLHEU UM DOS DOIS.
//
// A secretaria pediu salgados ASSADOS na segunda mensagem e a Dora ofereceu
// "40 mini bolha, que e o pastel frito da casa". So corrigiu quando a cliente
// reclamou. Quem pede assado costuma ter motivo (dieta, coffee break, nao quer
// fritura), e receber frito e receber outra coisa.
//
// A ferramenta de sortido ja separa as duas familias corretamente. O problema e
// que ela nem sempre chama a ferramenta: monta a lista de cabeca. Entao a
// guarda tem que pegar o erro por QUALQUER caminho, e nao so no da ferramenta.
//
// Devolve "assado", "frito" ou null quando ele nao especificou.
export function familiaQueElePediu(falasDoCliente: string[]): "assado" | "frito" | null {
  const t = " " + falasDoCliente.map((f) => semAcMin(f)).join(" | ") + " ";
  // O ULTIMO que ele falou manda: pode ter comecado com um e mudado.
  let escolha: "assado" | "frito" | null = null;
  let ondeUltimo = -1;
  for (const [nome, re] of [
    ["assado", /\bassad[oa]s?\b|\bde forno\b|\bsem fritura\b|\bnao (quero|pode ser) frit[oa]/g],
    ["frito", /\bfrit[oa]s?\b|\bfritura\b/g],
  ] as const) {
    for (const m of t.matchAll(re)) {
      const onde = m.index ?? -1;
      // "nao quero frito" fala de frito mas ESCOLHE assado: ja tratado no lado
      // do assado, entao aqui a ocorrencia dentro dessa frase e ignorada.
      if (nome === "frito" && /\bnao (quero|pode ser|queria)\s*$/.test(t.slice(Math.max(0, onde - 20), onde))) continue;
      if (onde > ondeUltimo) {
        ondeUltimo = onde;
        escolha = nome;
      }
    }
  }
  return escolha;
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
  return /(voce (escolhe|escolha|decide|monta|que sabe|quem sabe)|escolhe (voce|pra mim|por mim)|(escolh|escolha|decid|monta|separa|manda) *[ae]? *(os|as|uns|umas)? *(tipo|sabor|salgado|docinho|item|iten)|(escolh|decid|mont|faz|faca) *[ae]? *tudo|o que (voce|vc) (indica|recomenda|sugere|acha)|pode escolher|fica a seu criterio|do jeito que (voces|vc|voce) (acham|achar|quiser)|me (indica|sugere|recomenda)|(sugere|indica|recomenda|escolhe|monta|manda) (ai|pra mim|para mim|o que)|sortido|variado|misturado|surpresa|sem tempo (de|pra) escolher|nao sei (o que|quais|os tipos)|confio (em voce|no seu|em vcs)|manda o que (for|vier) melhor|(costuma|costumam) (sair|vender|pedir)|(sai|vende|pedem) mais|mais (pedido|vendido|sai)|o que (sai|vende|leva) mais|que (voces|vcs) mais)/.test(
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

// ELE DISSE QUE NAO VAI OLHAR CARDAPIO. MANDAR DE NOVO E TEIMOSIA.
//
// Teste ao vivo de 21/08/2026, com a secretaria com pressa:
//
//   cliente: nao tenho tempo de olhar cardapio nao, to correndo. escolhe voce
//   Dora:    (Cardapio de salgados) (Cardapio de salgados)
//            Te mandei o cardapio de salgados aqui, com tudo e os precos.
//
// Duas imagens, pra quem tinha acabado de dizer que nao ia olhar. Quem esta
// correndo e recebe cardapio pela segunda vez larga o celular, e com razao: a
// pessoa pediu ajuda e recebeu tarefa.
//
// Isto e diferente de pediuPorEscrito, que trata "a imagem nao chegou". Aqui a
// imagem chegou e ele nao quer.
export function naoVaiOlharCardapio(falasDoCliente: string[]): boolean {
  const t = semAcMin(falasDoCliente.join(" | "));
  if (!t.trim()) return false;
  const dispensou =
    /\b(nao|n) (tenho tempo|vou|consigo|da(?: pra)?|posso|quero)\b[^.!?|]{0,30}\b(olhar|ver|abrir|escolher|analisar)\b/.test(t) ||
    /\b(sem tempo|to correndo|estou correndo|to na correria|nao precisa (de |do )?cardapio|nao quero cardapio|nao precisa mandar)\b/.test(t);
  const pediuQueEscolha =
    /\b(escolhe (voce|vc|pra mim)|voce escolhe|pode escolher|escolha voce|confio (em voce|no seu)|o que voce (indicar|sugerir)|me manda o que|monta (voce|pra mim)|sugere voce)\b/.test(t);
  return dispensou || pediuQueEscolha;
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

// O QUE O CLIENTE PEDIU COM QUANTIDADE E A CASA NAO FAZ.
//
// Serve pra ela dizer "isso a gente nao tem" e seguir com o resto do pedido,
// em vez de repetir o cardapio e travar a conversa.
//
// O DEFEITO DA VERSAO ANTIGA, medido em 20/08/2026: ela lia QUALQUER numero
// seguido de palavra como pedido. O cliente escreveu "ja te falei 3 vezes" e a
// Dora respondeu "A gente nao tem vez tambem" e "Nao temos docinho vezes".
// O cliente ja estava irritado, e levou deboche.
//
// O conserto antigo teria sido somar "vez" e "vezes" na lista de palavras
// ignoradas. Isso e consertar o CASO: amanha aparece "3 tentativas", "2 horas
// esperando", "5 minutos". A lista de tudo que NAO e comida nao acaba.
//
// A regra virou o contrario: so acusa quando a frase e mesmo um PEDIDO. Ou tem
// verbo de comprar, ou tem uma palavra do cardapio junto do numero. Frase de
// reclamacao nao tem nem um nem outro, e sai calada.
//
// Errar pra menos aqui e barato: quem impede produto inventado de entrar no
// pedido e o enum de anotar_item, nao esta funcao. Errar pra mais custa cliente.
export function pedidosQueNaoExistem(fala: string): string[] {
  const conhecidos: string[] = [
    ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.bolos_caseiros?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.outros_produtos ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...(catalogo.bolos_recheados?.faixas ?? []).flatMap((f: { sabores?: string[] }) =>
      (f.sabores ?? []).map((x) => semAcMin(x)),
    ),
    "salgado", "salgados", "docinho", "docinhos", "doce", "doces", "bolo", "bolos", "kg", "pessoas", "convidados",
    "anos", "unidades", "cento", "centos", "pedaco", "pedacos", "fatia", "fatias", "torta", "tortas", "pizza", "pizzas",
    // Palavras que aparecem coladas em numero e nao sao produto nenhum.
    "crianca", "criancas", "adulto", "adultos", "gente", "reais", "real", "hora", "horas",
    "minuto", "minutos", "dia", "dias", "semana", "semanas", "mes", "meses", "ano",
    "caixa", "caixas", "litro", "litros", "gramas", "grama", "mesa", "mesas", "por cento",
    "manha", "tarde", "noite", "meio dia", "meio-dia", "hoje", "amanha", "sabado", "domingo",
    "segunda", "terca", "quarta", "quinta", "sexta", "feriado", "convidado",
    "vez", "vezes", "tentativa", "tentativas", "minutinho", "minutinhos", "pessoa",
  ];

  // Data e hora saem antes: "dia 30/08 de manha" nao e pedido de "manha", e
  // "as 16h" nao e pedido de "h". Foi assim que ela inventou que a padaria
  // nao faz bolo de manha.
  const texto = semAcMin(fala)
    .replace(/[0-9]{1,2}[/.-][0-9]{1,2}(?:[/.-][0-9]{2,4})?/g, " ")
    .replace(/[0-9]{1,2} ?(h|hs|horas?)\b/g, " ")
    .replace(/[0-9]+ ?%/g, " ")
    .replace(/\b(de|da|pela|pra|para) ?(manha|tarde|noite|manhazinha)\b/g, " ")
    // Reclamacao nao e pedido: o trecho depois de "ja te falei" fala da
    // CONVERSA, nao de comida, e ia virar produto inexistente.
    .replace(/\b(ja|voce|vc|te|lhe)? ?(falei|disse|repeti|avisei|expliquei|perguntei|mandei|respondi|pedi) ?(ja|isso|pra voce|pra vc)?\b[^.!?]*/g, " ");

  // PEDIDO ou CONVERSA? So acusa se for pedido.
  const verboDeComprar =
    /\b(quero|queria|quer[ií]amos|vou querer|vamos querer|preciso|precisava|gostaria|gostaríamos|me v[eê]|me da|manda|mande|fazer|faz|faria|tem|teria|encomend|or[cç]ament|pedido|leva|levar|anota|reserva|separa|coloca|custa|pre[cç]o)/;
  const temNomeDoCardapio = conhecidos.some((c) => c.length > 3 && texto.includes(c));
  if (!verboDeComprar.test(texto) && !temNomeDoCardapio) return [];

  // PALAVRA FUNCIONAL NUNCA E PRODUTO, E ESSA LISTA E FECHADA DE VERDADE.
  //
  // "nao 150 de cada" virava o produto "cada". Somar "cada" na lista de
  // palavras que nao sao comida seria cair no mesmo buraco de novo, porque a
  // lista de coisas que nao sao comida nao acaba. Ja a lista de pronomes e
  // determinantes do portugues acaba: e classe fechada, cabe aqui inteira, e
  // nenhuma delas vai virar nome de salgado no ano que vem.
  const FUNCIONAIS = new RegExp(
    "^(cada|todos?|todas?|esses?|essas?|est[ea]s?|aquel[ae]s?|isso|isto|aquilo|tudo|nada|" +
      "mesm[ao]s?|outr[ao]s?|algum|alguns?|algum[ao]s?|nenhum[ao]?s?|ambos?|qualquer|quaisquer|" +
      "total|totais|tipos?|sabor|sabores|cor|cores|unidades?|pe[cç]as?|itens|item|coisa|coisas|" +
      "vez|vezes|jeito|jeitos|forma|formas|resto|restante|parte|partes)( .*)?$",
  );

  const achados: string[] = [];
  const re = /([0-9]+) *(?:de |da |do )?([a-z][a-z ]{2,22})/g;
  let m = re.exec(texto);
  while (m) {
    // O nome termina onde comeca a proxima ideia. Sem isso, "150 casadinho pra
    // sabado" virava o nome "casadinho pra sabado", que contem "sabado", que
    // esta na lista de palavras conhecidas: o produto inexistente passava batido.
    const nome = m[2]
      .trim()
      .split(/ (?:pra|para|mais|ate|no dia|as) /)[0]
      .replace(/ (de|da|do|com|e|pra|para|no|na)$/, "")
      .trim();
    const conhecido = conhecidos.some(
      (c) => c.length > 2 && (nome.includes(c) || c.includes(nome) || nome.startsWith(c.slice(0, 5))),
    );
    if (!conhecido && !FUNCIONAIS.test(nome) && nome.length > 3 && !achados.includes(nome)) achados.push(nome);
    m = re.exec(texto);
  }
  return achados;
}

// O CLIENTE MUDOU O TOTAL. A CONTA E DO CODIGO, E NAO SE PEDE LICENCA.
//
// Caso real de 20/08/2026, o ponto exato em que a secretaria desistiu. O
// pedido estava fechado em 200 salgados. Ela escreveu que ia baixar pra 150.
// A Dora perguntou se podia ajustar. Ela disse que sim. A Dora perguntou de
// novo como queria dividir. Ela mandou dividir igual. A Dora perguntou UMA
// TERCEIRA VEZ se podia aplicar. Seis mensagens gastas numa conta de dividir.
//
// Quem manda mudar ja autorizou a mudanca. Perguntar de novo nao e cuidado, e
// empurrar o trabalho de volta pra quem pediu ajuda.
//
// Devolve o novo total quando ele MUDA um numero, nunca quando ele diz o
// primeiro. Quem separa os dois e o chamador, que so usa isto se a familia ja
// estiver no pedido com outro total.
export function novoTotalQueElePediu(
  fala: string,
): { familia: "salgado" | "docinho"; total: number } | null {
  const t = " " + semAcMin(fala) + " ";
  const familia: "salgado" | "docinho" | null = /salgad/.test(t)
    ? "salgado"
    : /docinho|doce/.test(t)
      ? "docinho"
      : null;

  // "de 200 pra 150": vale o numero DEPOIS do pra, sempre.
  const deParaRe = /\bde ([0-9]{2,4}) (?:pra|para) ([0-9]{2,4})\b/;
  const dePara = t.match(deParaRe);
  if (dePara) return { familia: familia ?? "salgado", total: Number(dePara[2]) };

  // Sem o "de X pra Y", precisa de um sinal de MUDANCA. Numero solto e so
  // numero: "sao 200 convidados" nao e ordem de mudar o pedido.
  const mudou =
    /\b(na verdade|pensando bem|muda|mudar|mudei|troca|trocar|deixa|deixar|faz|fazer|vamos|vamo|melhor|reduz|reduzir|diminui|diminuir|baixa|baixar|aumenta|aumentar|sobe|subir|so|somente|apenas|prefiro|corrige|corrigir|ajusta|ajustar)\b/.test(
      t,
    );
  if (!mudou) return null;

  // O numero que vale e o que esta colado na familia, se houver. Assim
  // "muda pra 150 salgados, sao 80 convidados" nao pega o 80.
  const coladoRe = /\b([0-9]{2,4})\s*(?:un|unidades)?\s*(salgad\w*|docinh\w*|doce\w*)/;
  const colado = t.match(coladoRe);
  if (colado) {
    return { familia: /salgad/.test(colado[2]) ? "salgado" : "docinho", total: Number(colado[1]) };
  }

  // Numero sozinho depois do sinal de mudanca: so serve se ele disse a
  // familia em algum lugar da frase.
  if (!familia) return null;
  const solto = t.replace(/[0-9]{1,2}[/.-][0-9]{1,2}([/.-][0-9]{2,4})?/g, " ").match(/\b([0-9]{2,4})\b/);
  if (!solto) return null;
  return { familia, total: Number(solto[1]) };
}

// REESCALAR MANTENDO O QUE ELE ESCOLHEU.
//
// Baixar de 200 pra 150 nao pode apagar os sabores que ele ja escolheu e
// comecar de novo: seria fazer ele repetir tudo. As mesmas linhas continuam,
// so mudam de tamanho, na mesma proporcao.
//
// A soma bate com o total EXATO. Arredondar cada linha por conta e como o
// pedido vira 149 ou 151, e quem descobre e a equipe na hora de produzir.
export function reescalarParaOTotal(
  itens: { produto: string; qtd: number }[],
  novoTotal: number,
): { produto: string; qtd: number }[] {
  const total = Math.max(0, Math.floor(novoTotal));
  const soma = itens.reduce((s, i) => s + Math.max(0, Math.floor(i.qtd)), 0);
  if (!itens.length || soma <= 0 || !total) return [];
  const bruto = itens.map((i) => ({ produto: i.produto, exato: (Math.max(0, Math.floor(i.qtd)) * total) / soma }));
  const saida = bruto.map((b) => ({ produto: b.produto, qtd: Math.floor(b.exato) }));
  // O resto vai pras linhas de maior fracao, que e a divisao mais justa e faz
  // a soma fechar redondo.
  let falta = total - saida.reduce((s, i) => s + i.qtd, 0);
  const ordem = bruto
    .map((b, i) => ({ i, frac: b.exato - Math.floor(b.exato) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (falta > 0 && ordem.length) {
    saida[ordem[k % ordem.length].i].qtd += 1;
    falta -= 1;
    k += 1;
  }
  return saida.filter((i) => i.qtd > 0);
}

// ELE ACEITOU O QUE ELA OFERECEU: ANOTA, NAO PERGUNTA DE NOVO.
//
// Conversa real de 20/08/2026:
//
//   Dora: 100 coxinha, 100 mini bolha de carne e 100 esfirra de calabresa
//         75 brigadeiro e 75 beijinho. Pode ser assim?
//   ele:  pode ser assim. queria tambem um bolo de bombom de 2kg
//   Dora: Te mandei o cardapio de salgados aqui. Quais salgados voce quer e
//         quantos de cada?
//
// Ele aceitou a lista DELA e ela pediu a lista de volta. Nas duas mensagens
// seguintes ele teve que repetir item por item, e escreveu "ja falei 1 vez".
// O bolo que ele pediu na mesma frase tambem ficou pra tras.
//
// Aceitar oferta e a hora mais barata de fechar um pedido e era onde a
// conversa morria. Anotar deixou de ser decisao dela: e do codigo.
export function aceitouAOferta(fala: string): boolean {
  const t = semAcMin(fala).trim();
  if (!t) return false;
  // Negativa manda mais que o "pode": "pode ser mas tira a coxinha" nao e
  // aceite limpo, e nesse caso quem resolve e ela.
  if (/\b(nao|nem|mas|porem|so que|tira|troca|muda|menos|sem)\b/.test(t)) return false;
  return /\b(pode ser|pode sim|pode mandar|pode anotar|pode fazer|fechado|fechou|isso mesmo|isso ai|e isso|perfeito|show|beleza|blz|ta bom|ta otimo|tudo certo|combinado|concordo|aceito|manda ver|vamos assim|assim ta bom|ok|okay|okey|certo|confirmo|sim)\b/.test(t);
}

// O QUE ELA OFERECEU, LIDO DA PROPRIA MENSAGEM DELA.
//
// Nao guarda estado entre turnos de proposito: a oferta pode ter vindo da
// ferramenta de sortido, de um lembrete do sistema ou da cabeca dela, e o que
// vale e o que o cliente LEU. A fonte da verdade e a mensagem que ele acabou
// de aceitar.
//
// So aceita "numero + produto do cardapio". A tabela de precos que ela manda
// tem o nome ANTES do numero ("coxinha R$ 1,00"), entao cardapio nao vira
// pedido por engano.
export function itensQueElaOfereceu(
  textoDela: string,
): { produto: string; qtd: number; obs: string | null }[] {
  const t = semAcMin(textoDela);
  if (!t) return [];
  const nomes: string[] = [
    ...((catalogo.salgados?.frito?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.salgados?.assado?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
    ...((catalogo.doces?.itens ?? []) as { nome: string }[]).map((i) => semAcMin(i.nome)),
  ].sort((a, b) => b.length - a.length);

  const achados: { produto: string; qtd: number; obs: string | null }[] = [];
  const re = /\b([0-9]{1,4}) *(?:un|unidades)? *(?:de |da |do )?([a-z][a-z çãõáéíóúâêô ]{2,28})/g;
  let m = re.exec(t);
  while (m) {
    const qtd = Number(m[1]);
    const depois = m[2];
    const achou = nomes.find((n) => depois.startsWith(n));
    if (achou && qtd > 0 && !achados.some((a) => a.produto === achou)) {
      // O RECHEIO FAZ PARTE DA OFERTA. Ela ofereceu "100 mini bolha de carne";
      // anotar so "mini bolha" joga fora a metade que a cozinha precisa, e a
      // pergunta do recheio volta como se ele nunca tivesse respondido.
      const sobra = depois.slice(achou.length).trim();
      const obs = /^(de |com )/.test(sobra)
        ? sobra
            .replace(/^(de |com )/, "")
            // "carne e" e o "e" que liga o proximo item da lista, nao parte do
            // recheio. Ficaria escrito na comanda da cozinha exatamente assim.
            .replace(/ (e|ou|mais|com)$/, "")
            .trim()
        : "";
      achados.push({ produto: achou, qtd, obs: obs || null });
    }
    m = re.exec(t);
  }
  // Mais que isso nao e oferta, e tabela de preco. Melhor nao anotar nada do
  // que anotar o cardapio inteiro no pedido de alguem.
  if (achados.length > 8) return [];
  return achados;
}

// QUANTOS ELE PEDIU, LIDO DA CONVERSA INTEIRA.
//
// Caso real de 20/08/2026. A secretaria disse na segunda mensagem "200
// salgados assados e 100 docinhos". Duas mensagens depois pediu o sortido, sem
// repetir o numero, e a sugestao veio com 100 salgados: o codigo procurava a
// quantidade so na ULTIMA fala, nao achava, e usava 100 de padrao.
//
// Ela teve que corrigir tres vezes ("isso ai da 100 salgados so, eu preciso de
// 200", "continua faltando salgado, ai deu 120 e eu quero 200"). Quem tem
// pressa nao volta pra terceira correcao.
//
// Vale o ULTIMO numero que ele falou pra aquela familia: mudar de ideia
// funciona, e a conta acompanha.
export function totalQueElePediu(
  falasDoCliente: string[],
  familia: "salgado" | "docinho",
): number {
  const alvo = familia === "salgado" ? /salgad/ : /docinh|doce/;
  let achado = 0;
  for (const fala of falasDoCliente) {
    const t = semAcMin(fala)
      // Data e hora nunca sao quantidade de salgado.
      .replace(/[0-9]{1,2}[/.-][0-9]{1,2}([/.-][0-9]{2,4})?/g, " ")
      .replace(/[0-9]{1,2} ?(h|hs|horas?)\b/g, " ");
    // "200 salgados", "200 salgados assados", "200 de salgado"
    const re = /\b([0-9]{2,4})\s*(?:un|unidades)?\s*(?:de |da |do )?([a-z]+)/g;
    for (const m of t.matchAll(re)) {
      if (alvo.test(m[2])) achado = Number(m[1]);
    }
  }
  return achado;
}

// ELE PEDIU PRA VER O PEDIDO ANTES DE FECHAR.
//
// Caso real de 20/08/2026: "Calma, me manda o pedido final pra eu conferir
// antes. Quero ver item por item com as quantidades". A Dora respondeu com
// outra pergunta de confirmacao, e depois com o cardapio. A cliente pediu duas
// vezes e nunca viu o pedido.
//
// Esse e o momento em que o cliente decide se confia. Negar a conferencia num
// pedido de centenas de reais e o jeito mais rapido de perder a venda, e o
// resumo so existia no fechamento, nunca no meio.
export function pediuVerOPedido(fala: string): boolean {
  const t = semAcMin(fala);
  if (!t) return false;
  return /\b(me (manda|mande|passa|envia|mostra)|manda|mostra|quero ver|posso ver|deixa eu ver|como (ficou|esta|ta)|ficou como|resume|resumo|confer(ir|e)|revisar|repassa)\b[^.!?]{0,40}\b(pedido|resumo|lista|itens?|item por item|quantidades?|tudo|como ficou)\b|\b(item por item|pedido final|resumo do pedido|como ficou o pedido)\b/.test(
    t,
  );
}

// PORTAO FINAL DO CARDAPIO: peca recusada, ou de familia ja escolhida, nao sai.
//
// Existem quatro caminhos que enfileiram cardapio (a ferramenta, a promessa no
// texto dela, a lista digitada e o pedido do cliente). Barrar em cada um deles
// deixou passar: a ferramenta recusou e a promessa mandou assim mesmo. Aqui e o
// unico lugar por onde a peca sai de verdade.
//
// Duas coisas travam a peca:
//
//   1. Ele DISPENSOU a familia ("nao quero docinho"). Oferecer de novo o que a
//      pessoa acabou de recusar e o retrato do atendimento que nao escuta.
//
//   2. Ele JA ESCOLHEU aquela familia. Caso real de 20/08/2026: no meio de uma
//      correcao de quantidade, com salgados e docinhos anotados, a Dora
//      despejou as duas pecas de uma vez. A cliente tinha acabado de escrever
//      "nao apaga os docinhos" e recebeu de volta a tabela de precos dos
//      docinhos. Parece que a conversa recomecou do zero, que e exatamente o
//      medo de quem esta falando com uma IA.
//
// Se ele pedir pra ver, ele pede, e ai o pediuAgora libera as duas travas.
export function pecasPermitidas(
  pecas: string[],
  ultimaFala: string,
  naoQuer: string,
  jaEscolhidos: { categoria?: string | null }[] = [],
  // A conversa inteira do cliente: e nela que ele diz que nao vai olhar
  // cardapio nenhum, e isso vale pro resto do atendimento, nao so pro turno.
  falasDoCliente: string[] = [],
): string[] {
  if (pecas.length === 0) return pecas;
  // ELE DISSE QUE NAO VAI OLHAR: nao manda, nem a primeira vez.
  //
  // Teste ao vivo de 21/08/2026: a secretaria escreveu "nao tenho tempo de
  // olhar cardapio nao, to correndo, escolhe voce" e recebeu DUAS imagens do
  // cardapio de salgados. Quem esta correndo e recebe cardapio pela segunda vez
  // larga o celular: a pessoa pediu ajuda e recebeu tarefa.
  //
  // Se ele mudar de ideia e pedir, o pediuAgora logo abaixo libera.
  const naoOlha = naoVaiOlharCardapio(falasDoCliente.length ? falasDoCliente : [ultimaFala]);
  const dito = semAcMin(ultimaFala);
  const NEGA = "(sem|nao quero|nem|nao vou querer)";
  const recusou: [string, RegExp][] = [
    ["salgados", new RegExp(NEGA + "[^.]{0,24}salgad")],
    ["docinhos", new RegExp(NEGA + "[^.]{0,24}(docinho|doce)")],
    ["bolos-festa", new RegExp(NEGA + "[^.]{0,24}bolo")],
  ];
  // A RECUSA GRAVADA E UMA LISTA, NAO UMA FRASE.
  //
  // O campo nao_quer guarda "salgado, docinho, bolo": so as palavras, sem
  // negacao nenhuma, porque a negacao ja aconteceu quando aquilo foi gravado.
  // A guarda juntava esse campo com a fala do cliente e passava tudo pelos
  // regex de negacao acima, entao a recusa gravada NUNCA batia. Quem tinha
  // dispensado docinho na mensagem anterior recebia o cardapio de docinho na
  // seguinte, e a unica coisa que segurava era a fala do momento.
  const guardado = semAcMin(naoQuer);
  const recusouAntes: [string, RegExp][] = [
    ["salgados", /salgad/],
    ["docinhos", /docinho|doce/],
    ["bolos-festa", /bolo/],
  ];
  // Pediu agora, com todas as letras: manda mesmo assim.
  // CITAR A PALAVRA CARDAPIO NAO E PEDIR CARDAPIO.
  //
  // pediuAgora procura a palavra "cardapio" na fala, e a frase da cliente era
  // "NAO TENHO TEMPO DE OLHAR CARDAPIO NAO, to correndo". Ela dizendo que nao
  // queria contava como pedido, e as duas imagens saiam do mesmo jeito. A
  // guarda de cima existia e nunca chegava a rodar.
  //
  // A ordem passa a ser: pedido EXPLICITO ganha de tudo, recusa ganha da mencao
  // solta, e mencao solta ainda libera pra quem so citou de passagem.
  const pedeExplicito =
    /(^|[^a-z])(me manda|manda (o |os )?card|pode mandar|quero ver|deixa eu ver|me mostra|envia (o |os )?card)/i.test(
      String(ultimaFala || ""),
    );
  if (pedeExplicito) return pecas;
  if (naoOlha) return [];
  const pediuAgora = /card[áa]pio|me manda|quais|que tipos|op[çc][õo]es|que sabores/i.test(String(ultimaFala || ""));
  if (pediuAgora) return pecas;
  const fora = recusou.filter(([, re]) => re.test(dito)).map(([peca]) => peca);
  for (const [peca, re] of recusouAntes) if (guardado && re.test(guardado)) fora.push(peca);
  const temFamilia = (pref: string) => jaEscolhidos.some((i) => String(i.categoria || "").startsWith(pref));
  if (temFamilia("salgado")) fora.push("salgados");
  if (temFamilia("docinho")) fora.push("docinhos");
  if (temFamilia("bolo_festa")) fora.push("bolos-festa");
  return pecas.filter((c) => !fora.includes(c));
}

// PERGUNTA DE PRECO SE RESPONDE COM NUMERO, EM QUALQUER ORDEM DE PALAVRAS.
//
// Conversa real de 20/08/2026:
//
//   cliente: bom dia, quanto custa o cento de salgado
//   Dora:    Salgado frito sai R$ 1,00 a unidade (R$ 100,00 o cento) e o
//            assado R$ 1,25 (R$ 125,00 o cento).
//   cliente: e o docinho, quanto fica
//   Dora:    Te mandei o cardapio de docinhos aqui. Quer que eu te diga o preco
//            de algum sabor especifico?
//
// A mesma pergunta, com as palavras em outra ordem, ficou sem numero. O codigo
// tinha o preco na mao e nao entrou, porque o gatilho exigia "quanto custa o
// docinho" nessa ordem exata. A cliente parou de responder ali.
//
// O outro lado importa igual: "quantos salgados por pessoa" e pergunta de
// rendimento, e tabela de preco no meio dela e resposta errada. Por isso o
// "quanto" sozinho fica de fora, ele casa dentro de "quantos".
export function perguntouPrecoDeFamilia(fala: string): boolean {
  const t = String(fala ?? "");
  const ehPergunta = /(quanto (custa|fica|sai|ta|e|sao|vale)|qual (o|e o) (pre[çc]o|valor)|pre[çc]o d|valor d)/i.test(t);
  // "DOCE" DENTRO DE OUTRO PRODUTO NAO E A FAMILIA DOCINHO.
  //
  // Teste ao vivo de 21/08/2026. O cliente perguntou "quanto custa a TORTA
  // DOCE?" e recebeu "Docinho sai R$ 1,25 cada (R$ 125,00 o cento)". A torta
  // doce e vendida por quilo e custa dezenas de reais: a resposta estava
  // errada em ordem de grandeza, e saiu com a confianca de quem sabe.
  //
  // A palavra doce aparece dentro de torta doce, pizza doce e mini bolha
  // doce, e todos tem preco proprio. Quando o produto vem antes, quem manda
  // e o produto.
  const outroProduto = /(torta|pizza|mini bolha|cuca|bolo salgado)[a-z ]{0,10}doce/i.test(t);
  const citouFamilia = !outroProduto && /salgad|docinh|doce|bolo|cento/i.test(t);
  return (ehPergunta && citouFamilia) || /(^|\W)(e )?o cento/i.test(t);
}

// A PERGUNTA CURTA CONTINUA A ANTERIOR.
//
// Teste ao vivo de 21/08/2026:
//
//   cliente: quanto custa a torta doce?
//   Dora:    A torta doce sai R$ 33,90 o quilo. Qual sabor voce quer?
//   cliente: e a salgada?
//   Dora:    Qual sabor de torta salgada voce quer?
//
// A segunda pergunta e a mesma da primeira. Em portugues a elipse guarda o
// nucleo ("torta") e troca so o modificador ("doce" -> "salgada"), e todo mundo
// entende menos o codigo, que procurava verbo de preco e nome de produto na
// frase e nao achava nenhum dos dois. Quem pergunta preco duas vezes e recebe
// numero uma vez fica achando que a segunda coisa e cara.
//
// Devolve o termo remontado ("torta salgada"), pra quem chamou saber DO QUE ele
// esta falando. null quando nao e continuacao.
export function perguntaElipticaDePreco(fala: string, falaAnterior: string): string | null {
  const limpo = (t: string) =>
    String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const atual = limpo(fala);
  const antes = limpo(falaAnterior);
  if (!atual || !antes) return null;
  // Curta e comecando por "e": e assim que a continuacao aparece. Frase longa
  // ja se explica sozinha e cai nas outras guardas.
  const palavras = atual.split(" ");
  if (palavras.length > 5 || palavras[0] !== "e") return null;
  // A anterior tinha que ser pergunta de preco: sem isso nao ha o que herdar.
  if (!/(quanto (custa|fica|sai|ta|e)|qual (o|e o) (preco|valor)|preco d|valor d)/.test(antes)) return null;
  // ARTIGO NAO E MODIFICADOR. Sobra o que ele trocou: "salgada", "frito".
  const vazias = new Set(["e", "o", "a", "os", "as", "de", "do", "da", "um", "uma", "custa", "fica", "sai", "quanto", "qual", "preco", "valor"]);
  // CONVERSA NAO E CONTINUACAO. "e ai, tudo bem?" comeca com "e" e e curta, e
  // virava "torta tudo bem". Lista fechada, que palavra de conversa e pouca.
  const conversa = /(^| )(ai|tudo|bem|blz|beleza|obrigad|valeu|entao|certo|sim|nao|ok|oi|ola)( |$)/;
  if (conversa.test(atual)) return null;
  const modificador = palavras.filter((w) => !vazias.has(w) && w.length >= 3);
  if (!modificador.length) return null;
  // O NUCLEO E O SUBSTANTIVO DA PERGUNTA ANTERIOR, o que ela nao trocou.
  const nucleo = antes.split(" ").filter((w) => !vazias.has(w) && w.length >= 4);
  if (!nucleo.length) return null;
  return (nucleo[0] + " " + modificador.join(" ")).trim();
}

// A HORA ELE JA DISSE. TIRA A PERGUNTA DO TEXTO.
//
// Teste ao vivo de 21/08/2026. A cliente abriu com "dia 27/09 as 16h" e a
// primeira resposta ja trazia "me fala o nome de quem vai retirar, QUE HORAS, e
// como prefere pagar". A instrucao de nao perguntar existia e foi ignorada:
// instrucao no prompt e pedido, nao garantia. Aqui a pergunta sai do texto.
//
// Recorte fechado de propósito. Frase que nao esta na lista fica como esta:
// texto errado e ruim, texto mutilado e pior, e isso ja aconteceu com o valor
// do topo.
export function textoSemPerguntaDeHora(texto: string): string {
  let t = String(texto ?? "");
  if (!t.trim()) return t;
  const cortes: [RegExp, string][] = [
    [/, que horas,? e /gi, " e "],
    [/, que horas( sera| e)? (a|da) retirada,? e /gi, " e "],
    [/, (qual|que) (o )?hor[áa]rio( de retirada)?,? e /gi, " e "],
    [/, (o |a )?hor[áa]rio (de|da) retirada,? e /gi, " e "],
    // "e o pedido fica no nome de quem, QUE HORAS VOCE RETIRA, e como prefere
    // pagar?" escapou do recorte anterior por causa do verbo no meio.
    [/,? que horas (voc[êe] )?(vai )?(retira|retirar|busca|buscar|pega|pegar)( o pedido)?,? e /gi, " e "],
    [/,? que horas (voc[êe] )?(vai )?(retira|retirar|busca|buscar|pega|pegar)( o pedido)?([,.?])/gi, "$5"],
    [/ e que horas([,.?])/gi, "$1"],
    [/ e (qual|que) (o )?hor[áa]rio( de retirada)?([,.?])/gi, "$4"],
    [/, que horas([,.?])/gi, "$1"],
  ];
  for (const [de, para] of cortes) t = t.replace(de, para);
  return t.replace(/ +/g, " ").replace(/ ([,.?])/g, "$1");
}

// A OBSERVACAO E UMA FICHA, NAO UM BILHETE PENSANDO ALTO.
//
// Rastro do medidor de 20/08/2026, cenario de pizza (nota 1/5). A Dora chamou
// anotar_item assim:
//
//   obs: "para sexta as 19h, sabor calabresa nao existe, ofereco calabresa
//         acebolada ou calabresa?"
//
// Ela escreveu o RACIOCINIO dela dentro do campo que vai pra comanda da
// cozinha. A guarda de observacao inventada olhou aquilo, achou "calabresa
// acebolada", que o cliente nunca disse, e recusou o item INTEIRO. A pizza
// nunca entrava no pedido, e ela tentava de novo com outra frase, e recusava
// de novo. Oito recusas numa conversa.
//
// Recusar aqui e o pior dos mundos: o cliente pediu, existe no cardapio, e a
// venda morre por causa da redacao dela. O certo e LIMPAR e seguir.
//
// De quebra, isso resolve o outro estrago: sem a limpeza, "sabor calabresa nao
// existe" ia impresso na comanda, e a cozinha leria isso.
export function obsSemDeliberacao(obs: unknown): string {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return "";
  const DELIBERACAO =
    /\?|\bnao (existe|tem|temos|ha)\b|\bofere[cç]|\bsugiro\b|\bsugerir\b|\bpode ser\b|\bconfirmar\b|\bperguntar\b|\bverificar\b|\bavisar\b|\bopcoes?\b|\bou\b.*\bou\b|\bprecisa\b|\bfalta escolher\b|\bnao informad|\bnao especificad|\bnao definid|\ba definir\b|\bnao escolhid/i;
  const partes = bruto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    // Fragmento que e frase de pensamento sai. O que sobra e ficha: sabor, cor,
    // tema, hora, nome.
    .filter((p) => !DELIBERACAO.test(semAcMin(p)));
  return partes.join(", ");
}

// DUAS CORES DE FORMINHA SAO DUAS, NAO UMA.
//
// Teste ao vivo de 21/08/2026. A cliente respondeu "pode ser rosa e dourado" e
// o pedido fechou com "brigadeiro (forminha rosa)" nos quatro docinhos. O
// dourado sumiu no caminho, e quem monta a bandeja na cozinha ia embrulhar
// tudo de rosa.
//
// Devolve as cores que ele falou, na ordem, sem repetir.
export function coresDeForminhaQueEleFalou(fala: string): string[] {
  const t = semAcMin(fala);
  if (!t.trim()) return [];
  const cores = [
    "amarelo", "azul", "branco", "dourado", "laranja", "lilas", "marrom", "pink",
    "prata", "preto", "rosa", "roxo", "verde", "vermelho", "laminado",
  ];
  const achadas: { cor: string; onde: number }[] = [];
  for (const c of cores) {
    const raiz = c.slice(0, Math.max(4, c.length - 1));
    const onde = t.indexOf(raiz);
    // NA ORDEM EM QUE ELE FALOU: "rosa e dourado" nao vira "dourado e rosa".
    // A cozinha le a observacao como a pessoa ditou.
    if (onde >= 0 && !achadas.some((x) => x.cor === c)) achadas.push({ cor: c, onde });
  }
  return achadas.sort((x, y) => x.onde - y.onde).map((x) => x.cor);
}

// NUMERO ANTES DO SABOR E QUANTIDADE, NAO SABOR A MAIS.
//
// Teste ao vivo de 21/08/2026, o pior caso do dia. O cliente escreveu:
//
//   quero fazer um pedido de pizza
//   2 calabresa e 1 de frango pra hoje a noite
//
// Ele pediu TRES pizzas. A Dora anotou "2 pizzas inteiras, uma com calabresa
// acebolada e outra com sabor que voce ainda vai escolher" e o pedido fechou
// com UMA pizza de R$ 120,00, observacao "calabresa, frango". O cliente ia
// receber uma pizza tendo pedido tres, e a padaria ia faturar 120 em vez de
// 360.
//
// Pizza aceita ate quatro sabores na mesma forma, e foi por isso que os
// numeros viraram sabores. Mas "2 calabresa" nao e sabor: e a conta dele.
//
// Devolve os pares na ordem em que ele escreveu. Sabor que nao existe volta do
// jeito que ele falou, pra quem chamou poder perguntar em vez de inventar.
export function quantidadePorSabor(
  fala: string,
  sabores: string[],
): { qtd: number; sabor: string; existe: boolean }[] {
  const t = semAcMin(fala);
  if (!t.trim() || !sabores.length) return [];
  const limpos = sabores.map((x) => ({ certo: x, chave: semAcMin(x) }));
  const achados: { qtd: number; sabor: string; existe: boolean; onde: number }[] = [];
  // "2 calabresa", "2 de calabresa", "2x calabresa", "duas calabresa".
  const numero: Record<string, number> = {
    uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  };
  // O SABOR PARA NA CONJUNCAO. Guloso demais, "2 calabresa e 1 de frango"
  // engolia o segundo numero e virava uma pizza so. No maximo tres palavras.
  const re =
    /(\d{1,3}|uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez) *x? *(?:de +)?([a-z0-9]+(?: (?!e |com o|pra |para |no |na |as |ate )[a-z0-9]+){0,2})/g;
  for (const m of t.matchAll(re)) {
    const qtd = Number(m[1]) || numero[m[1]] || 0;
    if (!qtd) continue;
    const resto = String(m[2] ?? "").trim();
    // O sabor mais LONGO que casa vence: "frango com catupiry" antes de "frango".
    // "AS 20H" NAO E "20 DE HOT DOG".
    //
    // O rastro pegou: quantidade por sabor: 20 h (nao existe). A hora da
    // retirada virava pedido porque "h" e prefixo de "hot dog". Fragmento de
    // menos de tres letras nao identifica sabor nenhum.
    const inicio = resto.split(" ")[0];
    const casou =
      inicio.length < 3
        ? undefined
        : limpos
            .filter((x) => resto.startsWith(x.chave) || x.chave.startsWith(inicio))
            .sort((a, b) => b.chave.length - a.chave.length)[0];
    const exato = limpos
      .filter((x) => resto.startsWith(x.chave))
      .sort((a, b) => b.chave.length - a.chave.length)[0];
    if (exato) achados.push({ qtd, sabor: exato.certo, existe: true, onde: m.index ?? 0 });
    else if (casou) achados.push({ qtd, sabor: resto.split(" ")[0], existe: false, onde: m.index ?? 0 });
  }
  return achados
    .sort((a, b) => a.onde - b.onde)
    .map(({ qtd, sabor, existe }) => ({ qtd, sabor, existe }));
}

// AS PECAS DO BOLO QUE ELE ACEITOU.
//
// Caso real de 21/08/2026. A mae escreveu "papel de arroz e topo sim, forminha
// azul, nome Amanda, pix" e o pedido fechou com o papel de arroz e SEM o topo:
//
//   bolo bombom :: tema homem aranha, nome Theo, 5 anos, papel de arroz
//
// O topo e a peca que a equipe cota a parte e que a cozinha manda fazer fora.
// Sumir com ele e o pedido chegar sem a peca no dia da festa, e a padaria
// deixar de faturar o que ja tinha sido combinado.
//
// Numa rodada ele entrava e na outra nao, com a mesma frase do cliente: quando
// a decisao depende de sorte, ela sai do prompt e vem pro codigo.
export function pecasDoBoloQueEleAceitou(fala: string): { topo: boolean; papel: boolean } {
  const t = semAcMin(fala);
  if (!t.trim()) return { topo: false, papel: false };
  // "sem topo" e o contrario de aceitar, e vem antes de tudo.
  const negouTopo = /(sem|nao quero|nao vou querer|dispensa) *(o |um )?topo/.test(t);
  const negouPapel = /(sem|nao quero|nao vou querer|dispensa) *(o |um )?papel/.test(t);
  const falouTopo = /topo/.test(t) && !negouTopo;
  const falouPapel = /papel de arroz|papel arroz/.test(t) && !negouPapel;
  // A palavra sozinha ja e aceite quando ela veio numa resposta afirmativa:
  // "papel de arroz e topo sim", "quero os dois", "pode por os dois".
  const disseSim = /(sim|quero|pode|isso|manda|ok|claro|com certeza|os dois|as duas|so o|somente|apenas)/.test(t);
  return {
    topo: falouTopo && (disseSim || /topo (de bolo|sim)/.test(t)),
    papel: falouPapel && (disseSim || /papel de arroz sim/.test(t)),
  };
}

// A MESMA COISA DUAS VEZES NA OBSERVACAO E UMA COISA SO.
//
// Caso real de 21/08/2026, festa de 5 anos. A linha do bolo chegou assim no
// cliente e na comanda:
//
//   bolo bombom (tema homem aranha, nome Theo, 5 anos, papel de arroz,
//                topo de bolo, tema homem aranha, nome Theo, 5 anos)
//
// O tema, o nome e a idade duas vezes cada. A observacao cresce quando o codigo
// completa o que ela escreveu e ela reescreve por cima no turno seguinte. Quem
// le isso na cozinha para pra conferir se sao duas pecas.
export function obsSemRepeticao(obs: unknown): string {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return "";
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const p of bruto.split(",")) {
    const limpo = p.trim();
    if (!limpo) continue;
    const chave = semAcMin(limpo).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    partes.push(limpo);
  }
  return partes.join(", ");
}

// PERGUNTA JA FEITA NAO SE FAZ DE NOVO.
//
// A auditoria das 40 conversas da medicao de 21/08/2026 apontou o mesmo padrao
// em quatro delas:
//
//   voce vai querer salgado tambem pra festa?
//   ...
//   vai querer salgado tambem pra festa?
//
// Repetir a mesma pergunta e o que faz a conversa soar de robo, e o cliente que
// ja ignorou uma vez vai ignorar de novo: quem insiste esta pedindo pra ser
// deixado no vacuo. Uma oferta se faz UMA vez.
//
// Compara pelo comeco da pergunta, sem acento e sem pontuacao, que e o que
// muda quando ela reescreve a mesma coisa ("voce vai querer" / "vai querer").
export function textoSemPerguntaJaFeita(texto: string, falasDela: string[]): string {
  // Resumo de pedido nao se mexe: os numeros sao do motor, nao dela.
  if (/\*Pedido recebido\*|\*Total:/i.test(String(texto ?? ""))) return String(texto ?? "");
  const bruto = String(texto ?? "");
  if (!bruto.trim() || !falasDela.length) return bruto;
  const normal = (t: string) =>
    semAcMin(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  // O nucleo da pergunta: tira o preambulo e fica com as palavras que contam.
  const nucleo = (frase: string) => {
    const vazias = new Set(["e", "entao", "ai", "voce", "vc", "ja", "agora", "so", "me", "diz", "fala", "mas", "ah", "o", "a", "que"]);
    return normal(frase).split(" ").filter((w) => !vazias.has(w)).slice(0, 5).join(" ");
  };
  const jaFeitas = new Set(
    falasDela
      .flatMap((f) => String(f ?? "").match(/[^.!?]*\?/g) ?? [])
      .map(nucleo)
      .filter((x) => x.split(" ").length >= 3),
  );
  if (!jaFeitas.size) return bruto;
  const partes = bruto.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const ficam = partes.filter((frase) => {
    if (!frase.includes("?")) return true;
    return !jaFeitas.has(nucleo(frase));
  });
  if (!ficam.length || ficam.length === partes.length) return bruto;
  const saida = ficam.join(" ").replace(/ +/g, " ").trim();
  return saida || bruto;
}

// PEDIDO VAZIO NAO PEDE NOME NEM PAGAMENTO.
//
// Teste ao vivo de 21/08/2026, formatura de 80 pessoas. A primeira resposta
// trouxe o orcamento de R$ 1.675,20 e ja emendou:
//
//   E o pedido fica no nome de quem, como vai pagar e quem retira?
//
// Nao havia um item anotado. Pedir dado de fechamento antes de existir pedido
// e o que faz a pessoa achar que caiu num formulario, e a regra de deixar isso
// pro fim ja estava escrita no prompt: escrita e ignorada.
//
// Devolve o texto sem essas perguntas. Se o corte deixar a frase quebrada,
// volta o original.
export function textoSemPedirDadosDeFechamento(texto: string): string {
  const bruto = String(texto ?? "");
  if (!bruto.trim()) return bruto;
  // POR SENTENCA INTEIRA, NAO POR PEDACO.
  //
  // A primeira versao recortava trechos e deixou isto na tela do cliente:
  //
  //   E o pedido fica no nome de quem, que horas voce retira Pode ser assim?
  //
  // Frase quebrada e pior que frase errada, e o defeito era meu. Aqui a
  // sentenca inteira sai ou fica: nao existe meio termo.
  const PEDE_DADO =
    /(o pedido fica (no|em) nome de quem|nome de quem vai retirar|nome de quem retira|como (voc[êe] )?(vai |prefere )?pagar|forma de pagamento|quem retira)/i;
  // RESUMO DE PEDIDO NAO SE MEXE.
  //
  // A linha "*Forma de pagamento:* pix" casa com o recorte e sumia do recibo do
  // cliente. Resumo e montado pelo codigo com os numeros do motor: guarda de
  // texto nao tem o que fazer ali, e quando mexe quem inventa passa a ser a
  // guarda. Ja aconteceu antes, com o valor do topo.
  if (/\*Pedido recebido\*|\*Total:/i.test(bruto)) return bruto;
  const partes = bruto.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const ficam = partes.filter((frase) => !PEDE_DADO.test(frase));
  if (!ficam.length || ficam.length === partes.length) return bruto;
  const saida = ficam.join(" ").replace(/ +/g, " ").trim();
  return saida || bruto;
}

// O NOME ELE JA DEU. TIRA A PERGUNTA DO TEXTO.
//
// Teste ao vivo de 21/08/2026. A cliente escreveu "sem topo e sem papel de
// arroz, nome Marcia, pix" e recebeu o pedido fechado terminando assim:
//
//   Ja passei pra nossa equipe. So me diz: o pedido fica no nome de quem?
//
// O nome estava na mesma mensagem que fechou o pedido, e ele foi gravado
// certo: ela perguntou o que ja tinha na mao. Mesma classe da pergunta de
// hora, mesmo remedio, e pelo mesmo motivo: instrucao no prompt e pedido, isto
// aqui e garantia. Recorte fechado, frase fora da lista fica como esta.
export function textoSemPerguntaDeNome(texto: string): string {
  // Resumo de pedido nao se mexe: os numeros sao do motor, nao dela.
  if (/\*Pedido recebido\*|\*Total:/i.test(String(texto ?? ""))) return String(texto ?? "");
  let t = String(texto ?? "");
  if (!t.trim()) return t;
  const cortes: [RegExp, string][] = [
    // Primeiro os que deixam a frase de pe: o nome sai e o resto continua.
    [/,? e o pedido fica (no|em) nome de quem\??/gi, ""],
    [/o nome de quem vai retirar,? e /gi, ""],
    [/o nome de quem retira,? e /gi, ""],
    [/,? o nome de quem vai retirar([,.?])/gi, "$1"],
    [/ *(s[óo] )?me diz:? o pedido fica no nome de quem\??/gi, ""],
    [/ *(s[óo] )?me (diz|fala|passa) o nome de quem vai retirar\??/gi, ""],
    [/ *o pedido fica (no nome de quem|em nome de quem)\??/gi, ""],
    [/,? e (o pedido fica )?no nome de quem\??/gi, ""],
    [/,? (qual|que) (o )?nome de quem vai retirar\??/gi, ""],
  ];
  for (const [de, para] of cortes) t = t.replace(de, para);
  t = t.replace(/ +/g, " ").replace(/ ([,.?])/g, "$1").trim();
  // Virgula que ficou pendurada depois do corte: "Anotei tudo," vira "Anotei
  // tudo". Sem isto a validacao abaixo desiste do corte por causa da virgula.
  t = t.replace(/,+ *([.?!])/g, "$1").replace(/,+ *$/g, "").trim();
  // FRASE QUEBRADA E PIOR QUE FRASE ERRADA. Se o corte deixou o texto comecando
  // com conjuncao ou terminando pendurado, devolve o original: o defeito de
  // mutilar texto ja aconteceu uma vez, com o valor do topo.
  if (/^(e|ou|,)( |$)/i.test(t) || / (e|ou|,)$/i.test(t) || /,$/.test(t) || !t) return String(texto ?? "");
  return t;
}

// O NOME DE QUEM RETIRA NAO E OBSERVACAO DO BOLO.
//
// Teste ao vivo de 21/08/2026. A cliente escreveu "sem topo e sem papel de
// arroz, nome Marcia, pix" e o pedido fechou assim:
//
//   bolo morango (pao de lo branco, sem topo e sem papel de arroz, nome Marcia)
//
// O nome dela e dado do PEDIDO e tem campo proprio. Na observacao do bolo ele
// vira instrucao pra cozinha, e cozinha que le "nome Marcia" num bolo escreve
// Marcia no bolo. Este bolo nem leva peca: foi pedido sem topo e sem papel.
//
// Quando o bolo TEM topo ou papel de arroz o nome fica, porque ai ele e o nome
// do aniversariante e a peca precisa dele.
export function obsSemONomeDeQuemRetira(obs: unknown, nomeDoCliente: unknown): string {
  const bruto = String(obs ?? "").trim();
  const nome = String(nomeDoCliente ?? "").trim();
  if (!bruto || !nome) return bruto;
  const temPeca = /topo|papel de arroz/i.test(semAcMin(bruto)) && !/sem topo|sem papel de arroz/i.test(semAcMin(bruto));
  if (temPeca) return bruto;
  const primeiro = semAcMin(nome).split(" ")[0];
  if (!primeiro || primeiro.length < 3) return bruto;
  const partes = bruto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const t = semAcMin(p);
      // So sai o fragmento que E o nome: "nome Marcia", "em nome de Marcia".
      return !(/^(no |em )?nome( de| da| do)? /.test(t) && t.includes(primeiro));
    });
  return partes.join(", ");
}

// RESTRICAO QUE A CASA NAO FAZ NAO ENTRA NO PEDIDO.
//
// Medicao de 20/08/2026: o pedido fechou com "30 brigadeiro (sem lactose,
// forminha rosa)". A cliente tinha PERGUNTADO se tem docinho sem lactose, a
// Dora respondeu certo que nao tem, e mesmo assim a restricao foi parar na
// observacao do item.
//
// A observacao vai pra comanda da cozinha e pro resumo que o cliente recebe.
// Ou seja: a padaria produz brigadeiro normal e entrega pra alguem que leu
// "sem lactose" na confirmacao. Se essa pessoa tem intolerancia, isso passa de
// prejuizo pra problema de saude.
//
// O arquivo de fatos ja impede ela de AFIRMAR que a casa faz. Isto aqui e a
// outra porta, que estava aberta: o campo de observacao.
//
// Nao recusa o item. O brigadeiro e uma venda de verdade, so a promessa que a
// casa nao cumpre e que sai.
export function restricoesQueACasaNaoFaz(obs: unknown): string[] {
  const t = semAcMin(obs);
  if (!t) return [];
  const NAO_FAZ: [string, RegExp][] = [
    ["sem lactose", /\b(sem|0 ?%|zero) ?lactose\b|\blactose ?free\b|\bdeslactosad/],
    ["sem gluten", /\b(sem|0 ?%|zero) ?gluten\b|\bgluten ?free\b/],
    ["vegano", /\bvegan[oa]s?\b|\bsem (ingredientes? de )?origem animal\b/],
    ["diet", /\bdiet\b|\b(sem|0 ?%|zero) ?a[cç]ucar\b|\bzero a[cç]ucar\b/],
    ["integral", /\bintegral\b/],
  ];
  return NAO_FAZ.filter(([, re]) => re.test(t)).map(([nome]) => nome);
}

// A mesma observacao, sem a promessa que a casa nao cumpre.
export function obsSemRestricaoInventada(obs: unknown): string {
  const bruto = String(obs ?? "").trim();
  if (!bruto) return "";
  return bruto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => restricoesQueACasaNaoFaz(p).length === 0)
    .join(", ");
}

// TEMA DO TOPO NAO E SABOR DE BOLO, MAS A PALAVRA "BOLO" NAO E TEMA.
//
// A guarda original existe por um motivo bom: quem pede topo de unicornio nao
// pediu bolo de unicornio, e responder "a gente nao faz bolo de unicornio"
// derruba a venda por engano.
//
// So que ela pegava a primeira palavra depois de "topo/tema" e comparava com o
// nome do produto. Teste ao vivo de 20/08/2026:
//
//   cliente: de bombom, 3 kg. e queria um topo de bolo tema homem aranha
//   Dora:    anotar_item("bolo bombom", 3 kg)     -> RECUSADO
//   Dora:    anotar_item("topo de bolo", tema)    -> RECUSADO
//   Dora ao cliente: "Anotei o bolo de bombom com 3 kg e o topo"
//
// O tema capturado foi "bolo tema homem aranha", e a primeira palavra dele e
// "bolo". Como TODO bolo do cardapio comeca com "bolo", a guarda passou a
// recusar qualquer bolo de qualquer cliente que dissesse "topo de bolo". E
// recusou tambem o proprio topo, que contem "bolo" no nome.
//
// Resultado: pedido vazio no banco com o cliente ouvindo "anotei". E o pior
// tipo de defeito que existe aqui, porque ninguem percebe ate a retirada.
//
// Devolve o tema de verdade, ou null quando nao ha tema nenhum.
export function temaDoTopoNaFala(fala: string): string | null {
  const t = String(fala ?? "");
  // "tema X" e mais especifico que "topo de X": tenta primeiro.
  const porTema = t.match(/\btema\s+(?:de\s+|do\s+|da\s+)?([\wáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ -]{3,30})/i);
  const porTopo = t.match(/\b(?:topo|papel de arroz)\s+(?:de\s+|do\s+|da\s+)?([\wáàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ -]{3,30})/i);
  const cru = String((porTema ?? porTopo ?? [])[1] ?? "").trim();
  if (!cru) return null;
  // "topo de bolo tema homem aranha" -> o tema e "homem aranha", nao "bolo".
  const limpo = cru
    .replace(/^(bolo|bolos)\b\s*/i, "")
    .replace(/^(tema|de|do|da)\b\s*/i, "")
    .replace(/\b(por favor|pra|para|obrigad[oa])\b.*$/i, "")
    .trim();
  if (!limpo) return null;
  // Palavra generica nao e tema: se sobrou so isso, nao ha tema pra proteger.
  const GENERICO = /^(bolo|bolos|festa|aniversario|niver|crianca|menino|menina|filho|filha|cima|arroz)$/i;
  if (GENERICO.test(limpo)) return null;
  return limpo;
}

// O produto que ela quer anotar e, na verdade, o TEMA virando sabor?
//
// So acusa quando o nome do produto carrega a palavra do tema de um jeito que
// nao existe no cardapio. Acessorio (topo, papel de arroz) nunca cai aqui: ele
// E o item do tema, nao a confusao com ele.
export function temaViroouSabor(produto: string, fala: string, obs: unknown): boolean {
  const nome = semAcMin(produto).trim();
  if (!nome) return false;
  if (/^(topo de bolo|topo|papel de arroz)/.test(nome)) return false;
  if (/topo|papel de arroz/.test(semAcMin(obs))) return false;
  const tema = temaDoTopoNaFala(fala);
  if (!tema) return false;
  const primeira = semAcMin(tema).split(/\s+/)[0];
  if (!primeira || primeira.length < 4) return false;
  // "bolo" nunca serve de prova: todo bolo do cardapio comeca com ela.
  if (/^(bolo|bolos)$/.test(primeira)) return false;
  return nome.includes(primeira);
}

// O VALOR DO TOPO NAO SAI DA BOCA DELA. NUNCA.
//
// Teste ao vivo de 20/08/2026:
//
//   cliente: e o topo do homem aranha, quanto fica?
//   Dora:    O topo de bolo tema homem aranha fica em torno de R$ 30, mas a
//            equipe vai confirmar o valor certinho antes de fechar.
//
// O topo e o UNICO item da casa sem preco de tabela: cada peca e fabricada com
// o tema, o nome e a idade do aniversariante, e quem lanca o valor e a equipe,
// na tela do painel. Por isso existe a pendencia de topo.
//
// "Em torno de R$ 30" nao e estimativa, e ancora. O cliente le 30, a equipe
// lanca 45, e a diferenca vira discussao no balcao com a dona. Em Moffatt
// contra Air Canada o tribunal obrigou a empresa a honrar o numero que o
// chatbot inventou, e a defesa de que o bot seria entidade separada foi
// rejeitada.
//
// A persona ja mandava nao chutar. Prompt e sugestao: isto aqui e o codigo.
//
// Devolve a frase inteira que precisa sair, nao so o numero: metade de uma
// frase de preco e pior que a frase toda.
export function chutouValorDoTopo(texto: string): string[] {
  const t = String(texto ?? "");
  if (!t) return [];
  const frases = t.split(/(?<=[.!?\n])\s*/);
  return frases.filter((f) => {
    const s = semAcMin(f);
    if (!/\btopo\b|papel de arroz/.test(s)) return false;
    if (!/r\$ ?[0-9]/.test(s) && !/\b[0-9]{1,3} ?reais\b/.test(s)) return false;
    // "SEM topo" nao e cotacao de topo. Quem dispensa o topo continua recebendo
    // o preco do bolo dele na mesma frase, e apagar isso corta a resposta no
    // meio.
    if (/\b(sem|nao quer|nao vai|dispensa|tirar o|tirei o) (topo|papel de arroz)/.test(s)) return false;
    // LINHA DE PEDIDO NAO E COTACAO.
    //
    // Regressao minha, achada no teste ao vivo. O cliente pediu "sem topo e sem
    // papel de arroz", e a linha do bolo no resumo era
    //   "bolo laka (pao de lo branco, sem topo, sem papel de arroz):
    //    3 kg x R$ 55,90 = R$ 167,70"
    // Tem "topo" e tem "R$", entao a guarda apagou a linha inteira e o cliente
    // recebeu o resumo do pedido cheio de buracos, num pedido que nem topo
    // tinha. Conta do motor tem a forma "x R$" e "= R$"; chute nao tem.
    if (/x ?r\$ ?[0-9]/.test(s) || /= ?r\$ ?[0-9]/.test(s)) return false;
    return true;
  });
}

// A mesma resposta, sem o numero que ela nao tinha como saber.
export function textoSemValorDoTopo(texto: string): string {
  // RESUMO DE PEDIDO NAO SE MEXE.
  //
  // Esta guarda comia a linha "1x papel de arroz: R$ 12,00" do recibo, porque a
  // linha fala de peca do bolo e tem R$. O cerebro protegia comparando o texto
  // com estado.resumo, e a comparacao deixa de bater assim que o resumo e
  // refeito pelo codigo. A protecao tem que morar aqui dentro.
  if (/\*Pedido recebido\*|\*Total:/i.test(String(texto ?? ""))) return String(texto ?? "");
  const frases = chutouValorDoTopo(texto);
  if (!frases.length) return String(texto ?? "");
  let saida = String(texto ?? "");
  for (const f of frases) saida = saida.replace(f, "");
  saida = saida.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const verdade =
    "O valor do topo quem confirma é a equipe, porque a peça é feita com o tema, o nome e a idade. " +
    "Assim que confirmarem eu te aviso por aqui.";
  return saida ? saida + "\n\n" + verdade : verdade;
}

// O CLIENTE MANDOU FECHAR. ISSO VENCE QUALQUER OFERTA.
//
// Teste ao vivo de 20/08/2026, com o dono esperando a tela ficar pronta:
//
//   cliente: nao, so o bolo mesmo. nome Patricia Loureiro, pago no pix
//   Dora:    So pra confirmar, vai querer algum salgado pra festa tambem?
//   cliente: ja falei que nao quero salgado, so o bolo. pode fechar
//   Dora:    Agora, vai querer docinho tambem pra festa? Tem ainda pizza,
//            torta e empadao, se quiser.
//
// A maquina de etapas trata "ainda nao ofereci docinho" como PENDENCIA, do
// mesmo jeito que trata "falta a data da retirada". Nao e a mesma coisa: uma e
// informacao que a cozinha precisa, a outra e venda a mais que seria bom ter.
//
// Enquanto sobrasse uma oferta por fazer, o pedido nao fechava, e o cliente que
// mandou fechar levava mais uma pergunta. Foi o que fez a secretaria desistir
// duas vezes, com outra roupa.
//
// Oferecer e bom. Insistir depois de "pode fechar" e o oposto de atender.
export function mandouFechar(falasDoCliente: string[]): boolean {
  const t = " " + falasDoCliente.map((f) => semAcMin(f)).join(" | ") + " ";
  if (!t.trim()) return false;
  return /\b(pode fechar|pode registrar|pode passar|passa pra equipe|fecha o pedido|fechar o pedido|so isso|e so isso|so isso mesmo|era so isso|nada mais|mais nada|ja falei que nao quero|nao quero mais nada|pode encerrar|manda pra equipe|finaliza)\b/.test(
    t,
  );
}

// A HORA QUE ELE FALOU, QUANDO ELA ESQUECEU DE ANOTAR.
//
// Teste ao vivo de 21/08/2026. A secretaria abriu a conversa com "preciso de
// 200 salgados assados pra quarta AS 9H". A Dora anotou a data certinha
// (26/08/2026, a quarta seguinte) e mandou a hora como null. Tres mensagens
// depois ela perguntou "que horas voce retira?", com o 9h escrito na primeira
// linha da conversa.
//
// Perguntar de novo o que o cliente ja disse e a reclamacao numero um do dono
// sobre esta IA, e o codigo tem como resolver: se ele falou, o sistema anota.
//
// Vale o ULTIMO horario que ele falou, porque mudar de ideia funciona.
export function horaQueEleFalou(falasDoCliente: string[]): string | null {
  const t = semAcMin(falasDoCliente.join(" | "))
    // Data nao e hora: "26/08" e "26/08/2026" saem antes pra nao virar "26h".
    .replace(/[0-9]{1,2}[/.-][0-9]{1,2}([/.-][0-9]{2,4})?/g, " ");
  let achado: string | null = null;
  // "as 9h", "9h", "9hs", "as 9 horas", "9:30", "as 15:00"
  for (const m of t.matchAll(/\b([0-9]{1,2})\s*(?::\s*([0-9]{2})|h(?:s|oras?)?)\b/g)) {
    const hora = Number(m[1]);
    if (!Number.isFinite(hora) || hora > 23) continue;
    // A padaria nao marca retirada de madrugada: numero baixo demais costuma
    // ser quantidade ("2 horas antes"), nao horario de balcao.
    if (hora < 5) continue;
    achado = m[2] ? `${hora}:${m[2]}` : `${hora}h`;
  }
  if (achado) return achado;
  // Periodo tambem serve: a persona aceita "de manha" e a comanda sai com isso.
  const periodo = t.match(/\b(de manha|pela manha|de tarde|a tarde|pela tarde|de noite|a noite)\b/g);
  if (periodo?.length) return periodo[periodo.length - 1].replace(/^(de |pela |a )/, "").trim();
  return null;
}

// PALAVRA SOLTA E RESPOSTA DE UMA PERGUNTA, NAO RECHEIO DE TODOS.
//
// Teste ao vivo de 21/08/2026. A Dora perguntou "qual o sabor da esfirra?" e a
// secretaria respondeu "carne mesmo". Carne tambem e opcao de pastel assado,
// empadinha, croissant, mini bolha e risolis: o codigo encheu todos de carne.
// So o quiche escapou, porque carne nao e opcao dele. O pedido ia pra cozinha
// com a bandeja inteira de carne, e a cliente tinha falado de UM item.
//
// Seis dos 21 produtos com sabor dividem a palavra "carne". Sete dividem
// "frango". Enquanto a palavra solta valer pra todo mundo, uma resposta de uma
// palavra contamina o pedido inteiro.
//
// A regra e a mesma que ja vale pra cor da forminha e pra foto: a resposta do
// cliente pertence a pergunta que foi feita. Sabor colado no nome ("esfirra de
// carne") continua valendo pra qualquer item, porque ali ele disse de quem e.
export function elaPerguntouDesteItem(produto: string, ultimaFalaDela: unknown): boolean {
  const nome = semAcMin(produto).trim();
  if (!nome) return false;
  const dela = semAcMin(ultimaFalaDela);
  if (!dela.trim()) return false;
  if (dela.includes(nome)) return true;
  // O plural que ela escreve na pergunta: "qual o sabor das esfirras?".
  return dela.includes(nome + "s") || (nome.endsWith("s") && dela.includes(nome.slice(0, -1)));
}
