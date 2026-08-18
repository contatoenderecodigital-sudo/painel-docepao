// ============================================================================
//  RESULTADOS COM DADOS DE VERDADE.
//
//  A tela existia bonita e vazia: com banco real a agregacao nunca tinha sido
//  escrita, entao ela dizia "ainda coletando dados" pra sempre, mesmo com pedido
//  aprovado e impresso na cozinha. Aqui os numeros saem do banco.
//
//  O que cada numero significa (isto e contrato com a dona, nao detalhe tecnico):
//
//  - FATURADO: soma dos pedidos que a equipe APROVOU, na data da aprovacao. E o
//    dinheiro que virou producao. Pedido esperando aprovacao nao conta: ainda
//    pode ser recusado.
//  - RECUPERADO: dentro do faturado, o que precisou de cobranca pra fechar.
//  - ATENDIMENTOS: clientes diferentes que mandaram mensagem no periodo.
//  - FORA DO HORARIO: destes, os que escreveram antes das 8h ou depois das 18h,
//    quando nao teria ninguem pra responder.
//  - HORAS DE VOLTA: cada resposta da IA e uma mensagem que alguem teria que ler
//    e escrever. Conta 1,5 min por resposta, conservador pra quem atende no
//    balcao e pega o celular no meio.
//  - PEDIDOS: quantos pedidos aprovados no periodo.
//
//  Fuso: tudo em America/Sao_Paulo. Sem isso "hoje" comeca as 21h do dia
//  anterior e a dona ve o movimento da noite no dia errado.
// ============================================================================

import { query, queryUm } from "./db";
import type { Periodo, Resultados, Kpi, PontoSerie, ProdutoVenda, ClienteVenda } from "../resultados";

const TZ = "America/Sao_Paulo";
const MIN_POR_RESPOSTA = 1.5;

type Janela = { ini: string; fim: string; iniAnt: string; fimAnt: string };

// Data/hora local da padaria, como texto que o Postgres entende.
function comoTexto(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes()) +
    ":" +
    p(d.getSeconds())
  );
}

function agoraLocal(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

// O periodo pedido e o periodo anterior de mesmo tamanho (pro comparativo).
export function janelaDe(periodo: Periodo, de?: string, ate?: string): Janela {
  const agora = agoraLocal();
  let ini: Date;
  let fim: Date;
  if (periodo === "custom" && de && ate) {
    ini = new Date(de + "T00:00:00");
    fim = new Date(ate + "T00:00:00");
    fim.setDate(fim.getDate() + 1);
  } else if (periodo === "hoje") {
    ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    fim = new Date(ini);
    fim.setDate(fim.getDate() + 1);
  } else if (periodo === "semana") {
    const diaDaSemana = (agora.getDay() + 6) % 7; // segunda = 0
    ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diaDaSemana);
    fim = new Date(ini);
    fim.setDate(fim.getDate() + 7);
  } else if (periodo === "mes") {
    ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
    fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  } else {
    ini = new Date(agora.getFullYear(), 0, 1);
    fim = new Date(agora.getFullYear() + 1, 0, 1);
  }
  const duracao = fim.getTime() - ini.getTime();
  const iniAnt = new Date(ini.getTime() - duracao);
  return { ini: comoTexto(ini), fim: comoTexto(fim), iniAnt: comoTexto(iniAnt), fimAnt: comoTexto(ini) };
}

// Data que conta como "quando vendeu": a aprovacao. Sem ela, o fechamento.
const DATA_VENDA = "coalesce(p.aprovado_em, p.confirmado_em, p.criado_em) at time zone '" + TZ + "'";
const VENDIDO = "p.status in ('aprovado', 'impresso')";
const MSG_LOCAL = "m.criado_em at time zone '" + TZ + "'";

type LinhaKpi = {
  faturado: string;
  recuperado: string;
  pedidos: string;
  atendimentos: string;
  fora: string;
  respostas: string;
};

