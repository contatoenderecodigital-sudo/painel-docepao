// Tipos do domínio do painel. Espelham o schema do banco (banco/schema.sql).

export type PedidoStatus =
  | "aberto"
  | "orcado"
  | "confirmado"
  | "aprovado"
  | "impresso"
  | "recusado"
  | "cancelado";

export type ItemPedido = {
  produto: string;
  categoria: string;
  qtd: number;
  unitCentavos: number;
  subtotalCentavos: number;
  obs?: string | null;
  unidade?: "un" | "kg";
};

// A UNIDADE DO ITEM SO PODE SER "un" OU "kg", E QUEM DECIDE ISSO E UMA
// FUNCAO SO.
//
// A mesma pergunta estava respondida de SEIS jeitos diferentes, em seis
// arquivos, e so dois deles estavam certos:
//
//     produtos.ts    o.unidade === "kg" ? "kg" : "un"        certo
//     fechar.ts      l.unidade === "kg" ? "kg" : "un"        certo
//     conversas.ts   l.unidade ?? "un"                       grava o que vier
//     pedidos.ts     (i.unidade as "un" | "kg") ?? "un"      o cast lava o dado
//     parados.ts     l.unidade ?? itens[n]?.unidade ?? "un"  o "" tapa o padrao
//     resultados.ts  x.unidade || "un"                       so metade
//
// Os quatro de baixo deixam passar. O `??` so troca `null` e `undefined`, entao
// uma unidade em branco no banco continua em branco; e o `as` nao converte
// nada, so cala o TypeScript, entao "KG" ou "kg " chegam na comanda como se
// fossem tipo valido. A conta que decide se o item e vendido por peso le esse
// campo: unidade errada e preco errado no papel que vai pra cozinha.
//
// Achado na leitura da camada de banco, 28/08/2026: o defeito nao era nenhum
// dos seis, era existirem seis.
export function unidadeDoItem(bruto: unknown): "un" | "kg" {
  return String(bruto ?? "").trim().toLowerCase() === "kg" ? "kg" : "un";
}

// A HORA DA RETIRADA TAMBEM E UMA DECISAO SO.
//
// Mesma historia da unidade, com mais copias. A hora nasce na conversa ("as
// 16h30"), e gravada no banco como `time` (16:30:00), e reaparece no cupom da
// cozinha, no painel, no aviso do WhatsApp e na tela do dia. Cada um desses
// pontos tinha o seu jeito de arrumar:
//
//     conversas.ts   horaPadrao   ancorado no comeco, valida 0-23
//     parados.ts     horaLimpa    ancorado no comeco, NAO valida a hora
//     acoes.ts       regex solta + slice(0,5)
//     pedidos.ts     slice(0, 5)
//     fila.ts        slice(0, 5)
//
// Dois defeitos medidos na leitura de 28/08/2026:
//
//   1. o `horaPadrao` estava ancorado (`/^(\d{1,2})/`) e o comentario dele
//      prometia entender "as 16h30". Nao entendia: a string comeca com "a", a
//      regex exige digito, e a funcao devolvia null. Pedido gravado SEM HORA.
//   2. o `horaLimpa` aceitava "99h" e devolvia "99:00", porque nao conferia o
//      intervalo. A tela de recuperacao mostrava uma hora que nao existe.
//
// E o "1630", que os dois liam como 16:00 e jogavam os 30 minutos fora calados.
//
// ESTA FUNCAO E PRA CAMPO, NAO PRA FRASE.
//
// Ela normaliza um valor que ja e a hora ("16h30", "16:30:00", "1630"). Quem
// procura hora DENTRO de uma frase inteira do cliente e o `horaNaFrase`, no
// leitor: ali um numero solto e quantidade de brigadeiro, nao hora. Por
// seguranca, mesmo se alguem apontar esta funcao pra uma frase, o numero solto
// so vale quando ele e o UNICO numero da string.
export function horaDaRetirada(bruto: unknown): string | null {
  const t = String(bruto ?? "").trim().toLowerCase();
  if (!t) return null;
  const quantosNumeros = (t.match(/\d+/g) ?? []).length;

  let hora: number | null = null;
  let minuto = 0;

  // "16:30", "16h30", "16.30", "as 16h30", e o "16:30:00" que o Postgres devolve
  let m = t.match(/(\d{1,2})\s*[h:.]\s*(\d{1,2})(?!\d)/);
  if (m) {
    hora = Number(m[1]);
    minuto = Number(m[2]);
  }
  // "16h", "as 16h"
  if (hora === null) {
    m = t.match(/(\d{1,2})\s*h(?![0-9])/);
    if (m) hora = Number(m[1]);
  }
  // "1630", "830" -- HHMM colado, so quando e o unico numero da string
  if (hora === null && quantosNumeros === 1) {
    m = t.match(/(?:^|[^\d])(\d{3,4})(?!\d)/);
    if (m) {
      const n = m[1];
      hora = Number(n.slice(0, n.length - 2));
      minuto = Number(n.slice(-2));
    }
  }
  // "16" -- numero solto, so quando e o unico da string
  if (hora === null && quantosNumeros === 1) {
    m = t.match(/(?:^|[^\d])(\d{1,2})(?!\d)/);
    if (m) hora = Number(m[1]);
  }

  if (hora === null || !Number.isFinite(hora) || hora > 23 || minuto > 59) return null;
  return String(hora).padStart(2, "0") + ":" + String(minuto).padStart(2, "0");
}

