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
import { sortidoDaCasa, calcularBase } from "./base";
import { escreverObs, lerObs } from "@/lib/banco/obs-do-bolo";
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
    "- REGRA GERAL de todo item do cardápio, seja salgado, docinho, bolo, cuca, torta ou pizza: antes de passar pra outra família ou pros dados, o item tem que estar fechado: quantidade (unidades, kg ou g conforme o cardápio) e o sabor, se o produto tem lista de sabores. Docinho ainda pede a cor da forminha; bolo de festa ainda pede papel de arroz, topo e tema. Não pergunte docinhos enquanto um salgado está sem sabor.",
    "- Sabor que ele ainda não disse é null no JSON. \"a confirmar\" só quando ele pediu um sabor que não está na lista.",
    "- \"Metade de cada\", \"igual de cada\", \"divide\" com vários tipos = o total da família repartido por igual entre os tipos (150 salgados em 3 tipos = 50, 50, 50).",
    "- Você NUNCA escolhe sabor nem produto por ele. O sabor do bolo é sempre dele. Sortido só quando ele pedir pra você escolher, e só de salgados e docinhos.",
    "- Dois tipos de bolo. BOLO CASEIRO: vendido por unidade (bolo inteiro, preço fixo), sem quilo, sem misto, sem topo nem papel de arroz; \"um bolo de cenoura\" = 1 bolo caseiro cenoura. BOLO DE FESTA: por quilo, com as peças. Se o sabor só existe num dos dois (cenoura, café, aipim só têm caseiro; 4 leites, laka, morango só têm festa), é aquele, não pergunte qual. Só pergunte \"de festa ou caseiro\" quando o sabor existe nos dois (prestígio) e a conversa não diz (festa, aniversário, quilos = festa; pequeno, de vitrine, inteiro = caseiro).",
    "- \"Um bolo\", \"uma torta\" = quantidade 1. Quantidade é sempre número no JSON (2, não \"2kg\").",
    "- Bolo de festa, nesta ordem, uma pergunta por vez: 1) o sabor; 2) se ele quer misturar com um segundo sabor (até 2, vale o preço do mais caro); 3) quantos quilos (de 300 g a 6 kg; na festa sugira o da base); 4) papel de arroz com a foto impressa (R$ 12,00), sim ou não; 5) topo de bolo, sim ou não (o valor do topo é a equipe que orça, não dê valor); 6) se tiver topo ou papel: o tema e o que vai escrito (nome e idade). O que ele já respondeu numa frase só, não pergunte de novo.",
    "- Bolo misto é UMA linha só: produto do sabor mais caro, sabor \"brigadeiro com morango\", com o peso inteiro (1,5 kg misto = 1 item de 1,5 kg). Nunca divida os quilos em dois bolos.",
    "- O nome e a idade do aniversariante (\"Delamar 58 anos\") são o escrito do topo: vão em escrito, nunca em dados.nome. O nome de quem retira é a ÚLTIMA pergunta antes do resumo.",
    "- Ordem da conversa: primeiro o item que ele pediu, completo. Quando o bolo de festa estiver completo (peças e tema), ofereça salgadinhos e docinhos UMA vez, se ele ainda não pediu nenhum. Se não quiser, vá pros dados. Se quiser, salgados (quais e quantos), depois docinhos se ele quis os dois, e só então os dados. Dados nesta ordem: dia, horário, pagamento e por último o nome de quem retira. Daí o resumo.",
    "- Quando ele responder sim ou não ao papel de arroz ou ao topo, mande pecas no JSON ({\"papelDeArroz\": true} ou {\"topo\": false}); sem isso a resposta dele se perde. O que ele disser sobre o tema e o escrito vai em tema e escrito.",
    "- Na festa a ordem é: salgados (quais e quantos), docinhos (quais e quantos, e logo em seguida a cor da forminha), e só depois o bolo. Não comece pelo bolo.",
    "- Quando ele perguntar os sabores ou os valores do bolo, mande a peça bolos-festa E escreva os sabores agrupados pelo preço do quilo (\"R$ X o kg: a, b, c. R$ Y o kg: d, e.\"), e diga que dá pra misturar até 2 sabores no mesmo bolo, valendo o preço do mais caro. Nunca diga \"a maioria\" ou \"alguns\": diga quais.",
    "- Tema do topo e do papel de arroz: QUALQUER tema vale (Minecraft, pescaria, o que ele quiser). Nunca diga que a casa não tem um tema, nunca sugira tema: a equipe orça e confirma. Só anote tema ou escrito que ELE disse.",
    "- Docinhos: depois de saber quais e quantos, pergunte a cor da forminha POR ESCRITO, listando as cores (amarelo, azul, branca, dourada, laranja, lilás, marrom, pink, prata, preta, rosa, roxo, verde, vermelha). Uma cor pro pedido. Nunca mande cardápio pra isso.",
    "- Festa: primeiro pergunte quantas pessoas; só depois sugira 10 salgados, 5 docinhos e 100 g de bolo por pessoa (diga os números e o valor), e o cliente ajusta. Nunca invente o número de pessoas. " +
      "Quando ele aceitar a sugestão, VOCÊ anota as quantidades: reparta o total da família entre os tipos que ele escolher " +
      "(75 docinhos = 40 brigadeiro e 35 beijinho) e diga isso na resposta. Se ele pedir pra você escolher os tipos, escolha " +
      "você mesma 4 ou 5 do cardápio (respeitando o que ele não quer), anote com as quantidades e diga quais foram. " +
      "Orientação da casa, NÃO é limite: uns " + (sugerir || 20) + " por sabor fica melhor" + (saboresNoCento ? " (dá uns " + saboresNoCento + " sabores por cento)" : "") + ". Se ele quiser mais sabores ou menos de cada, aceite. Nunca diga que só pode X sabores.",
    "- Em itens só entram produtos do cardápio (coxinha, brigadeiro, bolo brigadeiro). Nunca mande \"salgado\", \"docinho\" ou \"bolo\" soltos: quando ele aceitar a sugestão da festa, os totais ficam na sugestão e viram itens quando ele escolher os tipos e os sabores.",
    "- Pra trocar o sabor ou o recheio de um item já anotado, mande tirar com a linha antiga (como está no PEDIDO ANOTADO) e o item novo em itens. Só mandar o item de novo não tira o antigo. \"Sem beijinho\" = tirar [\"beijinho\"].",
    "- Se ele disser que não quer nada escrito no topo ou no papel, mande escrito: \"sem nada escrito\". Isso fecha a pergunta.",
    "- Foto: quando vier \"[o cliente enviou uma foto de referência para o pedido]\", a foto JÁ ficou guardada e vai junto no pedido pra equipe ver. Diga que recebeu e que vai junto pro pedido. Se ele mandou a foto respondendo o tema, o tema é a foto: só pergunte o que vai escrito. NUNCA diga que não consegue ver imagens.",
    "- Mensagem marcada como [áudio transcrito automaticamente] que não faz sentido: diga que não conseguiu entender o áudio e peça pra ela escrever ou mandar outro áudio. Não chute o que ela quis dizer.",
    "- Quando você NÃO entender o que a pessoa disse (áudio confuso, frase sem sentido, fala cortada), só pergunte de novo o que ela precisa, curto, como uma atendente faria. Não mande cardápio, não sugira festa, salgados nem nada: a padaria vende de tudo, e quem diz o que quer é ela.",
    "- Se você está PERGUNTANDO se ela quer ver o cardápio, não mande a peça nessa resposta. A peça vai só quando ela disse que quer ver ou perguntou o que tem.",
    "- Quando ela pergunta as opções ou o que tem de uma família (salgados, docinhos, bolos, pizza, tortas, cupcakes, franciscano, pães, cucas), a resposta é a PEÇA do cardápio (campo cardapio) mais UMA frase curta (\"Te mandei o cardápio de salgados. Me diz quais e quantos você quer.\"). NUNCA liste a família inteira por escrito: fica uma parede de texto. Escrever a lista só se a peça daquela família já foi mandada antes nesta conversa, e mesmo assim só os nomes, sem sabores.",
    "- Exceções que vão por escrito: os sabores do bolo por faixa de preço (junto com a peça bolos-festa) e as cores da forminha.",
    "- Mande a peça do cardápio (campo cardapio) só quando a pessoa pede pra ver as opções ou pergunta o que tem. Se ela já disse exatamente o que quer (\"50 brigadeiro\"), não mande cardápio: anote e pergunte o que falta.",
    "- TUDO o que ele pediu com quantidade na mensagem vai em itens NESSA MESMA resposta, mesmo que você ainda tenha perguntas (\"bolo de brigadeiro com morango, 2 kg, 100 brigadeiro e 100 beijinho\" = três itens já). Nunca deixe pra anotar depois. O que você disser que anotou TEM que vir em itens no mesmo JSON, com quantidade. O PEDIDO ANOTADO do lembrete é a única verdade: não diga no resumo nada que não esteja nele.",
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
    '  "pecas": { "topo": true, "papelDeArroz": false }, "tema": "o tema que ELE disse, ou null", "escrito": "nome e idade que ELE disse, ou null", "forminha": "cor que ele disse", "prato": "aberto|tampa",',
    '  "ehFesta": true, "pessoas": 0, "naoQuer": ["o que ele disse que não quer"],',
    '  "situacao": "reclamacao|cancelar|status|fora_do_assunto|humano", "chamarEquipe": "motivo, quando precisar de gente",',
    '  "confirmou": true, "aceitouValor": true, "recomecar": true, "comprovante": true,',
    '  "cardapio": "salgados|docinhos|bolos-festa|bolos-caseiros|pizza|tortas-empadao|cupcakes|franciscano|paes|cucas",',
    '  "escolherPorMim": ["salgado"]',
    "}",
    "CADA produto que ele citou nesta mensagem entra em itens, sempre: com a quantidade que ele disse (\"um bolo\" = 1, \"20 brigadeiro\" = 20, \"2 kg\" = 2) ou qtd 0 se ele não disse quantos. Perguntar algo NÃO dispensa anotar: anote e pergunte na mesma resposta. " +
      "Item que já estava anotado só volta em itens se mudou, com a quantidade TOTAL nova (\"muda pra 100\" = 100; \"mais 50\" = o que tinha + 50). Só mande os campos que mudaram; resposta é sempre obrigatória. " +
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
    const doMotor = calcularBase(e);
    const base = doMotor ?? { salgados: e.pessoas * 10, docinhos: e.pessoas * 5, boloKg: Math.round(e.pessoas * 10) / 100, totalCentavos: 0 };
    const soma = (pref: string[]) => e.itens.filter((i) => pref.some((p) => String(i.categoria).startsWith(p))).reduce((t, i) => t + (Number(i.qtd) || 0), 0);
    const temSalgado = soma(["salgado"]), temDocinho = soma(["docinho"]), temBolo = soma(["bolo"]);
    partes.push(
      "É festa pra " + e.pessoas + " pessoas. Sugestão da casa: " + base.salgados + " salgados, " + base.docinhos + " docinhos e " +
        String(base.boloKg).replace(".", ",") + " kg de bolo" + (base.totalCentavos ? ", " + brl(base.totalCentavos / 100) + " (valor do motor: é esse que você diz)" : "") + ". Anotado até agora: " + temSalgado + " salgados, " + temDocinho + " docinhos, " +
        String(temBolo).replace(".", ",") + " kg de bolo" + (e.naoQuer?.length ? " (ele não quer: " + e.naoQuer.join(", ") + ")" : "") + ".",
    );
  } else if (e.ehFesta) {
    partes.push("É festa, ainda sem número de pessoas.");
  }
  if (e.naoQuer?.length) partes.push("Ele não quer: " + e.naoQuer.join(", ") + ".");
  const falta = [...oQueFaltaPraFechar(e), ...faltaSabor(e), ...faltaPecasDoBolo(e), ...faltaDaFesta(e), ...faltaOferecer(e)];
  if (e.itens.length) partes.push(falta.length ? "FALTA PRA FECHAR: " + falta.join("; ") + "." : "Está tudo completo. Se ele pedir mudança, FAÇA a mudança (itens, tirar, dados) e diga só o que mudou. Não escreva o resumo nem os valores: o resumo com os valores e a pergunta \"Seria isso?\" vão junto automaticamente.");
  // A PROXIMA PERGUNTA E UMA SO E FECHA O ITEM ABERTO: quantidade, depois sabor,
  // depois o que a familia pede (forminha no docinho, pecas no bolo de festa).
  // So depois disso a conversa muda de familia (regra do dono, 03/09 20:32).
  const semQtd = e.itens.filter((i) => !(Number(i.qtd) > 0)).map((i) => i.produto);
  const semSabor = faltaSabor(e);
  const proxima = semQtd.length ? "a quantidade de " + semQtd.join(" e ")
    : semSabor.length ? semSabor.join("; ")
    : e.itens.some((i) => String(i.categoria) === "docinho") && !e.forminha ? "a cor da forminha dos docinhos (por escrito, com as cores)"
    : faltaPecasDoBolo(e)[0] ?? null;
  if (proxima) partes.push("PRÓXIMA PERGUNTA (uma só, antes de mudar de família ou de pedir dados): " + proxima + ".");
  if (e.pedidoAprovado) {
    const quando = quandoDoPedido(e.pedidoAprovado);
    partes.push("ATENÇÃO: ele já tem um pedido APROVADO pela equipe" + (quando ? " pra " + quando : "") + ". Esse pedido está fechado: NÃO pergunte nada dele (papel de arroz, topo, forminha, dados). Se ele agradecer ou disser \"beleza\", só responda curto e se despeça. Mudança nesse pedido é com a equipe (chamarEquipe). Pedido NOVO só se ele pedir outra coisa.");
  } else if (extra.pedidoNaFila) {
    partes.push("ATENÇÃO: o pedido acima já foi registrado e está na fila da equipe pra aprovação. Se ele só agradecer, diga isso; se quiser mudar algo, anote a mudança.");
  }
  if (extra.aguardandoValor) partes.push("ATENÇÃO: a padaria acabou de mandar o VALOR FINAL (com o topo orçado pela equipe) e perguntou se está certo. Só um sim ou não claro ao valor vira aceitouValor (true ou false). Cumprimento (\"boa tarde\"), dúvida ou outro assunto NÃO é resposta: responda o que ele disse e pergunte de novo se o valor está certo, sem aceitouValor.");
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

