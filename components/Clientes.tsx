"use client";

// CRM: a ficha de cada cliente num layout de dois painéis (lista + ficha).
// Histórico de pedidos, total gasto, aniversário e preferências que a
// equipe escreve. O cliente é o centro: dá pra abrir a conversa dele num toque.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClienteCRM, PedidoStatus } from "@/lib/tipos";
import { brl, formatarTelefoneBR, linkWhatsapp, mesAno } from "@/lib/tipos";
import { NumberTicker } from "@/components/ui/number-ticker";
import AjudaInfo from "@/components/AjudaInfo";
import PedidoDetalhe from "@/components/PedidoDetalhe";
import type { Pedido } from "@/lib/tipos";
import { avisoDeSessao } from "@/lib/buscar-do-painel";
import {
  Users,
  Search,
  Cake,
  MessageCircle,
  ShoppingBag,
  Banknote,
  CalendarClock,
  Save,
  Loader2,
  Check,
  ChevronRight,
} from "lucide-react";

const STATUS: Record<PedidoStatus, { label: string; fg: string; bg: string }> = {
  aberto: { label: "aberto", fg: "rgba(245,235,220,0.6)", bg: "rgba(245,235,220,0.08)" },
  orcado: { label: "orçamento", fg: "#e6c766", bg: "rgba(212,175,55,0.14)" },
  confirmado: { label: "aguardando aprovação", fg: "#e6c766", bg: "rgba(212,175,55,0.14)" },
  aprovado: { label: "em produção", fg: "#ffc98a", bg: "rgba(255,201,138,0.16)" },
  impresso: { label: "concluído", fg: "#5fd08a", bg: "rgba(95,208,138,0.16)" },
  recusado: { label: "recusado", fg: "#ff8a8a", bg: "rgba(224,30,30,0.14)" },
  cancelado: { label: "cancelado", fg: "rgba(245,235,220,0.55)", bg: "rgba(245,235,220,0.08)" },
};

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
// O servidor roda em UTC e o banco guarda timestamptz. Às 22h35 do dia 18 na
// padaria o carimbo já é 19/08 em UTC (o banco confirmou "servidor 2026-08-19,
// padaria 2026-08-18"), e o histórico do cliente mostrava "19/08/26" num pedido
// feito hoje: toda noite, depois das 21h, a dona via pedido de hoje datado de
// amanhã. Então: se o valor vem com fuso (o "Z" do ISO ou o "+00" do Postgres),
// convertemos pra hora da padaria antes de cortar o dia. Se vem sem fuso, já é
// data da padaria (coluna date ou to_char no fuso) e basta ler os dígitos.
const TZ_PADARIA = "America/Sao_Paulo";
const ISO_PADARIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_PADARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
// Exige hora antes do fuso, senão o "-18" de "2026-08-18" passaria por offset.
const COM_FUSO = /\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:Z|z|[+-]\d{2}(?::?\d{2})?)$/;

function isoNaPadaria(valor: string | null): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!COM_FUSO.test(texto)) return texto.slice(0, 10);
  // O Postgres escreve o fuso como "+00" e o JS só entende "+00:00". Sem
  // normalizar, o new Date desiste do fuso, lê como hora local e a conversão
  // simplesmente não acontece (o pedido das 22h35 continuava caindo em 19/08).
  const normalizado = texto
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(normalizado);
  if (Number.isNaN(d.getTime())) return texto.slice(0, 10);
  return ISO_PADARIA.format(d);
}

function dataCurta(iso: string | null) {
  const base = isoNaPadaria(iso);
  if (!base) return null;
  const [a, m, d] = base.split("-");
  // O ano de dois dígitos economizava três caracteres e criava um quarto
  // formato de data no painel. Encomenda de formatura fecha com meses de
  // antecedência: ano cortado ali vira discussão no balcão.
  return `${d}/${m}/${a}`;
}
function diaMes(iso: string | null) {
  const base = isoNaPadaria(iso);
  if (!base) return null;
  const [, m, d] = base.split("-");
  return `${d}/${m}`;
}
// "ago/2026" no fuso da padaria. O "cliente desde" também é timestamptz, e no
// dia 1 de madrugada ele pularia o mês inteiro pra frente.
function mesAnoPadaria(iso: string | null) {
  const base = isoNaPadaria(iso);
  return base ? mesAno(base) : null;
}

