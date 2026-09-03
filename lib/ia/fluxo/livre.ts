// ============================================================================
//  A CONVERSA LIVRE: A IA CONVERSA, O CODIGO GUARDA O DINHEIRO.
//
//  Pedido do dono em 03/09/2026, depois de um mes de guardas: *"quero tirar
//  todos os guardas, quero que a IA entenda o que ta sendo dito"*. Este
//  arquivo e isso. Nao ha etapas, nao ha roteiro, nao ha frase pronta, nao ha
//  contador de insistencia. O modelo ve a conversa inteira, o pedido anotado
//  com os valores do motor e o cardapio com precos e sabores, e ESCREVE a
//  resposta e decide o que perguntar.
//
//  O que o codigo faz, e so isso:
//
//    1. preco: todo numero de dinheiro sai do motor (`orcamento.ts`), e o
//       lembrete que vai ao modelo ja traz o pedido cotado; se a resposta dele
//       citar um valor que nao existe no cardapio nem no pedido, o resumo
//       certo entra embaixo;
//    2. cardapio: so entra no pedido nome que existe no catalogo (o modelo
//       anota, o codigo confere pelo nome canonico);
//    3. quantidade: entra a que ele disse; sem numero fica 0, e "falta a
//       quantidade" vai no lembrete pro modelo perguntar;
//    4. bolo ate 6 kg;
//    5. a IA nunca confirma sozinha: quando ele confirma e esta tudo
//       completo, o pedido vai pra fila da equipe (`fecharPedido`).
//
//  `IA_LIVRE=nao` no ambiente volta pro fluxo de etapas (`fluxo.ts`).
// ============================================================================

import type OpenAI from "openai";
import { modeloDoCerebro } from "../cliente-do-cerebro";
import { produtosDaCasa, produtoPorNome, produtoNoComeco, minimoPorSaborDoCatalogo, CATEGORIAS_DE_BOLO } from "../dados/produtos";
import { identificarProduto } from "./produto";
import { motorPadrao, brl } from "../orcamento";
import { paraOMotor } from "./cotar";
import { lerEstadoDoBanco, gravarEstado, zerar } from "./gravar";
import { fecharPedido, oQueFaltaPraFechar } from "./fechar";
import { linhasQueOClientePodeEstarTirando, type Estado, type TurnoDaConversa } from "./fluxo";
import { quandoDoPedido } from "./pergunta";
import { sortidoDaCasa } from "./base";
import { categoriasDaFamilia } from "./generico";
import { DOCE_PAO } from "../persona";
import { avisoDeEspera, retiradaForaDoExpediente } from "../../padaria-aberta";
import { semAcento } from "../texto";
import { ultimasMensagens } from "@/lib/banco/conversas";
import { temPedidoAguardandoCliente, registrarAceiteCliente, devolverPedidoParaEquipe } from "@/lib/banco/pedidos";
import { carregarAvisoDoDia } from "@/lib/banco/negocios";
import type { RespostaDoFluxo } from "./atender";

const PESO_DO_MAIOR_BOLO = 6;
const PECAS = ["salgados", "docinhos", "bolos-festa", "bolos-caseiros", "pizza", "tortas-empadao", "cupcakes", "franciscano", "paes", "cucas"] as const;

/** `IA_LIVRE=nao` desliga a conversa livre e volta pro fluxo de etapas. */
export function modoLivre(): boolean {
  return !/^(nao|não|off|0|false)$/i.test(String(process.env.IA_LIVRE ?? "").trim());
}

export type LeituraLivre = {
  resposta?: string;
  itens?: { produto: string; qtd?: number; sabor?: string | null; obs?: string | null }[];
  tirar?: string[];
  dados?: { nome?: string; data?: string; hora?: string; pagamento?: string };
  pecas?: { topo?: boolean; papelDeArroz?: boolean };
  tema?: string;
  escrito?: string;
  forminha?: string;
  prato?: "aberto" | "tampa";
  ehFesta?: boolean;
  pessoas?: number;
  naoQuer?: string[];
  situacao?: "reclamacao" | "cancelar" | "status" | "fora_do_assunto" | "humano";
  confirmou?: boolean;
  aceitouValor?: boolean;
  recomecar?: boolean;
  comprovante?: boolean;
  cardapio?: string;
  chamarEquipe?: string;
  /** Familias que ele mandou a casa escolher: o codigo monta o sortido pelo cardapio. */
  escolherPorMim?: string[];
};