export type FormaPagamento = "pix" | "dinheiro" | "cartao" | "pago";

// Historico do cliente REGISTRADO PELO SISTEMA (a partir do inicio do uso).
// NUNCA representa o relacionamento real com a padaria. Vem do banco; ausente
// enquanto nao houver dados (ai a UI mostra estado vazio honesto).
export type HistoricoCliente = {
  pedidosSistema: number; // qtd de pedidos ja feitos pela plataforma
  totalRegistradoCentavos: number; // soma gasta pela plataforma
  primeiroPedidoEm: string | null; // ISO do 1o pedido no sistema
  naoRetirados: number; // pedidos registrados nao retirados/nao confirmados
};

export type Pedido = {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  status: PedidoStatus;
  retiradaData: string | null; // ISO date
  retiradaHora: string | null; // HH:MM
  pessoas: number | null;
  totalCentavos: number;
  observacoes: string | null;
  itens: ItemPedido[];
  criadoEm: string; // ISO
  // Handoff inteligente: pedido montado pela IA mas com pendencia de confirmacao
  // da equipe (pedido pra hoje/amanha, valor de topo de bolo, item fora da tabela).
  // A dona ve um aviso no card com o motivo e so revisa/aprova.
  precisaConfirmacao?: boolean;
  aguardandoCliente?: boolean; // esperando o cliente aceitar o total atualizado
  motivoHumano?: string | null;
  // Foto de referencia anexada ao pedido (bolo decorado, tema de festa). A imagem
  // fica no banco; a UI carrega por /api/pedido/[id]/foto. O cupom NAO imprime foto.
  temFoto?: boolean;
  // Preparados para dados reais do banco (opcionais):
  formaPagamento?: FormaPagamento | null;
  historicoCliente?: HistoricoCliente | null;
  // Recuperacao de orcamento: quando a cobranca automatica ja disparou e se o
  // cliente ja visualizou. Ausentes ate haver o dado (UI mostra estado honesto).
  cobrancaEm?: string | null; // ISO do envio automatico da cobranca
  clienteViuEm?: string | null; // ISO da visualizacao (read receipt), se houver
};

export type TipoMidia = "texto" | "imagem" | "audio" | "documento" | "video";

