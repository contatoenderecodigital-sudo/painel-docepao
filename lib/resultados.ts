// ============================================================================
//  RESULTADOS (tela de desempenho): métricas por período, com comparativo vs.
//  período anterior, séries pros gráficos, top produtos/clientes e insights.
//
//  Em DEMO (sem banco), gera dados de exemplo plausíveis que RESPONDEM ao
//  período escolhido (bom pra venda/vídeo). Com banco real, quem agrega é
//  banco/resultados.ts. Se o banco cair no meio, volta o VAZIO honesto
//  (temDados=false) em vez de derrubar a tela: a padaria nunca vê número
//  inventado nem tela quebrada.
// ============================================================================

export type Periodo = "hoje" | "semana" | "mes" | "ano" | "custom";

export type Kpi = { valor: number; variacaoPct: number | null };
export type PontoSerie = { label: string; valor: number };
export type ProdutoVenda = { produto: string; qtd: number; centavos: number; unidade?: string };
export type ClienteVenda = { nome: string; centavos: number; pedidos: number };

export type Resultados = {
  periodo: Periodo;
  periodoLabel: string; // "este mês", "de 01/07 a 15/07"
  comparativoLabel: string; // "vs. mês passado"
  temDados: boolean;
  kpis: {
    horasEconomizadas: Kpi;
    recuperadoCentavos: Kpi;
    faturadoCentavos: Kpi;
    atendimentos: Kpi;
    foraHorario: Kpi;
    pedidos: Kpi;
  };
  // Pedidos que ENTRARAM mas a equipe ainda não aprovou (a fila de aprovação).
  // Vem separado de propósito: a dona precisava enxergar os 4 pedidos parados na
  // fila (a tela mostrava PEDIDOS = 0 com eles lá dentro), mas esse dinheiro ainda
  // pode ser recusado, então não pode entrar no faturado.
  aguardando: { pedidos: number; centavos: number; recuperadoCentavos: number };
  // Pedido que entrou e parou ANTES da fila: esperando a equipe lançar o valor
  // do topo de bolo, ou esperando o cliente aceitar o total novo. Ficava fora
  // de toda conta, e com ele o dinheiro dele.
  esperando?: { pedidos: number; centavos: number };
  porDiaSemana: { dia: string; pedidos: number }[];
  faturamentoSerie: PontoSerie[]; // centavos ao longo do tempo
  produtosTop: ProdutoVenda[];
  horariosPico: { hora: string; qtd: number }[];
  topClientes: ClienteVenda[];
  insights: string[];
};

const LABEL: Record<Periodo, string> = {
  hoje: "hoje",
  semana: "esta semana",
  mes: "este mês",
  ano: "este ano",
  custom: "no período",
};
const COMPARA: Record<Periodo, string> = {
  hoje: "vs. ontem",
  semana: "vs. semana passada",
  mes: "vs. mês passado",
  ano: "vs. ano passado",
  custom: "vs. período anterior",
};

// Fator de escala relativo ao mês (base das métricas mock).
const FATOR: Record<Periodo, number> = {
  hoje: 1 / 30,
  semana: 7 / 30,
  mes: 1,
  ano: 12,
  custom: 1,
};

const brlData = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

// Distribui um total por uma "forma" (shape), somando exatamente o total.
function distribuir(total: number, shape: number[]): number[] {
  const soma = shape.reduce((s, x) => s + x, 0) || 1;
  return shape.map((x) => Math.round((x / soma) * total));
}