// ------------------------------------------------------------ o cardapio
/** O cardapio inteiro, com preco, unidade e sabores, do jeito que a IA le. */
export function cardapioComPrecos(): string {
  const todos = produtosDaCasa();
  const porCategoria = new Map<string, typeof todos>();
  for (const p of todos) {
    const cat = String(p.categoria || "outro");
    porCategoria.set(cat, [...(porCategoria.get(cat) ?? []), p]);
  }
  const linhas: string[] = [];
  for (const [cat, lista] of porCategoria) {
    const deBolo = (CATEGORIAS_DE_BOLO as readonly string[]).includes(cat);
    // Sabores iguais em todo o grupo (a pizza) saem uma vez so.
    const chaveSabores = (p: (typeof todos)[number]) => p.sabores.join("|");
    const todosIguais = lista.length > 1 && lista.every((p) => chaveSabores(p) === chaveSabores(lista[0]) && p.sabores.length > 3);
    const itens = lista.map((p) => {
      const nome = deBolo ? p.nome : p.nomeCurto;
      const sabor = p.saborFixo && p.sabores.length ? " de " + p.sabores[0] : "";
      const opcoes = !p.saborFixo && p.sabores.length && !todosIguais ? " (sabores: " + p.sabores.join(", ") + ")" : "";
      const ate = p.saboresAte && p.saboresAte > 1 ? " (até " + p.saboresAte + " sabores)" : "";
      const preco = brl(p.preco) + (p.unidade === "kg" ? " o quilo" : " cada");
      return nome + sabor + opcoes + ate + ": " + preco;
    });
    linhas.push("- " + cat.replace(/_/g, " ") + ": " + itens.join("; "));
    if (todosIguais) linhas.push("  sabores de " + cat.replace(/_/g, " ") + ": " + lista[0].sabores.join(", "));
  }
  return linhas.join("\n");
}

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function instrucaoLivre(): string {
  const { sugerir, saboresNoCento } = minimoPorSaborDoCatalogo();
  return [
    "Você é a Dora, atendente da padaria " + DOCE_PAO.nome + " (" + DOCE_PAO.cidade + "), atendendo pelo WhatsApp. " +
      "Você anota encomendas e responde dúvidas. Fale como uma atendente de padaria de bairro: curto, direto, simpático, " +
      "sem emoji, sem travessão, no máximo duas frases e UMA pergunta por mensagem. Nunca repita a mesma frase que você já mandou: " +
      "se a pessoa não respondeu o que você perguntou, responda o que ela disse e conduza de outro jeito.",
    "Hoje é " + hojeEmSaoPaulo() + ". Horário: " + DOCE_PAO.horario + " Endereço: " + DOCE_PAO.endereco + ". " +
      "Pagamento: pix (chave CNPJ " + DOCE_PAO.chavePix + "), cartão em até 3 vezes, ou dinheiro na retirada. Sem entrada.",
    "REGRAS DA CASA (não invente fora disso):",
    "- Preço é SÓ o do cardápio abaixo. Se não souber um valor, diga que a equipe confirma. Nunca dê desconto: desconto é com a equipe.",
    "- Só existe o que está no cardápio. Sabor que não está na lista: anote como \"a confirmar\" e diga que a equipe confirma se a casa faz.",
    "- Todo item precisa de quantidade dita pelo cliente (unidades, ou quilos no que é vendido por quilo) e, se o produto tem lista de sabores, do sabor escolhido. Nunca chute nenhum dos dois: assim que ele citar um item, a sua próxima pergunta é a quantidade (ou o sabor, se faltar). Na festa a quantidade sai da sugestão que ele aceitou.",
    "- Você NUNCA escolhe sabor nem produto por ele. O sabor do bolo é sempre dele. Sortido só quando ele pedir pra você escolher, e só de salgados e docinhos.",
    "- Bolo de festa, nesta ordem, uma pergunta por vez: 1) o sabor; 2) se ele quer misturar com um segundo sabor (até 2, vale o preço do mais caro); 3) quantos quilos (de 300 g a 6 kg; na festa sugira o da base); 4) papel de arroz com a foto impressa (R$ 12,00), sim ou não; 5) topo de bolo, sim ou não (o valor do topo é a equipe que orça, não dê valor); 6) se tiver topo ou papel: o tema e o que vai escrito (nome e idade). O que ele já respondeu numa frase só, não pergunte de novo.",
    "- Docinhos: depois de saber quais e quantos, pergunte a cor da forminha POR ESCRITO, listando as cores (amarelo, azul, branca, dourada, laranja, lilás, marrom, pink, prata, preta, rosa, roxo, verde, vermelha). Uma cor pro pedido. Nunca mande cardápio pra isso.",
    "- Festa: sugira 10 salgados, 5 docinhos e 100 g de bolo por pessoa (diga os números e o valor), e o cliente ajusta. " +
      "Quando ele aceitar a sugestão, VOCÊ anota as quantidades: reparta o total da família entre os tipos que ele escolher " +
      "(75 docinhos = 40 brigadeiro e 35 beijinho) e diga isso na resposta. Se ele pedir pra você escolher os tipos, escolha " +
      "você mesma 4 ou 5 do cardápio (respeitando o que ele não quer), anote com as quantidades e diga quais foram. " +
      "Mínimo sugerido por sabor: " + (sugerir || 20) + " unidades" + (saboresNoCento ? ", " + saboresNoCento + " sabores no cento" : "") + " (sugira, não recuse).",
    "- Mande a peça do cardápio (campo cardapio) só quando a pessoa NÃO sabe o que quer ou pede pra ver as opções. Se ela já disse exatamente o que quer (\"50 brigadeiro\"), não mande cardápio: anote e pergunte o que falta.",
    "- O que você disser que anotou TEM que vir em itens no mesmo JSON, com quantidade. O PEDIDO ANOTADO do lembrete é a única verdade: não diga no resumo nada que não esteja nele.",
    "- Se ele pedir pra VOCÊ escolher os tipos de salgado ou docinho (\"os salgados escolhe você\"), mande escolherPorMim: [\"salgado\"] (ou docinho): a casa monta o sortido pelo cardápio e ele aparece no lembrete na próxima mensagem. Diga que você montou e siga pra próxima pergunta. Bolo nunca entra aí.",
    "- Sabor de bolo (4 leites, laka, prestígio, brigadeiro, mineira...) dito quando o bolo está em aberto é o bolo: produto \"bolo <sabor>\", com o peso combinado (na festa, o da sugestão).",
    "- Restrição alimentar: só o que o cardápio tem (0% lactose é sabor de bolo de festa). Sem glúten, vegano ou diet a casa não faz: diga que vai confirmar com a equipe, sem prometer.",
    "- Pra fechar um pedido você precisa de: itens com quantidade, dia e hora da retirada (dentro do horário), nome de quem retira e forma de pagamento. Quando tiver tudo, mostre o resumo com os valores e pergunte se pode fechar. Quando ele disser que sim, confirmou = true.",
    "- Você NUNCA confirma o pedido sozinha: depois do sim dele, diga que o pedido foi pra fila da equipe da padaria e que ela avisa quando confirmar.",
    "- Reclamação, cancelamento, pedido pra falar com uma pessoa, ou algo que você não sabe: chame a equipe (chamarEquipe com o motivo) e diga isso ao cliente.",
    "- Mensagem que não é da padaria (número errado, propaganda): diga uma vez quem você é e não insista.",
    "",
    "CARDÁPIO (nomes, sabores e preços; use os nomes daqui no JSON):",
    cardapioComPrecos(),
    "",
    "PEÇAS DE CARDÁPIO (imagens que você pode mandar UMA vez cada, no campo cardapio): " + PECAS.join(", ") + ".",
    "",
    "RESPONDA SÓ COM UM JSON:",
    "{",
    '  "resposta": "o que a Dora diz ao cliente (obrigatório)",',
    '  "itens": [{ "produto": "nome do cardápio (bolo com o prefixo: bolo brigadeiro)", "qtd": 0, "sabor": "recheio escolhido ou null", "obs": "recado pra cozinha ou null" }],',
    '  "tirar": ["o que ele mandou tirar, nas palavras dele"],',
    '  "dados": { "nome": "", "data": "DD/MM/AAAA", "hora": "HH:MM", "pagamento": "pix|cartao|dinheiro" },',
    '  "pecas": { "topo": true, "papelDeArroz": false }, "tema": "", "escrito": "", "forminha": "cor", "prato": "aberto|tampa",',
    '  "ehFesta": true, "pessoas": 0, "naoQuer": ["o que ele disse que não quer"],',
    '  "situacao": "reclamacao|cancelar|status|fora_do_assunto|humano", "chamarEquipe": "motivo, quando precisar de gente",',
    '  "confirmou": true, "aceitouValor": true, "recomecar": true, "comprovante": true,',
    '  "cardapio": "salgados|docinhos|bolos-festa|bolos-caseiros|pizza|tortas-empadao|cupcakes|franciscano|paes|cucas",',
    '  "escolherPorMim": ["salgado"]',
    "}",
    "Mande em itens só o que mudou nesta mensagem, com a quantidade TOTAL nova (\"muda pra 100\" = 100; \"mais 50\" = o que tinha + 50). " +
      "Item sem quantidade dita: qtd 0. Só mande os campos que mudaram; resposta é sempre obrigatória. " +
      "aceitouValor só quando a padaria mandou o valor final com o topo e ele respondeu se está certo.",
  ].join("\n");
}

