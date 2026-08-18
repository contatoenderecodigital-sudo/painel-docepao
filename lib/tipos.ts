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
  de: "cliente" | "ia" | "equipe";
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
