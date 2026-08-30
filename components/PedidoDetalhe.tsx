"use client";

// ============================================================================
//  DETALHE DE UM PEDIDO (modal reutilizável) — mostra TUDO de um pedido:
//  itens com a observação de cada um (forminha, customização do bolo), obs do
//  pedido, foto de referência, data/hora de retirada, status, e o aviso de
//  "confirme antes de aprovar" quando a IA deixou pendência pra equipe.
//  Usado na ficha do Cliente e no Recuperar (clicar no pedido abre isto).
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pedido, PedidoStatus } from "@/lib/tipos";
import { brl, formatarTelefoneBR, linkWhatsapp } from "@/lib/tipos";
import { nomeNoTicket } from "@/lib/departamentos";
import { aprovarPedido, recusarPedido, reimprimirPedido } from "@/app/(painel)/acoes";
import { X, Loader2, Image as ImageIcon, MessageSquare, AlertTriangle, Check, Printer } from "lucide-react";

const STATUS: Record<PedidoStatus, { label: string; fg: string; bg: string }> = {
  aberto: { label: "aberto", fg: "rgba(245,235,220,0.6)", bg: "rgba(245,235,220,0.08)" },
  orcado: { label: "orçamento", fg: "#e6c766", bg: "rgba(212,175,55,0.14)" },
  confirmado: { label: "aguardando aprovação", fg: "#e6c766", bg: "rgba(212,175,55,0.14)" },
  aprovado: { label: "em produção", fg: "#ffc98a", bg: "rgba(255,201,138,0.16)" },
  impresso: { label: "concluído", fg: "#5fd08a", bg: "rgba(95,208,138,0.16)" },
  recusado: { label: "recusado", fg: "#ff8a8a", bg: "rgba(224,30,30,0.14)" },
  cancelado: { label: "cancelado", fg: "rgba(245,235,220,0.55)", bg: "rgba(245,235,220,0.08)" },
};