export default function Clientes({
  clientes,
  mesAtual,
}: {
  clientes: ClienteCRM[];
  mesAtual: number;
}) {
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState(clientes[0]?.id ?? "");

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) => (c.nome + " " + c.telefone).toLowerCase().includes(t));
  }, [clientes, busca]);

  // Buscar por um nome que nao existe mostrava "Nenhum cliente encontrado" e
  // deixava a ficha do cliente anterior aberta embaixo, como se ele tivesse
  // sido achado. A ficha tem que sair da lista filtrada, nao da lista inteira.
  const sel = lista.find((c) => c.id === selId) ?? lista[0] ?? null;

  const totalClientes = clientes.length;
  // Number() defensivo: o banco pode devolver o total como string (bigint do sum),
  // e "s + string" concatenaria em vez de somar.
  const faturamento = clientes.reduce((s, c) => s + (Number(c.totalGastoCentavos) || 0), 0);
  const aniversariantes = clientes.filter(
    (c) => c.aniversario && Number(c.aniversario.slice(5, 7)) === mesAtual,
  ).length;

  return (
    <div className="px-4 py-5 md:px-8 md:py-7">
      <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">CRM</div>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="font-title text-3xl font-bold text-cream">Clientes</h1>
        <AjudaInfo titulo="Clientes" texto="A ficha de cada cliente: histórico de pedidos, quanto já gastou, aniversário e as preferências que a equipe anota. Clique num cliente pra ver tudo e abrir a conversa dele." />
      </div>
      <p className="text-sm text-cream/60 mt-1 mb-5 max-w-2xl">
        Todo mundo que já falou com a padaria, com histórico e preferências. Saiba quem fidelizar e
        atenda cada um pelo nome.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 max-w-2xl">
        <MiniKpi icon={<Users size={16} />} rotulo="Clientes">
          <NumberTicker value={totalClientes} className="font-title text-2xl font-bold text-cream" />
        </MiniKpi>
        {/* Dizia "Já compraram" e mostrava dinheiro: o rótulo pedia gente e o
            valor entregava reais, então R$ 0,00 lia-se como "ninguém comprou". */}
        <MiniKpi icon={<Banknote size={16} />} rotulo="Faturado com eles">
          {/* decimals=2: sem isso o KPI mostrava "R$ 0" enquanto Resultados
              mostrava "R$ 0,00" pro mesmo dinheiro, e as duas telas pareciam
              contar coisas diferentes. */}
          <NumberTicker value={faturamento / 100} prefix="R$ " decimals={2} className="font-title text-2xl font-bold text-grad-dourado" />
        </MiniKpi>
        <MiniKpi icon={<Cake size={16} />} rotulo="Aniversários no mês">
          <NumberTicker value={aniversariantes} className="font-title text-2xl font-bold text-cream" />
        </MiniKpi>
      </div>

      {/* dois painéis */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-4 lg:h-[calc(100vh-300px)] lg:min-h-[440px]">
        {/* lista */}
        <div className="glass rounded-2xl flex flex-col overflow-hidden max-h-[60vh] lg:max-h-none">
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente"
                className="w-full bg-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-sm text-cream placeholder:text-cream/40 outline-none focus:ring-1 focus:ring-dourado/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {lista.map((c) => {
              const on = c.id === sel?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelId(c.id)}
                  className={
                    "w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors " +
                    (on ? "bg-white/12" : "hover:bg-white/[0.06]")
                  }
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-full grid place-items-center font-title font-bold text-white text-[13px]"
                    style={{ background: "linear-gradient(135deg,#96741a,#bb921f)" }}
                  >
                    {iniciais(c.nome)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-cream truncate">{c.nome}</span>
                    <span className="block text-[12px] text-cream/50">
                      {c.qtdPedidos} {c.qtdPedidos === 1 ? "pedido" : "pedidos"} ·{" "}
                      {c.totalGastoCentavos > 0 ? brl(c.totalGastoCentavos) : "ainda sem compra fechada"}
                    </span>
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && (
              <div className="text-center text-sm text-cream/50 py-10">Nenhum cliente encontrado.</div>
            )}
          </div>
        </div>

        {/* ficha */}
        {sel ? (
          <Ficha key={sel.id} c={sel} />
        ) : (
          <div className="glass rounded-2xl grid place-items-center text-cream/50 text-sm">
            Selecione um cliente.
          </div>
        )}
      </div>
    </div>
  );
}