async function kpisDoIntervalo(negocioId: string, ini: string, fim: string): Promise<LinhaKpi> {
  const l = await queryUm<LinhaKpi>(
    `select
       (select coalesce(sum(p.total_centavos), 0) from pedidos p
          where p.negocio_id = $1 and ${VENDIDO}
            and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3) as faturado,
       (select coalesce(sum(p.total_centavos), 0) from pedidos p
          where p.negocio_id = $1 and ${VENDIDO} and coalesce(p.cobrancas, 0) > 0
            and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3) as recuperado,
       (select count(*) from pedidos p
          where p.negocio_id = $1 and ${VENDIDO}
            and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3) as pedidos,
       (select count(distinct m.cliente_id) from mensagens m
          where m.negocio_id = $1 and m.papel = 'user'
            and ${MSG_LOCAL} >= $2 and ${MSG_LOCAL} < $3) as atendimentos,
       (select count(distinct m.cliente_id) from mensagens m
          where m.negocio_id = $1 and m.papel = 'user'
            and ${MSG_LOCAL} >= $2 and ${MSG_LOCAL} < $3
            and (extract(hour from ${MSG_LOCAL}) < 8 or extract(hour from ${MSG_LOCAL}) >= 18)) as fora,
       (select count(*) from mensagens m
          where m.negocio_id = $1 and m.papel = 'assistant'
            and ${MSG_LOCAL} >= $2 and ${MSG_LOCAL} < $3) as respostas`,
    [negocioId, ini, fim],
  );
  return l ?? { faturado: "0", recuperado: "0", pedidos: "0", atendimentos: "0", fora: "0", respostas: "0" };
}

