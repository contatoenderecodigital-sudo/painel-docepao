"use client";

// A TELA-ESTRELA. A fila de pedidos esperando aprovação da equipe.
// Cada pedido é um card: cliente, retirada, itens, total, observação.
// Aprovar -> some com animação e "vai pra cozinha". Recusar -> some.
//
// Anima otimista (some na hora) e grava no banco por trás via Server Action.

import { useEffect, useRef, useState } from "react";
import type { Pedido, FormaPagamento, HistoricoCliente } from "@/lib/tipos";
import { brl, formatarTelefoneBR, linkWhatsapp, mesAno } from "@/lib/tipos";
import { Repeat, UserPlus, Wallet, CalendarDays, AlertTriangle, CreditCard, Banknote, Zap, CheckCircle2, Clock } from "lucide-react";
import CupomPreview from "./CupomPreview";
import AjudaInfo from "./AjudaInfo";

// Icone verde do WhatsApp (marca; lucide nao tem logo de marca).
function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.68-2.79-1.1-4.56-3.96-4.7-4.15-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.96-2.29.24-.26.53-.32.7-.32.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.53.77 1.86.84 2 .07.14.11.3.02.48-.09.19-.14.3-.28.47-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.28.14.46.21.53.32.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

function formataData(iso: string | null) {
  if (!iso) return null;
  const [a, m, d] = iso.split("-");
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dt = new Date(Number(a), Number(m) - 1, Number(d));
  return `${dias[dt.getDay()]} ${d}/${m}`;
}

type IconTipo = React.ComponentType<{ size?: number }>;

// Selo (pill pequena) do historico do cliente.
function Selo({ tom = "neutro", Icon, children }: { tom?: "dourado" | "neutro" | "alerta"; Icon: IconTipo; children: React.ReactNode }) {
  const est =
    tom === "dourado"
      ? { bg: "rgba(231,207,148,0.15)", c: "#e7cf94" }
      : tom === "alerta"
        ? { bg: "rgba(224,30,30,0.15)", c: "#ff8a8a" }
        : { bg: "rgba(255,255,255,0.06)", c: "rgba(251,245,236,0.7)" };
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: est.bg, color: est.c }}>
      <Icon size={12} /> {children}
    </span>
  );
}

// Selos do historico REGISTRADO PELO SISTEMA (nunca o relacionamento real da
// padaria). Sem dados, mostra estado vazio honesto.
function HistoricoSelos({ h }: { h?: HistoricoCliente | null }) {
  if (!h) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Selo Icon={UserPlus}>Primeiro pedido pelo sistema</Selo>
        <span className="text-[11px] text-cream/40">Sem histórico ainda</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {h.pedidosSistema > 1 ? (
        <Selo tom="dourado" Icon={Repeat}>Cliente recorrente · {h.pedidosSistema} pedidos pelo sistema</Selo>
      ) : (
        <Selo Icon={UserPlus}>Primeiro pedido pelo sistema</Selo>
      )}
      {h.totalRegistradoCentavos > 0 && <Selo Icon={Wallet}>{brl(h.totalRegistradoCentavos)} registrados</Selo>}
      {h.primeiroPedidoEm && <Selo Icon={CalendarDays}>No sistema desde {mesAno(h.primeiroPedidoEm)}</Selo>}
      {h.naoRetirados > 0 && <Selo tom="alerta" Icon={AlertTriangle}>{h.naoRetirados} pedidos não retirados</Selo>}
    </div>
  );
}

// Badge da forma de pagamento (do banco). Sem forma, mostra neutro na retirada.
function PagamentoBadge({ forma }: { forma?: FormaPagamento | null }) {
  const map: Record<FormaPagamento, { txt: string; c: string; bg: string; Icon: IconTipo }> = {
    pix: { txt: "PIX", c: "#35c46f", bg: "rgba(53,196,111,0.15)", Icon: Zap },
    dinheiro: { txt: "Dinheiro", c: "#e0b04a", bg: "rgba(231,207,148,0.15)", Icon: Banknote },
    cartao: { txt: "Cartão", c: "#7aa2e3", bg: "rgba(122,162,227,0.15)", Icon: CreditCard },
    pago: { txt: "Já pago", c: "#35c46f", bg: "rgba(53,196,111,0.15)", Icon: CheckCircle2 },
  };
  const f = forma ? map[forma] : { txt: "Pagamento na retirada", c: "rgba(251,245,236,0.7)", bg: "rgba(255,255,255,0.06)", Icon: Clock };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: f.bg, color: f.c }}>
      <f.Icon size={13} /> {f.txt}
    </span>
  );
}