// ------------------------------------------------------------ o lembrete
export function lembreteDoPedido(e: Estado, extra: { pedidoNaFila?: boolean; aguardandoValor?: boolean; avisoDoDia?: string | null }): string {
  const partes: string[] = [];
  if (e.itens.length) {
    const cot = motorPadrao.cotarPorItens(paraOMotor(e.itens));
    const linhas = e.itens.map((i) => {
      const l = cot.linhas?.find((x) => semAcento(String(x.item ?? "")) === semAcento(paraOMotor([i])[0].item));
      const qtd = Number(i.qtd) > 0 ? i.qtd + (unidade(i) === "kg" ? " kg de " : " ") : "(SEM QUANTIDADE) ";
      const valor = l && Number(i.qtd) > 0 ? " = " + brl(Number(l.subtotal ?? 0)) : "";
      return qtd + i.produto + (i.obs ? " (" + i.obs + ")" : "") + valor;
    });
    partes.push("PEDIDO ANOTADO ATÉ AGORA:\n- " + linhas.join("\n- ") + "\nTotal até agora: " + brl(Number(cot.total || 0)));
  } else {
    partes.push("PEDIDO ANOTADO ATÉ AGORA: nada ainda.");
  }
  const d = e.dados ?? {};
  const dados = [d.data ? "dia " + d.data : null, d.hora ? "às " + d.hora : null, d.nome ? "nome " + d.nome : null, d.pagamento ? "pagamento " + d.pagamento : null].filter(Boolean);
  if (dados.length) partes.push("Retirada: " + dados.join(", ") + ".");
  const pecas = [
    e.pecas?.topo === true ? "com topo" : e.pecas?.topo === false ? "sem topo" : null,
    e.pecas?.papelDeArroz === true ? "com papel de arroz" : e.pecas?.papelDeArroz === false ? "sem papel de arroz" : null,
    e.tema ? "tema " + e.tema : null,
    e.escrito ? "escrito: " + e.escrito : null,
    e.forminha ? "forminha " + e.forminha : null,
  ].filter(Boolean);
  if (pecas.length) partes.push("Detalhes: " + pecas.join(", ") + ".");
  if (e.ehFesta && e.pessoas) {
    const base = { salgados: e.pessoas * 10, docinhos: e.pessoas * 5, boloKg: Math.round(e.pessoas * 10) / 100 };
    const soma = (pref: string[]) => e.itens.filter((i) => pref.some((p) => String(i.categoria).startsWith(p))).reduce((t, i) => t + (Number(i.qtd) || 0), 0);
    const temSalgado = soma(["salgado"]), temDocinho = soma(["docinho"]), temBolo = soma(["bolo"]);
    partes.push(
      "É festa pra " + e.pessoas + " pessoas. Sugestão da casa: " + base.salgados + " salgados, " + base.docinhos + " docinhos e " +
        String(base.boloKg).replace(".", ",") + " kg de bolo. Anotado até agora: " + temSalgado + " salgados, " + temDocinho + " docinhos, " +
        String(temBolo).replace(".", ",") + " kg de bolo" + (e.naoQuer?.length ? " (ele não quer: " + e.naoQuer.join(", ") + ")" : "") + ".",
    );
  } else if (e.ehFesta) {
    partes.push("É festa, ainda sem número de pessoas.");
  }
  if (e.naoQuer?.length) partes.push("Ele não quer: " + e.naoQuer.join(", ") + ".");
  const falta = [...oQueFaltaPraFechar(e), ...faltaSabor(e), ...faltaDaFesta(e)];
  if (e.itens.length) partes.push(falta.length ? "FALTA PRA FECHAR: " + falta.join("; ") + "." : "Está tudo completo: mostre o resumo e pergunte se pode fechar, se ainda não perguntou.");
  if (e.pedidoAprovado) {
    const quando = quandoDoPedido(e.pedidoAprovado);
    partes.push("ATENÇÃO: ele já tem um pedido APROVADO pela equipe" + (quando ? " pra " + quando : "") + ". Mudança nesse pedido é com a equipe (chamarEquipe).");
  } else if (extra.pedidoNaFila) {
    partes.push("ATENÇÃO: o pedido acima já foi registrado e está na fila da equipe pra aprovação. Se ele só agradecer, diga isso; se quiser mudar algo, anote a mudança.");
  }
  if (extra.aguardandoValor) partes.push("ATENÇÃO: a padaria acabou de mandar o VALOR FINAL (com o topo orçado pela equipe) e perguntou se está certo. Leia a resposta como aceitouValor true ou false.");
  if (extra.avisoDoDia) partes.push("Aviso da padaria hoje: " + extra.avisoDoDia);
  if (e.pecasMandadas?.length) partes.push("Peças de cardápio já mandadas nesta conversa (não mande de novo): " + e.pecasMandadas.join(", ") + ".");
  return partes.join("\n");
}