function dataBr(iso: string | null) {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
function qtdFmt(qtd: number, unidade?: "un" | "kg") {
  return unidade === "kg" ? `${String(qtd).replace(".", ",")} kg` : `${qtd}x`;
}

export default function PedidoDetalhe({
  pedido,
  carregando = false,
  // POR QUE NAO CARREGOU, E NAO SO QUE NAO CARREGOU.
  //
  // Sem isto o modal dizia "Nao consegui carregar este pedido. Tente de novo."
  // pra tudo, inclusive pra sessao expirada. E ai a pessoa tenta de novo, e de
  // novo, e nunca vai ver o pedido: o que ela precisa e recarregar e entrar.
  erro = null,
  onClose,
  footer,
}: {
  pedido: Pedido | null;
  carregando?: boolean;
  erro?: string | null;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const s = pedido ? STATUS[pedido.status] : null;
  const router = useRouter();
  const [agindo, setAgindo] = useState<null | "aprovar" | "recusar" | "reimprimir">(null);
  const [reimpFeito, setReimpFeito] = useState(false);
  // O QUE DEU ERRADO PRECISA APARECER, EM VEZ DE A TELA FECHAR DIZENDO QUE DEU
  // CERTO.
  //
  // O `aprovar` e o `recusar` daqui IGNORAVAM o retorno: chamavam a acao,
  // atualizavam e fechavam o modal, sempre. E o `reimprimir`, tres linhas
  // abaixo, ja conferia (`r?.ok !== false`) desde sempre.
  //
  // Isso ficou pior com o conserto de 28/08/2026: o `aprovarPedido` passou a
  // devolver `{ ok: false }` quando o pedido nao esta mais esperando a equipe
  // (aprovar de novo um pedido ja impresso mandava a cozinha imprimir de novo).
  // Entao agora existe um "nao" de verdade pra ignorar.
  //
  // O caso real: a dona abre o detalhe de um pedido que alguem ja aprovou no
  // meio tempo, clica, o servidor recusa, e a tela fecha como se tivesse
  // aprovado. Ela sai achando que mandou pra cozinha.
  //
  // A `FilaAprovacao` ja fazia certo (desfaz e diz "nada foi para a cozinha");
  // este vizinho nao fazia.
  const [falha, setFalha] = useState<string | null>(null);

  async function aprovar() {
    if (!pedido) return;
    setAgindo("aprovar");
    setFalha(null);
    try {
      const r = await aprovarPedido(pedido.id);
      if (r?.ok === false) {
        setFalha(
          "Não deu pra aprovar: este pedido não está mais esperando a equipe. " +
            "Alguém pode ter aprovado antes. Feche e abra a lista de novo.",
        );
        return;
      }
      router.refresh();
      onClose();
    } catch {
      // Sem isto a acao morria calada: o modal parava de girar e continuava
      // aberto, sem certinho e sem erro, e ninguem sabia se foi pra cozinha.
      setFalha("Sem conexão. NADA foi para a cozinha: tente de novo.");
    } finally {
      setAgindo(null);
    }
  }
  async function recusar() {
    if (!pedido) return;
    setAgindo("recusar");
    setFalha(null);
    try {
      const r = await recusarPedido(pedido.id);
      if (r?.ok === false) {
        setFalha(
          "Não deu pra recusar: este pedido não está mais esperando a equipe. " +
            "Feche e abra a lista de novo.",
        );
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setFalha("Sem conexão. O pedido NÃO foi recusado: tente de novo.");
    } finally {
      setAgindo(null);
    }
  }
  async function reimprimir() {
    if (!pedido) return;
    setAgindo("reimprimir");
    setFalha(null);
    try {
      const r = await reimprimirPedido(pedido.id);
      // FALHAR CALADO AQUI E O CUPOM QUE NAO SAI.
      //
      // Antes o `!ok` so deixava o certinho de fora, e mais nada aparecia: quem
      // clicava via a tela voltar ao normal e ia procurar o papel na
      // impressora, que nunca imprimiu. Numa cozinha isso vira pedido perdido.
      if (r?.ok === false) {
        setFalha("Não consegui mandar pra impressora. O cupom NÃO saiu: tente de novo.");
        return;
      }
      setReimpFeito(true);
      setTimeout(() => setReimpFeito(false), 3000);
    } catch {
      setFalha("Sem conexão. O cupom NÃO saiu: tente de novo.");
    } finally {
      setAgindo(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-xl w-full max-w-lg relative flex flex-col max-h-[88vh]"
        style={{
          background: "rgba(73,16,32,0.97)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-2 top-2 w-11 h-11 grid place-items-center rounded-full text-cream/50 hover:text-cream hover:bg-white/10 transition-colors z-10"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {carregando ? (
          <div className="grid place-items-center py-20 text-cream/60">
            <Loader2 size={26} className="animate-spin" />
          </div>
        ) : !pedido ? (
          <div className="grid place-items-center py-20 text-cream/60 text-sm px-6 text-center">
            {erro ?? "Não consegui carregar este pedido. Tente de novo."}
          </div>
        ) : (
          <>
            {/* cabeçalho */}
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5 flex-wrap pr-8">
                <span className="text-[11px] uppercase tracking-wider text-dourado font-semibold">
                  Pedido
                </span>
                {s && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    {s.label}
                  </span>
                )}
              </div>
              <h3 className="tracking-tight-apple text-lg font-bold text-cream mt-1">
                {pedido.clienteNome}
              </h3>
              {pedido.clienteTelefone && (
                <a
                  href={linkWhatsapp(pedido.clienteTelefone)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-cream/60 hover:text-dourado transition-colors"
                >
                  {formatarTelefoneBR(pedido.clienteTelefone)}
                </a>
              )}
            </div>

            {/* corpo rolável */}
            <div className="px-6 py-4 overflow-y-auto">
              {/* pendência pra equipe */}
              {pedido.precisaConfirmacao && (
                <div
                  className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-4 text-[13px] leading-snug"
                  style={{ background: "rgba(231,207,148,0.12)", border: "1px solid rgba(231,207,148,0.3)" }}
                >
                  <AlertTriangle size={15} className="text-dourado shrink-0 mt-0.5" />
                  <span className="text-cream/90">
                    <b className="text-dourado">Confirme antes de aprovar:</b>{" "}
                    {pedido.motivoHumano || "a equipe precisa revisar este pedido."}
                  </span>
                </div>
              )}

              {/* retirada + pessoas */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-cream/70 mb-4">
                <span>
                  Retirada:{" "}
                  <b className="text-cream">
                    {dataBr(pedido.retiradaData) ?? "a combinar"}
                    {pedido.retiradaHora ? ` às ${pedido.retiradaHora}` : ""}
                  </b>
                </span>
                {pedido.pessoas ? (
                  <span>
                    Festa de <b className="text-cream">{pedido.pessoas} pessoas</b>
                  </span>
                ) : null}
              </div>

              {/* itens */}
              <ul className="flex flex-col gap-2.5">
                {pedido.itens.map((i, ix) => (
                  <li key={ix}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-cream/90">
                        <b className="text-cream tabular-nums">{qtdFmt(i.qtd, i.unidade)}</b>{" "}
                        {nomeNoTicket(i)}
                      </span>
                      <span className="text-[13px] text-cream/60 tabular-nums shrink-0">
                        {brl(i.subtotalCentavos)}
                      </span>
                    </div>
                    {i.obs ? (
                      <div
                        className="mt-1 ml-3 flex items-start gap-1.5 text-[12.5px] text-cream/85 rounded-[8px] px-2.5 py-1.5 leading-snug"
                        style={{ background: "rgba(231,207,148,0.1)", borderLeft: "2px solid rgba(231,207,148,0.6)" }}
                      >
                        <MessageSquare size={12} className="mt-[2px] shrink-0 text-dourado" />
                        <span>{i.obs}</span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* obs do pedido */}
              {pedido.observacoes ? (
                <div
                  className="mt-3 flex items-start gap-1.5 text-[12.5px] text-cream/80 rounded-[8px] px-2.5 py-1.5 leading-snug"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="font-semibold text-dourado shrink-0">Obs do pedido:</span>
                  <span>{pedido.observacoes}</span>
                </div>
              ) : null}

              {/* foto de referência */}
              {pedido.temFoto && (
                <a
                  href={`/api/pedido/${pedido.id}/foto`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 rounded-[10px] pl-1 pr-2.5 py-1 hover:bg-white/[0.06] transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/pedido/${pedido.id}/foto`}
                    alt="Foto de referência"
                    className="w-10 h-10 rounded-[7px] object-cover shrink-0"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  />
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-cream/70">
                    <ImageIcon size={12} className="text-dourado" /> Foto de referência
                          </span>
                          <span
                            role="link"
                            tabIndex={0}
                            title="Baixar foto"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); const a=document.createElement("a"); a.href=`/api/pedido/${pedido.id}/foto?download=1`; a.download=`referencia-${pedido.id}.jpg`; a.click(); }}
                            className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-dourado underline-offset-2 hover:underline"
                          >
                            Baixar
                  </span>
                </a>
              )}

              {/* total */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                <span className="text-sm text-cream/70">Total</span>
                <span className="font-title text-xl font-bold text-grad-dourado">
                  {brl(pedido.totalCentavos)}
                </span>
              </div>
            </div>

            {/* O QUE DEU ERRADO FICA NA TELA, e nao some com o modal.
                Antes o aprovar e o recusar fechavam o modal sempre, mesmo quando
                o servidor recusava a mudanca. */}
            {falha ? (
              <div
                className="mx-6 mb-1 rounded-xl px-4 py-3 text-sm text-cream"
                style={{ background: "rgba(224,30,30,0.12)", border: "1px solid rgba(224,30,30,0.35)" }}
              >
                {falha}
              </div>
            ) : null}

            {/* rodapé — botões padrão conforme o status do pedido */}
            <div className="px-6 py-4 border-t border-white/10 flex flex-wrap justify-end gap-2">
              {pedido.status === "confirmado" && (
                <>
                  <button
                    onClick={recusar}
                    disabled={agindo !== null}
                    className="press px-4 py-2 rounded-lg text-sm font-semibold border border-white/12 inline-flex items-center gap-1.5 hover:bg-white/[0.06] transition-colors disabled:opacity-60"
                    style={{ color: "#ff8a8a" }}
                  >
                    {agindo === "recusar" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Recusar
                  </button>
                  <button
                    onClick={aprovar}
                    disabled={agindo !== null}
                    className="press px-4 py-2 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#1fae54,#128c3e)" }}
                  >
                    {agindo === "aprovar" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Aprovar
                  </button>
                </>
              )}
              {(pedido.status === "aprovado" || pedido.status === "impresso") && (
                <button
                  onClick={reimprimir}
                  disabled={agindo !== null}
                  className="btn-cobre press px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                  title="Enviar este pedido de novo pra impressora da cozinha"
                >
                  {agindo === "reimprimir" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : reimpFeito ? (
                    <Check size={14} />
                  ) : (
                    <Printer size={14} />
                  )}
                  {reimpFeito ? "Enviado pra impressora" : "Reimprimir"}
                </button>
              )}
              {footer}
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-sm text-cream/70 border border-white/12 hover:bg-white/[0.06] transition-colors"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