function CardPedido({
  pedido,
  onAprovar,
  onRecusar,
  onVerCupom,
  saindo,
}: {
  pedido: Pedido;
  onAprovar: (id: string) => void;
  onRecusar: (id: string) => void;
  onVerCupom: (p: Pedido) => void;
  saindo: boolean;
}) {
  const data = formataData(pedido.retiradaData);
  return (
    <div
      className={
        "glass rounded-[18px] overflow-hidden flex flex-col " +
        (saindo ? "card-out" : "")
      }
    >
      {/* Cabeçalho: cliente + retirada */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-white/10">
        <div className="min-w-0">
          <div className="t-cardname text-cream truncate">{pedido.clienteNome}</div>
          <a
            href={linkWhatsapp(pedido.clienteTelefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-cream/60 mt-1 hover:text-cream transition-colors"
          >
            <WhatsAppIcon /> {formatarTelefoneBR(pedido.clienteTelefone)}
          </a>
          <HistoricoSelos h={pedido.historicoCliente} />
        </div>
        <div className="text-right shrink-0">
          <div className="t-label text-cream/45">Retirada</div>
          <div className="text-sm font-semibold text-cream mt-0.5">
            {data ?? "-"}{pedido.retiradaHora ? ` · ${pedido.retiradaHora}` : ""}
          </div>
          {pedido.pessoas ? (
            <span
              className="inline-block mt-2 text-[11px] font-semibold text-dourado px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(231,207,148,0.15)" }}
            >
              festa de {pedido.pessoas} pessoas
            </span>
          ) : null}
        </div>
      </div>

      {/* Corpo: itens */}
      <div className="px-6 py-4 flex-1 flex flex-col">
        <ul className="flex flex-col">
          {pedido.itens.map((it, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
              <span className="text-cream/90 min-w-0">
                <span className="font-semibold text-cream">{it.qtd}×</span> {it.produto}
              </span>
              <span className="text-cream/65 tabular-nums shrink-0">
                {brl(it.subtotalCentavos)}
              </span>
            </li>
          ))}
        </ul>
        {pedido.observacoes ? (
          <div
            className="mt-3 flex items-start gap-2 text-[13px] text-cream/75 rounded-[10px] px-3 py-2.5 leading-relaxed"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <svg className="mt-[3px] shrink-0 text-dourado" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H8l-4 4V4Z" /><path d="M8 9h8M8 12.5h5" /></svg>
            <span><span className="font-semibold text-dourado">Obs:</span> {pedido.observacoes}</span>
          </div>
        ) : null}
      </div>

      {/* Rodapé: total + ações */}
      <div className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="shrink-0">
          <div className="t-label text-cream/45">Total</div>
          <div className="t-money text-[26px] leading-none mt-1 text-grad-dourado">
            {brl(pedido.totalCentavos)}
          </div>
          <div className="mt-2">
            <PagamentoBadge forma={pedido.formaPagamento} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <button
            onClick={() => onVerCupom(pedido)}
            className="btn-cobre press px-3.5 py-2 text-sm font-semibold"
          >
            Ver cupom
          </button>
          <button
            onClick={() => onRecusar(pedido.id)}
            className="btn-vermelho press px-3.5 py-2 text-sm font-semibold"
          >
            Recusar
          </button>
          <button
            onClick={() => onAprovar(pedido.id)}
            className="btn-verde press px-4 py-2 text-sm font-semibold"
          >
            Aprovar e imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilaAprovacao({
  inicial,
  aprovar,
  recusar,
  nomeNegocio = "",
}: {
  inicial: Pedido[];
  aprovar?: (id: string) => Promise<{ ok: boolean }>;
  recusar?: (id: string) => Promise<{ ok: boolean }>;
  nomeNegocio?: string;
}) {
  const [fila, setFila] = useState(inicial);
  const [saindo, setSaindo] = useState<Record<string, boolean>>({});
  const [ultimo, setUltimo] = useState<{ nome: string; acao: "aprovado" | "recusado" } | null>(null);
  const [cupom, setCupom] = useState<Pedido | null>(null);
  // ids resolvidos localmente: nao deixa reaparecer se o poll rodar antes do banco atualizar.
  const resolvidosRef = useRef<Set<string>>(new Set());

  // Auto-update: busca a fila a cada 5s (pedido novo cai na tela sozinho).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/aprovacao");
        if (!r.ok) return;
        const nova = (await r.json()) as Pedido[];
        setFila(nova.filter((p) => !resolvidosRef.current.has(p.id)));
      } catch {
        /* silencioso */
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  function resolver(id: string, acao: "aprovado" | "recusado") {
    const p = fila.find((x) => x.id === id);
    resolvidosRef.current.add(id);
    setSaindo((s) => ({ ...s, [id]: true }));
    setUltimo(p ? { nome: p.clienteNome, acao } : null);
    // grava no banco por trás (se as ações vierem plugadas)
    const acaoServidor = acao === "aprovado" ? aprovar : recusar;
    acaoServidor?.(id).catch((e) => console.error("falha ao gravar:", e));
    setTimeout(() => {
      setFila((f) => f.filter((x) => x.id !== id));
      setSaindo((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
    }, 320);
  }

  return (
    <div className="px-8 py-7">
      {/* cabeçalho */}
      <div className="flex items-end justify-between gap-4 mb-1">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-dourado font-semibold">
            Fila de aprovação
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="font-title text-3xl font-bold text-cream">
              {fila.length > 0
                ? `${fila.length} pedido${fila.length > 1 ? "s" : ""} esperando você`
                : "Tudo aprovado"}
            </h1>
            <AjudaInfo titulo="Fila de aprovação" texto="Pedidos que a IA fechou no WhatsApp esperando o seu OK. Aprovar manda pra cozinha e imprime; recusar avisa o cliente. Nenhum pedido entra em produção sem você ver." />
          </div>
        </div>
      </div>
      <p className="text-sm text-cream/70 mb-6 max-w-xl">
        Chegaram pelo WhatsApp. Aprovou, sai impresso na cozinha na hora. Nenhum entra sem você.
      </p>

      {/* aviso do último resolvido */}
      {ultimo ? (
        <div
          className={
            "mb-5 text-sm rounded-lg px-4 py-2.5 border " +
            (ultimo.acao === "aprovado"
              ? "bg-cobre/15 border-cobre/40 text-[color:var(--brand-cobre-l)]"
              : "bg-white/[0.06] border-white/12 text-cream/70")
          }
        >
          {ultimo.acao === "aprovado" ? (
            <>Pedido de <b>{ultimo.nome}</b> aprovado, saiu na impressora da cozinha.</>
          ) : (
            <>Pedido de <b>{ultimo.nome}</b> recusado.</>
          )}
        </div>
      ) : null}

      {/* grid de cards */}
      {fila.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {fila.map((p) => (
            <CardPedido
              key={p.id}
              pedido={p}
              saindo={!!saindo[p.id]}
              onAprovar={(id) => resolver(id, "aprovado")}
              onRecusar={(id) => resolver(id, "recusado")}
              onVerCupom={setCupom}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/12 glass-soft px-8 py-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center text-dourado mb-3" style={{ background: "rgba(212,175,55,0.12)" }}>
            <CheckCircle2 size={26} />
          </div>
          <div className="tracking-tight-apple text-xl font-bold text-cream">
            Fila vazia
          </div>
          <p className="text-sm text-cream/70 mt-1">
            Quando um cliente fechar pedido no WhatsApp, ele aparece aqui.
          </p>
        </div>
      )}

      {cupom ? (
        <CupomPreview pedido={cupom} nomeNegocio={nomeNegocio} onClose={() => setCupom(null)} />
      ) : null}
    </div>
  );
}