/** Produto com lista de sabores e sem sabor escolhido: a padaria pergunta antes de fechar. */
export function faltaSabor(e: Estado): string[] {
  const falta: string[] = [];
  for (const i of e.itens) {
    const p = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
    if (!p || p.saborFixo || p.sabores.length < 2) continue;
    const obs = semAcento(String(i.obs ?? ""));
    const tem = p.sabores.some((sab) => obs.includes(semAcento(sab))) || /a confirmar/.test(obs);
    if (!tem) falta.push("o sabor do " + i.produto + " (" + p.sabores.slice(0, 8).join(", ") + (p.sabores.length > 8 ? "..." : "") + ")");
  }
  return falta;
}

/** Na festa, familia da sugestao que ele nao recusou e nao anotou ainda nao deixa fechar. */
export function faltaDaFesta(e: Estado): string[] {
  if (!e.ehFesta || !e.pessoas) return [];
  const naoQuer = (e.naoQuer ?? []).map((x) => semAcento(String(x)));
  const soma = (pref: string) => e.itens.filter((i) => String(i.categoria).startsWith(pref)).reduce((t, i) => t + (Number(i.qtd) || 0), 0);
  const falta: string[] = [];
  for (const [pref, nome] of [["salgado", "os salgados da festa"], ["docinho", "os docinhos da festa"], ["bolo", "o bolo da festa"]] as const) {
    if (naoQuer.some((x) => x.startsWith(pref))) continue;
    if (!soma(pref)) falta.push(nome + " (ele pode dispensar, se quiser)");
  }
  return falta;
}

function unidade(i: { produto: string; categoria?: string }): "kg" | "un" {
  const p = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
  return p?.unidade ?? "un";
}

// ------------------------------------------------------------ a chamada
export type PensarLivre = (args: { instrucao: string; historico: TurnoDaConversa[]; lembrete: string; mensagem: string }) => Promise<LeituraLivre>;