/**
 * ITEM ABERTO: o que ainda falta pra cada item ficar fechado. Regra geral da
 * casa (dono, 03/09): quantidade e sabor pra qualquer produto com sabor no
 * cardapio; docinho tambem a cor da forminha; bolo de festa tambem papel de
 * arroz, topo e tema. A chave e a palavra que a resposta precisa citar pra
 * contar como "esta cobrando isso".
 */
function r_confirmou(l: LeituraLivre): boolean { return l.confirmou === true; }
export function itensAbertos(e: Estado): { chave: string; oque: string }[] {
  const abertos: { chave: string; oque: string }[] = [];
  for (const i of e.itens) {
    const p = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
    const curto = p?.nomeCurto ?? i.produto;
    if (!(Number(i.qtd) > 0)) abertos.push({ chave: curto, oque: "quantidade de " + i.produto });
  }
  for (const i of e.itens) {
    const p = produtoPorNome(i.produto) ?? produtoNoComeco(i.produto);
    if (!p || p.saborFixo || p.sabores.length < 2) continue;
    const obs = semAcento(String(i.obs ?? ""));
    const tem = p.sabores.some((sab) => obs.includes(semAcento(sab))) || /a confirmar/.test(obs);
    if (!tem) abertos.push({ chave: p.nomeCurto, oque: "sabor do " + i.produto });
  }
  if (e.itens.some((i) => String(i.categoria) === "docinho") && !e.forminha) abertos.push({ chave: "forminha", oque: "cor da forminha" });
  if (e.itens.some((i) => String(i.categoria) === "bolo_festa")) {
    // Perguntar se quer misturar sabor tambem e cuidar do bolo: conta como cobrando.
    if (typeof e.pecas?.papelDeArroz !== "boolean" || typeof e.pecas?.topo !== "boolean") abertos.push({ chave: "mistur", oque: "misto do bolo" });
    if (typeof e.pecas?.papelDeArroz !== "boolean") abertos.push({ chave: "papel de arroz", oque: "papel de arroz" });
    if (typeof e.pecas?.topo !== "boolean") abertos.push({ chave: "topo", oque: "topo" });
    if ((e.pecas?.topo || e.pecas?.papelDeArroz) && !e.tema && !e.escrito) abertos.push({ chave: "tema", oque: "tema e escrito" });
  }
  return abertos;
}

