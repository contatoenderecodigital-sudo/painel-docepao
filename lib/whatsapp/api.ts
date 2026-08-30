// ============================================================================
//  WHATSAPP (Meta Cloud API) — enviar mensagem e baixar áudio.
//  O webhook recebe; estas funções respondem e buscam mídia.
// ============================================================================

import { produtosDaCasa, produtoPorNome } from "@/lib/ia/dados/produtos";
import { brl } from "@/lib/ia/orcamento";

// Credenciais GLOBAIS (env) = fallback. Quando o negocio conecta o WhatsApp
// pelo botao (Embedded Signup), o webhook passa as creds DELE aqui e a gente
// responde pelo numero do cliente. Sem conexao, usa o env (numero de teste).
const ENV_TOKEN = process.env.WHATSAPP_TOKEN;
const ENV_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const BASE = "https://graph.facebook.com/v25.0";
const LIMITE_TEXTO = 4096;
const LIMITE_TEXTO_COM_BOTOES = 1024;

/**
 * Divide texto no limite da Meta sem perder nenhum caractere.
 *
 * Procura uma quebra perto do fim para nao cortar palavra. Quando nao existe,
 * corta exatamente no limite. O espaco ou a quebra fica em uma das partes,
 * entao juntar o resultado devolve o original inteiro.
 */
export function partesDaMensagem(texto: string, limite = LIMITE_TEXTO): string[] {
  const partes: string[] = [];
  let falta = String(texto ?? "");
  const teto = Math.max(1, Math.floor(limite));
  while (falta.length > teto) {
    const janela = falta.slice(0, teto);
    let corte = Math.max(janela.lastIndexOf("\n"), janela.lastIndexOf(" "));
    if (corte < Math.floor(teto / 2)) corte = teto;
    else corte += 1;
    partes.push(falta.slice(0, corte));
    falta = falta.slice(corte);
  }
  if (falta || !partes.length) partes.push(falta);
  return partes;
}

// Token+numero usados pra falar com a Graph API. Prioriza o do tenant.
export type CredsEnvio = { token?: string | null; phoneId?: string | null };
function resolverCreds(creds?: CredsEnvio): { token: string; phoneId: string } {
  const token = creds?.token || ENV_TOKEN;
  const phoneId = creds?.phoneId || ENV_PHONE_ID;
  if (!token || !phoneId) throw new Error("Faltam credenciais do WhatsApp (token/phone_id do tenant ou env)");
  return { token, phoneId };
}

// Brasil: o wa_id do WhatsApp costuma vir SEM o 9º dígito do celular
// (55 + DDD + 8 dígitos = 12), mas pra ENVIAR o número precisa do 9
// (55 + DDD + 9 + 8 = 13). Aqui a gente adiciona o 9 quando falta.
function normalizarBR(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (n.startsWith("55") && n.length === 12) {
    return n.slice(0, 4) + "9" + n.slice(4);
  }
  return n;
}

// Manda um texto de volta pro cliente (pelo numero do tenant, ou o do env).
// Confirma a leitura e liga o 'digitando...' pro cliente. As duas coisas na
// mesma chamada, como a Meta entrega. O 'digitando' cai sozinho quando a
// resposta sai ou depois de 25s, entao nao precisa desligar.
export async function marcarLidaEDigitando(
  wamid: string,
  creds?: CredsEnvio,
): Promise<void> {
  const { token, phoneId } = resolverCreds(creds);
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: wamid,
      typing_indicator: { type: "text" },
    }),
  });
  if (!r.ok) {
    console.error("[whatsapp] falha ao marcar lida/digitando:", r.status, await r.text());
  }
}