function gerarDemo(periodo: Periodo, de?: string, ate?: string): Resultados {
  const f = FATOR[periodo];
  const esc = (base: number) => Math.round(base * f);

  // Bases mensais (espelham METRICAS_MOCK) + variação fixa realista (mistura
  // de alta e baixa pra a tela mostrar verde e vermelho).
  const kpis = {
    horasEconomizadas: { valor: esc(96), variacaoPct: 9 },
    recuperadoCentavos: { valor: esc(386000), variacaoPct: 23 },
    faturadoCentavos: { valor: esc(1847000), variacaoPct: 12 },
    atendimentos: { valor: esc(1240), variacaoPct: 8 },
    foraHorario: { valor: esc(312), variacaoPct: 15 },
    pedidos: { valor: esc(690), variacaoPct: -4 },
  };

  // Pedidos por dia da semana (padrão semanal, escalado pelo nº de semanas).
  const semanas = Math.max(1, Math.round((f * 30) / 7));
  const baseSemana = [
    { dia: "Seg", p: 28 },
    { dia: "Ter", p: 24 },
    { dia: "Qua", p: 31 },
    { dia: "Qui", p: 35 },
    { dia: "Sex", p: 52 },
    { dia: "Sáb", p: 68 },
    { dia: "Dom", p: 19 },
  ];
  const porDiaSemana = baseSemana.map((d) => ({ dia: d.dia, pedidos: d.p * semanas }));

  // Faturamento ao longo do tempo (forma depende do período).
  let serieLabels: string[];
  let serieShape: number[];
  if (periodo === "hoje") {
    serieLabels = ["8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h"];
    serieShape = [3, 5, 8, 12, 14, 9, 6, 5, 7, 11, 13, 8, 4];
  } else if (periodo === "semana") {
    serieLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    serieShape = [28, 24, 31, 35, 52, 68, 19];
  } else if (periodo === "ano") {
    serieLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    serieShape = [70, 66, 74, 78, 82, 85, 88, 90, 93, 96, 104, 120];
  } else {
    serieLabels = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
    serieShape = [82, 88, 95, 108];
  }
  const faturamentoSerie = distribuir(kpis.faturadoCentavos.valor, serieShape).map((v, i) => ({
    label: serieLabels[i],
    valor: v,
  }));

  // Produtos mais vendidos (ranking).
  const produtosBase: ProdutoVenda[] = [
    { produto: "Cento de salgado", qtd: 82, centavos: 1025000 },
    { produto: "Pão de queijo (kg)", qtd: 210, centavos: 840000 },
    { produto: "Bolo confeitado", qtd: 54, centavos: 253000 },
    { produto: "Sonho", qtd: 430, centavos: 215000 },
    { produto: "Coxinha", qtd: 1200, centavos: 120000 },
  ];
  const produtosTop = produtosBase
    .map((p) => ({ produto: p.produto, qtd: esc(p.qtd), centavos: esc(p.centavos) }))
    .filter((p) => p.centavos > 0)
    .sort((a, b) => b.centavos - a.centavos);

  // Horários de pico (chegada de atendimentos ao longo do dia).
  const horas = ["6h", "8h", "10h", "11h", "12h", "14h", "16h", "17h", "18h", "20h"];
  const picoShape = [4, 9, 14, 18, 15, 8, 10, 16, 13, 6];
  const horariosPico = distribuir(kpis.atendimentos.valor, picoShape).map((v, i) => ({
    hora: horas[i],
    qtd: v,
  }));

  // Top clientes do período.
  const clientesBase: ClienteVenda[] = [
    { nome: "Maria de Souza", centavos: 89000, pedidos: 6 },
    { nome: "João Pereira", centavos: 67000, pedidos: 5 },
    { nome: "Carlos Menezes", centavos: 54000, pedidos: 4 },
    { nome: "Ana Beatriz", centavos: 43000, pedidos: 3 },
    { nome: "Pedro Alves", centavos: 38000, pedidos: 3 },
  ];
  const topClientes = clientesBase
    .map((c) => ({ nome: c.nome, centavos: esc(c.centavos), pedidos: Math.max(1, esc(c.pedidos)) }))
    .filter((c) => c.centavos > 0);

  // Insights acionáveis (viram decisão).
  const diaForte = [...porDiaSemana].sort((a, b) => b.pedidos - a.pedidos)[0];
  const horaForte = [...horariosPico].sort((a, b) => b.qtd - a.qtd)[0];
  const pctFora = kpis.atendimentos.valor
    ? Math.round((kpis.foraHorario.valor / kpis.atendimentos.valor) * 100)
    : 0;
  const money = (c: number) =>
    "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
  const insights = [
    produtosTop[0] && `Seu produto campeão é o ${produtosTop[0].produto} (${money(produtosTop[0].centavos)} em vendas).`,
    diaForte && `${diaFortePorExtenso(diaForte.dia)} é o seu dia mais forte.`,
    pctFora > 0 && `${pctFora}% dos atendimentos aconteceram fora do horário comercial. A IA cobriu.`,
    horaForte && `O pico de mensagens é por volta das ${horaForte.hora}. Vale reforçar a produção antes.`,
  ].filter(Boolean) as string[];

  const periodoLabel =
    periodo === "custom" && de && ate ? `de ${brlData(de)} a ${brlData(ate)}` : LABEL[periodo];

  return {
    periodo,
    periodoLabel,
    comparativoLabel: COMPARA[periodo],
    temDados: true,
    kpis,
    // Na demo a padaria aparece com tudo aprovado. Já basta o dinheiro de
    // exemplo que este arquivo cria; fila parada inventada seria mais um número
    // falso pra alguem confundir com o real.
    aguardando: { pedidos: 0, centavos: 0, recuperadoCentavos: 0 },
    esperando: { pedidos: 0, centavos: 0 },
    porDiaSemana,
    faturamentoSerie,
    produtosTop,
    horariosPico,
    topClientes,
    insights,
  };
}