/** A pergunta que falta, na ordem da casa: quantidade, sabor, forminha, depois a proxima familia da festa. Usada quando o codigo escreve a resposta. */
export function perguntaQueFalta(e: Estado): string {
  const semQtd = e.itens.filter((i) => !(Number(i.qtd) > 0));
  if (semQtd.length) return "Quantos de " + semQtd.map((i) => i.produto).join(" e ") + " você quer?";
  const sabores = faltaSabor(e);
  if (sabores.length) return "Qual " + sabores.join(" e qual ") + "?";
  const temDocinho = e.itens.some((i) => String(i.categoria) === "docinho");
  if (temDocinho && !e.forminha) return "Qual a cor da forminha dos docinhos? Tem amarelo, azul, branca, dourada, laranja, lilás, marrom, pink, prata, preta, rosa, roxo, verde e vermelha.";
  if (e.itens.some((i) => String(i.categoria) === "bolo_festa")) {
    if (typeof e.pecas?.papelDeArroz !== "boolean") return "No bolo, quer papel de arroz com a foto impressa (R$ 12,00)?";
    if (typeof e.pecas?.topo !== "boolean") return "Quer topo de bolo? O valor do topo a equipe orça e te passa.";
    if ((e.pecas?.topo || e.pecas?.papelDeArroz) && !e.tema && !e.escrito) return "Qual o tema, e o nome e a idade do aniversariante?";
  }
  const naoQuer = (e.naoQuer ?? []).map((x) => semAcento(String(x)));
  if (e.ehFesta && !temDocinho && !naoQuer.some((x) => x.startsWith("docinho"))) return "Agora os docinhos: quais você quer?";
  const temBolo = e.itens.some((i) => String(i.categoria) === "bolo_festa");
  if (e.ehFesta && !temBolo && !naoQuer.some((x) => x.startsWith("bolo"))) return "E o bolo, qual sabor você quer?";
  return "";
}

/** Bolo de festa pronto e nenhum salgado ou docinho no pedido: a oferta e feita UMA vez. Guia o modelo, nao trava o fechamento. */
export function faltaOferecer(e: Estado): string[] {
  if (e.ofereceu || e.ehFesta) return [];
  const temBoloDeFesta = e.itens.some((i) => String(i.categoria) === "bolo_festa");
  if (!temBoloDeFesta || faltaPecasDoBolo(e).length || faltaSabor(e).length) return [];
  if (e.itens.some((i) => /salgado|docinho/.test(String(i.categoria)))) return [];
  if ((e.naoQuer ?? []).some((n) => /salgad|docinh/i.test(String(n)))) return [];
  return ["oferecer salgadinhos e docinhos uma vez, antes dos dados (se ele não quiser, siga pros dados)"];
}