export async function enviarTexto(para: string, texto: string, creds?: CredsEnvio): Promise<string | null> {
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);
  const partes = partesDaMensagem(texto);
  let ultimoWamid: string | null = null;
  for (let i = 0; i < partes.length; i++) {
    console.log(
      `[whatsapp] enviando para ${destino} (recebido: ${para}) via ${phoneId}` +
        (partes.length > 1 ? `, parte ${i + 1}/${partes.length}` : ""),
    );
    const r = await fetch(`${BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "text",
        text: { body: partes[i] },
      }),
    });
    if (!r.ok) throw new Error(`Falha ao enviar WhatsApp: ${r.status} ${await r.text()}`);
    // O ultimo id representa a resposta inteira para o recibo da conversa.
    try {
      const corpo = (await r.json()) as { messages?: { id?: string }[] };
      ultimoWamid = corpo?.messages?.[0]?.id ?? ultimoWamid;
    } catch {
      // A mensagem foi aceita. O recibo pode ficar sem id, como antes.
    }
  }
  return ultimoWamid;
}

// BOTAO DE RESPOSTA: ate tres, 20 caracteres cada.
//
// Quando a resposta e fechada ("pode ser?", "topo e papel?"), o cliente toca em
// vez de digitar e chega um ID no webhook, nao uma frase pra adivinhar. Metade
// dos guardas deste projeto existe pra interpretar texto livre onde a resposta
// so podia ser uma de tres.
//
// Caso real de 22/08/2026, conversa do Sandro: a base de R$ 418,80 foi aceita
// com "Pode ser, vou querer bolo tambem dai" e nao virou pedido nenhum, porque
// a guarda de aceite so entendia oferta de produto. Com botao, "Pode ser" chega
// como codigo e nao tem o que interpretar.
//
// O limite de 20 caracteres e da Meta e nao perdoa: titulo maior que isso faz a
// mensagem INTEIRA falhar com 400, e o cliente fica sem resposta. Por isso o
// corte acontece aqui, e nao na confianca de quem escreveu o texto.
export async function enviarBotoes(
  para: string,
  texto: string,
  botoes: { id: string; titulo: string }[],
  creds?: CredsEnvio,
  rodape?: string,
): Promise<string | null> {
  const textoInteiro = String(texto || "");
  // Corpo interativo aceita menos texto que mensagem comum. Cortar aqui fazia
  // o fim do resumo desaparecer, inclusive total e retirada. Resumo inteiro
  // vale mais que o conforto do botao; o cliente tambem pode confirmar
  // escrevendo, caminho que o fluxo ja aceita.
  if (textoInteiro.length > LIMITE_TEXTO_COM_BOTOES) {
    console.log("[whatsapp] texto nao cabe com botoes; enviando inteiro sem botoes");
    return enviarTexto(para, textoInteiro, creds);
  }
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);
  const tres = botoes.slice(0, 3).map((b, i) => ({
    type: "reply" as const,
    reply: {
      id: String(b.id || "opcao_" + i).slice(0, 256),
      title: String(b.titulo || "").trim().slice(0, 20),
    },
  }));
  if (!tres.length) return enviarTexto(para, texto, creds);
  console.log(
    "[whatsapp] botoes para " + destino + ": " + tres.map((b) => b.reply.title).join(" | "),
  );
  const corpoMsg: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: destino,
    type: "interactive",
    interactive: {
      type: "button",
      // O corpo tambem tem teto. Texto grande ja saiu inteiro logo acima.
      body: { text: textoInteiro },
      action: { buttons: tres },
    },
  };
  if (rodape) {
    (corpoMsg.interactive as Record<string, unknown>).footer = { text: String(rodape).slice(0, 60) };
  }
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpoMsg),
  });
  if (!r.ok) {
    // NUNCA DEIXAR O CLIENTE SEM RESPOSTA POR CAUSA DE BOTAO.
    //
    // Botao e conforto; a resposta e o pedido. Se a Meta recusar (limite de
    // caractere, conta sem permissao, o que for), o texto vai puro e a conversa
    // segue: o cliente digita a resposta como sempre digitou.
    const erro = await r.text();
    console.error("[whatsapp] botao recusado pela Meta, mandando texto puro:", r.status, erro.slice(0, 300));
    return enviarTexto(para, texto, creds);
  }
  try {
    const corpo = (await r.json()) as { messages?: { id?: string }[] };
    return corpo?.messages?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Manda um TEMPLATE aprovado (única forma de falar FORA da janela de 24h, e de
// iniciar conversa proativa). `componentes` preenche as variáveis {{1}}, {{2}}...
// do corpo, quando o template tiver. Sem variáveis, é só nome + idioma.
export async function enviarTemplate(
  para: string,
  nome: string,
  idioma: string,
  creds?: CredsEnvio,
  parametros?: string[],
): Promise<void> {
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);
  const componentes =
    parametros && parametros.length
      ? [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: t })) }]
      : undefined;
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino,
      type: "template",
      template: { name: nome, language: { code: idioma }, ...(componentes ? { components: componentes } : {}) },
    }),
  });
  if (!r.ok) throw new Error(`Falha ao enviar template: ${r.status} ${await r.text()}`);
}

// Envia um ANEXO (imagem ou documento) pela Cloud API. Dois passos: sobe o
// binário em /media (ganha um id) e depois manda a mensagem referenciando o id.
// `tipo` = 'image' | 'document'. `legenda`/`nome` são opcionais.
export async function enviarMidia(
  para: string,
  binario: Buffer,
  mime: string,
  tipo: "image" | "document",
  creds?: CredsEnvio,
  opts?: { legenda?: string; nome?: string },
): Promise<void> {
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);

  // 1) upload do binário -> media_id
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([new Uint8Array(binario)], { type: mime }), opts?.nome || "arquivo");
  const up = await fetch(`${BASE}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!up.ok) throw new Error(`Falha no upload da mídia: ${up.status} ${await up.text()}`);
  const { id } = (await up.json()) as { id: string };

  // 2) envia a mensagem referenciando o media_id
  const conteudo =
    tipo === "image"
      ? { image: { id, ...(opts?.legenda ? { caption: opts.legenda } : {}) } }
      : { document: { id, ...(opts?.nome ? { filename: opts.nome } : {}), ...(opts?.legenda ? { caption: opts.legenda } : {}) } };
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: destino, type: tipo, ...conteudo }),
  });
  if (!r.ok) throw new Error(`Falha ao enviar mídia: ${r.status} ${await r.text()}`);
}