export function pensarLivreComOpenAI(
  cliente: OpenAI,
  registrar?: (uso: { tokensIn: number; tokensOut: number; cacheRead: number }) => void,
  modeloDoNegocio: string | null = null,
): PensarLivre {
  return async ({ instrucao, historico, lembrete, mensagem }) => {
    const modelo = modeloDoCerebro(modeloDoNegocio);
    const anthropic = /anthropic|claude/i.test(String((cliente as { baseURL?: string }).baseURL ?? "")) || /^claude-/i.test(modelo);
    const turnos: { role: "user" | "assistant"; content: string }[] = [];
    for (const t of historico) {
      const content = String(t?.conteudo ?? "").trim();
      if (!content) continue;
      const role = t.papel === "user" ? "user" : "assistant";
      const ultimo = turnos[turnos.length - 1];
      if (ultimo && ultimo.role === role) ultimo.content += "\n" + content;
      else turnos.push({ role, content });
    }
    const r = await cliente.chat.completions.create(
      {
        model: modelo,
        ...(/^(gpt-5|o[0-9])/i.test(modelo) ? {} : { temperature: 0.3 }),
        ...(anthropic ? {} : { response_format: { type: "json_object" as const } }),
        messages: [
          { role: "system", content: instrucao },
          ...turnos,
          { role: "system", content: lembrete },
          { role: "user", content: mensagem },
        ],
      },
      { timeout: 25000, maxRetries: 0 },
    );
    const u = r.usage;
    registrar?.({ tokensIn: u?.prompt_tokens ?? 0, tokensOut: u?.completion_tokens ?? 0, cacheRead: u?.prompt_tokens_details?.cached_tokens ?? 0 });
    const bruto = String(r.choices?.[0]?.message?.content ?? "{}").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim() || "{}";
    try {
      return JSON.parse(bruto) as LeituraLivre;
    } catch {
      console.warn("[livre] o modelo devolveu algo que nao e JSON:", bruto.slice(0, 200));
      return { resposta: bruto.slice(0, 600) };
    }
  };
}

// ------------------------------------------------------------ aplicar
export type ResultadoLivre = {
  estado: Estado;
  texto: string;
  cardapio: string | null;
  precisaHumano: boolean;
  motivoHumano: string | null;
  confirmou: boolean;
  recomecar: boolean;
  aceitouValor: boolean | null;
  fotoEhComprovante: boolean;
  leitura: LeituraLivre;
  rastro: string[];
};

const semEmojiETravessao = (t: string) =>
  String(t ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+[–—]\s+/g, ", ")
    .replace(/[–—]/g, "-")
    .trim();