/** Bolo de festa sem resposta de papel de arroz e topo nao fecha: sao dinheiro (R$ 12 e o orcamento da equipe). */
export function faltaPecasDoBolo(e: Estado): string[] {
  const temBoloDeFesta = e.itens.some((i) => String(i.categoria) === "bolo_festa");
  if (!temBoloDeFesta) return [];
  const falta: string[] = [];
  if (e.pecas?.papelDeArroz !== true && e.pecas?.papelDeArroz !== false) falta.push("saber se quer papel de arroz com foto no bolo (sim ou não)");
  if (e.pecas?.topo !== true && e.pecas?.topo !== false) falta.push("saber se quer topo de bolo (sim ou não)");
  if ((e.pecas?.topo || e.pecas?.papelDeArroz) && !e.tema && !e.escrito) falta.push("o tema e o escrito do topo (o nome e a idade que ele disser aqui são do ANIVERSARIANTE, vão em escrito, não em dados.nome)");
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
export function aplicarLivre(antes: Estado, l: LeituraLivre, mensagem: string, ultimaPergunta: string | null = null): ResultadoLivre {
  const rastro: string[] = [];
  let e: Estado = { ...antes, itens: antes.itens.map((i) => ({ ...i })), dados: { ...antes.dados } };
  const avisos: string[] = [];
  let precisaHumano = false;
  let motivoHumano: string | null = null;
  let respostaCorrigida: string | null = null;
  const tiradosAgora = new Set<string>();

  // TIRAR VEM ANTES DE ANOTAR: trocar o sabor e tirar a linha velha e por a nova.
  for (const frase of l.tirar ?? []) {
    let idxs = linhasQueOClientePodeEstarTirando(e.itens, String(frase));
    // "sem brigadeiro" com o bolo brigadeiro e o docinho na lista: e o docinho. Do bolo ele fala "bolo".
    if (idxs.length > 1 && !/bolo/i.test(String(frase))) idxs = idxs.filter((n) => !(CATEGORIAS_DE_BOLO as readonly string[]).includes(String(e.itens[n].categoria)));
    if (idxs.length === 1) {
      rastro.push("tirou: " + e.itens[idxs[0]].produto);
      tiradosAgora.add(semAcento(e.itens[idxs[0]].produto));
      e.itens = e.itens.filter((_, n) => n !== idxs[0]);
    } else if (!idxs.length && e.itens.length === 1) {
      rastro.push("tirou o unico item: " + e.itens[0].produto);
      tiradosAgora.add(semAcento(e.itens[0].produto));
      e.itens = [];
    } else {
      rastro.push("nao sei qual tirar por \"" + frase + "\" (" + idxs.length + " candidatos)");
    }
  }

  // itens
  for (const bruto of l.itens ?? []) {
    const nomeBruto = String(bruto?.produto ?? "").trim();
    if (!nomeBruto) continue;
    // O NOME QUE O MODELO MANDOU VALE POR ELE MESMO: "brigadeiro" e o docinho,
    // o bolo vem com o prefixo. identificarProduto olhava a frase inteira e, com
    // "bolo de brigadeiro" na mesma frase, virava os 100 brigadeiros em 100 kg
    // de bolo (medido 03/09 19:01).
    const exato = produtoPorNome(nomeBruto);
    const quem = exato ? { produto: exato.nome } : identificarProduto(nomeBruto, undefined, mensagem);
    let canon = quem.produto;
    let daCasa = exato ?? produtoPorNome(canon) ?? produtoNoComeco(canon);
    // A PADARIA PERGUNTOU O SABOR DO BOLO e ele respondeu "brigadeiro com ninho":
    // e o bolo, nao o docinho (medido 03/09: virou docinho brigadeiro com qtd 0).
    const perguntouOBolo = /bolo/i.test(String(ultimaPergunta ?? "")) && !/docinho|salgad/i.test(String(ultimaPergunta ?? "").split("?").slice(-2, -1)[0] ?? "");
    const semBoloAinda = !e.itens.some((i) => (CATEGORIAS_DE_BOLO as readonly string[]).includes(String(i.categoria)));
    if (perguntouOBolo && semBoloAinda && daCasa && !(CATEGORIAS_DE_BOLO as readonly string[]).includes(daCasa.categoria)) {
      const primeiro = semAcento(nomeBruto).split(/ com | e /)[0].trim();
      const comoBolo = produtoPorNome("bolo " + primeiro) ?? produtoNoComeco("bolo " + primeiro);
      if (comoBolo) {
        rastro.push("resposta a pergunta do bolo virou o bolo: " + comoBolo.nome);
        daCasa = comoBolo; canon = comoBolo.nome;
        const resto = semAcento(nomeBruto).replace(primeiro, "").replace(/^\s*(com|e)\s+/, "").trim();
        if (resto && !bruto.sabor) bruto.sabor = primeiro + " com " + resto;
        if (!(Number(bruto.qtd) > 0) && e.pessoas) bruto.qtd = Math.round(e.pessoas * 10) / 100;
      }
    }
    if (!daCasa) {
      // "bolo" + sabor que existe como bolo ("bolo laka")
      const tentativa = bruto.sabor ? produtoPorNome(nomeBruto + " " + bruto.sabor) ?? produtoNoComeco(nomeBruto + " " + bruto.sabor) : null;
      if (tentativa) { daCasa = tentativa; canon = tentativa.nome; }
    }
    if (!daCasa && /^(salgad(o|a|inho)s?|docinhos?|doces?|bolos?|bolo de festa|bolo festa|tortas?|pizzas?|paes|pães|cucas?)$/i.test(semAcento(nomeBruto))) {
      // "200 salgados, 100 docinhos, 2 kg de bolo" da sugestao da festa: e familia,
      // nao produto. A sugestao ja mora no lembrete (pessoas x 10/5/100 g); a
      // quantidade vira item quando ele escolher os tipos. Sem aviso, que ele nao
      // pediu nada fora do cardapio (medido em producao 03/09 17:34).
      rastro.push("familia, nao produto (a sugestao da festa cobre): " + nomeBruto);
      continue;
    }
    if (!daCasa) {
      rastro.push("nao existe no cardapio, nao entrou: " + nomeBruto);
      continue;
    }
    canon = daCasa.nome;
    if (tiradosAgora.has(semAcento(canon)) && !(Number(bruto.qtd) > 0)) { rastro.push("saiu por tirar neste turno, nao volta: " + canon); continue; }
    // "bolo brigadeiro com morango" casou com "bolo brigadeiro" pelo comeco: o que
    // sobrou ("com morango") e o misto, e nao pode sumir (medido 03/09 19:02).
    if (!exato && !String(bruto.sabor ?? "").trim() && (CATEGORIAS_DE_BOLO as readonly string[]).includes(daCasa.categoria)) {
      const doProduto = new Set(semAcento(daCasa.nome).split(/\s+/));
      const sobra = semAcento(nomeBruto).split(/\s+/).filter((w) => w && w !== "de" && !doProduto.has(w));
      if (sobra.length) {
        bruto.sabor = daCasa.nomeCurto + " com " + sobra.join(" ").replace(/^(com|e)\s+/, "");
        rastro.push("sobra do nome virou o misto: " + bruto.sabor);
      }
    }
    // "2kg" ou "1,5" no lugar do numero: le o numero que tem dentro.
    let qtd = typeof bruto.qtd === "number" ? bruto.qtd : Number(String(bruto.qtd ?? "").replace(",", ".").match(/[0-9]+(\.[0-9]+)?/)?.[0] ?? 0) || 0;
    if (qtd < 0) qtd = 0;
    // "quero UM bolo de cenoura" e 1 bolo caseiro: quando o produto e inteiro
    // (caseiro, torta, pizza, cuca) e ele disse "um" ou "uma" do tipo, e 1.
    if (!qtd && daCasa.unidade === "un" && /bolo_caseiro|torta|pizza|cuca|empad/i.test(daCasa.categoria) && new RegExp("(^|[^a-z])(um|uma) +(" + daCasa.categoria.split("_")[0] + "|" + semAcento(daCasa.nomeCurto).split(" ")[0] + ")").test(semAcento(mensagem))) {
      qtd = 1;
      rastro.push("\"um\" virou 1: " + canon);
    }
    if (daCasa.unidade === "un" && !Number.isInteger(qtd)) qtd = Math.round(qtd);
    const ehBolo = (CATEGORIAS_DE_BOLO as readonly string[]).includes(daCasa.categoria);
    if (ehBolo && daCasa.unidade === "kg" && qtd > PESO_DO_MAIOR_BOLO) {
      rastro.push("bolo acima de 6 kg, zerei o peso: " + qtd);
      avisos.push("O maior bolo que a gente faz tem 6 kg. Me diz de novo o peso do " + canon + "?");
      qtd = 0;
    }
    let saborDito = String(bruto.sabor ?? "").trim() || null;
    if (saborDito && /^(a confirmar|nao informado|não informado|null|sem sabor|indefinido)$/i.test(saborDito)) { rastro.push("sabor vazio mandado como texto, ignorei: " + saborDito); saborDito = null; }
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
    let recado = String(bruto.obs ?? "").trim() || null;
    // Topo, papel, tema e escrito moram no estado, nao no recado do item: senao o
    // modelo reescreve o recheio como "sem topo, escrito Delamar" e o misto some.
    if (recado && /topo|papel de arroz|escrito|tema|forminha/i.test(recado)) { rastro.push("recado de peca fora do item: " + recado); recado = null; }
    const obs = [sabor, recado].filter(Boolean).join(" | ") || null;
    let idx = e.itens.findIndex((i) => semAcento(i.produto) === semAcento(canon) && (!saborDito || !i.obs || semAcento(i.obs).includes(semAcento(saborDito))));
    // UM BOLO SO. Se ja tem um bolo de festa e vem outro (sabor ou produto
    // diferente) sem ele ter pedido "outro bolo", e troca, nao e segundo bolo
    // (medido 03/09 19:06: virou dois bolos e R$ 640).
    if (idx < 0 && ehBolo && daCasa.categoria === "bolo_festa" && !/(outro|mais um|segundo|dois|duas|2) bolos?/i.test(mensagem)) {
      const doBolo = e.itens.findIndex((i) => String(i.categoria) === "bolo_festa");
      if (doBolo >= 0) {
        rastro.push("bolo trocado: " + e.itens[doBolo].produto + " (" + (e.itens[doBolo].obs ?? "") + ") -> " + canon + " (" + (obs ?? "") + ")");
        e.itens[doBolo] = { produto: canon, categoria: daCasa.categoria, qtd: qtd > 0 ? qtd : e.itens[doBolo].qtd, obs };
        continue;
      }
    }
    if (idx >= 0) {
      const atual = e.itens[idx];
      // Sem sabor novo dito, o recheio que ja estava fica; o recado novo entra ao lado.
      const obsMesclada = saborDito
        ? obs ?? atual.obs
        : [atual.obs, recado && !semAcento(String(atual.obs ?? "")).includes(semAcento(recado)) ? recado : null].filter(Boolean).join(" | ") || null;
      e.itens[idx] = { ...atual, qtd: qtd > 0 ? qtd : atual.qtd, obs: obsMesclada };
    } else {
      e.itens.push({ produto: canon, categoria: daCasa.categoria, qtd, obs });
    }
  }

  // NA FESTA, O BOLO SEM PESO DITO E O DA SUGESTAO (100 g por pessoa).
  if (e.ehFesta && e.pessoas) {
    for (const i of e.itens) {
      if (String(i.categoria) === "bolo_festa" && !(Number(i.qtd) > 0)) { i.qtd = Math.round(e.pessoas * 10) / 100; rastro.push("bolo da festa sem peso dito: " + i.qtd + " kg da sugestao"); }
    }
  }

  // NA FESTA, OS TIPOS QUE ELE ESCOLHEU SEM NUMERO REPARTEM A SUGESTAO DA FAMILIA
  // (10 salgados e 5 docinhos por pessoa). "brigadeiro e beijinho" pra 15 pessoas
  // = 38 + 37. O modelo devia fazer isso e nem sempre faz (medido 03/09); e conta
  // da casa, entao o codigo faz. Quem ja tem numero dito fica com o numero.
  if (e.ehFesta && e.pessoas) {
    for (const [pref, porPessoa] of [["salgado", 10], ["docinho", 5]] as const) {
      const daFamilia = e.itens.filter((i) => String(i.categoria).startsWith(pref));
      const semNumero = daFamilia.filter((i) => !(Number(i.qtd) > 0));
      if (!semNumero.length) continue;
      const alvo = e.pessoas * porPessoa;
      // "metade de cada" com tres tipos: o modelo deu 75 pra um e nada pros outros
      // (medido 03/09 20:31). "De cada" e igual pra todos os tipos citados agora.
      if (/de cada|cada um|igual|dividid/i.test(mensagem)) {
        const citados = daFamilia.filter((i) => (l.itens ?? []).some((b) => semAcento(String(b?.produto ?? "")) === semAcento(i.produto) || semAcento(i.produto).startsWith(semAcento(String(b?.produto ?? "")).split(" ")[0])));
        const grupo = citados.length ? citados : daFamilia;
        const cada = Math.floor(alvo / grupo.length);
        grupo.forEach((i, n) => { i.qtd = cada + (n === 0 ? alvo - cada * grupo.length : 0); });
        rastro.push("de cada: " + alvo + " de " + pref + " repartidos igual entre " + grupo.map((i) => i.produto).join(", "));
        respostaCorrigida = "Anotei " + grupo.map((i) => i.qtd + " " + i.produto).join(", ") + ". " + perguntaQueFalta(e);
        continue;
      }
      const jaDito = daFamilia.reduce((t, i) => t + (Number(i.qtd) || 0), 0);
      const sobra = Math.max(alvo - jaDito, 0);
      if (!sobra) continue;
      const cada = Math.floor(sobra / semNumero.length);
      semNumero.forEach((i, n) => { i.qtd = cada + (n === 0 ? sobra - cada * semNumero.length : 0); });
      rastro.push("reparti a sugestao de " + pref + " (" + sobra + ") entre " + semNumero.map((i) => i.produto).join(", "));
      respostaCorrigida = "Anotei " + semNumero.map((i) => i.qtd + " " + i.produto).join(" e ") + ". " + perguntaQueFalta(e);
    }
  }

  // BOLO MISTO E UMA LINHA. O modelo as vezes reparte "1,5 kg misto de brigadeiro
  // com morango" em dois bolos de 0,75 kg. Dois bolos de festa NOVOS no mesmo
  // turno, com o mesmo peso, e sem "2 bolos" na frase, sao um bolo misto: o
  // produto e o mais caro (regra da casa) e o outro sabor vai no recheio.
  const novosBolos = e.itens.filter((i) => String(i.categoria) === "bolo_festa" && !antes.itens.some((a) => semAcento(a.produto) === semAcento(i.produto)));
  if (novosBolos.length >= 2 && novosBolos.every((b) => b.qtd === novosBolos[0].qtd) && !/(^|[^a-z])(2|dois|duas) +bolos?/i.test(mensagem)) {
    const comPreco = novosBolos.map((b) => ({ b, preco: produtoPorNome(b.produto)?.preco ?? 0, curto: produtoPorNome(b.produto)?.nomeCurto ?? b.produto }));
    comPreco.sort((x, y) => y.preco - x.preco);
    const principal = comPreco[0];
    const peso = novosBolos.reduce((t, b) => t + (Number(b.qtd) || 0), 0);
    const outros = comPreco.slice(1).map((x) => x.curto);
    const recado = novosBolos.map((b) => String(b.obs ?? "")).filter((o) => o && !/sabor a confirmar/.test(o)).find((o) => !comPreco.some((x) => semAcento(x.curto) === semAcento(o)));
    const obs = [principal.curto + " com " + outros.join(" e "), recado ?? null].filter(Boolean).join(" | ");
    e.itens = e.itens.filter((i) => !novosBolos.includes(i));
    e.itens.push({ produto: principal.b.produto, categoria: principal.b.categoria, qtd: Math.round(peso * 1000) / 1000, obs });
    rastro.push("dois bolos novos com o mesmo peso viraram um misto: " + principal.b.produto + " " + peso + " kg (" + obs + ")");
  }

  // dados
  if (l.dados) {
    const d = { ...e.dados };
    // "Delamar 58 anos" respondendo o tema do topo e o aniversariante, nao quem retira.
    const idade = mensagem.match(/(\d{1,3})\s*anos/i);
    const temPeca = Boolean(e.pecas?.topo || e.pecas?.papelDeArroz);
    if (l.dados.nome?.trim() && temPeca && !e.escrito && !l.escrito?.trim() && (idade || !e.dados.data)) {
      e.escrito = l.dados.nome.trim() + (idade && !/anos/i.test(l.dados.nome) ? " " + idade[1] + " anos" : "");
      rastro.push("nome dito na hora do topo virou o escrito: " + e.escrito);
      respostaCorrigida = "Anotei no topo: " + e.escrito + ". " + (faltaOferecer({ ...e, dados: d }).length ? "Quer aproveitar e pedir salgadinhos ou docinhos também?" : !d.data ? "Pra que dia e horário é a retirada?" : "");
    } else if (l.dados.nome?.trim()) d.nome = l.dados.nome.trim();
    if (l.dados.pagamento?.trim()) d.pagamento = semAcento(l.dados.pagamento.trim()).replace(/[^a-z]/g, "") || d.pagamento;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(l.dados.data ?? ""))) d.data = String(l.dados.data);
    if (/^\d{1,2}:\d{2}$/.test(String(l.dados.hora ?? ""))) d.hora = String(l.dados.hora).padStart(5, "0");
    if (d.data && d.hora) {
      const fora = retiradaForaDoExpediente(d.data, d.hora);
      if (fora) { avisos.push(fora); d.hora = null; rastro.push("hora fora do expediente, apagada"); }
    }
    // O modelo disse que 15h "não está no horário" (medido 03/09, quarta, 6h30 às 20h).
    // Quem sabe o expediente e o codigo: hora dita na frase, dentro do horario, entra.
    const hDita = mensagem.match(/(^|[^0-9])(\d{1,2})\s*(h|hs|:|horas)\s*(\d{2})?/i);
    if (!d.hora && d.data && hDita) {
      const hora = String(hDita[2]).padStart(2, "0") + ":" + (hDita[4] ?? "00");
      if (!retiradaForaDoExpediente(d.data, hora)) {
        d.hora = hora;
        rastro.push("hora da frase, dentro do expediente: " + hora);
        if (/hor[aá]rio de funcionamento|fora do (nosso )?hor[aá]rio|n[aã]o est[aá] dentro|outro hor[aá]rio/i.test(String(l.resposta ?? ""))) {
          respostaCorrigida = "Anotei a retirada dia " + d.data.slice(0, 5) + " às " + hora + ". " + (!d.pagamento ? "Como você prefere pagar: pix, cartão ou dinheiro?" : !d.nome ? "Qual o nome de quem vai retirar?" : "");
        }
      }
    }
    e.dados = d;
  }
  // O modelo manda "topo: false" sem ninguem ter perguntado (medido 03/09, no
  // primeiro turno do bolo). Peca so muda quando ela foi falada: na pergunta
  // que a padaria acabou de fazer ou na frase do cliente.
  const falouDePapel = /papel de arroz/i.test(String(ultimaPergunta ?? "") + " " + mensagem);
  const falouDeTopo = /topo/i.test(String(ultimaPergunta ?? "") + " " + mensagem);
  if (l.pecas) {
    const topo = typeof l.pecas.topo === "boolean" && falouDeTopo ? l.pecas.topo : e.pecas?.topo ?? null;
    const papelDeArroz = typeof l.pecas.papelDeArroz === "boolean" && falouDePapel ? l.pecas.papelDeArroz : e.pecas?.papelDeArroz ?? null;
    if (topo !== (e.pecas?.topo ?? null) || papelDeArroz !== (e.pecas?.papelDeArroz ?? null)) e.pecas = { topo, papelDeArroz };
    else if (typeof l.pecas.topo === "boolean" && !falouDeTopo) rastro.push("ignorei pecas.topo do modelo: ninguem falou de topo");
  }
  // UM "SIM" OU "NAO" SECO A PERGUNTA DO PAPEL DE ARROZ OU DO TOPO E RESPOSTA,
  // mesmo quando o modelo nao manda pecas (medido 03/09: "sim" ao topo fez a
  // Dora repetir "Quer topo de bolo?"). A pergunta que a padaria acabou de fazer
  // diz de qual peca e o sim; o codigo anota e escreve a resposta, porque a do
  // modelo, nesse caso, e a pergunta repetida.
  const disseSim = /^(sim|s|isso|quero|quero sim|pode ser|claro|com certeza|ok|uhum|aham|pode|bora)[!. ]*$/i.test(mensagem.trim());
  const disseNao = /^(n[aã]o|nao quero|não quero|sem|dispenso|n|nao precisa|não precisa)[!. ]*$/i.test(mensagem.trim());
  const pergunta = semAcento(String(ultimaPergunta ?? ""));
  if ((disseSim || disseNao) && pergunta && e.itens.some((i) => String(i.categoria) === "bolo_festa")) {
    // So entra quando o MODELO nao marcou a peca: se ele mandou pecas, a leitura e dele.
    const papelEmAberto = /papel de arroz/.test(pergunta) && typeof antes.pecas?.papelDeArroz !== "boolean" && typeof l.pecas?.papelDeArroz !== "boolean";
    const topoEmAberto = /topo/.test(pergunta) && typeof antes.pecas?.topo !== "boolean" && typeof l.pecas?.topo !== "boolean";
    if (papelEmAberto && !(topoEmAberto && !/papel de arroz\?/.test(pergunta) && /topo[^?]*\?/.test(pergunta))) {
      e.pecas = { topo: e.pecas?.topo ?? null, papelDeArroz: disseSim };
      rastro.push("sim/nao seco a pergunta do papel de arroz: " + disseSim);
      respostaCorrigida = (disseSim ? "Anotei o papel de arroz com a foto. " : "Sem papel de arroz. ") + (typeof e.pecas.topo === "boolean" ? "" : "Quer topo de bolo também? O valor do topo a equipe orça e te passa.");
    } else if (topoEmAberto) {
      e.pecas = { topo: disseSim, papelDeArroz: e.pecas?.papelDeArroz ?? null };
      rastro.push("sim/nao seco a pergunta do topo: " + disseSim);
      respostaCorrigida = disseSim
        ? "Anotei o topo, a equipe orça o valor dele e te passa. Qual o tema, e o nome e a idade do aniversariante?"
        : "Sem topo. " + ((e.pecas.papelDeArroz && !e.escrito && !e.tema) ? "Qual o tema do papel de arroz e o que vai escrito?" : "");
    }
  }
  if (e.pecas?.papelDeArroz === true && !e.itens.some((i) => /papel de arroz/i.test(i.produto))) {
    const papel = produtoPorNome("papel de arroz");
    if (papel) e.itens.push({ produto: papel.nome, categoria: papel.categoria, qtd: 1, obs: null });
  }
  if (e.pecas?.papelDeArroz === false) e.itens = e.itens.filter((i) => !/papel de arroz/i.test(i.produto));
  if (l.tema?.trim()) e.tema = l.tema.trim();
  // FOTO DE REFERENCIA: ela ja fica guardada e vai junto no pedido pra equipe.
  // Mandou a foto na hora do tema, o tema e a foto (medido 03/09 21:45: a Dora
  // disse que nao consegue ver imagens e pediu o tema de novo).
  if (/enviou uma foto de refer/i.test(mensagem) && !e.tema && (e.pecas?.topo || e.pecas?.papelDeArroz || e.itens.some((i) => String(i.categoria) === "bolo_festa"))) {
    e.tema = "conforme a foto enviada";
    rastro.push("foto de referencia virou o tema");
  }
  if (l.escrito?.trim()) e.escrito = l.escrito.trim();
  // "NAO QUERO NADA ESCRITO" e resposta, nao falta (medido 03/09 22:38: tres
  // "sim" e o pedido nunca fechou porque o escrito continuava vazio).
  if (!e.escrito && (e.pecas?.topo || e.pecas?.papelDeArroz) && /nao quero nada escrito|sem nada escrito|sem escrito|nada escrito|sem nome|sem frase|nao precisa (de )?escrever|nao precisa (de )?nada escrito/i.test(semAcento(mensagem))) {
    e.escrito = "sem nada escrito";
    rastro.push("ele nao quer nada escrito na peca");
  }
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
  if ((l.prato === "aberto" || l.prato === "tampa") && /prato|caixa|tampa|embalagem/i.test(String(ultimaPergunta ?? "") + " " + mensagem)) e.prato = l.prato;
  // O TEMA, O ESCRITO E AS PECAS VAO NA OBS DO BOLO: e dali que a comanda da
  // confeiteira le. A comanda de 03/09 saiu "3 kg bolo brigadeiro com maracuja"
  // sem o tema minecraft e sem o escrito, porque o estado guardava e o item nao.
  for (const i of e.itens) {
    if (String(i.categoria) !== "bolo_festa") continue;
    const lido = lerObs(i.obs);
    const resto = [...(lido.resto ?? [])];
    i.obs = escreverObs({
      tema: e.tema, escrito: e.escrito,
      topo: e.pecas?.topo === true, papelDeArroz: e.pecas?.papelDeArroz === true,
      embalagem: e.prato === "aberto" ? "prato aberto" : e.prato === "tampa" ? "caixa com tampa" : null,
      resto,
    }) || null;
  }
  if (l.ehFesta === true) e.ehFesta = true;
  if (Number(l.pessoas) > 0) { e.pessoas = Number(l.pessoas); e.ehFesta = true; }
  if (l.naoQuer?.length) e.naoQuer = [...new Set([...(e.naoQuer ?? []), ...l.naoQuer.map(String)])];
  if (!e.ofereceu && e.itens.some((i) => String(i.categoria) === "bolo_festa") && /salgad|docinh/i.test(String(l.resposta ?? ""))) {
    e.ofereceu = true;
    rastro.push("ofereceu salgados e docinhos");
  }

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
  if (respostaCorrigida && !respostaCorrigida.includes("?")) {
    respostaCorrigida = respostaCorrigida.trim() + " " + (faltaOferecer(e).length ? "Quer aproveitar e pedir salgadinhos ou docinhos também?" : !e.dados.data ? "Pra que dia e horário é a retirada?" : "Posso seguir pra fechar?");
  }
  let texto = semEmojiETravessao(String(respostaCorrigida ?? l.resposta ?? "").trim());
  // REGRA GERAL: ITEM ABERTO FECHA ANTES DE QUALQUER OUTRA COISA. Vale pra toda
  // resposta, escrita pelo modelo ou pelo codigo. Se tem item sem quantidade,
  // sem sabor, docinho sem forminha ou bolo sem peca, e a resposta nao cobra
  // nenhum deles, a pergunta do item entra no lugar da pergunta que estava.
  const abertos = itensAbertos(e);
  if (abertos.length && !precisaHumano && !l.situacao && !l.chamarEquipe && !r_confirmou(l)) {
    const t = semAcento(texto);
    const cobra = abertos.some((a) => t.includes(semAcento(a.chave)));
    // So quando a resposta esta AVANCANDO por cima do item aberto: outra familia,
    // dados da retirada, pagamento, nome, fechamento. "Quantas pessoas?" ou a
    // resposta a uma duvida dele nao e avancar (medido 03/09 21:22: a regra
    // atropelou o "quantas pessoas" com o sabor do pastel de um rascunho velho).
    const avancou = /docinho|salgad|(^|[^a-z])bolo([^a-z]|$)|que dia|qual dia|dia e hor|horario|hora da retirada|retirar|retirada|pagamento|pagar|nome de quem|nome pra|mais alguma coisa|posso fechar|fechar o pedido|resumo/.test(t);
    if (!cobra && avancou) {
      const pergunta = perguntaQueFalta(e);
      const semPerguntas = texto.split(/(?<=[.!?])\s+/).filter((f) => !f.includes("?")).join(" ").trim();
      texto = (semPerguntas ? semPerguntas + " " : "") + pergunta;
      rastro.push("item aberto (" + abertos.map((a) => a.oque).join(", ") + ") e a resposta nao cobrava: pus a pergunta do item");
    }
  }
  if (respostaCorrigida && /salgad|docinh/i.test(respostaCorrigida)) e.ofereceu = true;
  const cot = e.itens.length ? motorPadrao.cotarPorItens(paraOMotor(e.itens)) : null;
  const permitidos = new Set<string>();
  const add = (n: number) => { if (n > 0) permitidos.add((Math.round(n * 100) / 100).toFixed(2)); };
  for (const p of produtosDaCasa()) add(p.preco);
  if (cot) { add(Number(cot.total || 0)); for (const li of cot.linhas ?? []) { add(Number(li.subtotal ?? 0)); } }
  if (e.pessoas) {
    add(e.pessoas * 10);
    // O valor da sugestao da festa e do motor, e o modelo pode cita-lo (e as linhas dele).
    const b = calcularBase(e);
    if (b) add(b.totalCentavos / 100);
    for (const li of motorPadrao.sugerirPorPessoas(e.pessoas, { salgado: true, doce: true, bolo: true }).linhas ?? []) add(Number((li as { subtotal?: number }).subtotal ?? 0));
  }
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
// UMA MENSAGEM POR VEZ POR CLIENTE. Duas mensagens seguidas ("3kg" e "quero
// prata", 03/09 19:03) eram atendidas ao mesmo tempo, cada uma lendo o estado
// velho, e as respostas saiam trocadas. A segunda espera a primeira gravar.
const emAndamento = new Map<string, Promise<unknown>>();
export async function atenderLivre(...args: Parameters<typeof atenderLivreDeVerdade>): ReturnType<typeof atenderLivreDeVerdade> {
  const chave = args[1] + ":" + args[2];
  const anterior = emAndamento.get(chave) ?? Promise.resolve();
  const minha = anterior.catch(() => undefined).then(() => atenderLivreDeVerdade(...args));
  emAndamento.set(chave, minha);
  try {
    return await minha;
  } finally {
    if (emAndamento.get(chave) === minha) emAndamento.delete(chave);
  }
}