function Ficha({ c }: { c: ClienteCRM }) {
  const [nota, setNota] = useState(c.nota ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  // O "SALVO" SO PODE APARECER SE SALVOU.
  //
  // A funcao abaixo chamava a rota e marcava `salvo` sem olhar a resposta. A
  // dona escreve a preferencia do cliente (pode ser uma alergia), ve o certinho
  // verde, fecha, e a nota nao existe.
  //
  // Achado na leitura do `components/`, 28/08/2026.
  const [erroNota, setErroNota] = useState<string | null>(null);
  // Detalhe de um pedido do histórico (a ficha só tem o resumo; busca o completo).
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Pedido | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  async function abrirPedido(id: string) {
    setDetalhe(null);
    setDetalheAberto(true);
    setCarregandoDetalhe(true);
    try {
      const r = await fetch(`/api/pedido/${id}`);
      if (r.ok) setDetalhe((await r.json()) as Pedido);
    } catch {
      /* o modal mostra o estado de erro */
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    setErroNota(null);
    try {
      const r = await fetch("/api/cliente/nota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: c.telefone, nota }),
      });
      if (!r.ok) {
        setErroNota(
          avisoDeSessao(r.status) ??
            "Não consegui salvar a nota. O que você escreveu continua aqui: tente de novo.",
        );
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch {
      setErroNota("Sem conexão. O que você escreveu continua aqui: tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="glass rounded-2xl lg:overflow-y-auto p-4 sm:p-6">
      {/* cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        <span
          className="shrink-0 w-14 h-14 rounded-2xl grid place-items-center font-title font-bold text-white text-lg"
          style={{ background: "linear-gradient(135deg,#96741a,#bb921f)" }}
        >
          {iniciais(c.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-cream tracking-tight-apple">{c.nome}</span>
          </div>
          <a
            href={linkWhatsapp(c.telefone)}
            target="_blank"
            rel="noreferrer"
            /* 19,5px era o menor alvo da tela, e é o atalho pro WhatsApp. */
            className="inline-flex items-center gap-1.5 text-[13px] text-cream/60 hover:text-dourado transition-colors mt-0.5 h-11 sm:h-auto"
          >
            <WhatsAppGlyph /> {formatarTelefoneBR(c.telefone)}
          </a>
          <div className="flex items-center gap-4 mt-2 text-[12.5px] text-cream/60">
            {c.aniversario && (
              <span className="inline-flex items-center gap-1.5">
                <Cake size={14} className="text-dourado" /> {diaMes(c.aniversario)}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/atendimentos?cliente=${encodeURIComponent(c.telefone)}`}
          className="press btn-cobre px-3.5 h-11 sm:h-auto sm:py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
        >
          <MessageCircle size={15} /> Abrir conversa
        </Link>
      </div>

      {/* KPIs do cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        <FichaKpi icon={<ShoppingBag size={15} />} rotulo="Pedidos" valor={String(c.qtdPedidos)} />
        <FichaKpi icon={<Banknote size={15} />} rotulo="Total gasto" valor={brl(c.totalGastoCentavos)} dourado />
        <FichaKpi icon={<CalendarClock size={15} />} rotulo="Cliente desde" valor={mesAnoPadaria(c.clienteDesde) ?? "sem registro"} />
      </div>

      {/* preferências */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-cream mb-1">Preferências e observações</div>
        <div className="text-[12px] text-cream/50 mb-2">
          O que vale lembrar deste cliente. A equipe escreve, todo mundo enxerga.
        </div>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ex: sempre salgado assado, não gosta de coco, aniversário do filho em março"
          rows={3}
          className="w-full rounded-xl bg-white/[0.05] border border-white/12 px-4 py-3 text-sm text-cream placeholder:text-cream/40 outline-none focus:ring-1 focus:ring-dourado/40 resize-none"
        />
        <div className="mt-2">
          <button
            onClick={salvar}
            disabled={salvando || nota === (c.nota ?? "")}
            className="btn-cobre press px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : <Save size={14} />}
            {salvo ? "Salvo" : "Salvar"}
          </button>
          {/* O QUE NAO SALVOU FICA DITO, e a nota continua no campo.
              Antes o "Salvo" aparecia mesmo quando a gravacao falhava: a dona
              escrevia a preferencia do cliente (pode ser uma alergia), via o
              certinho verde, fechava, e a nota nao existia. */}
          {erroNota ? (
            <div
              className="mt-2 rounded-lg px-3 py-2 text-[13px] text-cream"
              style={{ background: "rgba(224,30,30,0.12)", border: "1px solid rgba(224,30,30,0.3)" }}
            >
              {erroNota}
            </div>
          ) : null}
        </div>
      </div>

      {/* histórico de pedidos */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-cream mb-3">Histórico de pedidos</div>
        {c.pedidos.length === 0 ? (
          <div className="text-sm text-cream/50">Nenhum pedido registrado ainda.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {c.pedidos.map((p) => {
              const s = STATUS[p.status];
              return (
                <button
                  key={p.id}
                  onClick={() => abrirPedido(p.id)}
                  className="group w-full text-left flex items-center gap-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-cream/90">
                      {p.itens} {p.itens === 1 ? "item" : "itens"}
                      {p.data && <span className="text-cream/50"> · retirada {diaMes(p.data)}</span>}
                    </div>
                    <div className="text-[12px] text-cream/45">{dataCurta(p.criadoEm)}</div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>
                    {s.label}
                  </span>
                  <span className="text-sm font-semibold text-cream tabular-nums w-24 text-right">
                    {brl(p.totalCentavos)}
                  </span>
                  <ChevronRight size={16} className="text-cream/30 group-hover:text-dourado transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {detalheAberto && (
        <PedidoDetalhe
          pedido={detalhe}
          carregando={carregandoDetalhe}
          onClose={() => setDetalheAberto(false)}
        />
      )}
    </div>
  );
}

function MiniKpi({ icon, rotulo, children }: { icon: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-dourado">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/55">{rotulo}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FichaKpi({ icon, rotulo, valor, dourado }: { icon: React.ReactNode; rotulo: string; valor: string; dourado?: boolean }) {
  return (
    <div className="glass-soft rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-cream/50 font-semibold">
        <span className="text-dourado">{icon}</span>
        {rotulo}
      </div>
      <div className={"text-lg font-bold mt-1 " + (dourado ? "text-grad-dourado" : "text-cream")}>{valor}</div>
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