/** O que o modelo leu vira estado, passando so pelas regras de dinheiro e catalogo. */
export function aplicarLivre(antes: Estado, l: LeituraLivre, mensagem: string): ResultadoLivre {
  const rastro: string[] = [];
  let e: Estado = { ...antes, itens: antes.itens.map((i) => ({ ...i })), dados: { ...antes.dados } };
  const avisos: string[] = [];
  let precisaHumano = false;
  let motivoHumano: string | null = null;

  // itens
  for (const bruto of l.itens ?? []) {
    const nomeBruto = String(bruto?.produto ?? "").trim();
    if (!nomeBruto) continue;
    const quem = identificarProduto(nomeBruto, undefined, mensagem);
    let canon = quem.produto;
    let daCasa = produtoPorNome(canon) ?? produtoNoComeco(canon);
    if (!daCasa) {
      // "bolo" + sabor que existe como bolo ("bolo laka")
      const tentativa = bruto.sabor ? produtoPorNome(nomeBruto + " " + bruto.sabor) ?? produtoNoComeco(nomeBruto + " " + bruto.sabor) : null;
      if (tentativa) { daCasa = tentativa; canon = tentativa.nome; }
    }
    if (!daCasa) {
      rastro.push("nao existe no cardapio, nao entrou: " + nomeBruto);
      avisos.push("Só pra avisar: \"" + nomeBruto + "\" não está no nosso cardápio, então não anotei.");
      continue;
    }
    canon = daCasa.nome;
    let qtd = Number(bruto.qtd) || 0;
    if (qtd < 0) qtd = 0;
    if (daCasa.unidade === "un" && !Number.isInteger(qtd)) qtd = Math.round(qtd);
    const ehBolo = (CATEGORIAS_DE_BOLO as readonly string[]).includes(daCasa.categoria);
    if (ehBolo && daCasa.unidade === "kg" && qtd > PESO_DO_MAIOR_BOLO) {
      rastro.push("bolo acima de 6 kg, zerei o peso: " + qtd);
      avisos.push("O maior bolo que a gente faz tem 6 kg. Me diz de novo o peso do " + canon + "?");
      qtd = 0;
    }
    let saborDito = String(bruto.sabor ?? "").trim() || null;
    // Sabor igual ao nome do produto ("4 leites" no bolo 4 leites) nao e recado.
    if (saborDito && (semAcento(saborDito) === semAcento(daCasa.nomeCurto) || semAcento(daCasa.nome).endsWith(" " + semAcento(saborDito)))) saborDito = null;
    const saborFixo = daCasa.saborFixo && daCasa.sabores.length ? daCasa.sabores[0] : null;
    let sabor = saborFixo ?? saborDito;
    if (sabor && !saborFixo && daCasa.sabores.length && !daCasa.sabores.some((s) => semAcento(s) === semAcento(sabor!) || semAcento(sabor!).includes(semAcento(s)))) {
      sabor = sabor + " (sabor a confirmar)";
      precisaHumano = true;
      motivoHumano = "Sabor fora do cardápio: " + canon + " de " + saborDito;
      rastro.push("sabor fora da lista, marcado a confirmar: " + saborDito);
    }
    const obs = [sabor, String(bruto.obs ?? "").trim() || null].filter(Boolean).join(" | ") || null;
    const idx = e.itens.findIndex((i) => semAcento(i.produto) === semAcento(canon) && (!saborDito || !i.obs || semAcento(i.obs).includes(semAcento(saborDito))));
    if (idx >= 0) {
      const atual = e.itens[idx];
      e.itens[idx] = { ...atual, qtd: qtd > 0 ? qtd : atual.qtd, obs: obs ?? atual.obs };
    } else {
      e.itens.push({ produto: canon, categoria: daCasa.categoria, qtd, obs });
    }
  }

  // tirar
  for (const frase of l.tirar ?? []) {
    const idxs = linhasQueOClientePodeEstarTirando(e.itens, String(frase));
    if (idxs.length === 1) {
      rastro.push("tirou: " + e.itens[idxs[0]].produto);
      e.itens = e.itens.filter((_, n) => n !== idxs[0]);
    } else if (!idxs.length && e.itens.length === 1) {
      rastro.push("tirou o unico item: " + e.itens[0].produto);
      e.itens = [];
    } else {
      rastro.push("nao sei qual tirar por \"" + frase + "\" (" + idxs.length + " candidatos)");
    }
  }

  // dados
  if (l.dados) {
    const d = { ...e.dados };
    if (l.dados.nome?.trim()) d.nome = l.dados.nome.trim();
    if (l.dados.pagamento?.trim()) d.pagamento = semAcento(l.dados.pagamento.trim()).replace(/[^a-z]/g, "") || d.pagamento;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(l.dados.data ?? ""))) d.data = String(l.dados.data);
    if (/^\d{1,2}:\d{2}$/.test(String(l.dados.hora ?? ""))) d.hora = String(l.dados.hora).padStart(5, "0");
    if (d.data && d.hora) {
      const fora = retiradaForaDoExpediente(d.data, d.hora);
      if (fora) { avisos.push(fora); d.hora = null; rastro.push("hora fora do expediente, apagada"); }
    }
    e.dados = d;
  }
  if (l.pecas) e.pecas = { topo: typeof l.pecas.topo === "boolean" ? l.pecas.topo : e.pecas?.topo ?? null, papelDeArroz: typeof l.pecas.papelDeArroz === "boolean" ? l.pecas.papelDeArroz : e.pecas?.papelDeArroz ?? null };
  if (e.pecas?.papelDeArroz === true && !e.itens.some((i) => /papel de arroz/i.test(i.produto))) {
    const papel = produtoPorNome("papel de arroz");
    if (papel) e.itens.push({ produto: papel.nome, categoria: papel.categoria, qtd: 1, obs: null });
  }
  if (e.pecas?.papelDeArroz === false) e.itens = e.itens.filter((i) => !/papel de arroz/i.test(i.produto));
  if (l.tema?.trim()) e.tema = l.tema.trim();
  if (l.escrito?.trim()) e.escrito = l.escrito.trim();
  if (l.forminha?.trim()) e.forminha = l.forminha.trim();
  // A COR DA FORMINHA VAI NA LINHA DE CADA DOCINHO: e assim que a comanda e o
  // resumo mostram pra cozinha (regra da dona: uma cor pro pedido inteiro).
  if (e.forminha) {
    e.itens = e.itens.map((i) => {
      if (!String(i.categoria).startsWith("docinho")) return i;
      const obs = String(i.obs ?? "");
      if (/forminha/i.test(obs)) return { ...i, obs: obs.replace(/forminha [^|]+/i, "forminha " + e.forminha).trim() };
      return { ...i, obs: [obs.trim() || null, "forminha " + e.forminha].filter(Boolean).join(" | ") };
    });
  }
  if (l.prato === "aberto" || l.prato === "tampa") e.prato = l.prato;
  if (l.ehFesta === true) e.ehFesta = true;
  if (Number(l.pessoas) > 0) { e.pessoas = Number(l.pessoas); e.ehFesta = true; }
  if (l.naoQuer?.length) e.naoQuer = [...new Set([...(e.naoQuer ?? []), ...l.naoQuer.map(String)])];

  // a casa escolhe pra ele, pelo cardapio
  for (const fam of l.escolherPorMim ?? []) {
    const chave = semAcento(String(fam)).replace(/s$/, "");
    if (chave.startsWith("bolo")) { rastro.push("escolherPorMim bolo: o sabor do bolo e do cliente, nao montei"); continue; }
    const cats = categoriasDaFamilia(chave);
    if (!cats.length) continue;
    const jaTem = e.itens.filter((i) => cats.includes(String(i.categoria))).reduce((t, i) => t + (Number(i.qtd) || 0), 0);
    const porPessoa = chave.startsWith("salgado") ? 10 : chave.startsWith("docinho") ? 5 : chave.startsWith("bolo") ? 0.1 : 0;
    const alvo = e.pessoas ? Math.round(e.pessoas * porPessoa * 100) / 100 : 0;
    const total = Math.max(0, alvo - jaTem);
    if (!total) { rastro.push("escolherPorMim " + chave + ": sem total (sem festa ou ja completo)"); continue; }
    const sortido = sortidoDaCasa([...cats], total, e.naoQuer ?? []);
    for (const it of sortido) {
      const p = produtoPorNome(it.produto) ?? produtoNoComeco(it.produto);
      const fixo = p?.saborFixo && p.sabores.length ? p.sabores[0] : null;
      e.itens.push({ produto: it.produto, categoria: it.categoria, qtd: it.qtd, obs: fixo ?? it.obs ?? null });
    }
    rastro.push("a casa escolheu " + chave + ": " + sortido.map((x) => x.qtd + " " + x.produto).join(", "));
    avisos.push("Montei " + chave + (chave.endsWith("o") ? "s" : "") + " pra você: " + sortido.map((x) => x.qtd + " " + x.produto).join(", ") + ".");
  }

  // gente
  if (l.chamarEquipe?.trim() || l.situacao === "reclamacao" || l.situacao === "cancelar" || l.situacao === "humano") {
    precisaHumano = true;
    motivoHumano = (l.chamarEquipe?.trim() || "Situação: " + l.situacao) + ". Ele escreveu: \"" + mensagem.slice(0, 200) + "\"";
    rastro.push("chamou a equipe: " + motivoHumano.slice(0, 80));
  }

  // a resposta, com o dinheiro conferido
  let texto = semEmojiETravessao(String(l.resposta ?? "").trim());
  const cot = e.itens.length ? motorPadrao.cotarPorItens(paraOMotor(e.itens)) : null;
  const permitidos = new Set<string>();
  const add = (n: number) => { if (n > 0) permitidos.add((Math.round(n * 100) / 100).toFixed(2)); };
  for (const p of produtosDaCasa()) add(p.preco);
  if (cot) { add(Number(cot.total || 0)); for (const li of cot.linhas ?? []) { add(Number(li.subtotal ?? 0)); } }
  if (e.pessoas) { add(e.pessoas * 10); }
  const citados = [...texto.matchAll(/R\$\s?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/g)].map((m) => Number(m[1].replace(/\./g, "").replace(",", ".")).toFixed(2));
  const estranhos = citados.filter((v) => !permitidos.has(v));
  if (estranhos.length && cot) {
    rastro.push("a resposta citou valor que nao e do motor (" + estranhos.join(", ") + "); pus o resumo certo");
    const resumo = e.itens.filter((i) => Number(i.qtd) > 0).map((i) => {
      const li = cot.linhas?.find((x) => semAcento(String(x.item ?? "")) === semAcento(paraOMotor([i])[0].item));
      return "- " + i.qtd + (unidade(i) === "kg" ? " kg de " : " ") + i.produto + (li ? " = " + brl(Number(li.subtotal ?? 0)) : "");
    });
    texto += "\n\nOs valores certos do seu pedido:\n" + resumo.join("\n") + "\n*Total: " + brl(Number(cot.total || 0)) + "*";
  }
  if (avisos.length) texto = [texto, ...avisos].filter(Boolean).join("\n\n");
  if (!texto.trim()) texto = "Me conta o que você precisa que eu anoto.";

  // A PECA NAO VAI QUANDO ELE JA DISSE O QUE QUER DAQUELA FAMILIA.
  const familiaDaPeca: Record<string, string> = { salgados: "salgado", docinhos: "docinho", "bolos-festa": "bolo", "bolos-caseiros": "bolo", pizza: "pizza" };
  const nomeouDaFamilia = (peca: string) => {
    const pref = familiaDaPeca[peca];
    return Boolean(pref && (l.itens ?? []).some((i) => {
      const p = produtoPorNome(String(i.produto)) ?? produtoNoComeco(String(i.produto));
      return p && String(p.categoria).startsWith(pref);
    }));
  };
  const cardapio =
    l.cardapio && (PECAS as readonly string[]).includes(l.cardapio) && !(e.pecasMandadas ?? []).includes(l.cardapio) && !nomeouDaFamilia(l.cardapio)
      ? l.cardapio
      : null;
  if (l.cardapio && !cardapio && nomeouDaFamilia(String(l.cardapio))) rastro.push("nao mandei o cardapio de " + l.cardapio + ": ele ja disse o que quer");
  if (cardapio) e.pecasMandadas = [...(e.pecasMandadas ?? []), cardapio];

  e.ultimaFala = texto;
  e.insistiu = 0;
  return {
    estado: e,
    texto,
    cardapio,
    precisaHumano,
    motivoHumano,
    confirmou: l.confirmou === true,
    recomecar: l.recomecar === true,
    aceitouValor: typeof l.aceitouValor === "boolean" ? l.aceitouValor : null,
    fotoEhComprovante: l.comprovante === true,
    leitura: l,
    rastro,
  };
}

