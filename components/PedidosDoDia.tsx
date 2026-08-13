"use client";

// Painel de producao por departamento. Cada equipe ve so o que precisa fazer.
// Barra de controle (data + departamento + status + busca), KPIs do dia,
// producao agregada por estacao (com progresso e baixa), lista de pedidos e
// mini-calendario do mes com os dias mais cheios.

import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/tipos";
import { brl } from "@/lib/tipos";
import {
  DEPARTAMENTOS,
  type DeptoId,
  agregarPorDepto,
  deptoInfo,
  deptosDoPedido,
} from "@/lib/departamentos";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DeptIcone } from "@/components/DeptIcone";
import AjudaInfo from "@/components/AjudaInfo";

type StatusUI = "a_produzir" | "pronto" | "retirado";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDias(base: string, n: number) {
  const [a, m, d] = base.split("-").map(Number);
  const dt = new Date(a, m - 1, d + n);
  return iso(dt);
}
function fmtLongo(base: string) {
  const [a, m, d] = base.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DOW[dt.getDay()]}, ${d} de ${MES[m - 1]}`;
}

function Pill({ on, cor, children, onClick }: { on: boolean; cor?: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={"press text-[13px] font-medium px-3.5 py-1.5 rounded-full transition-colors " + (on ? "text-vinho-d" : "text-cream/70 hover:text-cream bg-white/[0.06] hover:bg-white/10")}
      style={on ? { background: cor ?? "#e7cf94" } : undefined}
    >
      {children}
    </button>
  );
}

function statusInfo(s: StatusUI) {
  if (s === "pronto") return { txt: "Pronto", cor: "#35c46f", bg: "rgba(53,196,111,0.15)" };
  if (s === "retirado") return { txt: "Retirado", cor: "#9aa0a6", bg: "rgba(255,255,255,0.08)" };
  return { txt: "A produzir", cor: "#e0b04a", bg: "rgba(231,207,148,0.15)" };
}

export default function PedidosDoDia({ pedidos: pedidosIniciais }: { pedidos: Pedido[] }) {
  const [pedidos, setPedidos] = useState(pedidosIniciais);

  // Auto-update: busca os pedidos do dia a cada 8s (produção nova aparece sozinha).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/dia");
        if (!r.ok) return;
        setPedidos((await r.json()) as Pedido[]);
      } catch {
        /* silencioso */
      }
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const hoje = useMemo(() => iso(new Date()), []);
  const [sel, setSel] = useState(() => {
    const m: Record<string, number> = {};
    for (const p of pedidos) if (p.retiradaData) m[p.retiradaData] = (m[p.retiradaData] || 0) + 1;
    const h = iso(new Date());
    if (m[h]) return h;
    return Object.keys(m).sort()[0] ?? h;
  });
  const [depto, setDepto] = useState<DeptoId | "todos">("todos");
  const [status, setStatus] = useState<StatusUI | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [mesRef, setMesRef] = useState(sel);
  const [prontos, setProntos] = useState<Record<string, boolean>>({});
  const [statusManual, setStatusManual] = useState<Record<string, StatusUI>>({});

  const comData = useMemo(() => pedidos.filter((p) => p.retiradaData), [pedidos]);

  // contagem por dia (mini-calendario)
  const porDia = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of comData) if (p.retiradaData) m[p.retiradaData] = (m[p.retiradaData] || 0) + 1;
    return m;
  }, [comData]);

  const statusDe = (p: Pedido): StatusUI => statusManual[p.id] ?? "a_produzir";

  // pedidos do dia selecionado (com busca + status)
  const doDia = useMemo(() => {
    return comData
      .filter((p) => p.retiradaData === sel)
      .filter((p) => (busca ? p.clienteNome.toLowerCase().includes(busca.trim().toLowerCase()) : true))
      .filter((p) => (status === "todos" ? true : statusDe(p) === status))
      .sort((a, b) => (a.retiradaHora ?? "99").localeCompare(b.retiradaHora ?? "99"));
  }, [comData, sel, busca, status, statusManual]);

  const agregado = useMemo(() => agregarPorDepto(doDia), [doDia]);

  const kpis = useMemo(() => {
    const totalItens = doDia.reduce((s, p) => s + p.itens.reduce((x, i) => x + i.qtd, 0), 0);
    const fat = doDia.reduce((s, p) => s + p.totalCentavos, 0);
    const horas = doDia.map((p) => p.retiradaHora).filter(Boolean).sort() as string[];
    return { pedidos: doDia.length, fat, totalItens, proxima: horas[0] ?? "-" };
  }, [doDia]);

  const grandes = doDia.filter((p) => p.pessoas && p.pessoas >= 20);
  const deptosMostrar = depto === "todos" ? DEPARTAMENTOS : DEPARTAMENTOS.filter((d) => d.id === depto);

  // grade do mini-calendario
  const [ay, am] = mesRef.split("-").map(Number);
  const primeiro = new Date(ay, am - 1, 1);
  const diasNoMes = new Date(ay, am, 0).getDate();
  const offset = primeiro.getDay();
  const celulas: (string | null)[] = [];
  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(iso(new Date(ay, am - 1, d)));
  const maxDia = Math.max(1, ...Object.values(porDia));

  const relacao = sel === hoje ? "Hoje" : sel === addDias(hoje, 1) ? "Amanhã" : sel === addDias(hoje, -1) ? "Ontem" : "";

  return (
    <div className="px-8 py-7 min-h-screen">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">Pedidos do dia</div>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="font-title text-3xl font-bold text-cream">Produção da cozinha</h1>
        <AjudaInfo titulo="Pedidos do dia" texto="A produção do dia separada por estação (padaria, salgados, confeitaria, bolos). Cada equipe vê só o que precisa fazer e marca o que já ficou pronto." />
      </div>
      <p className="text-sm text-cream/60 mt-1 mb-6 max-w-2xl">
        Cada equipe vê só o que precisa produzir. A soma de todos os pedidos do dia, separada por estação.
      </p>

      {/* barra de controle */}
      <div className="glass rounded-[18px] p-4 flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <button onClick={() => setSel(addDias(sel, -1))} className="press w-8 h-8 grid place-items-center rounded-lg bg-white/[0.06] hover:bg-white/10 text-cream/80" aria-label="Dia anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <div className="px-3 text-center min-w-[150px]">
            <div className="text-[13px] font-semibold text-cream capitalize">{fmtLongo(sel)}</div>
            {relacao && <div className="text-[10px] uppercase tracking-wider text-dourado">{relacao}</div>}
          </div>
          <button onClick={() => setSel(addDias(sel, 1))} className="press w-8 h-8 grid place-items-center rounded-lg bg-white/[0.06] hover:bg-white/10 text-cream/80" aria-label="Proximo dia">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
        <button onClick={() => { setSel(hoje); setMesRef(hoje); }} className="press text-[13px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-cream/80">Hoje</button>

        <div className="w-px h-6 bg-white/12 mx-1" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <Pill on={depto === "todos"} onClick={() => setDepto("todos")}>Todos</Pill>
          {DEPARTAMENTOS.map((d) => (
            <Pill key={d.id} on={depto === d.id} cor={d.cor} onClick={() => setDepto(d.id)}>{d.nome}</Pill>
          ))}
        </div>

        <div className="w-px h-6 bg-white/12 mx-1" />

        <div className="flex items-center gap-1.5">
          {(["todos", "a_produzir", "pronto", "retirado"] as const).map((s) => (
            <Pill key={s} on={status === s} onClick={() => setStatus(s)}>
              {s === "todos" ? "Todos" : statusInfo(s as StatusUI).txt}
            </Pill>
          ))}
        </div>

        <div className="relative ml-auto">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/45" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" className="bg-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-[13px] text-cream placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-cobre/25 w-48" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { rot: "Pedidos do dia", node: <NumberTicker value={kpis.pedidos} /> },
          { rot: "Faturamento previsto", node: <NumberTicker value={kpis.fat / 100} prefix="R$ " decimals={2} /> },
          { rot: "Itens a produzir", node: <NumberTicker value={kpis.totalItens} /> },
          { rot: "Próxima retirada", node: <span>{kpis.proxima}</span> },
        ].map((k) => (
          <div key={k.rot} className="glass rounded-[18px] px-5 py-4">
            <div className="font-title text-[28px] font-bold leading-none text-grad-dourado">{k.node}</div>
            <div className="text-[12px] text-cream/60 mt-2">{k.rot}</div>
          </div>
        ))}
      </div>

      {/* alerta de pedido grande */}
      {grandes.length > 0 && (
        <div className="rounded-[14px] px-4 py-3 mb-5 flex items-center gap-3 border" style={{ background: "rgba(231,207,148,0.12)", borderColor: "rgba(231,207,148,0.3)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e7cf94" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 3v2M4 8l16 8M4 16l16-8M12 19v2" /></svg>
          <div className="text-[13px] text-cream/90">
            {grandes.map((p, i) => (
              <span key={p.id}>
                {i > 0 && " · "}
                <b className="text-dourado">Festa de {p.pessoas} pessoas</b> ({p.clienteNome}, {p.retiradaHora})
              </span>
            ))}
            <span className="text-cream/60"> · Prepare a equipe com antecedência.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        {/* coluna principal */}
        <div className="min-w-0">
          {/* producao por departamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deptosMostrar.map((d) => {
              const itens = agregado[d.id];
              return (
                <div key={d.id} className="glass rounded-[18px] overflow-hidden flex flex-col">
                  <div className="px-5 py-3 flex items-center gap-2.5 border-b border-white/10" style={{ background: `linear-gradient(90deg, ${d.cor}22, transparent)` }}>
                    <span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: d.cor }}><DeptIcone id={d.id} /></span>
                    <span className="font-semibold text-cream text-[15px]">{d.nome}</span>
                    <span className="ml-auto text-[12px] text-cream/55">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                  </div>
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {itens.length === 0 ? (
                      <div className="text-[13px] text-cream/40 py-4 text-center">Nada pra esta estação hoje.</div>
                    ) : (
                      itens.map((it) => {
                        const key = `${sel}:${d.id}:${it.produto}`;
                        const done = prontos[key];
                        return (
                          <div key={it.produto} className={done ? "opacity-55" : ""}>
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <span className="text-[14px] text-cream">
                                <b className="text-cream tabular-nums" style={{ color: d.cor }}>{it.qtd}</b> {it.produto}
                              </span>
                              <button
                                onClick={() => setProntos((p) => ({ ...p, [key]: !p[key] }))}
                                className="press text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 transition-colors"
                                style={done ? { background: "rgba(53,196,111,0.15)", color: "#35c46f" } : { background: "rgba(255,255,255,0.08)", color: "#f4e8d6" }}
                              >
                                {done ? "Pronto" : "Marcar pronto"}
                              </button>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: done ? "100%" : "8%", background: done ? "#35c46f" : d.cor }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* lista de pedidos individuais */}
          <div className="mt-6">
            <div className="text-[12px] uppercase tracking-[0.15em] text-cream/45 font-semibold mb-3">Pedidos do dia ({doDia.length})</div>
            <div className="flex flex-col gap-3">
              {doDia.length === 0 && (
                <div className="glass rounded-[18px] px-6 py-10 text-center text-cream/55 text-sm">Nenhum pedido para este dia.</div>
              )}
              {doDia.map((p) => {
                const st = statusDe(p);
                const si = statusInfo(st);
                return (
                  <div key={p.id} className="glass rounded-[18px] px-5 py-4 flex items-center gap-5">
                    <div className="w-16 shrink-0 text-center">
                      <div className="font-title text-2xl font-bold text-cream leading-none">{p.retiradaHora ?? "-"}</div>
                      <div className="text-[10px] uppercase tracking-wider text-cream/45 mt-1">retirada</div>
                    </div>
                    <div className="w-px self-stretch bg-white/10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-cream">{p.clienteNome}</span>
                        {deptosDoPedido(p).map((id) => {
                          const di = deptoInfo(id);
                          return (
                            <span key={id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${di.corClara}22`, color: di.corClara }}>
                              <DeptIcone id={id} size={12} /> {di.nome}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-sm text-cream/65 mt-1 truncate">
                        {p.itens.map((i) => `${i.qtd}x ${i.produto}`).join(" . ")}
                      </div>
                      {p.observacoes && <div className="text-xs text-cream/55 italic mt-1 truncate">{p.observacoes}</div>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <div className="font-semibold text-cream tabular-nums">{brl(p.totalCentavos)}</div>
                      <button
                        onClick={() => setStatusManual((m) => ({ ...m, [p.id]: st === "a_produzir" ? "pronto" : st === "pronto" ? "retirado" : "a_produzir" }))}
                        className="press text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: si.bg, color: si.cor }}
                      >
                        {si.txt}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* mini-calendario do mes */}
        <div className="glass rounded-[18px] p-4 h-fit xl:sticky xl:top-6">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMesRef(addDias(`${ay}-${String(am).padStart(2, "0")}-01`, -1))} className="press w-7 h-7 grid place-items-center rounded-lg bg-white/[0.06] hover:bg-white/10 text-cream/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <div className="text-[13px] font-semibold text-cream capitalize">{MES[am - 1]} {ay}</div>
            <button onClick={() => { const d = new Date(ay, am, 1); setMesRef(iso(d)); }} className="press w-7 h-7 grid place-items-center rounded-lg bg-white/[0.06] hover:bg-white/10 text-cream/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d) => (
              <div key={d} className="text-[9px] uppercase text-cream/35 py-1">{d[0]}</div>
            ))}
            {celulas.map((c, i) => {
              if (!c) return <div key={i} />;
              const dia = Number(c.split("-")[2]);
              const n = porDia[c] || 0;
              const on = c === sel;
              const ehHoje = c === hoje;
              const intensidade = n > 0 ? 0.12 + (n / maxDia) * 0.5 : 0;
              return (
                <button
                  key={i}
                  onClick={() => setSel(c)}
                  className={"relative aspect-square rounded-lg text-[12px] grid place-items-center transition-colors " + (on ? "font-bold text-vinho-d" : "text-cream/80 hover:bg-white/10")}
                  style={on ? { background: "#e7cf94" } : n > 0 ? { background: `rgba(197,111,30,${intensidade})` } : undefined}
                >
                  {dia}
                  {n > 0 && !on && <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: "#e7cf94" }} />}
                  {ehHoje && !on && <span className="absolute inset-0 rounded-lg ring-1 ring-inset" style={{ borderColor: "transparent", boxShadow: "inset 0 0 0 1px rgba(231,207,148,0.5)" }} />}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-cream/45 mt-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(197,111,30,0.5)" }} /> dias mais cheios
          </div>
        </div>
      </div>
    </div>
  );
}
