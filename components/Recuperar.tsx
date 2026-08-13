"use client";

// Recuperar orçamento: clientes que pediram e sumiram sem confirmar. Não é uma
// lista estática, é um painel de recuperação de vendas: mostra o dinheiro em
// risco, prova o que já voltou, e prioriza quem cobrar primeiro (por tempo
// parado, com cor de urgência). O sistema cobra sozinho; aqui a equipe empurra.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Pedido } from "@/lib/tipos";
import { brl, formatarTelefoneBR, linkWhatsapp } from "@/lib/tipos";
import { NumberTicker } from "@/components/ui/number-ticker";
import AjudaInfo from "@/components/AjudaInfo";
import {
  AlertTriangle,
  TrendingUp,
  Target,
  FileClock,
  Search,
  Send,
  MessageCircle,
  FileText,
  Clock,
  Circle,
  Eye,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

type Stats = { recuperadoCentavos: number; recuperadosQtd: number; temDados: boolean };
type TempoFiltro = "todos" | "hoje" | "3mais" | "7mais";
type StatusFiltro = "todos" | "cobrado" | "naocobrado";

// --- urgência por tempo parado ------------------------------------------------
const TIER = {
  ok: { bg: "rgba(212,175,55,0.14)", fg: "#e6c766", ring: "rgba(212,175,55,0.32)" },
  atencao: { bg: "rgba(181,96,26,0.18)", fg: "#e3924a", ring: "rgba(181,96,26,0.38)" },
  urgente: { bg: "rgba(224,30,30,0.15)", fg: "#ff8a8a", ring: "rgba(224,30,30,0.38)" },
} as const;
type Tier = keyof typeof TIER;

function tempoParado(criadoEmIso: string, agora: number) {
  const ms = Math.max(0, agora - new Date(criadoEmIso).getTime());
  const totalHoras = Math.floor(ms / 3_600_000);
  const dias = Math.floor(totalHoras / 24);
  let label: string;
  if (totalHoras < 1) label = "parado agora há pouco";
  else if (totalHoras < 24) label = `parado há ${totalHoras}h`;
  else label = `parado há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const tier: Tier = dias <= 1 ? "ok" : dias < 7 ? "atencao" : "urgente";
  return { ms, dias, label, tier };
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function dataBr(iso: string | null) {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Status da cobrança (honesto: só mostra o que o sistema realmente sabe).
function statusCobranca(p: Pedido, cobradoLocal: boolean) {
  if (cobradoLocal)
    return { label: "Cobrança enviada, aguardando resposta", fg: "#e6c766", Icon: Send };
  if (p.clienteViuEm)
    return { label: "Cliente visualizou a cobrança", fg: "#5fd08a", Icon: Eye };
  if (p.cobrancaEm)
    return { label: "Cobrança automática enviada", fg: "#e6c766", Icon: Clock };
  return { label: "Ainda não cobrado", fg: "rgba(245,235,220,0.55)", Icon: Circle };
}

function foiCobrado(p: Pedido, cobradoLocal: boolean) {
  return cobradoLocal || Boolean(p.cobrancaEm) || Boolean(p.clienteViuEm);
}

export default function Recuperar({
  parados,
  nomeNegocio = "",
  agora,
  stats,
  msgCobranca = "Oi {nome}! Seu orçamento ainda está de pé. Quer confirmar? É só responder por aqui.",
}: {
  parados: Pedido[];
  nomeNegocio?: string;
  agora: number;
  stats: Stats;
  msgCobranca?: string;
}) {
  const [cobrados, setCobrados] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<Pedido | null>(null);
  const [detalhe, setDetalhe] = useState<Pedido | null>(null);
  const [tempoF, setTempoF] = useState<TempoFiltro>("todos");
  const [statusF, setStatusF] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [autoOn, setAutoOn] = useState(true);
  const [personalizando, setPersonalizando] = useState(false);
  const [template, setTemplate] = useState(msgCobranca);
  const [salvandoMsg, setSalvandoMsg] = useState(false);

  async function salvarTemplate() {
    setSalvandoMsg(true);
    try {
      await fetch("/api/cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: template }),
      });
      setPersonalizando(false);
    } finally {
      setSalvandoMsg(false);
    }
  }

  // KPIs (sobre TODOS os parados, não os filtrados).
  const valorParado = parados.reduce((s, p) => s + p.totalCentavos, 0);
  const taxa =
    stats.temDados && stats.recuperadosQtd + parados.length > 0
      ? Math.round((stats.recuperadosQtd / (stats.recuperadosQtd + parados.length)) * 100)
      : null;

  // Lista enriquecida, filtrada e ordenada (mais parado primeiro).
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return parados
      .map((p) => ({ p, t: tempoParado(p.criadoEm, agora) }))
      .filter(({ p, t }) => {
        if (tempoF === "hoje" && t.dias >= 1) return false;
        if (tempoF === "3mais" && t.dias < 3) return false;
        if (tempoF === "7mais" && t.dias < 7) return false;
        const cobrado = foiCobrado(p, cobrados[p.id]);
        if (statusF === "cobrado" && !cobrado) return false;
        if (statusF === "naocobrado" && cobrado) return false;
        if (termo) {
          const alvo = (p.clienteNome + " " + p.clienteTelefone).toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => b.t.ms - a.t.ms);
  }, [parados, agora, tempoF, statusF, busca, cobrados]);

  const nadaParado = parados.length === 0;

  return (
    <div className="px-8 py-7">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">
        Recuperar orçamento
      </div>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="font-title text-3xl font-bold text-cream">
          Dinheiro que ia embora sem ninguém perceber
        </h1>
        <AjudaInfo titulo="Recuperar orçamento" texto="Clientes que pediram orçamento e sumiram sem confirmar. O sistema cobra sozinho na hora certa, e aqui você vê quem priorizar e dá o empurrão com um toque." />
      </div>
      <p className="text-sm text-cream/65 mt-1 mb-6 max-w-2xl">
        Clientes que pediram orçamento e sumiram sem confirmar. O sistema cobra sozinho na hora
        certa, mas aqui você vê quem priorizar e dá o empurrão com um toque.
      </p>

      {/* ---------------- KPIs ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={<AlertTriangle size={18} />}
          rotulo="Em risco agora"
          accent="#e3924a"
        >
          <NumberTicker
            value={valorParado / 100}
            prefix="R$ "
            className="font-title text-[26px] font-bold text-cream"
          />
        </Kpi>

        {/* destaque: o resultado que prova o valor do sistema */}
        <div
          className="relative overflow-hidden rounded-2xl p-4 press"
          style={{
            background: "linear-gradient(135deg,#e7c968 0%,#c89a34 55%,#a97d24 100%)",
            boxShadow: "0 10px 30px rgba(201,154,52,0.28)",
          }}
        >
          <div className="absolute -right-4 -top-4 opacity-25 text-[#4a1020]">
            <Sparkles size={72} />
          </div>
          <div className="flex items-center gap-2 text-[#4a1020]/80">
            <TrendingUp size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Recuperados este mês</span>
          </div>
          <NumberTicker
            value={stats.recuperadoCentavos / 100}
            prefix="R$ "
            className="font-title text-[27px] font-extrabold text-[#4a1020] mt-1.5"
          />
          <div className="text-[12px] font-semibold text-[#4a1020]/75 mt-0.5">
            {stats.recuperadosQtd} orçamentos que voltaram
          </div>
        </div>

        <Kpi icon={<FileClock size={18} />} rotulo="Orçamentos parados" accent="#e6c766">
          <NumberTicker value={parados.length} className="font-title text-[26px] font-bold text-cream" />
        </Kpi>

        <Kpi icon={<Target size={18} />} rotulo="Taxa de recuperação" accent="#5fd08a">
          {taxa === null ? (
            <span className="text-sm text-cream/40 font-medium">Sem dados ainda</span>
          ) : (
            <NumberTicker
              value={taxa}
              suffix="%"
              className="font-title text-[26px] font-bold text-[#5fd08a]"
            />
          )}
        </Kpi>
      </div>

      {/* ---------------- Cobrança automática (compacto e configurável) ---------------- */}
      <div className="glass-soft rounded-2xl px-5 py-3.5 mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-3">
          <div className="grad-cobre w-9 h-9 rounded-xl grid place-items-center text-white shrink-0">
            <Zap size={18} />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-cream">Cobrança automática</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={
                  autoOn
                    ? { background: "rgba(95,208,138,0.16)", color: "#5fd08a" }
                    : { background: "rgba(245,235,220,0.10)", color: "rgba(245,235,220,0.55)" }
                }
              >
                {autoOn ? "Ativada" : "Desligada"}
              </span>
            </div>
            <div className="text-[12px] text-cream/55 mt-0.5">
              Envia sozinha: "{template.replace("{nome}", "").replace(/\s+/g, " ").trim()}"
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <button
            type="button"
            className="text-[12px] text-dourado font-medium hover:underline"
            onClick={() => {
              setTemplate(msgCobranca);
              setPersonalizando(true);
            }}
          >
            Personalizar mensagem
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={autoOn}
            onClick={() => setAutoOn((v) => !v)}
            className="relative h-6 w-11 rounded-full transition-colors shrink-0 press"
            style={{ background: autoOn ? "linear-gradient(135deg,#1fae54,#128c3e)" : "rgba(255,255,255,0.16)" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
              style={{ left: autoOn ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      {/* ---------------- Filtros + busca ---------------- */}
      {!nadaParado && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Segmento
            valor={tempoF}
            set={setTempoF}
            opcoes={[
              ["todos", "Todos"],
              ["hoje", "Hoje"],
              ["3mais", "3+ dias"],
              ["7mais", "7+ dias"],
            ]}
          />
          <Segmento
            valor={statusF}
            set={setStatusF}
            opcoes={[
              ["todos", "Todos"],
              ["cobrado", "Cobrados"],
              ["naocobrado", "Não cobrados"],
            ]}
          />
          <div className="relative ml-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              className="glass-soft rounded-lg pl-9 pr-3 py-2 text-sm text-cream placeholder:text-cream/40 outline-none focus:ring-1 focus:ring-dourado/40 w-56"
            />
          </div>
        </div>
      )}

      {/* ---------------- Lista ---------------- */}
      {nadaParado ? (
        <VazioTudoConfirmado />
      ) : lista.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-10 text-center text-cream/60 text-sm">
          Nenhum orçamento com esses filtros.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {lista.map(({ p, t }) => {
            const cobradoLocal = Boolean(cobrados[p.id]);
            const sc = statusCobranca(p, cobradoLocal);
            const cor = TIER[t.tier];
            const retirada = dataBr(p.retiradaData);
            return (
              <div
                key={p.id}
                className="glass rounded-2xl p-5"
                style={{ boxShadow: `inset 3px 0 0 ${cor.ring}` }}
              >
                {/* topo: cliente + badge tempo + valor */}
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 w-11 h-11 rounded-full grid place-items-center font-title font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg,#8f4712,#b5601a)" }}
                  >
                    {iniciais(p.clienteNome)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="tracking-tight-apple text-lg font-bold text-cream leading-tight">
                        {p.clienteNome}
                      </span>
                      <span
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: cor.bg, color: cor.fg, boxShadow: `inset 0 0 0 1px ${cor.ring}` }}
                      >
                        {t.label}
                      </span>
                    </div>
                    <a
                      href={linkWhatsapp(p.clienteTelefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-cream/60 hover:text-dourado transition-colors mt-0.5"
                    >
                      <WhatsAppGlyph />
                      {formatarTelefoneBR(p.clienteTelefone)}
                    </a>
                    <div className="text-sm text-cream/70 mt-2">
                      {p.itens.map((i) => `${i.qtd}× ${i.produto}`).join(" · ")}
                    </div>
                    {p.observacoes && (
                      <div className="text-xs text-cream/55 italic mt-1">"{p.observacoes}"</div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-title text-xl font-bold text-grad-dourado">
                      {brl(p.totalCentavos)}
                    </div>
                    {retirada && (
                      <div className="text-[12px] text-cream/55 mt-0.5">Retirada {retirada}</div>
                    )}
                  </div>
                </div>

                {/* rodapé: status cobrança + ações */}
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-3.5 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: sc.fg }}>
                    <sc.Icon size={14} />
                    {sc.label}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {cobradoLocal ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[#5fd08a] font-medium px-2">
                        <Send size={14} /> Cobrança enviada
                      </span>
                    ) : (
                      <button
                        onClick={() => setPreview(p)}
                        className="btn-cobre press px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Send size={14} /> Cobrar de volta
                      </button>
                    )}
                    <Link
                      href="/atendimentos"
                      className="press px-3.5 py-2 text-sm rounded-lg text-cream/80 border border-white/12 hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle size={14} /> Abrir conversa
                    </Link>
                    <button
                      onClick={() => setDetalhe(p)}
                      className="press px-3 py-2 text-sm rounded-lg text-cream/60 hover:text-cream hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <FileText size={14} /> Ver orçamento
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- Modal: personalizar a mensagem da cobrança ---------------- */}
      {personalizando ? (
        <Overlay onClose={() => setPersonalizando(false)}>
          <div className="text-[11px] uppercase tracking-wider text-dourado font-semibold">
            Cobrança automática
          </div>
          <h3 className="tracking-tight-apple text-lg font-bold text-cream mt-1 mb-3">
            Personalizar a mensagem
          </h3>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-white/[0.05] border border-white/12 px-4 py-3 text-sm text-cream placeholder:text-cream/40 outline-none focus:ring-1 focus:ring-dourado/40 resize-none"
          />
          <div className="text-[11px] text-cream/50 mt-2">
            Use {"{nome}"} pra o nome do cliente. A mensagem é enviada como template, fora da janela de 24h.
          </div>
          <div className="mt-3 bg-[#f4e8d6] border border-black/5 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-[#4a1020] leading-relaxed">
            {template.replace("{nome}", "Maria")}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setPersonalizando(false)}
              className="px-3.5 py-2 rounded-lg text-sm text-cream/70 border border-white/12 hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvarTemplate}
              disabled={salvandoMsg || !template.trim()}
              className="btn-cobre press px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              Salvar mensagem
            </button>
          </div>
        </Overlay>
      ) : null}

      {/* ---------------- Modal: preview da cobrança ---------------- */}
      {preview ? (
        <Overlay onClose={() => setPreview(null)}>
          <div className="text-[11px] uppercase tracking-wider text-dourado font-semibold">
            Template aprovado, fora da janela de 24h
          </div>
          <h3 className="tracking-tight-apple text-lg font-bold text-cream mt-1 mb-4">
            Mensagem que vai pro WhatsApp de {preview.clienteNome}
          </h3>
          <div className="bg-[#f4e8d6] border border-black/5 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-[#4a1020] leading-relaxed">
            Oi {preview.clienteNome.split(" ")[0]}! Seu orçamento da {nomeNegocio || "padaria"}
            {dataBr(preview.retiradaData) ? ` pro dia ${dataBr(preview.retiradaData)}` : ""} ainda
            está de pé, no valor de <b>{brl(preview.totalCentavos)}</b>. Quer confirmar? É só
            responder por aqui.
          </div>
          <div className="text-[11px] text-cream/55 mt-2">
            Enviado como template (mensagem iniciada pela empresa fora das 24h).
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setPreview(null)}
              className="px-3.5 py-2 rounded-lg text-sm text-cream/70 border border-white/12 hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setCobrados((c) => ({ ...c, [preview.id]: true }));
                setPreview(null);
              }}
              className="btn-cobre press px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Send size={14} /> Enviar cobrança
            </button>
          </div>
        </Overlay>
      ) : null}

      {/* ---------------- Modal: orçamento completo ---------------- */}
      {detalhe ? (
        <Overlay onClose={() => setDetalhe(null)}>
          <div className="text-[11px] uppercase tracking-wider text-dourado font-semibold">
            Orçamento completo
          </div>
          <h3 className="tracking-tight-apple text-lg font-bold text-cream mt-1">
            {detalhe.clienteNome}
          </h3>
          <a
            href={linkWhatsapp(detalhe.clienteTelefone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-cream/60 hover:text-dourado transition-colors"
          >
            <WhatsAppGlyph /> {formatarTelefoneBR(detalhe.clienteTelefone)}
          </a>

          <div className="mt-4 flex flex-col gap-2">
            {detalhe.itens.map((i, k) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-cream/85">
                  <b className="text-cream">{i.qtd}×</b> {i.produto}
                </span>
                <span className="text-cream/60 tabular-nums">{brl(i.subtotalCentavos)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <span className="text-sm text-cream/70">Total</span>
            <span className="font-title text-xl font-bold text-grad-dourado">
              {brl(detalhe.totalCentavos)}
            </span>
          </div>
          {(detalhe.retiradaData || detalhe.observacoes) && (
            <div className="mt-3 text-[12.5px] text-cream/60 space-y-1">
              {detalhe.retiradaData && (
                <div>
                  Retirada: {dataBr(detalhe.retiradaData)}
                  {detalhe.retiradaHora ? ` às ${detalhe.retiradaHora}` : ""}
                </div>
              )}
              {detalhe.observacoes && <div className="italic">"{detalhe.observacoes}"</div>}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setDetalhe(null)}
              className="px-3.5 py-2 rounded-lg text-sm text-cream/70 border border-white/12 hover:bg-white/[0.06] transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => {
                setPreview(detalhe);
                setDetalhe(null);
              }}
              className="btn-cobre press px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Send size={14} /> Cobrar de volta
            </button>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Kpi({
  icon,
  rotulo,
  accent,
  children,
}: {
  icon: React.ReactNode;
  rotulo: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2" style={{ color: accent }}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/60">
          {rotulo}
        </span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Segmento<T extends string>({
  valor,
  set,
  opcoes,
}: {
  valor: T;
  set: (v: T) => void;
  opcoes: [T, string][];
}) {
  return (
    <div className="glass-soft rounded-lg p-1 inline-flex gap-1">
      {opcoes.map(([v, label]) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={
            "press px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors " +
            (valor === v ? "bg-white/15 text-cream" : "text-cream/55 hover:text-cream")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function VazioTudoConfirmado() {
  return (
    <div className="glass rounded-2xl px-6 py-14 text-center">
      <div
        className="mx-auto w-16 h-16 rounded-2xl grid place-items-center text-white mb-4"
        style={{ background: "linear-gradient(135deg,#1fae54,#128c3e)", boxShadow: "0 10px 26px rgba(18,140,62,0.32)" }}
      >
        <Sparkles size={30} />
      </div>
      <div className="font-title text-xl font-bold text-cream">Nenhum orçamento parado</div>
      <div className="text-sm text-cream/60 mt-1">
        Está tudo confirmado. Nenhum dinheiro escapando por aqui.
      </div>
    </div>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-cream/50 hover:text-cream transition-colors"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}