async function atenderLivreDeVerdade(
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
  const recusou = async (motivo: string, falaDoModelo: string | null = null): Promise<RespostaDoFluxo> => {
    await devolverPedidoParaEquipe(negocioId, clienteId, motivo + ": " + mensagem.texto.slice(0, 200));
    return { texto: falaDoModelo?.trim() || "Entendi. Vou passar pra equipe da padaria pra eles verem o que dá pra fazer, e te respondo por aqui.", botoes: [], cardapio: null, etapa: "registrado", precisaHumano: true, rastro: ["devolvi o pedido pra equipe: " + motivo], uso };
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
  const lembrete = lembreteDoPedido(antes, { pedidoNaFila, aguardandoValor, avisoDoDia });
  let l = await pensar({ instrucao: instrucaoLivre(), historico, lembrete, mensagem: texto });
  const ultimaPergunta = [...historico].reverse().find((h) => h.papel === "assistant")?.conteudo ?? null;
  let r = aplicarLivre(antes, l, texto, ultimaPergunta);
  const rastro = ["livre", ...r.rastro];
  // ITEM QUE NAO EXISTE NO CARDAPIO: em vez de colar um aviso de robo na fala
  // (o dono odiou, 03/09), a IA fala de novo sabendo que o item nao entrou, com
  // as palavras dela. Segunda chamada so nesse caso, que e raro.
  const foraDoCardapio = r.rastro.filter((x) => x.startsWith("nao existe no cardapio")).map((x) => x.replace(/^[^:]*: /, ""));
  if (foraDoCardapio.length) {
    l = await pensar({
      instrucao: instrucaoLivre(), historico, mensagem: texto,
      lembrete: lembrete + "\n\nATENÇÃO: \"" + foraDoCardapio.join("\", \"") + "\" não existe no cardápio e NÃO foi anotado. Diga isso ao cliente do seu jeito, ofereça o que a casa tem de parecido, e não mande esse item em itens.",
    });
    r = aplicarLivre(antes, l, texto, ultimaPergunta);
    rastro.push("segunda leitura: a IA avisou do item fora do cardapio (" + foraDoCardapio.join(", ") + ")", ...r.rastro);
  }

  if (aguardandoValor) {
    // "Boa tarde" depois do valor orcado nao e aceite: e cumprimento. O modelo
    // ja leu isso como sim uma vez em producao (03/09, 17:08). A padaria
    // responde e pergunta de novo, com os botoes.
    const soCumprimento = /^(oi+|ola|olá|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem\??|oi tudo bem\??)[!. ]*$/i.test(String(mensagem.texto ?? "").trim());
    if (soCumprimento) {
      await gravarEstado(negocioId, clienteId, antes, r.estado);
      return {
        texto: "Oi! Ainda preciso saber se o valor que te passei está certo pra eu passar o pedido pra confirmação. Tá certo assim?",
        botoes: [{ id: "valor_sim", titulo: "Tá certo" }, { id: "valor_nao", titulo: "Não" }],
        cardapio: null, etapa: "confirmacao", precisaHumano: false, rastro: [...rastro, "cumprimento com valor em aberto: perguntei de novo"], uso,
      };
    }
    if (r.aceitouValor === true) return aceitou();
    if (r.aceitouValor === false) return recusou("O cliente nao aceitou o valor", r.texto);
    if ((l.itens?.length || l.tirar?.length || l.dados) && !r.confirmou) {
      return recusou("O cliente quer mudar o pedido depois do valor orcado", r.texto);
    }
  }

  if (r.recomecar) {
    await zerar(negocioId, clienteId);
    return { texto: r.texto, botoes: [], cardapio: null, etapa: "abertura", precisaHumano: false, rastro: [...rastro, "recomecar: zerei o rascunho"], uso };
  }

  // O RESUMO ANTES DE FECHAR E DO MOTOR, no mesmo formato do fechamento, uma
  // vez so (marca em assunto = "confirmacao"; qualquer mudanca desmarca).
  let textoFinal = r.texto;
  const mudouAlgo = Boolean(l.itens?.length || l.tirar?.length || l.dados || l.pecas || l.tema || l.escrito || l.forminha || l.escolherPorMim?.length);
  if (mudouAlgo && r.estado.assunto === "confirmacao") r.estado.assunto = null;
  if (!r.confirmou && !pedidoNaFila && !pedidoAprovado && r.estado.itens.length && r.estado.assunto !== "confirmacao") {
    const faltaAgora = [...oQueFaltaPraFechar(r.estado), ...faltaSabor(r.estado), ...faltaPecasDoBolo(r.estado), ...faltaDaFesta(r.estado)];
    if (!faltaAgora.length) {
      const cot = motorPadrao.cotarPorItens(paraOMotor(r.estado.itens));
      const linhas = (cot.linhas ?? []).map((li) => "- " + li.qtd + (li.unidade === "kg" ? " kg de " : " ") + li.item + (li.obs ? " (" + li.obs + ")" : "") + " = " + brl(Number(li.subtotal)));
      const d = r.estado.dados;
      const fala = r.texto.split(/(?<=[.!?])\s+/)[0] ?? "";
      textoFinal =
        (fala && !fala.includes("R$") && !/resumo/i.test(fala) ? fala + "\n\n" : "") +
        "Seu pedido:\n" + linhas.join("\n") + "\n*Total: " + brl(Number(cot.total || 0)) + "*" +
        (d.data ? "\nRetirada " + d.data + (d.hora ? " às " + d.hora : "") : "") +
        (d.nome ? ", no nome de " + d.nome : "") + (d.pagamento ? ", pagamento " + d.pagamento : "") +
        (r.estado.pecas?.topo ? "\n_O topo entra à parte: a equipe orça e confirma com você._" : "") +
        "\n\nSeria isso?";
      r.estado.assunto = "confirmacao";
      rastro.push("resumo do motor antes de fechar");
    }
  }

  await gravarEstado(negocioId, clienteId, antes, r.estado);

  let pedidoId: string | undefined;
  if (r.confirmou && !pedidoNaFila && !pedidoAprovado) {
    const falta = [...oQueFaltaPraFechar(r.estado), ...faltaSabor(r.estado), ...faltaPecasDoBolo(r.estado), ...faltaDaFesta(r.estado)];
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
      // O modelo escreveu "pedido confirmado e enviado" com o pedido ainda aberto
      // (03/09 22:39). Se falta algo, a resposta e o que falta, e nada de "enviado".
      textoFinal = "Só falta " + falta.join(" e ") + " pra eu fechar o pedido.";
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