// ------------------------------------------------------------ atender
export async function atenderLivre(
  cliente: OpenAI,
  negocioId: string,
  clienteId: string,
  mensagem: { texto: string; botaoId?: string | null },
  modeloDoNegocio: string | null,
  pedidoAprovado: { data: string | null; hora: string | null; totalCentavos: number } | null,
  pedidoNaFila: boolean,
): Promise<RespostaDoFluxo> {
  const uso = { tokensIn: 0, tokensOut: 0, cacheRead: 0, chamadas: 0 };
  const contar = (u: { tokensIn: number; tokensOut: number; cacheRead?: number }) => {
    uso.tokensIn += u.tokensIn; uso.tokensOut += u.tokensOut; uso.cacheRead += u.cacheRead ?? 0; uso.chamadas++;
  };
  const aguardandoValor = await temPedidoAguardandoCliente(negocioId, clienteId).catch(() => false);
  const aceitou = async (): Promise<RespostaDoFluxo> => {
    const foi = await registrarAceiteCliente(negocioId, clienteId);
    return { texto: foi ? "Perfeito, obrigado. Seu pedido foi pra fila de aprovação da equipe e eu te aviso assim que confirmarem." : "Perfeito, obrigado. Já avisei a equipe da padaria e eles confirmam com você por aqui.", botoes: [], cardapio: null, etapa: "registrado", precisaHumano: !foi, rastro: ["ele aceitou o valor"], uso };
  };
  const recusou = async (motivo: string): Promise<RespostaDoFluxo> => {
    await devolverPedidoParaEquipe(negocioId, clienteId, motivo + ": " + mensagem.texto.slice(0, 200));
    return { texto: "Entendi. Vou passar pra equipe da padaria pra eles verem o que dá pra fazer, e te respondo por aqui.", botoes: [], cardapio: null, etapa: "registrado", precisaHumano: true, rastro: ["devolvi o pedido pra equipe: " + motivo], uso };
  };
  if (aguardandoValor && mensagem.botaoId === "valor_sim") return aceitou();
  if (aguardandoValor && mensagem.botaoId === "valor_nao") return recusou("O cliente nao aceitou o valor");

  const doBanco = await lerEstadoDoBanco(negocioId, clienteId);
  const antes: Estado = {
    ehFesta: false, pessoas: null, base: null, baseAceita: false, itens: [], naoQuer: [],
    dados: { nome: null, data: null, hora: null, pagamento: null }, pecas: null, topoNome: null, topoIdade: null,
    tema: null, escrito: null, forminha: null, prato: null, ofereceu: false, ultimaFala: null, insistiu: 0, retomarEm: null, assunto: null,
    ...doBanco, pedidoAprovado, pedidoNaFila,
  } as Estado;
  const historico = await ultimasMensagens(negocioId, clienteId, 14).catch(() => []);
  const avisoDoDia = await carregarAvisoDoDia(negocioId).then((a) => {
    if (!a.texto?.trim() || !a.atualizadoEm) return null;
    const dia = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
    return dia(new Date(a.atualizadoEm)) === dia(new Date()) ? a.texto.trim() : null;
  }).catch(() => null);

  const pensar = pensarLivreComOpenAI(cliente, contar, modeloDoNegocio);
  const texto = mensagem.texto?.trim() ? mensagem.texto : "(tocou em um botão)";
  const l = await pensar({ instrucao: instrucaoLivre(), historico, lembrete: lembreteDoPedido(antes, { pedidoNaFila, aguardandoValor, avisoDoDia }), mensagem: texto });
  const r = aplicarLivre(antes, l, texto);
  const rastro = ["livre", ...r.rastro];

  if (aguardandoValor) {
    if (r.aceitouValor === true) return aceitou();
    if (r.aceitouValor === false) return recusou("O cliente nao aceitou o valor");
    if ((l.itens?.length || l.tirar?.length || l.dados) && !r.confirmou) {
      return recusou("O cliente quer mudar o pedido depois do valor orcado");
    }
  }

  if (r.recomecar) {
    await zerar(negocioId, clienteId);
    return { texto: r.texto, botoes: [], cardapio: null, etapa: "abertura", precisaHumano: false, rastro: [...rastro, "recomecar: zerei o rascunho"], uso };
  }

  await gravarEstado(negocioId, clienteId, antes, r.estado);

  let pedidoId: string | undefined;
  let textoFinal = r.texto;
  if (r.confirmou && !pedidoNaFila && !pedidoAprovado) {
    const falta = [...oQueFaltaPraFechar(r.estado), ...faltaSabor(r.estado), ...faltaDaFesta(r.estado)];
    if (!falta.length) {
      try {
        const fechado = await fecharPedido(negocioId, clienteId, r.estado);
        if (fechado) {
          pedidoId = fechado.pedidoId;
          rastro.push("pedido fechado: " + fechado.pedidoId + " (" + brl(fechado.totalCentavos / 100) + ")");
          // O QUE FOI REGISTRADO E O QUE ELE LE, linha a linha, do motor.
          const linhas = fechado.linhas.map(
            (li) => "- " + li.qtd + (li.unidade === "kg" ? " kg de " : " ") + li.item + (li.obs ? " (" + li.obs + ")" : "") + " = " + brl(Number(li.subtotal)),
          );
          const d = r.estado.dados;
          textoFinal =
            "Fechando o pedido:\n" + linhas.join("\n") + "\n*Total: " + brl(fechado.totalCentavos / 100) + "*" +
            (d.data ? "\nRetirada " + d.data + (d.hora ? " às " + d.hora : "") : "") +
            (d.nome ? ", no nome de " + d.nome : "") + (d.pagamento ? ", pagamento " + d.pagamento : "") +
            "\n\nSeu pedido foi pra fila da equipe da padaria. Assim que eles confirmarem, eu te aviso por aqui." +
            (r.estado.pecas?.topo ? "\n_O topo entra à parte: a equipe faz o orçamento dele e confirma com você._" : "");
        }
      } catch (err) {
        rastro.push("fecharPedido falhou: " + String((err as Error)?.message ?? err).slice(0, 120));
      }
    } else {
      rastro.push("ele confirmou mas falta: " + falta.join("; "));
      if (!falta.some((f) => new RegExp(f.split(" ")[0], "i").test(textoFinal))) {
        textoFinal += "\n\nAntes de fechar, me diz: " + falta.join(", ") + ".";
      }
    }
  }

  console.log("[livre] " + rastro.join(" / "));
  return {
    texto: textoFinal,
    botoes: [],
    cardapio: r.cardapio,
    etapa: pedidoId ? "registrado" : "livre",
    pedidoId,
    precisaHumano: r.precisaHumano,
    motivoHumano: r.motivoHumano,
    fotoEhComprovante: r.fotoEhComprovante,
    rastro,
    uso,
  };
}

export { avisoDeEspera };