// Lista os TEMPLATES aprovados da WABA do tenant (pra oferecer fora da janela ou
// em conversa nova). Precisa do waba_id + token do negócio conectado.
export type TemplateAprovado = {
  nome: string;
  idioma: string;
  categoria: string;
  corpo: string; // texto do BODY (com {{1}}, {{2}}... quando tiver)
  variaveis: number; // quantas variáveis o corpo espera
};
export async function listarTemplates(wabaId: string, token: string): Promise<TemplateAprovado[]> {
  const r = await fetch(
    `${BASE}/${wabaId}/message_templates?fields=name,status,language,category,components&limit=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Falha ao listar templates: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as {
    data?: { name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }[];
  };
  return (j.data ?? [])
    .filter((t) => t.status === "APPROVED")
    .map((t) => {
      const corpo = t.components?.find((c) => c.type === "BODY")?.text ?? "";
      const variaveis = new Set((corpo.match(/\{\{(\d+)\}\}/g) ?? [])).size;
      return { nome: t.name, idioma: t.language, categoria: t.category, corpo, variaveis };
    });
}

// Baixa o binário de um áudio pelo media_id (pra transcrever). Usa o token do
// tenant que recebeu a mídia (a URL da mídia é escopada pela WABA dele).
export async function baixarMidia(mediaId: string, creds?: CredsEnvio): Promise<ArrayBuffer> {
  const { token } = resolverCreds(creds);
  // 1) pega a URL temporária da mídia
  const meta = await fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meta.ok) throw new Error(`Falha ao achar mídia: ${meta.status}`);
  const { url } = (await meta.json()) as { url: string };
  // 2) baixa o binário (precisa do mesmo token)
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) throw new Error(`Falha ao baixar mídia: ${bin.status}`);
  return bin.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Cardápios em imagem
// ---------------------------------------------------------------------------
// Mandar a peça pronta em vez de a IA redigitar o cardápio: o cliente lê melhor,
// não tem risco de a IA errar um preço no meio, e não gasta token nenhum —
// imagem é mensagem de mídia, não texto gerado.
//
// Por LINK e não por upload de propósito: o media_id da Meta expira em 30 dias,
// e aí o cardápio pararia de chegar sem ninguém perceber. As peças moram em
// public/cardapios/ e são servidas pelo próprio painel — não expiram e sobem
// junto com o deploy quando a dona muda um preço.

export const CARDAPIOS = [
  "salgados",
  "docinhos",
  "bolos-festa",
  "bolos-caseiros",
  "cucas-paes",
  "tortas-empadao",
  "pizza",
  "cupcakes-franciscano",
] as const;
export type CardapioId = (typeof CARDAPIOS)[number];

// Recados que acompanham a peça. O dono pediu que estas duas informações
// saíssem do rodapé em letra miúda da imagem e virassem mensagem: no celular
// ninguém lê rodapé de cardápio, e são justamente as regras que mais geram
// dúvida na hora de fechar bolo de festa.
// O NÚMERO SAI DA TABELA, NUNCA ESCRITO AQUI.
//
// Estes dois recados tinham "R$ 49,90", "R$ 55,90" e "R$ 12" digitados na mão.
// É a mesma regra que o fluxo já respeita desde o começo ("quem escreve o número
// é o código, nunca a IA"), quebrada num lugar que ninguém olhava: uma mensagem
// que o CLIENTE recebe.
//
// No dia em que a dona mudasse o preço do bolo, a padaria continuaria mandando o
// preço velho por escrito, e quem cobra depois é o cliente, com razão.
//
// Achado em 27/08/2026 pelo `nao-copiar-o-catalogo-pro-codigo.cjs`, que nasceu
// da regra do dono: "nada pode ser só uma lista tua, só o cardápio e valores".
const precosDoBoloDeFesta = () =>
  [...new Set(produtosDaCasa().filter((p) => p.categoria === "bolo_festa").map((p) => p.preco))]
    .sort((a, b) => a - b);

export const RECADOS_CARDAPIO: Partial<Record<CardapioId, string[]>> = {
  "bolos-festa": (() => {
    const precos = precosDoBoloDeFesta();
    const menor = brl(precos[0] ?? 0);
    const maior = brl(precos[precos.length - 1] ?? 0);
    const papel = produtoPorNome("papel de arroz");
    return [
      "Pode misturar sabores: vale sempre o valor do mais caro, de " +
        menor + " a " + maior + " o quilo.",
      "Decoração à parte: papel de arroz " + brl(papel?.preco ?? 0) +
        ". O topo de bolo a equipe orça, porque o valor muda com o tema.",
    ];
  })(),
};

function baseDoApp(): string {
  return (process.env.APP_URL || "https://docepao.enderecodigital.tech").replace(/\/+$/, "");
}

export function urlDoCardapio(id: string): string {
  return `${baseDoApp()}/cardapios/${id}.jpg`;
}

/** Manda uma imagem por URL pública (sem upload, sem media_id que expira). */
export async function enviarImagemPorLink(
  para: string,
  url: string,
  legenda: string | undefined,
  creds?: CredsEnvio,
): Promise<void> {
  const { token, phoneId } = resolverCreds(creds);
  const destino = normalizarBR(para);
  const r = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destino,
      type: "image",
      image: { link: url, ...(legenda ? { caption: legenda } : {}) },
    }),
  });
  if (!r.ok) throw new Error(`Falha ao enviar imagem: ${r.status} ${await r.text()}`);
}