export type Mensagem = {
  // 'cobranca' e a mensagem automatica do orcamento parado: sai sem o cliente
  // ter escrito antes, entao no chat ela se identifica em vez de se passar
  // pela atendente.
  de: "cliente" | "ia" | "equipe" | "cobranca";
  texto: string;
  hora: string; // HH:MM
  data?: string; // YYYY-MM-DD (America/Sao_Paulo) — pra separar por dia no chat
  // Mídia (imagem/audio/documento). A imagem/audio/doc fica no banco em base64 e
  // é servida por /api/midia/[id]; aqui só trafega o id + metadados (leve).
  tipo?: TipoMidia;
  midiaId?: string; // id da mensagem no banco -> /api/midia/[id]
  midiaUrl?: string; // imagem publicada (cardapio); dispensa guardar base64
  midiaMime?: string;
  midiaNome?: string; // nome do arquivo (documento)
  // O que o WhatsApp respondeu depois do envio. Falha e o que mais importa:
  // significa que o cliente NAO recebeu, e alguem precisa agir.
  entregue?: boolean;
  lidaWpp?: boolean;
  falhaEnvio?: string;
  // Só no cliente (envio otimista): status visual do balão enquanto sai.
  status?: "enviando" | "enviado" | "erro";
  // id da mensagem (dedupe no polling / chave estável).
  id?: string;
};

export type Conversa = {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  ultimaHora: string;
  previa: string;
  estado: "ia" | "precisa_humano" | "humano" | "resolvido";
  naoLidas: number;
  mensagens: Mensagem[];
  // Janela de 24h da Meta: epoch (ms) em que a última mensagem do cliente
  // completa 24h. Depois disso, só template aprovado reabre a conversa.
  // null = o cliente nunca escreveu (nova conversa proativa).
  janelaExpiraMs?: number | null;
  // Anuncio que trouxe o cliente (Click-to-WhatsApp). A Meta so conta na
  // primeira mensagem da conversa; depois some.
  origemAnuncio?: { titulo?: string | null; url?: string | null; anuncio_id?: string | null } | null;
  // Custo de IA ACUMULADO desta conversa (centavos de R$). Estimativa (preços
  // "ajustar" na tabela de preços). Some do consumo do cérebro amarrado ao
  // cliente. 0 = sem consumo registrado (ou registrado sem cliente).
  custoCentavos?: number;
};

// Ficha do cliente no CRM: dados + histórico agregado + nota da equipe.
export type PedidoResumo = {
  id: string;
  data: string | null; // retirada
  totalCentavos: number;
  status: PedidoStatus;
  criadoEm: string;
  itens: number;
};
export type ClienteCRM = {
  id: string;
  nome: string;
  telefone: string;
  aniversario: string | null;
  selos: number;
  qtdPedidos: number;
  totalGastoCentavos: number;
  ultimoPedidoEm: string | null;
  clienteDesde: string | null;
  nota: string | null;
  pedidos: PedidoResumo[];
};

export type MembroClube = {
  nome: string;
  telefone: string;
  selos: number;
  metaSelos: number;
  totalGasto: number; // centavos
  ultimaCompra: string; // "há 3 dias"
};

export const brl = (centavos: number) =>
  "R$ " +
  (centavos / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");

// Telefone no padrao brasileiro: 5511990001111 -> +55 (11) 99000-1111
export function formatarTelefoneBR(tel: string): string {
  const n = tel.replace(/\D/g, "");
  const d = n.startsWith("55") ? n.slice(2) : n;
  if (d.length < 10) return tel;
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  return `+55 (${ddd}) ${num.slice(0, -4)}-${num.slice(-4)}`;
}

// Link pra abrir a conversa no WhatsApp.
export function linkWhatsapp(tel: string): string {
  let n = tel.replace(/\D/g, "");
  if (!n.startsWith("55")) n = "55" + n;
  return `https://wa.me/${n}`;
}

// ISO -> "jul/2026" (mes/ano curto).
export function mesAno(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  const mm = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${mm[m - 1]}/${a}`;
}
