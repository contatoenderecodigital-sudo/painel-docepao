// Dados fake pra DEMO — o painel roda sem Supabase configurado.
// Quando o Supabase entrar, esta camada é trocada por queries reais
// (mesma forma de dados, então as telas não mudam).

import type { Pedido, Conversa, MembroClube, ClienteCRM } from "./tipos";

// datas relativas a "hoje" pra demo nunca ficar velha
const hoje = new Date();
const maisDias = (d: number) => {
  const x = new Date(hoje);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

export const PEDIDOS_MOCK: Pedido[] = [
  {
    id: "d1",
    clienteNome: "Maria de Souza",
    clienteTelefone: "(49) 9 9111-1111",
    status: "confirmado",
    retiradaData: maisDias(2),
    retiradaHora: "14:00",
    pessoas: 20,
    totalCentavos: 23440,
    observacoes: "Festa de aniversário. Cliente pediu pra caprichar no brigadeiro.",
    criadoEm: new Date(hoje.getTime() - 1000 * 60 * 12).toISOString(),
    itens: [
      { produto: "Salgado assado", categoria: "salgado", qtd: 100, unitCentavos: 125, subtotalCentavos: 12500 },
      { produto: "Brigadeiro", categoria: "doce", qtd: 50, unitCentavos: 125, subtotalCentavos: 6250 },
      { produto: "Bolo 4 leites", categoria: "bolo_recheado", qtd: 1, unitCentavos: 4690, subtotalCentavos: 4690 },
    ],
  },
  {
    id: "d2",
    clienteNome: "João Pereira",
    clienteTelefone: "(49) 9 9222-2222",
    status: "confirmado",
    retiradaData: maisDias(1),
    retiradaHora: "09:30",
    pessoas: null,
    totalCentavos: 36000,
    observacoes: "Retirar de manhã cedo.",
    criadoEm: new Date(hoje.getTime() - 1000 * 60 * 40).toISOString(),
    itens: [
      { produto: "Pizza inteira", categoria: "pizza", qtd: 3, unitCentavos: 12000, subtotalCentavos: 36000 },
    ],
  },
  {
    id: "d3",
    clienteNome: "Carlos Menezes",
    clienteTelefone: "(49) 9 9444-4444",
    status: "confirmado",
    retiradaData: maisDias(0),
    retiradaHora: "16:00",
    pessoas: null,
    totalCentavos: 10625,
    observacoes: null,
    criadoEm: new Date(hoje.getTime() - 1000 * 60 * 3).toISOString(),
    itens: [
      { produto: "Salgado frito", categoria: "salgado", qtd: 50, unitCentavos: 100, subtotalCentavos: 5000 },
      { produto: "Coxinha", categoria: "salgado", qtd: 30, unitCentavos: 100, subtotalCentavos: 3000 },
      { produto: "Trufa de morango", categoria: "doce", qtd: 12, unitCentavos: 225, subtotalCentavos: 2700 },
    ],
  },
];

// candidatos à recuperação (orçamento parado, cliente sumiu sem confirmar).
// Idades variadas de propósito, pra a tela mostrar a urgência por cor
// (1 dia dourado, alguns dias cobre, 7+ dias vermelho) e ordenar por prioridade.
const horas = (h: number) => new Date(hoje.getTime() - 1000 * 60 * 60 * h).toISOString();
export const ORCAMENTOS_PARADOS_MOCK: Pedido[] = [
  {
    // 8 dias parado, retirada sem data, cobrança automática já foi e o cliente
    // até visualizou, mas não respondeu. Prioridade máxima (vermelho).
    id: "o3",
    clienteNome: "Fernanda Costa",
    clienteTelefone: "(49) 9 9888-1234",
    status: "orcado",
    retiradaData: null,
    retiradaHora: null,
    pessoas: 120,
    totalCentavos: 124000,
    observacoes: "Casamento. Pediu bolo de 3 andares com decoração especial.",
    criadoEm: horas(8 * 24),
    cobrancaEm: horas(6 * 24),
    clienteViuEm: horas(5 * 24),
    itens: [
      { produto: "Bolo 3 andares", categoria: "bolo_recheado", qtd: 1, unitCentavos: 98000, subtotalCentavos: 98000 },
      { produto: "Salgado assado", categoria: "salgado", qtd: 200, unitCentavos: 130, subtotalCentavos: 26000 },
    ],
  },
  {
    // 3 dias parado, retirada AMANHÃ. Urgência real alta apesar da cor cobre.
    id: "o2",
    clienteNome: "Roberto Lima",
    clienteTelefone: "(49) 9 9555-7788",
    status: "orcado",
    retiradaData: maisDias(1),
    retiradaHora: "08:00",
    pessoas: null,
    totalCentavos: 18000,
    observacoes: "Café da firma. Pediu orçamento e sumiu.",
    criadoEm: horas(3 * 24 + 2),
    itens: [
      { produto: "Salgado assado", categoria: "salgado", qtd: 100, unitCentavos: 125, subtotalCentavos: 12500 },
      { produto: "Mini pizza", categoria: "salgado", qtd: 20, unitCentavos: 275, subtotalCentavos: 5500 },
    ],
  },
  {
    // ~1 dia parado, cobrança automática já disparou. Atenção (dourado).
    id: "o1",
    clienteNome: "Ana Beatriz",
    clienteTelefone: "(49) 9 9333-3333",
    status: "orcado",
    retiradaData: maisDias(5),
    retiradaHora: null,
    pessoas: 30,
    totalCentavos: 50000,
    observacoes: "Falou que ia ver com o marido.",
    criadoEm: horas(26),
    cobrancaEm: horas(2),
    itens: [
      { produto: "Salgado assado", categoria: "salgado", qtd: 300, unitCentavos: 125, subtotalCentavos: 37500 },
      { produto: "Brigadeiro", categoria: "doce", qtd: 100, unitCentavos: 125, subtotalCentavos: 12500 },
    ],
  },
  {
    // 5 horas parado, ainda não cobrado. Recém-parado (dourado).
    id: "o4",
    clienteNome: "Marcos Vinícius",
    clienteTelefone: "(49) 9 9222-4646",
    status: "orcado",
    retiradaData: maisDias(3),
    retiradaHora: "15:00",
    pessoas: null,
    totalCentavos: 9600,
    observacoes: null,
    criadoEm: horas(5),
    itens: [
      { produto: "Coxinha", categoria: "salgado", qtd: 60, unitCentavos: 100, subtotalCentavos: 6000 },
      { produto: "Trufa de morango", categoria: "doce", qtd: 16, unitCentavos: 225, subtotalCentavos: 3600 },
    ],
  },
];

// ---------------------------------------------------------------------------
//  ATENDIMENTOS — conversas da IA no WhatsApp (a joia da demo)
// ---------------------------------------------------------------------------
export const CONVERSAS_MOCK: Conversa[] = [
  {
    id: "conv1",
    clienteNome: "Maria de Souza",
    clienteTelefone: "(49) 9 9111-1111",
    ultimaHora: "10:42",
    previa: "Fechado, deixei seu pedido pra sábado às 14h.",
    estado: "ia",
    naoLidas: 0,
    mensagens: [
      { de: "cliente", texto: "Oi, bom dia! Vcs fazem salgado pra festa?", hora: "10:31" },
      { de: "ia", texto: "Bom dia! Fazemos sim. Salgado assado sai R$ 1,25 e frito R$ 1,00 a unidade. É pra quantas pessoas a festa?", hora: "10:31" },
      { de: "cliente", texto: "umas 20 pessoas, dia 18 (sabado)", hora: "10:38" },
      { de: "ia", texto: "Perfeito. Pra 20 pessoas eu sugiro uns 200 salgados. Quer só salgado ou coloco uns docinhos também? Nosso brigadeiro sai R$ 1,25.", hora: "10:38" },
      { de: "cliente", texto: "poe 100 salgado assado, 50 brigadeiro e um bolo de 4 leites", hora: "10:40" },
      { de: "ia", texto: "Fechou! Ficou assim:\n\n100x Salgado assado: R$ 125,00\n50x Brigadeiro: R$ 62,50\n1x Bolo 4 leites: R$ 46,90\n\n*Total: R$ 234,40* (paga na retirada)\nRetirada sábado 18/07 às 14h. Confirma pra mim?", hora: "10:41" },
      { de: "cliente", texto: "isso, pode confirmar", hora: "10:42" },
      { de: "ia", texto: "Fechado, deixei seu pedido pra sábado às 14h. Qualquer coisa é só chamar.", hora: "10:42" },
    ],
  },
  {
    id: "conv2",
    clienteNome: "Ana Beatriz",
    clienteTelefone: "(49) 9 9333-3333",
    ultimaHora: "10:15",
    previa: "Queria um bolo bem diferente, consegue me ajudar a escolher?",
    estado: "precisa_humano",
    naoLidas: 1,
    mensagens: [
      { de: "cliente", texto: "oi, queria encomendar um bolo pra um casamento", hora: "10:10" },
      { de: "ia", texto: "Que lindo! Temos bolos recheados a partir de R$ 46,90. Você já tem um sabor em mente?", hora: "10:11" },
      { de: "cliente", texto: "queria um bolo bem diferente, de 3 andares, com uma decoração especial. consegue me ajudar a escolher?", hora: "10:15" },
      { de: "ia", texto: "Esse é um pedido especial, que a nossa equipe adora fazer com carinho. Vou chamar alguém da equipe pra montar isso com você certinho. Já já te respondem.", hora: "10:15" },
    ],
  },
  {
    id: "conv3",
    clienteNome: "João Pereira",
    clienteTelefone: "(49) 9 9222-2222",
    ultimaHora: "09:28",
    previa: "Que horas vocês abrem amanhã?",
    estado: "resolvido",
    naoLidas: 0,
    mensagens: [
      { de: "cliente", texto: "que horas abre amanha?", hora: "09:27" },
      { de: "ia", texto: "Abrimos às 6h30 da manhã! Te espero por aqui.", hora: "09:28" },
    ],
  },
  {
    id: "conv4",
    clienteNome: "Cliente novo",
    clienteTelefone: "(49) 9 9777-7777",
    ultimaHora: "02:14",
    previa: "vcs tem pão de queijo de manhã?",
    estado: "resolvido",
    naoLidas: 0,
    mensagens: [
      { de: "cliente", texto: "vcs tem pão de queijo de manhã?", hora: "02:13" },
      { de: "ia", texto: "Temos sim, quentinho todo dia! A partir das 6h30. Aparece que vale a pena.", hora: "02:14" },
    ],
  },
];

// ---------------------------------------------------------------------------
//  CLUBE — membros e selos
// ---------------------------------------------------------------------------
export const CLUBE_MOCK: MembroClube[] = [
  { nome: "João Pereira", telefone: "(49) 9 9222-2222", selos: 7, metaSelos: 10, totalGasto: 48900, ultimaCompra: "há 2 dias" },
  { nome: "Carlos Menezes", telefone: "(49) 9 9444-4444", selos: 5, metaSelos: 10, totalGasto: 31200, ultimaCompra: "há 5 dias" },
  { nome: "Maria de Souza", telefone: "(49) 9 9111-1111", selos: 3, metaSelos: 10, totalGasto: 23440, ultimaCompra: "hoje" },
  { nome: "Ana Beatriz", telefone: "(49) 9 9333-3333", selos: 1, metaSelos: 10, totalGasto: 5000, ultimaCompra: "há 1 semana" },
  { nome: "Pedro Alves", telefone: "(49) 9 9555-5555", selos: 9, metaSelos: 10, totalGasto: 67800, ultimaCompra: "ontem" },
];

// ---------------------------------------------------------------------------
//  CLIENTES (CRM) — ficha de cada cliente com histórico e preferências
// ---------------------------------------------------------------------------
const diasAtras = (d: number) => new Date(hoje.getTime() - d * 86400000).toISOString();
// aniversário no mês atual (pra a demo mostrar o KPI "aniversários no mês")
const aniversarioEsteMes = `1988-${String(hoje.getMonth() + 1).padStart(2, "0")}-14`;
export const CLIENTES_MOCK: ClienteCRM[] = [
  {
    id: "c1",
    nome: "Maria de Souza",
    telefone: "5549991111111",
    aniversario: aniversarioEsteMes,
    selos: 8,
    qtdPedidos: 12,
    totalGastoCentavos: 289400,
    ultimoPedidoEm: diasAtras(3),
    clienteDesde: diasAtras(210),
    nota: "Cliente fiel. Sempre pede salgado assado, nao gosta de coco. Aniversario do filho em marco, costuma encomendar bolo grande.",
    pedidos: [
      { id: "p1", data: maisDias(-3), totalCentavos: 23440, status: "impresso", criadoEm: diasAtras(3), itens: 3 },
      { id: "p2", data: maisDias(-24), totalCentavos: 18000, status: "impresso", criadoEm: diasAtras(24), itens: 2 },
      { id: "p3", data: maisDias(-51), totalCentavos: 46900, status: "impresso", criadoEm: diasAtras(51), itens: 1 },
    ],
  },
  {
    id: "c2",
    nome: "João Pereira",
    telefone: "5549992222222",
    aniversario: null,
    selos: 7,
    qtdPedidos: 6,
    totalGastoCentavos: 148900,
    ultimoPedidoEm: diasAtras(2),
    clienteDesde: diasAtras(120),
    nota: "Pede pra retirar sempre de manha cedo. Costuma levar pizza.",
    pedidos: [
      { id: "p4", data: maisDias(-2), totalCentavos: 36000, status: "aprovado", criadoEm: diasAtras(2), itens: 1 },
      { id: "p5", data: maisDias(-30), totalCentavos: 24000, status: "impresso", criadoEm: diasAtras(30), itens: 2 },
    ],
  },
  {
    id: "c3",
    nome: "Carlos Menezes",
    telefone: "5549994444444",
    aniversario: "1975-11-02",
    selos: 5,
    qtdPedidos: 4,
    totalGastoCentavos: 61200,
    ultimoPedidoEm: diasAtras(5),
    clienteDesde: diasAtras(80),
    nota: null,
    pedidos: [
      { id: "p6", data: maisDias(0), totalCentavos: 10625, status: "confirmado", criadoEm: diasAtras(0), itens: 3 },
      { id: "p7", data: maisDias(-40), totalCentavos: 18000, status: "impresso", criadoEm: diasAtras(40), itens: 2 },
    ],
  },
  {
    id: "c4",
    nome: "Ana Beatriz",
    telefone: "5549993333333",
    aniversario: null,
    selos: 1,
    qtdPedidos: 1,
    totalGastoCentavos: 0,
    ultimoPedidoEm: diasAtras(8),
    clienteDesde: diasAtras(8),
    nota: "Primeiro contato foi por um casamento (bolo 3 andares). Passou pro humano.",
    pedidos: [
      { id: "p8", data: null, totalCentavos: 124000, status: "orcado", criadoEm: diasAtras(8), itens: 2 },
    ],
  },
  {
    id: "c5",
    nome: "Pedro Alves",
    telefone: "5549995555555",
    aniversario: "1990-08-03",
    selos: 9,
    qtdPedidos: 9,
    totalGastoCentavos: 213700,
    ultimoPedidoEm: diasAtras(1),
    clienteDesde: diasAtras(160),
    nota: "Quase fechando a cartela do clube (9 de 10 selos). Bom candidato pra brinde.",
    pedidos: [
      { id: "p9", data: maisDias(-1), totalCentavos: 32000, status: "impresso", criadoEm: diasAtras(1), itens: 2 },
      { id: "p10", data: maisDias(-15), totalCentavos: 28000, status: "impresso", criadoEm: diasAtras(15), itens: 3 },
    ],
  },
];

// ---------------------------------------------------------------------------
//  NÚMEROS — métricas do mês (pra o dashboard de resultado)
// ---------------------------------------------------------------------------
export const METRICAS_MOCK = {
  horasEconomizadas: 96,
  atendimentosMes: 1240,
  atendimentosForaHorario: 312, // de madrugada / fechado
  faturamentoWhatsappCentavos: 1847000,
  orcamentosRecuperados: 14,
  valorRecuperadoCentavos: 386000,
  pedidosNoDia: 23,
  // volume por dia da semana (pra um gráfico de barrinhas)
  porDia: [
    { dia: "Seg", pedidos: 28 },
    { dia: "Ter", pedidos: 24 },
    { dia: "Qua", pedidos: 31 },
    { dia: "Qui", pedidos: 35 },
    { dia: "Sex", pedidos: 52 },
    { dia: "Sáb", pedidos: 68 },
    { dia: "Dom", pedidos: 19 },
  ],
};