function diaFortePorExtenso(sigla: string): string {
  const map: Record<string, string> = {
    Seg: "Segunda", Ter: "Terça", Qua: "Quarta", Qui: "Quinta",
    Sex: "Sexta", Sáb: "Sábado", Dom: "Domingo",
  };
  return map[sigla] ?? sigla;
}

// Estado HONESTO vazio (banco real, agregação ainda não feita): zeros, nada inventado.
function vazio(periodo: Periodo, de?: string, ate?: string): Resultados {
  const periodoLabel = periodo === "custom" && de && ate ? `de ${brlData(de)} a ${brlData(ate)}` : LABEL[periodo];
  const zero: Kpi = { valor: 0, variacaoPct: null };
  return {
    periodo,
    periodoLabel,
    comparativoLabel: COMPARA[periodo],
    temDados: false,
    kpis: {
      horasEconomizadas: zero,
      recuperadoCentavos: zero,
      faturadoCentavos: zero,
      atendimentos: zero,
      foraHorario: zero,
      pedidos: zero,
    },
    aguardando: { pedidos: 0, centavos: 0, recuperadoCentavos: 0 },
    porDiaSemana: [],
    faturamentoSerie: [],
    produtosTop: [],
    horariosPico: [],
    topClientes: [],
    insights: ["Ainda coletando dados. Conforme os pedidos chegam pelo WhatsApp, os números aparecem aqui."],
  };
}

export async function carregarResultados(
  negocioId: string | undefined,
  periodo: Periodo,
  de?: string,
  ate?: string,
): Promise<Resultados> {
  const { bancoConfigurado } = await import("./banco/db");
  // Sem banco (demo/vídeo): dados de exemplo realistas.
  if (!bancoConfigurado || !negocioId) return gerarDemo(periodo, de, ate);
  // Com banco real: agrega de verdade. Se a consulta falhar (banco fora do ar,
  // por exemplo), volta o vazio honesto em vez de derrubar a tela inteira.
  try {
    const { agregar } = await import("./banco/resultados");
    const dados = await agregar(negocioId, periodo, de, ate);
    const periodoLabel = periodo === "custom" && de && ate ? `de ${brlData(de)} a ${brlData(ate)}` : LABEL[periodo];
    return { periodo, periodoLabel, comparativoLabel: COMPARA[periodo], ...dados };
  } catch (e) {
    console.error("[resultados] falha ao agregar:", e);
    return vazio(periodo, de, ate);
  }
}