// Comparativo so existe quando havia com o que comparar: periodo anterior zerado
// vira "sem comparativo ainda" em vez de "+100%", que nao quer dizer nada.
function kpi(atual: number, anterior: number): Kpi {
  if (anterior <= 0) return { valor: atual, variacaoPct: null };
  return { valor: atual, variacaoPct: Math.round(((atual - anterior) / anterior) * 100) };
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function agregar(
  negocioId: string,
  periodo: Periodo,
  de?: string,
  ate?: string,
): Promise<Omit<Resultados, "periodo" | "periodoLabel" | "comparativoLabel">> {
  const j = janelaDe(periodo, de, ate);
  const [atual, anterior] = await Promise.all([
    kpisDoIntervalo(negocioId, j.ini, j.fim),
    kpisDoIntervalo(negocioId, j.iniAnt, j.fimAnt),
  ]);

  const n = (s: string | number | null) => Number(s ?? 0) || 0;
  const horas = (respostas: number) => Math.round((respostas * MIN_POR_RESPOSTA) / 60);

  const kpis = {
    horasEconomizadas: kpi(horas(n(atual.respostas)), horas(n(anterior.respostas))),
    recuperadoCentavos: kpi(n(atual.recuperado), n(anterior.recuperado)),
    faturadoCentavos: kpi(n(atual.faturado), n(anterior.faturado)),
    atendimentos: kpi(n(atual.atendimentos), n(anterior.atendimentos)),
    foraHorario: kpi(n(atual.fora), n(anterior.fora)),
    pedidos: kpi(n(atual.pedidos), n(anterior.pedidos)),
  };

  // Pedidos por dia da semana, na janela pedida.
  const dias = await query<{ dia: string; qtd: string }>(
    `select to_char(${DATA_VENDA}, 'ID') as dia, count(*) as qtd
       from pedidos p
      where p.negocio_id = $1 and ${VENDIDO} and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3
      group by 1`,
    [negocioId, j.ini, j.fim],
  );
  const porDia = new Map<number, number>();
  for (const d of dias) porDia.set(Number(d.dia) % 7, Number(d.qtd) || 0);
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 0].map((idx) => ({
    dia: DIAS[idx],
    pedidos: porDia.get(idx) ?? 0,
  }));

  // Faturamento ao longo do tempo: a fatia muda com o periodo.
  const unidade =
    periodo === "hoje" ? "hour" : periodo === "ano" ? "month" : periodo === "mes" ? "week" : "day";
  const serie = await query<{ balde: string; valor: string }>(
    `select date_trunc('${unidade}', ${DATA_VENDA}) as balde, sum(p.total_centavos) as valor
       from pedidos p
      where p.negocio_id = $1 and ${VENDIDO} and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3
      group by 1 order by 1`,
    [negocioId, j.ini, j.fim],
  );
  const faturamentoSerie: PontoSerie[] = serie.map((s) => {
    const d = new Date(s.balde);
    const label =
      unidade === "hour"
        ? d.getHours() + "h"
        : unidade === "month"
          ? MESES[d.getMonth()]
          : unidade === "week"
            ? "Sem " + Math.ceil(d.getDate() / 7)
            : String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
    return { label, valor: Number(s.valor) || 0 };
  });

  // O que mais vendeu, por produto.
  const prods = await query<{ produto: string; qtd: string; centavos: string }>(
    `select i.produto, sum(i.qtd) as qtd, sum(i.subtotal_centavos) as centavos
       from pedido_itens i join pedidos p on p.id = i.pedido_id
      where p.negocio_id = $1 and ${VENDIDO} and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3
      group by 1 order by 3 desc limit 8`,
    [negocioId, j.ini, j.fim],
  );
  const produtosTop: ProdutoVenda[] = prods.map((x) => ({
    produto: x.produto,
    qtd: Number(x.qtd) || 0,
    centavos: Number(x.centavos) || 0,
  }));

  // Quando chegam as mensagens (e quando a padaria precisa estar pronta).
  const horasMsg = await query<{ h: string; qtd: string }>(
    `select extract(hour from ${MSG_LOCAL})::int as h, count(*) as qtd
       from mensagens m
      where m.negocio_id = $1 and m.papel = 'user' and ${MSG_LOCAL} >= $2 and ${MSG_LOCAL} < $3
      group by 1 order by 1`,
    [negocioId, j.ini, j.fim],
  );
  const horariosPico = horasMsg.map((x) => ({ hora: Number(x.h) + "h", qtd: Number(x.qtd) || 0 }));

  const clientes = await query<{ nome: string; centavos: string; pedidos: string }>(
    `select coalesce(c.nome, 'Sem nome') as nome, sum(p.total_centavos) as centavos, count(*) as pedidos
       from pedidos p left join clientes c on c.id = p.cliente_id
      where p.negocio_id = $1 and ${VENDIDO} and ${DATA_VENDA} >= $2 and ${DATA_VENDA} < $3
      group by 1 order by 2 desc limit 8`,
    [negocioId, j.ini, j.fim],
  );
  const topClientes: ClienteVenda[] = clientes.map((x) => ({
    nome: x.nome,
    centavos: Number(x.centavos) || 0,
    pedidos: Number(x.pedidos) || 0,
  }));

  const temDados = kpis.pedidos.valor > 0 || kpis.atendimentos.valor > 0;

  const money = (c: number) =>
    "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
  const diaForte = [...porDiaSemana].sort((a, b) => b.pedidos - a.pedidos)[0];
  const horaForte = [...horariosPico].sort((a, b) => b.qtd - a.qtd)[0];
  const pctFora =
    kpis.atendimentos.valor > 0
      ? Math.round((kpis.foraHorario.valor / kpis.atendimentos.valor) * 100)
      : 0;
  const insights = [
    produtosTop[0] &&
      `Seu produto campeão é o ${produtosTop[0].produto} (${money(produtosTop[0].centavos)} em vendas).`,
    diaForte && diaForte.pedidos > 0 && `${diaForte.dia} é o seu dia mais forte.`,
    pctFora > 0 && `${pctFora}% dos atendimentos começaram fora do horário comercial. A IA cobriu.`,
    horaForte && `O pico de mensagens é por volta das ${horaForte.hora}. Vale reforçar a produção antes.`,
    kpis.recuperadoCentavos.valor > 0 &&
      `${money(kpis.recuperadoCentavos.valor)} vieram de pedidos que precisaram de cobrança pra fechar.`,
  ].filter(Boolean) as string[];

  return {
    temDados,
    kpis,
    porDiaSemana,
    faturamentoSerie,
    produtosTop,
    horariosPico,
    topClientes,
    insights: insights.length
      ? insights
      : ["Ainda sem movimento neste período. Os números aparecem conforme os pedidos são aprovados."],
  };
}
