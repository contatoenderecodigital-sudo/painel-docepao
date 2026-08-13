"use client";

// Resultados (desempenho): dashboard que o dono abre pra TOMAR DECISÃO. Filtro
// de período que reflete em tudo, comparativo vs. período anterior em cada KPI,
// gráficos interativos, insights acionáveis, top clientes e relatório pra
// imprimir. Sem dados suficientes, cada seção mostra estado vazio honesto.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { brl } from "@/lib/tipos";
import { NumberTicker } from "@/components/ui/number-ticker";
import AjudaInfo from "@/components/AjudaInfo";
import type { Resultados as Dados, Periodo, PontoSerie } from "@/lib/resultados";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  RotateCcw,
  Banknote,
  MessageCircle,
  Moon,
  ShoppingBag,
  Printer,
  Lightbulb,
  Trophy,
} from "lucide-react";

const PERIODOS: [Periodo, string][] = [
  ["hoje", "Hoje"],
  ["semana", "Esta semana"],
  ["mes", "Este mês"],
  ["ano", "Este ano"],
  ["custom", "Personalizado"],
];

const OURO = "#e6c766";
const COBRE = "#e08a3c";

export default function Resultados({
  dados,
  nome = "",
  de = "",
  ate = "",
}: {
  dados: Dados;
  nome?: string;
  de?: string;
  ate?: string;
}) {
  const router = useRouter();
  const [d1, setD1] = useState(de);
  const [d2, setD2] = useState(ate);

  function trocar(p: Periodo) {
    if (p === "custom") {
      const hoje = new Date().toISOString().slice(0, 10);
      router.push(`/resultados?periodo=custom&de=${d1 || hoje}&ate=${d2 || hoje}`);
    } else {
      router.push(`/resultados?periodo=${p}`);
    }
  }
  function aplicarCustom() {
    if (d1 && d2) router.push(`/resultados?periodo=custom&de=${d1}&ate=${d2}`);
  }

  const K = dados.kpis;
  const semDados = !dados.temDados;

  return (
    <div className="px-8 py-7">
      {/* cabeçalho + ações */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">
            Resultados
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="font-title text-3xl font-bold text-cream">
              O que a {nome || "padaria"} fez {dados.periodoLabel}
            </h1>
            <AjudaInfo titulo="Resultados" texto="Os números do negócio no período que você escolher lá em cima: faturamento, atendimentos, produtos mais vendidos e clientes que mais compram. Serve pra tomar decisão." />
          </div>
          <p className="text-sm text-cream/65 mt-1 max-w-2xl">
            Não é achismo. É o resultado em número: tempo de volta, pedidos atendidos, dinheiro que
            entrou e o que decidir a seguir.
          </p>
        </div>
        <button
          onClick={() => imprimirRelatorio(dados, nome)}
          className="press glass-soft rounded-lg px-4 py-2.5 text-sm text-cream/85 inline-flex items-center gap-2 hover:bg-white/[0.08] transition-colors"
        >
          <Printer size={16} /> Imprimir relatório
        </button>
      </div>

      {/* filtro de período */}
      <div className="flex flex-wrap items-center gap-3 mt-5 mb-6">
        <div className="glass-soft rounded-lg p-1 inline-flex gap-1 flex-wrap">
          {PERIODOS.map(([p, label]) => (
            <button
              key={p}
              onClick={() => trocar(p)}
              className={
                "press px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors " +
                (dados.periodo === p ? "bg-white/15 text-cream" : "text-cream/55 hover:text-cream")
              }
            >
              {label}
            </button>
          ))}
        </div>
        {dados.periodo === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={d1}
              onChange={(e) => setD1(e.target.value)}
              className="glass-soft rounded-lg px-3 py-2 text-sm text-cream outline-none focus:ring-1 focus:ring-dourado/40"
            />
            <span className="text-cream/40 text-sm">até</span>
            <input
              type="date"
              value={d2}
              onChange={(e) => setD2(e.target.value)}
              className="glass-soft rounded-lg px-3 py-2 text-sm text-cream outline-none focus:ring-1 focus:ring-dourado/40"
            />
            <button
              onClick={aplicarCustom}
              className="btn-cobre press px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {semDados && (
        <div className="glass-soft rounded-xl px-5 py-3.5 mb-6 text-sm text-cream/75 flex items-center gap-2">
          <span className="grad-cobre w-2 h-2 rounded-full" />
          Ainda coletando dados {dados.periodoLabel}. Conforme os pedidos entram, os números e
          gráficos aparecem aqui.
        </div>
      )}

      {/* KPIs de destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          destaque
          icon={<Clock size={17} />}
          valor={semDados ? "—" : <NumberTicker value={K.horasEconomizadas.valor} suffix="h" />}
          rotulo="horas de volta pra equipe"
          variacao={K.horasEconomizadas.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
        <Kpi
          destaque
          icon={<RotateCcw size={17} />}
          valor={
            semDados ? "—" : <NumberTicker value={K.recuperadoCentavos.valor / 100} prefix="R$ " decimals={2} />
          }
          rotulo="em orçamentos recuperados"
          variacao={K.recuperadoCentavos.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
        <Kpi
          destaque
          icon={<Banknote size={17} />}
          valor={
            semDados ? "—" : <NumberTicker value={K.faturadoCentavos.valor / 100} prefix="R$ " decimals={2} />
          }
          rotulo="faturados pelo WhatsApp"
          variacao={K.faturadoCentavos.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <Kpi
          icon={<MessageCircle size={16} />}
          valor={semDados ? "—" : <NumberTicker value={K.atendimentos.valor} />}
          rotulo="atendimentos"
          variacao={K.atendimentos.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
        <Kpi
          icon={<Moon size={16} />}
          valor={semDados ? "—" : <NumberTicker value={K.foraHorario.valor} />}
          rotulo="fora do horário"
          variacao={K.foraHorario.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
        <Kpi
          icon={<ShoppingBag size={16} />}
          valor={semDados ? "—" : <NumberTicker value={K.pedidos.valor} />}
          rotulo="pedidos"
          variacao={K.pedidos.variacaoPct}
          comparativo={dados.comparativoLabel}
        />
      </div>

      {/* gráficos: faturamento + dia da semana */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Painel titulo="Faturamento ao longo do tempo" sub="Tendência de crescimento" className="lg:col-span-2">
          {dados.faturamentoSerie.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={dados.faturamentoSerie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OURO} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={OURO} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(245,235,220,0.55)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ stroke: "rgba(255,255,255,0.15)" }} content={<TipMoney />} />
                <Area type="monotone" dataKey="valor" stroke={OURO} strokeWidth={2.5} fill="url(#fatGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Pedidos por dia da semana" sub="Onde está o pico">
          {dados.porDiaSemana.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dados.porDiaSemana} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="dia" tick={{ fill: "rgba(245,235,220,0.55)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<TipCount unidade="pedidos" />} />
                <Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>
                  {dados.porDiaSemana.map((d, i) => {
                    const max = Math.max(...dados.porDiaSemana.map((x) => x.pedidos));
                    return <Cell key={i} fill={d.pedidos === max ? OURO : "rgba(230,199,102,0.4)"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Painel>
      </div>

      {/* produtos mais vendidos + horários de pico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Painel titulo="Produtos mais vendidos" sub="O que produzir e estocar primeiro">
          {dados.produtosTop.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              {dados.produtosTop.map((p, i) => {
                const max = dados.produtosTop[0].centavos || 1;
                return (
                  <div key={p.produto}>
                    <div className="flex items-baseline justify-between text-sm mb-1">
                      <span className="text-cream/90">
                        <b className="text-dourado mr-1.5">{i + 1}</b>
                        {p.produto}
                        <span className="text-cream/45 text-xs ml-2">{p.qtd} un.</span>
                      </span>
                      <span className="text-cream tabular-nums font-medium">{brl(p.centavos)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(6, (p.centavos / max) * 100)}%`,
                          background: "linear-gradient(90deg,#8f4712,#e08a3c)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Painel>

        <Painel titulo="Horários de pico" sub="Quando chegam mais mensagens">
          {dados.horariosPico.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dados.horariosPico} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="hora" tick={{ fill: "rgba(245,235,220,0.55)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<TipCount unidade="mensagens" />} />
                <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                  {dados.horariosPico.map((d, i) => {
                    const max = Math.max(...dados.horariosPico.map((x) => x.qtd));
                    return <Cell key={i} fill={d.qtd === max ? COBRE : "rgba(224,138,60,0.35)"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Painel>
      </div>

      {/* destaques + top clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Painel titulo="Destaques" sub="O que os números estão dizendo">
          {dados.insights.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <div className="flex flex-col gap-2.5 pt-1">
              {dados.insights.map((t, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-cream/85">
                  <span className="grad-dourado shrink-0 w-7 h-7 rounded-lg grid place-items-center text-vinho-d mt-0.5">
                    <Lightbulb size={15} />
                  </span>
                  <span className="leading-snug pt-1">{t}</span>
                </div>
              ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Top clientes" sub="Quem vale fidelizar">
          {dados.topClientes.length === 0 ? (
            <Vazio label={dados.periodoLabel} />
          ) : (
            <div className="flex flex-col gap-1 pt-1">
              {dados.topClientes.map((c, i) => (
                <div key={c.nome} className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0">
                  <span
                    className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold"
                    style={
                      i === 0
                        ? { background: "linear-gradient(135deg,#e6c766,#b98b2e)", color: "#4a1020" }
                        : { background: "rgba(255,255,255,0.08)", color: "rgba(245,235,220,0.8)" }
                    }
                  >
                    {i === 0 ? <Trophy size={14} /> : i + 1}
                  </span>
                  <span className="flex-1 text-sm text-cream/90 truncate">{c.nome}</span>
                  <span className="text-xs text-cream/45">{c.pedidos} ped.</span>
                  <span className="text-sm text-cream font-medium tabular-nums w-24 text-right">{brl(c.centavos)}</span>
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Kpi({
  icon,
  valor,
  rotulo,
  variacao,
  comparativo,
  destaque = false,
}: {
  icon: React.ReactNode;
  valor: React.ReactNode;
  rotulo: string;
  variacao: number | null;
  comparativo: string;
  destaque?: boolean;
}) {
  return (
    <div className={(destaque ? "glass-strong" : "glass") + " rounded-2xl p-5"}>
      <div className="flex items-center gap-2 text-dourado">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/55">{rotulo}</span>
      </div>
      <div
        className={
          "font-title font-bold leading-none mt-2.5 " +
          (destaque ? "text-4xl text-grad-dourado" : "text-3xl text-cream")
        }
      >
        {valor}
      </div>
      <div className="mt-2.5">
        <Variacao pct={variacao} comparativo={comparativo} />
      </div>
    </div>
  );
}

function Variacao({ pct, comparativo }: { pct: number | null; comparativo: string }) {
  if (pct === null) return <span className="text-xs text-cream/40">sem comparativo ainda</span>;
  const subiu = pct >= 0;
  const cor = subiu ? "#5fd08a" : "#ff8a8a";
  const Icon = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="text-xs inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: cor }}>
        <Icon size={13} />
        {subiu ? "+" : ""}
        {pct}%
      </span>
      <span className="text-cream/45">{comparativo}</span>
    </span>
  );
}

function Painel({
  titulo,
  sub,
  className = "",
  children,
}: {
  titulo: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"glass rounded-2xl p-5 " + className}>
      <div className="text-sm font-semibold text-cream">{titulo}</div>
      {sub && <div className="text-xs text-cream/55 mb-4">{sub}</div>}
      {children}
    </div>
  );
}

function Vazio({ label }: { label: string }) {
  return (
    <div className="h-[180px] grid place-items-center text-center">
      <div className="text-sm text-cream/50 max-w-[220px]">Ainda coletando dados {label}.</div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TipMoney({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(58,16,28,0.97)", boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
      <div className="text-cream/60">{label}</div>
      <div className="text-dourado font-semibold text-sm mt-0.5">{brl(payload[0].value)}</div>
    </div>
  );
}
function TipCount({ active, payload, label, unidade }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(58,16,28,0.97)", boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
      <div className="text-cream/60">{label}</div>
      <div className="text-cream font-semibold text-sm mt-0.5">
        {payload[0].value} {unidade}
      </div>
    </div>
  );
}

// Relatório limpo (preto no branco) num iframe isolado, pronto pra imprimir/salvar.
function imprimirRelatorio(d: Dados, nome: string) {
  const linhaProd = d.produtosTop
    .map((p) => `<tr><td>${p.produto}</td><td class="r">${p.qtd} un.</td><td class="r">${brl(p.centavos)}</td></tr>`)
    .join("");
  const linhaCli = d.topClientes
    .map((c) => `<tr><td>${c.nome}</td><td class="r">${c.pedidos} ped.</td><td class="r">${brl(c.centavos)}</td></tr>`)
    .join("");
  const insights = d.insights.map((t) => `<li>${t}</li>`).join("");
  const kpi = (rot: string, val: string) => `<div class="kpi"><span>${rot}</span><b>${val}</b></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Relatório ${nome}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;color:#111}
    body{padding:32px;max-width:720px;margin:0 auto}
    h1{font-size:20px;margin:0}
    .sub{color:#666;font-size:13px;margin:2px 0 20px}
    .grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
    .kpi{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:150px}
    .kpi span{display:block;font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.5px}
    .kpi b{font-size:20px}
    h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:5px 0;border-bottom:1px solid #f0f0f0}
    .r{text-align:right}
    ul{font-size:13px;padding-left:18px}
    li{margin:4px 0}
    .foot{margin-top:28px;font-size:11px;color:#999}
  </style></head><body>
  <h1>Relatório ${nome || "Padaria"}</h1>
  <div class="sub">Período: ${d.periodoLabel}</div>
  <div class="grid">
    ${kpi("Faturado (WhatsApp)", brl(d.kpis.faturadoCentavos.valor))}
    ${kpi("Recuperado", brl(d.kpis.recuperadoCentavos.valor))}
    ${kpi("Atendimentos", String(d.kpis.atendimentos.valor))}
    ${kpi("Pedidos", String(d.kpis.pedidos.valor))}
    ${kpi("Horas economizadas", d.kpis.horasEconomizadas.valor + "h")}
    ${kpi("Fora do horário", String(d.kpis.foraHorario.valor))}
  </div>
  ${insights ? `<h2>Destaques</h2><ul>${insights}</ul>` : ""}
  ${linhaProd ? `<h2>Produtos mais vendidos</h2><table>${linhaProd}</table>` : ""}
  ${linhaCli ? `<h2>Top clientes</h2><table>${linhaCli}</table>` : ""}
  <div class="foot">Gerado pelo painel Endereço Digital.</div>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };
}
